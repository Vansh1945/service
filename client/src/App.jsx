import React, { useEffect, useState, Suspense, lazy } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import "./index.css";
import { useAuth } from "./context/auth";

// Components
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { SocketProvider } from "./socket/SocketContext";

// Public Pages (Optimized: Lazy loaded)
const Home = lazy(() => import("./pages/Home"));
const AboutPage = lazy(() => import("./pages/About"));
const ServicesPage = lazy(() => import("./pages/Service"));
const CareersPage = lazy(() => import("./pages/Careers"));
const ContactPage = lazy(() => import("./pages/Contact"));
const LoginPage = lazy(() => import("./pages/Login"));
const ForgotPassword = lazy(() => import("./pages/ForgetPassword"));
const CustomerRegistration = lazy(() => import("./pages/Customer/Customer-Register"));
const ProviderRegistration = lazy(() => import("./pages/Provider/Provider-Register"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
import LoadingSpinner from "./components/Loader";
import RefundPolicy from "./pages/RefundPolicy";

// Routes (Optimized: Lazy loaded)
const AdminRoutes = lazy(() => import("./routes/AdminRoutes"));
const CustomerRoutes = lazy(() => import("./routes/CustomerRoutes"));
const ProviderRoutes = lazy(() => import("./routes/ProviderRoutes"));

import * as SystemService from "./services/SystemService";
import {
  SYSTEM_SETTINGS_CACHE_KEY,
  SYSTEM_SETTINGS_UPDATED_EVENT,
  getCachedTimeFormat,
  normalizeTimeFormat,
  readCachedSystemSettings,
  readSystemSettingsCache,
  writeSystemSettingsCache,
} from "./utils/systemSettingsCache";

const DATE_TIME_FORMAT_OVERRIDE_KEY = "__safevoltTimeFormatOverrideInstalled";

const withConfiguredTimeFormat = (options) => {
  if (options === null) return options;

  return {
    ...(options || {}),
    hour12: getCachedTimeFormat() === "12h",
  };
};

const installDateTimeFormatOverrides = () => {
  if (Date.prototype[DATE_TIME_FORMAT_OVERRIDE_KEY]) return;

  const nativeToLocaleString = Date.prototype.toLocaleString;
  const nativeToLocaleTimeString = Date.prototype.toLocaleTimeString;

  Object.defineProperty(Date.prototype, DATE_TIME_FORMAT_OVERRIDE_KEY, {
    value: true,
    configurable: false,
    enumerable: false,
  });

  Date.prototype.toLocaleString = function (locales, options) {
    return nativeToLocaleString.call(this, locales, withConfiguredTimeFormat(options));
  };

  Date.prototype.toLocaleTimeString = function (locales, options) {
    return nativeToLocaleTimeString.call(this, locales, withConfiguredTimeFormat(options));
  };
};

installDateTimeFormatOverrides();

const updateFavicon = (favicon) => {
  if (!favicon) return;

  const faviconLink = document.querySelector("link[rel='icon']");
  if (faviconLink) {
    faviconLink.href = favicon;
    return;
  }

  const newFavicon = document.createElement("link");
  newFavicon.rel = "icon";
  newFavicon.href = favicon;
  document.head.appendChild(newFavicon);
};

const applyDocumentSettings = (settings) => {
  if (settings.companyName) {
    document.title = settings.companyName;
  }

  updateFavicon(settings.favicon);
};

const App = () => {
  const location = useLocation();
  const [systemSettings, setSystemSettings] = useState({
    companyName: "",
    favicon: null,
    timeFormat: getCachedTimeFormat(),
  });

  // Check if current route is a protected/dashboard route (Optimized: memoized)
  const isDashboardRoute = React.useMemo(() =>
    /^\/(admin|customer|provider)/.test(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    document.documentElement.dataset.timeFormat = systemSettings.timeFormat;
  }, [systemSettings.timeFormat]);

  useEffect(() => {
    const handleSystemSettingsUpdated = (event) => {
      const updatedSettings = event?.detail || readCachedSystemSettings();
      const normalizedSettings = {
        ...updatedSettings,
        timeFormat: normalizeTimeFormat(updatedSettings?.timeFormat),
      };

      setSystemSettings(prev => ({ ...prev, ...normalizedSettings }));
      applyDocumentSettings(normalizedSettings);
    };

    const handleStorageUpdate = (event) => {
      if (event.key && event.key !== SYSTEM_SETTINGS_CACHE_KEY) return;
      handleSystemSettingsUpdated();
    };

    window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSystemSettingsUpdated);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, handleSystemSettingsUpdated);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  // Fetch system settings and update document title and favicon with caching
  useEffect(() => {
    const fetchSystemSettings = async () => {
      const cachedSettings = readSystemSettingsCache();
      const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

      if (cachedSettings) {
        const { data, timestamp } = cachedSettings;
        if (Date.now() - timestamp < cacheExpiry) {
          setSystemSettings(data);
          applyDocumentSettings(data);
          return;
        }
      }

      try {
        const response = await SystemService.getSystemSetting();
        if (response.data?.success) {
          const data = response.data.data;
          const settings = {
            companyName: data?.companyName || "SAFEVOLT SOLUTIONS",
            favicon: data?.favicon || null,
            timeFormat: normalizeTimeFormat(data?.timeFormat),
          };
          setSystemSettings(settings);

          // Cache the settings
          writeSystemSettingsCache(settings);

          // Update document title
          applyDocumentSettings(settings);
        }
      } catch (error) {
        console.error("Error fetching system settings:", error);
      }
    };

    fetchSystemSettings();
  }, []);

  const { isDeepLink, setIsDeepLink, isAuthenticated, role: userRole, isAdmin, setIntendedRoute, resetDeepLink, user } = useAuth();
  const navigate_fn = useNavigate();

  // 🔄 AUTO-REDIRECT: If logged-in, don't show Home/Login page
  useEffect(() => {
    // Only redirect if they land on public "/" route
    if (isAuthenticated && location.pathname === "/") {
      if (userRole === 'admin' || user?.isAdmin) {
        navigate_fn('/admin/dashboard', { replace: true });
      } else if (userRole === 'provider') {
        navigate_fn('/provider/dashboard', { replace: true });
      } else {
        navigate_fn('/customer/services', { replace: true });
      }
    }
  }, [isAuthenticated, userRole, user, location.pathname, navigate_fn]);

  // 🔔 Handle Cold Start Deep Linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route');
    const role = params.get('role');

    if (route) {
      setIsDeepLink(true);

      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);

      if (!isAuthenticated) {
        setIntendedRoute(route);
        navigate_fn('/login');
        return;
      }

      if (role && role !== userRole && !(role === 'admin' && isAdmin)) {
        if (userRole === 'admin' || isAdmin) navigate_fn('/admin/dashboard');
        else if (userRole === 'provider') navigate_fn('/provider/dashboard');
        else navigate_fn('/customer/services');
        return;
      }

      navigate_fn(route, { state: { fromNotification: true } });
    }
  }, [isAuthenticated, userRole, isAdmin, navigate_fn, setIsDeepLink, setIntendedRoute]);

  // 🔄 Reset deep link state on manual navigation
  useEffect(() => {
    if (!location.state?.fromNotification) {
      resetDeepLink?.();
    }
  }, [location.pathname, location.state, resetDeepLink]);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Hide Navbar on deep link if authenticated as per requirements */}
      {(!isDashboardRoute && !(isDeepLink && isAuthenticated)) && <Navbar />}

      <SocketProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/register" element={<CustomerRegistration />} />
          <Route path="/register-provider" element={<ProviderRegistration />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          {/*Protected admin routes */}

          <Route path="admin/*" element={<AdminRoutes />} />


          {/* Protected customer routes */}
          <Route path="customer/*" element={<CustomerRoutes />} />

          {/* Protected provider routes */}
          <Route path="provider/*" element={<ProviderRoutes />} />


          {/* 404 Not Found Route - should be last */}
          <Route path="*" element={<Home />} />
        </Routes>
      </SocketProvider>

      {/* Show Footer for public routes and customer dashboard */}
      {(!isDashboardRoute || location.pathname === '/customer/services') && <Footer />}
    </Suspense>
  );
};

export default App;
