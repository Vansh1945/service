import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import * as AdminService from "../services/AdminService";
import * as ProviderService from "../services/ProviderService";
import * as CustomerService from "../services/CustomerService";
import * as AuthService from "../services/AuthService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const API = import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api");
    const API_URL_IMAGE = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('/api', '') : window.location.origin;

    // State management
    const [token, setToken] = useState(() => localStorage.getItem("token") || null);
    const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("refreshToken") || null);
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

    const loginUser = async (newToken, newRole, userData, newRefreshToken = null) => {
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
            if (newRefreshToken) localStorage.setItem("refreshToken", newRefreshToken);
            localStorage.setItem("role", finalRole);
            localStorage.setItem("user", JSON.stringify(userObj));

            // Update state
            setToken(newToken);
            if (newRefreshToken) setRefreshToken(newRefreshToken);
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
        const currentRefreshToken = localStorage.getItem("refreshToken");
        const currentFcmToken = localStorage.getItem("fcmToken");

        // Selective clear to preserve device identity
        const persistentDeviceId = localStorage.getItem("persistentDeviceId");
        const tempFcmToken = localStorage.getItem("tempFcmToken");
        localStorage.clear();
        if (persistentDeviceId) {
            localStorage.setItem("persistentDeviceId", persistentDeviceId);
        }
        if (tempFcmToken) {
            localStorage.setItem("tempFcmToken", tempFcmToken);
        }

        setToken(null);
        setRefreshToken(null);
        setRole(null);
        setUser(null);
        showToast('Logged out successfully');
        navigate('/login');

        // Execute backend logout API in the background without blocking the UI
        if (currentRefreshToken || currentFcmToken) {
            AuthService.logoutApi({
                refreshToken: currentRefreshToken,
                fcmToken: currentFcmToken
            }).catch(e => {
                console.warn("Backend background logout failed:", e);
            });
        }
    };

    // Callback to refresh user data from DB
    const refreshUser = useCallback(async () => {
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
                    return userObj;
                }
            }
        } catch (error) {
            console.error("Failed to refresh session data:", error);
            if (error.response?.status === 401) {
                logoutUser();
            }
        }
    }, [token, role]);

    // Fetch fresh user data on token or role change
    useEffect(() => {
        refreshUser();
    }, [token, role, refreshUser]);

    // Context value
    const contextValue = useMemo(() => ({
        token,
        refreshToken,
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
        refreshUser,
        API,
        API_URL_IMAGE,
        showToast,
        isTokenExpired
    }), [token, refreshToken, role, user, isAdmin, isDeepLink, intendedRoute, API, refreshUser]);

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