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
const NotFound = lazy(() => import("./pages/NotFound"));
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
    
    // Update Open Graph and Twitter SEO titles
    const ogTitle = document.querySelector("meta[property='og:title']");
    if (ogTitle) ogTitle.setAttribute("content", settings.companyName);
    
    const twitterTitle = document.querySelector("meta[name='twitter:title']");
    if (twitterTitle) twitterTitle.setAttribute("content", settings.companyName);
  }

  if (settings.description) {
    const metaDesc = document.querySelector("meta[name='description']");
    if (metaDesc) metaDesc.setAttribute("content", settings.description);
    
    const ogDesc = document.querySelector("meta[property='og:description']");
    if (ogDesc) ogDesc.setAttribute("content", settings.description);
  }

  if (settings.themeColor) {
    // Meta tag
    const metaTheme = document.querySelector("meta[name='theme-color']");
    if (metaTheme) metaTheme.setAttribute("content", settings.themeColor);
    
    // Dynamically apply primary color styles so buttons, layouts, and components instantly adapt!
    document.documentElement.style.setProperty('--color-primary', settings.themeColor);
    document.documentElement.style.setProperty('--primary', settings.themeColor);
  }

  if (settings.favicon) {
    updateFavicon(settings.favicon);
  }

  if (settings.manifestUrl) {
    const manifestLink = document.querySelector("link[rel='manifest']");
    if (manifestLink) {
      manifestLink.setAttribute("href", settings.manifestUrl);
    }
  }
};
const generateManifestDataUri = (role, data) => {
  const appName = data?.appName || (role === 'admin' ? 'SafeVolt Admin' : role === 'provider' ? 'SafeVolt Provider' : 'SafeVolt Customer');
  const shortName = data?.shortName || (role === 'admin' ? 'Admin' : role === 'provider' ? 'Provider' : 'SafeVolt');
  const description = data?.description || (role === 'admin' ? 'SafeVolt Control Panel' : `${shortName} App`);
  const themeColor = data?.themeColor || (role === 'admin' ? '#4f46e5' : role === 'provider' ? '#10b981' : '#3b82f6');
  const backgroundColor = data?.backgroundColor || '#ffffff';
  const icon = data?.icon || data?.logo || '/icon-192.png';

  const manifestObj = {
    name: appName,
    short_name: shortName,
    start_url: role === 'admin' ? '/admin/dashboard' : role === 'provider' ? '/provider/dashboard' : '/',
    display: "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait",
    icons: [
      {
        src: icon,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: data?.splashScreen || icon,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    description: description,
    id: `com.safevolt.${role}`
  };

  try {
    const manifestStr = JSON.stringify(manifestObj);
    return 'data:application/manifest+json;base64,' + btoa(unescape(encodeURIComponent(manifestStr)));
  } catch (e) {
    console.error('Failed to generate base64 manifest Data URI:', e);
    return '/manifest.json';
  }
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

  // Fetch dynamic branding settings and apply dynamically based on current route context
  useEffect(() => {
    let currentRole = "customer";
    if (location.pathname.startsWith("/admin")) {
      currentRole = "admin";
    } else if (location.pathname.startsWith("/provider")) {
      currentRole = "provider";
    }

    const fetchBranding = async () => {
      try {
        const cached = localStorage.getItem(`branding_${currentRole}`);
        if (cached) {
          const brandingData = JSON.parse(cached);
          applyBrandingData(currentRole, brandingData);
        }

        const response = await SystemService.getBrandingSettings(currentRole);
        if (response.data?.success) {
          const brandingData = response.data.data;
          localStorage.setItem(`branding_${currentRole}`, JSON.stringify(brandingData));
          applyBrandingData(currentRole, brandingData);

          // PWA Check: Compare local version with server version
          const serverVersion = brandingData.appVersion;
          if (serverVersion) {
            const localVersionKey = `app_version_${currentRole}`;
            const localVersion = parseInt(localStorage.getItem(localVersionKey) || '1', 10);
            
            if (serverVersion > localVersion) {
              console.log(`[PWA Update] Server version ${serverVersion} is newer than local version ${localVersion}. Upgrading...`);
              
              localStorage.setItem(localVersionKey, serverVersion.toString());
              
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                  for (const registration of registrations) {
                    registration.update().catch(err => console.error('SW update failed:', err));
                    if (registration.waiting) {
                      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    } else if (registration.active) {
                      registration.active.postMessage({ type: 'SKIP_WAITING' });
                    }
                  }
                });
              }
              
              setTimeout(() => {
                window.location.reload();
              }, 800);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching dynamic branding:", error);
      }
    };

    const applyBrandingData = (role, data) => {
      const manifestUrl = generateManifestDataUri(role, data);
      
      // Favicon cache bust timestamp
      const faviconUrl = data?.favicon || data?.logo || null;
      const busterFavicon = faviconUrl ? `${faviconUrl}?v=${data?.updatedAt || Date.now()}` : null;

      const settings = {
        companyName: data?.appName || (role === 'admin' ? 'SafeVolt Admin' : role === 'provider' ? 'SafeVolt Provider' : 'SafeVolt Customer'),
        favicon: busterFavicon,
        description: data?.description || "",
        themeColor: data?.themeColor || (role === 'admin' ? '#4f46e5' : role === 'provider' ? '#10b981' : '#3b82f6'),
        manifestUrl: manifestUrl
      };

      setSystemSettings(prev => ({
        ...prev,
        companyName: settings.companyName,
        favicon: settings.favicon
      }));

      applyDocumentSettings(settings);

      // Notify any listening components
      window.dispatchEvent(new CustomEvent("brandingUpdated", { detail: { role, data } }));
    };

    fetchBranding();
  }, [location.pathname]);

  // Live branding listener to apply instant changes when saving settings
  useEffect(() => {
    const handleBrandingChange = (e) => {
      let currentRole = "customer";
      if (location.pathname.startsWith("/admin")) {
        currentRole = "admin";
      } else if (location.pathname.startsWith("/provider")) {
        currentRole = "provider";
      }

      if (e.detail?.role === currentRole) {
        const data = e.detail.data;
        const manifestUrl = generateManifestDataUri(currentRole, data);

        const faviconUrl = data?.favicon || data?.logo || null;
        const busterFavicon = faviconUrl ? `${faviconUrl}?v=${Date.now()}` : null;

        applyDocumentSettings({
          companyName: data?.appName || (currentRole === 'admin' ? 'SafeVolt Admin' : currentRole === 'provider' ? 'SafeVolt Provider' : 'SafeVolt Customer'),
          favicon: busterFavicon,
          description: data?.description || "",
          themeColor: data?.themeColor || "",
          manifestUrl: manifestUrl
        });
      }
    };
    window.addEventListener("brandingUpdated", handleBrandingChange);
    return () => window.removeEventListener("brandingUpdated", handleBrandingChange);
  }, [location.pathname]);

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

  // 🔔 Handle Cold Start Deep Linking & PWA Update Redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route');
    const role = params.get('role');
    const entityId = params.get('entityId');
    const updateType = params.get('updateType');
    const forceRefresh = params.get('forceRefresh');

    if (updateType === 'branding_update' || forceRefresh === 'true') {
      // Clear URL params to avoid loops
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
      console.log('[PWA Cold Start] Branding update detected. Reloading...');
      window.location.reload();
      return;
    }

    if (route) {
      setIsDeepLink(true);

      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);

      const targetRouteWithEntity = route + (entityId ? (route.includes('?') ? '&' : '?') + 'entityId=' + entityId : '');

      if (!isAuthenticated) {
        setIntendedRoute(targetRouteWithEntity);
        navigate_fn('/login');
        return;
      }

      if (role && role !== userRole && !(role === 'admin' && isAdmin)) {
        if (userRole === 'admin' || isAdmin) navigate_fn('/admin/dashboard');
        else if (userRole === 'provider') navigate_fn('/provider/dashboard');
        else navigate_fn('/customer/services');
        return;
      }

      navigate_fn(targetRouteWithEntity, { state: { fromNotification: true } });
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SocketProvider>

      {/* Show Footer for public routes and customer dashboard */}
      {(!isDashboardRoute || location.pathname === '/customer/services') && <Footer />}
    </Suspense>
  );
};

export default App;
