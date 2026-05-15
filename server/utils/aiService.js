/**
 * AI Service for interacting with Groq API
 * Provides fast, reliable AI responses with JSON mode support
 */
const groqClient = require('./groqClient');

/**
 * Generate content using Groq API
 * @param {string} prompt - The prompt to send to the AI
 * @param {Object} options - Additional options (model, jsonMode, temperature, etc.)
 * @returns {Promise<Object>} - The AI response
 */
const generateContent = async (prompt, options = {}) => {
  try {
    console.log(`Sending prompt to Groq AI: ${prompt.substring(0, 100)}...`);

    const response = await groqClient.generateContent(prompt, {
      model: options.model || 'balanced',
      jsonMode: options.jsonMode || false,
      temperature: options.temperature || 0.3,
      maxTokens: options.maxTokens || 4096,
      systemPrompt: options.systemPrompt
    });

    console.log(`Received response from Groq AI (${response.model})`);
    return {
      text: response.text,
      parsedContent: response.parsedContent,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    console.error('Error generating content with Groq AI:', error);
    throw error;
  }
};

/**
 * Grade an open-ended answer using Groq API
 * @param {string} question - The question text
 * @param {string} answer - The student's answer
 * @param {string} modelAnswer - The model answer (if available)
 * @param {number} maxPoints - The maximum points for this question
 * @param {string} questionType - Type of question (multiple-choice, open-ended, etc.)
 * @param {string} section - Section identifier (A, B, C)
 * @returns {Promise<Object>} - The grading result
 */
const gradeOpenEndedAnswer = async (question, answer, modelAnswer, maxPoints, questionType = 'open-ended', section = 'B') => {
  try {
    console.log(`Grading open-ended answer with Groq AI (section ${section}, type: ${questionType})...`);

    // Use the dedicated grading function from groqClient
    const result = await groqClient.gradeAnswer(question, answer, modelAnswer, maxPoints, {
      questionType,
      section
    });

    return {
      score: result.score,
      feedback: result.feedback,
      correctedAnswer: result.correctedAnswer,
      details: {
        keyConceptsPresent: result.keyConceptsPresent,
        keyConceptsMissing: result.keyConceptsMissing,
        confidenceLevel: result.confidenceLevel,
        aiGraded: result.aiGraded,
        questionType,
        gradingMethod: 'groq_ai'
      }
    };
  } catch (error) {
    console.error('Error grading open-ended answer with Groq AI:', error);
    // Return a fallback score
    return {
      score: 0,
      feedback: `Error during AI grading: ${error.message}. Please review manually.`,
      correctedAnswer: modelAnswer || 'No model answer available',
      details: {
        error: error.message,
        gradingMethod: 'groq_error_fallback',
        questionType
      }
    };
  }
};

module.exports = {
  generateContent,
  gradeOpenEndedAnswer,
  groqClient
};
