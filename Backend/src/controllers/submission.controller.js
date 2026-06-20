import { Question } from "../model/question.model.js";
import { Submission } from "../model/submission.model.js";
import { executeAgainstTestCases, isRateLimited } from "../utils/codeExecutor.js";
import { wrapCode } from "./codeWrapper.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { queuePhase2Scoring } from "../services/aiScoringQueue.js";

/**
 * Maps a single Docker execution result + expected output into a
 * structured test result matching the Submission model's testResultSchema.
 */
const buildTestResult = (testCaseIndex, result, expectedOutput, timeLimitMs) => {
  if (result.compilationFailed) {
    return {
      testCaseIndex,
      passed: false,
      actualOutput: "",
      executionTimeMs: 0,
      status: "Compilation Error",
    };
  }

  if (result.timedOut) {
    return {
      testCaseIndex,
      passed: false,
      actualOutput: "",
      executionTimeMs: timeLimitMs,
      status: "Time Limit Exceeded",
    };
  }

  if (result.code !== 0) {
    return {
      testCaseIndex,
      passed: false,
      actualOutput: result.stderr || "",
      executionTimeMs: result.executionTimeMs,
      status: "Runtime Error",
    };
  }

  // ── Output comparison ───────────────────────────────────────────────────
  // Trim trailing whitespace/newlines on both sides since most judges treat
  // "5\n" and "5" as equivalent — strict exact-byte matching is too brittle
  // for cross-language stdout formatting differences.
  const actual = result.stdout.trim();
  const expected = expectedOutput.trim();
  const passed = actual === expected;

  return {
    testCaseIndex,
    passed,
    actualOutput: actual,
    executionTimeMs: result.executionTimeMs,
    status: passed ? "Accepted" : "Wrong Answer",
  };
};

/**
 * Calculates correctness score (0-100) from weighted test pass rate.
 */
const calculateCorrectnessScore = (testResults, testCases) => {
  const totalWeight = testCases.reduce((sum, tc) => sum + (tc.weight || 1), 0);
  const passedWeight = testResults.reduce((sum, tr, i) => {
    return sum + (tr.passed ? (testCases[i].weight || 1) : 0);
  }, 0);

  return Math.round((passedWeight / totalWeight) * 100);
};

/**
 * Calculates efficiency score (0-100) from average execution time vs
 * time limit. Faster relative to the limit = higher score. Only computed
 * across PASSED test cases — failing fast isn't "efficient".
 */
const calculateEfficiencyScore = (testResults, timeLimitMs) => {
  const passedResults = testResults.filter((tr) => tr.passed);
  if (passedResults.length === 0) return 0;

  const avgTimeMs =
    passedResults.reduce((sum, tr) => sum + tr.executionTimeMs, 0) / passedResults.length;

  // Linear falloff: 0ms execution = 100 score, timeLimitMs execution = 0 score
  const score = Math.max(0, Math.round(100 - (avgTimeMs / timeLimitMs) * 100));
  return score;
};

/**
 * PHASE 1: Instant judging endpoint.
 * Runs submitted code against ALL test cases (hidden + sample) for the
 * question, computes correctness + efficiency synchronously, saves a
 * provisional Submission record, and responds immediately.
 *
 * Phase 2 (AI code quality / approach review) is queued asynchronously
 * AFTER this response is sent — the player is NOT blocked waiting for it.
 *
 * Body: { roomId, questionId, sourceCode, languageId }
 */
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

  // ── Fetch question WITH hidden test cases (server-side only) ────────────
  const question = await Question.findById(questionId);
  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  // ── PHASE 1: Run against every test case ─────────────────────────────────
  const finalCode = wrapCode(sourceCode, languageId);
  const executionResults = await executeAgainstTestCases(
    finalCode,
    languageId,
    question.testCases,
    { timeoutMs: question.timeLimitMs }
  );

  const testResults = executionResults.map((result, i) =>
    buildTestResult(i, result, question.testCases[i].expectedOutput, question.timeLimitMs)
  );

  const testsPassed = testResults.filter((tr) => tr.passed).length;
  const testsTotal = testResults.length;

  const correctnessScore = calculateCorrectnessScore(testResults, question.testCases);
  const efficiencyScore = calculateEfficiencyScore(testResults, question.timeLimitMs);

  // ── Provisional final score (Phase 2 fields not yet available) ──────────
  // Weighted only across the two scores we HAVE right now. Once Phase 2
  // completes, finalScore gets recalculated using the full 4-way weight
  // split defined in SCORE_WEIGHTS.
  const provisionalScore = Math.round(correctnessScore * 0.6 + efficiencyScore * 0.4);

  // ── Save Phase 1 results immediately ─────────────────────────────────────
  const submission = await Submission.create({
    roomId,
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

  // ── Respond IMMEDIATELY \u2014 do not wait for Phase 2 ──────────────────────
  // Hidden test case inputs/outputs are stripped from the response; only
  // pass/fail + status per test is returned (no leaking the actual hidden
  // expected outputs back to the client).
  const safeTestResults = testResults.map((tr, i) => ({
    testCaseIndex: tr.testCaseIndex,
    passed: tr.passed,
    status: tr.status,
    isHidden: question.testCases[i].isHidden,
    // Only reveal actualOutput for non-hidden (sample) cases, so players
    // can debug their sample-case failures but can't reverse-engineer
    // hidden expected outputs from their own actualOutput.
    actualOutput: question.testCases[i].isHidden ? undefined : tr.actualOutput,
  }));

  res.status(200).json(
    new ApiResponse(
      200,
      {
        submissionId: submission._id,
        testsPassed,
        testsTotal,
        correctnessScore,
        efficiencyScore,
        provisionalScore,
        testResults: safeTestResults,
        phase2Status: "pending", // frontend shows "AI reviewing..." until socket update arrives
      },
      testsPassed === testsTotal ? "All test cases passed!" : "Some test cases failed"
    )
  );


  queuePhase2Scoring(submission._id).catch((err) => {
    console.error(`❌ Phase 2 scoring failed for submission ${submission._id}:`, err.message);
  });
});

