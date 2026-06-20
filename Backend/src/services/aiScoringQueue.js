import { Submission } from "../model/submission.model.js";
import { Question } from "../model/question.model.js";
import { SCORE_WEIGHTS } from "../model/submission.model.js";
import { scoreSubmission } from "./aiScoringService.js";

// ─── Socket.io instance injection ───────────────────────────────────────────
// This module needs to emit events but doesn't create the io instance
// itself (socket.js does). We store a reference here once socket.js
// initializes, via setIoInstance(). This avoids circular imports between
// socket.js \u2192 controllers \u2192 this queue \u2192 back to socket.js.
let ioInstance = null;

export const setIoInstance = (io) => {
  ioInstance = io;
};

/**
 * PHASE 2: Async AI enrichment.
 * Fetches the submission + its question, calls Claude for code quality
 * and approach scoring, updates the Submission record, recalculates the
 * final score using all 4 weights, and broadcasts the result to the room
 * via Socket.io.
 *
 * This is called fire-and-forget from submitSolution() AFTER the Phase 1
 * HTTP response has already been sent \u2014 it never blocks the player.
 */
export const queuePhase2Scoring = async (submissionId) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    console.error(`❌ Phase 2: submission ${submissionId} not found`);
    return;
  }

  // Mark as in_progress so frontend can show "AI is reviewing..." instead
  // of a generic pending state if it polls or re-fetches mid-flight.
  submission.phase2Status = "in_progress";
  await submission.save();

  // Let the room know AI review has started for this submission, so the
  // UI can show a loading skeleton on the scoreboard card for this player.
  broadcastToRoom(submission.roomId, "phase2-reviewing", {
    submissionId: submission._id,
    userId: submission.userId,
    username: submission.username,
  });

  const question = await Question.findById(submission.questionId);
  if (!question) {
    console.error(`❌ Phase 2: question ${submission.questionId} not found for submission ${submissionId}`);
    submission.phase2Status = "failed";
    await submission.save();
    broadcastPhase2Failure(submission);
    return;
  }

  try {
    const aiResult = await scoreSubmission({
      questionPrompt: question.prompt,
      sourceCode: submission.sourceCode,
      languageId: submission.languageId,
      testsPassed: submission.testsPassed,
      testsTotal: submission.testsTotal,
      testResults: submission.testResults,
    });

    // ── Recalculate final score using ALL 4 weights now that we have ────────
    // codeQualityScore and approachScore. This replaces the provisional
    // score that was computed using only correctness + efficiency.
    const finalScore = Math.round(
      submission.correctnessScore * SCORE_WEIGHTS.correctness +
        submission.efficiencyScore * SCORE_WEIGHTS.efficiency +
        aiResult.codeQualityScore * SCORE_WEIGHTS.codeQuality +
        aiResult.approachScore * SCORE_WEIGHTS.approach
    );

    // ── Points awarded for gamification (scaled, can be tuned later) ────────
    const pointsAwarded = Math.round(finalScore * 1.0); // 1:1 for now, e.g. badges/multipliers can hook in later

    submission.codeQualityScore = aiResult.codeQualityScore;
    submission.approachScore = aiResult.approachScore;
    submission.aiFeedback = aiResult.feedback;
    submission.aiSummary = aiResult.summary;
    submission.finalScore = finalScore;
    submission.pointsAwarded = pointsAwarded;
    submission.phase2Status = "completed";
    submission.phase2CompletedAt = new Date();

    await submission.save();

    // ── Broadcast the completed, full score to the room ─────────────────────
    broadcastToRoom(submission.roomId, "phase2-complete", {
      submissionId: submission._id,
      userId: submission.userId,
      username: submission.username,
      codeQualityScore: aiResult.codeQualityScore,
      approachScore: aiResult.approachScore,
      aiFeedback: aiResult.feedback,
      aiSummary: aiResult.summary,
      finalScore,
      pointsAwarded,
    });

    console.log(`✅ Phase 2 completed for submission ${submissionId} \u2014 final score: ${finalScore}`);
  } catch (err) {
    console.error(`❌ Phase 2 AI scoring failed for submission ${submissionId}:`, err.message);

    submission.phase2Status = "failed";
    await submission.save();

    broadcastPhase2Failure(submission);
  }
};

// ─── Helper: broadcast a failure, keeping the provisional score visible ───
// If Claude fails, the player still has their Phase 1 score \u2014 we just
// let the room know AI review isn't available so the UI can stop showing
// the loading skeleton and fall back to "AI review unavailable" instead of
// spinning forever.
const broadcastPhase2Failure = (submission) => {
  broadcastToRoom(submission.roomId, "phase2-failed", {
    submissionId: submission._id,
    userId: submission.userId,
    username: submission.username,
    finalScore: submission.finalScore, // provisional score stays as final fallback
  });
};

const broadcastToRoom = (roomId, event, payload) => {
  if (!ioInstance) {
    console.warn(`⚠️ Socket.io instance not set \u2014 cannot broadcast "${event}" for room ${roomId}`);
    return;
  }
  ioInstance.to(roomId).emit(event, payload);
};