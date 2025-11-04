"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, TrendingUp, CheckCircle2, Edit2, Trash2, Calendar, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import GoalForm from "@/components/goal-form";
import { format, differenceInDays } from "date-fns";

interface Goal {
  _id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  accountId?: {
    _id: string;
    name: string;
  };
  isCompleted: boolean;
  completedAt?: string;
  color?: string;
  progress?: number;
  daysRemaining?: number;
}

export default function GoalsPage() {
  const [filterCompleted, setFilterCompleted] = useState<string>("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterCompleted !== "all") {
    queryParams.append("isCompleted", filterCompleted === "completed" ? "true" : "false");
  }

  const { data, isLoading, error } = useQuery<{ goals: Goal[] }>({
    queryKey: ["goals", filterCompleted],
    queryFn: () => api.get(`/goals?${queryParams.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const contributeMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/goals/${id}/contribute`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setContributionAmount({});
    },
  });

  const goals = data?.goals || [];

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this goal?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete goal:", error);
      }
    }
  };

  const handleContribute = async (goalId: string) => {
    const amount = parseFloat(contributionAmount[goalId] || "0");
    if (amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      await contributeMutation.mutateAsync({ id: goalId, amount });
    } catch (error) {
      console.error("Failed to contribute:", error);
    }
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingGoal(null);
  };

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const completedGoals = goals.filter((g) => g.isCompleted);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Goals</h1>
          <p className="text-gray-600 dark:text-gray-400">Set and track your financial goals</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Goal" : "Add New Goal"}</DialogTitle>
            </DialogHeader>
            <GoalForm
              goal={editingGoal}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["goals"] });
                handleDialogClose();
              }}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      {activeGoals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Target</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalTarget.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Across {activeGoals.length} active goals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Saved</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalSaved.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{totalProgress.toFixed(1)}% of target</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(totalTarget - totalSaved).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">To reach all goals</p>
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
          <div className="w-full max-w-xs">
            <Select value={filterCompleted} onValueChange={setFilterCompleted}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Goals</SelectItem>
                <SelectItem value="completed">Completed Goals</SelectItem>
                <SelectItem value="all">All Goals</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load goals. Please try again.</AlertDescription>
        </Alert>
      )}

      {/* Goals List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
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
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first financial goal to start saving!
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = goal.progress || 0;
            const daysRemaining = goal.daysRemaining || 0;
            const isOverdue = daysRemaining < 0 && !goal.isCompleted;
            const remaining = goal.targetAmount - goal.currentAmount;

            return (
              <Card key={goal._id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: goal.color || "#10b981" }}
                        />
                        <CardTitle className="text-xl">{goal.name}</CardTitle>
                        {goal.isCompleted && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Completed
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                      </div>
                      {goal.description && (
                        <p className="text-sm text-gray-500 mb-2">{goal.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {goal.accountId && (
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3" />
                            {goal.accountId.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(goal.targetDate), "MMM dd, yyyy")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(goal)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(goal._id)}
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
                        <span className="text-sm font-bold">{progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-3 rounded-full transition-all"
                          style={{
                            width: `${Math.min(progress, 100)}%`,
                            backgroundColor: goal.color || "#10b981",
                          }}
                        />
                      </div>
                    </div>

                    {/* Amount Details */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Target</p>
                        <p className="text-lg font-bold">${goal.targetAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Saved</p>
                        <p className="text-lg font-bold">${goal.currentAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Remaining</p>
                        <p className="text-lg font-bold">${remaining.toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Days Remaining */}
                    {!goal.isCompleted && (
                      <div className="text-sm">
                        <span className="text-gray-500">Days remaining: </span>
                        <span className={isOverdue ? "text-red-600 font-bold" : "font-medium"}>
                          {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days`}
                        </span>
                      </div>
                    )}

                    {/* Contribution Form */}
                    {!goal.isCompleted && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Amount"
                          value={contributionAmount[goal._id] || ""}
                          onChange={(e) =>
                            setContributionAmount({
                              ...contributionAmount,
                              [goal._id]: e.target.value,
                            })
                          }
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleContribute(goal._id)}
                          disabled={contributeMutation.isPending}
                          size="sm"
                        >
                          {contributeMutation.isPending ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    )}

                    {/* Completion Date */}
                    {goal.isCompleted && goal.completedAt && (
                      <div className="text-sm text-gray-500 pt-2 border-t">
                        Completed on {format(new Date(goal.completedAt), "MMM dd, yyyy")}
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
