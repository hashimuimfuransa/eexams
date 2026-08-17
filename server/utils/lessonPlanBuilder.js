// Prompt construction and response normalisation for the AI lesson planner.
// Kept out of routes/lessonPlans.js so the prompt and the shaping rules can be
// exercised directly (server/scripts/test-lesson-plan-prompt.js) without booting
// Express, Mongo or auth.

// The model habitually wraps emphasis in markdown (`*Évaluation formative…*`,
// `**Devoir**`), which the PDF would print as literal asterisks — it styles those
// cells itself. Only paired markers are removed, so "3 * 4" survives untouched.
const stripEmphasis = (s) => s
  .replace(/\*\*(.+?)\*\*/gs, '$1')
  .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:!?])/g, '$1$2')
  .replace(/(^|\s)_(\S[^_]*?)_(?=\s|$|[.,;:!?])/g, '$1$2');

const str = (v, fallback = '') => {
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => stripEmphasis(String(x).trim())).join('\n') || fallback;
  if (typeof v === 'object') return fallback;
  const s = stripEmphasis(String(v).trim()).trim();
  return s || fallback;
};

// Activity columns are arrays of lines. The model sometimes returns one long
// string with newlines or leading dashes instead, so accept both shapes.
const lines = (v) => {
  const arr = Array.isArray(v) ? v : String(v || '').split('\n');
  return arr
    // Emphasis first: stripping a leading "*" as a bullet would otherwise orphan the
    // closing marker of an italicised line ("*Salue* les apprenants.").
    .map((l) => stripEmphasis(String(l == null ? '' : l)).replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 12);
};

// Parse "40 min", "40", "1h", "1 hour 30" into minutes; null when unusable.
const durationMinutes = (value) => {
  const s = String(value || '').toLowerCase();
  const hours = s.match(/(\d+)\s*(h|hour|heure)/);
  const mins = s.match(/(\d+)\s*(min|minute)/);
  if (hours || mins) {
    return (hours ? parseInt(hours[1], 10) * 60 : 0) + (mins ? parseInt(mins[1], 10) : 0);
  }
  const bare = s.match(/\d+/);
  return bare ? parseInt(bare[0], 10) : null;
};

// If the AI left step durations out, split the lesson the way the standard plan
// does: a short introduction, the bulk on development, a short conclusion.
const fillMissingStepDurations = (steps, totalDuration) => {
  const total = durationMinutes(totalDuration);
  if (!total || !steps.length) return steps;
  if (steps.every((s) => s.duration)) return steps;

  const weights = steps.length === 3 ? [0.175, 0.625, 0.2] : steps.map(() => 1 / steps.length);
  let remaining = total;
  return steps.map((step, i) => {
    const isLast = i === steps.length - 1;
    const share = isLast ? remaining : Math.max(1, Math.round(total * weights[i]));
    remaining -= share;
    return { ...step, duration: step.duration || `${share} min` };
  });
};

/**
 * A textbook can be 100k characters; only the part about the requested chapter is
 * useful (and only a fraction of it fits in the prompt). Score fixed-size windows
 * by how many of the brief's keywords they contain and keep the best region.
 */
const extractRelevantExcerpt = (content, brief, maxChars = 14000) => {
  const text = String(content || '');
  if (text.length <= maxChars) return text;

  const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'about', 'unit', 'lesson',
    'plan', 'please', 'prepare', 'make', 'want', 'need', 'students', 'learners', 'les', 'des', 'une', 'pour', 'dans']);
  const keywords = String(brief || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 3 && !stop.has(w));

  // "unit 6" / "unité 6" / "chapter 3" style references are the strongest signal.
  const numberRefs = [];
  const refPattern = /(unit|unité|chapter|chapitre|umutwe|isomo|lesson|leçon|module)\s*(\d+)/gi;
  let m;
  while ((m = refPattern.exec(String(brief || ''))) !== null) {
    numberRefs.push(`${m[1].toLowerCase()} ${m[2]}`);
  }

  if (!keywords.length && !numberRefs.length) return text.slice(0, maxChars);

  const WINDOW = 1000;
  const lower = text.toLowerCase();
  let bestIndex = 0;
  let bestScore = -1;

  for (let start = 0; start < lower.length; start += WINDOW) {
    const chunk = lower.slice(start, start + WINDOW);
    let score = 0;
    keywords.forEach((k) => { if (chunk.includes(k)) score += 1; });
    numberRefs.forEach((r) => { if (chunk.includes(r)) score += 8; });
    if (score > bestScore) { bestScore = score; bestIndex = start; }
  }

  if (bestScore <= 0) return text.slice(0, maxChars);

  // Keep some lead-in before the match — chapter headings usually sit just above.
  const start = Math.max(0, bestIndex - Math.floor(maxChars * 0.2));
  return text.slice(start, start + maxChars);
};

