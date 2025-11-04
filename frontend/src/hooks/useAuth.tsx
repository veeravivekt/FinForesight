import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetCurrentUserQuery, useLogoutMutation } from "@/state/api";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: any;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const token = localStorage.getItem("accessToken");
  
  const { data, isLoading, error } = useGetCurrentUserQuery(undefined, {
    skip: !token,
  });
  
  const [logoutMutation] = useLogoutMutation();
  const navigate = useNavigate();

  useEffect(() => {
    if (token && data?.user) {
      setIsAuthenticated(true);
      // Store userId if not already stored
      if (data.user._id || data.user.id) {
        localStorage.setItem("userId", data.user._id || data.user.id);
      }
    } else if (error || !token) {
      setIsAuthenticated(false);
    }
  }, [data, error, token]);

  const logout = async () => {
    try {
      await logoutMutation().unwrap();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("userId");
      setIsAuthenticated(false);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: data?.user,
        isLoading,
        isAuthenticated,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

