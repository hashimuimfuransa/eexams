const StudentList = require('../models/StudentList');
const User = require('../models/User');

// @desc    Create a new student list
// @route   POST /api/student-lists
// @access  Private (Teacher)
const createStudentList = async (req, res) => {
  try {
    const { name, description, students, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'List name is required' });
    }

    if (!students || !Array.isArray(students)) {
      return res.status(400).json({ message: 'Students array is required' });
    }

    // Validate students
    for (const student of students) {
      if (!student.name || !student.email) {
        return res.status(400).json({ 
          message: 'Each student must have a name and email' 
        });
      }
    }

    // Create the student list
    const studentList = await StudentList.create({
      teacher: req.user._id,
      name,
      description: description || '',
      students,
      sortOrder: sortOrder || 'custom'
    });

    res.status(201).json({
      success: true,
      message: 'Student list created successfully',
      studentList
    });
  } catch (error) {
    console.error('Create student list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all student lists for a teacher
// @route   GET /api/student-lists
// @access  Private (Teacher)
const getStudentLists = async (req, res) => {
  try {
    const lists = await StudentList.findByTeacher(req.user._id);

    res.json({
      success: true,
      lists
    });
  } catch (error) {
    console.error('Get student lists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get a single student list
// @route   GET /api/student-lists/:id
// @access  Private (Teacher)
const getStudentList = async (req, res) => {
  try {
    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    // Sort students based on the list's sort order
    list.sortStudents();

    res.json({
      success: true,
      list
    });
  } catch (error) {
    console.error('Get student list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a student list
// @route   PUT /api/student-lists/:id
// @access  Private (Teacher)
const updateStudentList = async (req, res) => {
  try {
    const { name, description, students, sortOrder } = req.body;

    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    // Update fields
    if (name) list.name = name;
    if (description !== undefined) list.description = description;
    if (students && Array.isArray(students)) {
      // Validate students
      for (const student of students) {
        if (!student.name || !student.email) {
          return res.status(400).json({ 
            message: 'Each student must have a name and email' 
          });
        }
      }
      list.students = students;
    }
    if (sortOrder) list.sortOrder = sortOrder;

    // Sort students if sort order changed
    if (sortOrder && sortOrder !== 'custom') {
      list.sortStudents();
    }

    list.updatedAt = Date.now();
    await list.save();

    res.json({
      success: true,
      message: 'Student list updated successfully',
      list
    });
  } catch (error) {
    console.error('Update student list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a student list
// @route   DELETE /api/student-lists/:id
// @access  Private (Teacher)
const deleteStudentList = async (req, res) => {
  try {
    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    // Soft delete by setting isActive to false
    list.isActive = false;
    list.updatedAt = Date.now();
    await list.save();

    res.json({
      success: true,
      message: 'Student list deleted successfully'
    });
  } catch (error) {
    console.error('Delete student list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a student to a list
// @route   POST /api/student-lists/:id/students
// @access  Private (Teacher)
const addStudentToList = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    // Check if student already exists in the list
    const existingStudent = list.students.find(
      s => s.email.toLowerCase() === email.toLowerCase()
    );

    if (existingStudent) {
      return res.status(400).json({ message: 'Student already in the list' });
    }

    // Add student
    list.students.push({
      name,
      email: email.toLowerCase(),
      studentId: null
    });

    // Sort if needed
    if (list.sortOrder !== 'custom') {
      list.sortStudents();
    }

    await list.save();

    res.json({
      success: true,
      message: 'Student added successfully',
      list
    });
  } catch (error) {
    console.error('Add student to list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove a student from a list
// @route   DELETE /api/student-lists/:id/students/:studentEmail
// @access  Private (Teacher)
const removeStudentFromList = async (req, res) => {
  try {
    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    // Remove student
    list.students = list.students.filter(
      s => s.email.toLowerCase() !== req.params.studentEmail.toLowerCase()
    );

    await list.save();

    res.json({
      success: true,
      message: 'Student removed successfully',
      list
    });
  } catch (error) {
    console.error('Remove student from list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Sort students in a list
// @route   PUT /api/student-lists/:id/sort
// @access  Private (Teacher)
const sortStudentList = async (req, res) => {
  try {
    const { sortOrder } = req.body;

    if (!sortOrder || !['name-asc', 'name-desc', 'email-asc', 'email-desc', 'custom'].includes(sortOrder)) {
      return res.status(400).json({ message: 'Invalid sort order' });
    }

    const list = await StudentList.findOne({
      _id: req.params.id,
      teacher: req.user._id
    });

    if (!list) {
      return res.status(404).json({ message: 'Student list not found' });
    }

    list.sortOrder = sortOrder;
    list.sortStudents();
    await list.save();

    res.json({
      success: true,
      message: 'Student list sorted successfully',
      list
    });
  } catch (error) {
    console.error('Sort student list error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createStudentList,
  getStudentLists,
  getStudentList,
  updateStudentList,
  deleteStudentList,
  addStudentToList,
  removeStudentFromList,
  sortStudentList
};
