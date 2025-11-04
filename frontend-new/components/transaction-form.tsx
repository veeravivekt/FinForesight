"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

const transactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description is required"),
  category: z.enum([
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Healthcare",
    "Education",
    "Travel",
    "Other",
  ]),
  type: z.enum(["income", "expense", "transfer"]),
  date: z.string().min(1, "Date is required"),
  toAccountId: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  transaction?: Transaction | null;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Transaction {
  _id: string;
  accountId: string | { _id: string; name: string };
  toAccountId?: string | { _id: string; name: string };
  amount: number;
  description: string;
  category: string;
  type: "income" | "expense" | "transfer";
  date: string;
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

export default function TransactionForm({ transaction, onSuccess, onCancel }: TransactionFormProps) {
  const [error, setError] = useState("");

  // Fetch accounts for dropdown
  const { data: accountsData } = useQuery<{ accounts: Array<{ _id: string; name: string; type: string }> }>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts"),
  });

  const accounts = accountsData?.accounts || [];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction
      ? {
          accountId:
            typeof transaction.accountId === "string"
              ? transaction.accountId
              : transaction.accountId._id,
          toAccountId:
            transaction.toAccountId
              ? typeof transaction.toAccountId === "string"
                ? transaction.toAccountId
                : transaction.toAccountId._id
              : undefined,
          amount: transaction.amount,
          description: transaction.description,
          category: transaction.category as TransactionFormData["category"],
          type: transaction.type,
          date: transaction.date.split("T")[0], // Format date for input
        }
      : {
          accountId: "",
          amount: 0,
          description: "",
          category: "Other",
          type: "expense",
          date: new Date().toISOString().split("T")[0],
          toAccountId: undefined,
        },
  });

  const type = watch("type");
  const accountId = watch("accountId");

  const createMutation = useMutation({
    mutationFn: (data: TransactionFormData) => api.post("/transactions", data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create transaction");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TransactionFormData) => api.put(`/transactions/${transaction!._id}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update transaction");
    },
  });

  const onSubmit = async (data: TransactionFormData) => {
    setError("");
    
    // Format date properly
    const formattedData = {
      ...data,
      date: new Date(data.date).toISOString(),
    };

    // Remove toAccountId if not a transfer
    if (formattedData.type !== "transfer") {
      delete formattedData.toAccountId;
    }

    try {
      if (transaction) {
        await updateMutation.mutateAsync(formattedData);
      } else {
        await createMutation.mutateAsync(formattedData);
      }
    } catch (err) {
      // Error handled in mutation callbacks
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={type} onValueChange={(value) => setValue("type", value as TransactionFormData["type"])}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="accountId">
          {type === "transfer" ? "From Account" : "Account"} *
        </Label>
        <Select
          value={accountId}
          onValueChange={(value) => setValue("accountId", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc._id} value={acc._id}>
                {acc.name} ({acc.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.accountId && (
          <p className="text-sm text-red-600">{errors.accountId.message}</p>
        )}
      </div>

      {type === "transfer" && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">To Account *</Label>
          <Select
            value={watch("toAccountId") || ""}
            onValueChange={(value) => setValue("toAccountId", value)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((acc) => acc._id !== accountId)
                .map((acc) => (
                  <SelectItem key={acc._id} value={acc._id}>
                    {acc.name} ({acc.type})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {errors.toAccountId && (
            <p className="text-sm text-red-600">{errors.toAccountId.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="amount">Amount *</Label>
        <Input
          id="amount"
          type="number"
          step="0.01"
          {...register("amount")}
          placeholder="0.00"
          disabled={isSubmitting}
        />
        {errors.amount && (
          <p className="text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          {...register("description")}
          placeholder="e.g., Grocery shopping"
          disabled={isSubmitting}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {type !== "transfer" && (
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={watch("category")}
            onValueChange={(value) => setValue("category", value as TransactionFormData["category"])}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-red-600">{errors.category.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="date">Date *</Label>
        <Input
          id="date"
          type="date"
          {...register("date")}
          disabled={isSubmitting}
        />
        {errors.date && (
          <p className="text-sm text-red-600">{errors.date.message}</p>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : transaction ? "Update Transaction" : "Create Transaction"}
        </Button>
      </div>
    </form>
  );
}

