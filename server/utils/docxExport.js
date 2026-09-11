// DOCX export for every Lesson Planner output — lesson plans, slide decks,
// exercise sheets and schemes of work.
//
// The pricing grid promises "PDF & DOCX export" on every tier, and until now
// only PDF existed. Word matters more than PDF here in practice: head teachers
// send plans back with tracked changes, and schools keep editable copies.
//
// Built on the `docx` package rather than emitting Word-flavoured HTML with a
// .doc extension — that trick renders, but produces a file Word treats as a
// foreign document, which breaks exactly the round-tripping this is for.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  TableLayoutType, VerticalAlign, HeightRule
} = require('docx');
const { formLabels, printedPlanDefaults } = require('./plannerLanguage');

const SHADE = 'D9D9D9';

// Unlike the PDF path there is no font-encoding limit to work around — DOCX is
// UTF-8 throughout, so accents and typographic punctuation pass through as the
// teacher wrote them. Only null-ish values need normalising.
const text = (value) => (value === null || value === undefined ? '' : String(value));

const splitLines = (value) => {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return text(value).split('\n').map((l) => l.trim()).filter(Boolean);
};

const para = (content, opts = {}) => new Paragraph({
  children: [new TextRun({ text: text(content), bold: opts.bold, italics: opts.italics, size: opts.size || 22 })],
  alignment: opts.align,
  heading: opts.heading,
  spacing: opts.spacing || { after: 80 }
});

const cell = (content, opts = {}) => new TableCell({
  width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  shading: opts.fill ? { type: ShadingType.CLEAR, fill: SHADE } : undefined,
  children: splitLines(content).length
    ? splitLines(content).map((line) => para(line, { bold: opts.bold, size: opts.size || 20, spacing: { after: 0 } }))
    : [para('', { size: opts.size || 20, spacing: { after: 0 } })]
});

const table = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: {
    top: { style: BorderStyle.SINGLE, size: 4 },
    bottom: { style: BorderStyle.SINGLE, size: 4 },
    left: { style: BorderStyle.SINGLE, size: 4 },
    right: { style: BorderStyle.SINGLE, size: 4 },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4 },
    insideVertical: { style: BorderStyle.SINGLE, size: 4 }
  },
  rows
});

// Title plus the identifying fields that were actually filled in — same block
// the PDF prints, so the two exports of one document look like siblings.
const headerBlock = (doc, labels, fallbackTitle) => {
  const children = [
    para(doc.title || doc.lessonTitle || fallbackTitle, {
      bold: true, size: 32, align: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1
    })
  ];

  const meta = [
    [labels.school, doc.schoolName],
    [labels.teacher, doc.teacherName],
    [labels.subject, doc.subject],
    [labels.className, doc.className],
    [labels.unit, doc.unitTitle],
    [labels.term, doc.term],
    [labels.year, doc.academicYear],
    [labels.date, doc.date],
    [labels.duration, doc.duration]
  ].filter(([, v]) => text(v).trim());

  if (meta.length) {
    children.push(para(
      meta.map(([k, v]) => `${k}: ${text(v)}`).join('    |    '),
      { align: AlignmentType.CENTER, size: 19, spacing: { after: 200 } }
    ));
  }
  return children;
};

// ── Lesson plan ──────────────────────────────────────────────────────────────
//
// Laid out as the official REB/CBC form, cell for cell the same as the PDF
// (lessonPlanPdf.js): header grid, special-needs row, body rows, the activity
// table with its merged heading, then the closing self-evaluation row. It used
// to be a loose run of label tables that skipped every empty row — so the
// special-needs row and "Évaluation de l'enseignement", both empty until the
// teacher fills them in, never appeared in Word at all.

// A4 portrait with ~0.55in margins, matching the PDF's 40pt.
const LESSON_PAGE = { width: 11906, height: 16838, margin: 794 };
const LESSON_WIDTH = LESSON_PAGE.width - 2 * LESSON_PAGE.margin;

// Fractions of the content width → twips. The last column absorbs the rounding
// so the stacked tables line up exactly on the right edge.
const columnWidths = (fractions, total = LESSON_WIDTH) => {
  const widths = fractions.map((f) => Math.floor(total * f));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  return widths;
};

const RULE = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const NO_RULE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

// Fixed layout with explicit column widths — Word otherwise auto-fits each
// table to its content and the stacked sections stop sharing a right edge.
const formTable = (widths, rows, border = RULE) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: widths,
  layout: TableLayoutType.FIXED,
  borders: {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border
  },
  rows
});

