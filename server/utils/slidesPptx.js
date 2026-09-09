// Renders a generated deck as a real PowerPoint file.
//
// This is the artefact teachers actually project, so it is built as a designed
// deck rather than a text dump: a themed title slide, a consistent header band
// with an accent rule, per-slide layouts (bullets / two-column / compare /
// steps / callout / image / question / summary), speaker notes carried into
// PowerPoint's own notes pane, and slide numbers.
//
// 16:9 throughout — every projector and laptop sold in the last decade is
// widescreen, and 4:3 letterboxes with black bars that look broken in a room.
//
// Geometry is in inches on a 13.333 x 7.5 canvas. The named constants below
// are the grid: change them here and every layout stays aligned, which is what
// keeps a 20-slide deck looking like one document.
const PptxGenJS = require('pptxgenjs');
const { getTheme, normalizeLayout, DEFAULT_THEME } = require('./slideThemes');

// 40/3 exactly, not 13.333 — PowerPoint's widescreen slide is 12192000 EMU
// wide, and a rounded 13.333 lands 305 EMU short, which makes PowerPoint treat
// the deck as a custom page size rather than standard widescreen.
const W = 40 / 3;
const H = 7.5;
const MARGIN = 0.62;
const CONTENT_W = W - MARGIN * 2;
const HEADER_H = 1.28;      // baseline of the accent rule under a heading
const BODY_TOP = 1.62;
const FOOTER_Y = H - 0.52;
const BODY_H = FOOTER_Y - BODY_TOP - 0.18;

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());

const nonEmpty = (arr) => (Array.isArray(arr) ? arr.map(text).filter(Boolean) : []);

// Long bullet lists shrink rather than overflow the slide. PptxGenJS has
// `shrinkText`, but it only kicks in at render time in PowerPoint itself and
// not in every viewer, so the size is chosen up front from the real content.
// Type scale for a 13.33in canvas seen from the back of a classroom. A short
// list gets big, confident type — 20pt on a slide this wide reads as a
// document, not a presentation — and long lists step down instead of
// overflowing.
const bodySize = (lines, base = 28) => {
  const count = lines.length;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  let size = base;
  if (count > 3) size -= 4;
  if (count > 5) size -= 4;
  if (count > 7) size -= 3;
  if (count > 9) size -= 2;
  if (longest > 70) size -= 2;
  if (longest > 110) size -= 2;
  return Math.max(14, size);
};

const headingSize = (value) => {
  const len = text(value).length;
  if (len > 70) return 24;
  if (len > 45) return 28;
  return 32;
};

// ── Chrome ───────────────────────────────────────────────────────────────────

// The decoration that distinguishes one theme from another, drawn behind the
// content on every non-title slide.
const drawDecoration = (slide, t, pptx) => {
  switch (t.decoration) {
    case 'sidebar':
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: t.deep } });
      break;
    case 'corner':
      slide.addShape(pptx.ShapeType.rtTriangle, {
        x: W - 1.5, y: H - 1.5, w: 1.5, h: 1.5, fill: { color: t.accentSoft }, line: { color: t.accentSoft }
      });
      break;
    case 'ribbon':
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.16, fill: { color: t.accent } });
      break;
    case 'bar':
    default:
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.1, fill: { color: t.deep } });
      break;
  }
};

const addHeader = (slide, t, pptx, heading, eyebrow) => {
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const width = W - left - MARGIN;

  if (text(eyebrow)) {
    slide.addText(text(eyebrow).toUpperCase(), {
      x: left, y: 0.36, w: width, h: 0.3,
      fontFace: t.bodyFont, fontSize: 11, bold: true, color: t.accent, charSpacing: 1.6
    });
  }

  slide.addText(text(heading), {
    x: left, y: text(eyebrow) ? 0.66 : 0.5, w: width, h: 0.72,
    fontFace: t.headingFont, fontSize: headingSize(heading), bold: true, color: t.primary,
    valign: 'top'
  });

  // Short accent rule under the heading — the single strongest cue that the
  // deck was designed rather than typed.
  slide.addShape(pptx.ShapeType.rect, {
    x: left, y: HEADER_H, w: 1.15, h: 0.055, fill: { color: t.accent }
  });
};

const addFooter = (slide, t, footerText, pageNo) => {
  if (footerText) {
    slide.addText(text(footerText), {
      x: MARGIN, y: FOOTER_Y, w: CONTENT_W - 1, h: 0.32,
      fontFace: t.bodyFont, fontSize: 10, color: t.muted
    });
  }
  if (pageNo) {
    slide.addText(String(pageNo), {
      x: W - MARGIN - 0.9, y: FOOTER_Y, w: 0.9, h: 0.32,
      fontFace: t.bodyFont, fontSize: 10, color: t.muted, align: 'right'
    });
  }
};

