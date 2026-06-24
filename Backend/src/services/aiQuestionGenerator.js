

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = "gemini-2.5-flash"; 

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