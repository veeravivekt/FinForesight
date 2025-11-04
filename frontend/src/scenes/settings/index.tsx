import { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Grid,
} from "@mui/material";
import { useGetCurrentUserQuery } from "@/state/api";
import { Formik } from "formik";
import * as yup from "yup";

const SettingsPage = () => {
  const { data, isLoading } = useGetCurrentUserQuery();

  const user = data?.user;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Profile Information
              </Typography>
              <Formik
                initialValues={{
                  name: user?.name || "",
                  email: user?.email || "",
                }}
                validationSchema={yup.object().shape({
                  name: yup.string().required("Name is required"),
                  email: yup.string().email("Invalid email").required("Email is required"),
                })}
                onSubmit={(values) => {
                  // Update user logic would go here
                  console.log("Update user:", values);
                }}
              >
                {({ values, errors, touched, handleChange, handleBlur, handleSubmit }) => (
                  <form onSubmit={handleSubmit}>
                    <TextField
                      fullWidth
                      label="Name"
                      name="name"
                      value={values.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={!!touched.name && !!errors.name}
                      helperText={touched.name && errors.name}
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      name="email"
                      type="email"
                      value={values.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={!!touched.email && !!errors.email}
                      helperText={touched.email && errors.email}
                      sx={{ mb: 2 }}
                    />
                    <Button type="submit" variant="contained">
                      Update Profile
                    </Button>
                  </form>
                )}
              </Formik>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Preferences
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={user?.preferences?.currency || "USD"}
                  label="Currency"
                  onChange={(e) => {
                    // Update preference logic
                    console.log("Currency:", e.target.value);
                  }}
                >
                  <MenuItem value="USD">USD ($)</MenuItem>
                  <MenuItem value="EUR">EUR (€)</MenuItem>
                  <MenuItem value="GBP">GBP (£)</MenuItem>
                  <MenuItem value="INR">INR (₹)</MenuItem>
                </Select>
              </FormControl>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
                Notifications
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={user?.preferences?.notifications?.email ?? true}
                    onChange={(e) => {
                      console.log("Email notifications:", e.target.checked);
                    }}
                  />
                }
                label="Email Notifications"
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={user?.preferences?.notifications?.push ?? true}
                    onChange={(e) => {
                      console.log("Push notifications:", e.target.checked);
                    }}
                  />
                }
                label="Push Notifications"
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={user?.preferences?.notifications?.fraudAlerts ?? true}
                    onChange={(e) => {
                      console.log("Fraud alerts:", e.target.checked);
                    }}
                  />
                }
                label="Fraud Alerts"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                Account Information
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography variant="body2">
                  <strong>User ID:</strong> {user?._id || user?.id}
                </Typography>
                <Typography variant="body2">
                  <strong>Email Verified:</strong> {user?.isEmailVerified ? "Yes" : "No"}
                </Typography>
                <Typography variant="body2">
                  <strong>Member Since:</strong>{" "}
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPage;

