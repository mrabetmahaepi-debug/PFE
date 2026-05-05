import express from "express";
import { registerController, loginController, meController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);

router.get("/me", authMiddleware, meController);

export default router;