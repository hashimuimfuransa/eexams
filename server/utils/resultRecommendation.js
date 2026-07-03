// Generates a personalized, AI-written "what to focus on" recommendation for
// a completed exam result. Called lazily on first detail-view fetch and
// cached on the Result document (see studentController.getDetailedResult),
// so it only costs one AI call per result, ever.
const groqClient = require('./groqClient');

const VALID_TONES = ['success', 'warning', 'error'];

const truncate = (str, max) => {
  if (!str) return '';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '…' : s;
};

// Builds a compact, information-dense summary of the result for the prompt —
// full answers would blow the context window on long exams, so we only send
// the weakest answers in detail and summarize the rest as counts.
const buildResultSummary = (result, examTitle) => {
  const answers = result.answers || [];
  const totalQ = answers.length;
  const correctQ = answers.filter(a => a.isCorrect).length;
  const percentage = result.maxPossibleScore > 0
    ? Math.round((result.totalScore / result.maxPossibleScore) * 100)
    : 0;

  const sectionMap = {};
  answers.forEach(a => {
    const sectionName = String(a.question?.section || 'A');
    if (!sectionMap[sectionName]) sectionMap[sectionName] = { correct: 0, total: 0 };
    sectionMap[sectionName].total += 1;
    if (a.isCorrect) sectionMap[sectionName].correct += 1;
  });
  const sections = Object.entries(sectionMap).map(([name, s]) => ({
    name, correct: s.correct, total: s.total,
    pct: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
  }));

  // Rank weakest answers first (lowest score ratio), cap at 20 to bound prompt size
  const ranked = answers
    .map((a, idx) => {
      const points = a.question?.points || 1;
      const ratio = points > 0 ? (a.score || 0) / points : (a.isCorrect ? 1 : 0);
      return { a, idx, ratio };
    })
    .sort((x, y) => x.ratio - y.ratio)
    .slice(0, 20);

  const weakAnswers = ranked.map(({ a, idx }) => {
    const points = a.question?.points || 1;
    const notAnswered = !a.selectedOption && !a.textAnswer &&
      (!a.matchingAnswers || a.matchingAnswers.length === 0) &&
      (!a.subQuestionAnswers || a.subQuestionAnswers.length === 0);
    return {
      q: idx + 1,
      section: String(a.question?.section || 'A'),
      type: a.question?.type || 'unknown',
      questionText: truncate(a.question?.text, 150),
      correct: !!a.isCorrect,
      notAnswered,
      score: `${a.score ?? 0}/${points}`,
      conceptsMissing: (a.conceptsMissing || []).slice(0, 5),
      technicalAccuracy: truncate(a.technicalAccuracy, 150),
      feedback: truncate(a.feedback, 200)
    };
  });

  return {
    examTitle: examTitle || 'Exam',
    percentage,
    passed: percentage >= 70,
    totalQ,
    correctQ,
    sections,
    weakAnswers
  };
};

/**
 * Generate an AI-written overall recommendation for a completed exam result.
 * Returns null (never throws) if the AI call fails or times out — callers
 * should fall back to a heuristic or simply omit the recommendation.
 * @param {Object} result - Lean Result document with populated `answers.question` and `exam`
 * @param {number} timeoutMs - Max time to wait for the AI response
 * @returns {Promise<Object|null>}
 */
const generateOverallRecommendation = async (result, timeoutMs = 12000) => {
  try {
    const summary = buildResultSummary(result, result.exam?.title);

    const prompt = `You are an expert, encouraging exam tutor. A student just completed an exam. Based on their actual performance data below, write a short, ACCURATE, personalized recommendation for what they should focus on to improve — grounded specifically in the concepts and questions they actually got wrong, not generic advice.

Exam: ${summary.examTitle}
Overall Score: ${summary.correctQ}/${summary.totalQ} questions correct, ${summary.percentage}% (${summary.passed ? 'PASSED' : 'FAILED'})

Section breakdown:
${summary.sections.map(s => `- Section ${s.name}: ${s.correct}/${s.total} correct (${s.pct}%)`).join('\n')}

Weakest answers (lowest-scoring first, out of ${summary.totalQ} total questions):
${summary.weakAnswers.map(w => `Q${w.q} [Section ${w.section}, ${w.type}, score ${w.score}]: "${w.questionText}"${w.notAnswered ? ' — NOT ANSWERED' : w.correct ? ' — correct' : ' — incorrect'}${w.conceptsMissing.length ? `; missing concepts: ${w.conceptsMissing.join(', ')}` : ''}${w.technicalAccuracy ? `; technical note: ${w.technicalAccuracy}` : ''}${w.feedback ? `; grader feedback: ${w.feedback}` : ''}`).join('\n')}

Return ONLY valid JSON in this exact shape:
{
  "headline": "1-2 sentence honest, encouraging summary of how they did and what matters most right now (reference the actual exam/topic, not generic phrases)",
  "tone": "success" | "warning" | "error",
  "focusAreas": [{"name": "just the section letter, e.g. A (do NOT include the word 'Section')", "pct": number}] (only sections that are genuinely weak, omit if none stand out, max 3),
  "topConcepts": ["specific concept or topic they should review"] (grounded in the missing concepts / wrong answers above, max 5, omit generic filler),
  "tips": ["specific, actionable next step"] (3-5 tips, each referencing something concrete from their actual answers — e.g. a topic, question type, or pattern of mistakes — not generic study advice like 'study more')
}

Rules: tone must be "success" if percentage >= 70, "warning" if 50-69, "error" if below 50. Keep every string concise (under 200 characters). Base everything strictly on the data given — do not invent concepts not implied by the answers.`;

    const aiPromise = groqClient.generateContent(prompt, {
      model: 'smart',
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 1024
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Recommendation generation timed out')), timeoutMs);
    });

    const response = await Promise.race([aiPromise, timeoutPromise]);
    const parsed = response.parsedContent || JSON.parse(response.text.replace(/```json\n?|\n?```/g, '').trim());

    if (!parsed || typeof parsed.headline !== 'string' || !parsed.headline.trim()) {
      throw new Error('AI response missing headline');
    }

    const tone = VALID_TONES.includes(parsed.tone) ? parsed.tone
      : summary.percentage >= 70 ? 'success' : summary.percentage >= 50 ? 'warning' : 'error';

    return {
      headline: truncate(parsed.headline, 400),
      tone,
      // Model sometimes returns "Section A" instead of just "A" — strip any
      // leading "Section" so the frontend's own "Section {name}" label
      // doesn't end up reading "Section Section A".
      focusAreas: Array.isArray(parsed.focusAreas)
        ? parsed.focusAreas
            .filter(f => f && f.name)
            .slice(0, 3)
            .map(f => ({ name: String(f.name).replace(/^section\s*/i, '').trim() || String(f.name), pct: Number(f.pct) || 0 }))
        : [],
      topConcepts: Array.isArray(parsed.topConcepts)
        ? parsed.topConcepts.filter(Boolean).slice(0, 5).map(c => truncate(c, 120))
        : [],
      tips: Array.isArray(parsed.tips)
        ? parsed.tips.filter(Boolean).slice(0, 5).map(t => truncate(t, 300))
        : [],
      generatedAt: new Date()
    };
  } catch (error) {
    console.error('generateOverallRecommendation failed:', error.message);
    return null;
  }
};

module.exports = { generateOverallRecommendation };
