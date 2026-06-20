import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Using the standard Gemini flash model signature
const MODEL = "gemini-2.5-flash"; 

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

  try {
    // Correct structure for the modern @google/genai SDK
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Forces Gemini to output pure JSON matching the exact schema definition
        responseMimeType: "application/json",
        responseSchema: aiScoringSchema,
        maxOutputTokens: 1000,
      }
    });

    // Extract the text parameter directly from the new response layout
    const rawText = response.text;
    const parsed = JSON.parse(rawText);

    // Clamp scores defensively in case the model returns out-of-range values
    const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n || 0))));

    return {
      codeQualityScore: clamp(parsed.codeQualityScore),
      approachScore: clamp(parsed.approachScore),
      feedback: String(parsed.feedback || ""),
      summary: String(parsed.summary || ""),
    };

  } catch (err) {
    throw new Error(`Failed to parse or process AI scoring via Gemini: ${err.message}`);
  }
};