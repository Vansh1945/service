import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/auth";

const ProtectedRoute = ({ allowedRoles, requireTest }) => {
  const { isAuthenticated, role, user, logoutUser } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if route requires specific roles
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Provider: profile completion, approval, and qualification test checks
  if (role === 'provider' && user) {
    // 1. Enforce profile completion validation
    if (user.profileComplete === false) {
      if (location.pathname.startsWith('/provider/dashboard')) {
        if (typeof logoutUser === 'function') {
          logoutUser(false);
        }
        return <Navigate to="/login" replace />;
      }
      return <Navigate to="/register-provider" replace />;
    }
    // 2. Enforce pending approval validation - only allow Profile & Support pages
    if (user.approved === false) {
      const allowedUnapprovedPaths = ['/provider/profile', '/provider/support'];
      const isAllowed = allowedUnapprovedPaths.some(p => location.pathname.startsWith(p));
      if (!isAllowed) {
        return <Navigate to="/provider/profile" replace />;
      }
    } else if (requireTest && !user.testPassed) {
      // 3. Enforce qualification test validation once approved
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