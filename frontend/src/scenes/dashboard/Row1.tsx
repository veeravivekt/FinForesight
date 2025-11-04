import { useMemo } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import DashboardBox from "@/components/DashboardBox";
import { useGetTransactionStatsQuery } from "@/state/api";
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

const Row1 = () => {
  const theme = useTheme();
  
  // Memoize date parameters to ensure stable query cache keys
  const queryParams = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, []); // Empty deps - dates should be stable for the current month period

  const { data: stats } = useGetTransactionStatsQuery(queryParams);

  const totalIncome = stats?.summary?.totalIncome || 0;
  const totalExpense = stats?.summary?.totalExpense || 0;
  const netBalance = totalIncome - totalExpense;

  return (
    <>
      <DashboardBox gridArea="a">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Financial Overview
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Income
              </Typography>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                ${totalIncome.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Expenses
              </Typography>
              <Typography variant="h4" color="error.main" fontWeight="bold">
                ${totalExpense.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Net Balance
              </Typography>
              <Typography
                variant="h4"
                fontWeight="bold"
                color={netBalance >= 0 ? "success.main" : "error.main"}
              >
                ${netBalance.toFixed(2)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Transactions
              </Typography>
              <Typography variant="h6" fontWeight="bold">
                {stats?.summary?.transactionCount || 0}
              </Typography>
            </Box>
          </Box>
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="b">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Income vs Expenses
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { name: "Income", value: totalIncome },
              { name: "Expenses", value: totalExpense },
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill={theme.palette.primary.main} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="c">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Expense Categories
          </Typography>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats?.categoryStats || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="total"
              >
                {(stats?.categoryStats || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={theme.palette.primary.main} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </DashboardBox>
    </>
  );
};

export default Row1;
