import fetch from 'node-fetch';

// OpenRouter configuration for Nemotron 3 Nano Omni (free)
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Correct free model name from OpenRouter catalog
const NEMOTRON_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'; // Nemotron 3 Nano Omni (free)

export const OPENROUTER_MODELS = {
  PRIMARY: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  BACKUP: 'nvidia/nemotron-3-ultra-550b-a55b:free', // Fallback to Ultra if Nano fails
};

/**
 * Generate structured JSON response using OpenRouter (Nemotron 3 Nano Omni)
 * @param {Object} params
 * @param {string} params.systemPrompt - System instruction
 * @param {string} params.userPrompt - User prompt
 * @param {Object} params.schema - JSON schema for response validation (optional)
 * @param {string} params.model - Model to use (default: Nemotron 3 Ultra free)
 * @param {number} params.temperature - Temperature (default: 0.1)
 * @returns {Promise<Object>} Parsed JSON response
 */
export const generateStructuredJSON = async ({
  systemPrompt,
  userPrompt,
  schema,
  model = OPENROUTER_MODELS.PRIMARY,
  temperature = 0.1,
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://devbrawl.local',
      'X-Title': 'DevBrawl',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) throw new Error('Empty response from OpenRouter');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to parse JSON from OpenRouter: ${e.message}`);
  }

  // Normalize to Mongoose schema (same as Groq)
  if (schema) {
    parsed = normalizeToMongooseSchema(parsed, schema);
  }

  console.log(`✅ OpenRouter success with model: ${model}`);
  return parsed;
};

/**
 * Normalize OpenRouter response to EXACT Mongoose question schema
 * (Same normalization logic as Groq for consistency)
 */
function normalizeToMongooseSchema(parsed, schema) {
  const normalized = { ...parsed };
  
  // 1. Map common field name variations
  const fieldMappings = {
    'prompt': 'promptLines',
    'prompt_lines': 'promptLines',
    'prompts': 'promptLines',
    'description': 'promptLines',
    'problem': 'promptLines',
    'question': 'promptLines',
    'problem_statement': 'promptLines',
    
    'constraints': 'constraintsLines',
    'constraint_lines': 'constraintsLines',
    'constraints_list': 'constraintsLines',
    'rules': 'constraintsLines',
    'requirements': 'constraintsLines',
    'limitations': 'constraintsLines',
    
    'test_cases': 'testCases',
    'tests': 'testCases',
    'cases': 'testCases',
    'testcases': 'testCases',
  };

  for (const [sourceKey, targetKey] of Object.entries(fieldMappings)) {
    if (sourceKey in normalized && !(targetKey in normalized)) {
      normalized[targetKey] = normalized[sourceKey];
      console.log(`🔄 OpenRouter mapped field: ${sourceKey} → ${targetKey}`);
    }
  }

  // 2. Ensure promptLines is array of strings
  if (normalized.promptLines) {
    if (!Array.isArray(normalized.promptLines)) {
      normalized.promptLines = [String(normalized.promptLines)];
    }
    normalized.promptLines = normalized.promptLines.map(String).filter(Boolean);
  }
  
  // 3. Ensure constraintsLines is array of strings
  if (normalized.constraintsLines) {
    if (!Array.isArray(normalized.constraintsLines)) {
      normalized.constraintsLines = [String(normalized.constraintsLines)];
    }
    normalized.constraintsLines = normalized.constraintsLines.map(String).filter(Boolean);
  }

  // 4. CRITICAL: Ensure testCases array with EXACT Mongoose schema fields
  if (normalized.testCases && Array.isArray(normalized.testCases)) {
    normalized.testCases = normalized.testCases.map((tc, idx) => {
      const testCase = { ...tc };
      
      // Map input variations
      if (!('input' in testCase)) {
        if ('stdin' in testCase) testCase.input = testCase.stdin;
        else if ('input_data' in testCase) testCase.input = testCase.input_data;
        else if ('test_input' in testCase) testCase.input = testCase.test_input;
      }
      
      // Map expectedOutput variations
      if (!('expectedOutput' in testCase)) {
        if ('output' in testCase) testCase.expectedOutput = testCase.output;
        else if ('expected_output' in testCase) testCase.expectedOutput = testCase.expected_output;
        else if ('stdout' in testCase) testCase.expectedOutput = testCase.stdout;
        else if ('answer' in testCase) testCase.expectedOutput = testCase.answer;
        else if ('result' in testCase) testCase.expectedOutput = testCase.result;
      }
      
      // Ensure required fields exist
      testCase.input = String(testCase.input || `test_input_${idx + 1}`);
      testCase.expectedOutput = String(testCase.expectedOutput || `expected_output_${idx + 1}`);
      testCase.isHidden = Boolean(testCase.isHidden ?? (idx >= 2));
      testCase.weight = Number(testCase.weight ?? 1);
      
      // REMOVE extra fields not in Mongoose schema
      delete testCase.output;
      delete testCase.stdout;
      delete testCase.answer;
      delete testCase.result;
      delete testCase.stdin;
      delete testCase.input_data;
      delete testCase.test_input;
      delete testCase.expected_output;
      
      return testCase;
    });
  } else {
    // Generate default test cases if missing
    normalized.testCases = [
      { input: '1 2', expectedOutput: '3', isHidden: false, weight: 1 },
      { input: '5 10', expectedOutput: '15', isHidden: false, weight: 1 },
      { input: '-1 1', expectedOutput: '0', isHidden: true, weight: 1 },
      { input: '0 0', expectedOutput: '0', isHidden: true, weight: 1 },
      { input: '100 200', expectedOutput: '300', isHidden: true, weight: 1 },
    ];
  }

  // 5. Ensure required top-level fields
  if (!normalized.topic) normalized.topic = 'General Programming';
  if (!normalized.title) normalized.title = 'Untitled Problem';
  if (!normalized.promptLines || normalized.promptLines.length === 0) {
    normalized.promptLines = ['Solve this programming problem.'];
  }
  if (!normalized.constraintsLines || normalized.constraintsLines.length === 0) {
    normalized.constraintsLines = ['Standard input/output constraints apply.'];
  }
  if (!normalized.timeLimitMs) normalized.timeLimitMs = 10000;

  // 6. Ensure difficulty is valid enum
  if (normalized.difficulty && !['easy', 'medium', 'hard'].includes(normalized.difficulty)) {
    normalized.difficulty = 'medium';
  } else if (!normalized.difficulty) {
    normalized.difficulty = 'medium';
  }

  // 7. Remove any extra fields not in Mongoose schema
  const allowedFields = [
    'title', 'promptLines', 'constraintsLines', 'timeLimitMs', 'testCases',
    'topic', 'difficulty', 'generatedBy'
  ];
  
  Object.keys(normalized).forEach(key => {
    if (!allowedFields.includes(key)) {
      console.log(`🗑️ OpenRouter removing extra field: ${key}`);
      delete normalized[key];
    }
  });

  return normalized;
}

/**
 * Simple text generation (non-structured)
 */
export const generateText = async ({
  systemPrompt,
  userPrompt,
  model = OPENROUTER_MODELS.PRIMARY,
  temperature = 0.3,
  maxTokens = 1000,
}) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://devbrawl.local',
      'X-Title': 'DevBrawl',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

/**
 * Check if OpenRouter is available/configured
 */
export const isOpenRouterAvailable = () => !!process.env.OPENROUTER_API_KEY;

/**
 * List available models for debugging
 */
export const listAvailableModels = async () => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    const data = await response.json();
    return data.data?.map(m => m.id) || [];
  } catch (e) {
    console.error('Failed to list OpenRouter models:', e.message);
    return [];
  }
};