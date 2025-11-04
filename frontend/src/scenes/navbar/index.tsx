/* eslint-disable @typescript-eslint/no-unused-vars */
import { Link, useLocation } from "react-router-dom";
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import LogoutIcon from '@mui/icons-material/Logout';
import { Box, Typography, useTheme, IconButton } from "@mui/material";
import FlexBetween from "../../components/FlexBetween";
import { useAuth } from "@/hooks/useAuth";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

const Navbar = (props: Props) => {
  const { palette } = useTheme();
  const location = useLocation();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/transactions", label: "Transactions" },
    { path: "/analytics", label: "Analytics" },
    { path: "/settings", label: "Settings" },
  ];

  return (
    <FlexBetween mb="0.25rem" p="0.5rem 0rem" color={palette.grey[300]}>
      {/* LEFT SIDE */}
      <FlexBetween gap="0.75rem">
        <AssuredWorkloadIcon sx={{ fontSize: "28px" }} />
        <Typography variant="h4" fontSize="16px">
          FinForesight
        </Typography>
      </FlexBetween>

      {/* RIGHT SIDE */}
      <FlexBetween gap="2rem">
        {navItems.map((item) => (
          <Box key={item.path} sx={{ "&:hover": { color: palette.primary[100] } }}>
            <Link
              to={item.path}
              style={{
                color: location.pathname === item.path ? palette.primary[100] : palette.grey[700],
                textDecoration: "inherit",
                fontWeight: location.pathname === item.path ? "bold" : "normal",
              }}
            >
              {item.label}
            </Link>
          </Box>
        ))}
        {user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2">{user.name}</Typography>
            <IconButton onClick={handleLogout} size="small">
              <LogoutIcon />
            </IconButton>
          </Box>
        )}
      </FlexBetween>
    </FlexBetween>
  );
};

export default Navbar;
