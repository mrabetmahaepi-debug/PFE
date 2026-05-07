import express from "express";
import { registerController, loginController, meController, logoutController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginController);
router.post("/logout", authMiddleware, logoutController);

router.get("/me", authMiddleware, meController);

export default router;