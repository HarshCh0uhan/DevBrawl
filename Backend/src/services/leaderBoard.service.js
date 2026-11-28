import { Room } from "../models/room.model.js";
import { User } from "../models/user.model.js";
import { generateText as groqGenerateText, isGroqAvailable } from "../utils/groq.js";
import { generateText as openrouterGenerateText, isOpenRouterAvailable } from "../utils/openrouter.js";

const generateCommentary = async (prompt) => {
  if (isGroqAvailable()) {
    try {
      console.log("🚀 Generating match commentary with Groq...");
      return await groqGenerateText({
        systemPrompt: "You are an elite, sarcastic, and competitive esports coding commentator for a platform called DevBrawl.",
        userPrompt: prompt,
        temperature: 0.7,
        maxTokens: 500,
      });
    } catch (err) {
      console.warn(`⚠️ Groq commentary failed: ${err.message}`);
    }
  }

  if (isOpenRouterAvailable()) {
    try {
      console.log("🔮 Generating match commentary with OpenRouter...");
      return await openrouterGenerateText({
        systemPrompt: "You are an elite, sarcastic, and competitive esports coding commentator for a platform called DevBrawl.",
        userPrompt: prompt,
        temperature: 0.7,
        maxTokens: 500,
      });
    } catch (err) {
      console.warn(`⚠️ OpenRouter commentary failed: ${err.message}`);
    }
  }

  throw new Error("No AI provider available for commentary");
};

const publishSummary = async (io, roomId, summary) => {
  io.to(roomId).emit("match-summary-ready", summary);
  // Persisted so a player who refreshes after the match still receives the
  // recap on rejoin (join-room replays Room.lastSummary).
  try {
    await Room.updateOne({ inviteCode: roomId }, { $set: { lastSummary: summary } });
  } catch (err) {
    console.warn(`⚠️ Could not persist match summary for ${roomId}: ${err.message}`);
  }
};

export const compileAndBroadcastLeaderboard = async (io, roomId) => {
  const formattedRoomId = roomId.toUpperCase();

  try {
    // Claim the one-time brawlPoints award. Late Phase-2 AI grading calls this
    // function again after the match ends, so the credit must be idempotent.
    const claimed = await Room.findOneAndUpdate(
      { inviteCode: formattedRoomId, pointsAwarded: { $ne: true } },
      { $set: { pointsAwarded: true } },
      { returnDocument: "after" }
    );
    const room = claimed || await Room.findOne({ inviteCode: formattedRoomId });

    if (!room) {
      console.error(`❌ Room ${formattedRoomId} not found for leaderboard.`);
      return;
    }

    // 1. Build leaderboard from participants
    const leaderboard = room.participants
      .map(p => ({
        _id: p.userId.toString(),
        username: p.username,
        totalMatchScore: p.totalMatchScore,
      }))
      .sort((a, b) => b.totalMatchScore - a.totalMatchScore);

    if (leaderboard.length === 0) {
      await publishSummary(io, formattedRoomId, {
        leaderboard: [],
        feedback: "The arena closed silently. No scores were logged.",
        winnerId: null,
        winnerName: null
      });
      return;
    }

    // 2. Award Brawl-Points globally
    // We use $inc to atomically add points to the User's account
    if (claimed) {
      for (const player of leaderboard) {
        if (player.totalMatchScore > 0) {
          await User.findByIdAndUpdate(player._id, {
            $inc: { brawlPoints: player.totalMatchScore }
          });
        }
      }
    }

    // 3. AI Commentary
    let roomFeedback = "Match concluded. Scores compiled.";
    try {
      const summaryText = leaderboard.map(p => `${p.username}: ${p.totalMatchScore} pts`).join(", ");
      const aiPrompt = `The match in Room ${formattedRoomId} has ended. Final scores: ${summaryText}. Provide a short, punchy, 3-sentence tactical feedback report. Keep the tone gaming-centric and fun!`;

      const commentary = await generateCommentary(aiPrompt);
      if (commentary) roomFeedback = commentary;
    } catch (aiErr) {
      console.warn(`⚠️ AI commentary skipped: ${aiErr.message}`);
      roomFeedback = "AI commentator is offline, but the scores speak for themselves!";
    }

    // 4. Broadcast the summary
    await publishSummary(io, formattedRoomId, {
      leaderboard,
      feedback: roomFeedback,
      winnerId: leaderboard[0]._id,
      winnerName: leaderboard[0].username
    });

    console.log(`🏆 Leaderboard broadcast complete for room ${formattedRoomId}`);

  } catch (err) {
    console.error("❌ Failed to compile leaderboard:", err.message);
    io.to(formattedRoomId).emit("match-summary-ready", {
      leaderboard: [],
      feedback: "Score compilation encountered an error.",
      winnerId: null,
      winnerName: null
    });
  }
};
