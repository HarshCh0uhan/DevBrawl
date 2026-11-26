import { env } from "./env.js";

const isProd = env.nodeEnv === "production";

export const refreshCookieBase = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/api/v1/auth",
};

export const refreshCookieOptions = {
  ...refreshCookieBase,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
