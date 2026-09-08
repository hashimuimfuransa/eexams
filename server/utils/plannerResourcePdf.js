// Prints slide decks, exercise sheets and schemes of work.
//
// Same cell-by-cell drawing approach as lessonPlanPdf.js (PDFKit has no table
// primitive), and the same WinAnsi sanitising — these documents are routinely
// written in French or Kinyarwanda, so accented Latin must survive while
// typographic punctuation is folded to ASCII.
//
// The three kinds print differently on purpose: a deck is one framed block per
// slide (it is read, not tabulated), an exercise sheet is a numbered list with
// room to write, and a scheme of work is a wide landscape table.
const PDFDocument = require('pdfkit');

const FONT_REG = 'Times-Roman';
const FONT_BOLD = 'Times-Bold';
const FONT_ITALIC = 'Times-Italic';

const SHADE = '#D9D9D9';
const BORDER = '#000000';
const PAD = 5;
const LINE = 0.9;

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
    .replace(/ /g, ' ')
    .trim();
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
  if (cursor.y + h > bottom && cursor.y > doc.page.margins.top + 1) {
    doc.addPage();
    cursor.y = doc.page.margins.top;
  }
};

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

// Title block shared by all three kinds: document title, then whichever
// identifying fields were actually filled in.
const drawHeader = (doc, cursor, resource, heading) => {
  const width = cursor.width;
  const title = sanitize(resource.title) || heading;

  doc.font(FONT_BOLD).fontSize(14).fillColor('#000000');
  const th = doc.heightOfString(title, { width, align: 'center' });
  ensureSpace(doc, cursor, th + 6);
  doc.text(title, cursor.x0, cursor.y, { width, align: 'center' });
  cursor.y += th + 4;

  const meta = [
    ['School', resource.schoolName],
    ['Teacher', resource.teacherName],
    ['Subject', resource.subject],
    ['Class', resource.className],
    ['Unit', resource.unitTitle],
    ['Term', resource.term],
    ['Year', resource.academicYear]
  ].filter(([, v]) => sanitize(v));

  if (meta.length) {
    const text = meta.map(([k, v]) => `${k}: ${sanitize(v)}`).join('    |    ');
    doc.font(FONT_REG).fontSize(9.5);
    const mh = doc.heightOfString(text, { width, align: 'center' });
    ensureSpace(doc, cursor, mh + 8);
    doc.text(text, cursor.x0, cursor.y, { width, align: 'center' });
    cursor.y += mh + 8;
  } else {
    cursor.y += 4;
  }
};

// ── Slides ───────────────────────────────────────────────────────────────────
//
// One bordered block per slide, numbered, with speaker notes in italic beneath
// the bullets — this is the handout form of a deck, which is what a teacher
// actually prints and carries into the room.
const renderSlides = (doc, resource) => {
  const cursor = {
    x0: doc.page.margins.left,
    y: doc.page.margins.top,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
  };
  drawHeader(doc, cursor, resource, 'Slide deck');

  const w = cursor.width;
  (resource.slides || []).forEach((slide, i) => {
    const heading = `${i + 1}. ${sanitize(slide.heading) || 'Slide'}`;
    drawRow(doc, cursor, [{ text: heading, w, font: FONT_BOLD, size: 11.5, fill: SHADE }]);

    const bullets = (slide.bullets || [])
      .map((b) => sanitize(b))
      .filter(Boolean)
      .map((b) => `- ${b}`)
      .join('\n');
    drawRow(doc, cursor, [{ text: bullets, w, font: FONT_REG, size: 10.5 }], 34);

    const notes = sanitize(slide.notes);
    if (notes) {
      drawRow(doc, cursor, [{ text: `Speaker notes: ${notes}`, w, font: FONT_ITALIC, size: 9.5 }]);
    }
    cursor.y += 8;
  });
};

