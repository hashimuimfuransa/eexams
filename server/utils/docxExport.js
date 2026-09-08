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
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType
} = require('docx');

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
const headerBlock = (doc, fallbackTitle) => {
  const children = [
    para(doc.title || doc.lessonTitle || fallbackTitle, {
      bold: true, size: 32, align: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1
    })
  ];

  const meta = [
    ['School', doc.schoolName],
    ['Teacher', doc.teacherName],
    ['Subject', doc.subject],
    ['Class', doc.className],
    ['Unit', doc.unitTitle],
    ['Term', doc.term],
    ['Year', doc.academicYear],
    ['Date', doc.date],
    ['Duration', doc.duration]
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

const lessonPlanChildren = (plan) => {
  const children = headerBlock(plan, 'Lesson plan');

  [
    ['Unit title', plan.unitTitle],
    ['Key unit competence', plan.keyUnitCompetence],
    ['Lesson title', plan.lessonTitle],
    ['Instructional objectives', plan.instructionalObjectives],
    ['Location', plan.location],
    ['Learning materials', plan.learningMaterials],
    ['References', plan.references]
  ].filter(([, v]) => text(v).trim()).forEach(([label, value]) => {
    children.push(table([
      new TableRow({ children: [cell(label, { width: 28, bold: true, fill: true }), cell(value, { width: 72 })] })
    ]));
    children.push(para('', { spacing: { after: 40 } }));
  });

  if (text(plan.lessonOverview).trim()) {
    children.push(para(plan.lessonOverview, { italics: true, spacing: { after: 160 } }));
  }

  const steps = plan.steps || [];
  if (steps.length) {
    const rows = [new TableRow({
      children: [
        cell('Timing', { width: 12, bold: true, fill: true }),
        cell("Teacher's activity", { width: 30, bold: true, fill: true }),
        cell("Learner's activity", { width: 30, bold: true, fill: true }),
        cell('Generic competences and cross-cutting issues', { width: 28, bold: true, fill: true })
      ]
    })];

    steps.forEach((step) => {
      rows.push(new TableRow({
        children: [
          cell(`${text(step.name)}\n${text(step.duration)}`, { width: 12 }),
          cell(splitLines(step.teacherActivities).map((l) => `- ${l}`), { width: 30 }),
          cell(splitLines(step.learnerActivities).map((l) => `- ${l}`), { width: 30 }),
          cell(splitLines(step.competences).map((l) => `- ${l}`), { width: 28 })
        ]
      }));
    });
    children.push(table(rows));
  }

  if (text(plan.selfEvaluation).trim()) {
    children.push(para('', { spacing: { after: 160 } }));
    children.push(para('Teacher self-evaluation', { bold: true }));
    children.push(para(plan.selfEvaluation));
  }

  return children;
};

// ── Slides ───────────────────────────────────────────────────────────────────

const slidesChildren = (resource) => {
  const children = headerBlock(resource, 'Slide deck');

  (resource.slides || []).forEach((slide, i) => {
    children.push(table([
      new TableRow({ children: [cell(`${i + 1}. ${text(slide.heading) || 'Slide'}`, { bold: true, fill: true, size: 23 })] }),
      new TableRow({ children: [cell(splitLines(slide.bullets).map((b) => `• ${b}`), { size: 21 })] }),
      ...(text(slide.notes).trim()
        ? [new TableRow({ children: [cell(`Speaker notes: ${text(slide.notes)}`, { size: 19 })] })]
        : [])
    ]));
    children.push(para('', { spacing: { after: 120 } }));
  });

  return children;
};

// ── Exercises ────────────────────────────────────────────────────────────────

const exercisesChildren = (resource) => {
  const children = headerBlock(resource, 'Exercise sheet');

  if (text(resource.instructions).trim()) {
    children.push(para(resource.instructions, { italics: true, spacing: { after: 200 } }));
  }

  const items = resource.items || [];
  const letters = 'ABCDEFGH';

  items.forEach((item) => {
    const marks = text(item.marks).trim();
    children.push(para(
      `${text(item.number)}. ${text(item.question)}${marks ? `   (${marks})` : ''}`,
      { bold: true, spacing: { after: 60 } }
    ));

    const options = splitLines(item.options);
    if (options.length) {
      options.forEach((opt, i) => children.push(para(`   ${letters[i] || '-'}. ${opt}`, { spacing: { after: 40 } })));
    } else {
      // Blank ruled space so the sheet is usable as handed out.
      children.push(para('', { spacing: { after: 40 } }));
      children.push(para('   ' + '.'.repeat(90), { spacing: { after: 40 } }));
      children.push(para('   ' + '.'.repeat(90), { spacing: { after: 120 } }));
    }
  });

  const totalMarks = items.reduce((sum, item) => {
    const m = parseFloat(item.marks);
    return sum + (Number.isFinite(m) ? m : 0);
  }, 0);
  if (totalMarks > 0) {
    children.push(para(`Total: ${totalMarks} marks`, { bold: true, align: AlignmentType.RIGHT, spacing: { before: 160 } }));
  }

  // Marking key on its own page — the sheet is handed out, the key is not.
  const answered = items.filter((item) => text(item.answer).trim());
  if (answered.length) {
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
    children.push(para('Marking key', { bold: true, size: 26, align: AlignmentType.CENTER, spacing: { after: 160 } }));
    children.push(table(answered.map((item) => new TableRow({
      children: [cell(text(item.number), { width: 8, bold: true }), cell(text(item.answer), { width: 92 })]
    }))));
  }

  return children;
};

// ── Scheme of work ───────────────────────────────────────────────────────────

const schemeChildren = (resource) => {
  const children = headerBlock(resource, 'Scheme of work');

  const headers = ['Wk', 'L#', 'Unit', 'Lesson title', 'Objectives', 'Activities', 'Materials', 'Assessment'];
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
      properties: kind === 'scheme'
        // A scheme is eight columns wide; portrait squeezes it unreadable.
        ? { page: { size: { orientation: 'landscape' } } }
        : {},
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
