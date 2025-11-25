"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Wallet, AlertTriangle, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function CashFlowPage() {
  const [days, setDays] = useState(90);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");

  // Fetch accounts
  const { data: accountsData } = useQuery<{ accounts: any[] }>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/accounts"),
  });

  const accounts = accountsData?.accounts || [];

  // Fetch cash flow forecast
  const { data: cashflowData, isLoading: cashflowLoading, error: cashflowError } = useQuery({
    queryKey: ["cashflow", "forecast", days, selectedAccountId],
    queryFn: () => api.post("/ml/cashflow/forecast", { 
      days,
      accountId: selectedAccountId === "all" ? undefined : selectedAccountId 
    }),
    enabled: accounts.length > 0,
  });

  const forecasts = cashflowData?.forecast || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cash Flow Forecast</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Predict your future account balances and spending patterns
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={days.toString()} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="60">60 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
          {accounts.length > 1 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-48">
                <SelectValue />
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
          )}
        </div>
      </div>

      {cashflowError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {cashflowError instanceof Error
              ? cashflowError.message
              : "Failed to load cash flow forecast. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      {cashflowLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : cashflowError ? null : forecasts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>Unable to generate cash flow forecast. Please ensure you have transaction history.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {forecasts.map((forecast: any) => (
            <Card key={forecast.account.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    {forecast.account.name}
                  </CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {forecast.account.type.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Balance & Projections */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Current Balance</p>
                    <p className="text-2xl font-bold">
                      ${forecast.account.currentBalance.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">30-Day Projection</p>
                    <p className="text-xl font-semibold">
                      ${forecast.projections?.[29]?.balance?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">60-Day Projection</p>
                    <p className="text-xl font-semibold">
                      ${forecast.projections?.[59]?.balance?.toFixed(2) || "N/A"}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">{days}-Day Projection</p>
                    <p className="text-xl font-semibold">
                      ${forecast.summary.projectedEndBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Safe to Spend */}
                {forecast.safeToSpend !== undefined && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Safe to Spend Today
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      ${forecast.safeToSpend.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Based on minimum balance projection over the next 30 days
                    </p>
                  </div>
                )}

                {/* Low Balance Warnings */}
                {forecast.lowBalanceWarnings && forecast.lowBalanceWarnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-semibold mb-2">Low Balance Warnings:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {forecast.lowBalanceWarnings.slice(0, 5).map((warning: any, idx: number) => (
                          <li key={idx}>
                            {format(new Date(warning.date), "MMM dd, yyyy")}: {warning.message}
                          </li>
                        ))}
                        {forecast.lowBalanceWarnings.length > 5 && (
                          <li>... and {forecast.lowBalanceWarnings.length - 5} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* AI Insights */}
                {forecast.insights && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        AI Insights
                      </p>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-wrap">
                      {forecast.insights}
                    </p>
                  </div>
                )}

                {/* Upcoming Bills */}
                {forecast.upcomingBills && forecast.upcomingBills.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3">Upcoming Bills</p>
                    <div className="space-y-2">
                      {forecast.upcomingBills.slice(0, 10).map((bill: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{bill.description}</p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(bill.predictedDate), "MMM dd, yyyy")}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-base">
                            ${bill.amount.toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                      {forecast.upcomingBills.length > 10 && (
                        <p className="text-sm text-gray-500 text-center">
                          ... and {forecast.upcomingBills.length - 10} more bills
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


