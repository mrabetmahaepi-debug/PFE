import express from "express";
import { getMyProfileController, updateMyProfileController } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/me", authMiddleware, getMyProfileController);
router.put("/me", authMiddleware, updateMyProfileController);

export default router;
