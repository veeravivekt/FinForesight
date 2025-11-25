import express from "express";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import RecurringTransaction from "../../../shared/models/RecurringTransaction.js";
import { generateTextWithRetry } from "../../../shared/utils/gemini.js";
import { getCache, setCache } from "../../../shared/utils/redis.js";
import { sendError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("cashflow");

/**
 * Identify recurring transactions from history
 */
function identifyRecurringTransactions(transactions) {
  const recurring = new Map();

  // Group by merchant/description
  const grouped = {};
  transactions.forEach((t) => {
    const key = t.description.toLowerCase().trim();
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(t);
  });

  // Find patterns (same amount, similar dates)
  Object.entries(grouped).forEach(([key, trans]) => {
    if (trans.length >= 2) {
      // Check if amounts are similar (within 5%)
      const amounts = trans.map((t) => Math.abs(t.amount));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const isSimilarAmount = amounts.every(
        (amt) => Math.abs(amt - avgAmount) / avgAmount < 0.05,
      );

      if (isSimilarAmount) {
        // Calculate average interval
        const dates = trans.map((t) => new Date(t.date)).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
          intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24)); // days
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

        recurring.set(key, {
          description: trans[0].description,
          amount: avgAmount,
          category: trans[0].category,
          intervalDays: Math.round(avgInterval),
          lastDate: dates[dates.length - 1],
          count: trans.length,
        });
      }
    }
  });

  return Array.from(recurring.values());
}

/**
 * Calculate daily balance projections
 */
function calculateDailyProjections(
  currentBalance,
  startDate,
  days,
  transactions,
  recurringTransactions,
) {
  const projections = [];
  const dailyChanges = new Map();

  // Process historical transactions for the projection period
  const projectionStart = new Date(startDate);
  projectionStart.setHours(0, 0, 0, 0);

  transactions.forEach((t) => {
    const tDate = new Date(t.date);
    tDate.setHours(0, 0, 0, 0);
    if (tDate >= projectionStart) {
      const dayKey = tDate.toISOString().split("T")[0];
      if (!dailyChanges.has(dayKey)) {
        dailyChanges.set(dayKey, { income: 0, expense: 0 });
      }
      const change = dailyChanges.get(dayKey);
      if (t.type === "income") {
        change.income += Math.abs(t.amount);
      } else if (t.type === "expense") {
        change.expense += Math.abs(t.amount);
      }
    }
  });

  // Add recurring transactions
  recurringTransactions.forEach((recurring) => {
    let nextDate = new Date(recurring.lastDate);
    nextDate.setDate(nextDate.getDate() + recurring.intervalDays);

    while (nextDate <= new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000)) {
      const dayKey = nextDate.toISOString().split("T")[0];
      if (!dailyChanges.has(dayKey)) {
        dailyChanges.set(dayKey, { income: 0, expense: 0 });
      }
      const change = dailyChanges.get(dayKey);
      if (recurring.category === "income") {
        change.income += recurring.amount;
      } else {
        change.expense += recurring.amount;
      }
      nextDate.setDate(nextDate.getDate() + recurring.intervalDays);
    }
  });

  // Generate daily projections
  let balance = currentBalance;
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    const dayKey = date.toISOString().split("T")[0];

    const change = dailyChanges.get(dayKey) || { income: 0, expense: 0 };
    balance = balance + change.income - change.expense;

    projections.push({
      date: dayKey,
      balance: Math.round(balance * 100) / 100,
      income: change.income,
      expense: change.expense,
      netChange: change.income - change.expense,
    });
  }

  return projections;
}

/**
 * Find low balance warnings
 */
function findLowBalanceWarnings(projections, threshold = 100) {
  const warnings = [];
  projections.forEach((proj, index) => {
    if (proj.balance < threshold && (index === 0 || projections[index - 1].balance >= threshold)) {
      warnings.push({
        date: proj.date,
        balance: proj.balance,
        message: `Balance may fall below $${threshold} on ${proj.date}`,
      });
    }
  });
  return warnings;
}

/**
 * POST /cashflow/forecast - Get cash flow predictions
 */