// Bullets as real PowerPoint bullets so they stay editable and re-indentable.
//
// The bullet option has to live on each text item, not on the parent call:
// with an array of items PptxGenJS builds one <a:p> per item and reads the
// per-item options for paragraph properties, so a parent-level `bullet` is
// silently dropped and the list renders with no glyphs at all.
//
// A short list is centred in the available space rather than stranded under
// the heading with two thirds of the slide empty below it.
const bulletBlock = (slide, t, lines, { x, y, w, h, size, align }) => {
  if (!lines.length) return;
  slide.addText(
    lines.map((line) => ({
      text: line,
      options: { breakLine: true, bullet: { code: '2022', indent: 20 } }
    })),
    {
      x, y, w, h,
      fontFace: t.bodyFont, fontSize: size, color: t.body,
      lineSpacingMultiple: 1.35,
      align,
      valign: lines.length <= 5 ? 'middle' : 'top'
    }
  );
};

// ── Layouts ──────────────────────────────────────────────────────────────────

const layoutTitle = (slide, t, pptx, s, meta) => {
  slide.background = { color: t.deep };

  slide.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.34, w: W, h: 0.34, fill: { color: t.accent } });
  slide.addShape(pptx.ShapeType.rect, { x: MARGIN, y: 2.42, w: 1.6, h: 0.07, fill: { color: t.accent } });

  if (text(meta.eyebrow)) {
    slide.addText(text(meta.eyebrow).toUpperCase(), {
      x: MARGIN, y: 1.85, w: CONTENT_W, h: 0.4,
      fontFace: t.bodyFont, fontSize: 13, bold: true, color: t.accent, charSpacing: 2
    });
  }

  slide.addText(text(s.heading) || text(meta.title), {
    x: MARGIN, y: 2.62, w: CONTENT_W - 1.4, h: 1.9,
    fontFace: t.headingFont, fontSize: 44, bold: true, color: t.onDeep, valign: 'top'
  });

  const sub = nonEmpty(s.bullets).join('  •  ');
  if (sub) {
    slide.addText(sub, {
      x: MARGIN, y: 4.5, w: CONTENT_W - 1.4, h: 0.9,
      fontFace: t.bodyFont, fontSize: 17, color: t.onDeep, transparency: 18
    });
  }

  const footer = [meta.subject, meta.className, meta.teacherName, meta.schoolName].filter(Boolean).join('  |  ');
  if (footer) {
    slide.addText(footer, {
      x: MARGIN, y: H - 1.24, w: CONTENT_W, h: 0.4,
      fontFace: t.bodyFont, fontSize: 12, color: t.onDeep, transparency: 30
    });
  }
};

const layoutBullets = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  bulletBlock(slide, t, lines, {
    x: left, y: BODY_TOP, w: W - left - MARGIN, h: BODY_H, size: bodySize(lines)
  });
};

const layoutTwoColumn = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const colW = (W - left - MARGIN - 0.5) / 2;
  const half = Math.ceil(lines.length / 2);
  const size = bodySize(lines.slice(0, half), 19);

  bulletBlock(slide, t, lines.slice(0, half), { x: left, y: BODY_TOP, w: colW, h: BODY_H, size });
  bulletBlock(slide, t, lines.slice(half), { x: left + colW + 0.5, y: BODY_TOP, w: colW, h: BODY_H, size });
};

const layoutCompare = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const colW = (W - left - MARGIN - 0.4) / 2;
  const half = Math.ceil(lines.length / 2);
  const labels = nonEmpty(s.columnLabels);
  const size = bodySize(lines.slice(0, half), 24);

  // Panels are sized to the taller column instead of always filling the body
  // area — a full-height box holding three short words is the single thing
  // that makes a generated deck look unfinished.
  const rows = Math.max(half, lines.length - half, 1);
  const panelH = Math.min(BODY_H, Math.max(2.3, 1.1 + rows * (size / 72) * 2.0));
  const y = BODY_TOP + Math.max(0, (BODY_H - panelH) / 2);

  [0, 1].forEach((i) => {
    const x = left + i * (colW + 0.4);
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: colW, h: panelH,
      fill: { color: i === 0 ? t.accentSoft : t.surfaceAlt },
      line: { color: i === 0 ? t.accent : t.muted, width: 1 },
      rectRadius: 0.08
    });
    slide.addText(labels[i] || (i === 0 ? 'A' : 'B'), {
      x: x + 0.3, y: y + 0.22, w: colW - 0.6, h: 0.44,
      fontFace: t.headingFont, fontSize: 19, bold: true, color: i === 0 ? t.primary : t.body
    });
    bulletBlock(slide, t, i === 0 ? lines.slice(0, half) : lines.slice(half), {
      x: x + 0.3, y: y + 0.78, w: colW - 0.6, h: panelH - 1, size
    });
  });
};

