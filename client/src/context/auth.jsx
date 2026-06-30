import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import * as AdminService from "../services/AdminService";
import * as ProviderService from "../services/ProviderService";
import * as CustomerService from "../services/CustomerService";
import * as AuthService from "../services/AuthService";
import * as SystemService from "../services/SystemService";

import {
    SYSTEM_SETTINGS_UPDATED_EVENT,
    readCachedSystemSettings,
    writeSystemSettingsCache
} from "../utils/systemSettingsCache";

const setCookie = (name, value, days = 7) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax${secure}`;
};

const getCookie = (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            try {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            } catch (e) {
                return c.substring(nameEQ.length, c.length);
            }
        }
    }
    return null;
};

const eraseCookie = (name) => {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
};

// Clean up any sensitive auth data left in localStorage (auth now uses cookies)
if (typeof window !== "undefined" && window.localStorage) {
    ["token", "refreshToken", "user"].forEach(key => {
        if (localStorage.getItem(key)) localStorage.removeItem(key);
    });
}

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const loc = useLocation();
    const API = import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api");
    const API_URL_IMAGE = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace('/api', '') : window.location.origin;

    // State management
    const [token, setToken] = useState(() => getCookie("token") || null);
    const [refreshToken, setRefreshToken] = useState(() => getCookie("refreshToken") || null);
    const [role, setRole] = useState(() => getCookie("role") || null);
    const [user, setUser] = useState(() => {
        try {
            const userData = getCookie("user");
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            return null;
        }
    });

    const [systemSettings, setSystemSettings] = useState(() => readCachedSystemSettings());
    const [activeBranding, setActiveBranding] = useState(() => {
        const currentRole = getCookie("role") || "customer";
        try {
            const cached = localStorage.getItem(`branding_${currentRole}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            return null;
        }
    });

    // Detect layout branding role reactively from loc.pathname
    const currentBrandingRole = useMemo(() => {
        let currentRole = localStorage.getItem("installRole");
        if (loc.pathname.startsWith("/admin")) {
            currentRole = "admin";
        } else if (loc.pathname.startsWith("/provider")) {
            currentRole = "provider";
        } else if (loc.pathname.startsWith("/customer")) {
            currentRole = "customer";
        }
        if (!currentRole || !["customer", "provider", "admin"].includes(currentRole)) {
            currentRole = "customer";
        }
        return currentRole;
    }, [loc.pathname]);

    // Unified setting and branding fetcher
    const fetchSystemAndBranding = useCallback(async (targetRole) => {
        const roleToFetch = targetRole || currentBrandingRole;
        try {
            // Fetch system settings
            const globalRes = await SystemService.getSystemSetting();
            if (globalRes.data?.success) {
                const settingsData = globalRes.data.data;
                writeSystemSettingsCache(settingsData);
                setSystemSettings(settingsData);
            }

            // Fetch role specific branding
            const brandingRes = await SystemService.getBrandingSettings(roleToFetch);
            if (brandingRes.data?.success) {
                const brandingData = brandingRes.data.data;
                localStorage.setItem(`branding_${roleToFetch}`, JSON.stringify(brandingData));
                setActiveBranding(brandingData);
                window.dispatchEvent(new CustomEvent("brandingUpdated", { detail: { role: roleToFetch, data: brandingData } }));
            }
        } catch (error) {
            console.error("Failed to fetch system/branding settings:", error);
        }
    }, [currentBrandingRole]);

    // Fetch system and branding data on mount and on branding role changes
    useEffect(() => {
        // Load from cache first
        const cached = localStorage.getItem(`branding_${currentBrandingRole}`);
        if (cached) {
            try {
                setActiveBranding(JSON.parse(cached));
            } catch (e) { }
        }

        // Background update fetch
        fetchSystemAndBranding(currentBrandingRole);
    }, [currentBrandingRole, fetchSystemAndBranding]);

    useEffect(() => {
        const handleSystemSettingsUpdated = (event) => {
            const updated = event?.detail || readCachedSystemSettings();
            setSystemSettings({ ...updated });
        };

        const handleBrandingUpdated = (event) => {
            if (event.detail?.role === currentBrandingRole) {
                setActiveBranding(event.detail.data);
            }
        };

        window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSystemSettingsUpdated);
        window.addEventListener("brandingUpdated", handleBrandingUpdated);

        return () => {
            window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSystemSettingsUpdated);
            window.removeEventListener("brandingUpdated", handleBrandingUpdated);
        };
    }, [currentBrandingRole]);

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
        if (message === 'silent_cancel' || message === 'canceled' || message === 'Duplicate request blocked') {
            return;
        }
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

            // Save to cookies securely (Fix 5)
            setCookie("token", newToken, 7);
            if (newRefreshToken) setCookie("refreshToken", newRefreshToken, 7);
            setCookie("role", finalRole, 7);
            setCookie("user", JSON.stringify(userObj), 7);

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
                    if (userObj.profileComplete === false) {
                        navigate('/register-provider', { replace: true });
                    } else if (!userObj.approved) {
                        // Unapproved provider should not access provider routes
                        showToast('Your account is pending approval. Please contact support for assistance.', 'info');
                        logoutUser();
                        return;
                    } else if (!userObj.testPassed) {
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
        const currentRefreshToken = getCookie("refreshToken");
        const currentFcmToken = localStorage.getItem("fcmToken");

        // Erase auth cookies securely (Fix 5)
        eraseCookie("token");
        eraseCookie("refreshToken");
        eraseCookie("role");
        eraseCookie("user");

        // Selective localStorage clear — preserve device identity and PWA keys
        const preserved = {};
        const keysToPreserve = [
            "persistentDeviceId",
            "tempFcmToken",
            "fcmToken",
            "installMode",
            "installRole"
        ];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (keysToPreserve.includes(key) || key.startsWith("app_version_") || key.startsWith("branding_"))) {
                preserved[key] = localStorage.getItem(key);
            }
        }

        localStorage.clear();
        sessionStorage.clear();

        // Restore preserved keys
        Object.entries(preserved).forEach(([k, v]) => {
            if (v !== null && v !== undefined) {
                localStorage.setItem(k, v);
            }
        });

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
                    setCookie("user", JSON.stringify(userObj), 7);
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
        isTokenExpired,
        systemSettings,
        activeBranding,
        fetchSystemAndBranding
    }), [token, refreshToken, role, user, isAdmin, isDeepLink, intendedRoute, API, refreshUser, systemSettings, activeBranding, fetchSystemAndBranding]);

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
