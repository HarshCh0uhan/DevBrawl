import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// YOUR Groq Organization Models (from console.groq.com limits)
export const GROQ_MODELS = {
  PRIMARY: [
    'openai/gpt-oss-120b',      // Most capable (120B) - 1K req/day
    'qwen/qwen3.8-27b',         // Excellent for code/structured output - 1K req/day
    'openai/gpt-oss-20b',       // Fast + capable - 1K req/day
  ],
  HIGH_LIMIT: [
    'allam-2-7b',               // 7K req/day - highest daily limit!
  ],
};

const ALL_MODELS = [
  ...GROQ_MODELS.PRIMARY,
  ...GROQ_MODELS.HIGH_LIMIT,
];

/**
 * Generate structured JSON response using Groq with exact Mongoose schema matching
 */
export const generateStructuredJSON = async ({
  systemPrompt,
  userPrompt,
  schema,
  temperature = 0.1,
}) => {
  let lastError;

  for (const modelName of ALL_MODELS) {
    try {
      const response = await groq.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse JSON from Groq: ${e.message}`);
      }

      // Normalize to exact Mongoose schema
      if (schema) {
        parsed = normalizeToMongooseSchema(parsed, schema);
      }

      console.log(`✅ Groq success with model: ${modelName}`);
      return parsed;
    } catch (e) {
      lastError = e;
      const msg = e.message || '';
      
      if (msg.includes('decommissioned') || 
          msg.includes('model_not_found') || 
          msg.includes('does not exist') ||
          msg.includes('model_decommissioned') ||
          msg.includes('not have access') ||
          msg.includes('does not support chat') ||
          msg.includes('terms_required') ||
          msg.includes('rate_limit') ||
          msg.includes('capacity')) {
        console.warn(`⚠️ Groq model ${modelName} unavailable: ${e.message?.split('\n')[0]}`);
        continue;
      }
      throw e;
    }
  }

  throw new Error(`All Groq models failed. Last error: ${lastError?.message}`);
};

/**
 * Normalize Groq response to EXACT Mongoose question schema
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
      console.log(`🔄 Mapped field: ${sourceKey} → ${targetKey}`);
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
      testCase.isHidden = Boolean(testCase.isHidden ?? (idx >= 2)); // First 2 visible, rest hidden
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
  if (!normalized.topic) {
    normalized.topic = 'General Programming';
  }
  
  if (!normalized.title) {
    normalized.title = 'Untitled Problem';
  }
  
  if (!normalized.promptLines || normalized.promptLines.length === 0) {
    normalized.promptLines = ['Solve this programming problem.'];
  }
  
  if (!normalized.constraintsLines || normalized.constraintsLines.length === 0) {
    normalized.constraintsLines = ['Standard input/output constraints apply.'];
  }
  
  if (!normalized.timeLimitMs) {
    normalized.timeLimitMs = 10000;
  }

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
      console.log(`🗑️ Removing extra field: ${key}`);
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
  temperature = 0.3,
  maxTokens = 1000,
}) => {
  for (const modelName of ALL_MODELS) {
    try {
      const response = await groq.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content || '';
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('decommissioned') || msg.includes('model_not_found') || msg.includes('does not exist') || msg.includes('terms_required') || msg.includes('rate_limit')) {
        continue;
      }
      throw e;
    }
  }
  throw new Error('All Groq models failed for text generation');
};

/**
 * List available models for debugging
 */
export const listAvailableModels = async () => {
  try {
    const response = await groq.models.list();
    return response.data.map(m => m.id);
  } catch (e) {
    console.error('Failed to list Groq models:', e.message);
    return [];
  }
};

/**
 * Check if Groq is available/configured
 */
export const isGroqAvailable = () => !!process.env.GROQ_API_KEY;