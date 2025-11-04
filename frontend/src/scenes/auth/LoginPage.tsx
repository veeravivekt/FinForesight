import { useLoginMutation } from "@/state/api";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from "@mui/material";
import { Formik } from "formik";
import * as yup from "yup";

const loginSchema = yup.object().shape({
  email: yup.string().email("Invalid email").required("Email is required"),
  password: yup.string().required("Password is required"),
});

const LoginPage = () => {
  const [login, { isLoading, error }] = useLoginMutation();
  const navigate = useNavigate();

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      const result = await login(values).unwrap();
      localStorage.setItem("accessToken", result.accessToken);
      localStorage.setItem("refreshToken", result.refreshToken);
      localStorage.setItem("userId", result.user.id || result.user._id);
      navigate("/");
    } catch (err: any) {
      console.error("Login error:", err);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          width: "100%",
          maxWidth: 400,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom align="center">
          FinForesight
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
          Sign in to your account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {"data" in error ? (error.data as any).error : "Login failed"}
          </Alert>
        )}

        <Formik
          initialValues={{ email: "", password: "" }}
          validationSchema={loginSchema}
          onSubmit={handleLogin}
        >
          {({
            values,
            errors,
            touched,
            handleBlur,
            handleChange,
            handleSubmit,
            setFieldValue,
          }) => (
            <>
              {/* Test Credentials Card */}
              <Card
                sx={{
                  mt: 2,
                  mb: 2,
                  backgroundColor: "#e3f2fd",
                  border: "1px solid #90caf9",
                }}
              >
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Test Credentials:
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Email:</strong> test@finforesight.com
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Password:</strong> test123
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={() => {
                      setFieldValue("email", "test@finforesight.com");
                      setFieldValue("password", "test123");
                    }}
                    sx={{ mt: 1 }}
                  >
                    Fill Test Credentials
                  </Button>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmit}>
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
                sx={{ mb: 2, mt: 2 }}
              />
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                error={!!touched.password && !!errors.password}
                helperText={touched.password && errors.password}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={isLoading}
                sx={{ mt: 2 }}
              >
                {isLoading ? <CircularProgress size={24} /> : "Sign In"}
              </Button>
              </form>
            </>
          )}
        </Formik>

        <Box sx={{ mt: 2, textAlign: "center" }}>
          <Typography variant="body2">
            Don't have an account?{" "}
            <Button
              variant="text"
              onClick={() => navigate("/register")}
              sx={{ textTransform: "none" }}
            >
              Sign up
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;

