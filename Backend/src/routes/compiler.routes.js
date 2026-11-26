import { Router } from "express";
import { executeBrawlCode } from "../controllers/code.controller.js";
import { userAuth } from "../middlewares/auth.middleware.js";
import { env } from "../config/env.js";

const router = Router();

// POST: /api/v1/compiler/run-code  (now requires auth)
router.route("/run-code").post(userAuth, executeBrawlCode);

// GET: /api/v1/compiler/health
router.route("/health").get((req, res) => {
  const configured = !!env.rapidApiKey && !!env.rapidApiHost;
  res.json({
    status: configured ? "healthy" : "degraded",
    executor: "onecompiler",
    configured,
    timestamp: new Date().toISOString(),
  });
});

export default router;