import jwt from "jsonwebtoken";
import User from "../models/user.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import  {sendEmail}  from "../utils/sendEmail.js";

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// CREATE ADMIN (temporary)
export const createAdmin = async (req, res) => {
  const { fullName, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const admin = await User.create({
    fullName,
    email,
    password,
    role: "admin",
  });

  res.status(201).json({
    message: "Admin created successfully",
    admin: {
      id: admin._id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
    },
  });
};

// LOGIN
export const login = async (req, res) => {
  const { email, password } = req.body;
  console.log("LOGIN HIT:", req.body);

  const user = await User.findOne({ email }).select("+password");
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // ✅ Generate token
  const token = generateToken(user._id);

  // ✅ Enforce single session
  user.currentToken = token;
  user.isOnline = true
user.lastLogin = new Date()
  await user.save();

  res.json({
    token,
    user: {
      id: user._id,
      fullName: user.fullName,
      role: user.role,
    },
  });
};

export const logout = async (req, res) => {
  // req.user is already available from protect middleware
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Invalidate token
  user.isOnline = false
  user.currentToken = null;
  

  await user.save();

  res.json({ message: "Logged out successfully" });
};




// CREATE RECEPTIONIST (Admin only)
export const createReceptionist = async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Password must be at least 8 characters" });
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { fullName }],
  });

  if (existingUser) {
    return res.status(400).json({
      message: "A user with this name or email already exists",
    });
  }

  const receptionist = await User.create({
    fullName,
    email,
    password,
    role: "receptionist",
  });

  res.status(201).json({
    message: "Receptionist created successfully",
    receptionist: {
      id: receptionist._id,
      fullName: receptionist.fullName,
      email: receptionist.email,
      role: receptionist.role,
    },
  });
};

// src/controllers/authController.js

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Save code and expiry in the user document
  user.resetCode = code;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min expiry
  await user.save();

  console.log("Reset code stored in DB:", user.resetCode);

  // Send email
  await sendEmail(user.email, "Your password reset code", `Your reset code is: ${code}`);

  res.json({ message: "Reset code sent to email" });
};


// Step 2: Validate Code
export const validateResetCode = async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code)
    return res.status(400).json({ message: "Email and code required" });

  const user = await User.findOne({ email });
  if (!user || !user.resetCode || !user.resetPasswordExpires) {
    return res.status(400).json({ message: "Invalid or expired reset code" });
  }

  console.log("User stored code:", user.resetCode);
  console.log("Submitted code:", code);
  console.log("Code expiry:", user.resetPasswordExpires);
  console.log("Now:", Date.now());
console.log("Expiry:", user.resetPasswordExpires.getTime());


  if (user.resetPasswordExpires.getTime() < Date.now()) {
    return res.status(400).json({ message: "Reset code expired" });
  }

  if (user.resetCode !== code) {
    return res.status(400).json({ message: "Invalid reset code" });
  }

  res.status(200).json({ message: "Code verified. You can now reset your password." });
};


// Step 3: Reset Password
export const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email and new password required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Optional: check if reset code was issued recently (15 mins)
  // if (!user.resetPasswordIssuedAt || user.resetPasswordIssuedAt.getTime() + 15*60*1000 < Date.now()) {
  //   return res.status(400).json({ message: "Reset session expired. Request a new code." });
  // }

  // Update password
  user.password = newPassword;
  // Clear reset info
  user.resetPasswordCode = null;
  user.resetPasswordExpires = null;
  user.resetPasswordIssuedAt = null;

  await user.save();

  res.status(200).json({ message: "Password has been reset successfully" });
};

// controllers/authController.js
export const getCurrentUser = async (req, res) => {
  try {
    // req.user is set in authMiddleware after token verification
    const user = req.user
    if (!user) return res.status(404).json({ message: "User not found" })

    res.status(200).json({
      name: user.fullName,
      role: user.role, // e.g., "receptionist" or "admin"
      email: user.email,
    })
  } catch (err) {
    res.status(500).json({ message: "Server error" })
  }
}



/**
 * Get currently online receptionists
 */
export const getOnlineReceptionists = async (req, res) => {
  try {
    console.log("🔹 Fetching online receptionists...")

    // Step 1: Fetch all receptionists
    const allReceptionists = await User.find({ role: "receptionist" })
    console.log(`👥 Total receptionists in DB: ${allReceptionists.length}`)
    allReceptionists.forEach((r) => {
      console.log(`- ${r.fullName} | isOnline: ${r.isOnline} | lastLogin: ${r.lastLogin}`)
    })

    // Step 2: Filter online receptionists
    const onlineReceptionists = await User.find({
      role: "receptionist",
      isOnline: true,
    }).select("fullName email lastLogin")

    console.log(`⚡ Receptionists with isOnline=true: ${onlineReceptionists.length}`)
    onlineReceptionists.forEach((r) =>
      console.log(`> ${r.fullName} | ${r.email} | lastLogin: ${r.lastLogin}`)
    )

    res.json(onlineReceptionists)
  } catch (err) {
    console.error("❌ Error fetching online receptionists:", err)
    res.status(500).json({ message: "Failed to fetch online receptionists" })
  }
}
