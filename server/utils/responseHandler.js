/**
 * Utility functions for handling malformed AI responses
 * Specifically designed to handle character-by-character object responses from Gemini API
 */

/**
 * Safely extract and reconstruct text from various response formats
 * @param {any} input - The input that might be a string, object, or other format
 * @returns {string} - The reconstructed text
 */
const safeTextExtraction = (input) => {
  try {
    // If it's already a string, return it
    if (typeof input === 'string') {
      return input;
    }

    // If it's null or undefined, return empty string
    if (input === null || input === undefined) {
      return '';
    }

    // If it's an object, try to reconstruct it
    if (typeof input === 'object') {
      return reconstructFromObject(input);
    }

    // For any other type, convert to string
    return String(input);
  } catch (error) {
    console.error('Error in safeTextExtraction:', error);
    return '';
  }
};

/**
 * Reconstruct text from character-by-character object format
 * @param {object} obj - Object with numeric keys containing characters
 * @returns {string} - Reconstructed text
 */
const reconstructFromObject = (obj) => {
  try {
    if (!obj || typeof obj !== 'object') {
      return '';
    }

    // Check if this looks like a character-by-character object
    const keys = Object.keys(obj);
    const numericKeys = keys.filter(key => !isNaN(parseInt(key)));
    
    // If we have numeric keys, assume it's character-by-character format
    if (numericKeys.length > 0) {
      // Sort keys numerically
      const sortedKeys = numericKeys.sort((a, b) => parseInt(a) - parseInt(b));
      
      // Reconstruct the string
      const reconstructed = sortedKeys.map(key => obj[key]).join('');
      
      console.log(`Reconstructed text from ${sortedKeys.length} character objects`);
      return reconstructed;
    }

    // If it's not character-by-character format, try JSON.stringify as fallback
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Error reconstructing from object:', error);
    return '';
  }
};

/**
 * Process AI response with multiple fallback strategies
 * @param {any} response - The AI response in any format
 * @returns {string} - Clean, usable text
 */
const processAIResponse = (response) => {
  try {
    let text = '';

    // Strategy 1: Direct text extraction
    if (response && typeof response.text === 'function') {
      try {
        text = response.text();
      } catch (textError) {
        console.warn('Direct text() method failed:', textError.message);
      }
    }

    // Strategy 2: Check if response itself is the text
    if (!text && typeof response === 'string') {
      text = response;
    }

    // Strategy 3: Check candidates array
    if (!text && response && response.candidates && Array.isArray(response.candidates)) {
      for (const candidate of response.candidates) {
        if (candidate.content && candidate.content.parts && Array.isArray(candidate.content.parts)) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              text = part.text;
              break;
            }
          }
          if (text) break;
        }
      }
    }

    // Strategy 4: Apply safe text extraction to whatever we found
    text = safeTextExtraction(text);

    // Clean the text
    if (text) {
      // Remove control characters and extra whitespace
      text = text.replace(/[\x00-\x1F\x7F]/g, '').trim();
      
      // Remove common markdown formatting that might interfere
      text = text.replace(/```json\s*|\s*```/g, '').trim();
    }

    return text;
  } catch (error) {
    console.error('Error processing AI response:', error);
    return '';
  }
};

/**
 * Validate and clean AI response for JSON parsing
 * @param {string} text - The text to validate and clean
 * @returns {object} - Object with success flag and cleaned text or error
 */
const validateForJSON = (text) => {
  try {
    if (!text || typeof text !== 'string') {
      return {
        success: false,
        error: 'Invalid text input for JSON validation',
        text: ''
      };
    }

    // Clean the text
    let cleanText = text.trim();
    
    // Remove markdown code blocks
    cleanText = cleanText.replace(/```json\s*|\s*```/g, '');
    
    // Find JSON boundaries
    const jsonStart = cleanText.indexOf('{');
    const jsonEnd = cleanText.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === 0) {
      return {
        success: false,
        error: 'No JSON object found in text',
        text: cleanText
      };
    }
    
    // Extract JSON portion
    const jsonText = cleanText.substring(jsonStart, jsonEnd);
    
    // Try to parse to validate
    try {
      JSON.parse(jsonText);
      return {
        success: true,
        text: jsonText,
        originalText: text
      };
    } catch (parseError) {
      return {
        success: false,
        error: `JSON parse error: ${parseError.message}`,
        text: jsonText,
        originalText: text
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Validation error: ${error.message}`,
      text: text || ''
    };
  }
};

module.exports = {
  safeTextExtraction,
  reconstructFromObject,
  processAIResponse,
  validateForJSON
};
