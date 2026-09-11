// Prompt construction and response normalisation for the AI lesson planner.
// Kept out of routes/lessonPlans.js so the prompt and the shaping rules can be
// exercised directly (server/scripts/test-lesson-plan-builder.js) without booting
// Express, Mongo or auth.
const {
  resolveLanguage,
  canonicalLanguage,
  vocabularyFor,
  exampleNote,
  isNoneLike,
  VOCAB
} = require('./plannerLanguage');

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

// Worked examples of the finished JSON, one per language whose official terms
// are known. The model copies an example's language as readily as its shape —
// an English-worded example labelled subject "French" is what used to put
// English step names and objectives into French plans — so the example is shown
// in the plan's own language whenever that is known. Both carry a full-depth
// Lesson Development, because the model sizes its steps to the example's.
const EXAMPLE_PLANS = {
  English: {
    term: 'Term 3',
    date: '2026-06-04',
    subject: 'English',
    className: 'Primary 3 (P3)',
    unitNo: '6',
    lessonNo: '7 of 7',
    duration: '40 min',
    classSize: '43',
    specialNeeds: 'None',
    unitTitle: 'CLOTHES',
    keyUnitCompetence: 'To use the vocabulary of clothes to describe what people wear.',
    lessonTitle: 'Describing what we wear',
    instructionalObjectives: 'By using real clothes and picture charts, P3 learners who attend will be able to name and describe clothes clearly at more than 8/10 within 40 minutes.',
    location: 'Classroom',
    learningMaterials: 'Real clothes, picture charts, exercise books, markers',
    references: "Rwanda Education Board. (2025). English Learner's Book P3. Kigali: REB.",
    lessonOverview: 'Learners discover clothing words from real items, practise them in groups and use them to describe one another.',
    steps: [
      {
        name: 'Introduction',
        duration: '7 min',
        teacherActivities: [
          'Greets learners and asks them to sit in their groups.',
          'Asks learners to recall three words from the previous lesson.',
          'Shows a bag of real clothes and asks: "What do we wear to school?"'
        ],
        learnerActivities: [
          'Respond to the greeting and sit in their groups.',
          'Recall words from the previous lesson.',
          'Observe the clothes and answer the question.'
        ],
        competences: ['Communication: Learners express ideas orally about what they wear.']
      },
      {
        name: 'Lesson Development',
        duration: '25 min',
        teacherActivities: [
          'Gives each group four clothing items and a card with their names.',
          'Asks groups to match each item to its name.',
          'Invites one learner per group to present their matches.',
          'Writes shirt, trousers, skirt, dress, shoes and hat on the board and models the pronunciation.',
          'Explains the pattern "He/She is wearing a ..." with two examples.',
          'Asks pairs to describe each other using the pattern.'
        ],
        learnerActivities: [
          'Receive the items and cards in their groups.',
          'Match each item to its name.',
          'Present their matches to the class.',
          'Read the words from the board and repeat them.',
          'Listen to the pattern and repeat the examples.',
          'Describe their partner: "She is wearing a blue skirt."'
        ],
        competences: [
          'Cooperation and interpersonal management: Learners share the matching task in groups.',
          'Communication: Learners build full sentences about clothes.'
        ]
      },
      {
        name: 'Conclusion',
        duration: '8 min',
        teacherActivities: [
          'Asks learners to summarise the new words.',
          'Points at five items and asks learners to name them and say who is wearing one.',
          'Gives homework: draw and label five clothes worn at home.'
        ],
        learnerActivities: [
          'Summarise the new words.',
          'Name the five items and describe a classmate.',
          'Copy the homework into their exercise books.'
        ],
        competences: ['Lifelong learning: Learners practise the new words at home.']
      }
    ],
    language: 'English'
  },
  French: {
    term: 'Trimestre 3',
    date: '2026-06-04',
    subject: 'Français',
    className: 'Primaire 3 (P3)',
    unitNo: '6',
    lessonNo: '7 sur 7',
    duration: '40 min',
    classSize: '43',
    specialNeeds: 'Aucun',
    unitTitle: 'LES HABITS',
    keyUnitCompetence: 'Utiliser le vocabulaire des habits pour décrire ce que les gens portent.',
    lessonTitle: 'Décrire ce que nous portons',
    instructionalObjectives: "À l'aide de vrais habits et d'affiches illustrées, les apprenants de P3 présents seront capables de nommer et décrire correctement les habits à plus de 8/10 en 40 minutes.",
    location: 'Salle de classe',
    learningMaterials: "Vrais habits, affiches illustrées, cahiers d'exercices, marqueurs",
    references: "Rwanda Education Board. (2025). Français, Livre de l'élève P3. Kigali : REB.",
    lessonOverview: "Les apprenants découvrent le vocabulaire des habits à partir d'objets réels, s'exercent en groupes et l'utilisent pour se décrire.",
    steps: [
      {
        name: 'Introduction',
        duration: '7 min',
        teacherActivities: [
          'Salue les apprenants et les installe en groupes.',
          'Demande de rappeler trois mots de la leçon précédente.',
          `Montre un sac de vrais habits et demande : "Que portons-nous pour aller à l'école ?"`
        ],
        learnerActivities: [
          "Répondent aux salutations et s'installent en groupes.",
          'Rappellent des mots de la leçon précédente.',
          'Observent les habits et répondent à la question.'
        ],
        competences: ["Communication : les apprenants s'expriment oralement sur ce qu'ils portent."]
      },
      {
        name: 'Développement de la leçon',
        duration: '25 min',
        teacherActivities: [
          'Distribue à chaque groupe quatre habits et une carte portant leurs noms.',
          "Demande aux groupes d'associer chaque habit à son nom.",
          'Invite un apprenant par groupe à présenter les réponses.',
          'Écrit la chemise, le pantalon, la jupe, la robe, les chaussures et le chapeau au tableau et fait répéter.',
          'Explique la structure "Il/Elle porte un/une ..." avec deux exemples.',
          'Demande aux apprenants de décrire leur voisin deux à deux.'
        ],
        learnerActivities: [
          'Reçoivent les habits et les cartes en groupes.',
          'Associent chaque habit à son nom.',
          'Présentent leurs réponses à la classe.',
          'Lisent les mots au tableau et les répètent.',
          'Écoutent la structure et répètent les exemples.',
          'Décrivent leur voisin : "Elle porte une jupe bleue."'
        ],
        competences: [
          'Coopération et gestion des relations interpersonnelles : les apprenants se partagent la tâche en groupes.',
          'Communication : les apprenants construisent des phrases complètes sur les habits.'
        ]
      },
      {
        name: 'Conclusion',
        duration: '8 min',
        teacherActivities: [
          'Demande aux apprenants de résumer les nouveaux mots.',
          'Montre cinq habits et demande de les nommer et de dire qui en porte un.',
          'Donne le devoir : dessiner et nommer cinq habits portés à la maison.'
        ],
        learnerActivities: [
          'Résument les nouveaux mots.',
          'Nomment les cinq habits et décrivent un camarade.',
          'Notent le devoir dans leur cahier.'
        ],
        competences: ['Apprentissage tout au long de la vie : les apprenants réutilisent les mots à la maison.']
      }
    ],
    language: 'French'
  }
};

