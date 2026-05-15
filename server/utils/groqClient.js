/**
 * Centralized Groq API client configuration
 * This file ensures consistent API usage across the application
 * and implements caching to improve performance and reduce API costs
 * Uses Groq SDK with JSON mode for reliable structured outputs
 */
const Groq = require('groq-sdk');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// p-queue is an ESM-only package from v8+; we installed v7 (CJS-compatible)
const PQueue = require('p-queue').default || require('p-queue');

// Global queue: max 30 AI requests per 60 seconds (Groq has higher limits)
const aiQueue = new PQueue({ interval: 60000, intervalCap: 30, concurrency: 5 });

// Helper: wait ms milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Simple in-memory cache
const responseCache = new Map();

// Cache directory for persistent caching
const CACHE_DIR = path.join(__dirname, '../cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Created cache directory at ${CACHE_DIR}`);
  } catch (err) {
    console.error(`Failed to create cache directory: ${err.message}`);
  }
}

// Available Groq models with their characteristics
// Updated May 2026 - removed decommissioned models
const GROQ_MODELS = {
  // Best for complex reasoning and grading
  smart: 'llama-3.3-70b-versatile',
  // Fast model for simple tasks
  fast: 'llama-3.1-8b-instant',
  // Balanced model for general use (was llama-3.3-70b-specdec, decommissioned)
  balanced: 'llama-3.3-70b-versatile',
  // Long context model
  longContext: 'mixtral-8x7b-32768',
  // Default model
  default: 'llama-3.3-70b-versatile'
};

