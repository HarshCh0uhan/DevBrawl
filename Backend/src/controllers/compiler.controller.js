// import { spawn } from "child_process";
// import fs from "fs/promises";
// import path from "path";
// import os from "os";
// import { wrapCode } from "./codeWrapper.js";

// // ─── Concurrency Limiter ───────────────────────────────────────────────────
// const MAX_CONCURRENT = 5;
// let activeContainers = 0;
// const executionQueue = [];

// const acquireSlot = () => {
//   return new Promise((resolve) => {
//     const tryAcquire = () => {
//       if (activeContainers < MAX_CONCURRENT) {
//         activeContainers++;
//         resolve();
//       } else {
//         executionQueue.push(tryAcquire);
//       }
//     };
//     tryAcquire();
//   });
// };

// const releaseSlot = () => {
//   activeContainers--;
//   if (executionQueue.length > 0) {
//     const next = executionQueue.shift();
//     next();
//   }
// };

// // ─── Per-User Rate Limiter ─────────────────────────────────────────────────
// const userRateMap = new Map();

// const isRateLimited = (userId) => {
//   const now = Date.now();
//   const windowMs = 60 * 1000;
//   const maxRequests = 10;

//   if (!userRateMap.has(userId)) {
//     userRateMap.set(userId, []);
//   }

//   const timestamps = userRateMap.get(userId);
//   const recent = timestamps.filter((t) => now - t < windowMs);
//   userRateMap.set(userId, recent);

//   if (recent.length >= maxRequests) return true;

//   recent.push(now);
//   return false;
// };

// // ─── Language Config ───────────────────────────────────────────────────────
// const LANGUAGE_CONFIG = {
//   63: {
//     fileName: "main.js",
//     dockerImage: "node:20-alpine",
//     runCommand: (fileName) => ["node", `/code/${fileName}`],
//     compileCommand: null,
//   },
//   71: {
//     fileName: "main.py",
//     dockerImage: "python:3.12-alpine",
//     runCommand: (fileName) => ["python", `/code/${fileName}`],
//     compileCommand: null,
//   },
//   62: {
//     fileName: "Main.java",
//     dockerImage: "openjdk:21-alpine",
//     compileCommand: (fileName) => ["javac", `/code/${fileName}`],
//     runCommand: () => ["java", "-cp", "/code", "Main"],
//   },
//   54: {
//     fileName: "main.cpp",
//     dockerImage: "gcc:13",
//     compileCommand: (fileName) => [
//       "sh",
//       "-c",
//       `g++ -O2 -o /tmp/a.out /code/${fileName} && /tmp/a.out`,
//     ],
//     runCommand: null,
//   },
// };

// // ─── Helper: Run Docker Command ────────────────────────────────────────────
// const runInDocker = (sandboxDir, dockerImage, command, timeoutMs = 10000) => {
//   return new Promise((resolve) => {
//     const dockerArgs = [
//       "run",
//       "--rm",
//       "--network=none",
//       "--user=nobody",
//       "--security-opt=no-new-privileges",
//       "--cap-drop=ALL",
//       "--memory=128m",
//       "--memory-swap=128m",
//       "--cpus=0.5",
//       "--pids-limit=64",
//       "--read-only",
//       "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
//       "-v", `${sandboxDir}:/code:ro`,
//       dockerImage,
//       ...command,
//     ];

//     const child = spawn("docker", dockerArgs, { shell: false });

//     let stdout = "";
//     let stderr = "";
//     let timedOut = false;

//     const timer = setTimeout(() => {
//       timedOut = true;
//       child.kill("SIGKILL");
//     }, timeoutMs);

//     const MAX_OUTPUT = 1 * 1024 * 1024; // 1MB cap

//     child.stdout.on("data", (data) => {
//       if (stdout.length < MAX_OUTPUT) stdout += data.toString();
//     });

//     child.stderr.on("data", (data) => {
//       if (stderr.length < MAX_OUTPUT) stderr += data.toString();
//     });

//     child.on("close", (code) => {
//       clearTimeout(timer);
//       resolve({ stdout, stderr, code, timedOut });
//     });

//     child.on("error", (err) => {
//       clearTimeout(timer);
//       resolve({ stdout, stderr: err.message, code: -1, timedOut: false });
//     });
//   });
// };