const formCell = (content, width, opts = {}) => {
  const contentLines = splitLines(content);
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    verticalAlign: opts.vAlign,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: SHADE } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (contentLines.length ? contentLines : ['']).map((line) => para(line, {
      bold: opts.bold, italics: opts.italics, align: opts.align, size: opts.size || 20, spacing: { after: 0 }
    }))
  });
};

const labelValue = (label, value) => new Paragraph({
  spacing: { after: 0 },
  children: [
    new TextRun({ text: `${label}: `, bold: true, size: 21 }),
    new TextRun({ text: text(value).trim() || '—', size: 21 })
  ]
});

const bullets = (value) => splitLines(value).map((l) => `- ${l}`);

const lessonPlanChildren = (plan) => {
  const L = formLabels(plan);
  const printed = printedPlanDefaults(plan, L);
  const heading = { bold: true, fill: true, align: AlignmentType.CENTER, vAlign: VerticalAlign.CENTER };

  const children = [
    para(L.lessonPlanTitle, { bold: true, size: 32, align: AlignmentType.CENTER, spacing: { after: 160 } })
  ];

  // School / teacher line — unruled, it heads the form rather than sitting in it.
  const halves = columnWidths([0.5, 0.5]);
  children.push(formTable(halves, [new TableRow({
    children: [
      new TableCell({ width: { size: halves[0], type: WidthType.DXA }, children: [labelValue(L.schoolName, plan.schoolName)] }),
      new TableCell({ width: { size: halves[1], type: WidthType.DXA }, children: [labelValue(L.teacherName, plan.teacherName)] })
    ]
  })], NO_RULE));
  children.push(para('', { spacing: { after: 80 } }));

  // Term | Date | Subject | Class | Unit No | Lesson No | Duration | Class size
  // Same fractions as the PDF, sized so "Trimestre" and "Unité n°" fit unbroken.
  const infoWidths = columnWidths([0.12, 0.13, 0.15, 0.13, 0.10, 0.12, 0.11, 0.14]);
  const infoHeaders = [L.term, L.date, L.subject, L.className, L.unitNo, L.lessonNo, L.duration, L.classSize];
  const infoValues = [plan.term, plan.date, plan.subject, plan.className, plan.unitNo, plan.lessonNo, plan.duration, plan.classSize];
  children.push(formTable(infoWidths, [
    new TableRow({ children: infoHeaders.map((h, i) => formCell(h, infoWidths[i], { bold: true, fill: true, vAlign: VerticalAlign.CENTER })) }),
    new TableRow({ children: infoValues.map((v, i) => formCell(v, infoWidths[i], { vAlign: VerticalAlign.CENTER })) })
  ]));

  const needsWidths = columnWidths([0.5, 0.5]);
  children.push(formTable(needsWidths, [new TableRow({
    children: [
      formCell(L.specialNeeds, needsWidths[0], { bold: true }),
      formCell(printed.specialNeeds, needsWidths[1])
    ]
  })]));

  // Every row prints even when empty — on a form, a missing row reads as a
  // missing section, not as "nothing to say".
  const labelWidths = columnWidths([0.29, 0.71]);
  children.push(formTable(labelWidths, [
    [L.unitTitle, plan.unitTitle],
    [L.keyUnitCompetence, plan.keyUnitCompetence],
    [L.lessonTitle, plan.lessonTitle],
    [L.instructionalObjectives, plan.instructionalObjectives],
    [L.location, printed.location],
    [L.learningMaterials, plan.learningMaterials],
    [L.references, plan.references]
  ].map(([label, value]) => new TableRow({
    children: [
      formCell(label, labelWidths[0], { bold: true, vAlign: VerticalAlign.CENTER }),
      formCell(value, labelWidths[1])
    ]
  }))));

  // Activity table. Timing and competences span the whole heading; the middle
  // splits into the description, the italic overview and the two activity
  // columns. The heading rows repeat if Word flows the table onto a new page.
  const actWidths = columnWidths([0.18, 0.275, 0.275, 0.27]);
  const middle = actWidths[1] + actWidths[2];
  const overview = text(plan.lessonOverview).trim();
  const headingRows = overview ? 3 : 2;
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        formCell(L.timing, actWidths[0], { ...heading, rowSpan: headingRows }),
        formCell(L.description, middle, { ...heading, columnSpan: 2 }),
        formCell(L.competences, actWidths[3], { ...heading, rowSpan: headingRows })
      ]
    }),
    ...(overview ? [new TableRow({
      tableHeader: true,
      children: [formCell(overview, middle, { italics: true, fill: true, align: AlignmentType.CENTER, columnSpan: 2, size: 19 })]
    })] : []),
    new TableRow({
      tableHeader: true,
      children: [
        formCell(L.teacherActivity, actWidths[1], heading),
        formCell(L.learnerActivity, actWidths[2], heading)
      ]
    })
  ];

  (plan.steps || []).forEach((step) => {
    const name = text(step.name).trim();
    const duration = text(step.duration).trim();
    rows.push(new TableRow({
      children: [
        formCell(duration ? `${name} (${duration})` : name, actWidths[0], { bold: true }),
        formCell(bullets(step.teacherActivities), actWidths[1]),
        formCell(bullets(step.learnerActivities), actWidths[2]),
        formCell(bullets(step.competences), actWidths[3])
      ]
    }));
  });
  children.push(formTable(actWidths, rows));

  // The closing row. Left tall when blank: it is filled in by hand after the lesson.
  children.push(formTable(labelWidths, [new TableRow({
    height: { value: text(plan.selfEvaluation).trim() ? 600 : 1000, rule: HeightRule.ATLEAST },
    children: [
      formCell(L.selfEvaluation, labelWidths[0], { bold: true, vAlign: VerticalAlign.CENTER }),
      formCell(plan.selfEvaluation, labelWidths[1])
    ]
  })]));

  return children;
};

