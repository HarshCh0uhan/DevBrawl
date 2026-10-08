import { generateText as groqGenerateText, isGroqAvailable } from "../utils/groq.js";
import { generateText as openrouterGenerateText, isOpenRouterAvailable } from "../utils/openrouter.js";
import { Submission } from "../model/submission.model.js";

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
      console.log("🔮 Generating match commentary with OpenRouter (Nemotron)...");
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

export const compileAndBroadcastLeaderboard = async (io, roomId) => {
  const formattedRoomId = roomId.toUpperCase();

  try {
    // 1. Aggregate best score per player
    const leaderboard = await Submission.aggregate([
      { $match: { roomId: formattedRoomId } },
      { $sort: { finalScore: -1 } },
      {
        $group: {
          _id: "$userId",
          username: { $first: "$username" },
          finalScore: { $first: "$finalScore" },
          testsPassed: { $first: "$testsPassed" },
          testsTotal: { $first: "$testsTotal" },
          sourceCode: { $first: "$sourceCode" }
        }
      },
      { $sort: { finalScore: -1 } }
    ]);

    if (leaderboard.length === 0) {
      io.to(formattedRoomId).emit("match-summary-ready", {
        leaderboard: [],
        feedback: "The arena closed silently. No submissions were logged.",
        winnerId: null,
        winnerName: null
      });
      return;
    }

    // 2. Try AI commentary — never let it block the leaderboard emit
    let roomFeedback = "Match concluded. Scores compiled from available submissions.";

    try {
      const codesSummary = leaderboard
        .map(p => `Player ${p.username}:\n\`\`\`\n${p.sourceCode}\n\`\`\``)
        .join("\n\n");

      const aiPrompt = `Review the following solutions submitted by players in Room ${formattedRoomId}:
${codesSummary}

Provide a short, punchy, 3-sentence tactical feedback report summarizing who had the most elegant approach, who wrote brute-force spaghetti code, and a brief tip on optimization. Keep the tone gaming-centric, punchy, and fun!`;

      const commentary = await generateCommentary(aiPrompt);
      if (commentary) {
        roomFeedback = commentary;
        console.log(`✅ AI commentary generated for room ${formattedRoomId}`);
      }
    } catch (aiErr) {
      console.warn(`⚠️ AI commentary skipped for room ${formattedRoomId}: ${aiErr.message}`);
      roomFeedback = "AI commentator is offline right now — but the scores speak for themselves!";
    }

    // 3. Always emit regardless of whether AI succeeded or failed
    io.to(formattedRoomId).emit("match-summary-ready", {
      leaderboard,
      feedback: roomFeedback,
      winnerId: leaderboard[0]._id.toString(),
      winnerName: leaderboard[0].username
    });

    console.log(`🏆 Leaderboard broadcast complete for room ${formattedRoomId}`);

  } catch (err) {
    console.error("❌ Failed to compile leaderboard:", err.message);
    io.to(formattedRoomId).emit("match-summary-ready", {
      leaderboard: [],
      feedback: "Score compilation encountered an error. Please check with the host.",
      winnerId: null,
      winnerName: null
    });
  }
};