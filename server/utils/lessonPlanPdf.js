// Renders a lesson plan as the standard bordered-table PDF teachers hand in
// (REB/CBC layout: header info grid, unit/competence rows, three-step activity
// table, self-evaluation box) and streams it to an Express response.
//
// PDFKit has no table primitive here, so the table is drawn cell by cell: every
// row measures its tallest cell first, then each cell is stroked and filled at
// that height. That is what keeps borders aligned when a teacher writes four
// lines of activities in one column and one line in the next.
const PDFDocument = require('pdfkit');

const FONT_REG = 'Times-Roman';
const FONT_BOLD = 'Times-Bold';
const FONT_ITALIC = 'Times-Italic';

const SHADE = '#D9D9D9';
const BORDER = '#000000';
const PAD = 5;          // inner cell padding
const LINE = 0.9;       // border width

// The standard 14 PDF fonts are WinAnsi-encoded: accented Latin (é, à, ç, î) is
// fine — which matters, plans are often written in French or Kinyarwanda — but
// typographic quotes/dashes and arrows are not, so fold them to ASCII first.
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

// Activity columns print as one "- item" per line.
const bulletList = (lines) => {
  const arr = Array.isArray(lines) ? lines : String(lines || '').split('\n');
  return arr
    .map((l) => sanitize(l))
    .filter(Boolean)
    .map((l) => (l.startsWith('-') ? l : `- ${l}`))
    .join('\n');
};

const measure = (doc, text, width, font, size) => {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text && text.length ? text : ' ', { width: width - 2 * PAD }) + 2 * PAD;
};

const drawCell = (doc, { x, y, w, h, text = '', font = FONT_REG, size = 10, fill = null, align = 'left', valign = 'top' }) => {
  if (fill) doc.save().rect(x, y, w, h).fill(fill).restore();
  doc.save().lineWidth(LINE).strokeColor(BORDER).rect(x, y, w, h).stroke().restore();
  if (!text) return;
  doc.font(font).fontSize(size).fillColor('#000000');
  const innerW = w - 2 * PAD;
  const textH = doc.heightOfString(text, { width: innerW, align });
  const ty = valign === 'center' ? y + Math.max(PAD, (h - textH) / 2) : y + PAD;
  doc.text(text, x + PAD, ty, { width: innerW, align });
};

const ensureSpace = (doc, cursor, h) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  // Only break if something has already been drawn on this page — a row taller
  // than a whole page would otherwise loop forever on empty pages.
  if (cursor.y + h > bottom && cursor.y > doc.page.margins.top + 1) {
    doc.addPage();
    cursor.y = doc.page.margins.top;
  }
};

// Draw one row of cells, all stretched to the tallest one.
const drawRow = (doc, cursor, cells, minHeight = 0) => {
  const h = Math.max(
    minHeight,
    ...cells.map((c) => measure(doc, c.text, c.w, c.font || FONT_REG, c.size || 10))
  );
  ensureSpace(doc, cursor, h);
  let x = cursor.x0;
  cells.forEach((c) => {
    drawCell(doc, { ...c, x, y: cursor.y, h });
    x += c.w;
  });
  cursor.y += h;
};

// Label / value row used for "Unit title", "Key unit competence", etc.
const drawLabelRow = (doc, cursor, label, value, labelW, valueW) => {
  drawRow(doc, cursor, [
    { text: sanitize(label), w: labelW, font: FONT_BOLD, size: 10.5, valign: 'center' },
    { text: sanitize(value), w: valueW, font: FONT_REG, size: 10.5 }
  ]);
};

