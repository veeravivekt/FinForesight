import mongoose from "mongoose";
import User from "../shared/models/User.js";
import Account from "../shared/models/Account.js";
import Transaction from "../shared/models/Transaction.js";
import Budget from "../shared/models/Budget.js";
import Goal from "../shared/models/Goal.js";
import RecurringTransaction from "../shared/models/RecurringTransaction.js";
import Receipt from "../shared/models/Receipt.js";
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
    await Receipt.deleteMany({ userId });
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
      { name: "Main Checking", type: "checking", balance: 0, institution: "Chase Bank", color: "#3b82f6", accountNumber: "****1234" },
      { name: "Savings Account", type: "savings", balance: 0, institution: "Chase Bank", color: "#10b981", accountNumber: "****5678" },
      { name: "Credit Card", type: "credit_card", balance: 0, institution: "American Express", color: "#f59e0b", accountNumber: "****9012" },
      { name: "Cash", type: "cash", balance: 0, institution: null, color: "#6b7280" },
      { name: "Investment Account", type: "investment", balance: 0, institution: "Fidelity", color: "#8b5cf6", accountNumber: "****3456" },
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
    const investmentAccount = accounts[4];

    // Track account balances
    const accountBalances = {};
    accounts.forEach(acc => {
      accountBalances[acc._id.toString()] = 0;
    });

    // Create transactions (last 3 months)
    console.log("Creating transactions...");
    const now = new Date();
    const threeMonthsAgo = addDays(now, -90);
    
    const transactionDescriptions = {
      Food: [
        { desc: "Whole Foods Market", merchant: "Whole Foods" },
        { desc: "Starbucks Coffee", merchant: "Starbucks" },
        { desc: "McDonald's", merchant: "McDonald's" },
        { desc: "Chipotle Mexican Grill", merchant: "Chipotle" },
        { desc: "Trader Joe's", merchant: "Trader Joe's" },
        { desc: "Local Restaurant", merchant: "Local Bistro" },
        { desc: "Pizza Delivery", merchant: "Domino's Pizza" },
        { desc: "Grocery Shopping", merchant: "Safeway" },
      ],
      Transport: [
        { desc: "Uber Ride", merchant: "Uber" },
        { desc: "Gas Station", merchant: "Shell" },
        { desc: "Metro Card Refill", merchant: "Metro Transit" },
        { desc: "Parking Fee", merchant: "Parking Co" },
        { desc: "Lyft Ride", merchant: "Lyft" },
        { desc: "Car Wash", merchant: "Car Wash Plus" },
      ],
      Shopping: [
        { desc: "Amazon Purchase", merchant: "Amazon" },
        { desc: "Target Shopping", merchant: "Target" },
        { desc: "Best Buy Electronics", merchant: "Best Buy" },
        { desc: "Clothing Store", merchant: "Nike" },
        { desc: "Online Shopping", merchant: "eBay" },
        { desc: "CVS Pharmacy", merchant: "CVS" },
      ],
      Bills: [
        { desc: "Electric Bill", merchant: "Power Company" },
        { desc: "Water Bill", merchant: "Water Utility" },
        { desc: "Internet Bill", merchant: "Comcast" },
        { desc: "Phone Bill", merchant: "Verizon" },
        { desc: "Rent Payment", merchant: "Property Management" },
        { desc: "Insurance Premium", merchant: "State Farm" },
      ],
      Entertainment: [
        { desc: "Movie Tickets", merchant: "AMC Theaters" },
        { desc: "Concert Tickets", merchant: "Ticketmaster" },
        { desc: "Netflix Subscription", merchant: "Netflix" },
        { desc: "Spotify Premium", merchant: "Spotify" },
        { desc: "Video Game Purchase", merchant: "Steam" },
        { desc: "Book Store", merchant: "Barnes & Noble" },
      ],
      Healthcare: [
        { desc: "Doctor Visit", merchant: "Medical Center" },
        { desc: "Pharmacy Prescription", merchant: "Walgreens" },
        { desc: "Dental Checkup", merchant: "Dental Office" },
        { desc: "Gym Membership", merchant: "24 Hour Fitness" },
        { desc: "Health Insurance", merchant: "Blue Cross" },
      ],
      Education: [
        { desc: "Online Course", merchant: "Coursera" },
        { desc: "Textbooks", merchant: "Amazon" },
        { desc: "Workshop Fee", merchant: "Learning Center" },
      ],
      Travel: [
        { desc: "Hotel Booking", merchant: "Marriott" },
        { desc: "Flight Ticket", merchant: "United Airlines" },
        { desc: "Car Rental", merchant: "Hertz" },
        { desc: "Airbnb Stay", merchant: "Airbnb" },
      ],
      Other: [
        { desc: "Salary Deposit", merchant: "Employer" },
        { desc: "Transfer to Savings", merchant: null },
        { desc: "ATM Withdrawal", merchant: "ATM" },
        { desc: "Bank Fee", merchant: "Bank" },
      ],
    };

    let transactionCount = 0;
    const transactions = [];
    const receiptsToCreate = [];

    // Generate transactions for each day in the last 3 months
    for (let i = 0; i < 90; i++) {
      const date = addDays(threeMonthsAgo, i);
      const dayOfMonth = date.getDate();
      const dayOfWeek = date.getDay();
      
      // Add salary on 1st of each month to checking account
      if (dayOfMonth === 1) {
        const salaryTransaction = new Transaction({
          userId,
          accountId: checkingAccount._id,
          amount: 5000,
          description: "Salary Deposit",
          category: "Other",
          type: "income",
          date: new Date(date.getTime() + 9 * 3600000), // 9 AM
          merchant: { name: "Employer", category: "Salary" },
        });
        await salaryTransaction.save();
        transactions.push(salaryTransaction);
        accountBalances[checkingAccount._id.toString()] += 5000;
        transactionCount++;
      }

      // Add monthly bills on specific days
      if (dayOfMonth === 5) {
        const electricBill = new Transaction({
          userId,
          accountId: checkingAccount._id,
          amount: -120,
          description: "Electric Bill",
          category: "Bills",
          type: "expense",
          date: new Date(date.getTime() + 10 * 3600000),
          merchant: { name: "Power Company", category: "Utilities" },
        });
        await electricBill.save();
        transactions.push(electricBill);
        accountBalances[checkingAccount._id.toString()] -= 120;
        transactionCount++;
      }

      if (dayOfMonth === 10) {
        const internetBill = new Transaction({
          userId,
          accountId: checkingAccount._id,
          amount: -79.99,
          description: "Internet Bill",
          category: "Bills",
          type: "expense",
          date: new Date(date.getTime() + 10 * 3600000),
          merchant: { name: "Comcast", category: "Utilities" },
        });
        await internetBill.save();
        transactions.push(internetBill);
        accountBalances[checkingAccount._id.toString()] -= 79.99;
        transactionCount++;
      }

      if (dayOfMonth === 15) {
        const netflixBill = new Transaction({
          userId,
          accountId: creditCardAccount._id,
          amount: -15.99,
          description: "Netflix Subscription",
          category: "Entertainment",
          type: "expense",
          date: new Date(date.getTime() + 11 * 3600000),
          merchant: { name: "Netflix", category: "Streaming" },
          isRecurring: true,
        });
        await netflixBill.save();
        transactions.push(netflixBill);
        accountBalances[creditCardAccount._id.toString()] -= 15.99;
        transactionCount++;
      }

      if (dayOfMonth === 20) {
        const phoneBill = new Transaction({
          userId,
          accountId: creditCardAccount._id,
          amount: -89.99,
          description: "Phone Bill",
          category: "Bills",
          type: "expense",
          date: new Date(date.getTime() + 10 * 3600000),
          merchant: { name: "Verizon", category: "Telecommunications" },
        });
        await phoneBill.save();
        transactions.push(phoneBill);
        accountBalances[creditCardAccount._id.toString()] -= 89.99;
        transactionCount++;
      }

      // Add transfer to savings on 2nd of each month
      if (dayOfMonth === 2) {
        const transferAmount = 1000;
        const transferToSavings = new Transaction({
          userId,
          accountId: checkingAccount._id,
          amount: -transferAmount,
          description: "Transfer to Savings",
          category: "Other",
          type: "transfer",
          date: new Date(date.getTime() + 12 * 3600000),
          toAccountId: savingsAccount._id,
        });
        await transferToSavings.save();
        transactions.push(transferToSavings);
        accountBalances[checkingAccount._id.toString()] -= transferAmount;
        
        const transferToSavingsIncome = new Transaction({
          userId,
          accountId: savingsAccount._id,
          amount: transferAmount,
          description: "Transfer from Checking",
          category: "Other",
          type: "transfer",
          date: new Date(date.getTime() + 12 * 3600000),
          toAccountId: checkingAccount._id,
        });
        await transferToSavingsIncome.save();
        transactions.push(transferToSavingsIncome);
        accountBalances[savingsAccount._id.toString()] += transferAmount;
        transactionCount += 2;
      }

      // Skip some days (not every day has transactions)
      if (Math.random() > 0.5) continue;

      // Determine number of transactions per day (0-4)
      const transactionsPerDay = randomBetween(0, 4);

      for (let j = 0; j < transactionsPerDay; j++) {
        const category = randomElement(categories);
        const type = Math.random() > 0.9 ? "income" : "expense"; // 10% income, 90% expense
        
        // Choose account based on transaction type
        let account;
        if (type === "income") {
          account = Math.random() > 0.5 ? checkingAccount : savingsAccount;
        } else {
          // Credit card for online purchases, checking for others
          if (category === "Shopping" || category === "Entertainment") {
            account = Math.random() > 0.6 ? creditCardAccount : checkingAccount;
          } else {
            account = randomElement([checkingAccount, creditCardAccount, cashAccount]);
          }
        }
        
        let amount;
        if (type === "income") {
          amount = randomFloat(100, 1000); // Small income transactions
        } else {
          // Expense amounts vary by category
          const categoryRanges = {
            Food: [8, 120],
            Transport: [5, 75],
            Shopping: [15, 400],
            Bills: [40, 300],
            Entertainment: [12, 150],
            Healthcare: [25, 350],
            Education: [40, 800],
            Travel: [80, 1500],
            Other: [5, 150],
          };
          const [min, max] = categoryRanges[category] || [10, 200];
          amount = randomFloat(min, max);
        }

        const descriptions = transactionDescriptions[category] || [{ desc: "Transaction", merchant: null }];
        const descObj = randomElement(descriptions);
        const description = descObj.desc;
        const merchant = descObj.merchant ? { name: descObj.merchant, category } : undefined;

        const transaction = new Transaction({
          userId,
          accountId: account._id,
          amount: type === "expense" ? -Math.abs(amount) : Math.abs(amount),
          description,
          category,
          type,
          date: new Date(date.getTime() + (9 + j * 3) * 3600000), // Spread transactions throughout the day
          merchant,
        });

        await transaction.save();
        transactions.push(transaction);
        accountBalances[account._id.toString()] += transaction.amount;
        transactionCount++;

        // Add receipts for some transactions (30% chance, only for expenses)
        if (type === "expense" && Math.random() < 0.3 && merchant) {
          receiptsToCreate.push({
            transactionId: transaction._id,
            merchant: merchant.name,
            amount: Math.abs(amount),
            date: transaction.date,
            category,
          });
        }
      }
    }

    // Update account balances
    console.log("Updating account balances...");
    for (const account of accounts) {
      const currentBalance = accountBalances[account._id.toString()];
      // Set initial balances
      if (account.type === "checking") {
        account.balance = currentBalance + 5000; // Start with some base
      } else if (account.type === "savings") {
        account.balance = currentBalance + 15000; // Start with some base
      } else if (account.type === "credit_card") {
        account.balance = currentBalance - 1200; // Start with some debt
      } else if (account.type === "cash") {
        account.balance = currentBalance + 250; // Start with some cash
      } else if (account.type === "investment") {
        account.balance = currentBalance + 5000; // Start with some investments
      }
      await account.save();
    }

    // Create receipts
    console.log("Creating receipts...");
    let receiptCount = 0;
    for (const receiptData of receiptsToCreate) {
      const receipt = new Receipt({
        userId,
        transactionId: receiptData.transactionId,
        imageUrl: `/uploads/receipts/sample-receipt-${receiptCount + 1}.jpg`,
        merchant: receiptData.merchant,
        amount: receiptData.amount,
        date: receiptData.date,
        category: receiptData.category,
        isProcessed: true,
        ocrData: {
          merchant: receiptData.merchant,
          total: receiptData.amount,
          date: receiptData.date.toISOString(),
        },
      });
      await receipt.save();
      receiptCount++;
    }

    console.log(`Created ${transactionCount} transactions`);
    console.log(`Created ${receiptCount} receipts`);

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
    console.log(`- Receipts: ${receiptCount}`);
    console.log(`- Budgets: ${budgetData.length}`);
    console.log(`- Goals: ${goalData.length}`);
    console.log(`- Recurring Transactions: ${recurringData.length}`);
    console.log(`\nAccount Balances:`);
    for (const account of accounts) {
      const balance = account.balance.toFixed(2);
      const sign = account.type === "credit_card" && account.balance < 0 ? "" : "$";
      console.log(`  - ${account.name}: ${sign}${balance}`);
    }
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

