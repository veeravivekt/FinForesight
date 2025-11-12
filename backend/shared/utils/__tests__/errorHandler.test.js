import {
  sendError,
  sendValidationError,
  sendNotFoundError,
  sendUnauthorizedError,
  sendForbiddenError,
  sendInternalError,
  sendUserFriendlyError,
  asyncHandler,
} from "../errorHandler.js";
import { createMockResponse } from "../../test-helpers.js";

describe("errorHandler", () => {
  describe("sendError", () => {
    it("should send error response with status code and message", () => {
      const res = createMockResponse();
      sendError(res, 400, "Test error");

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Test error",
      });
    });

    it("should include error code when provided", () => {
      const res = createMockResponse();
      sendError(res, 400, "Test error", "TEST_ERROR");

      expect(res.json).toHaveBeenCalledWith({
        error: "Test error",
        code: "TEST_ERROR",
      });
    });

    it("should include details when provided", () => {
      const res = createMockResponse();
      const details = { field: "email", reason: "invalid format" };
      sendError(res, 400, "Test error", "TEST_ERROR", details);

      expect(res.json).toHaveBeenCalledWith({
        error: "Test error",
        code: "TEST_ERROR",
        details,
      });
    });
  });

  describe("sendValidationError", () => {
    it("should send validation error with string message", () => {
      const res = createMockResponse();
      sendValidationError(res, "Invalid input");

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid input",
        code: "VALIDATION_ERROR",
      });
    });

    it("should join array of errors into single message", () => {
      const res = createMockResponse();
      sendValidationError(res, ["Error 1", "Error 2", "Error 3"]);

      expect(res.json).toHaveBeenCalledWith({
        error: "Error 1, Error 2, Error 3",
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("sendNotFoundError", () => {
    it("should send 404 error with default resource name", () => {
      const res = createMockResponse();
      sendNotFoundError(res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Resource not found",
        code: "NOT_FOUND",
      });
    });

    it("should send 404 error with custom resource name", () => {
      const res = createMockResponse();
      sendNotFoundError(res, "Transaction");

      expect(res.json).toHaveBeenCalledWith({
        error: "Transaction not found",
        code: "NOT_FOUND",
      });
    });
  });

  describe("sendUnauthorizedError", () => {
    it("should send 401 error with default message", () => {
      const res = createMockResponse();
      sendUnauthorizedError(res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        code: "UNAUTHORIZED",
      });
    });

    it("should send 401 error with custom message", () => {
      const res = createMockResponse();
      sendUnauthorizedError(res, "Invalid credentials");

      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid credentials",
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("sendForbiddenError", () => {
    it("should send 403 error with default message", () => {
      const res = createMockResponse();
      sendForbiddenError(res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Forbidden",
        code: "FORBIDDEN",
      });
    });
  });

  describe("sendInternalError", () => {
    it("should send 500 error with generic message in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const res = createMockResponse();
      sendInternalError(res, "Detailed error message");

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "An unexpected error occurred. Please try again later.",
        code: "INTERNAL_ERROR",
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should send 500 error with detailed message in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const res = createMockResponse();
      sendInternalError(res, "Detailed error message");

      expect(res.json).toHaveBeenCalledWith({
        error: "Detailed error message",
        code: "INTERNAL_ERROR",
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("sendUserFriendlyError", () => {
    it("should handle ValidationError", () => {
      const res = createMockResponse();
      const error = { name: "ValidationError", message: "Validation failed" };
      sendUserFriendlyError(res, error);

      expect(res.json).toHaveBeenCalledWith({
        error: "Please check your input and try again.",
        code: "ValidationError",
      });
    });

    it("should handle MongoServerError with duplicate key", () => {
      const res = createMockResponse();
      const error = { name: "MongoServerError", code: 11000 };
      sendUserFriendlyError(res, error);

      expect(res.json).toHaveBeenCalledWith({
        error: "This record already exists. Please use a different value.",
        code: "MongoServerError",
      });
    });

    it("should handle JsonWebTokenError", () => {
      const res = createMockResponse();
      const error = { name: "JsonWebTokenError", message: "Invalid token" };
      sendUserFriendlyError(res, error);

      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid authentication token. Please log in again.",
        code: "JsonWebTokenError",
      });
    });

    it("should use error message in development for unknown errors", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const res = createMockResponse();
      const error = { name: "UnknownError", message: "Something went wrong" };
      sendUserFriendlyError(res, error);

      expect(res.json).toHaveBeenCalledWith({
        error: "Something went wrong",
        code: "UnknownError",
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("asyncHandler", () => {
    it("should execute async function successfully", async () => {
      const req = {};
      const res = createMockResponse();
      const next = jest.fn();

      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it("should catch and handle errors", async () => {
      const req = {};
      const res = createMockResponse();
      const next = jest.fn();

      const handler = asyncHandler(async () => {
        throw new Error("Test error");
      });

      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});

