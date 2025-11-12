import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FinForesight API",
      version: "1.0.0",
      description:
        "A comprehensive financial management API built with microservices architecture. " +
        "Provides endpoints for authentication, account management, transactions, budgets, goals, and more.",
      contact: {
        name: "FinForesight Support",
        email: "support@finforesight.com",
      },
      license: {
        name: "ISC",
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:3000/api",
        description: "Development server",
      },
      {
        url: "https://api.finforesight.com/api",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /auth/login or /auth/register",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            code: {
              type: "string",
              description: "Error code for programmatic handling",
            },
            details: {
              type: "object",
              description: "Additional error details",
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            name: {
              type: "string",
              description: "User's full name",
            },
            email: {
              type: "string",
              format: "email",
              description: "User's email address",
            },
          },
        },
        Account: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Account ID",
            },
            name: {
              type: "string",
              description: "Account name",
            },
            type: {
              type: "string",
              enum: ["checking", "savings", "credit_card", "cash", "investment"],
              description: "Account type",
            },
            balance: {
              type: "number",
              description: "Account balance",
            },
            institution: {
              type: "string",
              nullable: true,
              description: "Financial institution name",
            },
            accountNumber: {
              type: "string",
              nullable: true,
              description: "Account number (masked)",
            },
            color: {
              type: "string",
              description: "Color code for UI display",
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Transaction ID",
            },
            accountId: {
              type: "string",
              description: "Account ID",
            },
            amount: {
              type: "number",
              description: "Transaction amount",
            },
            description: {
              type: "string",
              description: "Transaction description",
            },
            category: {
              type: "string",
              description: "Transaction category",
            },
            type: {
              type: "string",
              enum: ["income", "expense", "transfer"],
              description: "Transaction type",
            },
            date: {
              type: "string",
              format: "date-time",
              description: "Transaction date",
            },
            toAccountId: {
              type: "string",
              nullable: true,
              description: "Target account ID (for transfers)",
            },
          },
        },
        Budget: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Budget ID",
            },
            category: {
              type: "string",
              description: "Budget category",
            },
            amount: {
              type: "number",
              description: "Budget amount",
            },
            period: {
              type: "string",
              enum: ["monthly", "yearly"],
              description: "Budget period",
            },
            isActive: {
              type: "boolean",
              description: "Whether the budget is active",
            },
          },
        },
        Goal: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              description: "Goal ID",
            },
            name: {
              type: "string",
              description: "Goal name",
            },
            targetAmount: {
              type: "number",
              description: "Target amount",
            },
            currentAmount: {
              type: "number",
              description: "Current amount saved",
            },
            targetDate: {
              type: "string",
              format: "date",
              description: "Target completion date",
            },
            isCompleted: {
              type: "boolean",
              description: "Whether the goal is completed",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./services/*/routes/*.js",
    "./gateway/index.js",
    "./shared/swagger/schemas/*.js",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;

