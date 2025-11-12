import Joi from "joi";

/**
 * Common validation schemas used across services
 */

// MongoDB ObjectId validation
export const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "Invalid ID format",
    "any.required": "ID is required",
  });

// Email validation
export const emailSchema = Joi.string()
  .email()
  .required()
  .messages({
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  });

// Password validation
export const passwordSchema = Joi.string()
  .min(6)
  .required()
  .messages({
    "string.min": "Password must be at least 6 characters",
    "any.required": "Password is required",
  });

// Amount validation (positive number)
export const amountSchema = Joi.number()
  .positive()
  .required()
  .messages({
    "number.positive": "Amount must be greater than 0",
    "any.required": "Amount is required",
  });

// Date validation
export const dateSchema = Joi.date()
  .required()
  .messages({
    "date.base": "Invalid date format",
    "any.required": "Date is required",
  });

// Pagination schemas
export const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// Date range query schema
export const dateRangeQuerySchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().greater(Joi.ref("startDate")),
});

/**
 * Auth validation schemas
 */
export const registerSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

/**
 * Transaction validation schemas
 */
export const transactionSchema = Joi.object({
  accountId: objectIdSchema,
  amount: amountSchema,
  description: Joi.string().trim().min(1).max(500).required(),
  category: Joi.string()
    .valid(
      "Food",
      "Transport",
      "Shopping",
      "Bills",
      "Entertainment",
      "Healthcare",
      "Education",
      "Travel",
      "Other"
    )
    .required(),
  type: Joi.string().valid("income", "expense", "transfer").required(),
  date: dateSchema,
  toAccountId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .when("type", {
      is: "transfer",
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
});

/**
 * Account validation schemas
 */
export const accountSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  type: Joi.string()
    .valid("checking", "savings", "credit_card", "cash", "investment")
    .required(),
  balance: Joi.number().default(0),
  institution: Joi.string().trim().max(100).allow(null, ""),
  accountNumber: Joi.string().trim().max(50).allow(null, ""),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default("#3b82f6"),
});

export const transferSchema = Joi.object({
  fromAccountId: objectIdSchema,
  toAccountId: objectIdSchema,
  amount: amountSchema,
  description: Joi.string().trim().min(1).max(500),
});

/**
 * Budget validation schemas
 */
export const budgetSchema = Joi.object({
  category: Joi.string()
    .valid(
      "Food",
      "Transport",
      "Shopping",
      "Bills",
      "Entertainment",
      "Healthcare",
      "Education",
      "Travel",
      "Other"
    )
    .required(),
  amount: amountSchema,
  period: Joi.string().valid("monthly", "yearly").default("monthly"),
  isActive: Joi.boolean().default(true),
});

/**
 * Goal validation schemas
 */
export const goalSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  targetAmount: amountSchema,
  targetDate: dateSchema,
  accountId: objectIdSchema,
  description: Joi.string().trim().max(500).allow(null, ""),
});

export const contributeSchema = Joi.object({
  amount: amountSchema,
});

