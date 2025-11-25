import validator from "validator";

// Note: jsdom/dompurify removed due to ES module compatibility issues
// Using validator.escape which provides sufficient XSS protection

export const validateEmail = (email) => {
  return validator.isEmail(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: ["Password is required"] };
  }

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must be less than 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Optional: require special character (commented out for now, can be enabled)
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push("Password must contain at least one special character");
  // }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Simple password validation (backward compatibility)
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is valid
 */
export const validatePasswordSimple = (password) => {
  return password && password.length >= 6;
};

/**
 * Sanitize input to prevent XSS attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input === "string") {
    // First trim whitespace
    let sanitized = input.trim();

    // Escape HTML entities using validator (provides XSS protection)
    sanitized = validator.escape(sanitized);

    return sanitized;
  }
  return input;
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
};

export const validateTransaction = (transaction) => {
  const errors = [];

  if (!transaction.accountId) {
    errors.push("Account is required");
  }

  if (!transaction.amount || transaction.amount <= 0) {
    errors.push("Amount must be greater than 0");
  }

  if (!transaction.description || transaction.description.trim().length === 0) {
    errors.push("Description is required");
  }

  if (!transaction.category) {
    errors.push("Category is required");
  }

  if (!transaction.date) {
    errors.push("Date is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

