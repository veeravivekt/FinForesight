import express from "express";
import mongoose from "mongoose";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { validateTransaction } from "../../../shared/utils/validation.js";
import { emitTransactionEvent } from "../../../shared/utils/websocket.js";

const router = express.Router();
const logger = createServiceLogger("transaction-service");
const bulkLimiter = createRateLimiter(20, 60); // 20 bulk operations per minute

/**
 * Bulk create transactions
 * POST /bulk/create
 * Body: { transactions: Array<Transaction> }
 */
router.post("/create", bulkLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return sendValidationError(res, "transactions array is required and must not be empty");
    }

    if (transactions.length > 100) {
      return sendValidationError(res, "Cannot create more than 100 transactions at once");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const results = {
      created: [],
      failed: [],
    };

    // Verify all accounts belong to user
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    const accounts = await Account.find({
      _id: { $in: accountIds },
      userId,
    });

    const validAccountIds = new Set(accounts.map((a) => a._id.toString()));

    // Process transactions
    for (let i = 0; i < transactions.length; i++) {
      const transactionData = transactions[i];

      try {
        // Validate transaction
        const validation = validateTransaction(transactionData);
        if (!validation.isValid) {
          results.failed.push({
            index: i,
            data: transactionData,
            errors: validation.errors,
          });
          continue;
        }

        // Verify account belongs to user
        if (!validAccountIds.has(transactionData.accountId.toString())) {
          results.failed.push({
            index: i,
            data: transactionData,
            errors: ["Account not found or does not belong to user"],
          });
          continue;
        }

        // Create transaction
        const transaction = new Transaction({
          ...transactionData,
          userId,
        });

        await transaction.save();
        results.created.push(transaction);

        // Emit WebSocket event
        emitTransactionEvent(userId.toString(), "created", transaction);
      } catch (error) {
        logger.error(`Bulk create transaction ${i} error:`, error);
        results.failed.push({
          index: i,
          data: transactionData,
          errors: [error.message || "Failed to create transaction"],
        });
      }
    }

    res.status(201).json({
      message: `Created ${results.created.length} transaction(s), ${results.failed.length} failed`,
      created: results.created.length,
      failed: results.failed.length,
      results,
    });
  } catch (error) {
    logger.error("Bulk create transactions error:", error);
    sendInternalError(res);
  }
});

/**
 * Bulk update transactions
 * PUT /bulk/update
 * Body: { updates: Array<{ id: string, data: Partial<Transaction> }> }
 */
router.put("/update", bulkLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return sendValidationError(res, "updates array is required and must not be empty");
    }

    if (updates.length > 50) {
      return sendValidationError(res, "Cannot update more than 50 transactions at once");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    const results = {
      updated: [],
      failed: [],
    };

    for (let i = 0; i < updates.length; i++) {
      const { id, data } = updates[i];

      try {
        if (!id) {
          results.failed.push({
            index: i,
            id,
            errors: ["Transaction ID is required"],
          });
          continue;
        }

        const transaction = await Transaction.findOne({
          _id: id,
          userId,
        });

        if (!transaction) {
          results.failed.push({
            index: i,
            id,
            errors: ["Transaction not found"],
          });
          continue;
        }

        // Update transaction
        Object.assign(transaction, data);
        await transaction.save();

        results.updated.push(transaction);

        // Emit WebSocket event
        emitTransactionEvent(userId.toString(), "updated", transaction);
      } catch (error) {
        logger.error(`Bulk update transaction ${i} error:`, error);
        results.failed.push({
          index: i,
          id,
          errors: [error.message || "Failed to update transaction"],
        });
      }
    }

    res.json({
      message: `Updated ${results.updated.length} transaction(s), ${results.failed.length} failed`,
      updated: results.updated.length,
      failed: results.failed.length,
      results,
    });
  } catch (error) {
    logger.error("Bulk update transactions error:", error);
    sendInternalError(res);
  }
});

/**
 * Bulk delete transactions
 * DELETE /bulk/delete
 * Body: { ids: string[] }
 */
router.delete("/delete", bulkLimiter, async (req, res) => {
  try {
    if (!req.userId) {
      return sendInternalError(res, "User authentication failed");
    }

    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return sendValidationError(res, "ids array is required and must not be empty");
    }

    if (ids.length > 100) {
      return sendValidationError(res, "Cannot delete more than 100 transactions at once");
    }

    const userId = typeof req.userId === "string"
      ? new mongoose.Types.ObjectId(req.userId)
      : req.userId;

    // Delete transactions
    const result = await Transaction.deleteMany({
      _id: { $in: ids },
      userId,
    });

    // Emit WebSocket events
    ids.forEach((id) => {
      emitTransactionEvent(userId.toString(), "deleted", { _id: id });
    });

    res.json({
      message: `Deleted ${result.deletedCount} transaction(s)`,
      deleted: result.deletedCount,
    });
  } catch (error) {
    logger.error("Bulk delete transactions error:", error);
    sendInternalError(res);
  }
});

export default router;

