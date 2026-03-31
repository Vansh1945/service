import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";

const ProtectedRoute = ({ allowedRoles, requireApproval, requireTest }) => {
  const { isAuthenticated, role, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires specific roles
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Provider: test passed check
  // Allow access to /provider/test, /provider/dashboard, /provider/profile without testPassed
  if (
    requireTest &&
    role === 'provider' &&
    user &&
    user.approved &&
    !user.testPassed
  ) {
    const allowedPaths = ['/provider/test', '/provider/dashboard', '/provider/profile'];
    const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p));
    if (!isAllowed) {
      return <Navigate to="/provider/test" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;