// ── Exercises ────────────────────────────────────────────────────────────────
//
// Questions print without their answers; the marking key is a separate page at
// the end, so the same PDF can be handed out and marked from.
const renderExercises = (doc, resource) => {
  const cursor = {
    x0: doc.page.margins.left,
    y: doc.page.margins.top,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
  };
  drawHeader(doc, cursor, resource, 'Exercise sheet');

  const w = cursor.width;
  const instructions = sanitize(resource.instructions);
  if (instructions) {
    drawRow(doc, cursor, [{ text: instructions, w, font: FONT_ITALIC, size: 10.5, fill: SHADE }]);
    cursor.y += 6;
  }

  const items = resource.items || [];
  const totalMarks = items.reduce((sum, item) => {
    const m = parseFloat(item.marks);
    return sum + (Number.isFinite(m) ? m : 0);
  }, 0);

  const numW = 34;
  const bodyW = w - numW;
  const markW = 54;

  items.forEach((item) => {
    const marks = sanitize(item.marks);
    drawRow(doc, cursor, [
      { text: sanitize(item.number), w: numW, font: FONT_BOLD, size: 10.5, align: 'center' },
      { text: sanitize(item.question), w: bodyW - (marks ? markW : 0), font: FONT_REG, size: 10.5 },
      ...(marks ? [{ text: `(${marks})`, w: markW, font: FONT_REG, size: 10, align: 'center', valign: 'center' }] : [])
    ]);

    const options = (item.options || []).map((o) => sanitize(o)).filter(Boolean);
    if (options.length) {
      const letters = 'ABCDEFGH';
      const text = options.map((o, i) => `${letters[i] || '-'}. ${o}`).join('\n');
      drawRow(doc, cursor, [
        { text: '', w: numW },
        { text, w: bodyW, font: FONT_REG, size: 10.5 }
      ]);
    } else {
      // Ruled space for an open answer.
      drawRow(doc, cursor, [
        { text: '', w: numW },
        { text: '\n\n', w: bodyW, font: FONT_REG, size: 10.5 }
      ]);
    }
  });

  if (totalMarks > 0) {
    cursor.y += 6;
    drawRow(doc, cursor, [{ text: `Total: ${totalMarks} marks`, w, font: FONT_BOLD, size: 11, align: 'right' }]);
  }

  const answered = items.filter((item) => sanitize(item.answer));
  if (answered.length) {
    doc.addPage();
    cursor.y = doc.page.margins.top;
    drawRow(doc, cursor, [{ text: 'Marking key', w, font: FONT_BOLD, size: 12, fill: SHADE, align: 'center' }]);
    answered.forEach((item) => {
      drawRow(doc, cursor, [
        { text: sanitize(item.number), w: numW, font: FONT_BOLD, size: 10.5, align: 'center' },
        { text: sanitize(item.answer), w: bodyW, font: FONT_REG, size: 10.5 }
      ]);
    });
  }
};

// ── Scheme of work ───────────────────────────────────────────────────────────
//
// Landscape, because eight columns of planning do not fit portrait at a legible
// size. The header row repeats via drawRow's page-break handling.
const renderScheme = (doc, resource) => {
  const cursor = {
    x0: doc.page.margins.left,
    y: doc.page.margins.top,
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right
  };
  drawHeader(doc, cursor, resource, 'Scheme of work');

  const w = cursor.width;
  // Week | Lesson | Unit | Lesson title | Objectives | Activities | Materials | Assessment
  const ratios = [0.05, 0.05, 0.12, 0.14, 0.2, 0.16, 0.14, 0.14];
  const widths = ratios.map((r) => Math.floor(w * r));
  widths[widths.length - 1] += w - widths.reduce((a, b) => a + b, 0);

  const headers = ['Wk', 'L#', 'Unit', 'Lesson title', 'Objectives', 'Activities', 'Materials', 'Assessment'];
  const drawHead = () => drawRow(doc, cursor, headers.map((text, i) => ({
    text, w: widths[i], font: FONT_BOLD, size: 9.5, fill: SHADE, align: 'center', valign: 'center'
  })));

  drawHead();

  (resource.weeks || []).forEach((week) => {
    const cells = [
      week.week, week.lessonNo, week.unitTitle, week.lessonTitle,
      week.objectives, week.activities, week.materials, week.assessment
    ].map((v, i) => ({
      text: sanitize(v),
      w: widths[i],
      font: FONT_REG,
      size: 9,
      align: i < 2 ? 'center' : 'left'
    }));

    // Re-print the header when a row pushes onto a fresh page, so a long
    // scheme stays readable away from page 1.
    const h = Math.max(...cells.map((c) => measure(doc, c.text, c.w, c.font, c.size)));
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (cursor.y + h > bottom && cursor.y > doc.page.margins.top + 1) {
      doc.addPage();
      cursor.y = doc.page.margins.top;
      drawHead();
    }
    drawRow(doc, cursor, cells);
  });
};

const RENDERERS = {
  slides: renderSlides,
  exercises: renderExercises,
  scheme: renderScheme
};

const safeFileName = (resource, extension = 'pdf') => {
  const base = [resource.subject, resource.className, resource.title || resource.unitTitle]
    .map((p) => sanitize(p))
    .filter(Boolean)
    .join('_') || resource.kind || 'resource';
  return `${base.replace(/[^a-zA-Z0-9À-ÿ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.${extension}`;
};

const renderPlannerResource = (doc, resource) => {
  const render = RENDERERS[resource?.kind];
  if (!render) throw new Error(`No PDF renderer for planner resource kind: ${resource?.kind}`);
  render(doc, resource);
};

/**
 * Stream a planner resource PDF to an Express response (headers not yet sent).
 * Schemes of work print landscape; the other two portrait.
 */
const streamPlannerResourcePdf = (res, resource) => {
  const doc = new PDFDocument({
    size: 'A4',
    layout: resource?.kind === 'scheme' ? 'landscape' : 'portrait',
    margin: 40,
    bufferPages: true
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(resource, 'pdf')}"`);
  doc.pipe(res);

  renderPlannerResource(doc, resource);

  doc.end();
};

module.exports = { streamPlannerResourcePdf, renderPlannerResource, safeFileName, sanitize };