router.post("/forecast", async (req, res) => {
  try {
    const { accountId, days = 90 } = req.body;
    const userId = req.userId;

    if (days < 1 || days > 365) {
      return sendValidationError(res, "Days must be between 1 and 365");
    }

    const cacheKey = `cashflow:forecast:${userId}:${accountId || "all"}:${days}`;

    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get account(s)
    const accountQuery = { userId, isArchived: false };
    if (accountId) {
      accountQuery._id = accountId;
    }

    const accounts = await Account.find(accountQuery);
    if (accounts.length === 0) {
      return sendError(res, 404, "No accounts found", "NOT_FOUND");
    }

    const results = [];

    for (const account of accounts) {
      // Get historical transactions (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const transactions = await Transaction.find({
        userId,
        accountId: account._id,
        date: { $gte: twelveMonthsAgo },
      })
        .sort({ date: -1 })
        .limit(1000);

      // Get recurring transactions from database
      const dbRecurring = await RecurringTransaction.find({
        userId,
        accountId: account._id,
        isActive: true,
      });

      // Identify recurring patterns from history
      const identifiedRecurring = identifyRecurringTransactions(transactions);

      // Combine database recurring with identified recurring
      const allRecurring = [
        ...dbRecurring.map((r) => ({
          description: r.description,
          amount: r.amount,
          category: r.category,
          intervalDays: r.frequency === "monthly" ? 30 : r.frequency === "weekly" ? 7 : r.frequency === "biweekly" ? 14 : r.frequency === "daily" ? 1 : r.frequency === "yearly" ? 365 : 30,
          lastDate: r.lastCreated || r.nextDueDate || new Date(),
          count: 1,
        })),
        ...identifiedRecurring,
      ];

      // Calculate current balance (account balance + pending transactions)
      const pendingIncome = transactions
        .filter((t) => t.type === "income" && new Date(t.date) > new Date())
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const pendingExpense = transactions
        .filter((t) => t.type === "expense" && new Date(t.date) > new Date())
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const currentBalance = account.balance + pendingIncome - pendingExpense;

      // Calculate daily projections
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const projections = calculateDailyProjections(
        currentBalance,
        startDate,
        days,
        transactions,
        allRecurring,
      );

      // Find low balance warnings
      const lowBalanceWarnings = findLowBalanceWarnings(projections, 100);

      // Calculate upcoming bills
      const upcomingBills = allRecurring
        .filter((r) => r.category !== "income")
        .map((r) => {
          const nextDate = new Date(r.lastDate);
          nextDate.setDate(nextDate.getDate() + r.intervalDays);
          return {
            description: r.description,
            amount: r.amount,
            predictedDate: nextDate.toISOString().split("T")[0],
            category: r.category,
          };
        })
        .filter((b) => new Date(b.predictedDate) <= new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000))
        .sort((a, b) => new Date(a.predictedDate) - new Date(b.predictedDate));

      // Use Gemini to analyze patterns and generate insights
      let insights = "";
      try {
        const prompt = `Analyze the following cash flow data and provide 2-3 key insights about spending patterns, income trends, and financial health.

Account: ${account.name} (${account.type})
Current Balance: $${currentBalance.toFixed(2)}
Projection Period: ${days} days

Historical Transactions: ${transactions.length} transactions
Recurring Bills: ${upcomingBills.length} identified
Low Balance Warnings: ${lowBalanceWarnings.length}

Projected Balance Range: $${Math.min(...projections.map((p) => p.balance)).toFixed(2)} to $${Math.max(...projections.map((p) => p.balance)).toFixed(2)}

Provide concise insights (2-3 sentences) about:
1. Spending patterns and trends
2. Income stability
3. Any financial risks or opportunities

Be specific and actionable.`;

        insights = await generateTextWithRetry(prompt, {
          temperature: 0.7,
          maxTokens: 300,
        });
        
        if (!insights || insights.trim().length === 0) {
          throw new Error("Empty response from Gemini");
        }
      } catch (error) {
        logger.warn("Failed to generate insights with Gemini:", error);
        logger.warn("Error details:", {
          message: error.message,
          name: error.name,
        });
        
        // Generate fallback insights based on data
        const minBalance = Math.min(...projections.map((p) => p.balance));
        const maxBalance = Math.max(...projections.map((p) => p.balance));
        const endBalance = projections[projections.length - 1].balance;
        const avgDailyChange = projections.reduce((sum, p) => sum + p.netChange, 0) / projections.length;
        
        const fallbackInsights = [];
        
        if (lowBalanceWarnings.length > 0) {
          fallbackInsights.push(`⚠️ Your balance may drop below $100 on ${lowBalanceWarnings.length} day(s) in the forecast period.`);
        }
        
        if (endBalance < currentBalance) {
          fallbackInsights.push(`📉 Your balance is projected to decrease by $${(currentBalance - endBalance).toFixed(2)} over the next ${days} days.`);
        } else if (endBalance > currentBalance) {
          fallbackInsights.push(`📈 Your balance is projected to increase by $${(endBalance - currentBalance).toFixed(2)} over the next ${days} days.`);
        }
        
        if (upcomingBills.length > 0) {
          const totalBills = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
          fallbackInsights.push(`💳 You have ${upcomingBills.length} recurring bill(s) totaling $${totalBills.toFixed(2)} coming up.`);
        }
        
        if (avgDailyChange < 0) {
          fallbackInsights.push(`💰 On average, you're spending $${Math.abs(avgDailyChange).toFixed(2)} more per day than you're earning.`);
        }
        
        insights = fallbackInsights.length > 0 
          ? fallbackInsights.join(" ") 
          : `Your account balance ranges from $${minBalance.toFixed(2)} to $${maxBalance.toFixed(2)} over the next ${days} days.`;
      }

      // Calculate safe to spend amount (minimum balance in next 30 days)
      const next30Days = projections.slice(0, 30);
      const minBalance30Days = Math.min(...next30Days.map((p) => p.balance));
      const safeToSpend = Math.max(0, currentBalance - minBalance30Days - 100); // Buffer of $100

      results.push({
        account: {
          id: account._id.toString(),
          name: account.name,
          type: account.type,
          currentBalance,
        },
        projections: projections.slice(0, Math.min(90, days)), // Limit to 90 days for response size
        upcomingBills: upcomingBills.slice(0, 20), // Limit to 20 bills
        lowBalanceWarnings,
        insights,
        safeToSpend: Math.round(safeToSpend * 100) / 100,
        summary: {
          minBalance: Math.min(...projections.map((p) => p.balance)),
          maxBalance: Math.max(...projections.map((p) => p.balance)),
          avgDailyChange: projections.reduce((sum, p) => sum + p.netChange, 0) / projections.length,
          projectedEndBalance: projections[projections.length - 1].balance,
        },
      });
    }

    const result = {
      forecast: results,
      generatedAt: new Date().toISOString(),
      projectionDays: days,
    };

    // Cache for 1 hour
    await setCache(cacheKey, result, 3600);

    res.json(result);
  } catch (error) {
    logger.error("Cash flow forecast error:", error);
    sendInternalError(res);
  }
});

export default router;

