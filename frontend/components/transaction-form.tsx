"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles } from "lucide-react";

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
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  
  // Track manual category changes and pending categorization requests
  const categoryManuallyChangedRef = useRef(false);
  const pendingCategorizationRef = useRef<{ description: string; categoryAtRequest: string } | null>(null);

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
  const description = watch("description");
  const amount = watch("amount");
  const currentCategory = watch("category");

  // Smart categorization when description changes
  useEffect(() => {
    if (!transaction && description && description.length > 3 && type === "expense") {
      // Reset manual change flag when description changes significantly
      categoryManuallyChangedRef.current = false;
      
      const timeoutId = setTimeout(() => {
        handleSmartCategorize();
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, amount, type]);

  const handleSmartCategorize = async () => {
    if (!description || type !== "expense") return;

    // Store the current state when request is initiated
    pendingCategorizationRef.current = {
      description,
      categoryAtRequest: currentCategory,
    };

    setCategorizing(true);
    try {
      const response = await api.post<{ category: string; confidence: number; method: string }>("/receipts/categorize", {
        description,
        amount,
      });

      // Only apply suggestion if:
      // 1. User hasn't manually changed category since request started
      // 2. Description hasn't changed (user hasn't typed more)
      // 3. Category hasn't been manually changed to something different
      const pending = pendingCategorizationRef.current;
      const descriptionUnchanged = pending && pending.description === description;
      const categoryUnchanged = pending && pending.categoryAtRequest === currentCategory;
      const shouldApply = !categoryManuallyChangedRef.current && descriptionUnchanged && categoryUnchanged;

      if (response.confidence > 0.5 && shouldApply) {
        setSuggestedCategory(response.category);
        setValue("category", response.category as TransactionFormData["category"]);
      }
    } catch (error) {
      // Silently fail - categorization is optional
    } finally {
      setCategorizing(false);
      pendingCategorizationRef.current = null;
    }
  };

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
          <div className="flex items-center justify-between">
            <Label htmlFor="category">Category *</Label>
            {suggestedCategory && !transaction && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <Sparkles className="h-3 w-3" />
                Auto-categorized
              </div>
            )}
            {categorizing && !transaction && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Analyzing...
              </div>
            )}
          </div>
          <Select
            value={watch("category")}
            onValueChange={(value) => {
              // Mark that user has manually changed category
              categoryManuallyChangedRef.current = true;
              setSuggestedCategory(null);
              setValue("category", value as TransactionFormData["category"]);
            }}
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

