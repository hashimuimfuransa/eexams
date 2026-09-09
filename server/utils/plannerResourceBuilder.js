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
const { normalizeLayout, THEME_KEYS, DEFAULT_THEME } = require('./slideThemes');

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

${detailBlock(details)}${referenceBlock(reference)}This deck is PROJECTED in front of a class and must look like a designed
presentation, not a page of notes. You choose a layout per slide from the fixed
set below, and the renderer draws that layout properly.

LAYOUTS (use the exact key):
- "title"     opening slide. bullets = 1-2 short taglines only.
- "bullets"   heading + 3-5 short points. The workhorse.
- "twoColumn" heading + 6-10 short items split into two columns (vocabulary, word lists).
- "compare"   two things set against each other. REQUIRED: "columnLabels": ["Left label","Right label"], and bullets split evenly — first half is the left panel, second half the right.
- "steps"     a numbered procedure, 3-5 bullets, each one stage.
- "callout"   ONE rule, definition or key fact. bullets[0] is the statement (a full sentence); any further bullets become a small caption.
- "image"     heading + 2-3 bullets + REQUIRED "imageIdea" describing exactly what picture, chart or real object the teacher should show.
- "question"  a question put to the class. bullets[0] is the question; the ANSWER goes in "notes", never on the slide.
- "summary"   closing recap, 3-4 bullets, plus REQUIRED "homework".

RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${slideCount} slides, in teaching order.
3. Slide 1 MUST be layout "title". Slide 2 SHOULD be layout "bullets" with eyebrow "Objectives" listing what learners will be able to do. The LAST slide MUST be layout "summary" with real homework.
4. VARY the layouts. A deck that is every slide "bullets" is a failure. Across ${slideCount} slides use at least four different layouts, including at least one "question" and at least one "callout" or "image".
5. A bullet is ONE short line readable from the back of the room: max ~10 words, no full paragraphs, no trailing full stops on fragments.
6. "eyebrow" is a 1-2 word section label in the deck's language ("Objectifs", "Pratique", "Résumé"). Set it on most content slides.
7. "notes" is what the teacher SAYS on that slide — 1-3 sentences of real teaching talk, including the answer for "question" slides. Never a copy of the bullets.
8. Content must build: introduce, model, practise, check understanding, summarise. Include at least one slide where learners DO something.
9. Use concrete, locally relevant examples (Rwandan places, names, prices in RWF) wherever an example is needed.

