import { Room } from "../models/room.model.js";
import { Submission } from "../models/submission.model.js";
import { compileAndBroadcastLeaderboard } from "../services/leaderBoard.service.js";

export const registerGameHandlers = (io, socket) => {

  // 1. Transition: Coding -> Explaining
  socket.on("submit-code-turn", async (payload, callback) => {
    try {
      const { inviteCode } = payload;
      const room = await Room.findOne({ inviteCode });
      if (!room) return callback?.({ success: false, error: "Room not found" });
      if (room.matchState !== "coding") return callback?.({ success: false, error: "Not in coding phase" });

      // The AI Base Score is already calculated and saved to Submission by the HTTP endpoint.
      // We fetch the most recent submission for this active player to get the score.
      const latestSubmission = await Submission.findOne({
        roomId: inviteCode,
        userId: room.activePlayerId
      }).sort({ createdAt: -1 });

      const aiScore = latestSubmission ? (latestSubmission.testsPassed * 10) : 0; // 10 points per test

      room.matchState = "explaining";
      room.activePlayerAiScore = aiScore;
      await room.save();

      io.to(inviteCode).emit("phase-changed", {
        matchState: "explaining",
        aiScore,
        activePlayerId: room.activePlayerId
      });

      callback?.({ success: true });
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  // 2. Transition: Explaining -> Judging
  socket.on("start-judging-phase", async (payload, callback) => {
    try {
      const { inviteCode } = payload;
      const room = await Room.findOne({ inviteCode });
      if (!room) return callback?.({ success: false, error: "Room not found" });
      if (room.matchState !== "explaining") return callback?.({ success: false, error: "Not in explaining phase" });

      room.matchState = "judging";
      room.currentJudgingScores = {}; // Reset for the new judging phase
      await room.save();

      io.to(inviteCode).emit("phase-changed", {
        matchState: "judging",
        activePlayerId: room.activePlayerId
      });

      callback?.({ success: true });
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  // 3. Submit Judging Scores
  socket.on("submit-judging-scores", async (payload, callback) => {
    try {
      const { inviteCode, scores } = payload; // scores is an object: { targetUserId: points }
      const room = await Room.findOne({ inviteCode });
      if (!room) return callback?.({ success: false, error: "Room not found" });
      if (room.matchState !== "judging") return callback?.({ success: false, error: "Not in judging phase" });

      const judgeId = socket.user._id.toString();

      // Prevent the active player from judging themselves
      if (judgeId === room.activePlayerId.toString()) {
        return callback?.({ success: false, error: "You cannot judge yourself" });
      }

      // Validate they distributed exactly 100 points (optional but recommended)
      const totalPoints = Object.values(scores).reduce((a, b) => a + b, 0);
      if (totalPoints !== 100) {
        return callback?.({ success: false, error: "You must distribute exactly 100 points" });
      }

      // Save the judge's scores
      const currentScores = room.currentJudgingScores || {};
      currentScores[judgeId] = scores;
      room.currentJudgingScores = currentScores;
      room.markModified('currentJudgingScores'); // Tell Mongoose the Mixed type changed

      await room.save();

      // Check if all eligible judges have submitted
      const eligibleJudges = room.participants.filter(p => p.userId.toString() !== room.activePlayerId.toString());
      const submittedJudges = Object.keys(currentScores).filter(id => id !== room.activePlayerId.toString());

      io.to(inviteCode).emit("judge-submitted", { judgeId, submittedCount: submittedJudges.length, totalJudges: eligibleJudges.length });

      // If all judges have submitted, tally the scores and advance the turn
      if (submittedJudges.length === eligibleJudges.length) {
        await tallyScoresAndAdvanceTurn(io, room);
      }

      callback?.({ success: true });
    } catch (err) {
      callback?.({ success: false, error: err.message });
    }
  });

  // Helper: Tally scores and advance
  const tallyScoresAndAdvanceTurn = async (io, room) => {
    const inviteCode = room.inviteCode;
    const activePlayer = room.participants.find(p => p.userId.toString() === room.activePlayerId.toString());
    const currentScores = room.currentJudgingScores || {};

    let totalPeerPoints = 0;
    let judgeCount = 0;

    // Aggregate points given to the active player
    Object.values(currentScores).forEach(judgeScores => {
      if (judgeScores[room.activePlayerId.toString()]) {
        totalPeerPoints += judgeScores[room.activePlayerId.toString()];
        judgeCount++;
      }
    });

    const avgPeerScore = judgeCount > 0 ? (totalPeerPoints / judgeCount) : 0;
    const finalRoundScore = room.activePlayerAiScore + avgPeerScore;

    // Update active player's total score
    activePlayer.currentRoundScore = finalRoundScore;
    activePlayer.totalMatchScore += finalRoundScore;

    // Capture the AI score before resetting it for the next turn.
    const aiScore = room.activePlayerAiScore;

    // Reset AI score for next turn
    room.activePlayerAiScore = 0;

    // Advance Turn
    room.currentTurnIndex += 1;

    if (room.currentTurnIndex >= room.participants.length) {
      room.currentTurnIndex = 0;
      room.currentRound += 1;
    }

    if (room.currentRound > room.settings.rounds) {
      room.matchState = "finished";
    } else {
      room.matchState = "coding"; // Auto-advance to next player's coding phase
      room.activePlayerId = room.participants[room.currentTurnIndex].userId;
    }

    await room.save();

    io.to(inviteCode).emit("turn-results", {
      activePlayerId: activePlayer.userId,
      activeUsername: activePlayer.username,
      aiScore, // The score before reset
      peerScore: avgPeerScore,
      finalRoundScore,
      totalMatchScore: activePlayer.totalMatchScore,
      nextMatchState: room.matchState,
      nextActivePlayerId: room.activePlayerId
    });

    // Trigger the summary if the game is over
    if (room.matchState === "finished") {
      await compileAndBroadcastLeaderboard(io, inviteCode);
    }
  };
};
