import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, index: true },
    // One family per login session; rotation keeps the family, reuse revokes it.
    family: { type: String, required: true },
    deviceInfo: { type: String, default: "" },
    ip: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshToken",
      default: null,
    },
    revokedAt: { type: Date, default: null },
    revokedReason: {
      type: String,
      enum: ["logout", "rotation", "reuse_detected", "expired_cleanup"],
      default: null,
    },
  },
  { timestamps: true }
);

// TTL index: MongoDB removes the document once expiresAt is reached.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Fast family-wide revocation when reuse is detected.
refreshTokenSchema.index({ family: 1 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
