import express from "express";
import mongoose from "mongoose";
import TransactionTemplate from "../../../shared/models/TransactionTemplate.js";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";
import { sendError, sendNotFoundError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";
import { emitTransactionEvent } from "../../../shared/utils/websocket.js";

const router = express.Router();
const logger = createServiceLogger("transaction-service");
const templateLimiter = createRateLimiter(100, 60);

// Get all templates
router.get("/", templateLimiter, async (req, res) => {
  try {
    const templates = await TransactionTemplate.find({
      userId: req.userId,
      isActive: true,
    })
      .populate("accountId", "name type")
      .populate("toAccountId", "name")
      .sort({ name: 1 });

    res.json({ templates });
  } catch (error) {
    logger.error("Get templates error:", error);
    sendInternalError(res);
  }
});

// Get template by ID
router.get("/:id", templateLimiter, async (req, res) => {
  try {
    const template = await TransactionTemplate.findOne({
      _id: req.params.id,
      userId: req.userId,
    })
      .populate("accountId", "name type")
      .populate("toAccountId", "name");

    if (!template) {
      return sendNotFoundError(res, "Template");
    }

    res.json({ template });
  } catch (error) {
    logger.error("Get template error:", error);
    sendInternalError(res);
  }
});

// Create template
router.post("/", templateLimiter, async (req, res) => {
  try {
    const { name, description, category, type, amount, accountId, toAccountId, tags } = req.body;

    if (!name || !category || !type || amount === undefined || !accountId) {
      return sendValidationError(res, "Name, category, type, amount, and accountId are required");
    }

    // Verify account belongs to user
    const account = await Account.findOne({
      _id: accountId,
      userId: req.userId,
    });

    if (!account) {
      return sendNotFoundError(res, "Account");
    }

    // Verify toAccount if provided
    if (toAccountId) {
      const toAccount = await Account.findOne({
        _id: toAccountId,
        userId: req.userId,
      });

      if (!toAccount) {
        return sendNotFoundError(res, "To Account");
      }
    }

    const template = new TransactionTemplate({
      userId: req.userId,
      name,
      description,
      category,
      type,
      amount,
      accountId,
      toAccountId,
      tags: tags || [],
    });

    await template.save();

    res.status(201).json({
      message: "Template created successfully",
      template,
    });
  } catch (error) {
    logger.error("Create template error:", error);
    sendInternalError(res);
  }
});

// Update template
router.put("/:id", templateLimiter, async (req, res) => {
  try {
    const template = await TransactionTemplate.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!template) {
      return sendNotFoundError(res, "Template");
    }

    // Verify accounts if updated
    if (req.body.accountId) {
      const account = await Account.findOne({
        _id: req.body.accountId,
        userId: req.userId,
      });

      if (!account) {
        return sendNotFoundError(res, "Account");
      }
    }

    if (req.body.toAccountId) {
      const toAccount = await Account.findOne({
        _id: req.body.toAccountId,
        userId: req.userId,
      });

      if (!toAccount) {
        return sendNotFoundError(res, "To Account");
      }
    }

    Object.assign(template, req.body);
    await template.save();

    res.json({
      message: "Template updated successfully",
      template,
    });
  } catch (error) {
    logger.error("Update template error:", error);
    sendInternalError(res);
  }
});

// Delete template
router.delete("/:id", templateLimiter, async (req, res) => {
  try {
    const template = await TransactionTemplate.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!template) {
      return sendNotFoundError(res, "Template");
    }

    template.isActive = false;
    await template.save();

    res.json({ message: "Template deleted successfully" });
  } catch (error) {
    logger.error("Delete template error:", error);
    sendInternalError(res);
  }
});

// Create transaction from template
router.post("/:id/use", templateLimiter, async (req, res) => {
  try {
    const template = await TransactionTemplate.findOne({
      _id: req.params.id,
      userId: req.userId,
      isActive: true,
    })
      .populate("accountId")
      .populate("toAccountId");

    if (!template) {
      return sendNotFoundError(res, "Template");
    }

    // Override template values with request body if provided
    const transactionData = {
      userId: req.userId,
      accountId: template.accountId._id,
      amount: req.body.amount || template.amount,
      description: req.body.description || template.description || template.name,
      category: template.category,
      type: template.type,
      date: req.body.date || new Date(),
      toAccountId: template.toAccountId?._id || req.body.toAccountId,
      tags: req.body.tags || template.tags || [],
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Emit WebSocket event
    emitTransactionEvent(req.userId.toString(), "created", transaction);

    res.status(201).json({
      message: "Transaction created from template",
      transaction,
    });
  } catch (error) {
    logger.error("Use template error:", error);
    sendInternalError(res);
  }
});

export default router;