const buildLessonPlanPrompt = ({ brief, details = {}, reference }) => {
  const target = resolveLanguage({ language: details.language, subject: details.subject, brief });

  // "None" is what the form pre-fills, not something the teacher said. Pinned
  // as a fixed detail it printed an English "None" on French plans.
  const detailLines = Object.entries(details)
    .filter(([k, v]) => v && k !== 'language' && !(k === 'specialNeeds' && isNoneLike(v)))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const language = target || 'the language of the subject being taught — a French lesson must be written entirely in French, a Kinyarwanda lesson in Kinyarwanda, otherwise English';

  const vocab = vocabularyFor(target);
  const vocabText = vocab.map(([name, v]) => {
    const intro = vocab.length > 1
      ? `If the plan is in ${name}:`
      : VOCAB[name] ? `Official ${name} terms:` : `Official terms (translate them into ${name}):`;
    return [
      intro,
      `- Step names: ${v.steps.map((s) => `"${s}"`).join(', ')}`,
      `- Instructional objective form: ${v.objectiveForm}`,
      `- Generic competences: ${v.competences.join(', ')}`,
      `- Cross-cutting issues: ${v.crossCutting.join(', ')}`,
      `- Other values: no special needs = "${v.none}", location = "${v.classroom}", lesson number = "${v.lessonNo}", term = "${v.term}"`
    ].join('\n');
  }).join('\n\n');

  const stepRule = VOCAB[target]
    ? VOCAB[target].steps.map((s) => `"${s}"`).join(', ')
    : target
      ? `Introduction, Lesson Development and Conclusion, translated into ${target}`
      : `named with the step names for the plan's language under OFFICIAL TERMS`;

  const exampleLanguage = EXAMPLE_PLANS[target] ? target : 'English';

  return `You are an experienced Rwandan curriculum (REB / CBC) teacher writing a single-lesson plan that will be printed on the official lesson plan form and handed to a head teacher.

WHAT THE TEACHER WANTS TO PREPARE:
"${brief || 'Prepare the next lesson from the attached material.'}"

${detailLines ? `DETAILS ALREADY KNOWN (use these exactly as given, do not invent different values):\n${detailLines}\n` : ''}
${reference ? `REFERENCE MATERIAL FROM THE TEACHER'S BOOK / CURRICULUM (extracted text, may be partial):\n"""\n${reference}\n"""\n\nBase the content, vocabulary and examples on this material. If it covers the requested chapter/unit, follow it closely.\n` : ''}
RULES:
1. LANGUAGE: write EVERY field in ${language}. Never mix languages — that covers the step names, competence names, objectives, location, "none", lesson number and term, not only the activities.
2. Fill in any detail the teacher did not give (unit title, key unit competence, materials, references) using the reference material or standard REB practice.
3. instructionalObjectives must be ONE sentence in the instructional objective form under OFFICIAL TERMS.
4. steps: exactly three — ${stepRule} — and their durations MUST add up to the total lesson duration.
5. DEPTH: a head teacher inspects this plan, so every step must be complete, not a sketch.
   - Introduction: 3-4 teacher lines and 3-4 learner lines — beyond the greeting, a quick revision of the previous lesson and a question or situation that leads into today's topic.
   - Lesson Development: 6-8 teacher lines and 6-8 learner lines covering, in order, the learning activity learners do in groups or pairs, the presentation of their findings, the teacher's explanation and synthesis of the actual content (name the real words, rules, facts or methods taught), and a practice exercise.
   - Conclusion: 3-5 teacher lines and 3-5 learner lines covering the summary, a short evaluation that checks the instructional objective (state the actual questions or task), and specific homework.
   Each line is one concrete sentence starting with a verb, and the two columns mirror each other: what the teacher does, and what the learners do at that moment.
6. competences: 1-3 lines per step, each naming a REB generic competence or cross-cutting issue (official names under OFFICIAL TERMS) followed by how this step develops it. Format: "<Name>: <explanation>".
7. specialNeeds: if the teacher named learners with special educational needs, list each category with its number of learners, and make at least one Lesson Development teacher activity cater for them (seating near the board, large print, peer support, extra time). If there are none, write the plan language's word for "none".
8. learningMaterials: real, locally available items (exercise books, locally made charts, real objects, markers, learner's book).
9. references: real textbook references, one per line, in the form used in the example.
10. Keep each line to one sentence — this is a printed table, not an essay.

OFFICIAL TERMS:
${vocabText}

${exampleNote(target, exampleLanguage)}Return ONLY a JSON object with exactly this shape:
${JSON.stringify(EXAMPLE_PLANS[exampleLanguage], null, 2)}`;
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
  const language = canonicalLanguage(details.language) || canonicalLanguage(str(raw.language));
  const terms = VOCAB[language] || VOCAB.English;

  return {
    term: str(details.term) || str(raw.term),
    date: str(details.date) || str(raw.date),
    subject: str(details.subject) || str(raw.subject),
    className: str(details.className) || str(raw.className || raw.class),
    unitNo: str(details.unitNo) || str(raw.unitNo),
    lessonNo: str(details.lessonNo) || str(raw.lessonNo),
    duration,
    classSize: str(details.classSize) || str(raw.classSize),
    // A pre-filled "None" carries no information; the model's value is already
    // in the plan's language ("Aucun").
    specialNeeds: (isNoneLike(details.specialNeeds) ? '' : str(details.specialNeeds)) || str(raw.specialNeeds) || terms.none,

    unitTitle: str(raw.unitTitle),
    keyUnitCompetence: str(raw.keyUnitCompetence),
    lessonTitle: str(raw.lessonTitle || raw.title),
    instructionalObjectives: str(raw.instructionalObjectives || raw.objectives),
    location: str(raw.location) || terms.classroom,
    learningMaterials: str(raw.learningMaterials || raw.materials),
    references: str(raw.references),
    lessonOverview: str(raw.lessonOverview || raw.overview),

    steps: fillMissingStepDurations(steps, duration),
    selfEvaluation: '',
    language
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
