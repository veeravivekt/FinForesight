import express from "express";
import Transaction from "../../../shared/models/Transaction.js";
import Account from "../../../shared/models/Account.js";
import Budget from "../../../shared/models/Budget.js";
import Goal from "../../../shared/models/Goal.js";
import User from "../../../shared/models/User.js";
import AIAnswer from "../../../shared/models/AIAnswer.js";
import { generateTextWithRetry } from "../../../shared/utils/gemini.js";
import { getCache, setCache } from "../../../shared/utils/redis.js";
import { sendError, sendValidationError, sendInternalError } from "../../../shared/utils/errorHandler.js";
import { createServiceLogger } from "../../../shared/utils/logger.js";

const router = express.Router();
const logger = createServiceLogger("ai-assistant");

/**
 * Extract date range from query text
 */
function extractDateRange(query) {
  const lowerQuery = query.toLowerCase();
  const now = new Date();
  let startDate = null;
  let endDate = new Date();

  // Today
  if (lowerQuery.includes("today")) {
    startDate = new Date(now.setHours(0, 0, 0, 0));
    endDate = new Date(now.setHours(23, 59, 59, 999));
  }
  // This week
  else if (lowerQuery.includes("this week") || lowerQuery.includes("week")) {
    const dayOfWeek = now.getDay();
    startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }
  // This month
  else if (lowerQuery.includes("this month") || lowerQuery.includes("month")) {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }
  // Last month
  else if (lowerQuery.includes("last month")) {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  }
  // This year
  else if (lowerQuery.includes("this year") || lowerQuery.includes("year")) {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  }
  // Last 30 days
  else if (lowerQuery.includes("last 30 days") || lowerQuery.includes("30 days")) {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }
  // Last 7 days
  else if (lowerQuery.includes("last 7 days") || lowerQuery.includes("7 days")) {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

/**
 * Extract category from query
 */
function extractCategory(query) {
  const lowerQuery = query.toLowerCase();
  const categories = [
    "Food", "Transport", "Shopping", "Bills", "Entertainment",
    "Healthcare", "Education", "Travel", "Other",
  ];

  for (const category of categories) {
    if (lowerQuery.includes(category.toLowerCase())) {
      return category;
    }
  }

  return null;
}

/**
 * Generate a quick default answer for demo (without context)
 * Used when we need instant responses
 */
function generateQuickDefaultAnswer(query) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("spend") && lowerQuery.includes("month")) {
    return "Based on your transaction history, you've spent money this month. Check your transactions for detailed breakdown.";
  }
  if (lowerQuery.includes("biggest") || lowerQuery.includes("category")) {
    return "Your biggest expense category is based on your recent transactions. Check your spending breakdown for details.";
  }
  if (lowerQuery.includes("budget") || lowerQuery.includes("track")) {
    return "You have active budgets set up. Monitor your spending to stay within budget limits.";
  }
  if (lowerQuery.includes("trend")) {
    return "Your spending trends show patterns over time. Review your transaction history for detailed trends.";
  }
  if (lowerQuery.includes("safely") || lowerQuery.includes("safe")) {
    return "Based on your account balance and spending patterns, you can safely spend while maintaining a buffer.";
  }
  if (lowerQuery.includes("balance") || lowerQuery.includes("account")) {
    return "Your account balances reflect your current financial status. Check your accounts for details.";
  }
  if (lowerQuery.includes("goal")) {
    return "You have financial goals set up. Track your progress and continue contributing to reach your targets.";
  }

  return "I can help you understand your finances. Ask me about spending, budgets, goals, or account balances.";
}

/**
 * Generate a fallback answer from financial data without AI
 */
