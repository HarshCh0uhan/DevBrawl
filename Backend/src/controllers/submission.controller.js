
import { Question } from "../model/question.model.js";
import { Submission } from "../model/submission.model.js";
import { executeAgainstTestCases, isRateLimited } from "../utils/pistonExecutor.js";
import { wrapCode } from "./codeWrapper.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { queuePhase2Scoring } from "../services/aiScoringQueue.js";
import { advanceTurn } from "../utils/socket.js";

const buildTestResult = (testCaseIndex, result, expectedOutput, timeLimitMs) => {
  if (result.compilationFailed) {
    return { testCaseIndex, passed: false, actualOutput: "", executionTimeMs: 0, status: "Compilation Error" };
  }
  if (result.timedOut) {
    return { testCaseIndex, passed: false, actualOutput: "", executionTimeMs: timeLimitMs, status: "Time Limit Exceeded" };
  }
  if (result.code !== 0) {
    return { testCaseIndex, passed: false, actualOutput: result.stderr || "", executionTimeMs: result.executionTimeMs, status: "Runtime Error" };
  }
  const actual = result.stdout.trim();
  const expected = expectedOutput.trim();
  const passed = actual === expected;
  return { testCaseIndex, passed, actualOutput: actual, executionTimeMs: result.executionTimeMs, status: passed ? "Accepted" : "Wrong Answer" };
};

const calculateCorrectnessScore = (testResults, testCases) => {
  const totalWeight = testCases.reduce((sum, tc) => sum + (tc.weight || 1), 0);
  const passedWeight = testResults.reduce((sum, tr, i) => sum + (tr.passed ? (testCases[i].weight || 1) : 0), 0);
  return Math.round((passedWeight / totalWeight) * 100);
};

const calculateEfficiencyScore = (testResults, timeLimitMs) => {
  const passedResults = testResults.filter((tr) => tr.passed);
  if (passedResults.length === 0) return 0;
  const avgTimeMs = passedResults.reduce((sum, tr) => sum + tr.executionTimeMs, 0) / passedResults.length;
  return Math.max(0, Math.round(100 - (avgTimeMs / timeLimitMs) * 100));
};

export const submitSolution = asyncHandler(async (req, res) => {
  const { roomId, questionId, sourceCode, languageId } = req.body;
  const userId = req.user._id;
  const username = req.user.username;

  if (!roomId || !questionId || !sourceCode || !languageId) {
    throw new ApiError(400, "roomId, questionId, sourceCode and languageId are required");
  }
  if (isRateLimited(userId.toString())) {
    throw new ApiError(429, "Too many submissions. Max 10 per minute.");
  }
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new ApiError(400, "Source code too large. Max 100KB.");
  }

  // Enforce uniform casing cleanly inside the function scope
  const normalizedRoomId = roomId.toUpperCase();

  const question = await Question.findById(questionId);
  if (!question) throw new ApiError(404, "Question not found");

  const finalCode = wrapCode(sourceCode, languageId);
  const executionResults = await executeAgainstTestCases(
    finalCode, languageId, question.testCases, { timeoutMs: question.timeLimitMs }
  );

  const testResults = executionResults.map((result, i) =>
    buildTestResult(i, result, question.testCases[i].expectedOutput, question.timeLimitMs)
  );

  const testsPassed = testResults.filter((tr) => tr.passed).length;
  const testsTotal = testResults.length;
  const allPassed = testsPassed === testsTotal;

  const correctnessScore = calculateCorrectnessScore(testResults, question.testCases);
  const efficiencyScore = calculateEfficiencyScore(testResults, question.timeLimitMs);
  const provisionalScore = Math.round(correctnessScore * 0.6 + efficiencyScore * 0.4);

  const submission = await Submission.create({
    roomId: normalizedRoomId,
    questionId,
    userId,
    username,
    sourceCode,
    languageId,
    testResults,
    testsPassed,
    testsTotal,
    correctnessScore,
    efficiencyScore,
    phase1Status: "completed",
    phase1CompletedAt: new Date(),
    finalScore: provisionalScore,
    phase2Status: "pending",
  });

  // Strip hidden test case outputs before responding
  const safeTestResults = testResults.map((tr, i) => ({
    testCaseIndex: tr.testCaseIndex,
    passed: tr.passed,
    status: tr.status,
    isHidden: question.testCases[i].isHidden,
    actualOutput: question.testCases[i].isHidden ? undefined : tr.actualOutput,
  }));

  // Clean, single response output (Duplicate response block dropped)
  res.status(200).json(
    new ApiResponse(200, {
      submissionId: submission._id,
      testsPassed,
      testsTotal,
      correctnessScore,
      efficiencyScore,
      provisionalScore,
      testResults: safeTestResults,
      phase2Status: "pending",
    }, allPassed ? "All test cases passed!" : "Some test cases failed")
  );

  // ── Advance turn with normalized casing strings ──────────────
  if (normalizedRoomId) {
    advanceTurn(normalizedRoomId).catch((err) => {
      console.error(`❌ advanceTurn failed for room ${normalizedRoomId}:`, err.message);
    });
  }

  // Phase 2 AI scoring queue initialization
  queuePhase2Scoring(submission._id).catch((err) => {
    console.error(`❌ Phase 2 scoring failed for submission ${submission._id}:`, err.message);
  });
});