// ── Slides ───────────────────────────────────────────────────────────────────

const slidesChildren = (resource) => {
  const L = formLabels(resource);
  const children = headerBlock(resource, L, L.slidesTitle);

  (resource.slides || []).forEach((slide, i) => {
    children.push(table([
      new TableRow({ children: [cell(`${i + 1}. ${text(slide.heading) || L.slide}`, { bold: true, fill: true, size: 23 })] }),
      new TableRow({ children: [cell(splitLines(slide.bullets).map((b) => `• ${b}`), { size: 21 })] }),
      ...(text(slide.notes).trim()
        ? [new TableRow({ children: [cell(`${L.speakerNotes}: ${text(slide.notes)}`, { size: 19 })] })]
        : [])
    ]));
    children.push(para('', { spacing: { after: 120 } }));
  });

  return children;
};

// ── Exercises ────────────────────────────────────────────────────────────────

const exercisesChildren = (resource) => {
  const L = formLabels(resource);
  const children = headerBlock(resource, L, L.exerciseTitle);
  const items = resource.items || [];
  const letters = 'ABCDEFGH';

  const sumOf = (rows) => rows.reduce((total, item) => {
    const m = parseFloat(item.marks);
    return total + (Number.isFinite(m) ? m : 0);
  }, 0);
  const totalMarks = text(resource.totalMarks).trim() || String(sumOf(items));

  // Name / class / date rules, so the sheet is usable the moment it prints.
  children.push(table([
    new TableRow({
      children: [
        cell(`${L.name}: ______________________`, { width: 40 }),
        cell(`${L.className}: ______________`, { width: 30 }),
        cell(`${L.date}: ______________`, { width: 30 })
      ]
    })
  ]));
  children.push(para('', { spacing: { after: 120 } }));

  if (text(resource.instructions).trim()) {
    children.push(para(resource.instructions, { italics: true, spacing: { after: 80 } }));
  }
  if (Number(totalMarks) > 0) {
    children.push(para(`${L.total}: ${totalMarks} ${L.marks}`, {
      bold: true, align: AlignmentType.RIGHT, spacing: { after: 200 }
    }));
  }

  // Group by declared section; anything unassigned prints as a trailing
  // unlabelled group so sheets saved before sections existed still render.
  const declared = (resource.sections || []).filter((sec) => text(sec.label).trim() || text(sec.title).trim());
  const groups = declared.map((sec) => ({
    sec,
    rows: items.filter((it) => text(it.section).trim() === text(sec.label).trim())
  }));
  const grouped = new Set(groups.flatMap((g) => g.rows));
  const leftover = items.filter((it) => !grouped.has(it));
  if (leftover.length) groups.push({ sec: null, rows: leftover });

  groups.filter((g) => g.rows.length).forEach(({ sec, rows }) => {
    if (sec) {
      const marks = sumOf(rows);
      const title = [text(sec.label).trim() && (`${L.section} ` + text(sec.label).trim()), text(sec.title).trim()]
        .filter(Boolean).join(': ');
      children.push(table([
        new TableRow({
          children: [
            cell(title, { width: 78, bold: true, fill: true, size: 22 }),
            cell(marks > 0 ? `(${marks} ${L.marks})` : '', { width: 22, bold: true, fill: true, size: 20 })
          ]
        })
      ]));
      if (text(sec.instructions).trim()) {
        children.push(para(sec.instructions, { italics: true, spacing: { before: 80, after: 80 } }));
      } else {
        children.push(para('', { spacing: { after: 80 } }));
      }
    }

    rows.forEach((item) => {
      const marks = text(item.marks).trim();
      children.push(para(
        text(item.number) + '. ' + text(item.question) + (marks ? '   (' + marks + ')' : ''),
        { bold: true, spacing: { before: 120, after: 60 } }
      ));

      const options = splitLines(item.options);
      if (options.length) {
        options.forEach((opt, i) => children.push(
          para('   ' + (letters[i] || '-') + '. ' + opt, { spacing: { after: 40 } })
        ));
      } else {
        // One ruled line per line the question was scoped for.
        const count = Math.max(1, Math.min(12, item.answerLines || 2));
        for (let i = 0; i < count; i += 1) {
          children.push(para('   ' + '.'.repeat(88), { spacing: { after: 40 } }));
        }
      }
    });
  });

  // Marking key on its own page: the sheet is handed out, the key is not.
  const answered = items.filter((item) => text(item.answer).trim());
  if (answered.length) {
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
    children.push(para(L.markingKey, { bold: true, size: 26, align: AlignmentType.CENTER, spacing: { after: 160 } }));
    children.push(table([
      new TableRow({
        tableHeader: true,
        children: [
          cell(L.questionCol, { width: 8, bold: true, fill: true }),
          cell(L.answer, { width: 78, bold: true, fill: true }),
          cell(L.marksCol, { width: 14, bold: true, fill: true })
        ]
      }),
      ...answered.map((item) => new TableRow({
        children: [
          cell(text(item.number), { width: 8, bold: true }),
          cell(text(item.answer), { width: 78 }),
          cell(text(item.marks), { width: 14 })
        ]
      }))
    ]));
    if (Number(totalMarks) > 0) {
      children.push(para(`${L.total}: ${totalMarks} ${L.marks}`, {
        bold: true, align: AlignmentType.RIGHT, spacing: { before: 160 }
      }));
    }
  }

  return children;
};

