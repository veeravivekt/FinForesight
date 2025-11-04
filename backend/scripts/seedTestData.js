import mongoose from "mongoose";
import User from "../shared/models/User.js";
import Account from "../shared/models/Account.js";
import Transaction from "../shared/models/Transaction.js";
import Budget from "../shared/models/Budget.js";
import Goal from "../shared/models/Goal.js";
import RecurringTransaction from "../shared/models/RecurringTransaction.js";
import dotenv from "dotenv";

dotenv.config();

const categories = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Healthcare", "Education", "Travel", "Other"];
const accountTypes = ["checking", "savings", "credit_card", "cash", "investment"];

// Helper function to get random element from array
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper function to get random number between min and max
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper function to get random float between min and max
const randomFloat = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;

// Helper function to add days to date
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Helper function to get start of month
const startOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

// Helper function to get end of month
const endOfMonth = (date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
};

const seedTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Find or create test user
    let testUser = await User.findOne({ email: "test@finforesight.com" });
    
    if (!testUser) {
      console.log("Test user not found. Creating test user...");
      testUser = new User({
        name: "Test User",
        email: "test@finforesight.com",
        password: "test123",
      });
      await testUser.save();
      console.log("Test user created!");
    } else {
      console.log("Using existing test user");
    }

    const userId = testUser._id;

    // Clear existing data for test user (optional - comment out if you want to keep existing data)
    console.log("Clearing existing test data...");
    await Transaction.deleteMany({ userId });
    await Budget.deleteMany({ userId });
    await Goal.deleteMany({ userId });
    await RecurringTransaction.deleteMany({ userId });
    await Account.deleteMany({ userId });
    console.log("Existing test data cleared");

    // Create accounts
    console.log("Creating accounts...");
    const accounts = [];
    
    const accountData = [
      { name: "Main Checking", type: "checking", balance: 5000, institution: "Chase Bank", color: "#3b82f6" },
      { name: "Savings Account", type: "savings", balance: 15000, institution: "Chase Bank", color: "#10b981" },
      { name: "Credit Card", type: "credit_card", balance: -1200, institution: "American Express", color: "#f59e0b" },
      { name: "Cash", type: "cash", balance: 250, institution: null, color: "#6b7280" },
    ];

    for (const accData of accountData) {
      const account = new Account({
        userId,
        ...accData,
      });
      await account.save();
      accounts.push(account);
      console.log(`Created account: ${account.name} (${account.type})`);
    }

    const checkingAccount = accounts[0];
    const savingsAccount = accounts[1];
    const creditCardAccount = accounts[2];
    const cashAccount = accounts[3];

    // Create transactions (last 3 months)
    console.log("Creating transactions...");
    const now = new Date();
    const threeMonthsAgo = addDays(now, -90);
    
    const transactionDescriptions = {
      Food: ["Grocery Store", "Restaurant", "Coffee Shop", "Fast Food", "Dining Out", "Grocery Shopping", "Lunch", "Dinner"],
      Transport: ["Uber Ride", "Gas Station", "Metro Card", "Parking", "Car Service", "Bus Ticket", "Train Ticket"],
      Shopping: ["Amazon Purchase", "Clothing Store", "Electronics", "Online Shopping", "Department Store", "Pharmacy"],
      Bills: ["Electric Bill", "Water Bill", "Internet Bill", "Phone Bill", "Rent", "Insurance", "Utility Bill"],
      Entertainment: ["Movie Tickets", "Concert", "Streaming Service", "Video Games", "Books", "Netflix", "Spotify"],
      Healthcare: ["Doctor Visit", "Pharmacy", "Dental", "Prescription", "Medical Supplies", "Health Insurance"],
      Education: ["Course Fee", "Books", "Tuition", "Online Course", "Workshop"],
      Travel: ["Hotel", "Flight", "Train Ticket", "Car Rental", "Vacation", "Travel Expenses"],
      Other: ["Miscellaneous", "Transfer", "ATM Withdrawal", "Deposit", "Other Expense"],
    };

    let transactionCount = 0;
    const transactions = [];

    // Generate transactions for each day in the last 3 months
    for (let i = 0; i < 90; i++) {
      const date = addDays(threeMonthsAgo, i);
      
      // Skip some days (not every day has transactions)
      if (Math.random() > 0.6) continue;

      // Determine number of transactions per day (0-3)
      const transactionsPerDay = randomBetween(0, 3);

      for (let j = 0; j < transactionsPerDay; j++) {
        const category = randomElement(categories);
        const type = Math.random() > 0.85 ? "income" : "expense"; // 15% income, 85% expense
        const account = randomElement(accounts);
        
        let amount;
        if (type === "income") {
          amount = randomFloat(500, 5000); // Income: $500-$5000
        } else {
          // Expense amounts vary by category
          const categoryRanges = {
            Food: [10, 150],
            Transport: [5, 80],
            Shopping: [20, 500],
            Bills: [50, 500],
            Entertainment: [15, 200],
            Healthcare: [30, 400],
            Education: [50, 1000],
            Travel: [100, 2000],
            Other: [5, 200],
          };
          const [min, max] = categoryRanges[category] || [10, 200];
          amount = randomFloat(min, max);
        }

        const descriptions = transactionDescriptions[category] || ["Transaction"];
        const description = randomElement(descriptions);

        const transaction = new Transaction({
          userId,
          accountId: account._id,
          amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
          description,
          category,
          type,
          date: new Date(date.getTime() + j * 3600000), // Spread transactions throughout the day
        });

        await transaction.save();
        transactions.push(transaction);
        transactionCount++;
      }
    }

    console.log(`Created ${transactionCount} transactions`);

    // Create budgets for current month
    console.log("Creating budgets...");
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const budgetData = [
      { category: "Food", amount: 800, period: "monthly" },
      { category: "Transport", amount: 300, period: "monthly" },
      { category: "Shopping", amount: 500, period: "monthly" },
      { category: "Bills", amount: 1200, period: "monthly" },
      { category: "Entertainment", amount: 200, period: "monthly" },
      { category: "Healthcare", amount: 400, period: "monthly" },
      { category: "Travel", amount: 1000, period: "monthly" },
    ];

    for (const budgetInfo of budgetData) {
      const budget = new Budget({
        userId,
        ...budgetInfo,
        startDate: currentMonthStart,
        endDate: currentMonthEnd,
        isActive: true,
        alertThreshold: 0.8,
      });
      await budget.save();
      console.log(`Created budget: ${budgetInfo.category} - $${budgetInfo.amount}`);
    }

    // Create goals
    console.log("Creating goals...");
    const goalData = [
      {
        name: "Emergency Fund",
        description: "Build emergency fund for 6 months expenses",
        targetAmount: 10000,
        currentAmount: 3500,
        targetDate: addDays(now, 180),
        accountId: savingsAccount._id,
        color: "#10b981",
      },
      {
        name: "Vacation to Europe",
        description: "Save for dream vacation",
        targetAmount: 5000,
        currentAmount: 2100,
        targetDate: addDays(now, 240),
        accountId: savingsAccount._id,
        color: "#3b82f6",
      },
      {
        name: "New Laptop",
        description: "Save for new MacBook Pro",
        targetAmount: 2500,
        currentAmount: 800,
        targetDate: addDays(now, 120),
        accountId: savingsAccount._id,
        color: "#8b5cf6",
      },
      {
        name: "Car Down Payment",
        description: "Save for car down payment",
        targetAmount: 8000,
        currentAmount: 4500,
        targetDate: addDays(now, 365),
        accountId: savingsAccount._id,
        color: "#f59e0b",
      },
    ];

    for (const goalInfo of goalData) {
      const goal = new Goal({
        userId,
        ...goalInfo,
        isCompleted: false,
      });
      await goal.save();
      console.log(`Created goal: ${goalInfo.name} - $${goalInfo.currentAmount}/${goalInfo.targetAmount}`);
    }

    // Create recurring transactions
    console.log("Creating recurring transactions...");
    const recurringData = [
      {
        description: "Netflix Subscription",
        amount: -15.99,
        category: "Entertainment",
        type: "expense",
        frequency: "monthly",
        dayOfMonth: 15,
        accountId: creditCardAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth(), 15),
        autoCreate: true,
      },
      {
        description: "Gym Membership",
        amount: -49.99,
        category: "Other",
        type: "expense",
        frequency: "monthly",
        dayOfMonth: 1,
        accountId: checkingAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        autoCreate: true,
      },
      {
        description: "Electric Bill",
        amount: -120,
        category: "Bills",
        type: "expense",
        frequency: "monthly",
        dayOfMonth: 5,
        accountId: checkingAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 5),
        autoCreate: true,
      },
      {
        description: "Internet Bill",
        amount: -79.99,
        category: "Bills",
        type: "expense",
        frequency: "monthly",
        dayOfMonth: 10,
        accountId: checkingAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 10),
        autoCreate: true,
      },
      {
        description: "Salary",
        amount: 5000,
        category: "Other",
        type: "income",
        frequency: "monthly",
        dayOfMonth: 1,
        accountId: checkingAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        autoCreate: true,
      },
      {
        description: "Phone Bill",
        amount: -89.99,
        category: "Bills",
        type: "expense",
        frequency: "monthly",
        dayOfMonth: 20,
        accountId: creditCardAccount._id,
        nextDueDate: new Date(now.getFullYear(), now.getMonth() + 1, 20),
        autoCreate: true,
      },
    ];

    for (const recurringInfo of recurringData) {
      const recurring = new RecurringTransaction({
        userId,
        ...recurringInfo,
        isActive: true,
        reminderDays: 3,
      });
      await recurring.save();
      console.log(`Created recurring transaction: ${recurringInfo.description}`);
    }

    console.log("\n✅ Test data seeding completed successfully!");
    console.log(`\nSummary:`);
    console.log(`- Accounts: ${accounts.length}`);
    console.log(`- Transactions: ${transactionCount}`);
    console.log(`- Budgets: ${budgetData.length}`);
    console.log(`- Goals: ${goalData.length}`);
    console.log(`- Recurring Transactions: ${recurringData.length}`);
    console.log(`\nTest User Credentials:`);
    console.log(`Email: test@finforesight.com`);
    console.log(`Password: test123`);

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error seeding test data:", error);
    process.exit(1);
  }
};

seedTestData();

