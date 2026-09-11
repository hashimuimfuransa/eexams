// Everything in the Lesson Planner that depends on the language a document is
// written in: recognising that language, the official REB/CBC vocabulary the
// prompts pin for it, and the headings the printed forms carry.
//
// Reported by a French teacher: plans came out French in the body but English
// in the objectives, step names and every printed heading, and schemes of work
// wrote their objectives in English. The prompts showed the model English
// templates — and an example labelled subject "French" but worded in English —
// which it copied, and the PDF/DOCX renderers printed hardcoded English labels
// whatever the plan's language. Both now key off this module, so supporting
// another language's form means adding it here.

const LANGUAGE_NAMES = [
  ['French', /^(fr|fre|fra|french|fran[cç]ais|igifaransa)$/i],
  ['English', /^(en|eng|english|anglais|icyongereza)$/i],
  ['Kinyarwanda', /^(rw|kin|kinyarwanda|ikinyarwanda)$/i],
  ['Kiswahili', /^(sw|swa|swahili|kiswahili|igiswahili)$/i]
];

/** "Français", "fr", "FRENCH" → "French". Unknown names pass through; blank and "auto" → "". */
const canonicalLanguage = (value) => {
  const s = String(value || '').trim();
  if (!s || /^auto$/i.test(s)) return '';
  const hit = LANGUAGE_NAMES.find(([, re]) => re.test(s));
  return hit ? hit[0] : s;
};

// Only a language subject names the language it is taught in ("Français",
// "English", "Ikinyarwanda"). Exactly one hit is required, so a subject like
// "English and French" decides nothing.
const SUBJECT_LANGUAGES = [
  ['French', /\b(french|fran[cç]ais)\b|igifaransa/i],
  ['English', /\b(english|anglais)\b|icyongereza/i],
  ['Kinyarwanda', /kinyarwanda/i],
  ['Kiswahili', /swahili/i]
];

const languageFromSubject = (subject) => {
  const s = String(subject || '');
  const hits = SUBJECT_LANGUAGES.filter(([, re]) => re.test(s));
  return hits.length === 1 ? hits[0][0] : '';
};

// A brief only counts when it names the class and subject together ("P3
// French", "French lesson") — a bare mention is not enough: "the French
// Revolution, S4 History" is an English lesson.
const CLASS = String.raw`(?:p[1-6]|s[1-6]|primary\s*\d|senior\s*\d)`;
const SUBJECT_IN_BRIEF = [
  ['French', new RegExp(String.raw`\b${CLASS}\s+(?:french|fran[cç]ais)\b|\b(?:french|fran[cç]ais)\s+(?:${CLASS}|lesson|class|subject)\b`, 'i')],
  ['English', new RegExp(String.raw`\b${CLASS}\s+english\b|\benglish\s+(?:${CLASS}|lesson|class|subject)\b`, 'i')],
  ['Kinyarwanda', /kinyarwanda/i],
  ['Kiswahili', /kiswahili/i]
];

// French is the one subject taught in French, and its briefs are usually
// written in it ("Les habits, évaluation de l'unité"). Two signals are needed —
// distinct French words, or one plus French accents — so a stray loanword
// doesn't flip an English lesson.
const FRENCH_WORDS = /(?<!\p{L})(?:les|des|une|du|aux|leçon|unité|chapitre|évaluation|apprenants|élèves|vocabulaire|grammaire|conjugaison|dictée|rédaction)(?!\p{L})/giu;

const looksFrench = (text) => {
  const s = String(text || '');
  const words = new Set((s.match(FRENCH_WORDS) || []).map((w) => w.toLowerCase()));
  const accents = /[àâçéèêëîïôûùœ]/i.test(s) ? 1 : 0;
  return words.size + accents >= 2;
};

/**
 * Best knowledge of the language a document will be written in, or '' when
 * only the model can tell (it is then told to match the subject, as before).
 * Order: the teacher's explicit choice, the subject field, then the brief.
 */
const resolveLanguage = ({ language, subject, brief } = {}) => {
  const explicit = canonicalLanguage(language);
  if (explicit) return explicit;
  const fromSubject = languageFromSubject(subject);
  if (fromSubject) return fromSubject;
  const hits = SUBJECT_IN_BRIEF.filter(([, re]) => re.test(String(brief || '')));
  if (hits.length === 1) return hits[0][0];
  return looksFrench(brief) ? 'French' : '';
};

