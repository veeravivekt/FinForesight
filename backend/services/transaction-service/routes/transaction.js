import express from "express";
import mongoose from "mongoose";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import Goal from "../../../shared/models/Goal.js";
import Receipt from "../../../shared/models/Receipt.js";
import { validateTransaction } from "../../../shared/utils/validation.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { setCache, getCache, invalidatePattern } from "../../../shared/utils/redis.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError, sendUserFriendlyError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { checkBudgetAlerts } from "../../../shared/utils/budgetAlerts.js";
import { emitTransactionEvent } from "../../../shared/utils/websocket.js";
import axios from "axios";

const router = express.Router();
const logger = createServiceLogger("transaction-service");

// Rate limiter
const transactionLimiter = createRateLimiter(100, 60); // 100 requests per minute

// Get all transactions with pagination
router.get("/", transactionLimiter, async (req, res) => {
  try {
    // Validate userId is present
    if (!req.userId) {
      logger.error("Get transactions error: userId not found in request");
      return sendInternalError(res, "User authentication failed");
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      logger.error("MongoDB not connected. State:", mongoose.connection.readyState);
      return sendInternalError(res, "Database connection failed");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const category = req.query.category;
    const type = req.query.type;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const minAmount = req.query.minAmount;
    const maxAmount = req.query.maxAmount;
    const search = req.query.search; // Text search in description
    const tags = req.query.tags; // Comma-separated tags
    const merchant = req.query.merchant;
    const isRecurring = req.query.isRecurring;
    const isFlagged = req.query.isFlagged;

    // Build query - ensure userId is ObjectId
    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;
    
    const query = { userId };
    const accountId = req.query.accountId;
    if (accountId) {
      query.accountId = new mongoose.Types.ObjectId(accountId);
    }
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (minAmount !== undefined) {
      query.amount = query.amount || {};
      query.amount.$gte = parseFloat(minAmount);
    }
    if (maxAmount !== undefined) {
      query.amount = query.amount || {};
      query.amount.$lte = parseFloat(maxAmount);
    }
    if (search) {
      query.description = { $regex: search, $options: "i" };
    }
    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim());
      query.tags = { $in: tagArray };
    }
    if (merchant) {
      query["merchant.name"] = { $regex: merchant, $options: "i" };
    }
    if (isRecurring !== undefined) {
      query.isRecurring = isRecurring === "true";
    }
    if (isFlagged !== undefined) {
      query.isFlagged = isFlagged === "true";
    }

    // Check cache (wrap in try-catch to handle Redis errors gracefully)
    let cached = null;
    try {
      const cacheKey = `transactions:${req.userId}:${page}:${JSON.stringify(query)}`;
      cached = await getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    } catch (cacheError) {
      logger.warn("Cache read error (continuing without cache):", cacheError.message);
      // Continue without cache if Redis fails
    }

    // Query transactions with populate
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .populate("goalId", "name")
      .populate("receiptId");

    const total = await Transaction.countDocuments(query);

    const result = {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    // Cache for 1 minute (wrap in try-catch to handle Redis errors gracefully)
    try {
      const cacheKey = `transactions:${req.userId}:${page}:${JSON.stringify(query)}`;
      await setCache(cacheKey, result, 60);
    } catch (cacheError) {
      logger.warn("Cache write error (continuing without cache):", cacheError.message);
      // Continue without caching if Redis fails
    }

    res.json(result);
  } catch (error) {
    logger.error("Get transactions error:", error);
    logger.error("Error name:", error.name);
    logger.error("Error message:", error.message);
    logger.error("Error stack:", error.stack);
    logger.error("Request userId:", req.userId);
    logger.error("Request query:", req.query);
    
    // Send detailed error in development
    const errorMessage = process.env.NODE_ENV === "development"
      ? `${error.name}: ${error.message}`
      : "Internal server error";
    
    sendInternalError(res, errorMessage);
  }
});

