"use client";

import { useState, useEffect } from "react";
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

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["checking", "savings", "credit_card", "cash", "investment"]),
  balance: z.coerce.number().default(0),
  currency: z.string().default("USD"),
  institution: z.string().optional(),
  accountNumber: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color format").default("#3b82f6"),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountFormProps {
  account?: {
    _id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
    institution?: string;
    accountNumber?: string;
    color?: string;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const accountColors = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Green", value: "#10b981" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Red", value: "#ef4444" },
  { label: "Orange", value: "#f59e0b" },
  { label: "Pink", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Teal", value: "#14b8a6" },
];

export default function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: account
      ? {
          name: account.name,
          type: account.type as AccountFormData["type"],
          balance: account.balance,
          currency: account.currency,
          institution: account.institution || "",
          accountNumber: account.accountNumber || "",
          color: account.color || "#3b82f6",
        }
      : {
          name: "",
          type: "checking",
          balance: 0,
          currency: "USD",
          institution: "",
          accountNumber: "",
          color: "#3b82f6",
        },
  });

  const type = watch("type");

  const createMutation = useMutation({
    mutationFn: (data: AccountFormData) => api.post("/accounts", data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to create account");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AccountFormData) => api.put(`/accounts/${account!._id}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.message || "Failed to update account");
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    setError("");
    try {
      if (account) {
        await updateMutation.mutateAsync(data);
      } else {
        await createMutation.mutateAsync(data);
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
        <Label htmlFor="name">Account Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g., Chase Checking"
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Account Type *</Label>
        <Select
          value={type}
          onValueChange={(value) => setValue("type", value as AccountFormData["type"])}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checking">Checking</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="credit_card">Credit Card</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="balance">Initial Balance</Label>
        <Input
          id="balance"
          type="number"
          step="0.01"
          {...register("balance")}
          placeholder="0.00"
          disabled={isSubmitting}
        />
        {errors.balance && (
          <p className="text-sm text-red-600">{errors.balance.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Select
          defaultValue={watch("currency")}
          onValueChange={(value) => setValue("currency", value)}
          disabled={isSubmitting}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD ($)</SelectItem>
            <SelectItem value="EUR">EUR (€)</SelectItem>
            <SelectItem value="GBP">GBP (£)</SelectItem>
            <SelectItem value="JPY">JPY (¥)</SelectItem>
            <SelectItem value="CAD">CAD (C$)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="institution">Institution (Optional)</Label>
        <Input
          id="institution"
          {...register("institution")}
          placeholder="e.g., Chase Bank"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountNumber">Account Number (Optional)</Label>
        <Input
          id="accountNumber"
          {...register("accountNumber")}
          placeholder="Last 4 digits"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex gap-2 flex-wrap">
          {accountColors.map((color) => {
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
          {isSubmitting ? "Saving..." : account ? "Update Account" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}