// // ─── Main Controller ───────────────────────────────────────────────────────
// export const executeBrawlCode = async (req, res) => {
//   const { sourceCode, languageId } = req.body;
//   const userId = req.user?._id?.toString() || req.ip;

//   // ── Validation ─────────────────────────────────────────────────────────
//   if (!sourceCode || !languageId) {
//     return res.status(400).json({
//       success: false,
//       status: "Error",
//       output: "Missing sourceCode or languageId",
//     });
//   }

//   const langConfig = LANGUAGE_CONFIG[languageId];
//   if (!langConfig) {
//     return res.status(400).json({
//       success: false,
//       status: "Error",
//       output: `Unsupported language ID: ${languageId}. Supported: 63 (JS), 71 (Python), 62 (Java), 54 (C++)`,
//     });
//   }

//   // ── Rate Limiting ───────────────────────────────────────────────────────
//   if (isRateLimited(userId)) {
//     return res.status(429).json({
//       success: false,
//       status: "Rate Limited",
//       output: "Too many executions. Max 10 per minute.",
//     });
//   }

//   // ── Source Code Size Limit ──────────────────────────────────────────────
//   if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
//     return res.status(400).json({
//       success: false,
//       status: "Error",
//       output: "Source code too large. Max 100KB.",
//     });
//   }

//   // ── Auto-wrap Code ──────────────────────────────────────────────────────
//   // Handles boilerplate so users can focus on logic
//   const finalCode = wrapCode(sourceCode, languageId);

//   // ── Create Sandbox Directory ────────────────────────────────────────────
//   const sandboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "brawl-"));

//   try {
//     const filePath = path.join(sandboxDir, langConfig.fileName);
//     await fs.writeFile(filePath, finalCode, "utf8");

//     // ── Acquire concurrency slot (queues if 5 already running) ─────────────
//     await acquireSlot();

//     let result;

//     try {
//       // ── C++: compile + run in single sh -c ─────────────────────────────
//       if (languageId === 54) {
//         result = await runInDocker(
//           sandboxDir,
//           langConfig.dockerImage,
//           langConfig.compileCommand(langConfig.fileName),
//           10000
//         );
//       }

//       // ── Java: compile first, then run ───────────────────────────────────
//       else if (languageId === 62) {
//         const compileResult = await runInDocker(
//           sandboxDir,
//           langConfig.dockerImage,
//           langConfig.compileCommand(langConfig.fileName),
//           15000
//         );

//         if (compileResult.code !== 0) {
//           releaseSlot();
//           await fs.rm(sandboxDir, { recursive: true, force: true });

//           return res.status(200).json({
//             success: false,
//             status: "Compilation Error",
//             output: compileResult.stderr || "Compilation failed",
//           });
//         }

//         result = await runInDocker(
//           sandboxDir,
//           langConfig.dockerImage,
//           langConfig.runCommand(langConfig.fileName),
//           10000
//         );
//       }

//       // ── JS / Python: just run ───────────────────────────────────────────
//       else {
//         result = await runInDocker(
//           sandboxDir,
//           langConfig.dockerImage,
//           langConfig.runCommand(langConfig.fileName),
//           10000
//         );
//       }
//     } finally {
//       releaseSlot();
//     }

//     await fs.rm(sandboxDir, { recursive: true, force: true });

//     // ── TLE ─────────────────────────────────────────────────────────────
//     if (result.timedOut) {
//       return res.status(200).json({
//         success: false,
//         status: "Time Limit Exceeded",
//         output: "Your code exceeded the 10 second time limit.",
//       });
//     }

//     // ── Runtime Error ────────────────────────────────────────────────────
//     if (result.code !== 0) {
//       return res.status(200).json({
//         success: false,
//         status: "Runtime Error",
//         output: result.stderr || result.stdout || "Runtime error occurred",
//       });
//     }

//     // ── Success ──────────────────────────────────────────────────────────
//     return res.status(200).json({
//       success: true,
//       status: "Accepted",
//       output: result.stdout || "(no output)",
//       stderr: result.stderr || null,
//     });

//   } catch (err) {
//     releaseSlot();
//     await fs.rm(sandboxDir, { recursive: true, force: true }).catch(() => {});

//     return res.status(500).json({
//       success: false,
//       status: "Server Error",
//       output: err.message,
//     });
//   }
// };

