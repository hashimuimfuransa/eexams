// Renders an exam bank paper as a PDF, in one of two variants:
//
//   'questions'      the question paper a student sits - no answers anywhere,
//                    with ruled space to write in for written questions.
//   'marking-guide'  the same paper with the answer key, model answers,
//                    grading criteria and per-question marks.
//
// Both are produced from the same walk over the exam so the numbering always
// matches between the two documents - a marking guide whose question 7 is the
// paper's question 8 is worse than no marking guide at all.
const PDFDocument = require('pdfkit');

const FONT_REG = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

const INK = '#111111';
const MUTED = '#666666';
const BRAND = '#0D406C';
const RULE = '#CCCCCC';
const ANSWER_BG = '#F4F7FA';

// The standard 14 PDF fonts are WinAnsi-encoded, so anything outside Latin-1
// has to be folded down before it reaches the page.
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
    .replace(/[  ]/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?')
    .trim();
};

const safeFileName = (base, fallback = 'exam') => {
  const cleaned = sanitize(base) || fallback;
  return `${cleaned.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 70)}.pdf`;
};

/** Letter for an option that has none stored (older imported papers). */
const optionLetter = (option, index) =>
  option.letter || String.fromCharCode(65 + index);

/** Matching/ordering items may be plain strings or { text } objects. */
const itemText = (item) => {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  return item.text || item.value || item.label || String(item);
};

/**
 * Every place a "correct answer" can hide on a Question, collapsed into the one
 * string the marking guide prints. Different importers populate different
 * fields, so this checks all of them rather than trusting one.
 */
const resolveAnswer = (q) => {
  const ticked = (q.options || [])
    .map((o, i) => ({ ...o, letter: optionLetter(o, i) }))
    .filter(o => o.isCorrect);

  if (ticked.length) {
    return ticked.map(o => `${o.letter}. ${itemText(o)}`).join(ticked.length > 1 ? '   AND   ' : '');
  }

  if (q.correctMatches && Object.keys(q.correctMatches).length) {
    const right = q.rightItems || q.matchingPairs?.rightColumn || [];
    return Object.entries(q.correctMatches)
      .map(([left, idx]) => `${left} -> ${itemText(right[idx]) || idx}`)
      .join('; ');
  }

  const pairs = q.matchingPairs?.correctPairs || [];
  if (pairs.length) {
    return pairs.map(p => `${itemText(p.left)} -> ${itemText(p.right)}`).join('; ');
  }

  const order = q.itemsToOrder?.correctOrder || [];
  if (order.length) {
    const items = q.itemsToOrder?.items || [];
    return order.map((position, i) => `${i + 1}. ${itemText(items[position]) || `item ${position}`}`).join('  ');
  }

  const placements = q.dragDropData?.correctPlacements || [];
  if (placements.length) {
    const zones = q.dragDropData?.dropZones || [];
    const draggables = q.dragDropData?.draggableItems || [];
    return placements
      .map(p => `${itemText(draggables[p.item]) || p.item} -> ${itemText(zones[p.zone]) || p.zone}`)
      .join('; ');
  }

  const written = q.answerKey || q.correctAnswer;
  if (written && written !== 'Not provided') return written;

  if (q.spreadsheetModelAnswer) return 'See the model spreadsheet supplied with this exam.';

  return '';
};

/** Points on a question, however the importer recorded them. */
const pointsOf = (q) => Number(q?.points ?? q?.marks ?? 0) || 0;

