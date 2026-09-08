// Prompt construction and response normalisation for the Lesson Planner's
// slide decks, exercise sheets and schemes of work — the same job
// lessonPlanBuilder.js does for lesson plans, and deliberately built the same
// way: one prompt per kind that pins the exact JSON shape, then a normaliser
// that never trusts what came back.
//
// KINDS is the single registry every layer keys off (routes, quota counters,
// PDF/DOCX renderers, the client), so adding a fourth output type means adding
// one entry here rather than touching each layer.
const { str, lines, extractRelevantExcerpt } = require('./lessonPlanBuilder');

// Shared REB/CBC framing, so a deck and a scheme sound like the same teacher.
const CONTEXT = `You are an experienced Rwandan curriculum (REB / CBC) teacher preparing classroom material that will be printed and used in a real lesson.`;

const languageRule = (details) =>
  details.language && details.language !== 'auto'
    ? details.language
    : 'the language of the subject being taught — a French lesson entirely in French, a Kinyarwanda lesson in Kinyarwanda, otherwise English';

const detailBlock = (details = {}) => {
  const detailLines = Object.entries(details)
    .filter(([k, v]) => v && k !== 'language')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');
  return detailLines
    ? `DETAILS ALREADY KNOWN (use these exactly as given, do not invent different values):\n${detailLines}\n`
    : '';
};

const referenceBlock = (reference) =>
  reference
    ? `REFERENCE MATERIAL FROM THE TEACHER'S BOOK / CURRICULUM (extracted text, may be partial):\n"""\n${reference}\n"""\n\nBase the content, vocabulary and examples on this material.\n`
    : '';

// Clamp a requested count into something a single model call can produce well.
const clampCount = (value, fallback, max) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

// ── Slides ───────────────────────────────────────────────────────────────────

const buildSlidesPrompt = ({ brief, details = {}, reference, count }) => {
  const slideCount = clampCount(count, 10, 25);
  return `${CONTEXT}

WHAT THE TEACHER WANTS:
"${brief || 'Prepare a slide deck for the next lesson from the attached material.'}"

${detailBlock(details)}${referenceBlock(reference)}RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${slideCount} slides, in teaching order.
3. Slide 1 is the title slide, the last slide is a summary or homework slide.
4. Each slide has 2-5 bullets. A bullet is ONE short line a learner can read from the back of the room — never a paragraph, never more than about 12 words.
5. "notes" is what the teacher says out loud on that slide: 1-3 sentences, not a repeat of the bullets.
6. Use concrete, locally relevant examples (Rwandan places, names, prices in RWF) wherever an example is needed.

Return ONLY a JSON object with exactly this shape:
{
  "title": "Les habits — vocabulaire",
  "subject": "French",
  "className": "Primary 3 (P3)",
  "unitTitle": "LES HABITS",
  "language": "French",
  "slides": [
    {
      "heading": "Short slide title",
      "bullets": ["First short point", "Second short point"],
      "notes": "What the teacher explains while this slide is on screen."
    }
  ]
}`;
};

const normalizeSlides = (raw = {}, details = {}) => ({
  title: str(raw.title) || str(details.title),
  subject: str(details.subject) || str(raw.subject),
  className: str(details.className) || str(raw.className),
  unitTitle: str(details.unitTitle) || str(raw.unitTitle),
  language: str(details.language) === 'auto' ? str(raw.language) : (str(details.language) || str(raw.language)),
  slides: (Array.isArray(raw.slides) ? raw.slides : []).slice(0, 40).map((s) => ({
    heading: str(s?.heading),
    bullets: lines(s?.bullets).slice(0, 8),
    notes: str(s?.notes)
  })).filter((s) => s.heading || s.bullets.length)
});

// ── Exercises ────────────────────────────────────────────────────────────────

const buildExercisesPrompt = ({ brief, details = {}, reference, count, questionType }) => {
  const itemCount = clampCount(count, 10, 40);
  const typeRule = questionType === 'multiple_choice'
    ? 'Every question is multiple choice with exactly 4 options (A-D) and one correct answer. Put the options in "options" and the correct option text in "answer".'
    : questionType === 'open'
    ? 'Every question is open-response. Leave "options" empty and put a concise model answer in "answer".'
    : 'Mix multiple choice (4 options, one correct) and short open-response questions. Multiple-choice items fill "options"; open items leave it empty. Every item still has a model answer.';

  return `${CONTEXT}

WHAT THE TEACHER WANTS:
"${brief || 'Prepare an exercise sheet for the next lesson from the attached material.'}"

${detailBlock(details)}${referenceBlock(reference)}RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${itemCount} questions, ordered from easier to harder.
3. ${typeRule}
4. Number the questions "1", "2", "3", ... in the "number" field.
5. "marks" is a small whole number of marks for that question, as a string.
6. "instructions" is the one-line rubric printed at the top ("Answer ALL questions. Write your answers in the spaces provided.").
7. Questions must be answerable from what was actually taught — no trick questions, no outside knowledge.
8. Use concrete, locally relevant contexts (Rwandan places, names, prices in RWF) where an example is needed.

Return ONLY a JSON object with exactly this shape:
{
  "title": "Les habits — exercices",
  "subject": "French",
  "className": "Primary 3 (P3)",
  "unitTitle": "LES HABITS",
  "language": "French",
  "instructions": "Answer ALL questions.",
  "items": [
    {
      "number": "1",
      "question": "Comment dit-on 'shirt' en francais ?",
      "options": ["La chemise", "Le pantalon", "La jupe", "Le chapeau"],
      "answer": "La chemise",
      "marks": "2"
    }
  ]
}`;
};

