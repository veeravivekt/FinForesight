import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Formik } from "formik";
import * as yup from "yup";
import { useCreateTransactionMutation, useUpdateTransactionMutation, useDetectFraudMutation } from "@/state/api";
import { useState } from "react";

const transactionSchema = yup.object().shape({
  amount: yup.number().positive("Amount must be positive").required("Amount is required"),
  description: yup.string().required("Description is required"),
  category: yup.string().required("Category is required"),
  type: yup.string().oneOf(["income", "expense"]).required("Type is required"),
  date: yup.string().required("Date is required"),
});

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

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  transaction?: any;
  onSuccess?: () => void;
}

const TransactionForm = ({ open, onClose, transaction, onSuccess }: TransactionFormProps) => {
  const [createTransaction] = useCreateTransactionMutation();
  const [updateTransaction] = useUpdateTransactionMutation();
  const [detectFraud] = useDetectFraudMutation();
  const [fraudAlert, setFraudAlert] = useState<any>(null);
  const [checkingFraud, setCheckingFraud] = useState(false);

  const isEdit = !!transaction;

  const handleSubmit = async (values: any) => {
    try {
      // Check for fraud if it's an expense
      if (values.type === "expense" && values.amount > 0 && !isEdit) {
        setCheckingFraud(true);
        try {
          const fraudResult = await detectFraud({
            transaction: {
              ...values,
              date: new Date(values.date).toISOString(),
            },
          }).unwrap();
          
          if (fraudResult.isFraudulent) {
            setFraudAlert(fraudResult);
            setCheckingFraud(false);
            return; // Don't submit if fraud detected
          }
        } catch (error) {
          console.error("Fraud detection error:", error);
          // Continue with transaction creation even if fraud check fails
        }
        setCheckingFraud(false);
      }

      if (isEdit) {
        await updateTransaction({ id: transaction._id, ...values }).unwrap();
      } else {
        await createTransaction(values).unwrap();
      }
      setFraudAlert(null);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Transaction error:", error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
      <DialogContent>
        {fraudAlert && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Fraud Alert: This transaction has a {Math.round(fraudAlert.fraudScore * 100)}% fraud score
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Do you want to proceed anyway?
            </Typography>
          </Alert>
        )}
        <Formik
          initialValues={{
            amount: transaction?.amount || "",
            description: transaction?.description || "",
            category: transaction?.category || "",
            type: transaction?.type || "expense",
            date: transaction?.date ? new Date(transaction.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          }}
          validationSchema={transactionSchema}
          onSubmit={handleSubmit}
        >
          {({
            values,
            errors,
            touched,
            handleBlur,
            handleChange,
            handleSubmit,
            isSubmitting,
          }) => (
            <form onSubmit={handleSubmit}>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  name="type"
                  value={values.type}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  label="Type"
                >
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Amount"
                name="amount"
                type="number"
                value={values.amount}
                onChange={handleChange}
                onBlur={handleBlur}
                error={!!touched.amount && !!errors.amount}
                helperText={touched.amount && errors.amount}
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
              />

              <TextField
                fullWidth
                label="Description"
                name="description"
                value={values.description}
                onChange={handleChange}
                onBlur={handleBlur}
                error={!!touched.description && !!errors.description}
                helperText={touched.description && errors.description}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={values.category}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  label="Category"
                  error={!!touched.category && !!errors.category}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Date"
                name="date"
                type="date"
                value={values.date}
                onChange={handleChange}
                onBlur={handleBlur}
                error={!!touched.date && !!errors.date}
                helperText={touched.date && errors.date}
                InputLabelProps={{
                  shrink: true,
                }}
                sx={{ mb: 2 }}
              />

              <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || checkingFraud}
                >
                  {isSubmitting || checkingFraud ? (
                    <CircularProgress size={24} />
                  ) : isEdit ? (
                    "Update"
                  ) : (
                    "Add"
                  )}
                </Button>
              </DialogActions>
            </form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionForm;

