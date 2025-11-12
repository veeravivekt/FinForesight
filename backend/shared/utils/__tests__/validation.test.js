import {
  validateEmail,
  validatePassword,
  sanitizeInput,
  validateTransaction,
} from "../validation.js";

describe("validation", () => {
  describe("validateEmail", () => {
    it("should return true for valid email addresses", () => {
      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user.name@domain.co.uk")).toBe(true);
      expect(validateEmail("test+tag@example.com")).toBe(true);
    });

    it("should return false for invalid email addresses", () => {
      expect(validateEmail("invalid")).toBe(false);
      expect(validateEmail("invalid@")).toBe(false);
      expect(validateEmail("@example.com")).toBe(false);
      expect(validateEmail("test@")).toBe(false);
      expect(validateEmail("")).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("should return true for passwords with 6 or more characters", () => {
      expect(validatePassword("password123")).toBe(true);
      expect(validatePassword("123456")).toBe(true);
      expect(validatePassword("short")).toBe(false);
    });

    it("should return false for passwords shorter than 6 characters", () => {
      expect(validatePassword("12345")).toBe(false);
      expect(validatePassword("abc")).toBe(false);
      expect(validatePassword("")).toBe(false);
    });

    it("should return false for null or undefined", () => {
      expect(validatePassword(null)).toBe(false);
      expect(validatePassword(undefined)).toBe(false);
    });
  });

  describe("sanitizeInput", () => {
    it("should sanitize string input", () => {
      expect(sanitizeInput("  test  ")).toBe("test");
      expect(sanitizeInput("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      );
    });

    it("should return non-string input as-is", () => {
      expect(sanitizeInput(123)).toBe(123);
      expect(sanitizeInput({ key: "value" })).toEqual({ key: "value" });
      expect(sanitizeInput(null)).toBe(null);
    });
  });

  describe("validateTransaction", () => {
    it("should return valid for complete transaction", () => {
      const transaction = {
        accountId: "507f1f77bcf86cd799439011",
        amount: 100.0,
        description: "Test transaction",
        category: "Food",
        date: new Date(),
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for missing accountId", () => {
      const transaction = {
        amount: 100.0,
        description: "Test transaction",
        category: "Food",
        date: new Date(),
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Account is required");
    });

    it("should return errors for invalid amount", () => {
      const transaction = {
        accountId: "507f1f77bcf86cd799439011",
        amount: 0,
        description: "Test transaction",
        category: "Food",
        date: new Date(),
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Amount must be greater than 0");
    });

    it("should return errors for missing description", () => {
      const transaction = {
        accountId: "507f1f77bcf86cd799439011",
        amount: 100.0,
        description: "",
        category: "Food",
        date: new Date(),
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Description is required");
    });

    it("should return errors for missing category", () => {
      const transaction = {
        accountId: "507f1f77bcf86cd799439011",
        amount: 100.0,
        description: "Test transaction",
        date: new Date(),
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Category is required");
    });

    it("should return errors for missing date", () => {
      const transaction = {
        accountId: "507f1f77bcf86cd799439011",
        amount: 100.0,
        description: "Test transaction",
        category: "Food",
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Date is required");
    });

    it("should return multiple errors for multiple missing fields", () => {
      const transaction = {
        amount: -10,
      };

      const result = validateTransaction(transaction);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

