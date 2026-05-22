import express from "express";
import {
  registerController,
  loginController,
  meController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/authMiddleware";
import { loginRateLimiter } from "../middleware/loginRateLimiter";

const router = express.Router();

router.post("/register", registerController);
router.post("/login", loginRateLimiter, loginController);
router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

router.post("/logout", authMiddleware, logoutController);
router.get("/me", authMiddleware, meController);

export default router;