// The activity table header: columns 1 and 4 span the full header block while the
// middle splits into "Description…" / lesson overview / Teacher's + Learner's activity.
const drawActivityHeader = (doc, cursor, widths, overview) => {
  const [w1, w2, w3, w4] = widths;
  const midW = w2 + w3;

  const timingTitle = 'Timing for each step';
  const descTitle = 'Description of teaching and learning activities';
  const genericTitle = 'Generic competences and cross-cutting issues + some explanations';
  const teacherTitle = "Teacher's activity";
  const learnerTitle = "Learner's activity";

  let hDesc = measure(doc, descTitle, midW, FONT_BOLD, 10.5);
  const hOverview = overview ? measure(doc, overview, midW, FONT_ITALIC, 9.5) : 0;
  const hSub = Math.max(
    measure(doc, teacherTitle, w2, FONT_BOLD, 10),
    measure(doc, learnerTitle, w3, FONT_BOLD, 10)
  );
  const sideH = Math.max(
    measure(doc, timingTitle, w1, FONT_BOLD, 10.5),
    measure(doc, genericTitle, w4, FONT_BOLD, 10.5)
  );

  let total = hDesc + hOverview + hSub;
  if (sideH > total) {
    // Give the extra height to the "Description…" cell so the sub-headers stay
    // level with the first activity row.
    hDesc += sideH - total;
    total = sideH;
  }

  ensureSpace(doc, cursor, total);
  const x = cursor.x0;
  const y = cursor.y;

  drawCell(doc, { x, y, w: w1, h: total, text: timingTitle, font: FONT_BOLD, size: 10.5, fill: SHADE, align: 'center', valign: 'center' });
  drawCell(doc, { x: x + w1, y, w: midW, h: hDesc, text: descTitle, font: FONT_BOLD, size: 10.5, fill: SHADE, align: 'center', valign: 'center' });
  if (hOverview) {
    drawCell(doc, { x: x + w1, y: y + hDesc, w: midW, h: hOverview, text: overview, font: FONT_ITALIC, size: 9.5, fill: SHADE, align: 'center', valign: 'center' });
  }
  drawCell(doc, { x: x + w1, y: y + hDesc + hOverview, w: w2, h: hSub, text: teacherTitle, font: FONT_BOLD, size: 10, fill: SHADE, align: 'center', valign: 'center' });
  drawCell(doc, { x: x + w1 + w2, y: y + hDesc + hOverview, w: w3, h: hSub, text: learnerTitle, font: FONT_BOLD, size: 10, fill: SHADE, align: 'center', valign: 'center' });
  drawCell(doc, { x: x + w1 + midW, y, w: w4, h: total, text: genericTitle, font: FONT_BOLD, size: 10.5, fill: SHADE, align: 'center', valign: 'center' });

  cursor.y += total;
};

/**
 * Write the whole lesson plan into an existing PDFDocument.
 * @param {PDFKit.PDFDocument} doc
 * @param {Object} plan - a LessonPlan document or plain object of the same shape
 */
