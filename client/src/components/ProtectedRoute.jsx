import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../store/auth";

const ProtectedRoute = ({ allowedRoles, requireApproval = false }) => {
  const { isAuthenticated, role, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires specific roles and if user has one of them
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Additional check for provider approval status
  if (requireApproval && role === 'provider' && !user?.approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;