function generateFallbackAnswer(query, context, dateRange, category) {
  const lowerQuery = query.toLowerCase();
  const { summary, transactions, budgets, goals, accounts } = context;

  // Spending questions
  if (lowerQuery.includes("spend") || lowerQuery.includes("expense") || lowerQuery.includes("spent")) {
    const categoryTotals = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
      });

    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)}`)
      .join(", ");

    const period = dateRange?.startDate ? "in the selected period" : "recently";
    return `Based on your transaction history, you've spent $${summary.totalExpense.toFixed(2)} ${period}. Your top spending categories are: ${topCategories}.`;
  }

  // Income questions
  if (lowerQuery.includes("income") || lowerQuery.includes("earn") || lowerQuery.includes("made")) {
    const period = dateRange?.startDate ? "in the selected period" : "recently";
    return `Your total income ${period} is $${summary.totalIncome.toFixed(2)}. After expenses, your net amount is $${summary.netAmount.toFixed(2)}.`;
  }

  // Budget questions
  if (lowerQuery.includes("budget") || lowerQuery.includes("budgeted")) {
    if (budgets.length === 0) {
      return "You don't have any active budgets set up. Consider creating budgets to track your spending by category.";
    }

    const budgetSummary = budgets.map(b => `${b.category}: $${b.amount.toFixed(2)}/${b.period}`).join(", ");
    return `You have ${budgets.length} active budget(s): ${budgetSummary}. Keep track of your spending to stay within these limits.`;
  }

  // Goal questions
  if (lowerQuery.includes("goal") || lowerQuery.includes("save") || lowerQuery.includes("target")) {
    if (goals.length === 0) {
      return "You don't have any active financial goals. Consider setting up goals to track your savings progress.";
    }

    const goalSummary = goals.map(g => {
      const progress = ((g.currentAmount / g.targetAmount) * 100).toFixed(1);
      return `${g.name}: $${g.currentAmount.toFixed(2)} / $${g.targetAmount.toFixed(2)} (${progress}%)`;
    }).join(", ");

    return `You have ${goals.length} active goal(s): ${goalSummary}. Keep contributing to reach your targets!`;
  }

  // Balance/account questions
  if (lowerQuery.includes("balance") || lowerQuery.includes("account") || lowerQuery.includes("money")) {
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const accountList = accounts.map(a => `${a.name}: $${(a.balance || 0).toFixed(2)}`).join(", ");

    if (accounts.length === 0) {
      return "You don't have any accounts set up. Add accounts to track your balances.";
    }

    return `Your total balance across all accounts is $${totalBalance.toFixed(2)}. Account breakdown: ${accountList}.`;
  }

  // Category-specific questions
  if (category) {
    const categoryTransactions = transactions.filter(t => t.category === category && t.type === "expense");
    const categoryTotal = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const count = categoryTransactions.length;

    if (count === 0) {
      return `You haven't made any ${category} transactions ${dateRange?.startDate ? "in the selected period" : "recently"}.`;
    }

    return `You've spent $${categoryTotal.toFixed(2)} on ${category} across ${count} transaction(s) ${dateRange?.startDate ? "in the selected period" : "recently"}.`;
  }

  // Transaction count questions
  if (lowerQuery.includes("transaction") || lowerQuery.includes("how many")) {
    const period = dateRange?.startDate ? "in the selected period" : "recently";
    return `You have ${summary.transactionCount} transaction(s) ${period}. Total income: $${summary.totalIncome.toFixed(2)}, Total expenses: $${summary.totalExpense.toFixed(2)}.`;
  }

  // Default fallback
  return `Based on your financial data: You have ${summary.transactionCount} transactions with total income of $${summary.totalIncome.toFixed(2)} and total expenses of $${summary.totalExpense.toFixed(2)}, resulting in a net amount of $${summary.netAmount.toFixed(2)}. You have ${accounts.length} account(s), ${budgets.length} active budget(s), and ${goals.length} active goal(s).`;
}

/**
 * Build context from user's financial data
 */
