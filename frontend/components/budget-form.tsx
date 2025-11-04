"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

const budgetSchema = z.object({
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
  amount: z.coerce.number().positive("Amount must be positive"),
  period: z.enum(["monthly", "yearly"]).default("monthly"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  alertThreshold: z.coerce.number().min(0).max(1).default(0.8),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetFormProps {
  budget?: {
    _id: string;
    category: string;
    amount: number;
    period: string;
    startDate: string;
    endDate?: string;
    alertThreshold: number;
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

export default function BudgetForm({ budget, onSuccess, onCancel }: BudgetFormProps) {
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: budget
      ? {
          category: budget.category as BudgetFormData["category"],
          amount: budget.amount,
          period: budget.period as BudgetFormData["period"],
          startDate: budget.startDate.split("T")[0],
          endDate: budget.endDate ? budget.endDate.split("T")[0] : undefined,
          alertThreshold: budget.alertThreshold || 0.8,
        }
      : {
          category: "Food",
          amount: 0,
          period: "monthly",
          startDate: new Date().toISOString().split("T")[0],
          endDate: undefined,
          alertThreshold: 0.8,
        },
  });

  const createMutation = useMutation({
    mutationFn: (data: BudgetFormData) => api.post("/budgets", data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create budget");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: BudgetFormData) => api.put(`/budgets/${budget!._id}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update budget");
    },
  });

  const onSubmit = async (data: BudgetFormData) => {
    setError("");
    
    // Format dates properly
    const formattedData = {
      ...data,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
    };

    try {
      if (budget) {
        await updateMutation.mutateAsync(formattedData);
      } else {
        await createMutation.mutateAsync(formattedData);
      }
    } catch (err) {
      // Error handled in mutation callbacks
    }
  };

  const period = watch("period");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        <Select
          value={watch("category")}
          onValueChange={(value) => setValue("category", value as BudgetFormData["category"])}
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
        <Label htmlFor="amount">Budget Amount *</Label>
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
        <Label htmlFor="period">Period *</Label>
        <Select
          value={period}
          onValueChange={(value) => setValue("period", value as BudgetFormData["period"])}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        {errors.period && (
          <p className="text-sm text-red-600">{errors.period.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">Start Date *</Label>
        <Input
          id="startDate"
          type="date"
          {...register("startDate")}
          disabled={isSubmitting}
        />
        {errors.startDate && (
          <p className="text-sm text-red-600">{errors.startDate.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">End Date (Optional)</Label>
        <Input
          id="endDate"
          type="date"
          {...register("endDate")}
          disabled={isSubmitting}
        />
        {errors.endDate && (
          <p className="text-sm text-red-600">{errors.endDate.message}</p>
        )}
        <p className="text-xs text-gray-500">
          Leave empty for ongoing budgets
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alertThreshold">
          Alert Threshold ({(watch("alertThreshold") * 100).toFixed(0)}%)
        </Label>
        <Input
          id="alertThreshold"
          type="number"
          step="0.01"
          min="0"
          max="1"
          {...register("alertThreshold")}
          placeholder="0.8"
          disabled={isSubmitting}
        />
        {errors.alertThreshold && (
          <p className="text-sm text-red-600">{errors.alertThreshold.message}</p>
        )}
        <p className="text-xs text-gray-500">
          Get alerted when spending reaches this percentage of budget (0.0 - 1.0)
        </p>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : budget ? "Update Budget" : "Create Budget"}
        </Button>
      </div>
    </form>
  );
}