Return ONLY a JSON object with exactly this shape:
{
  "title": "Les habits — vocabulaire",
  "subject": "French",
  "className": "Primary 3 (P3)",
  "unitTitle": "LES HABITS",
  "language": "French",
  "slides": [
    {
      "layout": "title",
      "heading": "Les habits",
      "bullets": ["Vocabulaire de base", "40 minutes"],
      "notes": "Saluer les apprenants et annoncer le thème."
    },
    {
      "layout": "compare",
      "eyebrow": "Grammaire",
      "heading": "Masculin ou féminin ?",
      "columnLabels": ["Le (masculin)", "La (féminin)"],
      "bullets": ["le pantalon", "le chapeau", "la chemise", "la jupe"],
      "notes": "Faire répéter chaque mot avec son article."
    },
    {
      "layout": "summary",
      "eyebrow": "Résumé",
      "heading": "Ce que nous avons appris",
      "bullets": ["8 vêtements", "Le / la devant le nom"],
      "homework": "Écris 5 phrases décrivant les habits de ta famille.",
      "notes": "Rappeler le devoir et le noter au tableau."
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
  theme: THEME_KEYS.includes(details.theme) ? details.theme : (THEME_KEYS.includes(raw.theme) ? raw.theme : DEFAULT_THEME),
  slides: (Array.isArray(raw.slides) ? raw.slides : []).slice(0, 40).map((s) => ({
    // normalizeLayout closes the set: a layout the renderer doesn't know
    // becomes 'bullets' rather than an empty slide.
    layout: normalizeLayout(s?.layout),
    eyebrow: str(s?.eyebrow),
    heading: str(s?.heading),
    bullets: lines(s?.bullets).slice(0, 12),
    columnLabels: lines(s?.columnLabels).slice(0, 2),
    imageIdea: str(s?.imageIdea),
    homework: str(s?.homework),
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

${detailBlock(details)}${referenceBlock(reference)}This is a real exam-style paper a teacher prints and hands out, so it must be
organised into SECTIONS like a proper assessment, not one flat list.

RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${itemCount} questions, ordered from easier to harder.
3. ${typeRule}
4. Group the questions into 2-3 sections and declare them in "sections". Give each a label ("A", "B", "C"), a title naming the skill it tests, and its own instruction line. Every item's "section" field must match one of those labels.
5. Number questions "1", "2", "3", ... continuously across the whole paper, in the "number" field.
6. "marks" is a small whole number of marks as a string. Later sections carry more marks per question than earlier ones. Set "totalMarks" to the exact sum.
7. "answerLines" is how many ruled lines an open-response answer needs (1 for a word, 2-3 for a sentence, 5+ for a paragraph). Use 0 for multiple choice.
8. "instructions" is the rubric printed under the title ("Answer ALL questions. Write your answers in the spaces provided. Time: 40 minutes.").
9. Every item needs a real model answer in "answer" — for open questions a complete marking answer, not a hint. This becomes the marking key.
10. Questions must be answerable from what was actually taught: no trick questions, no outside knowledge, no ambiguity about what is being asked.
11. Multiple-choice distractors must be plausible — common learner mistakes, never obviously silly.
12. Use concrete, locally relevant contexts (Rwandan places, names, prices in RWF) where an example is needed.

Return ONLY a JSON object with exactly this shape:
{
  "title": "Les habits — exercices",
  "subject": "French",
  "className": "Primary 3 (P3)",
  "unitTitle": "LES HABITS",
  "language": "French",
  "instructions": "Réponds à TOUTES les questions. Durée : 40 minutes.",
  "totalMarks": "20",
  "sections": [
    { "label": "A", "title": "Vocabulaire", "instructions": "Choisis la bonne réponse." },
    { "label": "B", "title": "Expression écrite", "instructions": "Écris des phrases complètes." }
  ],
  "items": [
    {
      "section": "A",
      "number": "1",
      "question": "Comment dit-on 'shirt' en français ?",
      "options": ["La chemise", "Le pantalon", "La jupe", "Le chapeau"],
      "answer": "La chemise",
      "marks": "2",
      "answerLines": 0
    },
    {
      "section": "B",
      "number": "2",
      "question": "Écris trois vêtements que tu portes à l'école.",
      "options": [],
      "answer": "La chemise, le pantalon, les chaussures.",
      "marks": "3",
      "answerLines": 3
    }
  ]
}`;
};

// Marks are summed from the items rather than trusted from the model — an
// arithmetic slip in "totalMarks" is the kind of thing a head teacher spots
// immediately on a printed paper.
const sumMarks = (items) => items.reduce((total, item) => {
  const m = parseFloat(item.marks);
  return total + (Number.isFinite(m) ? m : 0);
}, 0);

const normalizeExercises = (raw = {}, details = {}) => {
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 60).map((item, i) => {
    const options = lines(item?.options).slice(0, 8);
    const requested = parseInt(item?.answerLines, 10);
    return {
      section: str(item?.section),
      number: str(item?.number) || String(i + 1),
      question: str(item?.question),
      options,
      answer: str(item?.answer),
      marks: str(item?.marks),
      // Multiple choice needs no writing space; an open question always gets
      // at least two lines even if the model asked for none.
      answerLines: options.length ? 0 : (Number.isFinite(requested) ? Math.min(12, Math.max(1, requested)) : 2)
    };
  }).filter((item) => item.question);

  const computed = sumMarks(items);

  return {
    title: str(raw.title) || str(details.title),
    subject: str(details.subject) || str(raw.subject),
    className: str(details.className) || str(raw.className),
    unitTitle: str(details.unitTitle) || str(raw.unitTitle),
    language: str(details.language) === 'auto' ? str(raw.language) : (str(details.language) || str(raw.language)),
    instructions: str(raw.instructions),
    sections: (Array.isArray(raw.sections) ? raw.sections : []).slice(0, 6).map((sec) => ({
      label: str(sec?.label),
      title: str(sec?.title),
      instructions: str(sec?.instructions)
    })).filter((sec) => sec.label || sec.title),
    items,
    totalMarks: computed > 0 ? String(computed) : str(raw.totalMarks)
  };
};

// ── Scheme of work ───────────────────────────────────────────────────────────

const buildSchemePrompt = ({ brief, details = {}, reference, count }) => {
  const weekCount = clampCount(count, 12, 20);
  return `${CONTEXT}

WHAT THE TEACHER WANTS:
"${brief || 'Prepare a scheme of work for the term from the attached curriculum.'}"

${detailBlock(details)}${referenceBlock(reference)}This is the scheme of work a head teacher signs off, so it must read as a
coherent term plan, not a list of topic names.

RULES:
1. LANGUAGE: write EVERY field in ${languageRule(details)}. Never mix languages.
2. Produce exactly ${weekCount} rows, one per teaching week, numbered "1" upward in "week".
3. Rows must progress coherently across the term: later units build on earlier ones, prerequisites come first, and revision/assessment weeks sit where a real teacher would put them (mid-term and end of term).
4. "objectives" is ONE measurable sentence starting "Learners will be able to ..." with an observable verb (name, describe, calculate, demonstrate) — never "understand" or "know".
5. "activities" names the actual teaching methods for that week (group work, demonstration, role play, field observation), as short comma-separated phrases.
6. "materials" must be real, locally available items (exercise books, locally made charts, real objects, markers, learner's book) — never "internet" or equipment a rural school will not have.
7. "assessment" states how learning is checked that week (oral questioning, written exercise, observation checklist, end-of-unit test).
8. "unitTitle" repeats across the weeks belonging to the same unit, so the unit blocks are visible down the page.
9. Keep every field short — this prints as a wide table, one line per cell where possible.

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
