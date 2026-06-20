import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";
import "./index.css";
import { useAuth } from "./context/auth";
import AppInstall from "./components/AppInstall";

// Components
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { SocketProvider } from "./socket/SocketContext";

// Public Pages (Optimized: Lazy loaded with retry)
const Home = lazyWithRetry(() => import("./pages/Home"));
const AboutPage = lazyWithRetry(() => import("./pages/About"));
const ServicesPage = lazyWithRetry(() => import("./pages/Service"));
const CareersPage = lazyWithRetry(() => import("./pages/Careers"));
const ContactPage = lazyWithRetry(() => import("./pages/Contact"));
const LoginPage = lazyWithRetry(() => import("./pages/Login"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgetPassword"));
const CustomerRegistration = lazyWithRetry(() => import("./pages/Customer/Customer-Register"));
const ProviderRegistration = lazyWithRetry(() => import("./pages/Provider/Provider-Register"));
const Unauthorized = lazyWithRetry(() => import("./pages/Unauthorized"));
const TermsAndConditions = lazyWithRetry(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

import LoadingSpinner from "./components/ui-skeletons/Loader";
import RefundPolicy from "./pages/RefundPolicy";

// Lazy-load wrapper: auto-reloads page once on chunk load failure (stale deployment)
function lazyWithRetry(importFn) {
  return lazy(() =>
    importFn().catch((error) => {
      // Chunk load failed — likely a new deployment invalidated old hashes
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', 'true');
        window.location.reload();
        return new Promise(() => { }); // Never resolves — page is reloading
      }
      sessionStorage.removeItem('chunk_reload');
      throw error; // If reload didn't fix it, throw original error
    })
  );
}


// Clear the reload flag on successful page load
if (sessionStorage.getItem('chunk_reload')) {
  sessionStorage.removeItem('chunk_reload');
}

const AdminRoutes = lazyWithRetry(() => import("./routes/AdminRoutes"));
const CustomerRoutes = lazyWithRetry(() => import("./routes/CustomerRoutes"));
const ProviderRoutes = lazyWithRetry(() => import("./routes/ProviderRoutes"));


import {
  getCachedTimeFormat,
} from "./utils/systemSettingsCache";

const DATE_TIME_FORMAT_OVERRIDE_KEY = "__rajelectricalTimeFormatOverrideInstalled";

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

  const links = document.querySelectorAll("link[rel*='icon']");
  if (links.length > 0) {
    links.forEach(link => {
      link.removeAttribute("type");
      link.href = favicon;
    });
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

  if (settings.shortName) {
    const appleTitle = document.querySelector("meta[name='apple-mobile-web-app-title']");
    if (appleTitle) {
      appleTitle.setAttribute("content", settings.shortName);
    } else {
      const meta = document.createElement("meta");
      meta.name = "apple-mobile-web-app-title";
      meta.content = settings.shortName;
      document.head.appendChild(meta);
    }
  }

  if (settings.description) {
    const metaDesc = document.querySelector("meta[name='description']");
    if (metaDesc) metaDesc.setAttribute("content", settings.description);

    const ogDesc = document.querySelector("meta[property='og:description']");
    if (ogDesc) ogDesc.setAttribute("content", settings.description);
  }

  if (settings.favicon) {
    updateFavicon(settings.favicon);
  }

  if (settings.icon) {
    const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleIcon) {
      appleIcon.setAttribute("href", settings.icon);
    } else {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.href = settings.icon;
      document.head.appendChild(link);
    }
  }

  if (settings.splashScreen) {
    const appleSplash = document.querySelector("link[rel='apple-touch-startup-image']");
    if (appleSplash) {
      appleSplash.setAttribute("href", settings.splashScreen);
    } else {
      const link = document.createElement("link");
      link.rel = "apple-touch-startup-image";
      link.href = settings.splashScreen;
      document.head.appendChild(link);
    }
  }

  if (settings.manifestUrl) {
    let manifestLink = document.querySelector("link[rel='manifest']");
    if (manifestLink) {
      manifestLink.setAttribute("href", settings.manifestUrl);
    } else {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = settings.manifestUrl;
      document.head.appendChild(manifestLink);
    }
  }
};
const generateManifestUrl = (role, data) => {
  const apiBase = import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api");
  const version = data?.appVersion || data?.updatedAt || Date.now();
  return `${apiBase}/system-setting/settings/branding/${role}/manifest?v=${version}&origin=${encodeURIComponent(window.location.origin)}`;
};

const App = () => {
  const loc = useLocation();
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [updateNotes, setUpdateNotes] = useState('');
  const reloadTimerRef = useRef(null);

  // Scroll to top on pathname change (Scroll Restoration)
  useEffect(() => {
    if (!loc.hash) {
      window.scrollTo(0, 0);
    }
  }, [loc.pathname, loc.hash]);

  const triggerCacheClearAndPrompt = async (data) => {
    console.log('[PWA Update] Triggering asset clear and upgrade flow...');

    // 1. Invalidate caches
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        console.log('[PWA Update] Browser caches cleared successfully.');
      } catch (err) {
        console.error('[PWA Update] Cache clear error:', err);
      }
    }

    // 2. Clear role branding local storage
    const roles = ['customer', 'provider', 'admin'];
    roles.forEach(r => localStorage.removeItem(`branding_${r}`));

    // 3. Clear service worker version markers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      } catch (swErr) {
        console.error('[PWA Update] SW registration update failed:', swErr);
      }
    }

    // 4. Force refresh prompt or soft update
    const isHardUpdate = data?.forceRefresh === 'true' || data?.forceRefresh === true || data?.forceRefresh === 'force';
    if (isHardUpdate) {
      setUpdateNotes(data?.body || data?.releaseNotes || 'New update installed. Reload now.');
      setShowUpdatePrompt(true);
    } else {
      reloadTimerRef.current = setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  useEffect(() => {
    const handleUpdateReceived = (e) => {
      triggerCacheClearAndPrompt(e.detail);
    };
    window.addEventListener('appUpdateReceived', handleUpdateReceived);
    return () => window.removeEventListener('appUpdateReceived', handleUpdateReceived);
  }, []);

  // Cleanup reload timer on unmount to prevent memory leaks
  useEffect(() => {
    const timer = reloadTimerRef.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const {
    isDeepLink,
    setIsDeepLink,
    isAuthenticated,
    role: userRole,
    isAdmin,
    setIntendedRoute,
    resetDeepLink,
    user,
    systemSettings: globalSettings,
    activeBranding
  } = useAuth();

  const [showSplash, setShowSplash] = useState(() => {
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);
    return !!(isStandalone && !sessionStorage.getItem('splash_shown'));
  });
  const [splashFade, setSplashFade] = useState(false);

  // Check if current route is a protected/dashboard route (Optimized: memoized)
  const isDashboardRoute = React.useMemo(() =>
    /^\/(admin|customer|provider)/.test(loc.pathname),
    [loc.pathname]
  );

  useEffect(() => {
    if (globalSettings?.timeFormat) {
      document.documentElement.dataset.timeFormat = globalSettings.timeFormat;
    }
  }, [globalSettings?.timeFormat]);

  // Session-based Splash Screen check (PWA only, 2-3 seconds duration)
  useEffect(() => {
    if (showSplash) {
      const fadeTimeout = setTimeout(() => {
        setSplashFade(true);
      }, 2500);
      const removeTimeout = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('splash_shown', 'true');
      }, 3000);
      return () => {
        clearTimeout(fadeTimeout);
        clearTimeout(removeTimeout);
      };
    }
  }, [showSplash]);

  // Fetch dynamic branding settings and apply dynamically based on current route context
  useEffect(() => {
    // Detect standalone display mode and persist install role if missing
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone && !localStorage.getItem("installRole")) {
      const detectedRole = loc.pathname.startsWith("/provider") ? "provider" : "customer";
      localStorage.setItem("installRole", detectedRole);
      localStorage.setItem("installMode", "standalone");
    }

    let currentRole = null;
    if (loc.pathname.startsWith("/admin")) {
      currentRole = "admin";
    } else if (loc.pathname.startsWith("/provider")) {
      currentRole = "provider";
    } else if (loc.pathname.startsWith("/customer")) {
      currentRole = "customer";
    } else if (isAuthenticated && userRole) {
      currentRole = userRole;
    } else {
      currentRole = localStorage.getItem("installRole");
      if (!currentRole || !["customer", "provider", "admin"].includes(currentRole)) {
        currentRole = "customer";
      }
    }

    const manifestUrl = generateManifestUrl(currentRole, activeBranding);
    // Favicon sequence: globalSettings.favicon -> activeBranding.favicon -> activeBranding.icon -> activeBranding.logo -> globalSettings.logo -> fallback -> favicon.ico
    const resolvedFavicon = globalSettings?.favicon || activeBranding?.favicon || activeBranding?.icon || activeBranding?.logo || globalSettings?.logo || "/icon-192.png";

    const settings = {
      companyName: activeBranding?.browserTitle || activeBranding?.appName || globalSettings?.companyName || "Raj Electrical Service",
      shortName: activeBranding?.shortName || globalSettings?.companyName || "Raj Service",
      favicon: resolvedFavicon,
      description: activeBranding?.description || globalSettings?.tagline || "",
      manifestUrl: manifestUrl,
      icon: activeBranding?.icon || activeBranding?.logo || globalSettings?.logo || "/icon-192.png",
      splashScreen: globalSettings?.customerBranding?.splashScreen || activeBranding?.splashScreen || null
    };

    applyDocumentSettings(settings);
  }, [globalSettings, activeBranding, loc.pathname, isAuthenticated, userRole]);

  // PWA version update check
  useEffect(() => {
    let timer;
    let currentRole = null;
    if (loc.pathname.startsWith("/admin")) {
      currentRole = "admin";
    } else if (loc.pathname.startsWith("/provider")) {
      currentRole = "provider";
    } else if (loc.pathname.startsWith("/customer")) {
      currentRole = "customer";
    } else if (isAuthenticated && userRole) {
      currentRole = userRole;
    } else {
      currentRole = localStorage.getItem("installRole");
      if (!currentRole || !["customer", "provider", "admin"].includes(currentRole)) {
        currentRole = "customer";
      }
    }

    const serverVersion = activeBranding?.appVersion;
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

        timer = setTimeout(() => {
          window.location.reload();
        }, 800);
        reloadTimerRef.current = timer;
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeBranding, loc.pathname, isAuthenticated, userRole]);

  const navigate_fn = useNavigate();

  // 🔄 AUTO-REDIRECT: If logged-in, don't show Home/Login page
  useEffect(() => {
    // Only redirect if they land on public "/" route
    if (isAuthenticated && loc.pathname === "/") {
      if (userRole === 'admin' || user?.isAdmin) {
        navigate_fn('/admin/dashboard', { replace: true });
      } else if (userRole === 'provider') {
        navigate_fn('/provider/dashboard', { replace: true });
      } else {
        navigate_fn('/customer/services', { replace: true });
      }
    }
  }, [isAuthenticated, userRole, user, loc.pathname, navigate_fn]);

  // 🔔 Handle Cold Start Deep Linking & PWA Update Redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const route = params.get('route');
    const role = params.get('role');
    const entityId = params.get('entityId');
    const updateType = params.get('updateType');
    const forceRefresh = params.get('forceRefresh');

    if (updateType === 'app_update' || updateType === 'branding_update' || forceRefresh === 'true') {
      // Clear URL params to avoid loops
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
      console.log('[PWA Cold Start] Branding or app update detected. Initializing clear...');
      triggerCacheClearAndPrompt({
        forceRefresh: forceRefresh || 'true',
        body: params.get('body') || params.get('releaseNotes') || 'New update installed. Reload now.'
      });
      return;
    }

    const installTarget = params.get('install');
    if (installTarget && ['customer', 'provider'].includes(installTarget)) {
      // Clear URL params to avoid loops
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);

      localStorage.setItem("installMode", "standalone");
      localStorage.setItem("installRole", installTarget);
      
      // Dispatch trigger PWA install event after a brief delay to let page mount
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('triggerPwaInstall', {
          detail: { role: installTarget }
        }));
      }, 800);
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
    if (!loc.state?.fromNotification) {
      resetDeepLink?.();
    }
  }, [loc.pathname, loc.state, resetDeepLink]);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* 🌟 Dynamic In-App Splash Screen Overlay */}
      {showSplash && (
        <div
          className={`fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-white transition-all duration-500 ease-in-out ${splashFade ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
          {(globalSettings?.customerBranding?.splashScreen || activeBranding?.splashScreen) ? (
            <img
              src={globalSettings?.customerBranding?.splashScreen || activeBranding?.splashScreen}
              alt="Loading Application..."
              className="w-full h-full object-cover animate-fade-in"
            />
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in">
              <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-inter tracking-tight">
                {globalSettings?.companyName || "Raj Electrical Service"}
              </h1>
              <div className="w-12 h-1 bg-gradient-to-r from-primary to-accent rounded-full animate-pulse" />
            </div>
          )}
        </div>
      )}

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

      {/* 🔔 Premium Hard Update Reload Prompt Banner Dialog */}
      {showUpdatePrompt && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] w-[92%] max-w-md bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 animate-in slide-in-from-top-6 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center flex-shrink-0 text-teal-400">
              <FiRefreshCw className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-black uppercase tracking-wider text-teal-400">PWA System Update</span>
              <p className="text-[10.5px] text-slate-300 leading-tight font-medium">
                {updateNotes || "New update installed. Reload now."}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex-shrink-0 whitespace-nowrap active:scale-95"
          >
            Reload Now
          </button>
        </div>
      )}
      <AppInstall />
    </Suspense>
  );
};

export default App;
