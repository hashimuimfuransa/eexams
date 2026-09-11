const Exam = require('../models/Exam');

// Every exam session (Result) needs an answer entry for each exam question: saving an answer only
// updates an existing entry, and grading totals the maximum score from them. A session created
// without them - the shared-link join created one with none, and a session started before the
// teacher added questions lacks the new ones - rejects saves with "Answer not found in result"
// and submission with "No answers found".

/**
 * Answer entries for the exam questions a result doesn't have yet, selected the way startExam
 * selects them.
 * @param {Object} result - Result document; answers.question and exam may be populated
 * @returns {Promise<Object[]>} Entries to add to result.answers (empty when none are missing)
 */
const missingAnswerSlots = async (result) => {
  const exam = await Exam.findById(result.exam?._id || result.exam)
    .select('sections allowSelectiveAnswering sectionBRequiredQuestions sectionCRequiredQuestions')
    .populate({ path: 'sections.questions', select: 'section' });

  if (!exam) return [];

  const questions = exam.sections.flatMap(section => section.questions || []);
  const present = new Set(result.answers.map(answer => String(answer.question?._id || answer.question)));

  // With selective answering on, the first N questions (by id) of sections B and C are selected
  // and the rest are optional; every other question counts.
  const idsBySection = {};
  questions.forEach(question => {
    const section = question.section || 'A';
    (idsBySection[section] = idsBySection[section] || []).push(String(question._id));
  });
  Object.values(idsBySection).forEach(ids => ids.sort((a, b) => a.localeCompare(b)));

  const slots = [];
  questions.forEach(question => {
    const id = String(question._id);
    if (present.has(id)) return;
    present.add(id);

    let isSelected = true;
    if (exam.allowSelectiveAnswering && (question.section === 'B' || question.section === 'C')) {
      const requiredCount = question.section === 'B'
        ? (exam.sectionBRequiredQuestions || 3)
        : (exam.sectionCRequiredQuestions || 1);
      isSelected = idsBySection[question.section].indexOf(id) < requiredCount;
    }

    slots.push({ question: question._id, score: 0, isSelected });
  });

  return slots;
};

/**
 * Adds the missing answer entries to an unpopulated result. The caller saves it.
 * @param {Object} result - Result document
 * @returns {Promise<number>} How many entries were added
 */
const ensureAnswerSlots = async (result) => {
  const slots = await missingAnswerSlots(result);
  slots.forEach(slot => result.answers.push(slot));
  return slots.length;
};

module.exports = { missingAnswerSlots, ensureAnswerSlots };