const renderLessonPlan = (doc, plan = {}) => {
  const x0 = doc.page.margins.left;
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cursor = { x0, y: doc.page.margins.top };

  // ── Title ──
  doc.font(FONT_BOLD).fontSize(16).fillColor('#000000')
    .text('LESSON PLAN', x0, cursor.y, { width: contentW, align: 'center' });
  cursor.y = doc.y + 12;

  // ── School / Teacher line ──
  const half = contentW / 2;
  doc.fontSize(10.5);
  doc.font(FONT_BOLD).text('School Name: ', x0, cursor.y, { width: half - 6, continued: true })
    .font(FONT_REG).text(sanitize(plan.schoolName) || '—', { width: half - 6 });
  const leftBottom = doc.y;
  doc.font(FONT_BOLD).text("Teacher's Name: ", x0 + half, cursor.y, { width: half, continued: true })
    .font(FONT_REG).text(sanitize(plan.teacherName) || '—', { width: half });
  cursor.y = Math.max(leftBottom, doc.y) + 8;

  // ── Info grid: Term | Date | Subject | Class | Unit No | Lesson No | Duration | Class size ──
  const infoFractions = [0.10, 0.14, 0.15, 0.16, 0.09, 0.12, 0.11, 0.13];
  const infoWidths = infoFractions.map((f) => f * contentW);
  const infoHeaders = ['Term', 'Date', 'Subject', 'Class', 'Unit No', 'Lesson No', 'Duration', 'Class size'];
  const infoValues = [plan.term, plan.date, plan.subject, plan.className, plan.unitNo, plan.lessonNo, plan.duration, plan.classSize];

  drawRow(doc, cursor, infoHeaders.map((h, i) => ({
    text: h, w: infoWidths[i], font: FONT_BOLD, size: 10.5, fill: SHADE, valign: 'center'
  })));
  drawRow(doc, cursor, infoValues.map((v, i) => ({
    text: sanitize(v), w: infoWidths[i], font: FONT_REG, size: 10, valign: 'center'
  })));

  // ── Special educational needs ──
  const needsLabelW = contentW * 0.5;
  drawRow(doc, cursor, [
    {
      text: 'Type of special educational needs to be catered for in this lesson and number of learners in each category',
      w: needsLabelW, font: FONT_BOLD, size: 10.5
    },
    { text: sanitize(plan.specialNeeds) || 'None', w: contentW - needsLabelW, font: FONT_REG, size: 10.5 }
  ]);

  // ── Unit / competence / objective rows ──
  const labelW = contentW * 0.29;
  const valueW = contentW - labelW;
  drawLabelRow(doc, cursor, 'Unit title', plan.unitTitle, labelW, valueW);
  drawLabelRow(doc, cursor, 'Key unit competence', plan.keyUnitCompetence, labelW, valueW);
  drawLabelRow(doc, cursor, 'Title of the lesson', plan.lessonTitle, labelW, valueW);
  drawLabelRow(doc, cursor, 'Instructional objectives', plan.instructionalObjectives, labelW, valueW);
  drawLabelRow(doc, cursor, 'Plan of this class (Location)', plan.location, labelW, valueW);
  drawLabelRow(doc, cursor, 'Learning materials', plan.learningMaterials, labelW, valueW);
  drawLabelRow(doc, cursor, 'References', plan.references, labelW, valueW);

  // ── Activity table ──
  const actFractions = [0.18, 0.275, 0.275, 0.27];
  const actWidths = actFractions.map((f) => f * contentW);
  drawActivityHeader(doc, cursor, actWidths, sanitize(plan.lessonOverview));

  (plan.steps || []).forEach((step) => {
    const name = sanitize(step.name);
    const duration = sanitize(step.duration);
    const stepLabel = duration ? `${name} (${duration})` : name;
    drawRow(doc, cursor, [
      { text: stepLabel, w: actWidths[0], font: FONT_BOLD, size: 10.5 },
      { text: bulletList(step.teacherActivities), w: actWidths[1], font: FONT_REG, size: 10 },
      { text: bulletList(step.learnerActivities), w: actWidths[2], font: FONT_REG, size: 10 },
      { text: bulletList(step.competences), w: actWidths[3], font: FONT_REG, size: 10 }
    ]);
  });

  // ── Self-evaluation (left blank for the teacher to fill in by hand) ──
  drawRow(doc, cursor, [
    { text: "Teacher's self-evaluation", w: labelW, font: FONT_BOLD, size: 10.5, valign: 'center' },
    { text: sanitize(plan.selfEvaluation), w: valueW, font: FONT_REG, size: 10.5 }
  ], 34);
};

const safeFileName = (plan = {}) => {
  const base = [plan.subject, plan.className, plan.lessonTitle]
    .map((p) => sanitize(p))
    .filter(Boolean)
    .join('_') || 'lesson-plan';
  return `${base.replace(/[^a-zA-Z0-9À-ÿ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.pdf`;
};

/**
 * Stream a lesson plan PDF to an Express response (headers must not be sent yet).
 * @param {Object} res - Express response
 * @param {Object} plan - LessonPlan document or plain object
 */
const streamLessonPlanPdf = (res, plan) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(plan)}"`);
  doc.pipe(res);

  renderLessonPlan(doc, plan);

  doc.end();
};

module.exports = { streamLessonPlanPdf, renderLessonPlan, safeFileName };
