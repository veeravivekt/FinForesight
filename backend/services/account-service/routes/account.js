import express from "express";
import Account from "../../../shared/models/Account.js";
import Transaction from "../../../shared/models/Transaction.js";
import { createRateLimiter } from "../../../shared/middleware/rateLimiter.js";

const router = express.Router();
const accountLimiter = createRateLimiter(100, 60);

// Get all accounts
router.get("/", accountLimiter, async (req, res) => {
  try {
    const accounts = await Account.find({
      userId: req.userId,
      isArchived: false,
    }).sort({ createdAt: -1 });

    // Calculate balances from transactions
    const accountsWithBalances = await Promise.all(
      accounts.map(async (account) => {
        const transactions = await Transaction.find({ accountId: account._id });
        const balance = transactions.reduce((sum, t) => {
          if (t.type === "income") return sum + t.amount;
          if (t.type === "expense") return sum - t.amount;
          return sum;
        }, account.balance || 0);

        return {
          ...account.toObject(),
          calculatedBalance: balance,
        };
      })
    );

    res.json({ accounts: accountsWithBalances });
  } catch (error) {
    console.error("Get accounts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get account by ID
router.get("/:id", accountLimiter, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Calculate balance
    const transactions = await Transaction.find({ accountId: account._id });
    const balance = transactions.reduce((sum, t) => {
      if (t.type === "income") return sum + t.amount;
      if (t.type === "expense") return sum - t.amount;
      return sum;
    }, account.balance || 0);

    res.json({
      ...account.toObject(),
      calculatedBalance: balance,
    });
  } catch (error) {
    console.error("Get account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create account
router.post("/", accountLimiter, async (req, res) => {
  try {
    const { name, type, balance, currency, institution, accountNumber, color } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    const account = new Account({
      userId: req.userId,
      name,
      type,
      balance: balance || 0,
      currency: currency || "USD",
      institution,
      accountNumber,
      color: color || "#3b82f6",
    });

    await account.save();

    res.status(201).json(account);
  } catch (error) {
    console.error("Create account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update account
router.put("/:id", accountLimiter, async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json(account);
  } catch (error) {
    console.error("Update account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete/Archive account
router.delete("/:id", accountLimiter, async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { isArchived: true },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ message: "Account archived successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Transfer between accounts
router.post("/transfer", accountLimiter, async (req, res) => {
  try {
    const { fromAccountId, toAccountId, amount, description, date } = req.body;

    if (!fromAccountId || !toAccountId || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid transfer data" });
    }

    // Verify accounts belong to user
    const fromAccount = await Account.findOne({
      _id: fromAccountId,
      userId: req.userId,
    });
    const toAccount = await Account.findOne({
      _id: toAccountId,
      userId: req.userId,
    });

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ error: "Account not found" });
    }

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: "Cannot transfer to same account" });
    }

    // Create transfer transactions
    const expenseTransaction = new Transaction({
      userId: req.userId,
      accountId: fromAccountId,
      amount,
      description: description || `Transfer to ${toAccount.name}`,
      category: "Other",
      type: "transfer",
      toAccountId: toAccountId,
      date: date || new Date(),
    });

    const incomeTransaction = new Transaction({
      userId: req.userId,
      accountId: toAccountId,
      amount,
      description: description || `Transfer from ${fromAccount.name}`,
      category: "Other",
      type: "transfer",
      toAccountId: fromAccountId,
      date: date || new Date(),
    });

    await expenseTransaction.save();
    await incomeTransaction.save();

    res.status(201).json({
      message: "Transfer completed successfully",
      transactions: [expenseTransaction, incomeTransaction],
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get account transactions
router.get("/:id/transactions", accountLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    const transactions = await Transaction.find({ accountId: req.params.id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .populate("toAccountId", "name");

    const total = await Transaction.countDocuments({ accountId: req.params.id });

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get account transactions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

