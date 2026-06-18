// import { GoogleGenAI } from '@google/genai';

// const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// // Using the standard Gemini flash model signature
// const MODEL = "gemini-2.5-flash"; 

// const SYSTEM_PROMPT = `You are a technical interview question generator for a competitive coding platform called DevBrawl.

// Your job: generate ONE coding question for a given topic and difficulty, along with test cases that can be used to automatically judge a candidate's solution.

// CRITICAL RULES:
// 1. Respond with ONLY valid JSON. No markdown, no backticks, no preamble.
// 2. The question must be solvable by reading stdin and writing to stdout (no special I/O frameworks).
// 3. Generate exactly 5 test cases: 2 marked "isHidden": false (samples shown to the player) and 3 marked "isHidden": true (used only for judging).
// 4. Test case inputs and outputs must be EXACT strings as they would appear via stdin/stdout — no extra formatting, no trailing periods, consistent whitespace.
// 5. Keep the question solvable within 10 seconds of execution time for reasonable solutions.
// 6. Make the 3 hidden test cases meaningfully different from the 2 samples (cover edge cases: empty input, large input, boundary values).
// 7. The "prompt" field should read like a real interview question: clear problem statement, input format, output format, and 1-2 examples embedded in the text.`;

// // Define a strict JSON schema configuration for the SDK to guarantee exact response shapes
// const jsonResponseSchema = {
//   type: "OBJECT",
//   properties: {
//     title: { type: "STRING" },
//     prompt: { type: "STRING" },
//     constraints: { type: "STRING" },
//     testCases: {
//       type: "ARRAY",
//       items: {
//         type: "OBJECT",
//         properties: {
//           input: { type: "STRING" },
//           expectedOutput: { type: "STRING" },
//           isHidden: { type: "BOOLEAN" },
//           weight: { type: "INTEGER" }
//         },
//         required: ["input", "expectedOutput", "isHidden", "weight"]
//       }
//     }
//   },
//   required: ["title", "prompt", "constraints", "testCases"]
// };

// /**
//  * Generates a coding question + test cases for a given topic/difficulty.
//  * Returns parsed JSON matching the Question model shape.
//  */
// export const generateQuestion = async (topic, difficulty = "medium") => {
//   const userPrompt = `Generate one ${difficulty} difficulty coding question on the topic: "${topic}".`;

//   try {
//     // Correct structure for the modern @google/genai SDK
//     const response = await ai.models.generateContent({
//       model: MODEL,
//       contents: userPrompt,
//       config: {
//         systemInstruction: SYSTEM_PROMPT,
//         // Forces Gemini to output pure JSON text matching the schema
//         responseMimeType: "application/json",
//         responseSchema: jsonResponseSchema,
//         maxOutputTokens: 2000,
//       }
//     });

//     // Extract the raw text directly from the SDK response object
//     const rawText = response.text;

//     // Direct parse — no regex string stripping needed anymore!
//     const parsed = JSON.parse(rawText);

//     // Ensure every test case fields are strictly formatted
//     parsed.testCases = parsed.testCases.map((tc) => ({
//       input: String(tc.input ?? ""),
//       expectedOutput: String(tc.expectedOutput ?? ""),
//       isHidden: Boolean(tc.isHidden ?? true),
//       weight: Number(tc.weight ?? 1),
//     }));

//     return {
//       title: parsed.title,
//       prompt: parsed.prompt,
//       constraints: parsed.constraints || "",
//       testCases: parsed.testCases,
//       topic,
//       difficulty,
//       generatedBy: "gemini",
//     };

//   } catch (err) {
//     throw new Error(`Failed to generate or parse question via Gemini: ${err.message}`);
//   }
// };

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-2.5-flash"; 

// 🚀 THE STRUCTURAL FIX: We convert prompt & constraints from flat strings 
// to text arrays. This stops Flash from leaking raw newlines into JSON properties!
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

export const generateQuestion = async (topic, difficulty = "medium") => {
  const systemInstruction = `You are a strict technical problem writer for a competitive programming arena.
Your output must be a single, raw, clean JSON object matching the provided schema.
Never use literal newlines inside any string value. Break paragraphs up into separate array items instead.
Do not include any backticks or markdown fences (\`\`\`json) outside the structural fields.`;

  const userPrompt = `Generate an interview coding challenge. Topic: ${topic}, Difficulty: ${difficulty}. Include exactly 5 test cases (2 sample cases with isHidden: false, 3 edge cases with isHidden: true).`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: questionResponseSchema,
        temperature: 0.1 // Keeps the model structurally rigid and predictable
      }
    });

    const parsedData = JSON.parse(response.text);

    // 🚀 RESTITCHING OBJECT: Re-assemble the lines into standard strings 
    // so you don't have to change your frontend component layouts or database schemas!
    return {
      title: parsedData.title,
      prompt: parsedData.promptLines.join("\n"),
      constraints: parsedData.constraintsLines.join("\n"),
      timeLimitMs: Number(parsedData.timeLimitMs || 2000),
      testCases: parsedData.testCases,
      topic,
      difficulty
    };

  } catch (err) {
    console.error("❌ Question Generation JSON Parse Failed:", err.message);
    throw new Error(`Failed to generate a cleanly structured JSON question: ${err.message}`);
  }
};