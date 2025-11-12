/**
 * Test helper utilities for backend tests
 */

import mongoose from "mongoose";
import { connectDB, disconnectDB } from "./database.js";
import redisClient from "./redis.js";

/**
 * Connect to test database
 * @param {string} testDbUrl - Test database URL (optional)
 */
export const connectTestDB = async (testDbUrl = null) => {
  const url = testDbUrl || process.env.MONGO_URL || "mongodb://localhost:27017/finforesight-test";
  await connectDB(url);
};

/**
 * Disconnect from test database
 */
export const disconnectTestDB = async () => {
  await disconnectDB();
};

/**
 * Clear all collections in the test database
 */
export const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Clear Redis test data
 */
export const clearTestRedis = async () => {
  try {
    await redisClient.flushDb();
  } catch (error) {
    // Redis might not be available in tests, ignore
    console.warn("Could not clear Redis:", error.message);
  }
};

/**
 * Create a test user object (without saving to DB)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Test user object
 */
export const createTestUser = (overrides = {}) => {
  return {
    name: "Test User",
    email: "test@example.com",
    password: "testpassword123",
    ...overrides,
  };
};

/**
 * Create a test transaction object (without saving to DB)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Test transaction object
 */
export const createTestTransaction = (overrides = {}) => {
  return {
    accountId: new mongoose.Types.ObjectId(),
    amount: 100.0,
    description: "Test Transaction",
    category: "Food",
    type: "expense",
    date: new Date(),
    ...overrides,
  };
};

/**
 * Create a test account object (without saving to DB)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Test account object
 */
export const createTestAccount = (overrides = {}) => {
  return {
    name: "Test Account",
    type: "checking",
    balance: 1000.0,
    institution: "Test Bank",
    ...overrides,
  };
};

/**
 * Wait for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Mock Express request object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock request object
 */
export const createMockRequest = (overrides = {}) => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    userId: null,
    ...overrides,
  };
};

/**
 * Mock Express response object
 * @returns {Object} Mock response object
 */
export const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Express next function
 * @returns {Function} Mock next function
 */
export const createMockNext = () => {
  return jest.fn();
};

