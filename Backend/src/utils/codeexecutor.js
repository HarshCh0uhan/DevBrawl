import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";

// ─── Concurrency Limiter ───────────────────────────────────────────────────
// Shared across BOTH "Run Code" and "Submit" (judge) — total Docker
// containers running at once across the whole server stays capped at 5,
// since each is equally expensive regardless of which feature triggered it.
const MAX_CONCURRENT = 5;
let activeContainers = 0;
const executionQueue = [];

const acquireSlot = () => {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeContainers < MAX_CONCURRENT) {
        activeContainers++;
        resolve();
      } else {
        executionQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
};

const releaseSlot = () => {
  activeContainers--;
  if (executionQueue.length > 0) {
    const next = executionQueue.shift();
    next();
  }
};

// ─── Per-User Rate Limiter ─────────────────────────────────────────────────
// Shared map — a user's "Run Code" clicks and "Submit" clicks count toward
// the same limit, since both spawn equally expensive containers.
const userRateMap = new Map();

export const isRateLimited = (userId, maxRequests = 10) => {
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!userRateMap.has(userId)) {
    userRateMap.set(userId, []);
  }

  const timestamps = userRateMap.get(userId);
  const recent = timestamps.filter((t) => now - t < windowMs);
  userRateMap.set(userId, recent);

  if (recent.length >= maxRequests) return true;

  recent.push(now);
  return false;
};

// ─── Language Config ───────────────────────────────────────────────────────
export const LANGUAGE_CONFIG = {
  63: {
    fileName: "main.js",
    dockerImage: "node:20-alpine",
    runCommand: (fileName) => ["node", `/code/${fileName}`],
    compileCommand: null,
  },
  71: {
    fileName: "main.py",
    dockerImage: "python:3.12-alpine",
    runCommand: (fileName) => ["python", `/code/${fileName}`],
    compileCommand: null,
  },
  62: {
    fileName: "Main.java",
    dockerImage: "openjdk:21-alpine",
    compileCommand: (fileName) => ["javac", `/code/${fileName}`],
    runCommand: () => ["java", "-cp", "/code", "Main"],
  },
  54: {
    fileName: "main.cpp",
    dockerImage: "gcc:13",
    compileCommand: (fileName) => [
      "sh",
      "-c",
      `g++ -O2 -o /tmp/a.out /code/${fileName} && /tmp/a.out`,
    ],
    runCommand: null,
  },
};

// ─── Core: Run a single Docker command, optionally piping stdin ───────────
// `stdin` is new — needed for judge mode where each test case feeds
// different input to the same compiled/interpreted program.
const runInDocker = (sandboxDir, dockerImage, command, { timeoutMs = 10000, stdin = null } = {}) => {
  return new Promise((resolve) => {
    const dockerArgs = [
      "run",
      "--rm",
      "-i", // keep stdin open so we can pipe input to the process
      "--network=none",
      "--user=nobody",
      "--security-opt=no-new-privileges",
      "--cap-drop=ALL",
      "--memory=128m",
      "--memory-swap=128m",
      "--cpus=0.5",
      "--pids-limit=64",
      "--read-only",
      "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
      "-v", `${sandboxDir}:/code:ro`,
      dockerImage,
      ...command,
    ];

    const child = spawn("docker", dockerArgs, { shell: false });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const startTime = Date.now();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const MAX_OUTPUT = 1 * 1024 * 1024; // 1MB cap

    child.stdout.on("data", (data) => {
      if (stdout.length < MAX_OUTPUT) stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      if (stderr.length < MAX_OUTPUT) stderr += data.toString();
    });

    // Pipe test case input to the process's stdin, then close it
    if (stdin !== null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on("close", (code) => {
      clearTimeout(timer);
      const executionTimeMs = Date.now() - startTime;
      resolve({ stdout, stderr, code, timedOut, executionTimeMs });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, code: -1, timedOut: false, executionTimeMs: 0 });
    });
  });
};

// ─── Public: Execute code with no stdin (used by "Run Code" button) ───────
export const executeCode = async (sourceCode, languageId, { timeoutMs = 10000 } = {}) => {
  const langConfig = LANGUAGE_CONFIG[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "brawl-"));

  try {
    const filePath = path.join(sandboxDir, langConfig.fileName);
    await fs.writeFile(filePath, sourceCode, "utf8");

    await acquireSlot();

    try {
      return await runSingleOrCompiled(sandboxDir, langConfig, languageId, null, timeoutMs);
    } finally {
      releaseSlot();
    }
  } finally {
    await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
  }
};

