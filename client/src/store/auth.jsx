import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const getInitialUserState = () => {
        try {
            const userData = localStorage.getItem("user");
            const token = localStorage.getItem("token");
            const role = localStorage.getItem("role");

            if (!userData || !token || !role) return null;

            // Verify token before using stored user data
            if (isTokenExpired(token)) {
                localStorage.clear();
                return null;
            }

            const parsedUser = JSON.parse(userData);
            
            // Ensure role consistency between token and user data
            const decodedToken = jwtDecode(token);
            if (decodedToken.role !== role) {
                localStorage.clear();
                return null;
            }

            return parsedUser;
        } catch (error) {
            console.error("Auth initialization error:", error);
            localStorage.clear();
            return null;
        }
    };

    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [role, setRole] = useState(() => localStorage.getItem("role") || null);
    const [user, setUser] = useState(getInitialUserState);
    const navigate = useNavigate();
    const API = import.meta.env.VITE_BACKEND_URL;

    const isTokenExpired = (token) => {
        if (!token) return true;
        try {
            const decoded = jwtDecode(token);
            return decoded.exp * 1000 < Date.now();
        } catch (error) {
            return true;
        }
    };

    const isAdmin = () => {
        if (!token) return false;
        try {
            const decoded = jwtDecode(token);
            return decoded.role === 'admin' || decoded.isAdmin === true;
        } catch (error) {
            return false;
        }
    };

const loginUser = async (newToken, newRole, userData) => {
    try {
        if (isTokenExpired(newToken)) {
            throw new Error("Token is invalid or expired");
        }

        const decodedToken = jwtDecode(newToken);
        
        // Debug logging
        console.log("Decoded Token:", decodedToken);
        console.log("User Data:", userData);

        // Enhanced admin validation
        if (userData.isAdmin || decodedToken.isAdmin) {
            if (decodedToken.role !== 'admin') {
                console.warn("User has isAdmin but role is not admin");
                // Force admin role if isAdmin is true
                newRole = 'admin';
            }
            
            if (!decodedToken.isAdmin) {
                console.warn("Token missing isAdmin claim");
                // Add isAdmin to token claims if missing
                decodedToken.isAdmin = true;
            }
        }

        // Verify role consistency
        if (decodedToken.role !== newRole) {
            throw new Error(`Role mismatch in token (token: ${decodedToken.role}, expected: ${newRole})`);
        }

        // Save auth data
        localStorage.setItem("token", newToken);
        localStorage.setItem("role", newRole);
        localStorage.setItem("user", JSON.stringify({
            ...userData,
            isAdmin: userData.isAdmin || decodedToken.isAdmin
        }));

        setToken(newToken);
        setRole(newRole);
        setUser({
            ...userData,
            isAdmin: userData.isAdmin || decodedToken.isAdmin
        });

        // Redirect with timeout to ensure state updates
        setTimeout(() => {
            if (newRole === 'admin' || userData.isAdmin) {
                navigate('/admin/dashboard', { replace: true });
            } else if (newRole === 'provider') {
                navigate(userData.approved ? '/provider/dashboard' : '/pending-approval');
            } else {
                navigate('/customer/dashboard');
            }
        }, 100);

    } catch (error) {
        console.error("Login error:", {
            error: error.message,
            token: newToken,
            decodedToken: newToken ? jwtDecode(newToken) : null,
            userData
        });
        
        logoutUser();
        throw error;
    }
};

    const logoutUser = () => {
        localStorage.clear();
        setToken(null);
        setRole(null);
        setUser(null);
        navigate('/login');
    };

    const refreshUserData = async () => {
        if (!token) return;
        
        try {
            const response = await fetch(`${API}/users/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to refresh user data');
            
            const updatedUser = await response.json();
            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);
            return updatedUser;
        } catch (error) {
            console.error("Failed to refresh user data:", error);
            throw error;
        }
    };

    useEffect(() => {
        const checkAuth = () => {
            if (token && isTokenExpired(token)) {
                logoutUser();
            }
        };

        // Set up periodic auth check every 5 minutes
        const interval = setInterval(checkAuth, 300000);
        return () => clearInterval(interval);
    }, [token]);

    const contextValue = useMemo(() => ({
        token,
        role,
        user,
        isAuthenticated: !!token && !isTokenExpired(token),
        isAdmin: isAdmin(),
        loginUser,
        logoutUser,
        refreshUserData,
        API
    }), [token, role, user, API]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export { useAuth };