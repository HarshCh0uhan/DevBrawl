import { generateStructuredJSON as groqGenerate, isGroqAvailable } from '../utils/groq.js';
import { generateStructuredJSON as openrouterGenerate, isOpenRouterAvailable } from '../utils/openrouter.js';

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

// --- Groq Implementation ---
const scoreWithGroq = async (userPrompt) => {
  const parsed = await groqGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: aiScoringSchema,
    temperature: 0.1,
  });
  return normalizeResult(parsed);
};

// --- OpenRouter (NVIDIA Nemotron) Implementation ---
const scoreWithOpenRouter = async (userPrompt) => {
  const parsed = await openrouterGenerate({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    schema: aiScoringSchema,
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

  let providers;
  switch (AI_PROVIDER) {
    case 'groq':
      providers = ['groq'];
      break;
    case 'openrouter':
      providers = ['openrouter'];
      break;
    case 'auto':
    default:
      providers = ['groq', 'openrouter'];
  }

  let lastError;

  for (const provider of providers) {
    try {
      if (provider === 'groq') {
        if (!isGroqAvailable()) throw new Error('GROQ_API_KEY not configured');
        console.log('🚀 Scoring with Groq...');
        return await scoreWithGroq(userPrompt);
      } else if (provider === 'openrouter') {
        if (!isOpenRouterAvailable()) throw new Error('OPENROUTER_API_KEY not configured');
        console.log('🔮 Scoring with OpenRouter (Nemotron)...');
        return await scoreWithOpenRouter(userPrompt);
      }
    } catch (err) {
      console.warn(`⚠️ ${provider.toUpperCase()} scoring failed:`, err.message);
      lastError = err;
      continue;
    }
  }

  throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
};