const buildLessonPlanPrompt = ({ brief, details = {}, reference }) => {
  const detailLines = Object.entries(details)
    .filter(([k, v]) => v && k !== 'language')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const language = details.language && details.language !== 'auto'
    ? details.language
    : 'the language of the subject being taught — a French lesson must be written entirely in French, a Kinyarwanda lesson in Kinyarwanda, otherwise English';

  return `You are an experienced Rwandan curriculum (REB / CBC) teacher writing a single-lesson plan that will be printed on the official lesson plan form and handed to a head teacher.

WHAT THE TEACHER WANTS TO PREPARE:
"${brief || 'Prepare the next lesson from the attached material.'}"

${detailLines ? `DETAILS ALREADY KNOWN (use these exactly as given, do not invent different values):\n${detailLines}\n` : ''}
${reference ? `REFERENCE MATERIAL FROM THE TEACHER'S BOOK / CURRICULUM (extracted text, may be partial):\n"""\n${reference}\n"""\n\nBase the content, vocabulary and examples on this material. If it covers the requested chapter/unit, follow it closely.\n` : ''}
RULES:
1. LANGUAGE: write EVERY field in ${language}. Never mix languages.
2. Fill in any detail the teacher did not give (unit title, key unit competence, materials, references) using the reference material or standard REB practice.
3. instructionalObjectives must be ONE sentence in the standard form: "By using <materials>, <class> learners who attend will be able to <do what> clearly at more than <x>/10 within <duration>."
4. steps: exactly three — "Introduction", "Lesson Development", "Conclusion" — and their durations MUST add up to the total lesson duration.
5. Each step needs concrete teacherActivities and learnerActivities (2-4 short lines each, starting with a verb: "Greets learners.", "Observe the demonstration."). They must mirror each other: what the teacher does, what the learners do at that moment.
6. competences: 1-3 lines naming a REB generic competence (Critical thinking, Creativity and innovation, Research and problem solving, Communication, Cooperation and interpersonal management, Lifelong learning) or a cross-cutting issue (Inclusive education, Gender education, Peace and values education, Environment and sustainability, Standardisation culture, Financial education, Comprehensive sexuality education) followed by a short explanation of how this step develops it. Format: "Communication: Enhancing expression through clothing discussions."
7. The Conclusion must include a summary activity and specific homework.
8. learningMaterials: real, locally available items (exercise books, locally made charts, real objects, markers, learner's book).
9. references: real textbook references, one per line, e.g. "Rwanda Education Board. (2025). Livre de l'élève P3. Kigali: REB."
10. Keep every line short — this is a printed table, not an essay.

Return ONLY a JSON object with exactly this shape:
{
  "term": "Term 3",
  "date": "2026-06-04",
  "subject": "French",
  "className": "Primary 3 (P3)",
  "unitNo": "6",
  "lessonNo": "7 Out of 7",
  "duration": "40 min",
  "classSize": "43",
  "specialNeeds": "None",
  "unitTitle": "LES HABITS",
  "keyUnitCompetence": "...",
  "lessonTitle": "...",
  "instructionalObjectives": "...",
  "location": "Classroom",
  "learningMaterials": "...",
  "references": "...",
  "lessonOverview": "One italic sentence describing the overall approach of the lesson.",
  "steps": [
    {
      "name": "Introduction",
      "duration": "7 min",
      "teacherActivities": ["Greets learners.", "Shows real clothing items and asks guiding questions for discovery."],
      "learnerActivities": ["Respond to greetings.", "Observe clothing items and identify them in groups."],
      "competences": ["Communication: Enhancing expression through clothing discussions."]
    }
  ],
  "language": "French"
}`;
};

/**
 * Turn whatever the model returned into the LessonPlan document shape.
 * Values the teacher supplied in `details` always win over the model's echo.
 */
const normalizePlan = (raw = {}, details = {}) => {
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).slice(0, 6).map((s) => ({
    name: str(s.name),
    duration: str(s.duration),
    teacherActivities: lines(s.teacherActivities || s.teacherActivity),
    learnerActivities: lines(s.learnerActivities || s.learnerActivity),
    competences: lines(s.competences || s.genericCompetences || s.crossCuttingIssues)
  })).filter((s) => s.name || s.teacherActivities.length || s.learnerActivities.length);

  const duration = str(details.duration) || str(raw.duration);

  return {
    term: str(details.term) || str(raw.term),
    date: str(details.date) || str(raw.date),
    subject: str(details.subject) || str(raw.subject),
    className: str(details.className) || str(raw.className || raw.class),
    unitNo: str(details.unitNo) || str(raw.unitNo),
    lessonNo: str(details.lessonNo) || str(raw.lessonNo),
    duration,
    classSize: str(details.classSize) || str(raw.classSize),
    specialNeeds: str(details.specialNeeds) || str(raw.specialNeeds, 'None'),

    unitTitle: str(raw.unitTitle),
    keyUnitCompetence: str(raw.keyUnitCompetence),
    lessonTitle: str(raw.lessonTitle || raw.title),
    instructionalObjectives: str(raw.instructionalObjectives || raw.objectives),
    location: str(raw.location, 'Classroom'),
    learningMaterials: str(raw.learningMaterials || raw.materials),
    references: str(raw.references),
    lessonOverview: str(raw.lessonOverview || raw.overview),

    steps: fillMissingStepDurations(steps, duration),
    selfEvaluation: '',
    language: str(raw.language) || (details.language && details.language !== 'auto' ? details.language : '')
  };
};

module.exports = {
  str,
  lines,
  durationMinutes,
  fillMissingStepDurations,
  extractRelevantExcerpt,
  buildLessonPlanPrompt,
  normalizePlan
};
