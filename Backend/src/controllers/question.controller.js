import { Question } from "../model/question.model.js";
import { generateQuestion } from "../services/aiQuestionGenerator.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const generateRoundQuestion = asyncHandler(async (req, res) => {
  const { roomId, roundNumber, topic, difficulty } = req.body;

  if (!roomId || roundNumber === undefined || !topic) {
    throw new ApiError(400, "roomId, roundNumber and topic are required");
  }

  // Ensure roundNumber is explicitly stored and treated as a number
  const parsedRound = Number(roundNumber);

  let generated;
  try {
    generated = await generateQuestion(topic, difficulty || "medium");
  } catch (err) {
    throw new ApiError(502, `AI question generation failed: ${err.message}`);
  }

  // Atomic Upsert: Prevents race conditions and E11000 duplicate key index crashes
  const question = await Question.findOneAndUpdate(
    { roomId, roundNumber: parsedRound },
    {
      roomId,
      roundNumber: parsedRound,
      ...generated,
    },
    { 
      upsert: true, 
      new: true, 
      setDefaultsOnInsert: true 
    }
  );

  // Strip hidden test cases out entirely before sending data to the client viewport
  const safeQuestion = {
    _id: question._id,
    roomId: question.roomId,
    roundNumber: question.roundNumber,
    topic: question.topic,
    difficulty: question.difficulty,
    title: question.title,
    prompt: question.prompt,
    constraints: question.constraints,
    timeLimitMs: question.timeLimitMs,
    sampleTestCases: question.testCases
      .filter((tc) => !tc.isHidden)
      .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, safeQuestion, "Question generated and synced successfully"));
});

export const getRoundQuestion = asyncHandler(async (req, res) => {
  const { roomId, roundNumber } = req.params;

  if (!roomId || !roundNumber) {
    throw new ApiError(400, "roomId and roundNumber route parameters are required");
  }

  const question = await Question.findOne({ roomId, roundNumber: Number(roundNumber) });

  if (!question) {
    throw new ApiError(404, "No question found for this room/round yet");
  }

  const safeQuestion = {
    _id: question._id,
    roomId: question.roomId,
    roundNumber: question.roundNumber,
    topic: question.topic,
    difficulty: question.difficulty,
    title: question.title,
    prompt: question.prompt,
    constraints: question.constraints,
    timeLimitMs: question.timeLimitMs,
    sampleTestCases: question.testCases
      .filter((tc) => !tc.isHidden)
      .map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, safeQuestion, "Question fetched successfully"));
});