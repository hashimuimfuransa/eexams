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
// Increased concurrency to reduce timeout issues
const aiQueue = new PQueue({ interval: 60000, intervalCap: 30, concurrency: 10 });

// Request deduplication map to prevent duplicate in-flight requests
const inFlightRequests = new Map();

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
  default: 'llama-3.3-70b-versatile',
  // Multimodal (vision) model — verified live against this account's /models list
  // (input_modalities includes "image"; llama-4-scout/maverick are NOT available on this
  // account despite being Groq's usual vision models elsewhere — always re-check with
  // `groq.models.list()` before changing this if it 404s again). This is a REASONING model
  // (supported_features includes "reasoning") — it spends completion tokens on internal
  // chain-of-thought before the final JSON, so callers must pass a generous maxTokens or the
  // response gets cut off mid-thought with no JSON at all ("json_validate_failed").
  // If Groq deprecates/renames this, update it here only; every caller that passes
  // options.images picks this up automatically (see generateContent below).
  vision: 'qwen/qwen3.6-27b'
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
    // Images (data: URIs) force the vision model regardless of options.model — the text-only
    // models silently reject/ignore image_url content, so this avoids a caller forgetting to
    // request the right model when attaching a photo/screenshot.
    const images = Array.isArray(options.images) ? options.images.filter(Boolean).slice(0, 3) : [];
    const modelType = images.length > 0 ? 'vision' : (options.model || 'default');
    const useJsonMode = options.jsonMode !== false; // Default to true for reliable JSON
    const temperature = options.temperature ?? 0.3; // Lower temperature for more consistent outputs
    const maxTokens = options.maxTokens || 4096;

    // Generate cache key for deduplication — includes the images so two different photos with
    // the same text prompt never collide on the same cached response.
    const cacheKey = generateCacheKey({ prompt: cleanPrompt, model: getModel(modelType), jsonMode: useJsonMode, images });

    // Check if there's already an identical request in flight
    if (inFlightRequests.has(cacheKey) && !options.skipCache) {
      console.log(`🔄 Request already in flight, waiting for existing promise for key ${cacheKey.substring(0, 8)}...`);
      const existingPromise = inFlightRequests.get(cacheKey);
      // Add timeout to prevent indefinite waiting if the first request hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request deduplication timeout - first request took too long')), 95000);
      });
      return Promise.race([existingPromise, timeoutPromise]);
    }

    // Create the request promise
    const requestPromise = aiQueue.add(async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000; // 2 seconds between retries

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const modelName = getModel(modelType);

          console.log(`Generating content with Groq (prompt length: ${cleanPrompt.length} chars, attempt ${attempt + 1})`);

          // Build the request payload. When images are attached, the user message content
          // becomes a multimodal array (text + one or more image_url parts) per the
          // OpenAI-compatible vision format Groq's vision models expect; otherwise it's the
          // plain string every other caller already relies on.
          const userContent = images.length > 0
            ? [
                { type: 'text', text: cleanPrompt },
                ...images.map((dataUri) => ({ type: 'image_url', image_url: { url: dataUri } }))
              ]
            : cleanPrompt;

          const messages = [
            {
              role: 'system',
              content: options.systemPrompt || 'You are a helpful AI assistant specialized in educational assessment and exam grading. Always provide accurate, structured responses.'
            },
            {
              role: 'user',
              content: userContent
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

          // Check cache first
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

          if (chatCompletion.choices[0].finish_reason === 'length') {
            console.warn(`Groq response was TRUNCATED (hit maxTokens=${maxTokens}) - output is likely incomplete/invalid JSON. Increase options.maxTokens or shorten the prompt/input.`);
          }

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

    // Store the promise in the in-flight map
    if (!options.skipCache) {
      inFlightRequests.set(cacheKey, requestPromise);
    }

    // Clean up the in-flight map when the promise resolves or rejects
    requestPromise.finally(() => {
      if (!options.skipCache) {
        inFlightRequests.delete(cacheKey);
      }
    });

    return requestPromise;
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
    const questionType = options.questionType || 'open-ended';
    const section = options.section || 'A';

    // OPTIMIZED: Use fast model for short-answer, fill-in-blank, and short open-ended answers
    // Use smart model only for long essays (over 200 characters)
    const isShortAnswer = questionType === 'short-answer' || questionType === 'fill-in-blank';
    const isShortOpenEnded = questionType === 'open-ended' && answer && answer.length < 200;
    const modelType = (isShortAnswer || isShortOpenEnded) ? 'fast' : 'smart';

    const systemPrompt = `You are an expert exam grader specializing in academic assessment. You grade fairly and generously, always giving students the benefit of the doubt. Recognize semantic equivalence, abbreviations, synonyms, and partial understanding. Always return valid JSON.`;

    const prompt = `
You are an expert exam grader. Please grade the following student answer to a question.

Question: ${question}
Question Type: ${questionType}
Section: ${section}

${modelAnswer ? `Model Answer: ${modelAnswer}` : ''}

Student Answer: ${answer}

Please grade this answer on a scale of 0 to ${maxPoints} points.

FLEXIBLE GRADING GUIDELINES:
1. USE YOUR UNDERSTANDING: Use your own knowledge to evaluate if the student's answer is correct, not just keyword matching
2. EXACT MATCH: If the student answer exactly matches the model answer (ignoring case/spacing), award full points
3. EQUIVALENT MEANINGS: If the student answer means the same as the model answer, award full points
4. HANDLE ABBREVIATIONS: "WAN" = "WAN (Wide Area Network)" = "Wide Area Network" (all should get full points)
5. ACCEPT SYNONYMS: "CPU" = "Central Processing Unit" = "Processor" = "Central Processor"
6. TECHNICAL TERMS: "RAM" = "Random Access Memory" = "Memory" (in appropriate context)
7. CASE INSENSITIVE: "cpu" = "CPU" = "Cpu" (all equivalent)
8. PARTIAL EXPANSIONS: "Hard disk" = "Hard disk drive" = "HDD" (all correct)
9. AWARD PARTIAL CREDIT: Give partial credit for answers that demonstrate understanding, even if incomplete
10. TYPING ERRORS: Ignore minor spelling mistakes and typos if the meaning is clear
11. LANGUAGE VARIATIONS: Accept different ways of expressing the same concept
12. BE GENEROUS: If the student's answer is factually correct even if it differs from the model answer, award full points
13. AWARD 0 POINTS for meaningless answers like "I don't know", "no idea", "skip", "pass", "don't know it", etc.
14. AWARD 0 POINTS for answers that show no understanding of the question

SPECIAL GUIDELINES FOR NUMERICAL/CALCULATION QUESTIONS:
- EXTRACT NUMERICAL VALUES: If the student shows their work (e.g., "400kg * $1.50 = $600"), extract the final numerical result
- VERIFY FINAL ANSWER: MUST check if the final numerical result matches the model answer exactly
- IGNORE CALCULATION STEPS: Focus on whether the final numerical answer is correct, not the format
- CURRENCY SYMBOLS: "$600" = "600" = "600 dollars" (all equivalent if context is monetary)
- DECIMAL TOLERANCE: Allow small rounding differences (e.g., 3.14 ≈ 3.14159 for π)
- UNIT VARIATIONS: "600 kg" = "600kg" = "600 kilograms" (all equivalent)
- CALCULATION SHOWING WORK: If student shows correct calculation steps but wrong final answer, award 30-50% partial credit
- CORRECT FINAL ANSWER: If the final numerical result is correct regardless of format, award FULL points
- PATTERN RECOGNITION: Look for patterns like "X + Y = Z" or "X * Y = Z" and extract Z as the answer
- IGNORE LABELS: Labels like "Depreciation:", "Answer:", "Total:" should be ignored when comparing numerical values
- CRITICAL: For calculation questions, the FINAL ANSWER MUST BE CORRECT for full points. Correct method with wrong result = partial credit only
-- EXAMPLES:
  * Model: "$600" | Student: "400kg * $1.50 = $600" → FULL POINTS (correct calculation and result)
  * Model: "600" | Student: "The answer is 600" → FULL POINTS (correct numerical value)
  * Model: "$600" | Student: "600 dollars" → FULL POINTS (correct value with different unit format)
  * Model: "600" | Student: "400 * 1.5 = 600" → FULL POINTS (correct calculation shown)
  * Model: "$79,000" | Student: "Depreciation:$54000+$25000 =$79000" → FULL POINTS (correct calculation shown)
  * Model: "$1,040" | Student: "COGS: $1060, Closing inventory: $1160" → 40% PARTIAL CREDIT (correct method shown but wrong final answer)
  * Model: "600" | Student: "400 * 1.5 = 500" → 40% PARTIAL CREDIT (correct method, wrong result)

SPECIAL GUIDELINES FOR OPEN-ENDED/EXPLANATION QUESTIONS:
- For questions asking to "describe" or "explain": Look for key concepts and understanding, not exact wording
- USE YOUR KNOWLEDGE: If the student's answer is factually correct based on your knowledge, award full points even if it differs from the model answer
- EXTRACT BROAD CONCEPTS: Extract 3-5 main concepts from the model answer, NOT individual words
  - Example: For "Provides energy, Helps growth and body building, Protects the body from diseases"
  - Correct concepts: ["energy provision", "growth and body building", "disease protection"]
  - WRONG: ["provides", "energy", "helps", "growth", "body", "building", "protects", "the", "from", "diseases"]
- SEMANTIC EQUIVALENCE: "Help body to grow" = "Helps growth and body building" (SAME CONCEPT)
- SEMANTIC EQUIVALENCE: "Prevent disease" = "Protects the body from diseases" (SAME CONCEPT)
- AWARD FULL POINTS if the student covers all main concepts, even with different wording
- AWARD FULL POINTS if the student's answer is factually correct even if it doesn't match the model answer exactly
- AWARD PARTIAL CREDIT for answers showing correct approach or understanding, even if incomplete
- Award 20-30% if the student shows some understanding or correct approach but answer is very brief
- Award 30-40% only if the student has the right general idea but missing most details
- Award 50-60% if the student has the right general idea but missing some details
- Award 60-70% if the student understands the concept well but uses different words
- Award 80-90% if the student understands the concept well but uses different words
- Award full points if the student demonstrates complete understanding, even if phrasing differs from model answer
- NEVER award 0 points if the student shows any understanding or correct approach - always give partial credit

FLEXIBLE PARTIAL CREDIT EXAMPLES:
- Model: "Plants need water, sunlight, and soil to survive"
- Student: "plants need water and sun" → Award 60-70% (missing soil but shows some understanding)
- Model: "Photosynthesis converts light energy to chemical energy"
- Student: "photosynthesis makes energy from sun" → Award 70-80% (correct concept, simplified explanation)
- Model: "RAM is volatile memory used for temporary storage"
- Student: "RAM stores data temporarily" → Award 70-80% (correct concept, less detail)
- Model: "Describe the water cycle: evaporation, condensation, precipitation"
- Student: "water evaporates, forms clouds, falls as rain" → Award 85-90% (correct understanding, different wording)
- Model: "Explain adaptation: traits that help organisms survive in their environment"
- Student: "adaptation is when animals change to survive" → Award 75-80% (correct concept, simplified)
- Model: "Provides energy, Helps growth and body building, Protects the body from diseases"
- Student: "Help body to grow Prevent disease" → Award 66-75% (covers 2 of 3 main concepts with different wording, factually correct)
- Model: "Give three uses of food in the human body"
- Student: "energy, growth, disease prevention" → Award FULL POINTS (factually correct answer, concise but complete)

IMPORTANT FOR SECTIONS B & C:
- These sections often have open-ended questions requiring explanations
- Be FLEXIBLE with grading - award partial credit for demonstrated understanding
- Answers must demonstrate actual understanding of the question
- Very short answers (under 10 characters) or irrelevant answers should receive 0 points
- Mathematical expressions without explanation for non-math questions should receive 0 points

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
      model: modelType,
      jsonMode: true,
      temperature: 0.2,
      maxTokens: isShortAnswer ? 512 : 2048
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
