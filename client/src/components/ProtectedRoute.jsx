import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth";

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires specific roles and if user has one of them
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }


  return <Outlet />;
};

export default ProtectedRoute;