const layoutSteps = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets).slice(0, 6);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const width = W - left - MARGIN;
  const rowH = Math.min(0.92, BODY_H / Math.max(lines.length, 1));
  const size = lines.length > 4 ? 16 : 18;

  lines.forEach((line, i) => {
    const y = BODY_TOP + i * rowH;
    slide.addShape(pptx.ShapeType.ellipse, {
      x: left, y: y + (rowH - 0.46) / 2, w: 0.46, h: 0.46, fill: { color: t.accent }
    });
    slide.addText(String(i + 1), {
      x: left, y: y + (rowH - 0.46) / 2, w: 0.46, h: 0.46,
      fontFace: t.headingFont, fontSize: 14, bold: true, color: t.deep, align: 'center', valign: 'middle'
    });
    slide.addText(line, {
      x: left + 0.68, y, w: width - 0.68, h: rowH,
      fontFace: t.bodyFont, fontSize: size, color: t.body, valign: 'middle'
    });
  });
};

const layoutCallout = (slide, t, pptx, s) => {
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const width = W - left - MARGIN;
  const statement = nonEmpty(s.bullets)[0] || text(s.notes) || text(s.heading);

  const rest = nonEmpty(s.bullets).slice(1);
  const boxH = Math.min(BODY_H, Math.max(2.2, 1.4 + Math.ceil(statement.length / 60) * 0.75 + (rest.length ? 0.6 : 0)));
  const y = BODY_TOP + Math.max(0, (BODY_H - boxH) / 2);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: left, y, w: width, h: boxH,
    fill: { color: t.accentSoft }, line: { color: t.accent, width: 1.25 }, rectRadius: 0.1
  });
  slide.addShape(pptx.ShapeType.rect, { x: left, y, w: 0.1, h: boxH, fill: { color: t.accent } });
  slide.addText(statement, {
    x: left + 0.7, y: y + 0.3, w: width - 1.4, h: boxH - 0.6 - (rest.length ? 0.6 : 0),
    fontFace: t.headingFont, fontSize: statement.length > 140 ? 22 : 30, bold: true,
    color: t.primary, valign: 'middle', align: 'center'
  });

  if (rest.length) {
    slide.addText(rest.join('   •   '), {
      x: left + 0.7, y: y + boxH - 0.85, w: width - 1.4, h: 0.6,
      fontFace: t.bodyFont, fontSize: 15, color: t.muted, align: 'center'
    });
  }
};

const layoutImage = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const colW = (W - left - MARGIN - 0.5) / 2;

  bulletBlock(slide, t, lines, { x: left, y: BODY_TOP, w: colW, h: BODY_H, size: bodySize(lines, 18) });

  // A described placeholder, not a fake image: the teacher is told exactly
  // what to drop in, and the box is already sized and positioned for it.
  const x = left + colW + 0.5;
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y: BODY_TOP, w: colW, h: BODY_H,
    fill: { color: t.surfaceAlt }, line: { color: t.muted, width: 1, dashType: 'dash' }, rectRadius: 0.08
  });
  slide.addText(text(s.imageIdea) || 'Add a picture, chart or real object here', {
    x: x + 0.3, y: BODY_TOP + 0.3, w: colW - 0.6, h: BODY_H - 0.6,
    fontFace: t.bodyFont, fontSize: 14, color: t.muted, italic: true, align: 'center', valign: 'middle'
  });
};

const layoutQuestion = (slide, t, pptx, s) => {
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const width = W - left - MARGIN;
  const question = nonEmpty(s.bullets)[0] || text(s.heading);

  slide.addText('?', {
    x: left, y: BODY_TOP + 0.1, w: 1.1, h: 1.1,
    fontFace: t.headingFont, fontSize: 62, bold: true, color: t.accent, align: 'center', valign: 'middle'
  });
  slide.addText(question, {
    x: left + 1.25, y: BODY_TOP, w: width - 1.25, h: 1.5,
    fontFace: t.headingFont, fontSize: 26, bold: true, color: t.primary, valign: 'middle'
  });

  const rest = nonEmpty(s.bullets).slice(1);
  bulletBlock(slide, t, rest, {
    x: left + 1.25, y: BODY_TOP + 1.7, w: width - 1.25, h: BODY_H - 1.7, size: bodySize(rest, 18)
  });
};

