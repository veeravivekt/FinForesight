"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, AlertCircle, CheckCircle2, Edit2, Trash2, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import BudgetForm from "@/components/budget-form";
import { format } from "date-fns";

interface Budget {
  _id: string;
  category: string;
  amount: number;
  period: "monthly" | "yearly";
  startDate: string;
  endDate?: string;
  isActive: boolean;
  alertThreshold: number;
  actualSpending?: number;
  remaining?: number;
  percentage?: number;
  isOverBudget?: boolean;
}

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Healthcare",
  "Education",
  "Travel",
  "Other",
];

export default function BudgetsPage() {
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterPeriod !== "all") queryParams.append("period", filterPeriod);
  if (filterActive !== "all") queryParams.append("isActive", filterActive === "active" ? "true" : "false");

  const { data, isLoading, error } = useQuery<{ budgets: Budget[] }>({
    queryKey: ["budgets", filterPeriod, filterActive],
    queryFn: () => api.get(`/budgets?${queryParams.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/budgets/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const budgets = data?.budgets || [];

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this budget?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete budget:", error);
      }
    }
  };

  const handleToggleActive = async (budget: Budget) => {
    try {
      await toggleActiveMutation.mutateAsync({
        id: budget._id,
        isActive: !budget.isActive,
      });
    } catch (error) {
      console.error("Failed to toggle budget status:", error);
    }
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingBudget(null);
  };

  const getBudgetStatus = (budget: Budget) => {
    if (!budget.actualSpending && budget.actualSpending !== 0) return null;
    
    const percentage = budget.percentage || 0;
    const alertThreshold = budget.alertThreshold || 0.8;
    
    if (budget.isOverBudget) {
      return { color: "text-red-600", bg: "bg-red-500", icon: AlertCircle, label: "Over Budget" };
    }
    if (percentage >= alertThreshold * 100) {
      return { color: "text-yellow-600", bg: "bg-yellow-500", icon: AlertCircle, label: "Warning" };
    }
    return { color: "text-green-600", bg: "bg-green-500", icon: CheckCircle2, label: "On Track" };
  };

  const getProgressBarColor = (budget: Budget) => {
    if (!budget.actualSpending && budget.actualSpending !== 0) return "bg-gray-500";
    
    const percentage = budget.percentage || 0;
    const alertThreshold = budget.alertThreshold || 0.8;
    
    if (budget.isOverBudget) return "bg-red-500";
    if (percentage >= alertThreshold * 100) return "bg-yellow-500";
    return "bg-green-500";
  };

  const activeBudgets = budgets.filter((b) => b.isActive);
  const totalBudgeted = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + (b.actualSpending || 0), 0);
  const totalRemaining = totalBudgeted - totalSpent;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budgets</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your spending against budgets</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Edit Budget" : "Add New Budget"}</DialogTitle>
            </DialogHeader>
            <BudgetForm
              budget={editingBudget}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["budgets"] });
                handleDialogClose();
              }}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {activeBudgets.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalBudgeted.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Across {activeBudgets.length} budgets</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {totalBudgeted > 0
                  ? `${((totalSpent / totalBudgeted) * 100).toFixed(1)}% of budget`
                  : "No budget set"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  totalRemaining >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${totalRemaining.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {totalRemaining >= 0 ? "Available" : "Over budget"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Period</label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="All periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load budgets. Please try again.</AlertDescription>
        </Alert>
      )}

      {/* Budgets List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No budgets yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first budget to start tracking your spending.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => {
            const status = getBudgetStatus(budget);
            const progressColor = getProgressBarColor(budget);
            const percentage = Math.min(budget.percentage || 0, 100);
            const actualSpending = budget.actualSpending || 0;
            const remaining = budget.remaining ?? budget.amount - actualSpending;

            return (
              <Card key={budget._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{budget.category}</CardTitle>
                        <Badge variant="outline" className="capitalize">
                          {budget.period}
                        </Badge>
                        {!budget.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {status && (
                          <div className={`flex items-center gap-1 ${status.color}`}>
                            <status.icon className="h-4 w-4" />
                            <span className="text-sm font-medium">{status.label}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Started: {format(new Date(budget.startDate), "MMM dd, yyyy")}
                        </span>
                        {budget.endDate && (
                          <span>
                            Ends: {format(new Date(budget.endDate), "MMM dd, yyyy")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(budget)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(budget)}
                      >
                        {budget.isActive ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Target className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(budget._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm font-bold">{percentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all ${progressColor}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Budget Details */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Budgeted</p>
                        <p className="text-lg font-bold">${budget.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Spent</p>
                        <p className="text-lg font-bold">${actualSpending.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Remaining</p>
                        <p
                          className={`text-lg font-bold ${
                            remaining >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          ${remaining.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Alert Threshold */}
                    {budget.alertThreshold && (
                      <div className="text-xs text-gray-500">
                        Alert threshold: {(budget.alertThreshold * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
