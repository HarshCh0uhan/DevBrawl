import { Router } from "express";
import { executeBrawlCode } from "../controllers/code.controller.js";
import { authenticateUser } from "../utils/auth.middlewear.js";

const router = Router();

// POST: /api/v1/compiler/run-code  (now requires auth)
router.route("/run-code").post(authenticateUser, executeBrawlCode);

// GET: /api/v1/compiler/health
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