async function buildFinancialContext(userId, dateRange = null) {
  const context = {
    accounts: [],
    transactions: [],
    budgets: [],
    goals: [],
    summary: {},
  };

  try {
    // Get accounts
    const accounts = await Account.find({ userId, isArchived: false });
    context.accounts = accounts.map((acc) => ({
      id: acc._id.toString(),
      name: acc.name,
      type: acc.type,
      balance: acc.balance,
    }));

    // Get transactions
    const transactionQuery = { userId };
    if (dateRange?.startDate) {
      transactionQuery.date = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    } else {
      // Default to last 3 months
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      transactionQuery.date = { $gte: threeMonthsAgo };
    }

    const transactions = await Transaction.find(transactionQuery)
      .sort({ date: -1 })
      .limit(100)
      .populate("accountId", "name type");

    context.transactions = transactions.map((t) => ({
      id: t._id.toString(),
      amount: t.amount,
      description: t.description,
      category: t.category,
      type: t.type,
      date: t.date.toISOString(),
      account: t.accountId?.name || "Unknown",
    }));

    // Calculate summary
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    context.summary = {
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount: transactions.length,
    };

    // Get budgets
    const budgets = await Budget.find({ userId, isActive: true });
    context.budgets = budgets.map((b) => ({
      category: b.category,
      amount: b.amount,
      period: b.period,
    }));

    // Get goals
    const goals = await Goal.find({ userId, isCompleted: false });
    context.goals = goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progress: g.getProgress(),
      targetDate: g.targetDate.toISOString(),
    }));
  } catch (error) {
    logger.error("Error building financial context:", error);
  }

  return context;
}

/**
 * Pre-populate cache with default answers for all users
 * This ensures demo-ready answers are available immediately
 */
export async function prePopulateCacheForAllUsers() {
  try {
    logger.info("Starting cache pre-population for all users...");
    const users = await User.find({}).select("_id").limit(100); // Limit to first 100 users

    let populatedCount = 0;
    for (const user of users) {
      try {
        const userId = user._id.toString();
        const context = await buildFinancialContext(userId, null);

        // Pre-populate common queries
        await prePopulateDefaultAnswers(userId, context);
        populatedCount++;

        logger.debug(`Pre-populated cache for user: ${userId}`);
      } catch (error) {
        logger.warn(`Failed to pre-populate cache for user ${user._id}:`, error.message);
      }
    }

    logger.info(`Cache pre-population completed. Populated cache for ${populatedCount} users.`);
    return populatedCount;
  } catch (error) {
    logger.error("Error pre-populating cache for all users:", error);
    return 0;
  }
}

/**
 * Pre-populate cache with default answers for common queries
 */
async function prePopulateDefaultAnswers(userId, context) {
  const commonQueries = [
    {
      query: "how much did i spend",
      response: `Based on your transaction history, you've spent $${context.summary.totalExpense.toFixed(2)} recently.`,
      categoryBreakdown: (() => {
        const categoryTotals = {};
        context.transactions
          .filter((t) => t.type === "expense")
          .forEach((t) => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
          });
        return Object.entries(categoryTotals)
          .map(([cat, amount]) => ({ category: cat, amount }))
          .sort((a, b) => b.amount - a.amount);
      })(),
    },
    {
      query: "what's my balance",
      response: (() => {
        const totalBalance = context.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
        const accountList = context.accounts.map(a => `${a.name}: $${(a.balance || 0).toFixed(2)}`).join(", ");
        return context.accounts.length === 0
          ? "You don't have any accounts set up. Add accounts to track your balances."
          : `Your total balance across all accounts is $${totalBalance.toFixed(2)}. Account breakdown: ${accountList}.`;
      })(),
    },
    {
      query: "show me my budgets",
      response: context.budgets.length === 0
        ? "You don't have any active budgets set up. Consider creating budgets to track your spending by category."
        : `You have ${context.budgets.length} active budget(s): ${context.budgets.map(b => `${b.category}: $${b.amount.toFixed(2)}/${b.period}`).join(", ")}. Keep track of your spending to stay within these limits.`,
    },
    {
      query: "what are my goals",
      response: context.goals.length === 0
        ? "You don't have any active financial goals. Consider setting up goals to track your savings progress."
        : `You have ${context.goals.length} active goal(s): ${context.goals.map(g => {
            const progress = ((g.currentAmount / g.targetAmount) * 100).toFixed(1);
            return `${g.name}: $${g.currentAmount.toFixed(2)} / $${g.targetAmount.toFixed(2)} (${progress}%)`;
          }).join(", ")}. Keep contributing to reach your targets!`,
    },
    {
      query: "how much did i spend this month",
      response: `Based on your transaction history, you've spent $${context.summary.totalExpense.toFixed(2)} this month.`,
    },
    {
      query: "what's my total income",
      response: `Your total income is $${context.summary.totalIncome.toFixed(2)}. After expenses, your net amount is $${context.summary.netAmount.toFixed(2)}.`,
    },
  ];

  // Store default answers in database and cache
  for (const item of commonQueries) {
    const normalizedQuery = item.query.toLowerCase();
    const cacheKey = `ai:chat:${userId}:${Buffer.from(normalizedQuery).toString("base64").substring(0, 50)}`;

    // Resolve response if it's a function
    const response = typeof item.response === "function" ? item.response() : item.response;
    const categoryBreakdown = typeof item.categoryBreakdown === "function" ? item.categoryBreakdown() : (item.categoryBreakdown || null);

    const result = {
      query: item.query,
      response,
      categoryBreakdown,
      dataUsed: {
        transactionCount: context.transactions.length,
        dateRange: null,
        category: null,
      },
      timestamp: new Date().toISOString(),
    };

    try {
      // Save to database
      await AIAnswer.findOneAndUpdate(
        { userId, normalizedQuery, isDefault: true },
        {
          userId,
          query: item.query,
          normalizedQuery,
          response,
          categoryBreakdown: categoryBreakdown || [],
          dataUsed: result.dataUsed,
          isDefault: true,
          source: "generated",
        },
        { upsert: true, new: true },
      );

      // Also cache in Redis
      await setCache(cacheKey, result, 3600); // Cache for 1 hour
      logger.debug(`Pre-populated database and cache for query: ${item.query}`);
    } catch (error) {
      logger.warn(`Failed to pre-populate database/cache for "${item.query}":`, error.message);
    }
  }
}

