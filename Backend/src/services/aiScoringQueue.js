
import { Submission } from "../model/submission.model.js";
import { Question } from "../model/question.model.js";
import { SCORE_WEIGHTS } from "../model/submission.model.js";
import { scoreSubmission } from "./aiScoringService.js";
import { Room } from "../model/room.model.js";
import { compileAndBroadcastLeaderboard } from "./leaderBoard.service.js";


let ioInstance = null;

export const setIoInstance = (io) => {
  ioInstance = io;
};

/**
 * PHASE 2: Async AI enrichment.
 * Fetches the submission + its question, calls the AI service for code quality
 * and approach scoring, updates the Submission record, recalculates the
 * final score using all 4 weights, and broadcasts the result to the room.
 *
 * This runs as a background "fire-and-forget" routine from submitSolution() 
 * AFTER the Phase 1 HTTP response has already been sent to the player.
 */
export const queuePhase2Scoring = async (submissionId) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    console.warn("⚠️ WORKER: checkAndTriggerFinalLeaderboard called with missing or empty roomId.");
    console.error(`❌ Phase 2: submission ${submissionId} not found`);
    return;
  }

  submission.phase2Status = "in_progress";
  await submission.save();

  // Let the room know AI review has started so the UI can mount a loader
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
    
    // Safety check: trigger leaderboard if this room is waiting for the final evaluation to end
    await checkAndTriggerFinalLeaderboard(submission.roomId);
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

    // ── Recalculate final score using ALL 4 weights now ─────────────────────
    const finalScore = Math.round(
      submission.correctnessScore * SCORE_WEIGHTS.correctness +
      submission.efficiencyScore * SCORE_WEIGHTS.efficiency +
      aiResult.codeQualityScore * SCORE_WEIGHTS.codeQuality +
      aiResult.approachScore * SCORE_WEIGHTS.approach
    );

    // Points awarded for gamification layouts
    const pointsAwarded = Math.round(finalScore * 1.0);

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

    console.log(`✅ Phase 2 completed for submission ${submissionId} — final score: ${finalScore}`);

    // 🚀 Check if the round is over to automatically compile the final stats panel
    await checkAndTriggerFinalLeaderboard(submission.roomId);

  } catch (err) {
    console.error(`❌ Phase 2 AI scoring failed for submission ${submissionId}:`, err.message);

    submission.phase2Status = "failed";
    await submission.save();

    broadcastPhase2Failure(submission);

    // 🚀 Fallback trigger: compilation still fires even if the model drops the connection
    await checkAndTriggerFinalLeaderboard(submission.roomId);
  }
};

const checkAndTriggerFinalLeaderboard = async (roomId) => {
  try {
    const normalizedRoomId = roomId.toUpperCase();

    // const { Room } = await import("../model/room.model.js");
    console.log(`🔍 Querying room with inviteCode: "${normalizedRoomId}" (length: ${normalizedRoomId.length})`);

    const room = await Room.findOne({ inviteCode: normalizedRoomId });
    console.log(`🔍 Raw submission.roomId was: "${roomId}"`);
    console.log(`🔍 Room status check for ${normalizedRoomId}:`, room?.gameStatus ?? "room not found");
    const allRooms = await Room.find({}, { inviteCode: 1, gameStatus: 1, _id: 0 });
    console.log(`🔍 All rooms in DB:`, JSON.stringify(allRooms));


    if (room && room.gameStatus === "all_done") {
      
      // const { compileAndBroadcastLeaderboard } = await import("./leaderBoard.service.js");
      console.log(`🎯 WORKER: Room status verified as 'all_done'. Firing 'compileAndBroadcastLeaderboard' service now!`);
      console.log(`🏆 Round finished! Launching leaderboard dashboard for Room ${normalizedRoomId}`);
      
      // Pass the normalized uppercase room string to prevent channel scattering
      await compileAndBroadcastLeaderboard(ioInstance, normalizedRoomId);
    }
  } catch (err) {
    console.error("❌ Error running background post-game check:", err.message);
  }
};

// ─── Helper: broadcast a failure, keeping the provisional score visible ───
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
    console.warn(`⚠️ Socket.io instance not set — cannot broadcast "${event}" for room ${roomId}`);
    return;
  }
  ioInstance.to(roomId).emit(event, payload);
};