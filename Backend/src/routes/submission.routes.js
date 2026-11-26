import { Router } from "express";
import { submitSolution } from "../controllers/submission.controller.js";
import { userAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/submit").post(userAuth, submitSolution);

export default router;