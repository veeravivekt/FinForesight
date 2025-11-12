"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, ArrowUp, ArrowDown, ArrowLeftRight, Edit2, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import TransactionForm from "@/components/transaction-form";
import { format } from "date-fns";

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
  toAccountId?: {
    _id: string;
    name: string;
  };
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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

const transactionTypes = ["income", "expense", "transfer"];

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  // Fetch accounts for filter dropdown
  const { data: accountsData } = useQuery<{ accounts: Array<{ _id: string; name: string }> }>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts"),
  });

  const accounts = accountsData?.accounts || [];

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      limit: "20",
    };
    if (filterCategory !== "all") params.category = filterCategory;
    if (filterType !== "all") params.type = filterType;
    if (filterAccount !== "all") params.accountId = filterAccount;
    return params;
  }, [page, filterCategory, filterType, filterAccount]);

  const { data, isLoading, error } = useQuery<TransactionsResponse>({
    queryKey: ["transactions", queryParams],
    queryFn: () => api.get(`/transactions?${new URLSearchParams(queryParams).toString()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, pages: 1 };

  // Filter transactions by search query client-side
  const filteredTransactions = useMemo(() => {
    if (!searchQuery) return transactions;
    const query = searchQuery.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.accountId.name.toLowerCase().includes(query)
    );
  }, [transactions, searchQuery]);

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete transaction:", error);
      }
    }
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingTransaction(null);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "income":
        return <ArrowUp className="h-4 w-4 text-green-600" />;
      case "expense":
        return <ArrowDown className="h-4 w-4 text-red-600" />;
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "income":
        return "text-green-600";
      case "expense":
        return "text-red-600";
      case "transfer":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400">View and manage your transactions</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? "Edit Transaction" : "Add New Transaction"}
              </DialogTitle>
            </DialogHeader>
            <TransactionForm
              transaction={editingTransaction}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["transactions"] });
                queryClient.invalidateQueries({ queryKey: ["accounts"] });
                handleDialogClose();
              }}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc._id} value={acc._id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(filterCategory !== "all" || filterType !== "all" || filterAccount !== "all" || searchQuery) && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterCategory("all");
                  setFilterType("all");
                  setFilterAccount("all");
                  setSearchQuery("");
                  setPage(1); // Reset to first page when clearing filters
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load transactions. Please try again.
            {process.env.NODE_ENV === "development" && (
              <div className="mt-2 text-xs">
                Error: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Transactions ({pagination.total} total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {searchQuery || filterCategory !== "all" || filterType !== "all" || filterAccount !== "all"
                  ? "No transactions match your filters."
                  : "No transactions yet. Create your first transaction to get started!"}
              </p>
              {!searchQuery && filterCategory === "all" && filterType === "all" && filterAccount === "all" && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-shrink-0">{getTransactionIcon(transaction.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{transaction.description}</p>
                          <Badge variant="outline">{transaction.category}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{transaction.accountId.name}</span>
                          {transaction.toAccountId && (
                            <span className="flex items-center gap-1">
                              <ArrowLeftRight className="h-3 w-3" />
                              {transaction.toAccountId.name}
                            </span>
                          )}
                          <span>{format(new Date(transaction.date), "MMM dd, yyyy")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`font-bold text-lg ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(transaction)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(transaction._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Page {pagination.page} of {pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      disabled={pagination.page === pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
