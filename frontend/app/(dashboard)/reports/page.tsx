"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, TrendingUp, TrendingDown, DollarSign, FileText, FileSpreadsheet, File } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316"];

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [reportType, setReportType] = useState<"monthly" | "yearly">("monthly");

  // Fetch monthly report
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["reports", "monthly", selectedYear, selectedMonth],
    queryFn: () => api.get(`/reports/monthly?year=${selectedYear}&month=${selectedMonth}`),
    enabled: reportType === "monthly",
  });

  // Fetch yearly report
  const { data: yearlyData, isLoading: yearlyLoading } = useQuery({
    queryKey: ["reports", "yearly", selectedYear],
    queryFn: () => api.get(`/reports/yearly?year=${selectedYear}`),
    enabled: reportType === "yearly",
  });

  const isLoading = reportType === "monthly" ? monthlyLoading : yearlyLoading;
  const reportData = reportType === "monthly" ? monthlyData : yearlyData;

  // Handle export function
  const handleExport = async (format: "csv" | "pdf" | "excel") => {
    try {
      const startDate = reportType === "monthly"
        ? startOfMonth(new Date(selectedYear, selectedMonth - 1))
        : new Date(selectedYear, 0, 1);
      const endDate = reportType === "monthly"
        ? endOfMonth(new Date(selectedYear, selectedMonth - 1))
        : new Date(selectedYear, 11, 31);

      const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"}/transactions/export/${format}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      const token = localStorage.getItem("accessToken");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      
      const extension = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
      link.download = `transactions-${reportType}-${selectedYear}${reportType === "monthly" ? `-${selectedMonth}` : ""}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export error:", error);
      alert(`Failed to export ${format.toUpperCase()}. Please try again.`);
    }
  };

  // Prepare chart data
  const categoryChartData = useMemo(() => {
    if (!reportData?.categoryBreakdown) return [];
    return reportData.categoryBreakdown.map((item: any) => ({
      name: item._id || "Other",
      value: Math.abs(item.total),
    }));
  }, [reportData]);

  const dailyTrendData = useMemo(() => {
    if (!reportData?.dailyTrend) return [];
    return reportData.dailyTrend.map((item: any) => ({
      date: format(new Date(item._id), "MMM dd"),
      amount: Math.abs(item.total),
    }));
  }, [reportData]);

  const incomeExpenseData = useMemo(() => {
    if (!reportData?.incomeExpenseTrend) return [];
    const grouped: Record<string, { date: string; income: number; expense: number }> = {};
    
    reportData.incomeExpenseTrend.forEach((item: any) => {
      const date = item._id.date;
      if (!grouped[date]) {
        grouped[date] = {
          date: format(new Date(date), "MMM dd"),
          income: 0,
          expense: 0,
        };
      }
      if (item._id.type === "income") {
        grouped[date].income = Math.abs(item.total);
      } else {
        grouped[date].expense = Math.abs(item.total);
      }
    });

    return Object.values(grouped);
  }, [reportData]);

  const monthlyBreakdownData = useMemo(() => {
    if (!yearlyData?.monthlyBreakdown) return [];
    const grouped: Record<number, { month: string; income: number; expense: number }> = {};
    
    yearlyData.monthlyBreakdown.forEach((item: any) => {
      const month = item._id.month;
      if (!grouped[month]) {
        grouped[month] = {
          month: format(new Date(selectedYear, month - 1, 1), "MMM"),
          income: 0,
          expense: 0,
        };
      }
      if (item._id.type === "income") {
        grouped[month].income = Math.abs(item.total);
      } else {
        grouped[month].expense = Math.abs(item.total);
      }
    });

    return Object.values(grouped).sort((a, b) => {
      const monthA = Object.keys(grouped).find(k => grouped[parseInt(k)].month === a.month);
      const monthB = Object.keys(grouped).find(k => grouped[parseInt(k)].month === b.month);
      return parseInt(monthA || "0") - parseInt(monthB || "0");
    });
  }, [yearlyData, selectedYear]);

  // Generate year options (current year and previous 2 years)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => currentYear - i);
  }, []);

  // Generate month options
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: format(new Date(selectedYear, i, 1), "MMMM"),
    }));
  }, [selectedYear]);

  const summary = reportData?.summary || {
    totalIncome: 0,
    totalExpense: 0,
    netAmount: 0,
    transactionCount: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Financial reports and analytics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleExport("csv")} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => handleExport("excel")} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button onClick={() => handleExport("pdf")} variant="outline">
            <File className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Report Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
          <CardDescription>Select the time period for your report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Tabs value={reportType} onValueChange={(v) => setReportType(v as "monthly" | "yearly")}>
                <TabsList>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly">Yearly</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="w-48">
              <Label>Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reportType === "monthly" && (
              <div className="w-48">
                <Label>Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${summary.totalIncome.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${summary.totalExpense.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    summary.netAmount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ${summary.netAmount.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.transactionCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          {reportType === "monthly" ? (
            <>
              {/* Daily Spending Trend */}
              {dailyTrendData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Spending Trend</CardTitle>
                    <CardDescription>Expenses throughout the month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={dailyTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#ef4444"
                          strokeWidth={2}
                          name="Expenses"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Income vs Expense */}
              {incomeExpenseData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Income vs Expenses</CardTitle>
                    <CardDescription>Daily comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={incomeExpenseData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="income" fill="#10b981" name="Income" />
                        <Bar dataKey="expense" fill="#ef4444" name="Expenses" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Category Breakdown */}
              {categoryChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Expense breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryChartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Monthly Breakdown */}
              {monthlyBreakdownData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Breakdown</CardTitle>
                    <CardDescription>Income and expenses by month</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyBreakdownData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="income" fill="#10b981" name="Income" />
                        <Bar dataKey="expense" fill="#ef4444" name="Expenses" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Yearly Category Breakdown */}
              {categoryChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Spending by Category</CardTitle>
                    <CardDescription>Annual expense breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryChartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