// ── Prompt vocabulary ────────────────────────────────────────────────────────
//
// The official REB/CBC wording per language. Handing the model the exact terms
// is what stops it translating them loosely — or not at all.
const VOCAB = {
  English: {
    steps: ['Introduction', 'Lesson Development', 'Conclusion'],
    objectiveForm: '"By using <materials>, <class> learners who attend will be able to <do what> clearly at more than <x>/10 within <duration>."',
    schemeObjective: '"Learners will be able to ..."',
    competences: ['Critical thinking', 'Creativity and innovation', 'Research and problem solving', 'Communication', 'Cooperation and interpersonal management', 'Lifelong learning'],
    crossCutting: ['Inclusive education', 'Gender education', 'Peace and values education', 'Environment and sustainability', 'Standardisation culture', 'Financial education', 'Comprehensive sexuality education', 'Genocide studies'],
    none: 'None',
    classroom: 'Classroom',
    lessonNo: '7 of 7',
    term: 'Term 3'
  },
  French: {
    steps: ['Introduction', 'Développement de la leçon', 'Conclusion'],
    objectiveForm: `"À l'aide de <matériel>, les apprenants de <classe> présents seront capables de <faire quoi> correctement à plus de <x>/10 en <durée>."`,
    schemeObjective: '"Les apprenants seront capables de ..."',
    competences: ['Pensée critique', 'Créativité et innovation', 'Recherche et résolution de problèmes', 'Communication', 'Coopération et gestion des relations interpersonnelles', 'Apprentissage tout au long de la vie'],
    crossCutting: ['Éducation inclusive', 'Éducation au genre', 'Éducation à la paix et aux valeurs', 'Environnement et durabilité', 'Culture de la normalisation', 'Éducation financière', 'Éducation sexuelle complète', 'Études sur le génocide'],
    none: 'Aucun',
    classroom: 'Salle de classe',
    lessonNo: '7 sur 7',
    term: 'Trimestre 3'
  }
};

/**
 * The [language, terms] pairs to show the model: the target's own terms; the
 * English ones (to translate) for a language without a list here; or every
 * list when the language is still undecided.
 */
const vocabularyFor = (target) => {
  if (!target) return Object.entries(VOCAB);
  return [[target, VOCAB[target] || VOCAB.English]];
};

/** One line telling the model an example's language is not the one to copy. */
const exampleNote = (target, exampleLanguage) => {
  if (target === exampleLanguage) return '';
  if (target) return `The example below is in ${exampleLanguage} only to show the shape — write every value in ${target}.\n`;
  return `The example below is in ${exampleLanguage} only to show the shape — if the lesson is taught in French, write every value in French using the French terms above.\n`;
};

