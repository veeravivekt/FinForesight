import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
} from "@mui/material";
import {
  Add as AddIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useGetTransactionsQuery, useGetTransactionStatsQuery } from "@/state/api";
import TransactionForm from "@/components/TransactionForm";
import TransactionList from "@/components/TransactionList";
import DashboardBox from "@/components/DashboardBox";

const TransactionsPage = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterType, setFilterType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const { data: transactionsData, isLoading, refetch } = useGetTransactionsQuery({
    page,
    limit,
    category: filterCategory || undefined,
    type: filterType || undefined,
  });

  // Memoize date parameters to ensure stable query cache keys
  const statsQueryParams = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, []); // Empty deps - dates should be stable for the current month period

  const { data: stats } = useGetTransactionStatsQuery(statsQueryParams);

  const transactions = transactionsData?.transactions || [];

  const filteredTransactions = transactions.filter((t: any) => {
    if (searchQuery) {
      return t.description.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleEdit = (transaction: any) => {
    setSelectedTransaction(transaction);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedTransaction(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedTransaction(null);
    refetch();
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" fontWeight="bold">
          Transactions
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Transaction
        </Button>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Income
                </Typography>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  ${stats.summary.totalIncome.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total Expenses
                </Typography>
                <Typography variant="h5" color="error.main" fontWeight="bold">
                  ${stats.summary.totalExpense.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Net Balance
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  color={
                    stats.summary.totalIncome - stats.summary.totalExpense >= 0
                      ? "success.main"
                      : "error.main"
                  }
                >
                  ${(stats.summary.totalIncome - stats.summary.totalExpense).toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  <MenuItem value="Food">Food</MenuItem>
                  <MenuItem value="Transport">Transport</MenuItem>
                  <MenuItem value="Shopping">Shopping</MenuItem>
                  <MenuItem value="Bills">Bills</MenuItem>
                  <MenuItem value="Entertainment">Entertainment</MenuItem>
                  <MenuItem value="Healthcare">Healthcare</MenuItem>
                  <MenuItem value="Education">Education</MenuItem>
                  <MenuItem value="Travel">Travel</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  label="Type"
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TransactionList
          transactions={filteredTransactions}
          onEdit={handleEdit}
          onRefresh={refetch}
        />
      )}

      {/* Pagination */}
      {transactionsData?.pagination && transactionsData.pagination.pages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3, gap: 1 }}>
          <Button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Typography sx={{ alignSelf: "center" }}>
            Page {page} of {transactionsData.pagination.pages}
          </Typography>
          <Button
            disabled={page === transactionsData.pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Box>
      )}

      {/* Transaction Form Dialog */}
      <TransactionForm
        open={formOpen}
        onClose={handleFormClose}
        transaction={selectedTransaction}
        onSuccess={handleFormClose}
      />
    </Box>
  );
};

export default TransactionsPage;

