import crypto from "crypto";
import jwt from "jsonwebtoken";
import { RefreshToken } from "../models/refreshToken.model.js";
import { ApiError } from "../utils/apiError.js";
import { env } from "../config/env.js";

const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");

const parseDuration = (str) => {
  const m = /^(\d+)([smhd])$/.exec(str);
  if (!m) throw new Error(`Invalid duration: ${str}`);
  const n = Number(m[1]);
  const unit = m[2];
  const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return n * ms;
};

export const signAccessToken = (user) =>
  jwt.sign(
    { _id: user._id, username: user.username, email: user.email },
    env.accessTokenSecret,
    { expiresIn: env.accessTokenExpiry }
  );

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, env.accessTokenSecret);
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    const apiErr = new ApiError(401, expired ? "Session expired" : "Invalid token");
    apiErr.code = expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    throw apiErr;
  }
};

export const createRefreshToken = async (
  userId,
  { deviceInfo = "", ip = "" } = {}
) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const record = await RefreshToken.create({
    userId,
    tokenHash: hash(raw),
    family: crypto.randomUUID(),
    deviceInfo,
    ip,
    expiresAt: new Date(Date.now() + parseDuration(env.refreshTokenExpiry)),
  });
  return { raw, record };
};

export const rotateRefreshToken = async (
  raw,
  { deviceInfo = "", ip = "" } = {}
) => {
  const record = await RefreshToken.findOne({ tokenHash: hash(raw) });
  if (!record) throw new ApiError(401, "Invalid refresh token");
  if (record.expiresAt < new Date()) throw new ApiError(401, "Refresh token expired");

  // Reuse detection must run before the revoked check: a rotated token is both
  // used and revoked, and reusing it must revoke the whole family.
  if (record.usedAt !== null) {
    await RefreshToken.updateMany(
      { family: record.family },
      { revokedAt: new Date(), revokedReason: "reuse_detected" }
    );
    throw new ApiError(401, "Refresh token reused - all sessions in this family revoked");
  }

  if (record.revokedAt) throw new ApiError(401, "Refresh token revoked");

  const newRaw = crypto.randomBytes(48).toString("base64url");
  const newRecord = await RefreshToken.create({
    userId: record.userId,
    tokenHash: hash(newRaw),
    family: record.family,
    deviceInfo,
    ip,
    expiresAt: new Date(Date.now() + parseDuration(env.refreshTokenExpiry)),
  });

  record.usedAt = new Date();
  record.replacedBy = newRecord._id;
  record.revokedReason = "rotation";
  record.revokedAt = new Date();
  await record.save();

  return { raw: newRaw, record: newRecord };
};

export const revokeRefreshToken = async (raw, reason = "logout") => {
  await RefreshToken.findOneAndUpdate(
    { tokenHash: hash(raw) },
    { revokedAt: new Date(), revokedReason: reason }
  );
};

export const revokeAllUserTokens = async (userId, reason = "logout") => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason }
  );
};
