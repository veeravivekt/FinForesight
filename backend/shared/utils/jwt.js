import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { getSession, setSession, deleteSession } from "./redis.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

/**
 * Generate access and refresh tokens
 * @param {string} userId - User ID
 * @param {string} tokenFamilyId - Token family ID for refresh token rotation (optional)
 * @returns {Object} Object containing accessToken and refreshToken
 */
export const generateTokens = (userId, tokenFamilyId = null) => {
  const familyId = tokenFamilyId || randomUUID();

  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { userId, tokenFamilyId: familyId },
    JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
    },
  );

  return { accessToken, refreshToken, tokenFamilyId: familyId };
};

/**
 * Rotate refresh token - invalidate old token and generate new one
 * @param {string} userId - User ID
 * @param {string} oldTokenFamilyId - Old token family ID to invalidate
 * @returns {Object} New tokens with new token family ID
 */
export const rotateRefreshToken = async (userId, oldTokenFamilyId) => {
  // Delete old token family from Redis
  await deleteSession(`${userId}:${oldTokenFamilyId}`);

  // Generate new tokens with new family ID
  return generateTokens(userId);
};

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

