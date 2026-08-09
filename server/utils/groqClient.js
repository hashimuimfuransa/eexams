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

const {
  GRADING_SYSTEM_PROMPT,
  buildOpenEndedGradingPrompt,
  reconcileScoreWithCoverage,
  summariseCoverage
} = require('./gradingRubric');

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

    // Clean up the in-flight map when the promise resolves or rejects. `.finally()` returns a
    // NEW promise that adopts requestPromise's rejection - if requestPromise rejects and nothing
    // attaches a handler to what .finally() returns (as was the case here), Node reports THAT
    // derived promise as an unhandled rejection and crashes the process, even though the real
    // requestPromise below is properly awaited/caught by every caller. This only became visible
    // once calls started running several at a time (parallel per-page/per-question extraction) -
    // a bare `.catch(() => {})` on the derived promise silences the harmless duplicate without
    // touching requestPromise's real rejection, which callers still see and handle normally.
    requestPromise.finally(() => {
      if (!options.skipCache) {
        inFlightRequests.delete(cacheKey);
      }
    }).catch(() => {});

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

    // Written answers are graded with the smart model. The fast 8B model cannot hold a rubric -
    // it rewards anything that sounds on-topic, which inflated marks on short answers badly.
    const isShortAnswer = questionType === 'fill-in-blank';
    const modelType = isShortAnswer ? 'fast' : 'smart';

    // Coverage-based rubric shared with the submission-time grader. The score returned here is
    // reconciled against the model's own per-point verdicts below, so it cannot exceed what
    // those verdicts justify.
    const prompt = buildOpenEndedGradingPrompt({
      questionText: question,
      studentAnswer: answer,
      modelAnswer,
      maxPoints,
      questionType,
      section
    }) + `

Also include, alongside the required fields:
  "keyConceptsPresent": ["<concepts the student did cover>"],
  "keyConceptsMissing": ["<concepts the student did not cover>"],
  "confidenceLevel": "high|medium|low"`;

    const response = await generateContent(prompt, {
      systemPrompt: GRADING_SYSTEM_PROMPT,
      model: modelType,
      jsonMode: true,
      temperature: 0.1,
      maxTokens: isShortAnswer ? 768 : 2048
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

    // The model's own point-by-point verdicts cap its self-reported score.
    const reconciled = reconcileScoreWithCoverage(grading, maxPoints, { label: questionType });

    let feedback = grading.feedback || 'No feedback provided';
    if (reconciled.adjusted || reconciled.score < maxPoints) {
      feedback += summariseCoverage(reconciled.keyPoints);
    }

    return {
      score: reconciled.score,
      feedback,
      correctedAnswer: grading.correctedAnswer || modelAnswer || 'No corrected answer provided',
      keyConceptsPresent: grading.keyConceptsPresent || [],
      keyConceptsMissing: grading.keyConceptsMissing || [],
      keyPoints: reconciled.keyPoints,
      coverage: reconciled.coverage,
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