const layoutSummary = (slide, t, pptx, s) => {
  const lines = nonEmpty(s.bullets);
  const left = t.decoration === 'sidebar' ? MARGIN + 0.22 : MARGIN;
  const width = W - left - MARGIN;
  const homework = text(s.homework);
  const bodyH = homework ? BODY_H - 1.35 : BODY_H;

  bulletBlock(slide, t, lines, { x: left, y: BODY_TOP, w: width, h: bodyH, size: bodySize(lines) });

  if (homework) {
    const y = BODY_TOP + bodyH + 0.2;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: left, y, w: width, h: 1.05,
      fill: { color: t.accentSoft }, line: { color: t.accent, width: 1 }, rectRadius: 0.08
    });
    slide.addText('HOMEWORK', {
      x: left + 0.3, y: y + 0.12, w: width - 0.6, h: 0.28,
      fontFace: t.bodyFont, fontSize: 10, bold: true, color: t.accent, charSpacing: 1.5
    });
    slide.addText(homework, {
      x: left + 0.3, y: y + 0.4, w: width - 0.6, h: 0.55,
      fontFace: t.bodyFont, fontSize: 15, color: t.body
    });
  }
};

const LAYOUT_RENDERERS = {
  title: layoutTitle,
  bullets: layoutBullets,
  twoColumn: layoutTwoColumn,
  compare: layoutCompare,
  steps: layoutSteps,
  callout: layoutCallout,
  image: layoutImage,
  question: layoutQuestion,
  summary: layoutSummary
};

const safeFileName = (deck) => {
  const base = [deck.subject, deck.className, deck.title]
    .map((p) => text(p))
    .filter(Boolean)
    .join('_') || 'slides';
  return `${base.replace(/[^a-zA-Z0-9À-ÿ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.pptx`;
};

/**
 * Build a .pptx buffer for a slide deck.
 * @param {Object} deck PlannerResource of kind 'slides' (document or plain object)
 */
const buildPptxBuffer = async (deck) => {
  const t = getTheme(deck?.theme || DEFAULT_THEME);
  const pptx = new PptxGenJS();

  // PptxGenJS's built-in LAYOUT_16x9 is a 10 x 5.625in canvas; PowerPoint's own
  // widescreen default — and the grid every constant above is measured against
  // — is 13.333 x 7.5in. Same aspect ratio, but placing content by the wrong
  // one pushes it off the slide, so define the real one explicitly.
  pptx.defineLayout({ name: 'TESTFY_WIDE', width: W, height: H });
  pptx.layout = 'TESTFY_WIDE';
  pptx.author = text(deck.teacherName) || 'Testfy';
  pptx.company = text(deck.schoolName);
  pptx.subject = text(deck.subject);
  pptx.title = text(deck.title) || 'Lesson slides';

  const meta = {
    title: text(deck.title),
    eyebrow: text(deck.unitTitle) || text(deck.subject),
    subject: text(deck.subject),
    className: text(deck.className),
    teacherName: text(deck.teacherName),
    schoolName: text(deck.schoolName)
  };
  const footerText = [meta.subject, meta.className].filter(Boolean).join('  |  ');

  const slides = Array.isArray(deck.slides) ? deck.slides : [];

  // A deck that came back without an explicit title slide still opens with
  // one — an opening slide is the difference between a deck and a list.
  const hasTitleSlide = slides.length > 0 && normalizeLayout(slides[0].layout) === 'title';
  if (!hasTitleSlide) {
    const s = pptx.addSlide();
    layoutTitle(s, t, pptx, { heading: meta.title, bullets: [] }, meta);
  }

  slides.forEach((slide, i) => {
    const layout = normalizeLayout(slide.layout);
    const s = pptx.addSlide();

    if (layout === 'title') {
      layoutTitle(s, t, pptx, slide, meta);
    } else {
      s.background = { color: t.surface };
      drawDecoration(s, t, pptx);
      addHeader(s, t, pptx, slide.heading, slide.eyebrow);
      (LAYOUT_RENDERERS[layout] || layoutBullets)(s, t, pptx, slide);
      addFooter(s, t, footerText, i + (hasTitleSlide ? 1 : 2));
    }

    // Speaker notes land in PowerPoint's notes pane, so presenter view works.
    const notes = text(slide.notes);
    if (notes) s.addNotes(notes);
  });

  // PptxGenJS returns a Node Buffer for 'nodebuffer'.
  return pptx.write({ outputType: 'nodebuffer' });
};

/**
 * Send a deck as a .pptx download (headers must not be sent yet).
 */
const sendPptx = async (res, deck) => {
  const buffer = await buildPptxBuffer(deck);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(deck)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
};

module.exports = { buildPptxBuffer, sendPptx, safeFileName };
