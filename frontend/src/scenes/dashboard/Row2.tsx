import { Box, Typography, Card, CardContent, Grid } from "@mui/material";
import DashboardBox from "@/components/DashboardBox";
import { useGetTransactionsQuery } from "@/state/api";
import { format } from "date-fns";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

const Row2 = () => {
  const { data } = useGetTransactionsQuery({ page: 1, limit: 5 });

  const recentTransactions = data?.transactions || [];

  return (
    <>
      <DashboardBox gridArea="d">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Recent Transactions
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {recentTransactions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No transactions yet
              </Typography>
            ) : (
              recentTransactions.map((transaction: any) => (
                <Box
                  key={transaction._id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: "background.default",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {transaction.type === "income" ? (
                      <TrendingUpIcon color="success" fontSize="small" />
                    ) : (
                      <TrendingDownIcon color="error" fontSize="small" />
                    )}
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {transaction.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(transaction.date), "MMM dd")}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    color={transaction.type === "income" ? "success.main" : "error.main"}
                  >
                    {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                  </Typography>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="e">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Quick Stats
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Avg Transaction
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    ${(recentTransactions.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) / (recentTransactions.length || 1)).toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    This Month
                  </Typography>
                  <Typography variant="h6" fontWeight="bold">
                    {recentTransactions.length} transactions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="f">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Category Breakdown
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {recentTransactions
              .filter((t: any) => t.type === "expense")
              .slice(0, 5)
              .map((transaction: any) => (
                <Box
                  key={transaction._id}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="body2">{transaction.category}</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    ${transaction.amount.toFixed(2)}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Box>
      </DashboardBox>
    </>
  );
};

export default Row2;
