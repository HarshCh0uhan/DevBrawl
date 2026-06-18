import mongoose from "mongoose";

// ─── Per-Test-Case Result Sub-schema ────────────────────────────────────────
const testResultSchema = new mongoose.Schema({
  testCaseIndex: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  actualOutput: { type: String, default: "" },
  executionTimeMs: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["Accepted", "Wrong Answer", "Runtime Error", "Time Limit Exceeded", "Compilation Error"],
    required: true,
  },
});

const submissionSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },

    // ── Submitted Code ────────────────────────────────────────────────────
    sourceCode: {
      type: String,
      required: true,
    },
    languageId: {
      type: Number, // 63=JS, 71=Python, 62=Java, 54=C++
      required: true,
    },

    // ── PHASE 1: Instant Scoring (test execution) ─────────────────────────
    // Populated synchronously the moment submission is judged.
    testResults: {
      type: [testResultSchema],
      default: [],
    },
    testsPassed: { type: Number, default: 0 },
    testsTotal: { type: Number, default: 0 },

    correctnessScore: { type: Number, default: 0 }, // 0-100, based on weighted test pass rate
    efficiencyScore: { type: Number, default: 0 },   // 0-100, based on avg execution time vs time limit

    phase1Status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    phase1CompletedAt: { type: Date },

    // ── PHASE 2: Async AI Enrichment (Claude review) ───────────────────────
    // Populated a few seconds later once Claude responds. Frontend should
    // treat these fields as "loading" until phase2Status === "completed".
    codeQualityScore: { type: Number, default: null },   // 0-100
    approachScore: { type: Number, default: null },      // 0-100, problem-solving evaluation
    aiFeedback: { type: String, default: null },          // human-readable feedback paragraph
    aiSummary: { type: String, default: null },           // short one-liner e.g. "Efficient sort, missing edge case"

    phase2Status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed"],
      default: "pending",
    },
    phase2CompletedAt: { type: Date },

    // ── Final Combined Score ────────────────────────────────────────────────
    // Recalculated once phase2 completes. Until then, this reflects a
    // provisional score based on phase 1 only (correctness + efficiency).
    finalScore: { type: Number, default: 0 }, // 0-100, weighted combination
    pointsAwarded: { type: Number, default: 0 }, // gamification points for this round

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ─── Scoring Weights (used by the controller when computing finalScore) ────
// Exported so both Phase 1 (provisional) and Phase 2 (final) calculations
// stay consistent.
export const SCORE_WEIGHTS = {
  correctness: 0.4,
  efficiency: 0.2,
  codeQuality: 0.2,
  approach: 0.2,
};
submissionSchema.index({ roomId: 1, userId: 1 });
export const Submission = mongoose.model("Submission", submissionSchema);