import validator from "validator";

export const validateEmail = (email) => {
  return validator.isEmail(email);
};

export const validatePassword = (password) => {
  // At least 6 characters, can include letters, numbers, and special characters
  return password && password.length >= 6;
};

export const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return validator.escape(input.trim());
  }
  return input;
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

