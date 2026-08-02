import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";

const ProtectedRoute = ({ allowedRoles, requireTest }) => {
  const { isAuthenticated, role, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires specific roles
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  // Provider: profile completion and qualification test check
  if (requireTest && role === 'provider' && user) {
    // 1. Enforce profile completion validation
    if (user.profileComplete === false) {
      return <Navigate to="/register-provider" replace />;
    }
    // 2. Enforce qualification test validation
    if (!user.testPassed) {
      const allowedPaths = ['/provider/test', '/provider/profile', '/provider/support'];
      const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p));
      if (!isAllowed) {
        return <Navigate to="/provider/test" replace />;
      }
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;