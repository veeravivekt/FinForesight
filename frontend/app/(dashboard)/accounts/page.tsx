"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Wallet, CreditCard, PiggyBank, Banknote, TrendingUp, Edit2, Archive, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AccountForm from "@/components/account-form";
import { Badge } from "@/components/ui/badge";

interface Account {
  _id: string;
  name: string;
  type: "checking" | "savings" | "credit_card" | "cash" | "investment";
  balance: number;
  calculatedBalance?: number;
  currency: string;
  institution?: string;
  accountNumber?: string;
  color?: string;
  isArchived: boolean;
}

const accountTypeIcons = {
  checking: Wallet,
  savings: PiggyBank,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
};

const accountTypeLabels = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  cash: "Cash",
  investment: "Investment",
};

export default function AccountsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{ accounts: Account[] }>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/accounts/${id}`, { isArchived: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const accounts = data?.accounts || [];

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this account? This action cannot be undone.")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete account:", error);
      }
    }
  };

  const handleArchive = async (id: string) => {
    if (confirm("Are you sure you want to archive this account?")) {
      try {
        await archiveMutation.mutateAsync(id);
      } catch (error) {
        console.error("Failed to archive account:", error);
      }
    }
  };

  const handleDialogClose = () => {
    setIsCreateDialogOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your financial accounts</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
            </DialogHeader>
            <AccountForm
              account={editingAccount}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["accounts"] });
                handleDialogClose();
              }}
              onCancel={handleDialogClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Failed to load accounts. Please try again.</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
            <p className="text-gray-500 mb-4">Create your first account to start tracking your finances.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const Icon = accountTypeIcons[account.type];
            const balance = account.calculatedBalance ?? account.balance ?? 0;
            const isCreditCard = account.type === "credit_card";

            return (
              <Card key={account._id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${account.color || "#3b82f6"}20` }}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={{ color: account.color || "#3b82f6" }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{account.name}</CardTitle>
                        <Badge variant="outline" className="mt-1">
                          {accountTypeLabels[account.type]}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(account)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleArchive(account._id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(account._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-500">Balance</p>
                      <p
                        className={`text-2xl font-bold ${
                          isCreditCard
                            ? balance >= 0
                              ? "text-red-600"
                              : "text-green-600"
                            : balance >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {isCreditCard
                          ? balance >= 0
                            ? `$${balance.toFixed(2)}`
                            : `$${Math.abs(balance).toFixed(2)}`
                          : `$${balance.toFixed(2)}`}
                      </p>
                      {isCreditCard && balance >= 0 && (
                        <p className="text-xs text-red-600">Credit Card Debt</p>
                      )}
                    </div>
                    {account.institution && (
                      <div>
                        <p className="text-sm text-gray-500">Institution</p>
                        <p className="text-sm font-medium">{account.institution}</p>
                      </div>
                    )}
                    {account.accountNumber && (
                      <div>
                        <p className="text-sm text-gray-500">Account Number</p>
                        <p className="text-sm font-mono">{account.accountNumber}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Total Balance Card */}
      {accounts.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="text-white">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              ${accounts.reduce((sum, acc) => sum + (acc.calculatedBalance ?? acc.balance ?? 0), 0).toFixed(2)}
            </p>
            <p className="text-sm opacity-90 mt-1">Across {accounts.length} accounts</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
