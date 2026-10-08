import { GoogleGenAI } from '@google/genai';
import { generateStructuredJSON, isGroqAvailable, GROQ_MODELS } from '../utils/groq.js';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = GROQ_MODELS.QUESTION_GEN;
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
  const parsedData = await generateStructuredJSON({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(topic, difficulty),
    schema: questionResponseSchema,
    model: GROQ_MODEL,
    temperature: 0.1,
  });
  return normalizeQuestion(parsedData);
};

// --- Main Export with Fallback Logic ---
export const generateQuestion = async (topic, difficulty = "medium") => {
  const providers = AI_PROVIDER === 'auto' 
    ? ['gemini', 'groq'] 
    : [AI_PROVIDER];

  let lastError;

  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error('GEMINI_API_KEY not configured');
        }
        console.log('🤖 Generating question with Gemini...');
        return await generateWithGemini(topic, difficulty);
      } else if (provider === 'groq') {
        if (!isGroqAvailable()) {
          throw new Error('GROQ_API_KEY not configured');
        }
        console.log('🚀 Generating question with Groq (Llama 3.1 70B)...');
        return await generateWithGroq(topic, difficulty);
      }
    } catch (err) {
      console.warn(`⚠️ ${provider.toUpperCase()} question generation failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
};