// Renders student transcripts as printable PDFs — one student per page, every
// recorded term stacked down the page — and streams them to an Express
// response. A school admin can pull one student or the whole school in a
// single document.
//
// PDFKit's table primitive is avoided here for the same reason lessonPlanPdf
// avoids it: each row must measure its tallest cell before any border is
// stroked, otherwise a long subject remark breaks the grid alignment.
const PDFDocument = require('pdfkit');
const { GRADE_SCALE } = require('./gradeScale');

const FONT_REG = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

const BORDER = '#333333';
const SHADE = '#EDF2F7';
const HEAD_SHADE = '#0D406C';
const MUTED = '#64748B';
const PAD = 4;
const LINE = 0.7;

// The standard 14 PDF fonts are WinAnsi-encoded, so typographic punctuation
// has to be folded to ASCII before it reaches the page.
const sanitize = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●▪◦]/g, '-')
    .replace(/[→⇒]/g, '->')
    .replace(/ /g, ' ')
    .trim();
};

const safeFileName = (base, fallback = 'transcript') => {
  const cleaned = sanitize(base) || fallback;
  return `${cleaned.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.pdf`;
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/**
 * Draw one table row, cell by cell, at the height of its tallest cell.
 * @returns {number} the y coordinate just below the row
 */
const drawRow = (doc, { x, y, widths, cells, font = FONT_REG, size = 8.5, fill = null, color = '#000000', minHeight = 0 }) => {
  doc.font(font).fontSize(size);

  // Measure first: the row is only as tall as its longest wrapped cell.
  const heights = cells.map((cell, i) =>
    doc.heightOfString(sanitize(cell.text), { width: widths[i] - PAD * 2, align: cell.align || 'left' })
  );
  const rowHeight = Math.max(minHeight, ...heights) + PAD * 2;

  let cx = x;
  cells.forEach((cell, i) => {
    const w = widths[i];
    if (fill) {
      doc.rect(cx, y, w, rowHeight).fill(fill);
    }
    doc.lineWidth(LINE).strokeColor(BORDER).rect(cx, y, w, rowHeight).stroke();
    doc.fillColor(cell.color || color).font(cell.font || font).fontSize(cell.size || size);
    doc.text(sanitize(cell.text), cx + PAD, y + PAD, {
      width: w - PAD * 2,
      align: cell.align || 'left'
    });
    cx += w;
  });

  doc.fillColor('#000000');
  return y + rowHeight;
};

/**
 * Two-column label/value strip for the student identity block.
 * Labels are pinned to one line (lineBreak: false) so a long label can never
 * wrap down into the row beneath it.
 */
const drawInfoGrid = (doc, x, y, width, pairs) => {
  const colWidth = width / 2;
  const labelWidth = 92;
  const rowHeight = 17;
  let cy = y;

  for (let i = 0; i < pairs.length; i += 2) {
    let cx = x;
    pairs.slice(i, i + 2).forEach(([label, value]) => {
      doc.font(FONT_BOLD).fontSize(8).fillColor(MUTED)
        .text(sanitize(label).toUpperCase(), cx, cy + 1, { width: labelWidth, lineBreak: false });
      doc.font(FONT_BOLD).fontSize(10).fillColor('#000000')
        .text(sanitize(value) || '-', cx + labelWidth, cy, { width: colWidth - labelWidth - 8, lineBreak: false });
      cx += colWidth;
    });
    cy += rowHeight;
  }

  doc.fillColor('#000000');
  return cy;
};

/**
 * Render one student's full transcript starting on the current page.
 * Assumes the caller has already added the page.
 */
const renderStudentTranscript = (doc, { student, records, schoolName, generatedAt }) => {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ── Header ──
  doc.font(FONT_BOLD).fontSize(15).fillColor(HEAD_SHADE)
    .text(sanitize(schoolName || student.school || 'School').toUpperCase(), left, doc.y, { width, align: 'center' });
  doc.moveDown(0.15);
  doc.font(FONT_BOLD).fontSize(10.5).fillColor('#000000')
    .text('STUDENT ACADEMIC TRANSCRIPT', { width, align: 'center' });
  doc.moveDown(0.4);
  doc.lineWidth(1.2).strokeColor(HEAD_SHADE)
    .moveTo(left, doc.y).lineTo(left + width, doc.y).stroke();
  doc.moveDown(0.7);

  // ── Student identity ──
  const overall = records.length
    ? Math.round((records.reduce((sum, r) => sum + (r.percentage || 0), 0) / records.length) * 10) / 10
    : 0;

  const infoBottom = drawInfoGrid(doc, left, doc.y, width, [
    ['Name', `${student.firstName || ''} ${student.lastName || ''}`.trim()],
    ['Reg. Number', student.registrationNumber],
    ['Class', student.class],
    ['Terms', String(records.length)],
    ['Average', records.length ? `${overall}%` : '-'],
    ['Issued', formatDate(generatedAt || Date.now())]
  ]);
  doc.y = infoBottom + 6;

  if (records.length === 0) {
    doc.font(FONT_ITALIC).fontSize(10).fillColor(MUTED)
      .text('No marks have been recorded for this student yet.', left, doc.y, { width });
    doc.fillColor('#000000');
    return;
  }

  // ── One block per term ──
  // Subject | Code | Marks | Out of | % | Grade | Remark
  const widths = [
    width * 0.26, width * 0.08, width * 0.09, width * 0.09,
    width * 0.09, width * 0.09, width * 0.30
  ];

  records.forEach((record, index) => {
    // Keep a term heading with at least its header row on the same page.
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
    } else if (index > 0) {
      doc.y += 8;
    }

    doc.font(FONT_BOLD).fontSize(10).fillColor(HEAD_SHADE)
      .text(`${sanitize(record.term)}  ·  ${sanitize(record.academicYear)}${record.class ? `  ·  Class ${sanitize(record.class)}` : ''}`,
        left, doc.y, { width });
    doc.moveDown(0.3);
    doc.fillColor('#000000');

    let y = doc.y;
    y = drawRow(doc, {
      x: left, y, widths, font: FONT_BOLD, size: 8.5, fill: SHADE,
      cells: [
        { text: 'Subject' }, { text: 'Code' }, { text: 'Marks', align: 'center' },
        { text: 'Out of', align: 'center' }, { text: '%', align: 'center' },
        { text: 'Grade', align: 'center' }, { text: 'Remark' }
      ]
    });

    (record.subjects || []).forEach(subject => {
      // Break before a row that would run off the page, and repeat the header.
      if (y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        y = doc.y;
        y = drawRow(doc, {
          x: left, y, widths, font: FONT_BOLD, size: 8.5, fill: SHADE,
          cells: [
            { text: 'Subject' }, { text: 'Code' }, { text: 'Marks', align: 'center' },
            { text: 'Out of', align: 'center' }, { text: '%', align: 'center' },
            { text: 'Grade', align: 'center' }, { text: 'Remark' }
          ]
        });
      }
      y = drawRow(doc, {
        x: left, y, widths,
        cells: [
          { text: subject.name },
          { text: subject.code || '' },
          { text: String(subject.marks ?? ''), align: 'center' },
          { text: String(subject.maxMarks ?? ''), align: 'center' },
          { text: `${subject.percentage ?? 0}%`, align: 'center' },
          { text: subject.grade || '', align: 'center', font: FONT_BOLD },
          { text: subject.remark || '' }
        ]
      });
    });

    // Totals strip
    y = drawRow(doc, {
      x: left, y, widths, font: FONT_BOLD, size: 8.5, fill: SHADE,
      cells: [
        { text: 'TOTAL' },
        { text: '' },
        { text: String(record.totalMarks ?? 0), align: 'center' },
        { text: String(record.totalMaxMarks ?? 0), align: 'center' },
        { text: `${record.percentage ?? 0}%`, align: 'center' },
        { text: record.grade || '', align: 'center' },
        {
          text: [
            record.position ? `Position ${record.position}${record.outOf ? ` of ${record.outOf}` : ''}` : '',
            `${record.subjectsPassed ?? 0}/${(record.subjects || []).length} subjects passed`
          ].filter(Boolean).join('  ·  ')
        }
      ]
    });

    doc.y = y;

    if (record.remarks) {
      doc.moveDown(0.35);
      doc.font(FONT_BOLD).fontSize(8).fillColor(MUTED).text('SCHOOL REMARKS', left, doc.y, { width });
      doc.font(FONT_REG).fontSize(9).fillColor('#000000')
        .text(sanitize(record.remarks), left, doc.y + 1, { width });
    }
  });

  // ── Grading key ──
  // A transcript that shows letter grades has to say what they mean; without
  // this the document is not readable by anyone outside the school.
  if (doc.y > doc.page.height - doc.page.margins.bottom - 120) doc.addPage();
  doc.y += 10;
  doc.font(FONT_BOLD).fontSize(8).fillColor(MUTED)
    .text('GRADING KEY', left, doc.y, { width });
  doc.y += 2;

  const keyWidths = GRADE_SCALE.map(() => width / GRADE_SCALE.length);
  let keyY = drawRow(doc, {
    x: left, y: doc.y, widths: keyWidths, font: FONT_BOLD, size: 7.5, fill: SHADE,
    cells: GRADE_SCALE.map((g, i) => ({
      // Bands read off the scale itself: A is 90-100, each lower grade stops
      // one point below the band above it.
      text: `${g.grade}  ${g.min}-${i === 0 ? 100 : GRADE_SCALE[i - 1].min - 1}`,
      align: 'center'
    }))
  });
  keyY = drawRow(doc, {
    x: left, y: keyY, widths: keyWidths, size: 7.5,
    cells: GRADE_SCALE.map(g => ({ text: g.remark, align: 'center', color: MUTED }))
  });
  doc.y = keyY;

  // ── Verification ──
  doc.y += 8;
  const reference = `${sanitize(student.registrationNumber) || 'NO-REG'}/${formatDate(generatedAt || Date.now()).replace(/-/g, '')}`;
  doc.font(FONT_BOLD).fontSize(7.5).fillColor(MUTED)
    .text('VERIFICATION', left, doc.y, { width });
  doc.y += 1;
  doc.font(FONT_REG).fontSize(8).fillColor(MUTED).text(
    `Document reference ${reference}. This transcript was issued electronically by ` +
    `${sanitize(schoolName || student.school || 'the school')} and can be verified at ` +
    `www.eexams.net/results using registration number ${sanitize(student.registrationNumber) || '-'}. ` +
    `It is not valid without the school stamp and the signatures below.`,
    left, doc.y, { width }
  );
  doc.fillColor('#000000');

  // ── Signature strip ──
  // Reserve the full height of the strip: 50px of clearance for the stamp box
  // that sits above the rule, plus the rule and its captions.
  const SIGNATURE_BLOCK = 96;
  if (doc.y > doc.page.height - doc.page.margins.bottom - SIGNATURE_BLOCK) doc.addPage();
  doc.y += 50;
  const sigY = doc.y;
  doc.lineWidth(0.7).strokeColor(BORDER)
    .moveTo(left, sigY).lineTo(left + width * 0.32, sigY).stroke()
    .moveTo(left + width * 0.62, sigY).lineTo(left + width, sigY).stroke();
  doc.font(FONT_REG).fontSize(8).fillColor(MUTED)
    .text("Class Teacher", left, sigY + 3, { width: width * 0.32 })
    .text("Head Teacher / Principal", left + width * 0.62, sigY + 3, { width: width * 0.38, align: 'right' });

  // Dotted box between the two signatures for the school stamp.
  const stampW = width * 0.24;
  const stampX = left + (width - stampW) / 2;
  doc.lineWidth(0.6).strokeColor(BORDER).dash(2, { space: 2 })
    .rect(stampX, sigY - 44, stampW, 44).stroke().undash();
  doc.font(FONT_REG).fontSize(7).fillColor(MUTED)
    .text('School stamp', stampX, sigY + 3, { width: stampW, align: 'center' });

  doc.fillColor('#000000');
};

