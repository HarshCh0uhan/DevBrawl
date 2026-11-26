import jwt from "jsonwebtoken";
import { ApiError } from "./apiError.js";
import { env } from "../config/env.js";

// Secrets and expiry now come from the single validated config module.
export const getAccessSecret = () => env.accessTokenSecret;

export const getAccessExpiry = () => env.accessTokenExpiry;

/**
 * Verifies an access token and always fails with an ApiError(401), never a raw
 * jsonwebtoken error. A raw TokenExpiredError has no statusCode, which made the
 * error middleware answer 500 and kept the frontend 401 handler from firing.
 * `code` lets the client tell an expired token from an invalid one.
 */
export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, getAccessSecret());
  } catch (err) {
    const expired = err?.name === "TokenExpiredError";
    const apiError = new ApiError(
      401,
      expired ? "Session expired. Please log in again." : "Invalid access token"
    );
    apiError.code = expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID";
    throw apiError;
  }
};
