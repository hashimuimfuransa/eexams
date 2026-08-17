/**
 * Fast, offline unit test for the lesson-planner shaping helpers
 * (server/utils/lessonPlanBuilder.js) — no Groq call, no Express/Mongo, no API key.
 *
 * Covers the three things the route depends on being right:
 *   - a textbook is narrowed to the chapter the teacher actually named
 *   - whatever shape the model returns for activities becomes clean line arrays
 *   - step timings always add up to the lesson duration
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

console.log(failures === 0 ? '\nAll lesson-planner builder tests passed.\n' : `\n${failures} test(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