/** Page numbers and a provenance line, stamped once every page exists. */
const stampFooters = (doc, schoolName) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 12;
    doc.font(FONT_REG).fontSize(7.5).fillColor(MUTED);
    doc.text(
      `${sanitize(schoolName || '')} · Generated ${formatDate(Date.now())} · Page ${i - range.start + 1} of ${range.count}`,
      doc.page.margins.left,
      y,
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center', lineBreak: false }
    );
  }
  doc.fillColor('#000000');
};

/**
 * Stream one student's transcript.
 * @param {Object} res Express response (headers not yet sent)
 * @param {Object} payload { student, records, schoolName }
 */
const streamStudentTranscriptPdf = (res, { student, records, schoolName }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });

  const name = `${student.firstName || ''}_${student.lastName || ''}`.trim() || student.registrationNumber;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(`transcript_${name}`)}"`);
  doc.pipe(res);

  renderStudentTranscript(doc, { student, records, schoolName });
  stampFooters(doc, schoolName);

  doc.end();
};

/**
 * Stream a whole-school booklet: every student starts on a fresh page so the
 * pages can be separated and handed out individually.
 * @param {Object} res Express response
 * @param {Object} payload { schoolName, entries: [{ student, records }], filterLabel }
 */
const streamSchoolTranscriptsPdf = (res, { schoolName, entries, filterLabel }) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, autoFirstPage: false });

  const label = filterLabel ? `_${filterLabel}` : '';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(`transcripts_${schoolName}${label}`, 'transcripts')}"`);
  doc.pipe(res);

  if (entries.length === 0) {
    doc.addPage();
    doc.font(FONT_BOLD).fontSize(13).text(sanitize(schoolName || 'School'), { align: 'center' });
    doc.moveDown(1);
    doc.font(FONT_REG).fontSize(10.5).fillColor(MUTED)
      .text('No transcripts match the selected filters.', { align: 'center' });
  } else {
    entries.forEach(entry => {
      doc.addPage();
      renderStudentTranscript(doc, { ...entry, schoolName });
    });
  }

  stampFooters(doc, schoolName);
  doc.end();
};

module.exports = {
  renderStudentTranscript,
  streamStudentTranscriptPdf,
  streamSchoolTranscriptsPdf,
  safeFileName,
  sanitize
};
