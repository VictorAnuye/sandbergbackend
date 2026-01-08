import express from "express";
import { login, createAdmin, createReceptionist, logout,forgotPassword,validateResetCode,resetPassword } from "../controllers/authController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import User from "../models/user.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail } from "../utils/sendEmail.js";

import { adminOnly } from "../middleware/roleMiddleware.js";
const router = express.Router();

router.post("/login", login);
router.post("/create-admin", createAdmin);
router.post("/create-receptionist", protect, adminOnly, createReceptionist);
router.post("/logout", protect, logout);
router.post("/forgot-password", forgotPassword);
router.post("/validate-reset-code", validateResetCode);
router.post("/reset-password", resetPassword);
// In authRoutes.js
router.post("/logout", protect, async (req, res) => {
  req.user.currentToken = null;
  await req.user.save();
  res.json({ message: "Logged out successfully" });
}); 

export default router;