// ── Scheme of work ───────────────────────────────────────────────────────────

const schemeChildren = (resource) => {
  const L = formLabels(resource);
  const children = headerBlock(resource, L, L.schemeTitle);

  const headers = L.schemeHeaders;
  const widths = [5, 5, 12, 14, 20, 16, 14, 14];

  const rows = [new TableRow({
    // Repeated on every page Word flows the table onto.
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { width: widths[i], bold: true, fill: true, size: 19 }))
  })];

  (resource.weeks || []).forEach((week) => {
    rows.push(new TableRow({
      children: [
        week.week, week.lessonNo, week.unitTitle, week.lessonTitle,
        week.objectives, week.activities, week.materials, week.assessment
      ].map((v, i) => cell(v, { width: widths[i], size: 18 }))
    }));
  });

  children.push(table(rows));
  return children;
};

const BUILDERS = {
  lessonPlan: lessonPlanChildren,
  slides: slidesChildren,
  exercises: exercisesChildren,
  scheme: schemeChildren
};

const SECTION_PROPERTIES = {
  lessonPlan: {
    page: {
      size: { width: LESSON_PAGE.width, height: LESSON_PAGE.height },
      margin: { top: LESSON_PAGE.margin, bottom: LESSON_PAGE.margin, left: LESSON_PAGE.margin, right: LESSON_PAGE.margin }
    }
  },
  // A scheme is eight columns wide; portrait squeezes it unreadable.
  scheme: { page: { size: { orientation: 'landscape' } } }
};

const safeFileName = (doc, kind) => {
  const base = [doc.subject, doc.className, doc.title || doc.lessonTitle || doc.unitTitle]
    .map((p) => text(p).trim())
    .filter(Boolean)
    .join('_') || kind || 'document';
  return `${base.replace(/[^a-zA-Z0-9À-ÿ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.docx`;
};

/**
 * Build a .docx buffer for any planner output.
 * @param {Object} doc  LessonPlan or PlannerResource (document or plain object)
 * @param {'lessonPlan'|'slides'|'exercises'|'scheme'} kind
 */
const buildDocxBuffer = async (doc, kind) => {
  const build = BUILDERS[kind];
  if (!build) throw new Error(`No DOCX builder for kind: ${kind}`);

  const document = new Document({
    sections: [{
      properties: SECTION_PROPERTIES[kind] || {},
      children: build(doc)
    }]
  });

  return Packer.toBuffer(document);
};

/**
 * Send a planner output as a .docx download (headers must not be sent yet).
 */
const sendDocx = async (res, doc, kind) => {
  const buffer = await buildDocxBuffer(doc, kind);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(doc, kind)}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
};

module.exports = { buildDocxBuffer, sendDocx, safeFileName };
