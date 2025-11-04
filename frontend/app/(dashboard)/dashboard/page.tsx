"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, TrendingDown, Target, ArrowUp, ArrowDown, CreditCard, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import Link from "next/link";

interface Account {
  _id: string;
  name: string;
  type: string;
  calculatedBalance: number;
}

interface Budget {
  _id: string;
  category: string;
  amount: number;
  actualSpending: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

interface Goal {
  _id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  daysRemaining: number;
}

interface Transaction {
  _id: string;
  accountId: {
    _id: string;
    name: string;
    type: string;
  };
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense" | "transfer";
  date: string;
}

export default function DashboardPage() {
  const { data: accountsData, isLoading: accountsLoading } = useQuery<{ accounts: Account[] }>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts"),
  });

  const { data: budgetsData, isLoading: budgetsLoading } = useQuery<{ budgets: Budget[] }>({
    queryKey: ["budgets"],
    queryFn: () => api.get("/budgets?isActive=true"),
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery<{ goals: Goal[] }>({
    queryKey: ["goals"],
    queryFn: () => api.get("/goals?isCompleted=false"),
  });

  // Fetch recent transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{
    transactions: Transaction[];
  }>({
    queryKey: ["transactions", "recent"],
    queryFn: () => api.get("/transactions?limit=10&page=1"),
  });

  // Fetch current month stats
  const currentMonthStart = startOfMonth(new Date()).toISOString();
  const currentMonthEnd = endOfMonth(new Date()).toISOString();
  const lastMonthStart = startOfMonth(subMonths(new Date(), 1)).toISOString();
  const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)).toISOString();

  const { data: currentMonthStats } = useQuery({
    queryKey: ["transactions", "stats", "current-month"],
    queryFn: () => api.get(`/transactions/stats/summary?startDate=${currentMonthStart}&endDate=${currentMonthEnd}`),
  });

  const { data: lastMonthStats } = useQuery({
    queryKey: ["transactions", "stats", "last-month"],
    queryFn: () => api.get(`/transactions/stats/summary?startDate=${lastMonthStart}&endDate=${lastMonthEnd}`),
  });

  const accounts = accountsData?.accounts || [];
  const budgets = budgetsData?.budgets || [];
  const goals = goalsData?.goals || [];
  const recentTransactions = transactionsData?.transactions || [];

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.calculatedBalance || 0), 0);
  const activeBudgets = budgets.length;
  const activeGoals = goals.length;

  // Calculate spending comparison
  const currentMonthSpending = currentMonthStats?.summary?.totalExpense || 0;
  const lastMonthSpending = lastMonthStats?.summary?.totalExpense || 0;
  const spendingChange = lastMonthSpending > 0
    ? ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100
    : 0;

  // Get top spending categories
  const topCategories = currentMonthStats?.categoryStats?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Welcome back! Here's your financial overview.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">${totalBalance.toFixed(2)}</div>
            )}
            <p className="text-xs text-muted-foreground">Across {accounts.length} accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Budgets</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {budgetsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{activeBudgets}</div>
            )}
            <p className="text-xs text-muted-foreground">Tracking your spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {goalsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{activeGoals}</div>
            )}
            <p className="text-xs text-muted-foreground">Goals in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month Spending</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {accountsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">${currentMonthSpending.toFixed(2)}</div>
                <div className="flex items-center gap-1 text-xs mt-1">
                  {spendingChange !== 0 && (
                    <>
                      {spendingChange > 0 ? (
                        <ArrowUp className="h-3 w-3 text-red-600" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-green-600" />
                      )}
                      <span className={spendingChange > 0 ? "text-red-600" : "text-green-600"}>
                        {Math.abs(spendingChange).toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">vs last month</span>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/transactions">
          <Button variant="outline" className="w-full h-20 flex-col gap-2">
            <CreditCard className="h-5 w-5" />
            <span>Add Transaction</span>
          </Button>
        </Link>
        <Link href="/accounts">
          <Button variant="outline" className="w-full h-20 flex-col gap-2">
            <Wallet className="h-5 w-5" />
            <span>Manage Accounts</span>
          </Button>
        </Link>
        <Link href="/budgets">
          <Button variant="outline" className="w-full h-20 flex-col gap-2">
            <TrendingUp className="h-5 w-5" />
            <span>Set Budget</span>
          </Button>
        </Link>
        <Link href="/goals">
          <Button variant="outline" className="w-full h-20 flex-col gap-2">
            <Target className="h-5 w-5" />
            <span>Create Goal</span>
          </Button>
        </Link>
      </div>

      {/* Accounts Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Your Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No accounts yet. Create your first account to get started!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account._id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{account.type.replace("_", " ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      ${(account.calculatedBalance || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budgets Overview */}
      {budgets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Budget Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgets.slice(0, 5).map((budget) => (
                <div key={budget._id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{budget.category}</span>
                    <span className="text-sm">
                      ${budget.actualSpending.toFixed(2)} / ${budget.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        budget.isOverBudget
                          ? "bg-red-500"
                          : budget.percentage > 80
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Link href="/transactions">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No transactions yet</p>
                <Link href="/transactions">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTransactions.slice(0, 5).map((transaction) => (
                  <div
                    key={transaction._id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{transaction.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {transaction.category}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {format(new Date(transaction.date), "MMM dd")}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          transaction.type === "income"
                            ? "text-green-600"
                            : transaction.type === "expense"
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">{transaction.accountId?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Spending Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <p className="text-sm text-gray-500 mt-1">This month</p>
          </CardHeader>
          <CardContent>
            {topCategories.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No spending data for this month</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topCategories.map((category: any, index: number) => {
                  const total = topCategories.reduce((sum: number, c: any) => sum + Math.abs(c.total), 0);
                  const percentage = (Math.abs(category.total) / total) * 100;
                  return (
                    <div key={category._id || index}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{category._id || "Other"}</span>
                        <span className="text-sm font-bold">${Math.abs(category.total).toFixed(2)}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{category.count} transactions</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goals Overview */}
      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Goals</CardTitle>
              <Link href="/goals">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goals.slice(0, 3).map((goal) => (
                <div key={goal._id} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-sm">
                      ${goal.currentAmount.toFixed(2)} / ${goal.targetAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(goal.progress, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {goal.daysRemaining > 0
                      ? `${goal.daysRemaining} days remaining`
                      : "Goal deadline passed"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

