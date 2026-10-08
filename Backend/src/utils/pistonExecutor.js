import fetch from "node-fetch";

// ─── Configuration ────────────────────────────────────────────────────────────
const PISTON_API_URL = process.env.PISTON_API_URL || "https://emkc.org/api/v2/piston";
const MAX_CONCURRENT = 5;
const USER_RATE_LIMIT = 10; // per minute

// ─── Concurrency Limiter ──────────────────────────────────────────────────────
let activeRequests = 0;
const executionQueue = [];

const acquireSlot = () => new Promise((resolve) => {
  const tryAcquire = () => {
    if (activeRequests < MAX_CONCURRENT) {
      activeRequests++;
      resolve();
    } else {
      executionQueue.push(tryAcquire);
    }
  };
  tryAcquire();
});

const releaseSlot = () => {
  activeRequests--;
  if (executionQueue.length > 0) {
    const next = executionQueue.shift();
    next();
  }
};

// ─── Per-User Rate Limiter ────────────────────────────────────────────────────
const userRateMap = new Map();

export const isRateLimited = (userId, maxRequests = USER_RATE_LIMIT) => {
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!userRateMap.has(userId)) userRateMap.set(userId, []);
  const timestamps = userRateMap.get(userId).filter(t => now - t < windowMs);
  userRateMap.set(userId, timestamps);

  if (timestamps.length >= maxRequests) return true;
  timestamps.push(now);
  return false;
};

// ─── Language Mapping (Judge0 IDs → Piston Runtime Names) ─────────────────────
export const PISTON_LANGUAGES = {
  63: { language: "javascript", version: "20.0.0" },      // Node.js
  71: { language: "python", version: "3.12.0" },          // Python
  62: { language: "java", version: "21.0.0" },            // Java
  54: { language: "cpp", version: "13.2.0" },             // C++
  60: { language: "go", version: "1.22.0" },              // Go
  73: { language: "rust", version: "1.77.0" },            // Rust
};

// ─── File Names for Each Language ─────────────────────────────────────────────
const FILE_NAMES = {
  63: "main.js",
  71: "main.py",
  62: "Main.java",
  54: "main.cpp",
  60: "main.go",
  73: "main.rs",
};

// ─── Core: Execute via Piston API ─────────────────────────────────────────────
const executePiston = async (sourceCode, languageId, stdin = "") => {
  const langConfig = PISTON_LANGUAGES[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  await acquireSlot();

  try {
    const response = await fetch(`${PISTON_API_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ name: FILE_NAMES[languageId], content: sourceCode }],
        stdin,
        compile_timeout: 10000,
        run_timeout: 10000,
        compile_memory_limit: -1,
        run_memory_limit: -1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Piston API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    
    // Normalize Piston response to match our existing format
    const compile = data.compile || { code: 0, stdout: "", stderr: "" };
    const run = data.run || { code: 0, stdout: "", stderr: "", output: "" };

    // Compilation error (for compiled languages)
    if (compile.code !== 0) {
      return {
        stdout: "",
        stderr: compile.stderr || compile.output || "Compilation failed",
        code: compile.code,
        timedOut: false,
        executionTimeMs: 0,
        compilationFailed: true,
      };
    }

    // Runtime error / TLE / Success
    const timedOut = run.signal === "SIGKILL" || run.signal === "SIGXCPU";
    const stdout = run.stdout || run.output || "";
    const stderr = run.stderr || "";

    return {
      stdout,
      stderr,
      code: run.code,
      timedOut,
      executionTimeMs: run.time || 0,
      compilationFailed: false,
    };
  } finally {
    releaseSlot();
  }
};

// ─── Public: Execute code (no stdin) - for "Run Code" button ──────────────────
export const executeCode = async (sourceCode, languageId, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }
  return executePiston(sourceCode, languageId, "");
};

// ─── Public: Execute with stdin (single test case) ────────────────────────────
export const executeWithStdin = async (sourceCode, languageId, stdin, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }
  return executePiston(sourceCode, languageId, stdin);
};

// ─── Public: Execute against multiple test cases ──────────────────────────────
export const executeAgainstTestCases = async (sourceCode, languageId, testCases, { timeoutMs = 10000 } = {}) => {
  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    throw new Error("Source code too large. Max 100KB.");
  }

  const results = [];
  for (const tc of testCases) {
    const result = await executePiston(sourceCode, languageId, tc.input);
    results.push(result);
  }
  return results;
};

// ─── Health Check ─────────────────────────────────────────────────────────────
export const checkPistonHealth = async () => {
  try {
    const res = await fetch(`${PISTON_API_URL}/runtimes`, { timeout: 5000 });
    return res.ok;
  } catch {
    return false;
  }
};

export const getSupportedRuntimes = async () => {
  const res = await fetch(`${PISTON_API_URL}/runtimes`);
  return res.json();
};