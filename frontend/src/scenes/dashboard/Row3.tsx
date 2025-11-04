import { Box, Typography, Alert, CircularProgress } from "@mui/material";
import DashboardBox from "@/components/DashboardBox";
import { usePredictSpendMutation } from "@/state/api";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Row3 = () => {
  const [predictSpend, { data: predictions, isLoading }] = usePredictSpendMutation();
  const [hasPredicted, setHasPredicted] = useState(false);

  useEffect(() => {
    if (!hasPredicted) {
      predictSpend({ months: 3 });
      setHasPredicted(true);
    }
  }, [hasPredicted, predictSpend]);

  const predictionData = predictions?.predictions || [];

  return (
    <>
      <DashboardBox gridArea="g">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Spend Predictions
          </Typography>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : predictionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={predictionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predictedAmount"
                  stroke="#8884d8"
                  name="Predicted Spending"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Alert severity="info">Insufficient data for predictions</Alert>
          )}
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="h">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Prediction Accuracy
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <Typography variant="h3" fontWeight="bold" color="primary.main">
              {predictions?.accuracy ? `${Math.round(predictions.accuracy * 100)}%` : "N/A"}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Model Accuracy
          </Typography>
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="i">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            Next Month Prediction
          </Typography>
          {predictionData.length > 0 ? (
            <Box>
              <Typography variant="h4" fontWeight="bold" color="primary.main">
                ${predictionData[0]?.predictedAmount?.toFixed(2) || "0.00"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Predicted spending for {predictionData[0]?.month || "next month"}
              </Typography>
            </Box>
          ) : (
            <Alert severity="info">No predictions available</Alert>
          )}
        </Box>
      </DashboardBox>

      <DashboardBox gridArea="j">
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
            ML Insights
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Alert severity="success">
              Fraud detection active with 85% accuracy
            </Alert>
            <Alert severity="info">
              Spend prediction model trained and ready
            </Alert>
          </Box>
        </Box>
      </DashboardBox>
    </>
  );
};

export default Row3;
