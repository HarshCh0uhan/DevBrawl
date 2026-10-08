import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Model configurations for different use cases
export const GROQ_MODELS = {
  SCORING: 'llama-3.1-70b-versatile',      // Best for code analysis/scoring
  QUESTION_GEN: 'llama-3.1-70b-versatile', // Best for structured JSON generation
  FAST: 'llama-3.1-8b-instant',            // Ultra-fast for simple tasks
};

/**
 * Generate structured JSON response using Groq
 * @param {Object} params
 * @param {string} params.systemPrompt - System instruction
 * @param {string} params.userPrompt - User prompt
 * @param {Object} params.schema - JSON schema for response validation
 * @param {string} params.model - Model to use (default: SCORING)
 * @param {number} params.temperature - Temperature (default: 0.1)
 * @returns {Promise<Object>} Parsed JSON response
 */
export const generateStructuredJSON = async ({
  systemPrompt,
  userPrompt,
  schema,
  model = GROQ_MODELS.SCORING,
  temperature = 0.1,
}) => {
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    response_format: { type: 'json_object' },
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse JSON from Groq: ${e.message}`);
  }

  // Validate against schema (basic validation)
  if (schema) {
    const validate = (obj, schema) => {
      if (schema.type === 'OBJECT') {
        for (const [key, prop] of Object.entries(schema.properties || {})) {
          if (schema.required?.includes(key) && !(key in obj)) {
            throw new Error(`Missing required field: ${key}`);
          }
          if (key in obj && prop.type) {
            const expectedType = prop.type.toLowerCase();
            const actualType = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
            if (expectedType !== actualType && !(expectedType === 'integer' && actualType === 'number')) {
              throw new Error(`Field ${key}: expected ${expectedType}, got ${actualType}`);
            }
          }
        }
      }
    };
    validate(parsed, schema);
  }

  return parsed;
};

/**
 * Simple text generation (non-structured)
 */
export const generateText = async ({
  systemPrompt,
  userPrompt,
  model = GROQ_MODELS.FAST,
  temperature = 0.3,
  maxTokens = 1000,
}) => {
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content || '';
};

/**
 * Check if Groq is available/configured
 */
export const isGroqAvailable = () => !!process.env.GROQ_API_KEY;