class ExamRenderer {
  constructor(doc, { variant, showAnswers }) {
    this.doc = doc;
    this.variant = variant;
    this.showAnswers = showAnswers;
    this.left = doc.page.margins.left;
    this.width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  /** Remaining vertical space before the bottom margin. */
  get room() {
    return this.doc.page.height - this.doc.page.margins.bottom - this.doc.y;
  }

  /** Start a new page when the next block needs more room than is left. */
  need(height) {
    if (this.room < height) this.doc.addPage();
  }

  text(value, { font = FONT_REG, size = 10, color = INK, indent = 0, gap = 0, align = 'left' } = {}) {
    const content = sanitize(value);
    if (!content) return;
    this.doc.font(font).fontSize(size).fillColor(color);
    const width = this.width - indent;
    this.need(this.doc.heightOfString(content, { width }) + gap);
    this.doc.text(content, this.left + indent, this.doc.y, { width, align });
    if (gap) this.doc.y += gap;
    this.doc.fillColor(INK);
  }

  rule(color = RULE, gap = 6) {
    this.need(gap + 2);
    this.doc.lineWidth(0.8).strokeColor(color)
      .moveTo(this.left, this.doc.y).lineTo(this.left + this.width, this.doc.y).stroke();
    this.doc.y += gap;
  }

  /** Tinted block used for answers, model answers and grading notes. */
  panel(label, body, { color = BRAND, indent = 14 } = {}) {
    const content = sanitize(body);
    if (!content) return;

    const width = this.width - indent;
    const innerWidth = width - 16;
    this.doc.font(FONT_REG).fontSize(9.5);
    const bodyHeight = this.doc.heightOfString(content, { width: innerWidth });
    const height = bodyHeight + (label ? 22 : 12);

    this.need(height + 6);

    const top = this.doc.y;
    this.doc.rect(this.left + indent, top, width, height).fill(ANSWER_BG);
    // A single accent bar carries the meaning; no box outline needed.
    this.doc.rect(this.left + indent, top, 2.5, height).fill(color);

    let y = top + 6;
    if (label) {
      this.doc.font(FONT_BOLD).fontSize(7.5).fillColor(color)
        .text(sanitize(label).toUpperCase(), this.left + indent + 10, y, { width: innerWidth });
      y += 11;
    }
    this.doc.font(FONT_REG).fontSize(9.5).fillColor(INK)
      .text(content, this.left + indent + 10, y, { width: innerWidth });

    this.doc.y = top + height + 6;
    this.doc.fillColor(INK);
  }

  /** Ruled space for a handwritten answer, sized by the marks on offer. */
  answerLines(count, indent = 14) {
    const gap = 15;
    for (let i = 0; i < count; i++) {
      this.need(gap + 2);
      const y = this.doc.y + gap - 4;
      this.doc.lineWidth(0.5).strokeColor(RULE)
        .moveTo(this.left + indent, y).lineTo(this.left + this.width, y).stroke();
      this.doc.y += gap;
    }
    this.doc.y += 4;
  }
}

// Papers often write the marks into the question text itself - "(2 marks)",
// "(6 mks)". Appending our own count then prints them twice.
const MARKS_IN_TEXT = /\(\s*\d+(?:\.\d+)?\s*(?:mark|marks|mk|mks|pt|pts|point|points)\s*\)\s*$/i;
const statesOwnMarks = (text) => MARKS_IN_TEXT.test(String(text || '').trim());

/** How many ruled lines a written question deserves, from its mark value. */
const linesForPoints = (points) => Math.min(Math.max(Math.round(points * 1.5), 3), 14);

/** Render one question (and its sub-questions) at the current cursor. */
const renderQuestion = (r, question, number) => {
  const doc = r.doc;
  const points = pointsOf(question);
  const type = question.type || 'open-ended';

  // Keep the number, stem and at least the first line of the body together.
  r.need(56);

  const numberWidth = 26;
  const top = doc.y;

  doc.font(FONT_BOLD).fontSize(10.5).fillColor(BRAND)
    .text(`${number}.`, r.left, top, { width: numberWidth });

  const bodyLeft = r.left + numberWidth;
  const marksLabel = points && !statesOwnMarks(question.text)
    ? `(${points} mark${points === 1 ? '' : 's'})`
    : '';
  const marksWidth = marksLabel ? 62 : 0;
  const stemWidth = r.width - numberWidth - marksWidth;

  doc.font(FONT_REG).fontSize(10.5).fillColor(INK);
  const stem = sanitize(question.text) || (question.imageUrl ? '[Image-based question - see the image supplied with this exam]' : '[No question text]');
  doc.text(stem, bodyLeft, top, { width: stemWidth });

  // Record where the stem actually ended BEFORE drawing anything else at `top`:
  // writing the marks label resets the cursor, and a wrapped stem's height would
  // otherwise be lost, letting the next block paint over it.
  const stemBottom = doc.y;

  if (marksLabel) {
    doc.font(FONT_BOLD).fontSize(9).fillColor(MUTED)
      .text(marksLabel, r.left + r.width - marksWidth, top, { width: marksWidth, align: 'right' });
  }

  doc.y = Math.max(stemBottom, doc.y, top + 12);
  doc.y += 3;
  doc.fillColor(INK);

  if (question.passage) {
    r.panel('Passage', question.passage, { color: MUTED });
  }

  if (question.imageUrl || (question.imageUrls || []).length) {
    const count = (question.imageUrls || []).length || 1;
    r.text(`[This question refers to ${count} image${count === 1 ? '' : 's'} in the online paper]`,
      { font: FONT_ITALIC, size: 8.5, color: MUTED, indent: numberWidth });
  }

  // ── Options ──
  const options = question.options || [];
  if (options.length) {
    if (question.allowMultipleAnswers) {
      r.text('Select all that apply.', { font: FONT_ITALIC, size: 8.5, color: MUTED, indent: numberWidth });
    }
    options.forEach((option, i) => {
      const letter = optionLetter(option, i);
      const label = `${letter}.  ${sanitize(itemText(option))}`;
      // On the marking guide the key is bold; on the paper every option reads the same.
      const isKey = r.showAnswers && option.isCorrect;
      r.text(isKey ? `${label}   <-- correct` : label, {
        font: isKey ? FONT_BOLD : FONT_REG,
        size: 10,
        color: isKey ? BRAND : INK,
        indent: numberWidth + 8
      });
    });
    doc.y += 2;
  }

  // ── Matching columns ──
  const left = question.leftItems?.length ? question.leftItems : (question.matchingPairs?.leftColumn || []);
  const right = question.rightItems?.length ? question.rightItems : (question.matchingPairs?.rightColumn || []);
  if (left.length || right.length) {
    const rows = Math.max(left.length, right.length);
    const colWidth = (r.width - numberWidth - 8) / 2;
    r.need(rows * 14 + 16);
    doc.font(FONT_BOLD).fontSize(8.5).fillColor(MUTED);
    doc.text('COLUMN A', r.left + numberWidth + 8, doc.y, { width: colWidth, continued: false });
    doc.text('COLUMN B', r.left + numberWidth + 8 + colWidth, doc.y - 11, { width: colWidth });
    doc.y += 3;
    doc.font(FONT_REG).fontSize(10).fillColor(INK);
    for (let i = 0; i < rows; i++) {
      const y = doc.y;
      doc.text(left[i] !== undefined ? `${i + 1}. ${sanitize(itemText(left[i]))}` : '',
        r.left + numberWidth + 8, y, { width: colWidth - 8 });
      const afterLeft = doc.y;
      doc.text(right[i] !== undefined ? `${String.fromCharCode(65 + i)}. ${sanitize(itemText(right[i]))}` : '',
        r.left + numberWidth + 8 + colWidth, y, { width: colWidth - 8 });
      doc.y = Math.max(afterLeft, doc.y);
    }
    doc.y += 4;
  }

  // ── Items to put in order ──
  const orderItems = question.itemsToOrder?.items || [];
  if (orderItems.length) {
    r.text('Arrange in the correct order:', { font: FONT_ITALIC, size: 8.5, color: MUTED, indent: numberWidth });
    orderItems.forEach(item => r.text(`-  ${sanitize(itemText(item))}`, { size: 10, indent: numberWidth + 8 }));
    doc.y += 2;
  }

  // ── Word bank ──
  if ((question.wordBank || []).length) {
    r.panel('Word bank', question.wordBank.map(itemText).join('   ·   '), { color: MUTED });
  }

  // ── Sub-questions ──
  const subs = question.subQuestions || [];
  if (subs.length) {
    const config = question.subQuestionConfig;
    if (config?.mode === 'choose-n') {
      r.text(`Answer any ${config.requiredCount} of the following.`,
        { font: FONT_ITALIC, size: 9, color: MUTED, indent: numberWidth });
    }
    subs.forEach((sub, i) => {
      const label = sub.label || `${String.fromCharCode(97 + i)})`;
      const subPoints = pointsOf(sub);
      const subMarks = subPoints && !statesOwnMarks(sub.text) ? `   (${subPoints})` : '';
      r.text(`${label} ${sanitize(sub.text)}${subMarks}`,
        { size: 10, indent: numberWidth + 8 });

      (sub.options || []).forEach((option, oi) => {
        const isKey = r.showAnswers && option.isCorrect;
        r.text(`${optionLetter(option, oi)}. ${sanitize(itemText(option))}${isKey ? '   <-- correct' : ''}`, {
          size: 9.5,
          font: isKey ? FONT_BOLD : FONT_REG,
          color: isKey ? BRAND : INK,
          indent: numberWidth + 22
        });
      });

      if (r.showAnswers) {
        const subAnswer = resolveAnswer(sub);
        if (subAnswer) r.panel(`Answer ${label}`, subAnswer, { indent: numberWidth + 14 });
        if (sub.writtenAnswerModelAnswer) {
          r.panel(`Written answer ${label}`, sub.writtenAnswerModelAnswer, { indent: numberWidth + 14 });
        }
      } else if (!(sub.options || []).length) {
        r.answerLines(Math.min(Math.max(Math.round(subPoints), 2), 6), numberWidth + 14);
      }
    });
  }

  // ── Answers, or space to write one ──
  const writtenTypes = ['open-ended', 'essay', 'short-answer', 'extended-response', 'structured',
                        'fill-blank', 'fill-in-blank', 'numerical', 'table-completion'];

  if (r.showAnswers) {
    const answer = resolveAnswer(question);
    if (answer) r.panel('Answer', answer, { indent: numberWidth });

    if (question.explanation) r.panel('Explanation', question.explanation, { color: MUTED, indent: numberWidth });

    if ((question.keyPoints || []).length) {
      r.panel('Key points expected', question.keyPoints.map(k => `- ${sanitize(k)}`).join('\n'),
        { color: MUTED, indent: numberWidth });
    }

    if ((question.gradingCriteria || []).length) {
      r.panel('Mark allocation',
        question.gradingCriteria.map(c => `- ${sanitize(c.criteria)}  (${c.points ?? 1})`).join('\n'),
        { color: MUTED, indent: numberWidth });
    }

    if ((question.acceptableAnswers || []).length) {
      r.panel('Also accept', question.acceptableAnswers.map(sanitize).join('  |  '),
        { color: MUTED, indent: numberWidth });
    }
  } else if (!options.length && !subs.length && writtenTypes.includes(type)) {
    r.answerLines(linesForPoints(points), numberWidth);
  }

  doc.y += 6;
};

/** Cover block: title, the exam's vital statistics, and the instructions. */
const renderHeader = (r, exam, { variant, totals }) => {
  const doc = r.doc;

  doc.font(FONT_BOLD).fontSize(9).fillColor(BRAND)
    .text(variant === 'marking-guide' ? 'MARKING GUIDE' : 'QUESTION PAPER',
      r.left, doc.y, { width: r.width, align: 'center' });
  doc.moveDown(0.2);

  doc.font(FONT_BOLD).fontSize(16).fillColor(INK)
    .text(sanitize(exam.title), { width: r.width, align: 'center' });

  // These three overlap constantly - a Secondary/S4 paper aimed at "Secondary"
  // would otherwise print "Secondary · S4 · Secondary".
  const subtitle = [...new Map(
    [exam.level?.name, exam.subLevel, exam.targetAudience]
      .filter(Boolean)
      .map(sanitize)
      .filter(Boolean)
      .map(part => [part.toLowerCase(), part])
  ).values()].join('  ·  ');
  if (subtitle) {
    doc.moveDown(0.15);
    doc.font(FONT_REG).fontSize(10).fillColor(MUTED)
      .text(subtitle, { width: r.width, align: 'center' });
  }

  doc.moveDown(0.5);
  r.rule(BRAND, 8);

  // Vital statistics strip
  const stats = [
    ['Time allowed', exam.timeLimit ? `${exam.timeLimit} minutes` : '-'],
    ['Total marks', String(totals.points)],
    ['Questions', String(totals.questions)],
    ['Pass mark', exam.passingScore ? `${exam.passingScore}%` : '-']
  ];
  const colWidth = r.width / stats.length;
  const statTop = doc.y;
  stats.forEach(([label, value], i) => {
    const x = r.left + i * colWidth;
    doc.font(FONT_BOLD).fontSize(7.5).fillColor(MUTED)
      .text(label.toUpperCase(), x, statTop, { width: colWidth, lineBreak: false });
    doc.font(FONT_BOLD).fontSize(11).fillColor(INK)
      .text(value, x, statTop + 10, { width: colWidth, lineBreak: false });
  });
  doc.y = statTop + 28;
  r.rule(RULE, 8);

  const blurb = exam.publicDescription || exam.description;
  if (blurb) r.text(blurb, { size: 9.5, color: MUTED, gap: 4 });

  if (variant === 'marking-guide') {
    r.panel('For the marker',
      'This document contains the answer key. Every question is numbered exactly as it appears on the question paper. Marks shown in brackets are the marks available for that question.',
      { color: BRAND, indent: 0 });
  } else {
    r.panel('Instructions to candidates',
      [
        `Answer the questions in the spaces provided.`,
        exam.allowSelectiveAnswering
          ? `This paper allows selective answering - read each section heading for how many questions to attempt.`
          : `Attempt all questions unless a section states otherwise.`,
        exam.calculatorEnabled ? 'A calculator may be used.' : 'Calculators are not allowed.',
        `Write neatly and show your working where marks are given for method.`
      ].join('\n'),
      { color: BRAND, indent: 0 });
  }

  doc.y += 4;
};

/** Section heading bar plus any section-level instructions, passage or word bank. */
const renderSectionHeading = (r, section, sectionPoints, questionCount) => {
  const doc = r.doc;
  r.need(70);

  const height = 20;
  const top = doc.y;
  doc.rect(r.left, top, r.width, height).fill(BRAND);
  doc.font(FONT_BOLD).fontSize(10).fillColor('#FFFFFF')
    .text(sanitize(section.title || section.name || 'Section'), r.left + 8, top + 6,
      { width: r.width - 150, lineBreak: false });
  doc.font(FONT_REG).fontSize(9).fillColor('#FFFFFF')
    .text(`${questionCount} question${questionCount === 1 ? '' : 's'}  ·  ${sectionPoints} mark${sectionPoints === 1 ? '' : 's'}`,
      r.left + r.width - 158, top + 6, { width: 150, align: 'right', lineBreak: false });
  doc.y = top + height + 7;
  doc.fillColor(INK);

  if (section.description && section.description !== section.title) {
    r.text(section.description, { size: 9.5, color: MUTED });
  }
  if (section.instructions) {
    r.text(section.instructions, { font: FONT_ITALIC, size: 9.5, color: MUTED, gap: 2 });
  }
  if (section.passage) {
    r.panel('Passage', section.passage, { color: MUTED, indent: 0 });
  }
  if ((section.wordBank || []).length) {
    r.panel('Word bank', section.wordBank.map(itemText).join('   ·   '), { color: MUTED, indent: 0 });
  }
};

/** Totals across the whole paper, used in the header and the section bars. */
const summarise = (exam) => {
  let questions = 0;
  let points = 0;
  (exam.sections || []).forEach(section => {
    (section.questions || []).forEach(q => {
      questions++;
      points += pointsOf(q);
    });
  });
  return { questions, points: points || exam.totalPoints || 0 };
};

const stampFooters = (doc, exam, variant) => {
  const range = doc.bufferedPageRange();
  const label = variant === 'marking-guide' ? 'Marking guide' : 'Question paper';
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font(FONT_REG).fontSize(7.5).fillColor(MUTED).text(
      `${sanitize(exam.title)} · ${label} · Page ${i - range.start + 1} of ${range.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 14,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
        lineBreak: false
      }
    );
  }
  doc.fillColor(INK);
};

/**
 * Render a whole exam into an existing document.
 * @param {PDFDocument} doc
 * @param {Object} exam    Exam with sections[].questions populated
 * @param {string} variant 'questions' | 'marking-guide'
 */
const renderExam = (doc, exam, variant) => {
  const showAnswers = variant === 'marking-guide';
  const r = new ExamRenderer(doc, { variant, showAnswers });
  const totals = summarise(exam);

  renderHeader(r, exam, { variant, totals });

  let number = 0;
  (exam.sections || []).forEach(section => {
    const questions = section.questions || [];
    if (questions.length === 0) return;

    const sectionPoints = questions.reduce((sum, q) => sum + pointsOf(q), 0);
    renderSectionHeading(r, section, sectionPoints, questions.length);

    questions.forEach(question => {
      number++;
      renderQuestion(r, question, number);
    });

    doc.y += 4;
  });

  if (number === 0) {
    r.text('This exam has no questions recorded.', { font: FONT_ITALIC, color: MUTED });
  }

  // End marker, so a reader knows nothing is missing from the print.
  r.need(24);
  r.rule(RULE, 6);
  r.text(showAnswers ? 'END OF MARKING GUIDE' : 'END OF QUESTION PAPER',
    { font: FONT_BOLD, size: 9, color: MUTED, align: 'center' });
};

/**
 * Stream one exam PDF to an Express response.
 * @param {Object} res     Express response, headers not yet sent
 * @param {Object} exam    Exam with sections[].questions populated
 * @param {string} variant 'questions' | 'marking-guide'
 */
const streamExamPdf = (res, exam, variant = 'questions') => {
  const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });

  const suffix = variant === 'marking-guide' ? 'marking_guide' : 'question_paper';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(`${exam.title}_${suffix}`)}"`);
  doc.pipe(res);

  renderExam(doc, exam, variant);
  stampFooters(doc, exam, variant);

  doc.end();
};

module.exports = {
  renderExam,
  streamExamPdf,
  summarise,
  resolveAnswer,
  pointsOf,
  safeFileName,
  sanitize
};
