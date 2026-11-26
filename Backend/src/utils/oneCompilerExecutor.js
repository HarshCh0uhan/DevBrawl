import fetch from "node-fetch";
import { env } from "../config/env.js";
import { LANG } from "../constants/languages.js";

// ─── Configuration ────────────────────────────────────────────────────────────
// OneCompiler's sandbox currently reports hard-killed ~5s executions as success
// with empty output, so normalize that provider-side limit to a timeout result.
const ONECOMPILER_RUNTIME_LIMIT_MS = 5000;

// ─── Language Mapping (Judge0 IDs → OneCompiler language & file names) ────────
const ONECOMPILER_LANGUAGES = {
  [LANG.JS]: { language: "javascript", fileName: "main.js" },
  [LANG.PYTHON]: { language: "python", fileName: "main.py" },
  [LANG.JAVA]: { language: "java", fileName: "Main.java" },
  [LANG.CPP]: { language: "cpp", fileName: "main.cpp" },
  [LANG.GO]: { language: "go", fileName: "main.go" },
  [LANG.RUST]: { language: "rust", fileName: "main.rs" },
};

// ─── Core: Execute via OneCompiler API ────────────────────────────────────────
const executeOneCompiler = async (sourceCode, languageId, stdin = "", timeoutMs = 10000) => {
  // Validate env vars at call time (not import time) so health checks don't crash
  if (!env.rapidApiKey || !env.rapidApiHost) {
    throw new Error("RAPIDAPI_KEY / RAPIDAPI_HOST not configured");
  }

  const langConfig = ONECOMPILER_LANGUAGES[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  try {
    const response = await fetch(`https://${env.rapidApiHost}/api/v1/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-RapidAPI-Key": env.rapidApiKey,
        "X-RapidAPI-Host": env.rapidApiHost,
      },
      body: JSON.stringify({
        language: langConfig.language,
        stdin,
        files: [{ name: langConfig.fileName, content: sourceCode }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
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

    // Normalize OneCompiler response to match our existing format.
    const exception = data.exception || "";
    const stderr = data.stderr || "";
    const stdout = data.stdout || "";
    const executionTimeMs = data.executionTime || 0;

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

    const hitSilentRuntimeLimit =
      data.status === "success" &&
      stdout.length === 0 &&
      stderr.length === 0 &&
      executionTimeMs >= ONECOMPILER_RUNTIME_LIMIT_MS;

    if (hitSilentRuntimeLimit) {
      return {
        stdout: "",
        stderr: `Execution exceeded OneCompiler's ${ONECOMPILER_RUNTIME_LIMIT_MS}ms runtime limit`,
        code: 124,
        timedOut: true,
        executionTimeMs,
        compilationFailed: false,
      };
    }

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

    return {
      stdout: data.stdout || "",
      stderr: "",
      code: 0,
      timedOut: false,
      executionTimeMs: data.executionTime || 0,
      compilationFailed: false,
    };
  } catch (err) {
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      return {
        stdout: "",
        stderr: `Execution exceeded ${timeoutMs}ms`,
        code: 124,
        timedOut: true,
        executionTimeMs: timeoutMs,
        compilationFailed: false,
      };
    }
    throw err;
  }
};

// Caller must validate sourceCode and languageId before execution.
export const executeCode = async (sourceCode, languageId, { timeoutMs = 10000 } = {}) => {
  return executeOneCompiler(sourceCode, languageId, "", timeoutMs);
};

// Caller must validate sourceCode and languageId before execution.
export const executeWithStdin = async (sourceCode, languageId, stdin, { timeoutMs = 10000 } = {}) => {
  return executeOneCompiler(sourceCode, languageId, stdin, timeoutMs);
};

// Caller must validate sourceCode and languageId before execution.
export const executeAgainstTestCases = async (sourceCode, languageId, testCases, { timeoutMs = 10000 } = {}) => {
  const results = [];
  for (const tc of testCases) {
    const result = await executeOneCompiler(sourceCode, languageId, tc.input, timeoutMs);
    results.push(result);
  }
  return results;
};
