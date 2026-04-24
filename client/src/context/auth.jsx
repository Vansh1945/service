import { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import * as AdminService from "../services/AdminService";
import * as ProviderService from "../services/ProviderService";
import * as CustomerService from "../services/CustomerService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
    const API_URL_IMAGE = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('/api', '') : 'http://localhost:5000';

    // State management
    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [role, setRole] = useState(() => localStorage.getItem("role") || null);
    const [user, setUser] = useState(() => {
        try {
            const userData = localStorage.getItem("user");
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            return null;
        }
    });

    // Deep link state
    const [isDeepLink, setIsDeepLink] = useState(false);
    const [intendedRoute, setIntendedRoute] = useState(null);

    // Check if token is expired
    const isTokenExpired = (token) => {
        if (!token) return true;
        try {
            const decoded = jwtDecode(token);
            return decoded.exp * 1000 < Date.now();
        } catch (error) {
            return true;
        }
    };

    // Memoized admin check
    const isAdmin = useMemo(() => {
        if (!token) return false;
        try {
            const decoded = jwtDecode(token);
            return decoded.role === 'admin' || decoded.isAdmin === true;
        } catch (error) {
            return false;
        }
    }, [token]);

    // Toast notification
    const showToast = (message, type = 'success') => {
        toast[type](message, {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        });
    };

    // Login function
    const loginUser = async (newToken, newRole, userData) => {
        try {
            if (isTokenExpired(newToken)) {
                throw new Error("Token is invalid or expired");
            }

            const decodedToken = jwtDecode(newToken);
            const finalRole = (userData?.isAdmin || decodedToken.isAdmin) ? 'admin' : newRole;

            const userObj = {
                ...userData,
                _id: decodedToken.id,
                isAdmin: userData?.isAdmin || decodedToken.isAdmin || false
            };

            // Save to localStorage
            localStorage.setItem("token", newToken);
            localStorage.setItem("role", finalRole);
            localStorage.setItem("user", JSON.stringify(userObj));

            // Update state
            setToken(newToken);
            setRole(finalRole);
            setUser(userObj);

            // Check for redirectTo query parameter
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirectTo');

            if (intendedRoute) {
                const target = intendedRoute;
                setIntendedRoute(null);
                navigate(target, { replace: true });
            } else if (redirectTo) {
                navigate(redirectTo, { replace: true });
            } else {
                // Redirect based on role
                if (finalRole === 'admin' || userObj.isAdmin) {
                    navigate('/admin/dashboard', { replace: true });
                } else if (finalRole === 'provider') {
                    if (!userObj.testPassed) {
                        navigate('/provider/test');
                    } else {
                        navigate('/provider/dashboard');
                    }
                } else {
                    navigate('/customer/services');
                }
            }

        } catch (error) {
            console.error("Login error:", error);
            showToast(error.message || 'Login failed', 'error');
            logoutUser();
        }
    };

    // Logout function
    const logoutUser = () => {
        localStorage.clear();
        setToken(null);
        setRole(null);
        setUser(null);
        showToast('Logged out successfully');
        navigate('/login');
    };

    // Removed force auto-logout on token expiration to maintain persistence
    useEffect(() => {
        // Fetch fresh user data to auto open logged-in account
        const restoreSession = async () => {
            if (!token || !role) return;

            try {
                let res;
                if (role === 'admin') {
                    res = await AdminService.getAdminProfile();
                } else if (role === 'provider') {
                    res = await ProviderService.getProfile();
                } else {
                    res = await CustomerService.getProfile();
                }

                if (res.data?.success || res.status === 200) {
                    const data = res.data;
                    const userData = data.admin || data.provider || data.user || data.data;

                    if (userData) {
                        const userObj = {
                            ...userData,
                            isAdmin: role === 'admin' || userData.isAdmin
                        };
                        setUser(userObj);
                        localStorage.setItem("user", JSON.stringify(userObj));
                    }
                }
            } catch (error) {
                console.error("Failed to restore session data:", error);
                if (error.response?.status === 401) {
                    logoutUser();
                }
            }
        };

        restoreSession();
    }, [token, role]);

    // Context value
    const contextValue = useMemo(() => ({
        token,
        role,
        user,
        isAuthenticated: !!token,
        isAdmin,
        isDeepLink,
        setIsDeepLink,
        intendedRoute,
        setIntendedRoute,
        resetDeepLink: () => setIsDeepLink(false),
        loginUser,
        logoutUser,
        API,
        API_URL_IMAGE,
        showToast,
        isTokenExpired
    }), [token, role, user, isAdmin, isDeepLink, intendedRoute, API]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};