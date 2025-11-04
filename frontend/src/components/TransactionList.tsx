import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Chip,
  useTheme,
  Button,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { useDeleteTransactionMutation } from "@/state/api";
import { useState } from "react";

interface TransactionListProps {
  transactions: any[];
  onEdit: (transaction: any) => void;
  onRefresh?: () => void;
}

const TransactionList = ({ transactions, onEdit, onRefresh }: TransactionListProps) => {
  const theme = useTheme();
  const [deleteTransaction] = useDeleteTransactionMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    
    try {
      setDeletingId(id);
      await deleteTransaction(id).unwrap();
      onRefresh?.();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Food: "#FF6B6B",
      Transport: "#4ECDC4",
      Shopping: "#45B7D1",
      Bills: "#FFA07A",
      Entertainment: "#98D8C8",
      Healthcare: "#F7DC6F",
      Education: "#BB8FCE",
      Travel: "#85C1E2",
      Other: "#95A5A6",
    };
    return colors[category] || "#95A5A6";
  };

  if (transactions.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="h6" color="text.secondary">
          No transactions yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Add your first transaction to get started
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {transactions.map((transaction) => (
        <Grid item xs={12} sm={6} md={4} key={transaction._id}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: theme.shadows[8],
              },
            }}
          >
            <CardContent sx={{ flexGrow: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Box>
                  {transaction.type === "income" ? (
                    <TrendingUpIcon color="success" />
                  ) : (
                    <TrendingDownIcon color="error" />
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => onEdit(transaction)}
                    color="primary"
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(transaction._id)}
                    color="error"
                    disabled={deletingId === transaction._id}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                ${Math.abs(transaction.amount).toFixed(2)}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {transaction.description}
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
                <Chip
                  label={transaction.category}
                  size="small"
                  sx={{
                    backgroundColor: getCategoryColor(transaction.category),
                    color: "white",
                    fontWeight: "bold",
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(transaction.date), "MMM dd, yyyy")}
                </Typography>
              </Box>

              {transaction.metadata?.isFraudulent && (
                <Chip
                  label="Fraud Alert"
                  color="error"
                  size="small"
                  sx={{ mt: 1 }}
                />
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default TransactionList;

