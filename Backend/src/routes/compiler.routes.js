import { Router } from "express";
import { executeBrawlCode } from "../controllers/code.controller.js";
import { checkPistonHealth, getSupportedRuntimes } from "../utils/pistonExecutor.js";

const router = Router();

// POST: /api/v1/compiler/run-code
router.route("/run-code").post(executeBrawlCode);

// GET: /api/v1/compiler/health - Health check for load balancers
router.route("/health").get(async (req, res) => {
  const pistonHealthy = await checkPistonHealth();
  res.json({
    status: pistonHealthy ? "healthy" : "degraded",
    piston: pistonHealthy ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// GET: /api/v1/compiler/runtimes - List supported languages
router.route("/runtimes").get(async (req, res) => {
  try {
    const runtimes = await getSupportedRuntimes();
    res.json({ success: true, runtimes });
  } catch (err) {
    res.status(503).json({ success: false, error: err.message });
  }
});

export default router;