/**
 * Centralized Gemini API client configuration
 * This file ensures consistent API version settings across the application
 * and implements caching to improve performance and reduce API costs
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { processAIResponse } = require('./responseHandler');

// p-queue is an ESM-only package from v8+; we installed v7 (CJS-compatible)
const PQueue = require('p-queue').default || require('p-queue');

// Global queue: max 10 AI requests per 60 seconds (free-tier safe)
const aiQueue = new PQueue({ interval: 60000, intervalCap: 10, concurrency: 2 });

// Helper: wait ms milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to reconstruct text from character-by-character object
const reconstructTextFromObject = (textObj) => {
  try {
    if (!textObj || typeof textObj !== 'object') {
      throw new Error('Invalid text object provided');
    }

    // Get all numeric keys and sort them
    const keys = Object.keys(textObj)
      .filter(key => !isNaN(parseInt(key)))
      .sort((a, b) => parseInt(a) - parseInt(b));

    if (keys.length === 0) {
      throw new Error('No numeric keys found in text object');
    }

    // Reconstruct the string
    const reconstructedText = keys.map(key => textObj[key]).join('');

    console.log(`Successfully reconstructed text from ${keys.length} character objects`);
    return reconstructedText;
  } catch (reconstructError) {
    console.error('Failed to reconstruct text from object:', reconstructError);
    throw new Error('Invalid response format from Gemini API');
  }
};



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

// Create a custom configuration for the Gemini API client
const createGeminiClient = () => {
  // Get API key from environment variables
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  // Create the client with explicit API version
  // The second parameter is the requestOptions object
  const genAI = new GoogleGenerativeAI(apiKey);

  // Helper function to generate a cache key from request
  const generateCacheKey = (request) => {
    // Create a deterministic string representation of the request
    const requestString = JSON.stringify(request);
    // Create a hash of the request string
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
        // Add to in-memory cache for faster access next time
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
    // Save to in-memory cache
    responseCache.set(cacheKey, response);

    // Save to file cache
    const cacheFilePath = path.join(CACHE_DIR, `${cacheKey}.json`);
    try {
      fs.writeFileSync(cacheFilePath, JSON.stringify(response));
      console.log(`Saved response to cache for key ${cacheKey}`);
    } catch (err) {
      console.error(`Error writing to cache file: ${err.message}`);
    }
  };

  // Create a function to get a model with the correct API version
  const getModel = (modelName = 'gemini-pro') => {
    // Map of model name variations to try - based on Google's documentation
    // gemini-2.0-flash-lite has the highest free-tier RPM quota
    const modelVariations = {
      'gemini-pro': ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      'gemini-1.0-pro': ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      'gemini-1.5-pro': ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      'gemini-1.5-flash': ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      'gemini-2.0-flash-lite': ['gemini-2.0-flash-lite', 'gemini-1.5-flash'],
    };

    // Get the variations to try based on the requested model
    const variationsToTry = modelVariations[modelName] || [modelName, `models/${modelName}`];

    // Log which model we're trying to create
    console.log(`Attempting to create Gemini model with variations of ${modelName} using API version v1beta`);

    // Try the first variation
    const firstVariation = variationsToTry[0];
    console.log(`Using model name: ${firstVariation}`);

    // Use v1beta — routes through global endpoint, not regional (avoids europe-west1 zero-quota)
    const model = genAI.getGenerativeModel({
      model: firstVariation
    }, {
      apiVersion: 'v1beta'
    });

    // Store the other variations to try if the first one fails
    model._alternativeNames = variationsToTry.slice(1);

    // Helper function for exponential backoff
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Wrap the generateContent method to handle fallbacks, retries, and caching
    const originalGenerateContent = model.generateContent.bind(model);
    model.generateContent = async function(request) {
      // Maximum number of retries for rate limit errors
      const MAX_RETRIES = 3;
      let retryCount = 0;
      let lastError = null;

      // Generate cache key for this request
      const cacheKey = generateCacheKey(request);

      // Check if we have a cached response
      const cachedResponse = getFromCache(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached response for request`);
        // Return the cached response in the same format as the API would
        return {
          response: {
            text: () => {
              // Handle cached responses that might be in object format
              if (typeof cachedResponse.text === 'object' && cachedResponse.text !== null) {
                return reconstructTextFromObject(cachedResponse.text);
              }
              return cachedResponse.text;
            },
            candidates: cachedResponse.candidates,
            promptFeedback: cachedResponse.promptFeedback
          }
        };
      }

      // Retry loop with exponential backoff
      while (retryCount <= MAX_RETRIES) {
        try {
          console.log(`Attempting to generate content with model: ${firstVariation}`);
          console.log(`API Version: v1`);
          console.log(`Retry count: ${retryCount}`);

          // Only log the request structure in development, not the full content (to avoid logging sensitive data)
          const requestStructure = {
            ...request,
            contents: request.contents ? `[${request.contents.length} content items]` : undefined
          };
          console.log(`Request structure:`, JSON.stringify(requestStructure, null, 2));

          // Try with the current model name
          const result = await originalGenerateContent(request);

          // Cache the successful response
          try {
            const responseText = processAIResponse(result.response);
            saveToCache(cacheKey, {
              text: responseText,
              candidates: result.response.candidates,
              promptFeedback: result.response.promptFeedback
            });
          } catch (cacheError) {
            console.error(`Error caching response: ${cacheError.message}`);
          }

          return result;
        } catch (error) {
          lastError = error;
          console.error(`Error generating content with model ${firstVariation}:`, error);
          console.error(`Error status: ${error.status}, message: ${error.message}`);

          // On 429 rate limit: fail fast — let the route handler return a clean error
          // Do NOT retry; retrying just stacks more quota-burning requests
          if (error.status === 429) {
            throw error;
          }

          // If we have alternative names to try and this is a 404 or 400 error
          if (model._alternativeNames && model._alternativeNames.length > 0 &&
              (error.status === 404 || error.status === 400)) {
            // Get the next model name to try
            const nextModelName = model._alternativeNames.shift();
            console.log(`Current model failed. Trying alternative: ${nextModelName}`);

            // Create a new model with the alternative name
            const alternativeModel = genAI.getGenerativeModel({
              model: nextModelName
            }, {
              apiVersion: 'v1beta'
            });

            // Try with the alternative model
            try {
              console.log(`Attempting to generate content with alternative model: ${nextModelName}`);
              return await alternativeModel.generateContent(request);
            } catch (altError) {
              console.error(`Error with alternative model ${nextModelName}:`, altError);
              // If we have more alternatives, continue with the loop
              if (model._alternativeNames.length > 0) {
                // Recursively try the next alternative
                return await model.generateContent(request);
              }
              throw altError;
            }
          }

          // Break out of the retry loop for non-retryable errors
          break;
        }
      }

      // If we've exhausted all retries and alternatives, throw the last error
      throw lastError;
    };

    return model;
  };

  // Enhanced generateContent function with queue, 429 retry, and proper status propagation
  const generateContent = async (prompt, options = {}) => {
    // Validate input before queuing
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt provided');
    }

    const cleanPrompt = prompt.trim().replace(/[\x00-\x1F\x7F]/g, '');

    // Enqueue the actual API call so concurrent requests are throttled
    return aiQueue.add(async () => {
      const MAX_429_RETRIES = 3;
      const RETRY_DELAY_MS = 55000; // 55 seconds — safely past Google's 1-minute window

      for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
        try {
          const model = getModel('gemini-2.0-flash-lite');

          console.log(`Generating content with Gemini (prompt length: ${cleanPrompt.length} chars, attempt ${attempt + 1})`);

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Gemini API timeout')), 30000);
          });

          const result = await Promise.race([
            model.generateContent(cleanPrompt),
            timeoutPromise
          ]);

          if (!result || !result.response) {
            throw new Error('No response received from Gemini API');
          }

          const response = result.response;
          const cleanText = processAIResponse(response);

          if (!cleanText || typeof cleanText !== 'string' || cleanText.length === 0) {
            console.error('Failed to extract valid text from response');
            throw new Error('Invalid text content received from Gemini API');
          }

          console.log(`Gemini response received (${cleanText.length} chars)`);

          return {
            text: cleanText,
            response: response,
            usage: response.usageMetadata || null
          };

        } catch (error) {
          const is429 = error.status === 429 ||
            error.message?.includes('429') ||
            error.message?.includes('quota') ||
            error.message?.includes('RESOURCE_EXHAUSTED');

          if (is429 && attempt < MAX_429_RETRIES) {
            console.warn(`Gemini 429 rate limit hit (attempt ${attempt + 1}/${MAX_429_RETRIES}). Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
            await sleep(RETRY_DELAY_MS);
            continue;
          }

          console.error('Error generating content with Gemini:', error);

          // Preserve 429 status so route handlers can return the right HTTP code
          if (is429) {
            const quotaErr = new Error('Gemini API quota exceeded. Please wait a minute and try again.');
            quotaErr.status = 429;
            throw quotaErr;
          }

          if (error.message?.includes('timeout')) {
            throw new Error('Gemini API request timed out. Please try again.');
          } else if (error.message?.includes('safety')) {
            throw new Error('Content was blocked by safety filters.');
          } else if (error.message?.includes('Invalid prompt')) {
            throw new Error('Invalid prompt provided to Gemini API.');
          } else {
            throw new Error(`Gemini API error: ${error.message}`);
          }
        }
      }
    });
  };

  return {
    genAI,
    getModel,
    generateContent
  };
};

// Export a singleton instance
const geminiClient = createGeminiClient();
module.exports = geminiClient;
