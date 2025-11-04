"use client";

import { useState, useEffect } from "react";
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

const recurringTransactionSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
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
  type: z.enum(["income", "expense"]),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "yearly"]).default("monthly"),
  dayOfMonth: z.coerce.number().min(1).max(31).optional().nullable(),
  dayOfWeek: z.coerce.number().min(0).max(6).optional().nullable(),
  nextDueDate: z.string().min(1, "Next due date is required"),
  reminderDays: z.coerce.number().min(0).max(30).default(3),
  autoCreate: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.frequency === "monthly" && !data.dayOfMonth) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Day of month is required for monthly frequency",
      path: ["dayOfMonth"],
    });
  }
  if (data.frequency === "weekly" && data.dayOfWeek === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Day of week is required for weekly frequency",
      path: ["dayOfWeek"],
    });
  }
});

type RecurringTransactionFormData = z.infer<typeof recurringTransactionSchema>;

interface RecurringTransactionFormProps {
  recurringTransaction?: {
    _id: string;
    accountId: string | { _id: string; name: string };
    description: string;
    amount: number;
    category: string;
    type: "income" | "expense";
    frequency: string;
    dayOfMonth?: number;
    dayOfWeek?: number;
    nextDueDate: string;
    reminderDays: number;
    autoCreate: boolean;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
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

const dayOfWeekOptions = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function RecurringTransactionForm({
  recurringTransaction,
  onSuccess,
  onCancel,
}: RecurringTransactionFormProps) {
  const [error, setError] = useState("");
  const [currentTab, setCurrentTab] = useState<"expense" | "income">(
    recurringTransaction?.type || "expense"
  );

  // Fetch accounts for dropdown
  const { data: accountsData } = useQuery<{ accounts: Array<{ _id: string; name: string }> }>({
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
  } = useForm<RecurringTransactionFormData>({
    resolver: zodResolver(recurringTransactionSchema),
    defaultValues: recurringTransaction
      ? {
          accountId:
            typeof recurringTransaction.accountId === "string"
              ? recurringTransaction.accountId
              : recurringTransaction.accountId._id,
          description: recurringTransaction.description,
          amount: recurringTransaction.amount,
          category: recurringTransaction.category as RecurringTransactionFormData["category"],
          type: recurringTransaction.type,
          frequency: recurringTransaction.frequency as RecurringTransactionFormData["frequency"],
          dayOfMonth: recurringTransaction.dayOfMonth || null,
          dayOfWeek: recurringTransaction.dayOfWeek ?? null,
          nextDueDate: recurringTransaction.nextDueDate.split("T")[0],
          reminderDays: recurringTransaction.reminderDays || 3,
          autoCreate: recurringTransaction.autoCreate !== undefined ? recurringTransaction.autoCreate : true,
        }
      : {
          accountId: "",
          description: "",
          amount: 0,
          category: "Bills",
          type: "expense",
          frequency: "monthly",
          dayOfMonth: null,
          dayOfWeek: null,
          nextDueDate: "",
          reminderDays: 3,
          autoCreate: true,
        },
  });

  useEffect(() => {
    setValue("type", currentTab);
  }, [currentTab, setValue]);

  const frequency = watch("frequency");

  const createMutation = useMutation({
    mutationFn: (data: RecurringTransactionFormData) => api.post("/recurring", data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create recurring transaction");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: RecurringTransactionFormData) =>
      api.put(`/recurring/${recurringTransaction!._id}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update recurring transaction");
    },
  });

  const onSubmit = async (data: RecurringTransactionFormData) => {
    setError("");
    
    // Format date properly
    const formattedData = {
      ...data,
      nextDueDate: new Date(data.nextDueDate).toISOString(),
      dayOfMonth: data.dayOfMonth || undefined,
      dayOfWeek: data.dayOfWeek !== null ? data.dayOfWeek : undefined,
    };

    try {
      if (recurringTransaction) {
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

      <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as typeof currentTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense">Expense</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value="expense" className="mt-4 space-y-4">
          {/* Expense content */}
        </TabsContent>
        <TabsContent value="income" className="mt-4 space-y-4">
          {/* Income content */}
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label htmlFor="description">Description *</Label>
        <Input
          id="description"
          {...register("description")}
          placeholder="e.g., Netflix Subscription"
          disabled={isSubmitting}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountId">Account *</Label>
        <Select
          value={watch("accountId") || ""}
          onValueChange={(value) => setValue("accountId", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc._id} value={acc._id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.accountId && (
          <p className="text-sm text-red-600">{errors.accountId.message}</p>
        )}
      </div>

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
        <Label htmlFor="category">Category *</Label>
        <Select
          value={watch("category")}
          onValueChange={(value) => setValue("category", value as RecurringTransactionFormData["category"])}
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

      <div className="space-y-2">
        <Label htmlFor="frequency">Frequency *</Label>
        <Select
          value={watch("frequency")}
          onValueChange={(value) => {
            setValue("frequency", value as RecurringTransactionFormData["frequency"]);
            // Clear dayOfMonth/dayOfWeek when frequency changes
            if (value !== "monthly") setValue("dayOfMonth", null);
            if (value !== "weekly") setValue("dayOfWeek", null);
          }}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Bi-Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        {errors.frequency && (
          <p className="text-sm text-red-600">{errors.frequency.message}</p>
        )}
      </div>

      {frequency === "monthly" && (
        <div className="space-y-2">
          <Label htmlFor="dayOfMonth">Day of Month *</Label>
          <Input
            id="dayOfMonth"
            type="number"
            min="1"
            max="31"
            {...register("dayOfMonth")}
            placeholder="1-31"
            disabled={isSubmitting}
          />
          {errors.dayOfMonth && (
            <p className="text-sm text-red-600">{errors.dayOfMonth.message}</p>
          )}
        </div>
      )}

      {frequency === "weekly" && (
        <div className="space-y-2">
          <Label htmlFor="dayOfWeek">Day of Week *</Label>
          <Select
            value={watch("dayOfWeek")?.toString() || ""}
            onValueChange={(value) => setValue("dayOfWeek", parseInt(value))}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {dayOfWeekOptions.map((day) => (
                <SelectItem key={day.value} value={day.value.toString()}>
                  {day.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.dayOfWeek && (
            <p className="text-sm text-red-600">{errors.dayOfWeek.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nextDueDate">Next Due Date *</Label>
        <Input
          id="nextDueDate"
          type="date"
          {...register("nextDueDate")}
          disabled={isSubmitting}
        />
        {errors.nextDueDate && (
          <p className="text-sm text-red-600">{errors.nextDueDate.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reminderDays">Reminder Days Before Due</Label>
        <Input
          id="reminderDays"
          type="number"
          min="0"
          max="30"
          {...register("reminderDays")}
          placeholder="3"
          disabled={isSubmitting}
        />
        {errors.reminderDays && (
          <p className="text-sm text-red-600">{errors.reminderDays.message}</p>
        )}
        <p className="text-xs text-gray-500">
          Number of days before due date to receive a reminder
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="autoCreate"
          {...register("autoCreate")}
          disabled={isSubmitting}
          className="rounded border-gray-300"
        />
        <Label htmlFor="autoCreate" className="cursor-pointer">
          Automatically create transactions
        </Label>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : recurringTransaction ? "Update Bill" : "Create Bill"}
        </Button>
      </div>
    </form>
  );
}

