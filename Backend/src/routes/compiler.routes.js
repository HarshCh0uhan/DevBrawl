import { Router } from "express";
import { executeBrawlCode } from "../controllers/compiler.controller.js"; // Adjust the path to match your controller file

const router = Router();

// POST: /api/v1/compiler/run-code
router.route("/run-code").post(executeBrawlCode);

export default router;