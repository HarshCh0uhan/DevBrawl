import { GoogleGenAI } from '@google/genai';
import { generateStructuredJSON as groqGenerate, isGroqAvailable } from '../utils/groq.js';
import { generateStructuredJSON as openrouterGenerate, isOpenRouterAvailable } from '../utils/openrouter.js';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-2.5-flash";
const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';

const questionResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    promptLines: { 
      type: "ARRAY", 
      items: { type: "STRING" },
      description: "Each item is a paragraph or line of the problem prompt description text."
    },
    constraintsLines: { 
      type: "ARRAY", 
      items: { type: "STRING" },
      description: "Each item is an individual constraint rule, e.g., '1 <= nums.length <= 10^5'"
    },
    timeLimitMs: { type: "INTEGER" },
    testCases: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          input: { type: "STRING" },
          expectedOutput: { type: "STRING" },
          isHidden: { type: "BOOLEAN" },
          weight: { type: "INTEGER" }
        },
        required: ["input", "expectedOutput", "isHidden", "weight"]
      }
    }
  },
  required: ["title", "promptLines", "constraintsLines", "timeLimitMs", "testCases"]
};

const buildUserPrompt = (topic, difficulty) => 
  `Generate an interview coding challenge. Topic: ${topic}, Difficulty: ${difficulty}. Include exactly 5 test cases (2 sample cases with isHidden: false, 3 edge cases with isHidden: true).`;

const SYSTEM_PROMPT = `You are a strict technical problem writer for a competitive programming arena.
Your output must be a single, raw, clean JSON object matching the provided schema.
Never use literal newlines inside any string value. Break paragraphs up into separate array items instead.
Do not include any backticks or markdown fences (\`\`\`json) outside the structural fields.`;

const normalizeQuestion = (parsedData) => ({
  title: parsedData.title,
  prompt: parsedData.promptLines.join("\n"),
  constraints: parsedData.constraintsLines.join("\n"),
  timeLimitMs: Number(parsedData.timeLimitMs || 2000),
  testCases: parsedData.testCases,
});

// --- Gemini Implementation ---
const generateWithGemini = async (topic, difficulty) => {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildUserPrompt(topic, difficulty),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: questionResponseSchema,
      temperature: 0.1,
    }
  });

  const parsedData = JSON.parse(response.text);
  return normalizeQuestion(parsedData);
};

// --- Groq Implementation ---
const generateWithGroq = async (topic, difficulty) => {
  const parsedData = await groqGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(topic, difficulty),
    schema: questionResponseSchema,
    temperature: 0.1,
  });
  return normalizeQuestion(parsedData);
};

// --- OpenRouter (Nemotron) Implementation ---
const generateWithOpenRouter = async (topic, difficulty) => {
  const parsedData = await openrouterGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(topic, difficulty),
    schema: questionResponseSchema,
    temperature: 0.1,
    topic,      // Pass topic for normalization fallback
    difficulty, // Pass difficulty for normalization fallback
  });
  return normalizeQuestion(parsedData);
};

// --- Main Export with Fallback Logic ---
// Provider order: configured provider first, then fallbacks
export const generateQuestion = async (topic, difficulty = "medium") => {
  // Build provider chain based on AI_PROVIDER setting
  let providers;
  switch (AI_PROVIDER) {
    case 'gemini':
      providers = ['gemini'];
      break;
    case 'groq':
      providers = ['groq'];
      break;
    case 'openrouter':
      providers = ['openrouter'];
      break;
    case 'auto':
    default:
      // Auto: try all in order of preference
      providers = ['gemini', 'groq', 'openrouter'];
  }

  let lastError;

  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');
        console.log('🤖 Generating question with Gemini...');
        return await generateWithGemini(topic, difficulty);
      } else if (provider === 'groq') {
        if (!isGroqAvailable()) throw new Error('GROQ_API_KEY not configured');
        console.log('🚀 Generating question with Groq...');
        return await generateWithGroq(topic, difficulty);
      } else if (provider === 'openrouter') {
        if (!isOpenRouterAvailable()) throw new Error('OPENROUTER_API_KEY not configured');
        console.log('🔮 Generating question with OpenRouter (Nemotron 3 Ultra)...');
        return await generateWithOpenRouter(topic, difficulty);
      }
    } catch (err) {
      console.warn(`⚠️ ${provider.toUpperCase()} question generation failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
};