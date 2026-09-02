import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "../components/ui/Toast";
import { normalizeApiError } from "../utils/messages";

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
                console.error(e);
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
            console.error(error);
            return null;
        }
    });

    const [systemSettings, setSystemSettings] = useState(() => readCachedSystemSettings());
    const [activeBranding, setActiveBranding] = useState(() => {
        const currentRole = getCookie("role") || "customer";
        try {
            const cached = localStorage.getItem(`branding_${currentRole}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                return parsed.role ? parsed : { ...parsed, role: currentRole };
            }
            return null;
        } catch (error) {
            console.error(error);
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
                const brandingData = { ...brandingRes.data.data, role: roleToFetch };
                localStorage.setItem(`branding_${roleToFetch}`, JSON.stringify(brandingData));
                setActiveBranding(brandingData);
            }
        } catch (error) {
            console.error("Failed to fetch system/branding settings:", error);
        }
    }, [currentBrandingRole]);

    // Fetch system and branding data on mount and on branding role changes
    useEffect(() => {
        const cached = localStorage.getItem(`branding_${currentBrandingRole}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                setActiveBranding(parsed.role ? parsed : { ...parsed, role: currentBrandingRole });
            } catch (e) {
                console.error(e);
            }
        }
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
            console.error(error);
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
            console.error(error);
            return false;
        }
    }, [token]);

    // Toast notification with automatic human-readable error sanitization
    const showToast = (rawMessage, type = 'success') => {
        if (!rawMessage || rawMessage === 'silent_cancel' || rawMessage === 'canceled' || rawMessage === 'Duplicate request blocked') {
            return;
        }

        let message = rawMessage;
        let toastType = type;

        if (typeof rawMessage === 'object' || (typeof rawMessage === 'string' && (type === 'error' || rawMessage.startsWith('Error:') || rawMessage.includes('Mongo') || rawMessage.includes('Axios') || rawMessage.includes('500') || rawMessage.includes('Cast') || rawMessage.includes('ObjectId')))) {
            const normalized = normalizeApiError(rawMessage);
            message = normalized.message;
            if (type === 'error' || normalized.isServerError || normalized.isNetworkError || normalized.isAuthError || normalized.isForbidden) {
                toastType = 'error';
            }
        }

        toast[toastType](message, {
            position: "top-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
        });
    };

    const loginUser = async (newToken, newRole, userData, newRefreshToken = null, rememberMe = false) => {
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

            // Save to cookies securely (rememberMe true = 30 days, false = session cookie)
            const cookieDays = rememberMe ? 30 : null;
            setCookie("token", newToken, cookieDays);
            eraseCookie("refreshToken");
            setCookie("role", finalRole, cookieDays);
            setCookie("user", JSON.stringify(userObj), cookieDays);

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
                    if (userObj.profileComplete === false) {
                        navigate('/register-provider', { replace: true });
                    } else if (!userObj.testPassed) {
                        navigate('/provider/test', { replace: true });
                    } else {
                        navigate('/provider/dashboard', { replace: true });
                    }
                } else {
                    navigate('/customer/services', { replace: true });
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
        // Trigger backend logout to clear HttpOnly cookie
        AuthService.logoutApi({}).catch(() => {});

        // Erase auth cookies securely
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

        // Execute backend logout API in the background to clear HttpOnly refresh cookie
        const currentFcmToken = localStorage.getItem("fcmToken");
        AuthService.logoutApi({
            fcmToken: currentFcmToken
        }).catch(e => {
            console.warn("Backend background logout failed:", e);
        });
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

export default AuthContext;
