import express from "express";
import mongoose from "mongoose";
import User from "../../../shared/models/User.js";
import { generateTokens, verifyRefreshToken, rotateRefreshToken } from "../../../shared/utils/jwt.js";
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

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validation:
 *                 value:
 *                   error: "Name, email, and password are required"
 *                   code: "VALIDATION_ERROR"
 *               userExists:
 *                 value:
 *                   error: "User already exists"
 *                   code: "USER_EXISTS"
 */
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

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return sendValidationError(res, passwordValidation.errors);
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
    const { accessToken, refreshToken, tokenFamilyId } = generateTokens(user._id.toString());

    // Store refresh token in Redis with token family ID
    await setSession(`${user._id.toString()}:${tokenFamilyId}`, refreshToken);

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

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user and get tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
      return sendError(
        res,
        423,
        `Account is locked. Please try again in ${minutesRemaining} minute(s).`,
        "ACCOUNT_LOCKED",
      );
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    // Update last login attempt
    user.lastLoginAttempt = new Date();

    if (!isPasswordValid) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lock account after 5 failed attempts for 30 minutes
      if (user.failedLoginAttempts >= 5) {
        user.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await user.save();
        return sendError(
          res,
          423,
          "Account locked due to too many failed login attempts. Please try again in 30 minutes.",
          "ACCOUNT_LOCKED",
        );
      }

      await user.save();
      return sendUnauthorizedError(res, "Invalid credentials");
    }

    // Reset failed login attempts on successful login
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken, tokenFamilyId } = generateTokens(user._id.toString());

    // Store refresh token in Redis with token family ID
    await setSession(`${user._id.toString()}:${tokenFamilyId}`, refreshToken);

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

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: JWT refresh token
 *     responses:
 *       200:
 *         description: Tokens refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid refresh token
 */
// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendValidationError(res, "Refresh token is required");
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded || !decoded.tokenFamilyId) {
      return sendUnauthorizedError(res, "Invalid refresh token");
    }

    // Check if token family exists in Redis (for rotation)
    const tokenFamilyKey = `${decoded.userId}:${decoded.tokenFamilyId}`;
    const storedToken = await getSession(tokenFamilyKey);
    if (storedToken !== refreshToken) {
      return sendUnauthorizedError(res, "Invalid or expired refresh token");
    }

    // Rotate refresh token (invalidate old, generate new)
    const { accessToken, refreshToken: newRefreshToken, tokenFamilyId: newFamilyId } =
      await rotateRefreshToken(decoded.userId, decoded.tokenFamilyId);

    // Store new refresh token in Redis
    await setSession(`${decoded.userId}:${newFamilyId}`, newRefreshToken);

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

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
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