/**
 * POST /ai/chat - Natural language finance assistant
 */
router.post("/chat", async (req, res) => {
  const startTime = Date.now();
  const MIN_DELAY_MS = 3000; // 3 seconds minimum delay for demo purposes

  // Helper function to ensure minimum delay has passed
  const ensureMinimumDelay = async () => {
    const elapsed = Date.now() - startTime;
    const remainingDelay = Math.max(0, MIN_DELAY_MS - elapsed);
    if (remainingDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, remainingDelay));
    }
  };

  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return sendValidationError(res, "Query is required and must be a non-empty string");
    }

    const {userId} = req;
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `ai:chat:${userId}:${Buffer.from(normalizedQuery).toString("base64").substring(0, 50)}`;

    // Check database for default answers first
    const dbAnswer = await AIAnswer.findByQuery(userId, normalizedQuery);

    // If found in database, use it
    if (dbAnswer) {
      await ensureMinimumDelay();
      const result = {
        query: dbAnswer.query,
        response: dbAnswer.response,
        categoryBreakdown: dbAnswer.categoryBreakdown || null,
        dataUsed: dbAnswer.dataUsed || null,
        timestamp: dbAnswer.updatedAt.toISOString(),
      };
      logger.info(`Returning database answer for query: ${query.substring(0, 50)}`);
      return res.json(result);
    }

    // Check Redis cache as fallback
    const cached = await getCache(cacheKey);

    // If cached, ensure minimum delay before returning
    if (cached) {
      await ensureMinimumDelay();
      logger.info(`Returning cached answer for query: ${query.substring(0, 50)}`);
      return res.json(cached);
    }

    // Extract date range and category from query
    const dateRange = extractDateRange(query);
    const category = extractCategory(query);

    // For DEMO: Check if it's a common query pattern
    // If yes, return quick default answer immediately, then build context in background
    const commonQueryPatterns = [
      { pattern: /spend|expense|spent|spending/i, type: "spending" },
      { pattern: /balance|account|money|how much do i have/i, type: "balance" },
      { pattern: /budget|budgeted|budgets|track/i, type: "budget" },
      { pattern: /goal|goals|save|target|savings/i, type: "goal" },
      { pattern: /income|earn|made|how much did i make/i, type: "income" },
      { pattern: /category|categories|breakdown|biggest/i, type: "category" },
      { pattern: /transaction|transactions|how many/i, type: "transaction" },
      { pattern: /trend|trends/i, type: "trend" },
      { pattern: /safely|safe|can i spend/i, type: "safe" },
    ];

    const matchedPattern = commonQueryPatterns.find(p => p.pattern.test(query));

    // For common queries, build context and try Gemini API first
    if (matchedPattern) {
      // Build financial context
      const context = await buildFinancialContext(userId, dateRange);

      // Try Gemini API first if available
      let response;
      let isFallback = false;
      let categoryBreakdown = null;

      // Check if Gemini API is available
      const geminiAvailable = !!process.env.GEMINI_API_KEY;

      if (geminiAvailable) {
        try {
          // Build prompt for Gemini
          const prompt = `You are a helpful financial assistant for a personal finance app. Answer the user's question about their finances using the provided data.

User's Question: "${query}"

Financial Data:
- Accounts: ${JSON.stringify(context.accounts)}
- Total Income: $${context.summary.totalIncome.toFixed(2)}
- Total Expenses: $${context.summary.totalExpense.toFixed(2)}
- Net Amount: $${context.summary.netAmount.toFixed(2)}
- Transaction Count: ${context.summary.transactionCount}
- Budgets: ${JSON.stringify(context.budgets)}
- Goals: ${JSON.stringify(context.goals)}

Recent Transactions (last 10):
${context.transactions.slice(0, 10).map((t) =>
  `- ${t.date.split("T")[0]}: ${t.description} - $${Math.abs(t.amount).toFixed(2)} (${t.category})`,
).join("\n")}

Instructions:
1. Answer the user's question directly and concisely
2. Use specific numbers from the data when relevant
3. Be friendly and helpful
4. If the question asks about spending, provide category breakdowns
5. If asking about budgets, compare actual spending vs budgeted amounts
6. If asking about goals, mention progress and time remaining
7. Format currency as $X.XX
8. Format dates as YYYY-MM-DD or relative dates (e.g., "last week")
9. If data is insufficient, say so politely

Answer:`;

          // Generate response using Gemini
          response = await generateTextWithRetry(prompt, {
            temperature: 0.7,
            maxTokens: 1024,
          });

          // Validate response
          if (!response || typeof response !== "string" || response.trim().length === 0) {
            logger.error("Invalid response from Gemini:", { response, type: typeof response });
            throw new Error("Invalid response from AI service");
          }

          logger.info(`Successfully got Gemini response for query: ${query.substring(0, 50)}`);
        } catch (error) {
          logger.warn("Gemini API error, using fallback answer:", error.message);
          logger.debug("Gemini API error details:", {
            message: error.message,
            name: error.name,
            apiKeySet: !!process.env.GEMINI_API_KEY,
          });

          // Generate fallback answer from current data
          response = generateFallbackAnswer(query, context, dateRange, category);
          isFallback = true;
          logger.info("Generated fallback answer from financial data");
        }
      } else {
        // No Gemini API key, use fallback
        response = generateFallbackAnswer(query, context, dateRange, category);
        isFallback = true;
        logger.info("GEMINI_API_KEY not set, using fallback answer");
      }

      // Calculate category breakdown if relevant
      if (matchedPattern.type === "spending" || matchedPattern.type === "category" || query.toLowerCase().includes("category") || query.toLowerCase().includes("biggest")) {
        const categoryTotals = {};
        context.transactions
          .filter((t) => t.type === "expense")
          .forEach((t) => {
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
          });
        categoryBreakdown = Object.entries(categoryTotals)
          .map(([cat, amount]) => ({ category: cat, amount }))
          .sort((a, b) => b.amount - a.amount);
      }

      const result = {
        query,
        response,
        categoryBreakdown,
        dataUsed: {
          transactionCount: context.transactions.length,
          dateRange: dateRange.startDate
            ? {
                start: dateRange.startDate.toISOString(),
                end: dateRange.endDate.toISOString(),
              }
            : null,
          category: category || null,
        },
        timestamp: new Date().toISOString(),
      };

      // Ensure minimum delay has passed before returning
      await ensureMinimumDelay();

      // Save to database for future use
      try {
        await AIAnswer.findOneAndUpdate(
          { userId, normalizedQuery, isDefault: true },
          {
            userId,
            query,
            normalizedQuery,
            response,
            categoryBreakdown: categoryBreakdown || [],
            dataUsed: result.dataUsed,
            isDefault: true,
            source: isFallback ? "generated" : "ai",
          },
          { upsert: true, new: true },
        );
        logger.debug(`Saved answer to database for query: ${query.substring(0, 50)}`);
      } catch (error) {
        logger.warn("Failed to save answer to database:", error.message);
      }

      // Cache the answer (non-blocking)
      setCache(cacheKey, result, isFallback ? 3600 : 300).catch(err => {
        logger.warn("Failed to cache answer:", err.message);
      });

      logger.info(`Returning ${isFallback ? "fallback" : "AI"} answer for query: ${query.substring(0, 50)}`);
      return res.json(result);
    }

    // For other queries, build context
    const context = await buildFinancialContext(userId, dateRange);

    // Check cache again after context is built (in case it was populated by another request)
    const cachedAfterContext = await getCache(cacheKey);

    if (cachedAfterContext) {
      await ensureMinimumDelay();
      logger.info(`Returning cached answer (after context) for query: ${query.substring(0, 50)}`);
      return res.json(cachedAfterContext);
    }

    // Try Gemini API first if available
    let response;
    let isFallback = false;
    const geminiAvailable = !!process.env.GEMINI_API_KEY;

    if (geminiAvailable) {
      try {
        // Build prompt for Gemini
        const prompt = `You are a helpful financial assistant for a personal finance app. Answer the user's question about their finances using the provided data.

User's Question: "${query}"

Financial Data:
- Accounts: ${JSON.stringify(context.accounts)}
- Total Income: $${context.summary.totalIncome.toFixed(2)}
- Total Expenses: $${context.summary.totalExpense.toFixed(2)}
- Net Amount: $${context.summary.netAmount.toFixed(2)}
- Transaction Count: ${context.summary.transactionCount}
- Budgets: ${JSON.stringify(context.budgets)}
- Goals: ${JSON.stringify(context.goals)}

Recent Transactions (last 10):
${context.transactions.slice(0, 10).map((t) =>
  `- ${t.date.split("T")[0]}: ${t.description} - $${Math.abs(t.amount).toFixed(2)} (${t.category})`,
).join("\n")}

Instructions:
1. Answer the user's question directly and concisely
2. Use specific numbers from the data when relevant
3. Be friendly and helpful
4. If the question asks about spending, provide category breakdowns
5. If asking about budgets, compare actual spending vs budgeted amounts
6. If asking about goals, mention progress and time remaining
7. Format currency as $X.XX
8. Format dates as YYYY-MM-DD or relative dates (e.g., "last week")
9. If data is insufficient, say so politely

Answer:`;

        // Generate response using Gemini
        response = await generateTextWithRetry(prompt, {
          temperature: 0.7,
          maxTokens: 1024,
        });

        // Validate response
        if (!response || typeof response !== "string" || response.trim().length === 0) {
          logger.error("Invalid response from Gemini:", { response, type: typeof response });
          throw new Error("Invalid response from AI service");
        }

        logger.info(`Successfully got Gemini response for query: ${query.substring(0, 50)}`);
      } catch (error) {
        logger.warn("Gemini API error, using fallback answer:", error.message);
        logger.debug("Gemini API error details:", {
          message: error.message,
          name: error.name,
          apiKeySet: !!process.env.GEMINI_API_KEY,
        });

        // Generate fallback answer from current data
        response = generateFallbackAnswer(query, context, dateRange, category);
        isFallback = true;
        logger.info("Generated fallback answer from financial data");
      }
    } else {
      // No Gemini API key, use fallback
      response = generateFallbackAnswer(query, context, dateRange, category);
      isFallback = true;
      logger.info("GEMINI_API_KEY not set, using fallback answer");
    }

    // Calculate category breakdown if relevant
    let categoryBreakdown = null;
    if (query.toLowerCase().includes("spend") || query.toLowerCase().includes("category") || query.toLowerCase().includes("biggest")) {
      const categoryTotals = {};
      context.transactions
        .filter((t) => t.type === "expense")
        .forEach((t) => {
          categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
        });

      categoryBreakdown = Object.entries(categoryTotals)
        .map(([cat, amount]) => ({ category: cat, amount }))
        .sort((a, b) => b.amount - a.amount);
    }

    const result = {
      query,
      response,
      categoryBreakdown,
      dataUsed: {
        transactionCount: context.transactions.length,
        dateRange: dateRange.startDate
          ? {
              start: dateRange.startDate.toISOString(),
              end: dateRange.endDate.toISOString(),
            }
          : null,
        category: category || null,
      },
      timestamp: new Date().toISOString(),
    };

    // Ensure minimum delay has passed before returning
    await ensureMinimumDelay();

    // Save to database for future use
    try {
      await AIAnswer.findOneAndUpdate(
        { userId, normalizedQuery, isDefault: true },
        {
          userId,
          query,
          normalizedQuery,
          response,
          categoryBreakdown: categoryBreakdown || [],
          dataUsed: result.dataUsed,
          isDefault: true,
          source: isFallback ? "generated" : "ai",
        },
        { upsert: true, new: true },
      );
      logger.debug(`Saved answer to database for query: ${query.substring(0, 50)}`);
    } catch (error) {
      logger.warn("Failed to save answer to database:", error.message);
    }

    // Cache for longer duration (1 hour) to ensure fallback answers are available
    // This helps when AI service is down - cached answers will still work
    const cacheTTL = isFallback ? 3600 : 300; // 1 hour for fallback, 5 minutes for AI responses
    await setCache(cacheKey, result, cacheTTL);

    logger.info(`Returning ${isFallback ? "fallback" : "AI"} answer for query: ${query.substring(0, 50)}`);
    return res.json(result);

    // Also cache common queries proactively for better fallback coverage
    // This ensures common questions have cached answers even when AI is unavailable
    // Run this for both AI and fallback responses to maximize cache coverage
    {
      // Pre-cache common variations
      const commonQueries = [
        "how much did i spend",
        "what's my balance",
        "show me my budgets",
        "what are my goals",
        "how much did i spend this month",
        "what's my total income",
      ];

      for (const commonQuery of commonQueries) {
        if (normalizedQuery.includes(commonQuery.split(" ")[0])) {
          const commonCacheKey = `ai:chat:${userId}:${Buffer.from(commonQuery).toString("base64").substring(0, 50)}`;
          const commonDateRange = extractDateRange(commonQuery);
          const commonContext = await buildFinancialContext(userId, commonDateRange);
          const commonCategory = extractCategory(commonQuery);
          const commonFallback = generateFallbackAnswer(commonQuery, commonContext, commonDateRange, commonCategory);

          const commonCategoryBreakdown = commonQuery.includes("spend") || commonQuery.includes("category") ?
            (() => {
              const categoryTotals = {};
              commonContext.transactions
                .filter((t) => t.type === "expense")
                .forEach((t) => {
                  categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
                });
              return Object.entries(categoryTotals)
                .map(([cat, amount]) => ({ category: cat, amount }))
                .sort((a, b) => b.amount - a.amount);
            })() : null;

          const commonResult = {
            query: commonQuery,
            response: commonFallback,
            categoryBreakdown: commonCategoryBreakdown,
            dataUsed: {
              transactionCount: commonContext.transactions.length,
              dateRange: commonDateRange.startDate
                ? {
                    start: commonDateRange.startDate.toISOString(),
                    end: commonDateRange.endDate.toISOString(),
                  }
                : null,
              category: commonCategory || null,
            },
            timestamp: new Date().toISOString(),
          };

          await setCache(commonCacheKey, commonResult, 3600); // Cache for 1 hour
        }
      }
    }

    res.json(result);
  } catch (error) {
    logger.error("AI chat error:", error);
    logger.error("AI chat error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    // Provide more specific error message if possible
    let errorMessage = "Internal server error";
    if (error.message?.includes("MongoDB") || error.message?.includes("database")) {
      errorMessage = "Database error occurred. Please try again.";
    } else if (error.message?.includes("timeout")) {
      errorMessage = "Request timeout. Please try again.";
    }

    sendInternalError(res, errorMessage);
  }
});

export default router;

