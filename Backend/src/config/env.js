import dotenv from "dotenv";

dotenv.config();

/**
 * Required vs optional policy (Phase 2).
 *
 * required - the app cannot serve its core purpose without it, so boot fails:
 *   MONGODB_URI          no database, no app
 *   ACCESS_TOKEN_SECRET  no JWT signing/verification, no auth
 *   REFRESH_TOKEN_SECRET reserved for the refresh-token flow (Phase 3+)
 *   RAPIDAPI_KEY         OneCompiler is the only live code executor
 *   RAPIDAPI_HOST        OneCompiler host
 *
 * optional - the related feature degrades gracefully with a default:
 *   PORT                 default 8000
 *   NODE_ENV             default "development" (log verbosity only)
 *   FRONTEND_URL         default http://localhost:5173 (CORS allow-list)
 *   ACCESS_TOKEN_EXPIRY  default "15m"
 *   REFRESH_TOKEN_EXPIRY default "7d"
 *   GROQ_API_KEY         default "" (AI fallback disabled)
 *   OPENROUTER_API_KEY   default "" (AI fallback disabled)
 *   AI_PROVIDER          default "auto"
 *   CLOUDINARY_*         default "" (avatar upload disabled)
 *   LIVEKIT_*            default "" (voice disabled)
 *   PRESENCE_GRACE_MS    default 10000
 */

const required = (key) => {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    console.error(`FATAL: Missing required env var: ${key}. See .env.example.`);
    process.exit(1);
  }
  return v;
};

const optional = (key, fallback) => process.env[key] || fallback;

const accessSecret = required("ACCESS_TOKEN_SECRET");
const refreshSecret = required("REFRESH_TOKEN_SECRET");

if (accessSecret === refreshSecret) {
  console.error("FATAL: ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be different.");
  process.exit(1);
}
if (accessSecret.length < 32 || refreshSecret.length < 32) {
  console.error("FATAL: ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must each be at least 32 characters.");
  process.exit(1);
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "8000")),
  mongoUri: required("MONGODB_URI"),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:5173"),

  accessTokenSecret: accessSecret,
  refreshTokenSecret: refreshSecret,
  accessTokenExpiry: optional("ACCESS_TOKEN_EXPIRY", "15m"),
  refreshTokenExpiry: optional("REFRESH_TOKEN_EXPIRY", "7d"),

  rapidApiKey: required("RAPIDAPI_KEY"),
  rapidApiHost: required("RAPIDAPI_HOST"),

  groqApiKey: optional("GROQ_API_KEY", ""),
  openrouterApiKey: optional("OPENROUTER_API_KEY", ""),
  aiProvider: optional("AI_PROVIDER", "auto"),

  cloudinaryCloudName: optional("CLOUDINARY_CLOUD_NAME", ""),
  cloudinaryApiKey: optional("CLOUDINARY_API_KEY", ""),
  cloudinaryApiSecret: optional("CLOUDINARY_API_SECRET", ""),

  livekitApiKey: optional("LIVEKIT_API_KEY", ""),
  livekitApiSecret: optional("LIVEKIT_API_SECRET", ""),
  livekitUrl: optional("LIVEKIT_URL", ""),

  presenceGraceMs: Number(optional("PRESENCE_GRACE_MS", "10000")),
};

export default env;
