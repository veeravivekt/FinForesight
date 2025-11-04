"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Repeat, Calendar, AlertCircle, Edit2, Trash2, Bell, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import RecurringTransactionForm from "@/components/recurring-transaction-form";
import { format, differenceInDays, isBefore } from "date-fns";

interface RecurringTransaction {
  _id: string;
  accountId: {
    _id: string;
    name: string;
    type: string;
  };
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
  dayOfMonth?: number;
  dayOfWeek?: number;
  nextDueDate: string;
  reminderDays: number;
  isActive: boolean;
  autoCreate: boolean;
}

const frequencyLabels = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

const dayOfWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BillsPage() {
  const [filterActive, setFilterActive] = useState<string>("active");
  const [filterType, setFilterType] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<RecurringTransaction | null>(null);
  const queryClient = useQueryClient();

  // Build query params
  const queryParams = new URLSearchParams();
  if (filterActive !== "all") {
    queryParams.append("isActive", filterActive === "active" ? "true" : "false");
  }

  const { data, isLoading, error } = useQuery<{ recurringTransactions: RecurringTransaction[] }>({
    queryKey: ["recurring", filterActive],
    queryFn: () => api.get(`/recurring?${queryParams.toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/recurring/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
  });

  const recurringTransactions = data?.recurringTransactions || [];
  const filteredTransactions = filterType === "all" 
    ? recurringTransactions 
    : recurringTransactions.filter(t => t.type === filterType);

  const handleEdit = (bill: RecurringTransaction) => {
    setEditingBill(bill);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this recurring transaction?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete recurring transaction:", error);
      }
    }
  };

  const handleToggleActive = async (bill: RecurringTransaction) => {
    try {
      await toggleActiveMutation.mutateAsync({
        id: bill._id,
        isActive: !bill.isActive,
      });
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingBill(null);
  };

  const getDaysUntilDue = (nextDueDate: string) => {
    const due = new Date(nextDueDate);
    const now = new Date();
    return differenceInDays(due, now);
  };

  const getFrequencyLabel = (bill: RecurringTransaction) => {
    let label = frequencyLabels[bill.frequency];
    if (bill.frequency === "monthly" && bill.dayOfMonth) {
      label = `Monthly (Day ${bill.dayOfMonth})`;
    } else if (bill.frequency === "weekly" && bill.dayOfWeek !== undefined) {
      label = `Weekly (${dayOfWeekLabels[bill.dayOfWeek]})`;
    }
    return label;
  };

  const activeBills = recurringTransactions.filter((b) => b.isActive);
  const totalUpcoming = activeBills.reduce((sum, b) => {
    const daysUntil = getDaysUntilDue(b.nextDueDate);
    return daysUntil <= 30 ? sum + b.amount : sum;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bills & Recurring</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your recurring transactions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBill ? "Edit Bill" : "Add New Bill"}</DialogTitle>
            </DialogHeader>
            <RecurringTransactionForm
              recurringTransaction={editingBill}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["recurring"] });
                handleDialogClose();
              }}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card */}
      {activeBills.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="text-white">Upcoming Bills (Next 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">${totalUpcoming.toFixed(2)}</p>
            <p className="text-sm opacity-90 mt-1">
              {activeBills.filter((b) => getDaysUntilDue(b.nextDueDate) <= 30).length} bills due soon
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load bills. Please try again.</AlertDescription>
        </Alert>
      )}

      {/* Bills List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recurring transactions yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first bill or recurring transaction to get started.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((bill) => {
            const daysUntil = getDaysUntilDue(bill.nextDueDate);
            const isDueSoon = daysUntil <= bill.reminderDays && daysUntil >= 0;
            const isOverdue = daysUntil < 0;

            return (
              <Card key={bill._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{bill.description}</CardTitle>
                        <Badge variant={bill.type === "income" ? "default" : "secondary"}>
                          {bill.type === "income" ? "Income" : "Expense"}
                        </Badge>
                        {!bill.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {isOverdue && (
                          <Badge variant="destructive">Overdue</Badge>
                        )}
                        {isDueSoon && !isOverdue && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Bell className="h-3 w-3" />
                            Due Soon
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {getFrequencyLabel(bill)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(bill.nextDueDate), "MMM dd, yyyy")}
                        </span>
                        <span>{bill.category}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Account: {bill.accountId.name}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(bill)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(bill)}
                      >
                        {bill.isActive ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Repeat className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(bill._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Amount</p>
                      <p className={`text-2xl font-bold ${bill.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {bill.type === "income" ? "+" : "-"}${bill.amount.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Days Until Due</p>
                      <p className={`text-lg font-bold ${isOverdue ? "text-red-600" : isDueSoon ? "text-yellow-600" : "text-gray-900"}`}>
                        {isOverdue ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? "Due today" : `${daysUntil} days`}
                      </p>
                      {bill.autoCreate && (
                        <Badge variant="outline" className="mt-1">Auto-create</Badge>
                      )}
                    </div>
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

