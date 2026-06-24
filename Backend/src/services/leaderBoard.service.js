
import { GoogleGenAI } from "@google/genai";
import { Submission } from "../model/submission.model.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const compileAndBroadcastLeaderboard = async (io, roomId) => {
  const formattedRoomId = roomId.toUpperCase();

  try {
    // 1. Aggregate best score per player — includes provisional (phase2 failed) scores too
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

    // 2. Try Gemini commentary — but never let it block the leaderboard emit
    let roomFeedback = "Match concluded. Scores compiled from available submissions.";

    try {
      const codesSummary = leaderboard
        .map(p => `Player ${p.username}:\n\`\`\`\n${p.sourceCode}\n\`\`\``)
        .join("\n\n");

      const aiPrompt = `You are an elite, sarcastic, and competitive esports coding commentator for a platform called DevBrawl. 
Review the following solutions submitted by players in Room ${formattedRoomId}:
${codesSummary}

Provide a short, punchy, 3-sentence tactical feedback report summarizing who had the most elegant approach, who wrote brute-force spaghetti code, and a brief tip on optimization. Keep the tone gaming-centric, punchy, and fun!`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: aiPrompt
      });

      if (aiResponse?.text) {
        roomFeedback = aiResponse.text;
        console.log(`✅ Gemini commentary generated for room ${formattedRoomId}`);
      }

    } catch (geminiErr) {
      // Gemini failed — log it but DO NOT rethrow, leaderboard still fires below
      console.warn(`⚠️ Gemini commentary skipped for room ${formattedRoomId}: ${geminiErr.message}`);
      roomFeedback = "AI commentator is offline right now — but the scores speak for themselves!";
    }

    // 3. Always emit regardless of whether Gemini succeeded or failed
    io.to(formattedRoomId).emit("match-summary-ready", {
      leaderboard,
      feedback: roomFeedback,
      winnerId: leaderboard[0]._id.toString(),
      winnerName: leaderboard[0].username
    });

    console.log(`🏆 Leaderboard broadcast complete for room ${formattedRoomId}`);

  } catch (err) {
    // DB aggregation itself failed — last resort emit so frontend doesn't hang
    console.error("❌ Failed to compile leaderboard:", err.message);
    io.to(formattedRoomId).emit("match-summary-ready", {
      leaderboard: [],
      feedback: "Score compilation encountered an error. Please check with the host.",
      winnerId: null,
      winnerName: null
    });
  }
};