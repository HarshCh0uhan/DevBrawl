import { executeCode, isRateLimited } from "../utils/codeExecutor.js";
import { wrapCode } from "./codeWrapper.js";

/**
 * Manual "Run Code" button handler — no test cases, just executes
 * whatever the user typed and returns raw stdout/stderr.
 */
export const executeBrawlCode = async (req, res) => {
  const { sourceCode, languageId } = req.body;
  const userId = req.user?._id?.toString() || req.ip;

  if (!sourceCode || !languageId) {
    return res.status(400).json({
      success: false,
      status: "Error",
      output: "Missing sourceCode or languageId",
    });
  }

  if (isRateLimited(userId)) {
    return res.status(429).json({
      success: false,
      status: "Rate Limited",
      output: "Too many executions. Max 10 per minute.",
    });
  }

  if (Buffer.byteLength(sourceCode, "utf8") > 100 * 1024) {
    return res.status(400).json({
      success: false,
      status: "Error",
      output: "Source code too large. Max 100KB.",
    });
  }

  try {
    const finalCode = wrapCode(sourceCode, languageId);
    const result = await executeCode(finalCode, languageId);

    if (result.compilationFailed) {
      return res.status(200).json({
        success: false,
        status: "Compilation Error",
        output: result.stderr || "Compilation failed",
      });
    }

    if (result.timedOut) {
      return res.status(200).json({
        success: false,
        status: "Time Limit Exceeded",
        output: "Your code exceeded the 10 second time limit.",
      });
    }

    if (result.code !== 0) {
      return res.status(200).json({
        success: false,
        status: "Runtime Error",
        output: result.stderr || result.stdout || "Runtime error occurred",
      });
    }

    return res.status(200).json({
      success: true,
      status: "Accepted",
      output: result.stdout || "(no output)",
      stderr: result.stderr || null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: "Server Error",
      output: err.message,
    });
  }
};