// ── Printed headings ─────────────────────────────────────────────────────────
//
// Straight apostrophes only: the PDF's standard fonts are WinAnsi-encoded, and
// these strings are drawn without passing through the renderers' sanitisers.
const LABELS = {
  en: {
    lessonPlanTitle: 'LESSON PLAN',
    schoolName: 'School Name',
    teacherName: "Teacher's Name",
    term: 'Term',
    date: 'Date',
    subject: 'Subject',
    className: 'Class',
    unitNo: 'Unit No',
    lessonNo: 'Lesson No',
    duration: 'Duration',
    classSize: 'Class size',
    specialNeeds: 'Type of special educational needs to be catered for in this lesson and number of learners in each category',
    unitTitle: 'Unit title',
    keyUnitCompetence: 'Key unit competence',
    lessonTitle: 'Title of the lesson',
    instructionalObjectives: 'Instructional objectives',
    location: 'Plan of this class (Location)',
    learningMaterials: 'Learning materials',
    references: 'References',
    timing: 'Timing for each step',
    description: 'Description of teaching and learning activities',
    competences: 'Generic competences and cross-cutting issues + some explanations',
    teacherActivity: "Teacher's activity",
    learnerActivity: "Learner's activity",
    selfEvaluation: "Teacher's self-evaluation",
    none: 'None',
    classroom: 'Classroom',
    school: 'School',
    teacher: 'Teacher',
    unit: 'Unit',
    year: 'Year',
    schemeTitle: 'Scheme of work',
    schemeHeaders: ['Wk', 'L#', 'Unit', 'Lesson title', 'Objectives', 'Activities', 'Materials', 'Assessment'],
    exerciseTitle: 'Exercise sheet',
    name: 'Name',
    total: 'Total',
    marks: 'marks',
    section: 'SECTION',
    markingKey: 'MARKING KEY',
    questionCol: 'Q',
    answer: 'Answer',
    marksCol: 'Marks',
    slidesTitle: 'Slide deck',
    slide: 'Slide',
    speakerNotes: 'Speaker notes'
  },
  fr: {
    lessonPlanTitle: 'PLAN DE LEÇON',
    schoolName: "Nom de l'école",
    teacherName: "Nom de l'enseignant(e)",
    term: 'Trimestre',
    date: 'Date',
    subject: 'Matière',
    className: 'Classe',
    unitNo: 'Unité n°',
    lessonNo: 'Leçon n°',
    duration: 'Durée',
    classSize: 'Effectif',
    specialNeeds: "Types de besoins éducatifs spéciaux à prendre en compte dans cette leçon et nombre d'apprenants dans chaque catégorie",
    unitTitle: "Titre de l'unité",
    keyUnitCompetence: "Compétence clé de l'unité",
    lessonTitle: 'Titre de la leçon',
    instructionalObjectives: "Objectifs d'apprentissage",
    location: 'Plan de la classe (lieu)',
    learningMaterials: 'Matériel didactique',
    references: 'Références',
    timing: 'Étapes et durée',
    description: "Description des activités d'enseignement et d'apprentissage",
    competences: 'Compétences génériques et thèmes transversaux + quelques explications',
    teacherActivity: "Activités de l'enseignant(e)",
    learnerActivity: 'Activités des apprenants',
    selfEvaluation: "Évaluation de l'enseignement",
    none: 'Aucun',
    classroom: 'Salle de classe',
    school: 'École',
    teacher: 'Enseignant(e)',
    unit: 'Unité',
    year: 'Année',
    schemeTitle: 'Plan de travail',
    schemeHeaders: ['Sem.', 'Leçon', 'Unité', 'Titre de la leçon', 'Objectifs', 'Activités', 'Matériel', 'Évaluation'],
    exerciseTitle: "Fiche d'exercices",
    name: 'Nom',
    total: 'Total',
    marks: 'points',
    section: 'SECTION',
    markingKey: 'CORRIGÉ',
    questionCol: 'Q',
    answer: 'Réponse',
    marksCol: 'Points',
    slidesTitle: 'Présentation',
    slide: 'Diapositive',
    speakerNotes: "Notes de l'enseignant(e)"
  }
};

/**
 * Printed headings for a plan or planner resource: the French form for French
 * documents, English otherwise. Falls back to the subject when the language
 * was never recorded (plans written by hand, or saved before it was).
 */
const formLabels = (doc = {}) => {
  const lang = canonicalLanguage(doc.language) || languageFromSubject(doc.subject);
  return lang === 'French' ? LABELS.fr : LABELS.en;
};

const NONE_VALUE = /^(none|no|nil|n\/?a|-+|—|aucun|aucune|néant|rien|ntayo|hakuna)\.?$/i;

/** Blank, "None", "N/A", "Aucun"… — a value that reports nothing. */
const isNoneLike = (value) => {
  const s = String(value ?? '').trim();
  return !s || NONE_VALUE.test(s);
};

// "None" and "Classroom" are what the app pre-fills, not what anyone wrote, so
// they print in the form's language. Real content prints exactly as written.
const printedPlanDefaults = (plan = {}, labels = formLabels(plan)) => ({
  specialNeeds: isNoneLike(plan.specialNeeds) ? labels.none : String(plan.specialNeeds).trim(),
  location: /^classroom$/i.test(String(plan.location || '').trim()) ? labels.classroom : (plan.location || '')
});

module.exports = {
  canonicalLanguage,
  languageFromSubject,
  looksFrench,
  resolveLanguage,
  VOCAB,
  vocabularyFor,
  exampleNote,
  LABELS,
  formLabels,
  isNoneLike,
  printedPlanDefaults
};
