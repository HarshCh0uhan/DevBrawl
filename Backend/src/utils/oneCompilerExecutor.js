import fetch from "node-fetch";

// ─── Configuration ────────────────────────────────────────────────────────────
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST;

if (!RAPIDAPI_KEY || !RAPIDAPI_HOST) {
  throw new Error(
    "Missing required environment variables: RAPIDAPI_KEY and RAPIDAPI_HOST must be set for OneCompiler executor"
  );
}

const ONCOMPILER_API_URL = `https://${RAPIDAPI_HOST}/api/v1/run`;
const MAX_SOURCE_SIZE = 100 * 1024; // 100KB
const USER_RATE_LIMIT = 10; // per minute

// ─── Per-User Rate Limiter ────────────────────────────────────────────────────
const userRateMap = new Map();

export const isRateLimited = (userId, maxRequests = USER_RATE_LIMIT) => {
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!userRateMap.has(userId)) userRateMap.set(userId, []);
  const timestamps = userRateMap.get(userId).filter((t) => now - t < windowMs);
  userRateMap.set(userId, timestamps);

  if (timestamps.length >= maxRequests) return true;
  timestamps.push(now);
  return false;
};

// ─── Language Mapping (Judge0 IDs → OneCompiler language & file names) ────────
const ONECOMPILER_LANGUAGES = {
  63: { language: "javascript", fileName: "main.js" },     // JavaScript
  71: { language: "python", fileName: "main.py" },         // Python
  62: { language: "java", fileName: "Main.java" },         // Java (must be Main.java)
  54: { language: "cpp", fileName: "main.cpp" },           // C++
  60: { language: "go", fileName: "main.go" },             // Go
  73: { language: "rust", fileName: "main.rs" },           // Rust
};

// ─── Core: Execute via OneCompiler API ────────────────────────────────────────
const executeOneCompiler = async (sourceCode, languageId, stdin = "") => {
  const langConfig = ONECOMPILER_LANGUAGES[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  const response = await fetch(`https://${RAPIDAPI_HOST}/api/v1/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
    body: JSON.stringify({
      language: langConfig.language,
      stdin,
      files: [{ name: langConfig.fileName, content: sourceCode }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OneCompiler API error (${response.status}): ${err}`);
  }

  const data = await response.json();

  // Log quota remaining for monitoring
  if (typeof data.limitRemaining === "number") {
    console.log(`📊 OneCompiler quota remaining: ${data.limitRemaining}`);
  }

  // Normalize OneCompiler response to match our existing format
  // OneCompiler uses `exception` for compilation errors, `stderr` for runtime errors
  const exception = data.exception || "";
  const stderr = data.stderr || "";
  const stdout = data.stdout || "";
  const executionTimeMs = data.executionTime || 0;

  // Compilation error detection: check `exception` for "compil" (case-insensitive)
  const isCompilationError = exception.toLowerCase().includes("compil");

  if (isCompilationError) {
    return {
      stdout: "",
      stderr: exception || "Compilation failed",
      code: 1,
      timedOut: false,
      executionTimeMs: 0,
      compilationFailed: true,
    };
  }

  // Runtime error: non-zero exit or stderr present
  const hasRuntimeError = data.status !== "success" || stderr.length > 0;

  if (hasRuntimeError) {
    return {
      stdout,
      stderr: stderr || exception || "Runtime error",
      code: 1,
      timedOut: false,
      executionTimeMs,
      compilationFailed: false,
    };
  }

  // Success
  return {
    stdout: data.stdout || "",
    stderr: "",
    code: 0,
    timedOut: false,
    executionTimeMs: data.executionTime || 0,
    compilationFailed: false,
  };
};

// ─── Public: Execute code (no stdin) - for "Run Code" button ──────────────────
export const executeCode = async (sourceCode, languageId, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }
  return executeOneCompiler(sourceCode, languageId, "");
};

// ─── Public: Execute with stdin (single test case) ────────────────────────────
export const executeWithStdin = async (sourceCode, languageId, stdin, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }
  return executeOneCompiler(sourceCode, languageId, stdin);
};

// ─── Public: Execute against multiple test cases ──────────────────────────────
export const executeAgainstTestCases = async (sourceCode, languageId, testCases, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }

  const results = [];
  for (const tc of testCases) {
    const result = await executeOneCompiler(sourceCode, languageId, tc.input);
    results.push(result);
  }
  return results;
};

// ─── Rate Limiter Export ──────────────────────────────────────────────────────
// (already exported above)