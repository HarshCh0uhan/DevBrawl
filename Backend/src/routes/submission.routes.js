import { Router } from "express";
import { submitSolution } from "../controllers/submission.controller.js";
import { authenticateUser } from "../utils/auth.middlewear.js";

const router = Router();

router.route("/submit").post(authenticateUser, submitSolution);

export default router;