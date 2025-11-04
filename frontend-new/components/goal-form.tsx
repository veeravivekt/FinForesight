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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

const goalSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  targetAmount: z.coerce.number().positive("Target amount must be positive"),
  targetDate: z.string().min(1, "Target date is required"),
  accountId: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").default("#10b981"),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface GoalFormProps {
  goal?: {
    _id: string;
    name: string;
    description?: string;
    targetAmount: number;
    targetDate: string;
    accountId?: string | { _id: string; name: string };
    color?: string;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const goalColors = [
  { label: "Green", value: "#10b981" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Orange", value: "#f59e0b" },
  { label: "Red", value: "#ef4444" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Teal", value: "#14b8a6" },
];

export default function GoalForm({ goal, onSuccess, onCancel }: GoalFormProps) {
  const [error, setError] = useState("");

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
  } = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: goal
      ? {
          name: goal.name,
          description: goal.description || "",
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate.split("T")[0],
          accountId:
            typeof goal.accountId === "string"
              ? goal.accountId
              : goal.accountId?._id || "",
          color: goal.color || "#10b981",
        }
      : {
          name: "",
          description: "",
          targetAmount: 0,
          targetDate: "",
          accountId: "",
          color: "#10b981",
        },
  });

  const createMutation = useMutation({
    mutationFn: (data: GoalFormData) => api.post("/goals", data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create goal");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: GoalFormData) => api.put(`/goals/${goal!._id}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update goal");
    },
  });

  const onSubmit = async (data: GoalFormData) => {
    setError("");
    
    // Format date properly
    const formattedData = {
      ...data,
      targetDate: new Date(data.targetDate).toISOString(),
      accountId: data.accountId || undefined,
      description: data.description || undefined,
    };

    try {
      if (goal) {
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

      <div className="space-y-2">
        <Label htmlFor="name">Goal Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g., Emergency Fund"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Add a description for your goal..."
          disabled={isSubmitting}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetAmount">Target Amount *</Label>
        <Input
          id="targetAmount"
          type="number"
          step="0.01"
          {...register("targetAmount")}
          placeholder="0.00"
          disabled={isSubmitting}
        />
        {errors.targetAmount && (
          <p className="text-sm text-red-600">{errors.targetAmount.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetDate">Target Date *</Label>
        <Input
          id="targetDate"
          type="date"
          {...register("targetDate")}
          disabled={isSubmitting}
        />
        {errors.targetDate && (
          <p className="text-sm text-red-600">{errors.targetDate.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountId">Account (Optional)</Label>
        <Select
          value={watch("accountId") || ""}
          onValueChange={(value) => setValue("accountId", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No specific account</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc._id} value={acc._id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex gap-2 flex-wrap">
          {goalColors.map((color) => {
            const isSelected = watch("color") === color.value;
            return (
              <button
                key={color.value}
                type="button"
                onClick={() => setValue("color", color.value)}
                disabled={isSubmitting}
                className={`w-10 h-10 rounded-md border-2 ${
                  isSelected ? "border-gray-900 dark:border-gray-100" : "border-gray-300"
                }`}
                style={{ backgroundColor: color.value }}
                aria-label={color.label}
              />
            );
          })}
        </div>
        {errors.color && (
          <p className="text-sm text-red-600">{errors.color.message}</p>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : goal ? "Update Goal" : "Create Goal"}
        </Button>
      </div>
    </form>
  );
}

