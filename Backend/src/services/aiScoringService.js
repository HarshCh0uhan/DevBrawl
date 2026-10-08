import { GoogleGenAI } from '@google/genai';
import { generateStructuredJSON, isGroqAvailable, GROQ_MODELS } from '../utils/groq.js';

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Using the standard Gemini flash model signature
const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = GROQ_MODELS.SCORING;

// Which AI provider to use: 'gemini' | 'groq' | 'auto' (auto tries gemini first, falls back to groq)
const AI_PROVIDER = process.env.AI_PROVIDER || 'auto';

const SYSTEM_PROMPT = `You are an experienced technical interviewer reviewing a candidate's code submission in a live coding interview platform called DevBrawl.

You will be given:
- The original question prompt
- The candidate's submitted source code
- The automated test results (which test cases passed/failed, execution times)

Your job is to evaluate TWO things the automated test runner cannot measure:
1. Code Quality: readability, naming, structure, comments, idiomatic use of the language, avoiding obvious anti-patterns.
2. Approach/Problem-Solving: did they choose a reasonable algorithm/data structure for the problem? Is their approach efficient in theory (Big-O), even if some test cases failed? Did they handle edge cases thoughtfully?

CRITICAL RULES:
1. Respond with ONLY valid JSON matching the schema. No markdown, no backticks, no preamble.
2. Be fair and specific — reference actual parts of their code in your feedback, don't give generic praise.
3. If test cases failed, factor that into approachScore.
4. codeQualityScore and approachScore must be integers from 0 to 100.
5. "feedback" should be 2-4 sentences, constructive and specific, written as if speaking directly to the candidate.
6. "summary" must be ONE short sentence (under 15 words) suitable for a scoreboard card.`;

// Define a strict JSON schema configuration to guarantee exact response shapes
const aiScoringSchema = {
  type: "OBJECT",
  properties: {
    codeQualityScore: { type: "INTEGER" },
    approachScore: { type: "INTEGER" },
    feedback: { type: "STRING" },
    summary: { type: "STRING" }
  },
  required: ["codeQualityScore", "approachScore", "feedback", "summary"]
};

const buildUserPrompt = ({ questionPrompt, sourceCode, languageId, testsPassed, testsTotal, testResults }) => {
  const languageNames = { 63: "JavaScript", 71: "Python", 62: "Java", 54: "C++" };
  const languageName = languageNames[languageId] || "Unknown";

  const testSummary = testResults
    .map((tr) => `  - Test ${tr.testCaseIndex + 1}: ${tr.status} (${tr.executionTimeMs}ms)`)
    .join("\n");

  return `QUESTION PROMPT:
${questionPrompt}

CANDIDATE'S LANGUAGE: ${languageName}

CANDIDATE'S SUBMITTED CODE:
${sourceCode}

AUTOMATED TEST RESULTS: ${testsPassed}/${testsTotal} passed
${testSummary}

Evaluate this submission's code quality and problem-solving approach.`;
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n || 0))));

const normalizeResult = (parsed) => ({
  codeQualityScore: clamp(parsed.codeQualityScore),
  approachScore: clamp(parsed.approachScore),
  feedback: String(parsed.feedback || ""),
  summary: String(parsed.summary || ""),
});

// --- Gemini Implementation ---
const scoreWithGemini = async (userPrompt) => {
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: aiScoringSchema,
      maxOutputTokens: 1000,
    }
  });

  const rawText = response.text;
  const parsed = JSON.parse(rawText);
  return normalizeResult(parsed);
};

// --- Groq Implementation ---
const scoreWithGroq = async (userPrompt) => {
  const parsed = await generateStructuredJSON({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: aiScoringSchema,
    model: GROQ_MODEL,
    temperature: 0.1,
  });
  return normalizeResult(parsed);
};

// --- Main Export with Fallback Logic ---
export const scoreSubmission = async ({
  questionPrompt,
  sourceCode,
  languageId,
  testsPassed,
  testsTotal,
  testResults,
}) => {
  const userPrompt = buildUserPrompt({
    questionPrompt,
    sourceCode,
    languageId,
    testsPassed,
    testsTotal,
    testResults,
  });

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
        console.log('🤖 Scoring with Gemini...');
        return await scoreWithGemini(userPrompt);
      } else if (provider === 'groq') {
        if (!isGroqAvailable()) {
          throw new Error('GROQ_API_KEY not configured');
        }
        console.log('🚀 Scoring with Groq (Llama 3.1 70B)...');
        return await scoreWithGroq(userPrompt);
      }
    } catch (err) {
      console.warn(`⚠️ ${provider.toUpperCase()} scoring failed:`, err.message);
      lastError = err;
      continue; // Try next provider
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
};