const normalizeExercises = (raw = {}, details = {}) => ({
  title: str(raw.title) || str(details.title),
  subject: str(details.subject) || str(raw.subject),
  className: str(details.className) || str(raw.className),
  unitTitle: str(details.unitTitle) || str(raw.unitTitle),
  language: str(details.language) === 'auto' ? str(raw.language) : (str(details.language) || str(raw.language)),
  instructions: str(raw.instructions),
  items: (Array.isArray(raw.items) ? raw.items : []).slice(0, 60).map((item, i) => ({
    number: str(item?.number) || String(i + 1),
    question: str(item?.question),
    options: lines(item?.options).slice(0, 8),
    answer: str(item?.answer),
    marks: str(item?.marks)
  })).filter((item) => item.question)
});

// ── Scheme of work ───────────────────────────────────────────────────────────

const buildSchemePrompt = ({ brief, details = {}, reference, count }) => {
  const weekCount = clampCount(count, 12, 20);
  return `${CONTEXT}

WHAT THE TEACHER WANTS:
"${brief || 'Prepare a scheme of work for the term from the attached curriculum.'}"

${detailBlock(details)}${referenceBlock(reference)}RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${weekCount} rows, one per teaching week, numbered "1" upward in "week".
3. Rows must progress coherently across the term: build later units on earlier ones, and place revision/assessment weeks where a real teacher would (mid-term and end of term).
4. "objectives" is ONE sentence starting "Learners will be able to ...".
5. "activities", "materials" and "assessment" are short comma-separated phrases, not sentences.
6. "materials" must be real, locally available items (exercise books, locally made charts, real objects, markers, learner's book).
7. Keep every field short — this prints as a wide table, one line per cell where possible.

Return ONLY a JSON object with exactly this shape:
{
  "subject": "French",
  "className": "Primary 3 (P3)",
  "term": "Term 3",
  "academicYear": "2026",
  "language": "French",
  "weeks": [
    {
      "week": "1",
      "lessonNo": "1",
      "unitTitle": "LES HABITS",
      "lessonTitle": "Vocabulaire des habits",
      "objectives": "Learners will be able to name common clothing items in French.",
      "activities": "Group discussion, flashcard drill, role play",
      "materials": "Real clothing items, locally made charts",
      "assessment": "Oral questioning, written exercise"
    }
  ]
}`;
};

const normalizeScheme = (raw = {}, details = {}) => ({
  title: str(raw.title) || str(details.title),
  subject: str(details.subject) || str(raw.subject),
  className: str(details.className) || str(raw.className),
  term: str(details.term) || str(raw.term),
  academicYear: str(details.academicYear) || str(raw.academicYear),
  language: str(details.language) === 'auto' ? str(raw.language) : (str(details.language) || str(raw.language)),
  weeks: (Array.isArray(raw.weeks) ? raw.weeks : []).slice(0, 40).map((w, i) => ({
    week: str(w?.week) || String(i + 1),
    lessonNo: str(w?.lessonNo),
    unitTitle: str(w?.unitTitle),
    lessonTitle: str(w?.lessonTitle),
    objectives: str(w?.objectives),
    activities: str(w?.activities),
    materials: str(w?.materials),
    assessment: str(w?.assessment)
  })).filter((w) => w.lessonTitle || w.unitTitle || w.objectives)
});

// ── Registry ─────────────────────────────────────────────────────────────────
//
// `quotaKey` ties each kind to the monthly allowance it spends, and `bodyKey`
// to the array on PlannerResource that must be non-empty for the output to be
// worth saving.
const KINDS = {
  slides: {
    kind: 'slides',
    label: 'Slide deck',
    plural: 'slide decks',
    quotaKey: 'slidesPerMonth',
    bodyKey: 'slides',
    defaultCount: 10,
    maxCount: 25,
    countLabel: 'slides',
    buildPrompt: buildSlidesPrompt,
    normalize: normalizeSlides,
    emptyMessage: 'The generated deck had no slides. Please try again.'
  },
  exercises: {
    kind: 'exercises',
    label: 'Exercise sheet',
    plural: 'exercise sheets',
    quotaKey: 'exercisesPerMonth',
    bodyKey: 'items',
    defaultCount: 10,
    maxCount: 40,
    countLabel: 'questions',
    buildPrompt: buildExercisesPrompt,
    normalize: normalizeExercises,
    emptyMessage: 'The generated sheet had no questions. Please try again.'
  },
  scheme: {
    kind: 'scheme',
    label: 'Scheme of work',
    plural: 'schemes of work',
    quotaKey: 'schemesPerMonth',
    bodyKey: 'weeks',
    defaultCount: 12,
    maxCount: 20,
    countLabel: 'weeks',
    buildPrompt: buildSchemePrompt,
    normalize: normalizeScheme,
    emptyMessage: 'The generated scheme had no weekly rows. Please try again.'
  }
};

const KIND_KEYS = Object.keys(KINDS);

module.exports = {
  KINDS,
  KIND_KEYS,
  clampCount,
  extractRelevantExcerpt,
  buildSlidesPrompt,
  buildExercisesPrompt,
  buildSchemePrompt,
  normalizeSlides,
  normalizeExercises,
  normalizeScheme
};
