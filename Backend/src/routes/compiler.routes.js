import { Router } from "express";
import { executeBrawlCode } from "../controllers/code.controller.js";

const router = Router();

// POST: /api/v1/compiler/run-code
router.route("/run-code").post(executeBrawlCode);

// GET: /api/v1/compiler/health - Health check
router.route("/health").get((req, res) => {
  const configured = !!process.env.RAPIDAPI_KEY && !!process.env.RAPIDAPI_HOST;
  res.json({
    status: configured ? "healthy" : "degraded",
    executor: "onecompiler",
    configured,
    timestamp: new Date().toISOString(),
  });
});

export default router;