// ─── Public: Execute code against ONE test case (stdin → expected stdout) ──
// Used by the judge. Compiles once if needed, then runs with the given
// stdin. For languages requiring compilation (Java/C++), caller should
// use `executeAgainstTestCases` instead so compilation only happens once
// across all test cases rather than once per test case.
export const executeWithStdin = async (sourceCode, languageId, stdin, { timeoutMs = 10000 } = {}) => {
  const langConfig = LANGUAGE_CONFIG[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "brawl-"));

  try {
    const filePath = path.join(sandboxDir, langConfig.fileName);
    await fs.writeFile(filePath, sourceCode, "utf8");

    await acquireSlot();

    try {
      return await runSingleOrCompiled(sandboxDir, langConfig, languageId, stdin, timeoutMs);
    } finally {
      releaseSlot();
    }
  } finally {
    await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
  }
};

// ─── Internal: handles compile-then-run vs interpret-and-run uniformly ────
const runSingleOrCompiled = async (sandboxDir, langConfig, languageId, stdin, timeoutMs) => {
  // C++: single sh -c does compile + run together, stdin piped to that
  if (languageId === 54) {
    return await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.compileCommand(langConfig.fileName), {
      timeoutMs,
      stdin,
    });
  }

  // Java: compile first (no stdin needed), then run with stdin
  if (languageId === 62) {
    const compileResult = await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.compileCommand(langConfig.fileName), {
      timeoutMs: 15000,
      stdin: null,
    });

    if (compileResult.code !== 0) {
      return { ...compileResult, compilationFailed: true };
    }

    return await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.runCommand(langConfig.fileName), {
      timeoutMs,
      stdin,
    });
  }

  // JS / Python: just run with stdin
  return await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.runCommand(langConfig.fileName), {
    timeoutMs,
    stdin,
  });
};

/**
 * Executes code against MULTIPLE test cases efficiently.
 * For compiled languages (Java/C++), compiles ONCE and reuses the compiled
 * binary/class across all test cases instead of recompiling per test case.
 *
 * Returns an array of results, one per test case, each with:
 * { stdout, stderr, code, timedOut, executionTimeMs, compilationFailed? }
 */
export const executeAgainstTestCases = async (sourceCode, languageId, testCases, { timeoutMs = 10000 } = {}) => {
  const langConfig = LANGUAGE_CONFIG[languageId];
  if (!langConfig) {
    throw new Error(`Unsupported language ID: ${languageId}`);
  }

  const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "brawl-"));

  try {
    const filePath = path.join(sandboxDir, langConfig.fileName);
    await fs.writeFile(filePath, sourceCode, "utf8");

    await acquireSlot();

    try {
      // ── Compiled languages: compile once, run N times ───────────────────
      if (languageId === 62) {
        // Java: compile once
        const compileResult = await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.compileCommand(langConfig.fileName), {
          timeoutMs: 15000,
          stdin: null,
        });

        if (compileResult.code !== 0) {
          // Compilation failed — every test case fails identically
          return testCases.map(() => ({ ...compileResult, compilationFailed: true }));
        }

        // Run compiled class against each test case's stdin
        const results = [];
        for (const tc of testCases) {
          const result = await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.runCommand(langConfig.fileName), {
            timeoutMs,
            stdin: tc.input,
          });
          results.push(result);
        }
        return results;
      }

      if (languageId === 54) {
        // C++: each run recompiles via the sh -c chain (g++ is fast enough
        // for typical interview-sized programs that this is acceptable;
        // avoids needing a persistent compiled binary across containers
        // since each container is ephemeral with --rm)
        const results = [];
        for (const tc of testCases) {
          const result = await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.compileCommand(langConfig.fileName), {
            timeoutMs,
            stdin: tc.input,
          });
          results.push(result);
        }
        return results;
      }

      // ── Interpreted languages: just run N times ──────────────────────────
      const results = [];
      for (const tc of testCases) {
        const result = await runInDocker(sandboxDir, langConfig.dockerImage, langConfig.runCommand(langConfig.fileName), {
          timeoutMs,
          stdin: tc.input,
        });
        results.push(result);
      }
      return results;
    } finally {
      releaseSlot();
    }
  } finally {
    await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
  }
};