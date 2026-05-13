/**
 * AI Service for interacting with Google's Gemini API
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Google Generative AI with the API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate content using Google's Gemini API
 * @param {string} prompt - The prompt to send to the AI
 * @returns {Promise<Object>} - The AI response
 */
const generateContent = async (prompt) => {
  try {
    console.log(`Sending prompt to Gemini AI: ${prompt.substring(0, 100)}...`);
    
    // Use gemini-1.5-flash only — legacy gemini-pro has 0 quota in many regions
    const modelNames = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let lastError = null;
    for (const modelName of modelNames) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          console.log(`Attempting generation with model: ${modelName} (attempt ${attempt + 1})`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const response = await model.generateContent(prompt);
          const result = response.response;
          console.log(`Received response from Gemini AI (${modelName})`);
          return { text: result.text(), model: modelName };
        } catch (err) {
          lastError = err;
          const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('quota');
          if (is429 && attempt < 2) {
            const delay = (attempt + 1) * 3000;
            console.log(`Rate limit on ${modelName}, retrying in ${delay}ms...`);
            await sleep(delay);
          } else {
            console.error(`Error with model ${modelName} attempt ${attempt + 1}:`, err.message);
            break;
          }
        }
      }
    }

    throw lastError || new Error('All Gemini models failed');
  } catch (error) {
    console.error('Error generating content with Gemini AI:', error);
    throw error;
  }
};

/**
 * Grade an open-ended answer using Google's Gemini API
 * @param {string} question - The question text
 * @param {string} answer - The student's answer
 * @param {string} modelAnswer - The model answer (if available)
 * @param {number} maxPoints - The maximum points for this question
 * @returns {Promise<Object>} - The grading result
 */
const gradeOpenEndedAnswer = async (question, answer, modelAnswer, maxPoints) => {
  try {
    // Create a prompt for the AI
    const prompt = `
You are an expert exam grader. Please grade the following student answer to a question.

Question: ${question}

${modelAnswer ? `Model Answer: ${modelAnswer}` : ''}

Student Answer: ${answer}

Please grade this answer on a scale of 0 to ${maxPoints} points.
Provide detailed feedback explaining what was good and what could be improved.
Also provide a corrected or model answer that shows how the student should have answered.

Format your response as follows:
Score: [number]
Feedback: [detailed feedback]
Corrected Answer: [model answer]
`;

    // Generate content with the AI
    const response = await generateContent(prompt);
    
    if (!response || !response.text) {
      throw new Error('No response from AI');
    }
    
    // Parse the response to extract the score, feedback, and corrected answer
    const scoreMatch = response.text.match(/Score:\s*(\d+(?:\.\d+)?)/i);
    const feedbackMatch = response.text.match(/Feedback:\s*([\s\S]*?)(?=Corrected Answer:|$)/i);
    const correctedAnswerMatch = response.text.match(/Corrected Answer:\s*([\s\S]*?)(?=$)/i);
    
    const score = scoreMatch ? Math.min(parseFloat(scoreMatch[1]), maxPoints) : 0;
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 'No feedback provided';
    const correctedAnswer = correctedAnswerMatch ? correctedAnswerMatch[1].trim() : 'No corrected answer provided';
    
    return {
      score,
      feedback,
      correctedAnswer
    };
  } catch (error) {
    console.error('Error grading open-ended answer with Gemini AI:', error);
    throw error;
  }
};

module.exports = {
  generateContent,
  gradeOpenEndedAnswer
};
