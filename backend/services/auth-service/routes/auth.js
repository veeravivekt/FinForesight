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

// Rate limiters - very permissive limits for development
// Set DISABLE_RATE_LIMIT=true in .env to completely disable rate limiting
const registerLimiter = createRateLimiter(1000, 60); // 1000 attempts per minute (effectively disabled)
const loginLimiter = createRateLimiter(1000, 60); // 1000 attempts per minute (effectively disabled)

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

// Update user profile
router.put("/profile", authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return sendValidationError(res, "At least one field (name or email) is required");
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return sendNotFoundError(res, "User");
    }

    // If email is being updated, check if it's already taken
    if (email && email !== user.email) {
      if (!validateEmail(email)) {
        return sendValidationError(res, "Invalid email format");
      }

      const existingUser = await User.findOne({ email: sanitizeInput(email.toLowerCase()) });
      if (existingUser) {
        return sendError(res, 400, "Email already in use", "EMAIL_EXISTS");
      }

      user.email = sanitizeInput(email.toLowerCase());
    }

    if (name) {
      user.name = sanitizeInput(name);
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error("Update profile error:", error);
    sendInternalError(res);
  }
});

// Update user preferences
router.put("/preferences", authenticate, async (req, res) => {
  try {
    const { currency, timezone, notifications } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return sendNotFoundError(res, "User");
    }

    if (currency) {
      user.preferences.currency = currency;
    }

    if (timezone) {
      user.preferences.timezone = timezone;
    }

    if (notifications) {
      if (typeof notifications.email === "boolean") {
        user.preferences.notifications.email = notifications.email;
      }
      if (typeof notifications.push === "boolean") {
        user.preferences.notifications.push = notifications.push;
      }
      if (typeof notifications.fraudAlerts === "boolean") {
        user.preferences.notifications.fraudAlerts = notifications.fraudAlerts;
      }
    }

    await user.save();

    res.json({
      message: "Preferences updated successfully",
      preferences: user.preferences,
    });
  } catch (error) {
    logger.error("Update preferences error:", error);
    sendInternalError(res);
  }
});

// Change password
router.put("/password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendValidationError(res, "Current password and new password are required");
    }

    if (!validatePassword(newPassword)) {
      return sendValidationError(res, "New password must be at least 6 characters");
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return sendNotFoundError(res, "User");
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return sendUnauthorizedError(res, "Current password is incorrect");
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    logger.error("Change password error:", error);
    sendInternalError(res);
  }
});

export default router;

