import { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";
import { usePredictSpendMutation } from "@/state/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const AnalyticsPage = () => {
  const [months, setMonths] = useState(3);
  const [predictSpend, { data: predictions, isLoading, error }] = usePredictSpendMutation();
  const [tab, setTab] = useState(0);

  const handlePredict = () => {
    predictSpend({ months });
  };

  const predictionData = predictions?.predictions || [];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Analytics & Predictions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Get insights into your spending patterns and future predictions
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Spend Predictions" />
        <Tab label="Trend Analysis" />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    Monthly Spending Predictions
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant={months === 1 ? "contained" : "outlined"}
                      onClick={() => setMonths(1)}
                      size="small"
                    >
                      1 Month
                    </Button>
                    <Button
                      variant={months === 3 ? "contained" : "outlined"}
                      onClick={() => setMonths(3)}
                      size="small"
                    >
                      3 Months
                    </Button>
                    <Button
                      variant={months === 6 ? "contained" : "outlined"}
                      onClick={() => setMonths(6)}
                      size="small"
                    >
                      6 Months
                    </Button>
                    <Button variant="contained" onClick={handlePredict} size="small">
                      Predict
                    </Button>
                  </Box>
                </Box>

                {isLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : error ? (
                  <Alert severity="error">Failed to load predictions</Alert>
                ) : predictionData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={400}>
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
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>

                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                        Category Breakdown (Next Month)
                      </Typography>
                      {predictionData[0]?.categoryBreakdown && (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={predictionData[0].categoryBreakdown}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="amount" fill="#82ca9d" name="Amount" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Card>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                Model Accuracy
                              </Typography>
                              <Typography variant="h4" fontWeight="bold" color="primary.main">
                                {predictions?.accuracy ? `${Math.round(predictions.accuracy * 100)}%` : "N/A"}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                Average Predicted Spending
                              </Typography>
                              <Typography variant="h4" fontWeight="bold">
                                $
                                {(
                                  predictionData.reduce(
                                    (sum: number, p: any) => sum + p.predictedAmount,
                                    0
                                  ) / predictionData.length
                                ).toFixed(2)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Card>
                            <CardContent>
                              <Typography variant="body2" color="text.secondary">
                                Prediction Period
                              </Typography>
                              <Typography variant="h4" fontWeight="bold">
                                {months} {months === 1 ? "Month" : "Months"}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </Box>
                  </>
                ) : (
                  <Alert severity="info">
                    Click "Predict" to generate spending predictions
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Trend Analysis
            </Typography>
            <Alert severity="info">
              Trend analysis feature coming soon. Add more transactions to see spending trends.
            </Alert>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default AnalyticsPage;