// Create a custom configuration for the Groq API client
const createGroqClient = () => {
  // Get API key from environment variables
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error('GROQ_API_KEY is not set in environment variables');
    throw new Error('GROQ_API_KEY is not set in environment variables');
  }

  // Create the Groq client
  const groq = new Groq({ apiKey });

  // Helper function to generate a cache key from request
  const generateCacheKey = (request) => {
    const requestString = JSON.stringify(request);
    return crypto.createHash('md5').update(requestString).digest('hex');
  };

  // Helper function to check if a response is cached
  const getFromCache = (cacheKey) => {
    // First check in-memory cache
    if (responseCache.has(cacheKey)) {
      console.log(`Cache hit for key ${cacheKey} (in-memory)`);
      return responseCache.get(cacheKey);
    }

    // Then check file cache
    const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cachedData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        responseCache.set(cacheKey, cachedData);
        console.log(`Cache hit for key ${cacheKey} (file)`);
        return cachedData;
      } catch (err) {
        console.error(`Error reading cache file: ${err.message}`);
      }
    }

    return null;
  };

  // Helper function to save response to cache
  const saveToCache = (cacheKey, response) => {
    responseCache.set(cacheKey, response);
    const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(response));
      console.log(`Saved response to cache for key ${cacheKey}`);
    } catch (err) {
      console.error(`Error writing to cache file: ${err.message}`);
    }
  };

  /**
   * Get model name based on type
   * @param {string} modelType - Type of model (smart, fast, balanced, longContext)
   * @returns {string} - Model name
   */
  const getModel = (modelType = 'default') => {
    const modelName = GROQ_MODELS[modelType] || GROQ_MODELS.default;
    console.log(`Using Groq model: ${modelName} (type: ${modelType})`);
    return modelName;
  };

  /**
   * Generate content using Groq API with JSON mode for reliable structured outputs
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Options including model type, JSON mode, etc.
   * @returns {Promise<Object>} - The AI response
   */
  const generateContent = async (prompt, options = {}) => {
    // Validate input before queuing
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt provided');
    }

    const cleanPrompt = prompt.trim().replace(/[\x00-\x1F\x7F]/g, '');
    const modelType = options.model || 'default';
    const useJsonMode = options.jsonMode !== false; // Default to true for reliable JSON
    const temperature = options.temperature ?? 0.3; // Lower temperature for more consistent outputs
    const maxTokens = options.maxTokens || 4096;

    return aiQueue.add(async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000; // 2 seconds between retries

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const modelName = getModel(modelType);

          console.log(`Generating content with Groq (prompt length: ${cleanPrompt.length} chars, attempt ${attempt + 1})`);

          // Build the request payload
          const messages = [
            {
              role: 'system',
              content: options.systemPrompt || 'You are a helpful AI assistant specialized in educational assessment and exam grading. Always provide accurate, structured responses.'
            },
            {
              role: 'user',
              content: cleanPrompt
            }
          ];

          const requestPayload = {
            model: modelName,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            top_p: 0.9,
            stream: false
          };

          // Enable JSON mode for reliable structured outputs
          if (useJsonMode) {
            requestPayload.response_format = { type: 'json_object' };
            console.log('JSON mode enabled for structured output');
          }

          // Generate cache key
          const cacheKey = generateCacheKey({ prompt: cleanPrompt, model: modelName, jsonMode: useJsonMode });
          const cachedResponse = getFromCache(cacheKey);
          if (cachedResponse && !options.skipCache) {
            console.log(`Using cached response for request`);
            return cachedResponse;
          }

          // Make the API call with timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Groq API timeout')), 90000);
          });

          const chatCompletion = await Promise.race([
            groq.chat.completions.create(requestPayload),
            timeoutPromise
          ]);

          if (!chatCompletion || !chatCompletion.choices || chatCompletion.choices.length === 0) {
            throw new Error('No response received from Groq API');
          }

          const responseMessage = chatCompletion.choices[0].message;
          let responseText = responseMessage.content;

          if (!responseText || typeof responseText !== 'string' || responseText.length === 0) {
            throw new Error('Invalid text content received from Groq API');
          }

          console.log(`Groq response received (${responseText.length} chars)`);

          // Parse JSON if in JSON mode
          let parsedContent = null;
          if (useJsonMode) {
            try {
              parsedContent = JSON.parse(responseText);
              console.log('Successfully parsed JSON response');
            } catch (parseError) {
              console.warn('Failed to parse JSON response, returning raw text:', parseError.message);
            }
          }

          const result = {
            text: responseText,
            parsedContent: parsedContent,
            usage: chatCompletion.usage || null,
            model: modelName
          };

          // Cache the response
          if (!options.skipCache) {
            saveToCache(cacheKey, result);
          }

          return result;

        } catch (error) {
          console.error(`Error generating content with Groq (attempt ${attempt + 1}):`, error);

          // Check for rate limit errors (429)
          const is429 = error.status === 429 ||
            error.message?.includes('429') ||
            error.message?.includes('rate limit') ||
            error.message?.includes('RateLimitError');

          // Check for timeout errors
          const isTimeout = error.message?.includes('timeout') || error.message?.includes('Groq API timeout');

          if (is429 && attempt < MAX_RETRIES) {
            console.warn(`Groq rate limit hit (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${RETRY_DELAY_MS}ms before retry...`);
            await sleep(RETRY_DELAY_MS * (attempt + 1)); // Exponential backoff
            continue;
          }

          if (isTimeout && attempt < MAX_RETRIES) {
            console.warn(`Groq API timeout (attempt ${attempt + 1}/${MAX_RETRIES}). Waiting ${RETRY_DELAY_MS}ms before retry...`);
            await sleep(RETRY_DELAY_MS * (attempt + 1)); // Exponential backoff
            continue;
          }

          // Preserve 429 status so route handlers can return the right HTTP code
          if (is429) {
            const quotaErr = new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
            quotaErr.status = 429;
            throw quotaErr;
          }

          if (error.message?.includes('timeout')) {
            throw new Error('Groq API request timed out. Please try again.');
          } else if (error.message?.includes('Invalid prompt')) {
            throw new Error('Invalid prompt provided to Groq API.');
          } else {
            throw new Error(`Groq API error: ${error.message}`);
          }
        }
      }
    });
  };

  /**
   * Grade an open-ended answer using Groq API
   * @param {string} question - The question text
   * @param {string} answer - The student's answer
   * @param {string} modelAnswer - The model answer
   * @param {number} maxPoints - Maximum points
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Grading result with score, feedback, etc.
   */
  const gradeAnswer = async (question, answer, modelAnswer, maxPoints, options = {}) => {
    const systemPrompt = `You are an expert exam grader specializing in academic assessment. You grade fairly and generously, always giving students the benefit of the doubt. Recognize semantic equivalence, abbreviations, synonyms, and partial understanding. Always return valid JSON.`;

    const prompt = `
You are an expert exam grader. Please grade the following student answer to a question.

Question: ${question}

${modelAnswer ? `Model Answer: ${modelAnswer}` : ''}

Student Answer: ${answer}

Please grade this answer on a scale of 0 to ${maxPoints} points.

FAIR AND GENEROUS GRADING GUIDELINES:
1. ALWAYS GIVE BENEFIT OF THE DOUBT: If the student's answer shows understanding, award credit
2. RECOGNIZE EQUIVALENT MEANINGS: If the student answer means the same as the model answer, award full points
3. HANDLE ABBREVIATIONS: "WAN" = "WAN (Wide Area Network)" = "Wide Area Network" (all should get full points)
4. ACCEPT SYNONYMS: "CPU" = "Central Processing Unit" = "Processor" = "Central Processor"
5. TECHNICAL TERMS: "RAM" = "Random Access Memory" = "Memory" (in appropriate context)
6. CASE INSENSITIVE: "cpu" = "CPU" = "Cpu" (all equivalent)
7. PARTIAL EXPANSIONS: "Hard disk" = "Hard disk drive" = "HDD" (all correct)
8. PARTIAL CREDIT: If the student includes some correct concepts from the model answer, award partial points (at least 50% if they demonstrate understanding)
9. MINIMUM CREDIT: If the student provides a reasonable attempt that shows some understanding, award at least 20-30% of points
10. TYPING ERRORS: Ignore minor spelling mistakes and typos if the meaning is clear
11. LANGUAGE VARIATIONS: Accept different ways of expressing the same concept

PARTIAL CREDIT EXAMPLES:
- Model: "Plants need water, sunlight, and soil to survive"
- Student: "plants need water and sun" → Award 70-80% (missing soil but shows good understanding)
- Model: "Photosynthesis converts light energy to chemical energy"
- Student: "photosynthesis makes energy from sun" → Award 80-90% (correct concept, simplified explanation)
- Model: "RAM is volatile memory used for temporary storage"
- Student: "RAM stores data temporarily" → Award 70-80% (correct concept, less detail)

Format your response as valid JSON with this exact structure:
{
  "score": [number between 0 and ${maxPoints}],
  "feedback": "[detailed feedback explaining the score, what was good and what could be improved]",
  "correctedAnswer": "[model answer showing the expected response]",
  "keyConceptsPresent": ["concept1", "concept2"],
  "keyConceptsMissing": ["concept3", "concept4"],
  "confidenceLevel": "[high|medium|low]"
}

IMPORTANT: Only return valid JSON, no additional text or explanations outside the JSON.`;

    const response = await generateContent(prompt, {
      systemPrompt,
      model: 'smart',
      jsonMode: true,
      temperature: 0.2,
      maxTokens: 2048
    });

    // Extract parsed content or parse manually
    let grading = response.parsedContent;
    if (!grading && response.text) {
      try {
        // Try to extract JSON from the text
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          grading = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse grading JSON:', e);
      }
    }

    if (!grading) {
      throw new Error('Failed to get valid grading result from Groq API');
    }

    return {
      score: Math.min(Math.max(0, parseFloat(grading.score) || 0), maxPoints),
      feedback: grading.feedback || 'No feedback provided',
      correctedAnswer: grading.correctedAnswer || modelAnswer || 'No corrected answer provided',
      keyConceptsPresent: grading.keyConceptsPresent || [],
      keyConceptsMissing: grading.keyConceptsMissing || [],
      confidenceLevel: grading.confidenceLevel || 'medium',
      aiGraded: true
    };
  };

  return {
    groq,
    getModel,
    generateContent,
    gradeAnswer,
    GROQ_MODELS
  };
};

// Export a singleton instance
const groqClient = createGroqClient();
module.exports = groqClient;
