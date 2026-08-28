const mongoose = require('mongoose');
const User = require('../models/User');
const AcademicRecord = require('../models/AcademicRecord');
const ActivityLog = require('../models/ActivityLog');
const { GRADE_SCALE, PASS_PERCENTAGE, gradeLetter } = require('../utils/gradeScale');
const {
  normalizeRegistrationNumber,
  isValidRegistrationNumber,
  generateRegistrationNumber,
  assignRegistrationNumber
} = require('../utils/registrationNumber');

const isSuperAdmin = (user) => user?.role === 'superadmin' || user?.isSuperAdmin === true;

/**
 * Mongo filter matching every student the caller is allowed to manage.
 * Mirrors the scoping already used by getStudentManagementData/updateStudent:
 * an admin owns students they created plus those created by their teachers;
 * a teacher owns their own plus their admin's.
 */
const buildStudentScopeQuery = async (req) => {
  if (isSuperAdmin(req.user) || !req.orgAdminId) {
    return { role: 'student' };
  }

  if (req.user.role === 'admin') {
    const teachers = await User.find({ role: 'teacher', parentAdmin: req.orgAdminId })
      .select('_id')
      .lean();
    return {
      role: 'student',
      $or: [
        { createdBy: req.orgAdminId },
        { createdBy: { $in: teachers.map(t => t._id) } }
      ]
    };
  }

  return {
    role: 'student',
    $or: [
      { createdBy: req.orgAdminId },
      { createdBy: req.user._id }
    ]
  };
};

/** Load a student by id, or null when it isn't one the caller may manage. */
const findStudentInScope = async (req, studentId) => {
  if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return null;
  const scope = await buildStudentScopeQuery(req);
  return User.findOne({ ...scope, _id: studentId }).select('-password');
};

/**
 * Validate and clean the subject rows posted by the admin. Returns
 * { subjects } on success or { error } with a user-facing message.
 */
const sanitizeSubjects = (rawSubjects) => {
  if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) {
    return { error: 'Add at least one subject with marks.' };
  }
  if (rawSubjects.length > 40) {
    return { error: 'A transcript can hold at most 40 subjects.' };
  }

  const subjects = [];
  const seen = new Set();

  for (const raw of rawSubjects) {
    const name = String(raw?.name || '').trim();
    if (!name) return { error: 'Every subject needs a name.' };

    const key = name.toLowerCase();
    if (seen.has(key)) return { error: `Subject "${name}" is listed twice.` };
    seen.add(key);

    // Number('') is 0, so an omitted mark would silently record a zero.
    if (raw?.marks === undefined || raw?.marks === null || raw?.marks === '') {
      return { error: `Enter the marks scored in "${name}".` };
    }
    const marks = Number(raw.marks);
    const maxMarks = raw?.maxMarks === undefined || raw?.maxMarks === '' ? 100 : Number(raw.maxMarks);

    if (!Number.isFinite(marks) || marks < 0) {
      return { error: `Marks for "${name}" must be a number of 0 or more.` };
    }
    if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
      return { error: `Maximum marks for "${name}" must be greater than 0.` };
    }
    if (marks > maxMarks) {
      return { error: `Marks for "${name}" (${marks}) cannot exceed the maximum of ${maxMarks}.` };
    }

    const coefficient = raw?.coefficient === undefined || raw?.coefficient === ''
      ? 1
      : Number(raw.coefficient);
    if (!Number.isFinite(coefficient) || coefficient < 0) {
      return { error: `Coefficient for "${name}" must be 0 or more.` };
    }

    subjects.push({
      name,
      code: String(raw?.code || '').trim(),
      marks,
      maxMarks,
      coefficient,
      remark: String(raw?.remark || '').trim(),
      teacherName: String(raw?.teacherName || '').trim()
    });
  }

  return { subjects };
};

const parseOptionalInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// @desc    Students the caller may manage, with registration numbers and record counts
// @route   GET /api/admin/transcripts/students
// @access  Private/Admin or Teacher
const getTranscriptStudents = async (req, res) => {
  try {
    const scope = await buildStudentScopeQuery(req);
    const students = await User.find(scope)
      .select('firstName lastName email class registrationNumber organization isBlocked')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const counts = await AcademicRecord.aggregate([
      { $match: { student: { $in: students.map(s => s._id) } } },
      { $group: { _id: '$student', records: { $sum: 1 }, lastUpdated: { $max: '$updatedAt' } } }
    ]);
    const countMap = new Map(counts.map(c => [c._id.toString(), c]));

    res.json({
      students: students.map(s => {
        const c = countMap.get(s._id.toString());
        return { ...s, recordsCount: c?.records || 0, lastRecordAt: c?.lastUpdated || null };
      })
    });
  } catch (error) {
    console.error('Get transcript students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    All academic records for one student
// @route   GET /api/admin/transcripts/student/:studentId
// @access  Private/Admin or Teacher
const getStudentRecords = async (req, res) => {
  try {
    const student = await findStudentInScope(req, req.params.studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const records = await AcademicRecord.find({ student: student._id })
      .sort({ academicYear: -1, term: -1 })
      .lean();

    res.json({
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        class: student.class,
        registrationNumber: student.registrationNumber || null,
        organization: student.organization
      },
      records
    });
  } catch (error) {
    console.error('Get student records error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create or replace a student's marks for one term
// @route   POST /api/admin/transcripts
// @access  Private/Admin or Teacher
const saveStudentRecord = async (req, res) => {
  try {
    const {
      studentId,
      academicYear,
      term,
      class: className,
      subjects: rawSubjects,
      remarks,
      position,
      outOf,
      isPublished
    } = req.body;

    const student = await findStudentInScope(req, studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const year = String(academicYear || '').trim();
    const termName = String(term || '').trim();
    if (!year) return res.status(400).json({ message: 'Academic year is required.' });
    if (!termName) return res.status(400).json({ message: 'Term is required.' });

    const { subjects, error } = sanitizeSubjects(rawSubjects);
    if (error) return res.status(400).json({ message: error });

    // A student with no registration number can't be looked up on /results,
    // so issue one now rather than leaving the transcript unreachable.
    if (!student.registrationNumber) {
      await assignRegistrationNumber(student, req.user.organization || student.organization);
    }

    const schoolId = req.orgAdminId || req.user._id;
    const schoolName = req.user.organization || student.organization || '';

    let record = await AcademicRecord.findOne({
      student: student._id,
      academicYear: year,
      term: termName
    });

    if (record) {
      // Re-entering a term overwrites it — schools correct marks in place.
      record.subjects = subjects;
      if (className !== undefined) record.class = String(className).trim();
      if (remarks !== undefined) record.remarks = String(remarks).trim();
      if (position !== undefined) record.position = parseOptionalInt(position);
      if (outOf !== undefined) record.outOf = parseOptionalInt(outOf);
      if (isPublished !== undefined) record.isPublished = !!isPublished;
      record.registrationNumber = student.registrationNumber || '';
      record.schoolName = schoolName;
      record.issuedBy = req.user._id;
    } else {
      record = new AcademicRecord({
        student: student._id,
        school: schoolId,
        schoolName,
        registrationNumber: student.registrationNumber || '',
        academicYear: year,
        term: termName,
        class: String(className || student.class || '').trim(),
        subjects,
        remarks: String(remarks || '').trim(),
        position: parseOptionalInt(position),
        outOf: parseOptionalInt(outOf),
        isPublished: isPublished === undefined ? true : !!isPublished,
        issuedBy: req.user._id
      });
    }

    await record.save();

    ActivityLog.logActivity({
      user: req.user._id,
      action: 'save_academic_record',
      details: {
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        registrationNumber: student.registrationNumber,
        academicYear: year,
        term: termName,
        subjectsCount: subjects.length
      }
    }).catch(err => console.error('[saveStudentRecord] activity log failed:', err.message));

    res.status(201).json({
      message: 'Marks saved successfully',
      record: record.toObject(),
      registrationNumber: student.registrationNumber
    });
  } catch (error) {
    console.error('Save student record error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A record for this student, year and term already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map(e => e.message).join(', ') });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update an existing academic record
// @route   PUT /api/admin/transcripts/:id
// @access  Private/Admin or Teacher
const updateStudentRecord = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const record = await AcademicRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const student = await findStudentInScope(req, record.student);
    if (!student) return res.status(403).json({ message: 'Not authorised to edit this record' });

    const { academicYear, term, class: className, subjects: rawSubjects, remarks, position, outOf, isPublished } = req.body;

    if (rawSubjects !== undefined) {
      const { subjects, error } = sanitizeSubjects(rawSubjects);
      if (error) return res.status(400).json({ message: error });
      record.subjects = subjects;
    }
    if (academicYear !== undefined) {
      const year = String(academicYear).trim();
      if (!year) return res.status(400).json({ message: 'Academic year is required.' });
      record.academicYear = year;
    }
    if (term !== undefined) {
      const termName = String(term).trim();
      if (!termName) return res.status(400).json({ message: 'Term is required.' });
      record.term = termName;
    }
    if (className !== undefined) record.class = String(className).trim();
    if (remarks !== undefined) record.remarks = String(remarks).trim();
    if (position !== undefined) record.position = parseOptionalInt(position);
    if (outOf !== undefined) record.outOf = parseOptionalInt(outOf);
    if (isPublished !== undefined) record.isPublished = !!isPublished;

    // Keep the snapshot in step if the student was given a number since.
    if (student.registrationNumber) record.registrationNumber = student.registrationNumber;

    await record.save();
    res.json({ message: 'Record updated', record: record.toObject() });
  } catch (error) {
    console.error('Update student record error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Another record already covers this year and term.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an academic record
// @route   DELETE /api/admin/transcripts/:id
// @access  Private/Admin or Teacher
const deleteStudentRecord = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const record = await AcademicRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const student = await findStudentInScope(req, record.student);
    if (!student) return res.status(403).json({ message: 'Not authorised to delete this record' });

    await AcademicRecord.deleteOne({ _id: record._id });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    console.error('Delete student record error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Set or regenerate one student's registration number
// @route   PUT /api/admin/students/:id/registration-number
// @access  Private/Admin or Teacher
const setRegistrationNumber = async (req, res) => {
  try {
    const student = await findStudentInScope(req, req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const requested = normalizeRegistrationNumber(req.body?.registrationNumber);

    if (requested) {
      if (!isValidRegistrationNumber(requested)) {
        return res.status(400).json({
          message: 'Registration number must be 3-30 characters using letters, numbers and dashes.'
        });
      }
      const clash = await User.findOne({ registrationNumber: requested, _id: { $ne: student._id } })
        .select('_id')
        .lean();
      if (clash) {
        return res.status(400).json({ message: 'That registration number is already used by another student.' });
      }
      // updateOne, not save(): the student was loaded without its password,
      // which a full-document save would then fail to validate.
      await User.updateOne({ _id: student._id }, { $set: { registrationNumber: requested } });
      student.registrationNumber = requested;
    } else {
      await assignRegistrationNumber(student, req.user.organization || student.organization);
    }

    // Keep already-issued transcripts findable under the new number.
    await AcademicRecord.updateMany(
      { student: student._id },
      { $set: { registrationNumber: student.registrationNumber } }
    );

    res.json({
      message: 'Registration number updated',
      registrationNumber: student.registrationNumber
    });
  } catch (error) {
    console.error('Set registration number error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'That registration number is already in use.' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Issue registration numbers to every scoped student missing one
// @route   POST /api/admin/students/generate-registration-numbers
// @access  Private/Admin or Teacher
const generateMissingRegistrationNumbers = async (req, res) => {
  try {
    const scope = await buildStudentScopeQuery(req);
    const students = await User.find({
      ...scope,
      registrationNumber: { $in: [null, ''] }
    }).sort({ createdAt: 1 });

    const assigned = [];
    const failed = [];

    for (const student of students) {
      try {
        const number = await assignRegistrationNumber(
          student,
          req.user.organization || student.organization
        );
        assigned.push({
          _id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          registrationNumber: number
        });
      } catch (err) {
        console.error('Failed to assign registration number for', String(student._id), err.message);
        failed.push({
          _id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          reason: err.message
        });
      }
    }

    // Three outcomes, not two: nothing to do, some/all issued, or failures.
    // Reporting "everyone already has one" when every attempt failed hides the error.
    let message;
    if (assigned.length === 0 && failed.length === 0) {
      message = 'Every student already has a registration number.';
    } else if (failed.length === 0) {
      message = `Issued ${assigned.length} registration number${assigned.length === 1 ? '' : 's'}.`;
    } else if (assigned.length === 0) {
      message = `Could not issue any registration numbers. ${failed[0].reason || 'Please try again.'}`;
    } else {
      message = `Issued ${assigned.length} of ${assigned.length + failed.length}. ` +
        `${failed.length} failed: ${failed[0].reason || 'unknown error'}`;
    }

    res.status(assigned.length === 0 && failed.length > 0 ? 500 : 200).json({
      message,
      matched: assigned.length + failed.length,
      assigned,
      failed
    });
  } catch (error) {
    console.error('Generate registration numbers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Preview the next registration number this school would issue
// @route   GET /api/admin/students/next-registration-number
// @access  Private/Admin or Teacher
const previewNextRegistrationNumber = async (req, res) => {
  try {
    const next = await generateRegistrationNumber(req.user.organization);
    res.json({ registrationNumber: next });
  } catch (error) {
    console.error('Preview registration number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Public transcript lookup by registration number
// @route   GET /api/results/transcript/:registrationNumber
// @access  Public
const getTranscriptByRegistrationNumber = async (req, res) => {
  try {
    const regNumber = normalizeRegistrationNumber(req.params.registrationNumber);

    if (!isValidRegistrationNumber(regNumber)) {
      return res.status(400).json({ message: 'Please enter a valid registration number.' });
    }

    const student = await User.findOne({ role: 'student', registrationNumber: regNumber })
      .select('firstName lastName class organization registrationNumber')
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'No student found with that registration number.' });
    }

    const records = await AcademicRecord.find({ student: student._id, isPublished: true })
      .sort({ academicYear: -1, term: 1 })
      .lean();

    if (records.length === 0) {
      return res.status(404).json({
        message: 'No published results yet for this registration number. Please check back with your school.'
      });
    }

    // Career average across every published term, so the page can show an
    // overall figure without the client re-deriving it.
    const overall = Math.round(
      (records.reduce((sum, r) => sum + (r.percentage || 0), 0) / records.length) * 10
    ) / 10;

    res.json({
      student: {
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        class: student.class || '',
        school: student.organization || '',
        registrationNumber: student.registrationNumber
      },
      overallPercentage: overall,
      termsCount: records.length,
      records
    });
  } catch (error) {
    console.error('Get transcript by registration number error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Whole-school export and analytics ─────────────────────────────────────────

/** RFC 4180 escaping: subject names and remarks routinely contain commas. */
const csvCell = (value) => {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvRow = (cells) => cells.map(csvCell).join(',') + '\r\n';

/**
 * Load every record in the caller's school matching the query filters,
 * grouped per student and ready for either export or analytics.
 */
const loadSchoolRecords = async (req) => {
  const scope = await buildStudentScopeQuery(req);
  const students = await User.find(scope)
    .select('firstName lastName email class registrationNumber organization')
    .sort({ class: 1, firstName: 1, lastName: 1 })
    .lean();

  const studentIds = students.map(s => s._id);
  const allRecords = await AcademicRecord.find({ student: { $in: studentIds } })
    .sort({ academicYear: -1, term: 1 })
    .lean();

  // Filter options come from every record, so narrowing one filter never
  // empties the choices offered for the others.
  const availableYears = [...new Set(allRecords.map(r => r.academicYear).filter(Boolean))].sort().reverse();
  const availableTerms = [...new Set(allRecords.map(r => r.term).filter(Boolean))].sort();
  const availableClasses = [...new Set(
    [...allRecords.map(r => r.class), ...students.map(s => s.class)].filter(Boolean)
  )].sort();

  const { academicYear, term, class: className, studentId, publishedOnly } = req.query;
  const records = allRecords.filter(r =>
    (!academicYear || r.academicYear === academicYear) &&
    (!term || r.term === term) &&
    (!className || r.class === className) &&
    (!studentId || String(r.student) === String(studentId)) &&
    (publishedOnly !== 'true' || r.isPublished !== false)
  );

  const byStudent = new Map();
  records.forEach(r => {
    const key = String(r.student);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(r);
  });

  const scopedStudents = studentId
    ? students.filter(s => String(s._id) === String(studentId))
    : students;

  return {
    students: scopedStudents,
    records,
    byStudent,
    filters: { academicYear, term, class: className, availableYears, availableTerms, availableClasses }
  };
};

/** Short label describing the active filters, used in export file names. */
const buildFilterLabel = (req) => [req.query.academicYear, req.query.term, req.query.class]
  .filter(Boolean).join('_');

// @desc    Whole-school (or filtered) transcripts as one printable PDF
// @route   GET /api/admin/transcripts/export/pdf
// @access  Private/Admin or Teacher
const exportTranscriptsPdf = async (req, res) => {
  try {
    const { streamStudentTranscriptPdf, streamSchoolTranscriptsPdf } = require('../utils/transcriptPdf');
    const { students, byStudent } = await loadSchoolRecords(req);
    const schoolName = req.user.organization || students[0]?.organization || 'School';

    // Students with no marks would print an empty page each, so skip them
    // unless the admin explicitly asked for one named student.
    const entries = students
      .map(student => ({ student, records: byStudent.get(String(student._id)) || [] }))
      .filter(entry => entry.records.length > 0 || req.query.studentId);

    if (req.query.studentId && entries.length === 1) {
      return streamStudentTranscriptPdf(res, { ...entries[0], schoolName });
    }

    streamSchoolTranscriptsPdf(res, { schoolName, entries, filterLabel: buildFilterLabel(req) });
  } catch (error) {
    console.error('Export transcripts PDF error:', error);
    // Nothing has been piped yet at this point, so a JSON error is still valid.
    if (!res.headersSent) res.status(500).json({ message: 'Failed to build the transcript PDF' });
  }
};

// @desc    Whole-school marks as CSV (a row per subject, or a row per term)
// @route   GET /api/admin/transcripts/export/csv
// @access  Private/Admin or Teacher
const exportTranscriptsCsv = async (req, res) => {
  try {
    const { students, byStudent } = await loadSchoolRecords(req);
    const summary = req.query.view === 'summary';
    const schoolName = req.user.organization || 'school';

    let csv = summary
      ? csvRow(['Reg Number', 'Student', 'Class', 'Academic Year', 'Term', 'Subjects',
                'Total Marks', 'Out Of', 'Percentage', 'Grade', 'Subjects Passed',
                'Position', 'Class Size', 'Status', 'Remarks'])
      : csvRow(['Reg Number', 'Student', 'Class', 'Academic Year', 'Term', 'Subject', 'Code',
                'Marks', 'Out Of', 'Percentage', 'Grade', 'Subject Remark',
                'Term Total', 'Term Out Of', 'Term Percentage', 'Term Grade', 'Position']);

    students.forEach(student => {
      const name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      (byStudent.get(String(student._id)) || []).forEach(record => {
        if (summary) {
          csv += csvRow([
            student.registrationNumber || '', name, record.class || student.class || '',
            record.academicYear, record.term, (record.subjects || []).length,
            record.totalMarks, record.totalMaxMarks, record.percentage, record.grade,
            record.subjectsPassed, record.position ?? '', record.outOf ?? '',
            record.isPublished === false ? 'Draft' : 'Published', record.remarks || ''
          ]);
        } else {
          (record.subjects || []).forEach(subject => {
            csv += csvRow([
              student.registrationNumber || '', name, record.class || student.class || '',
              record.academicYear, record.term, subject.name, subject.code || '',
              subject.marks, subject.maxMarks, subject.percentage, subject.grade,
              subject.remark || '', record.totalMarks, record.totalMaxMarks,
              record.percentage, record.grade,
              record.position ? `${record.position}${record.outOf ? `/${record.outOf}` : ''}` : ''
            ]);
          });
        }
      });
    });

    const label = [schoolName, buildFilterLabel(req), summary ? 'summary' : 'marks']
      .filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

    // Leading BOM so Excel reads the UTF-8 names (Kinyarwanda, French) correctly.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${label}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Export transcripts CSV error:', error);
    res.status(500).json({ message: 'Failed to build the CSV export' });
  }
};

const round1 = (n) => Math.round(n * 10) / 10;
const average = (nums) => (nums.length ? round1(nums.reduce((a, v) => a + v, 0) / nums.length) : 0);

// @desc    Performance analytics across the school's manually entered marks
// @route   GET /api/admin/transcripts/analytics
// @access  Private/Admin or Teacher
const getTranscriptAnalytics = async (req, res) => {
  try {
    const { students, records, byStudent, filters } = await loadSchoolRecords(req);
    const studentById = new Map(students.map(s => [String(s._id), s]));

    // ── Grade distribution and subject roll-up, in one pass over the marks ──
    const gradeCounts = {};
    const subjectMap = new Map();
    let subjectEntries = 0;

    records.forEach(record => {
      (record.subjects || []).forEach(subject => {
        subjectEntries++;
        gradeCounts[subject.grade] = (gradeCounts[subject.grade] || 0) + 1;

        const key = subject.name.trim().toLowerCase();
        if (!subjectMap.has(key)) {
          subjectMap.set(key, { name: subject.name.trim(), percentages: [], passed: 0 });
        }
        const entry = subjectMap.get(key);
        entry.percentages.push(subject.percentage || 0);
        if ((subject.percentage || 0) >= PASS_PERCENTAGE) entry.passed++;
      });
    });

    const gradeDistribution = GRADE_SCALE.map(g => ({
      grade: g.grade,
      remark: g.remark,
      count: gradeCounts[g.grade] || 0,
      percentage: subjectEntries ? round1(((gradeCounts[g.grade] || 0) / subjectEntries) * 100) : 0
    }));

    const subjectPerformance = [...subjectMap.values()]
      .map(s => ({
        name: s.name,
        entries: s.percentages.length,
        average: average(s.percentages),
        passRate: s.percentages.length ? round1((s.passed / s.percentages.length) * 100) : 0,
        best: s.percentages.length ? Math.max(...s.percentages) : 0,
        worst: s.percentages.length ? Math.min(...s.percentages) : 0
      }))
      .sort((a, b) => b.average - a.average);

    // ── Per-student averages, which drive the class roll-up and the leaderboards ──
    const studentStats = [];
    byStudent.forEach((studentRecords, id) => {
      const student = studentById.get(id);
      if (!student) return;
      const percentages = studentRecords.map(r => r.percentage || 0);
      const avg = average(percentages);
      studentStats.push({
        _id: id,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        registrationNumber: student.registrationNumber || null,
        class: studentRecords[0]?.class || student.class || '',
        terms: studentRecords.length,
        average: avg,
        best: percentages.length ? Math.max(...percentages) : 0,
        worst: percentages.length ? Math.min(...percentages) : 0,
        grade: gradeLetter(avg),
        // Weakest subjects give the admin something actionable per student.
        weakSubjects: [...new Set(
          studentRecords.flatMap(r =>
            (r.subjects || []).filter(s => (s.percentage || 0) < PASS_PERCENTAGE).map(s => s.name)
          )
        )].slice(0, 5)
      });
    });
    studentStats.sort((a, b) => b.average - a.average);

    const classMap = new Map();
    studentStats.forEach(s => {
      const key = s.class || 'Unassigned';
      if (!classMap.has(key)) classMap.set(key, []);
      classMap.get(key).push(s);
    });
    const classPerformance = [...classMap.entries()]
      .map(([className, list]) => ({
        class: className,
        students: list.length,
        average: average(list.map(s => s.average)),
        passRate: round1((list.filter(s => s.average >= PASS_PERCENTAGE).length / list.length) * 100),
        best: Math.max(...list.map(s => s.average)),
        worst: Math.min(...list.map(s => s.average))
      }))
      .sort((a, b) => b.average - a.average);

    // ── Term-over-term trend, oldest first so a chart reads left to right ──
    const trendMap = new Map();
    records.forEach(r => {
      const key = `${r.academicYear} ${r.term}`;
      if (!trendMap.has(key)) {
        trendMap.set(key, { label: key, academicYear: r.academicYear, term: r.term, percentages: [] });
      }
      trendMap.get(key).percentages.push(r.percentage || 0);
    });
    const termTrend = [...trendMap.values()]
      .map(t => ({
        label: t.label, academicYear: t.academicYear, term: t.term,
        records: t.percentages.length, average: average(t.percentages)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const allAverages = studentStats.map(s => s.average);

    res.json({
      filters,
      summary: {
        totalStudents: students.length,
        studentsWithMarks: studentStats.length,
        studentsWithoutMarks: students.length - studentStats.length,
        recordsCount: records.length,
        subjectEntries,
        averagePercentage: average(allAverages),
        passRate: studentStats.length
          ? round1((studentStats.filter(s => s.average >= PASS_PERCENTAGE).length / studentStats.length) * 100)
          : 0,
        highest: allAverages.length ? Math.max(...allAverages) : 0,
        lowest: allAverages.length ? Math.min(...allAverages) : 0,
        subjectsTracked: subjectPerformance.length,
        classesTracked: classPerformance.length
      },
      gradeDistribution,
      subjectPerformance,
      classPerformance,
      termTrend,
      topPerformers: studentStats.slice(0, 10),
      needsAttention: studentStats.filter(s => s.average < PASS_PERCENTAGE).slice(-10).reverse(),
      students: studentStats
    });
  } catch (error) {
    console.error('Get transcript analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Public transcript download as a formal PDF
// @route   GET /api/results/transcript/:registrationNumber/pdf
// @access  Public
const downloadTranscriptByRegistrationNumber = async (req, res) => {
  try {
    const { streamStudentTranscriptPdf } = require('../utils/transcriptPdf');
    const regNumber = normalizeRegistrationNumber(req.params.registrationNumber);

    if (!isValidRegistrationNumber(regNumber)) {
      return res.status(400).json({ message: 'Please enter a valid registration number.' });
    }

    const student = await User.findOne({ role: 'student', registrationNumber: regNumber })
      .select('firstName lastName class organization registrationNumber')
      .lean();

    if (!student) {
      return res.status(404).json({ message: 'No student found with that registration number.' });
    }

    // Same rule as the on-screen transcript: a student only ever sees the terms
    // their school has published.
    const records = await AcademicRecord.find({ student: student._id, isPublished: true })
      .sort({ academicYear: -1, term: 1 })
      .lean();

    if (records.length === 0) {
      return res.status(404).json({
        message: 'No published results yet for this registration number. Please check back with your school.'
      });
    }

    streamStudentTranscriptPdf(res, {
      student,
      records,
      schoolName: records[0].schoolName || student.organization || ''
    });
  } catch (error) {
    console.error('Download transcript PDF error:', error);
    // Nothing is piped until streamStudentTranscriptPdf runs, so JSON is still valid.
    if (!res.headersSent) res.status(500).json({ message: 'Failed to build the transcript PDF' });
  }
};

module.exports = {
  getTranscriptStudents,
  getStudentRecords,
  saveStudentRecord,
  updateStudentRecord,
  deleteStudentRecord,
  setRegistrationNumber,
  generateMissingRegistrationNumbers,
  previewNextRegistrationNumber,
  getTranscriptByRegistrationNumber,
  downloadTranscriptByRegistrationNumber,
  exportTranscriptsPdf,
  exportTranscriptsCsv,
  getTranscriptAnalytics
};
