import express from "express";
import mongoose from "mongoose";
import User from "../../../shared/models/User.js";
import { generateTokens, verifyRefreshToken } from "../../../shared/utils/jwt.js";
import { setSession, getSession, deleteSession } from "../../../shared/utils/redis.js";
import { validateEmail, validatePassword, sanitizeInput } from "../../../shared/utils/validation.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { authenticate } from "../../../shared/middleware/auth.js";
import { sendError, sendInternalError, sendUnauthorizedError, sendNotFoundError, sendValidationError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("auth-service");

// Rate limiters
const registerLimiter = createRateLimiter(5, 15 * 60); // 5 attempts per 15 minutes
const loginLimiter = createRateLimiter(10, 15 * 60); // 10 attempts per 15 minutes

// Register
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return sendValidationError(res, "Name, email, and password are required");
    }

    if (!validateEmail(email)) {
      return sendValidationError(res, "Invalid email format");
    }

    if (!validatePassword(password)) {
      return sendValidationError(res, "Password must be at least 6 characters");
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: sanitizeInput(email.toLowerCase()) });
    if (existingUser) {
      return sendError(res, 400, "User already exists", "USER_EXISTS");
    }

    // Create user
    const user = new User({
      name: sanitizeInput(name),
      email: sanitizeInput(email.toLowerCase()),
      password,
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Store refresh token in Redis
    await setSession(user._id.toString(), refreshToken);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Registration error:", error);
    sendInternalError(res);
  }
});

// Login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendValidationError(res, "Email and password are required");
    }

    // Find user
    const user = await User.findOne({ email: sanitizeInput(email.toLowerCase()) });
    if (!user) {
      return sendUnauthorizedError(res, "Invalid credentials");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendUnauthorizedError(res, "Invalid credentials");
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Store refresh token in Redis
    await setSession(user._id.toString(), refreshToken);

    res.json({
      message: "Login successful",
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    logger.error("Login error:", error);
    sendInternalError(res);
  }
});

// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendValidationError(res, "Refresh token is required");
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return sendUnauthorizedError(res, "Invalid refresh token");
    }

    // Check if session exists in Redis
    const storedToken = await getSession(decoded.userId);
    if (storedToken !== refreshToken) {
      return sendUnauthorizedError(res, "Invalid refresh token");
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    // Update session in Redis
    await setSession(decoded.userId, newRefreshToken);

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error("Refresh token error:", error);
    sendInternalError(res);
  }
});

// Logout
router.post("/logout", authenticate, async (req, res) => {
  try {
    await deleteSession(req.userId);
    res.json({ message: "Logout successful" });
  } catch (error) {
    logger.error("Logout error:", error);
    sendInternalError(res);
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return sendNotFoundError(res, "User");
    }
    res.json({ user });
  } catch (error) {
    logger.error("Get user error:", error);
    sendInternalError(res);
  }
});

export default router;

