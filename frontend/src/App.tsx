import { createTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import { themeSettings } from './theme';
import { Box, CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from "@/scenes/navbar";
import Dashboard from "@/scenes/dashboard";
import LoginPage from "@/scenes/auth/LoginPage";
import RegisterPage from "@/scenes/auth/RegisterPage";
import TransactionsPage from "@/scenes/transactions";
import AnalyticsPage from "@/scenes/analytics";
import SettingsPage from "@/scenes/settings";

function App() {
  const theme = useMemo(() => createTheme(themeSettings), []);

  return (
    <div className="app">
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={
                  <Box width="100%" height="100%" padding="1rem 2rem 4rem 2rem">
                    <Navbar />
                    <Dashboard />
                  </Box>
                } />
                <Route path="/transactions" element={
                  <Box width="100%" height="100%" padding="1rem 2rem 4rem 2rem">
                    <Navbar />
                    <TransactionsPage />
                  </Box>
                } />
                <Route path="/analytics" element={
                  <Box width="100%" height="100%" padding="1rem 2rem 4rem 2rem">
                    <Navbar />
                    <AnalyticsPage />
                  </Box>
                } />
                <Route path="/settings" element={
                  <Box width="100%" height="100%" padding="1rem 2rem 4rem 2rem">
                    <Navbar />
                    <SettingsPage />
                  </Box>
                } />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
