/**
 * Fast, offline unit test for the lesson-planner shaping helpers
 * (server/utils/lessonPlanBuilder.js) — no Groq call, no Express/Mongo, no API key.
 *
 * Covers the three things the route depends on being right:
 *   - a textbook is narrowed to the chapter the teacher actually named
 *   - whatever shape the model returns for activities becomes clean line arrays
 *   - step timings always add up to the lesson duration
 *   - a plan or scheme is pinned to one language, printed headings included
 *
 * Usage: node server/scripts/test-lesson-plan-builder.js
 */

const {
  lines,
  durationMinutes,
  fillMissingStepDurations,
  extractRelevantExcerpt,
  buildLessonPlanPrompt,
  normalizePlan
} = require('../utils/lessonPlanBuilder');
const { buildSchemePrompt } = require('../utils/plannerResourceBuilder');
const {
  canonicalLanguage,
  resolveLanguage,
  formLabels,
  printedPlanDefaults
} = require('../utils/plannerLanguage');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'mismatch'}\n        expected: ${e}\n        actual:   ${a}`);
}
function assertTrue(value, msg) {
  if (!value) throw new Error(msg || 'expected truthy');
}

console.log('\nlines()');
check('splits a newline string into trimmed items', () => {
  assertEqual(lines('- Greets learners.\n- Shows charts.'), ['Greets learners.', 'Shows charts.']);
});
check('passes arrays through, stripping bullets and blanks', () => {
  assertEqual(lines(['• Respond to greetings.', '', '  * Observe.  ']), ['Respond to greetings.', 'Observe.']);
});
check('handles null/undefined without throwing', () => {
  assertEqual(lines(undefined), []);
  assertEqual(lines(null), []);
});

console.log('\ndurationMinutes()');
check('parses the common spellings', () => {
  assertEqual(durationMinutes('40 min'), 40);
  assertEqual(durationMinutes('40'), 40);
  assertEqual(durationMinutes('1h'), 60);
  assertEqual(durationMinutes('1 hour 30 min'), 90);
  assertEqual(durationMinutes(''), null);
});

console.log('\nfillMissingStepDurations()');
check('splits a 40 min lesson the standard way when the AI omits timings', () => {
  const steps = [{ name: 'Introduction' }, { name: 'Lesson Development' }, { name: 'Conclusion' }];
  const filled = fillMissingStepDurations(steps, '40 min');
  assertEqual(filled.map((s) => s.duration), ['7 min', '25 min', '8 min']);
});
check('leaves the AI timings alone when they are all present', () => {
  const steps = [
    { name: 'Introduction', duration: '5 min' },
    { name: 'Lesson Development', duration: '30 min' },
    { name: 'Conclusion', duration: '5 min' }
  ];
  assertEqual(fillMissingStepDurations(steps, '40 min').map((s) => s.duration), ['5 min', '30 min', '5 min']);
});
check('timings always add up to the total', () => {
  const steps = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  const total = fillMissingStepDurations(steps, '90 min')
    .reduce((sum, s) => sum + parseInt(s.duration, 10), 0);
  assertEqual(total, 90);
});

console.log('\nextractRelevantExcerpt()');
check('returns short material untouched', () => {
  assertEqual(extractRelevantExcerpt('short book', 'unit 6'), 'short book');
});
check('finds the named unit deep inside a long book', () => {
  const filler = 'Random pedagogy filler text about nothing in particular. '.repeat(600);
  const target = 'UNIT 6: LES HABITS. Vocabulaire: la chemise, le pantalon, la robe. '.repeat(20);
  const book = filler + target + filler;
  const excerpt = extractRelevantExcerpt(book, "Unit 6 - Les habits, lesson 7 of 7", 4000);
  assertTrue(excerpt.includes('LES HABITS'), 'excerpt should contain the requested unit');
  assertTrue(excerpt.length <= 4000, 'excerpt should respect maxChars');
});
check('falls back to the start when nothing matches', () => {
  const book = 'x'.repeat(50000);
  assertEqual(extractRelevantExcerpt(book, 'quantum chromodynamics', 1000).length, 1000);
});

console.log('\nnormalizePlan()');
check("teacher's own details override whatever the model echoed back", () => {
  const plan = normalizePlan(
    { subject: 'Science', className: 'P6', duration: '80 min', steps: [] },
    { subject: 'French', className: 'Primary 3 (P3)', duration: '40 min' }
  );
  assertEqual(plan.subject, 'French');
  assertEqual(plan.className, 'Primary 3 (P3)');
  assertEqual(plan.duration, '40 min');
});
check('accepts singular teacherActivity / learnerActivity key names', () => {
  const plan = normalizePlan({
    steps: [{ name: 'Introduction', teacherActivity: 'Greets learners.', learnerActivity: ['Respond.'] }]
  }, {});
  assertEqual(plan.steps[0].teacherActivities, ['Greets learners.']);
  assertEqual(plan.steps[0].learnerActivities, ['Respond.']);
});
check('drops empty steps and defaults location/specialNeeds', () => {
  const plan = normalizePlan({ steps: [{ name: '', teacherActivities: [], learnerActivities: [] }] }, {});
  assertEqual(plan.steps, []);
  assertEqual(plan.location, 'Classroom');
  assertEqual(plan.specialNeeds, 'None');
});
check('never lets an object field leak into a string column', () => {
  const plan = normalizePlan({ references: { a: 1 }, learningMaterials: ['charts', 'markers'] }, {});
  assertEqual(plan.references, '');
  assertEqual(plan.learningMaterials, 'charts\nmarkers');
});
check('strips the markdown emphasis the model likes to add', () => {
  const plan = normalizePlan({
    lessonOverview: '*Évaluation formative des connaissances.*',
    keyUnitCompetence: '**Communication** au quotidien',
    steps: [{ name: 'Introduction', teacherActivities: ['*Salue* les apprenants.'], learnerActivities: ['Répond.'] }]
  }, {});
  assertEqual(plan.lessonOverview, 'Évaluation formative des connaissances.');
  assertEqual(plan.keyUnitCompetence, 'Communication au quotidien');
  assertEqual(plan.steps[0].teacherActivities, ['Salue les apprenants.']);
});
check('leaves a bare asterisk in arithmetic alone', () => {
  assertEqual(normalizePlan({ lessonTitle: 'Multiplication: 3 * 4 and 5 * 6' }, {}).lessonTitle, 'Multiplication: 3 * 4 and 5 * 6');
});

console.log('\nbuildLessonPlanPrompt()');
check('pins the output language when the teacher picked one', () => {
  const prompt = buildLessonPlanPrompt({ brief: 'unit 6', details: { language: 'Kinyarwanda' } });
  assertTrue(prompt.includes('write EVERY field in Kinyarwanda'), 'should name the chosen language');
});
check('falls back to matching the subject when language is auto', () => {
  const prompt = buildLessonPlanPrompt({ brief: 'unit 6', details: { language: 'auto' } });
  assertTrue(prompt.includes('the language of the subject being taught'), 'should defer to the subject');
  assertTrue(!prompt.includes('- language: auto'), 'auto should not be echoed as a known detail');
});
check('includes the reference material when one was attached', () => {
  const prompt = buildLessonPlanPrompt({ brief: 'unit 6', details: {}, reference: 'CHAPTER TEXT HERE' });
  assertTrue(prompt.includes('CHAPTER TEXT HERE'), 'reference should reach the model');
});

check('a French plan gets French step names, the French objective form and a French example', () => {
  const prompt = buildLessonPlanPrompt({ brief: 'Unit 6 - Les habits, lesson 7 of 7', details: { language: 'auto', subject: 'Français' } });
  assertTrue(prompt.includes('write EVERY field in French'), 'should pin French');
  assertTrue(prompt.includes('Développement de la leçon'), 'should name the French development step');
  assertTrue(prompt.includes("À l'aide de"), 'should give the French objective form');
  assertTrue(!prompt.includes('Greets learners'), 'no English example lines in a French prompt');
});
check('an undecided language is shown both the English and the French official terms', () => {
  const prompt = buildLessonPlanPrompt({ brief: 'unit 6', details: { language: 'auto' } });
  assertTrue(prompt.includes('"Lesson Development"') && prompt.includes('"Développement de la leçon"'), 'both vocabularies');
});
check('a pre-filled "None" is not pinned as a known detail, real needs are', () => {
  assertTrue(!buildLessonPlanPrompt({ brief: 'unit 6', details: { specialNeeds: 'None' } }).includes('- specialNeeds: None'), 'None should not be pinned');
  assertTrue(buildLessonPlanPrompt({ brief: 'unit 6', details: { specialNeeds: 'Low vision: 2' } }).includes('- specialNeeds: Low vision: 2'), 'real needs are pinned');
});
check('asks for a full Lesson Development rather than two or three lines', () => {
  assertTrue(buildLessonPlanPrompt({ brief: 'unit 6', details: {} }).includes('6-8 teacher lines'), 'development depth rule');
});

console.log('\nnormalizePlan() language handling');
check('a French plan falls back to French defaults, and a pre-filled None yields to the model', () => {
  const plan = normalizePlan({ language: 'Français', specialNeeds: 'Aucun', steps: [] }, { specialNeeds: 'None' });
  assertEqual(plan.language, 'French');
  assertEqual(plan.specialNeeds, 'Aucun');
  assertEqual(plan.location, 'Salle de classe');
});
check("the teacher's chosen language wins over the model's echo", () => {
  assertEqual(normalizePlan({ language: 'English', steps: [] }, { language: 'French' }).language, 'French');
});

console.log('\nplannerLanguage');
check('recognises the language names teachers actually type', () => {
  assertEqual(canonicalLanguage('Français'), 'French');
  assertEqual(canonicalLanguage('fr'), 'French');
  assertEqual(canonicalLanguage('Ikinyarwanda'), 'Kinyarwanda');
  assertEqual(canonicalLanguage('auto'), '');
});
check('resolves from the explicit choice, then the subject, then the brief', () => {
  assertEqual(resolveLanguage({ language: 'English', subject: 'Français' }), 'English');
  assertEqual(resolveLanguage({ language: 'auto', subject: 'Français' }), 'French');
  assertEqual(resolveLanguage({ language: 'auto', brief: "Unit 6 - Les habits, lesson 7 of 7: évaluation de l'unité" }), 'French');
  assertEqual(resolveLanguage({ language: 'auto', brief: 'Unit 6 clothes vocabulary, P3 French' }), 'French');
});
check('does not force French onto a lesson that merely mentions France', () => {
  assertEqual(resolveLanguage({ language: 'auto', subject: 'History', brief: 'The French Revolution, S4 History' }), '');
  assertEqual(resolveLanguage({ language: 'auto', brief: 'Introduce fractions to P4 learners' }), '');
});
check('French documents print French headings, including the closing row', () => {
  const L = formLabels({ language: 'Français' });
  assertEqual(L.selfEvaluation, "Évaluation de l'enseignement");
  assertTrue(L.specialNeeds.includes('besoins éducatifs spéciaux'), 'SEN heading should be French');
  assertEqual(formLabels({ subject: 'French' }).lessonPlanTitle, 'PLAN DE LEÇON');
  assertEqual(formLabels({ language: 'English', subject: 'French' }).lessonPlanTitle, 'LESSON PLAN');
});
check('the app-filled "None" and "Classroom" print in the form language; real content does not change', () => {
  const printed = printedPlanDefaults({ language: 'French', specialNeeds: 'None', location: 'Classroom' });
  assertEqual(printed.specialNeeds, 'Aucun');
  assertEqual(printed.location, 'Salle de classe');
  assertEqual(printedPlanDefaults({ language: 'French', specialNeeds: 'Déficience visuelle : 2' }).specialNeeds, 'Déficience visuelle : 2');
});

console.log('\nbuildSchemePrompt()');
check('a French scheme writes its objectives in French', () => {
  const prompt = buildSchemePrompt({ brief: 'Term 3 scheme', details: { language: 'auto', subject: 'Français' }, count: 12 });
  assertTrue(prompt.includes('Les apprenants seront capables de'), 'French objective opener');
  assertTrue(!prompt.includes('Learners will be able to'), 'no English opener in a French scheme');
});

console.log(failures === 0 ? '\nAll lesson-planner builder tests passed.\n' : `\n${failures} test(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
