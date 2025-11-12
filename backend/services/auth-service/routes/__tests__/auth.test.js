import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "../auth.js";
import User from "../../../../shared/models/User.js";
import {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
  clearTestRedis,
} from "../../../../shared/utils/test-helpers.js";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

describe("Auth Routes", () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    await clearTestRedis();
  });

  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      };

      const response = await request(app).post("/auth/register").send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("message", "User registered successfully");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user).toHaveProperty("email", "test@example.com");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("should return validation error for missing fields", async () => {
      const response = await request(app).post("/auth/register").send({
        name: "Test User",
        // Missing email and password
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should return validation error for invalid email", async () => {
      const response = await request(app).post("/auth/register").send({
        name: "Test User",
        email: "invalid-email",
        password: "password123",
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should return validation error for short password", async () => {
      const response = await request(app).post("/auth/register").send({
        name: "Test User",
        email: "test@example.com",
        password: "12345", // Less than 6 characters
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should return error if user already exists", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      };

      // Create user first
      await request(app).post("/auth/register").send(userData);

      // Try to register again
      const response = await request(app).post("/auth/register").send(userData);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("USER_EXISTS");
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      // Create a test user for login tests
      const user = new User({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      });
      await user.save();
    });

    it("should login successfully with valid credentials", async () => {
      const response = await request(app).post("/auth/login").send({
        email: "test@example.com",
        password: "password123",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("message", "Login successful");
      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("should return validation error for missing fields", async () => {
      const response = await request(app).post("/auth/login").send({
        email: "test@example.com",
        // Missing password
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    });

    it("should return unauthorized error for invalid email", async () => {
      const response = await request(app).post("/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });

    it("should return unauthorized error for invalid password", async () => {
      const response = await request(app).post("/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHORIZED");
    });
  });
});

