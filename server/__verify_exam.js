require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('./models/Exam');
const Question = require('./models/Question');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const examId = process.argv[2];
  const exam = await Exam.findById(examId);
  console.log('Exam:', exam.title);
  console.log('allowSelectiveAnswering:', exam.allowSelectiveAnswering, '| sectionBRequiredQuestions:', exam.sectionBRequiredQuestions, '| sectionCRequiredQuestions:', exam.sectionCRequiredQuestions);
  let totalPoints = 0;
  for (const section of exam.sections) {
    console.log(`\n--- Section ${section.name} (${section.questions.length} questions): "${(section.description||'').substring(0,100)}" ---`);
    const questions = await Question.find({ _id: { $in: section.questions } });
    for (const q of questions) {
      totalPoints += q.points || 0;
      console.log(`[${q.type}] ${q.points}pt ${q.imageUrl ? '[IMG]' : ''}: ${(q.text||'').substring(0,70)}`);
      if (q.passage) console.log('  passage:', q.passage.substring(0, 100).replace(/\n/g,' | '));
      if (q.type === 'financial-spreadsheet') {
        console.log('  spreadsheetTemplate present:', !!q.spreadsheetTemplate, '| spreadsheetModelAnswer present:', !!q.spreadsheetModelAnswer);
      }
      if (q.subQuestions && q.subQuestions.length) {
        q.subQuestions.forEach(sq => console.log(`    - ${sq.label} (${sq.points}pt, ${sq.type}): ${(sq.text||'').substring(0,60)}`));
      }
    }
  }
  console.log('\nTotal points:', totalPoints);
  await mongoose.disconnect();
})();