// Get transaction by ID
router.get("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: userId,
    });

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    res.json(transaction);
  } catch (error) {
    logger.error("Get transaction error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Create transaction
router.post("/", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const validation = validateTransaction(req.body);
    if (!validation.isValid) {
      return sendValidationError(res, validation.errors);
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    // Verify account belongs to user
    const account = await Account.findOne({
      _id: req.body.accountId,
      userId: userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    // Auto-categorize if category not provided
    let category = req.body.category;
    let autoCategorized = false;
    let categorizationConfidence = 0;

    if (!category && req.body.description) {
      const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:3003";
      const AUTO_CATEGORIZE_ENABLED = process.env.AUTO_CATEGORIZE_ENABLED !== "false";
      
      if (AUTO_CATEGORIZE_ENABLED) {
        try {
          const categorizeResponse = await axios.post(
            `${ML_SERVICE_URL}/categorize`,
            {
              description: req.body.description,
              amount: req.body.amount,
              merchant: req.body.merchant,
            },
            {
              headers: {
                Authorization: req.headers.authorization || "",
              },
              timeout: 3000,
            }
          );
          
          if (categorizeResponse.data.category) {
            category = categorizeResponse.data.category;
            autoCategorized = true;
            categorizationConfidence = categorizeResponse.data.confidence || 0;
          }
        } catch (error) {
          logger.warn("Auto-categorization failed, using default:", error.message);
          category = category || "Other";
        }
      } else {
        category = category || "Other";
      }
    }

    const transaction = new Transaction({
      ...req.body,
      category: category || req.body.category || "Other",
      userId: userId,
      accountId: req.body.accountId,
      autoCategorized,
      categorizationConfidence,
    });

    await transaction.save();

    // Emit WebSocket event for transaction creation
    emitTransactionEvent(userId.toString(), "created", transaction).catch((error) => {
      logger.warn("Failed to emit transaction created event:", error);
    });

    // Update account balance if needed
    if (req.body.type === "income") {
      account.balance = (account.balance || 0) + req.body.amount;
    } else if (req.body.type === "expense") {
      account.balance = (account.balance || 0) - req.body.amount;
    }
    await account.save();

    // Check budget alerts (async, don't wait for completion)
    if (req.body.type === "expense" && req.body.category) {
      checkBudgetAlerts(
        userId.toString(),
        req.body.category,
        req.body.amount,
        req.body.date ? new Date(req.body.date) : new Date()
      ).catch((error) => {
        logger.warn("Budget alert check failed:", error);
      });
    }

    // Check fraud detection (async, don't wait for completion)
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:3003";
    const FRAUD_DETECTION_ENABLED = process.env.FRAUD_DETECTION_ENABLED !== "false";
    
    if (FRAUD_DETECTION_ENABLED && transaction.type === "expense") {
      axios.post(
        `${ML_SERVICE_URL}/fraud/detect`,
        {
          transaction: {
            amount: transaction.amount,
            category: transaction.category,
            description: transaction.description,
            date: transaction.date,
            accountId: transaction.accountId,
          },
        },
        {
          headers: {
            Authorization: req.headers.authorization || "",
          },
          timeout: 5000,
        }
      )
        .then(async (response) => {
          const fraudData = response.data;
          if (fraudData.isFraudulent || fraudData.fraudScore > 0.7) {
            logger.warn(`Fraud detected for transaction ${transaction._id}: Score ${fraudData.fraudScore}`);
            
            // Update transaction with fraud score
            await Transaction.findByIdAndUpdate(transaction._id, {
              fraudScore: fraudData.fraudScore,
              isFlagged: true,
            });

            // Send notification via notification service
            const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";
            try {
              await axios.post(
                `${NOTIFICATION_SERVICE_URL}/notify`,
                {
                  userId: userId.toString(),
                  event: "fraud:detected",
                  data: {
                    transactionId: transaction._id.toString(),
                    fraudScore: fraudData.fraudScore,
                    amount: transaction.amount,
                    description: transaction.description,
                    timestamp: new Date().toISOString(),
                  },
                },
                {
                  headers: {
                    Authorization: req.headers.authorization || "",
                  },
                  timeout: 5000,
                }
              );
            } catch (notifError) {
              logger.warn("Failed to send fraud notification:", notifError.message);
            }
          } else if (fraudData.fraudScore) {
            // Store fraud score even if not flagged
            await Transaction.findByIdAndUpdate(transaction._id, {
              fraudScore: fraudData.fraudScore,
            });
          }
        })
        .catch((error) => {
          logger.warn("Fraud detection check failed:", error.message);
          // Don't fail transaction creation if fraud detection fails
        });
    }

    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.status(201).json(transaction);
  } catch (error) {
    logger.error("Create transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Update transaction
router.put("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    // Emit WebSocket event for transaction update
    emitTransactionEvent(userId.toString(), "updated", transaction).catch((error) => {
      logger.warn("Failed to emit transaction updated event:", error);
    });

    // Check budget alerts if transaction is an expense (async, don't wait for completion)
    if (transaction.type === "expense" && transaction.category) {
      checkBudgetAlerts(
        userId.toString(),
        transaction.category,
        transaction.amount,
        transaction.date || new Date()
      ).catch((error) => {
        logger.warn("Budget alert check failed:", error);
      });
    }

    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.json(transaction);
  } catch (error) {
    logger.error("Update transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Delete transaction
router.delete("/:id", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: userId,
    });

    if (!transaction) {
      return sendNotFoundError(res, "Transaction");
    }

    // Emit WebSocket event for transaction deletion
    emitTransactionEvent(userId.toString(), "deleted", transaction).catch((error) => {
      logger.warn("Failed to emit transaction deleted event:", error);
    });

    // Invalidate cache for this user's transactions
    invalidatePattern(`transactions:${userId.toString()}:*`).catch((error) => {
      logger.warn("Cache invalidation failed:", error);
    });
    // Also invalidate stats cache
    invalidatePattern(`stats:${userId.toString()}:*`).catch((error) => {
      logger.warn("Stats cache invalidation failed:", error);
    });

    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    logger.error("Delete transaction error:", error);
    logger.error("Error details:", error.message);
    sendUserFriendlyError(res, error);
  }
});

// Get statistics
router.get("/stats/summary", transactionLimiter, async (req, res) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();

    const cacheKey = `stats:${req.userId}:${startDate}:${endDate}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] },
          },
          totalExpense: {
            $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] },
          },
          transactionCount: { $sum: 1 },
          avgTransactionAmount: { $avg: "$amount" },
        },
      },
    ]);

    const categoryStats = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: startDate, $lte: endDate },
          type: "expense",
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const result = {
      summary: stats[0] || {
        totalIncome: 0,
        totalExpense: 0,
        transactionCount: 0,
        avgTransactionAmount: 0,
      },
      categoryStats,
      period: { startDate, endDate },
    };

    // Cache for 5 minutes
    await setCache(cacheKey, result, 300);

    res.json(result);
  } catch (error) {
    logger.error("Get stats error:", error);
    sendInternalError(res);
  }
});

// Export transactions as PDF
router.get("/export/pdf", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const PDFDocument = (await import("pdfkit")).default;
    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const category = req.query.category;
    const type = req.query.type;

    // Build query
    const query = { userId: userId };
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .limit(1000); // Limit to 1000 transactions for PDF

    // Calculate summary statistics
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const netAmount = totalIncome - totalExpense;

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Transaction Report", { align: "center" });
    doc.moveDown();
    
    // Date range
    if (startDate || endDate) {
      doc.fontSize(12).text(
        `Period: ${startDate ? startDate.toLocaleDateString() : "Beginning"} - ${endDate ? endDate.toLocaleDateString() : "End"}`,
        { align: "center" }
      );
    } else {
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
    }
    doc.moveDown(2);

    // Summary section
    doc.fontSize(16).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Total Income: $${totalIncome.toFixed(2)}`, { continued: true, align: "left" });
    doc.text(`Total Expenses: $${totalExpense.toFixed(2)}`, { align: "right" });
    doc.moveDown();
    doc.text(`Net Amount: $${netAmount.toFixed(2)}`, { continued: true, align: "left" });
    doc.text(`Transactions: ${transactions.length}`, { align: "right" });
    doc.moveDown(2);

    // Transactions table header
    doc.fontSize(14).text("Transactions", { underline: true });
    doc.moveDown();
    
    // Table headers
    const tableTop = doc.y;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Date", 50, doc.y);
    doc.text("Description", 120, doc.y);
    doc.text("Category", 280, doc.y);
    doc.text("Type", 350, doc.y);
    doc.text("Amount", 400, doc.y);
    doc.text("Account", 470, doc.y);
    
    // Draw line under header
    doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).stroke();
    doc.moveDown();

    // Transaction rows
    doc.font("Helvetica").fontSize(9);
    let yPosition = doc.y;
    const rowHeight = 15;
    const pageHeight = 750;
    
    transactions.forEach((transaction, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight) {
        doc.addPage();
        yPosition = 50;
        // Redraw headers on new page
        doc.font("Helvetica-Bold").fontSize(10);
        doc.text("Date", 50, yPosition);
        doc.text("Description", 120, yPosition);
        doc.text("Category", 280, yPosition);
        doc.text("Type", 350, yPosition);
        doc.text("Amount", 400, yPosition);
        doc.text("Account", 470, yPosition);
        doc.moveTo(50, yPosition + 5).lineTo(550, yPosition + 5).stroke();
        yPosition += 15;
        doc.font("Helvetica").fontSize(9);
      }

      const date = new Date(transaction.date).toLocaleDateString();
      const description = (transaction.description || "").substring(0, 30);
      const category = transaction.category || "";
      const type = transaction.type || "";
      const amount = transaction.amount.toFixed(2);
      const accountName = transaction.accountId?.name || "N/A";

      // Color code by type
      if (type === "income") {
        doc.fillColor("green");
      } else if (type === "expense") {
        doc.fillColor("red");
      } else {
        doc.fillColor("blue");
      }

      doc.text(date, 50, yPosition);
      doc.text(description, 120, yPosition, { width: 150 });
      doc.text(category, 280, yPosition, { width: 60 });
      doc.text(type, 350, yPosition, { width: 40 });
      doc.text(`$${amount}`, 400, yPosition, { width: 60, align: "right" });
      doc.text(accountName, 470, yPosition, { width: 80 });

      // Reset color
      doc.fillColor("black");
      
      yPosition += rowHeight;
    });

    // Footer
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Page ${i + 1} of ${totalPages} - Generated ${new Date().toLocaleString()}`,
        50,
        pageHeight - 20,
        { align: "center" }
      );
    }

    // Finalize PDF
    doc.end();
  } catch (error) {
    logger.error("Export PDF error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Export transactions as Excel
router.get("/export/excel", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const XLSX = (await import("xlsx")).default;
    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const category = req.query.category;
    const type = req.query.type;

    // Build query
    const query = { userId: userId };
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .limit(10000); // Limit to prevent memory issues

    // Prepare data for Excel
    const worksheetData = [
      ["Date", "Type", "Description", "Category", "Amount", "Account", "To Account"],
      ...transactions.map((t) => [
        new Date(t.date).toLocaleDateString(),
        t.type,
        t.description || "",
        t.category || "",
        t.amount.toFixed(2),
        t.accountId?.name || "N/A",
        t.toAccountId?.name || "",
      ]),
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 12 }, // Date
      { wch: 10 }, // Type
      { wch: 30 }, // Description
      { wch: 15 }, // Category
      { wch: 12 }, // Amount
      { wch: 20 }, // Account
      { wch: 20 }, // To Account
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.xlsx"`);

    res.send(excelBuffer);
  } catch (error) {
    logger.error("Export Excel error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Export transactions as JSON
router.get("/export/json", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const category = req.query.category;
    const type = req.query.type;

    // Build query
    const query = { userId: userId };
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .lean();

    // Format transactions for export
    const exportData = {
      exportedAt: new Date().toISOString(),
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
      filters: {
        category: category || null,
        type: type || null,
      },
      totalTransactions: transactions.length,
      transactions: transactions.map((t) => ({
        id: t._id.toString(),
        date: t.date,
        type: t.type,
        description: t.description,
        category: t.category,
        amount: t.amount,
        account: t.accountId?.name || "N/A",
        accountType: t.accountId?.type || null,
        toAccount: t.toAccountId?.name || null,
        merchant: t.merchant || null,
        tags: t.tags || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    logger.error("Export JSON error:", error);
    sendInternalError(res, error.message || "Internal server error");
  }
});

// Export transactions as CSV
router.get("/export/csv", transactionLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const userId = typeof req.userId === 'string' 
      ? new mongoose.Types.ObjectId(req.userId) 
      : req.userId;

    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const category = req.query.category;
    const type = req.query.type;

    // Build query
    const query = { userId: userId };
    if (category) query.category = category;
    if (type) query.type = type;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .limit(10000); // Limit to prevent memory issues

    // Build CSV
    const headers = ["Date", "Type", "Description", "Category", "Amount", "Account", "To Account"];
    const rows = transactions.map((t) => {
      const date = new Date(t.date).toLocaleDateString();
      const accountName = t.accountId?.name || "N/A";
      const toAccountName = t.toAccountId?.name || "";
      return [
        date,
        t.type,
        t.description || "",
        t.category || "",
        t.amount.toFixed(2),
        accountName,
        toAccountName,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error) {
    logger.error("Export CSV error:", error);
    logger.error("Error details:", error.message);
    sendInternalError(res, error.message || "Internal server error");
  }
});

export default router;

