//ai question generator 

import { generateQuestion } from "../services/aiQuestionGenerator.js";
import { Question } from "../model/question.model.js";

const sanitizeQuestion = (question) => ({
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
});

const generateAndBroadcastQuestion = async (io, roomId, roundNumber, topic, difficulty) => {
  try {
    const generated = await generateQuestion(topic, difficulty || "medium");
    await Question.deleteOne({ roomId, roundNumber });
    const question = await Question.create({ roomId, roundNumber, ...generated });
    io.to(roomId).emit("round-question-ready", sanitizeQuestion(question));
    console.log(`✅ Question generated for room ${roomId} round ${roundNumber}: "${question.title}"`);
  } catch (err) {
    console.error(`❌ Question generation failed for room ${roomId}:`, err.message);
    io.to(roomId).emit("round-question-failed", {
      roomId,
      roundNumber,
      error: "Failed to generate question. Host can try regenerating.",
    });
  }
};

export const registerQuestionHandlers = (io, socket) => {
  
  socket.on("start-round", async (payload) => {
    const { inviteCode, roundNumber, topic, difficulty } = payload;
    if (!inviteCode || !roundNumber || !topic) {
      socket.emit("round-question-failed", { error: "inviteCode, roundNumber and topic are required" });
      return;
    }
    const roomId = inviteCode.toUpperCase();
    io.to(roomId).emit("round-question-generating", { roomId, roundNumber, topic, difficulty: difficulty || "medium" });
    await generateAndBroadcastQuestion(io, roomId, roundNumber, topic, difficulty);
  });

  socket.on("regenerate-round-question", async (payload) => {
    const { inviteCode, roundNumber, topic, difficulty } = payload;
    if (!inviteCode || !roundNumber || !topic) {
      socket.emit("round-question-failed", { error: "inviteCode, roundNumber and topic are required" });
      return;
    }
    const roomId = inviteCode.toUpperCase();
    io.to(roomId).emit("round-question-regenerating", { roomId, roundNumber, topic, difficulty: difficulty || "medium" });
    await generateAndBroadcastQuestion(io, roomId, roundNumber, topic, difficulty);
  });
};