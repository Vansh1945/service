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
const CustomerRegistration = lazy(() => import("./pages/Customer-Register"));
const ProviderRegistration = lazy(() => import("./pages/Provider-Register"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
import LoadingSpinner from "./components/Loader";

// Routes (Optimized: Lazy loaded)
const AdminRoutes = lazy(() => import("./routes/AdminRoutes"));
const CustomerRoutes = lazy(() => import("./routes/CustomerRoutes"));
const ProviderRoutes = lazy(() => import("./routes/ProviderRoutes"));

const App = () => {
  const location = useLocation();
  const { API } = useAuth();
  const [systemSettings, setSystemSettings] = useState({
    companyName: "",
    favicon: null,
  });

  // Check if current route is a protected/dashboard route (Optimized: memoized)
  const isDashboardRoute = React.useMemo(() =>
    /^\/(admin|customer|provider)/.test(location.pathname),
    [location.pathname]
  );

  // Fetch system settings and update document title and favicon with caching
  useEffect(() => {
    const fetchSystemSettings = async () => {
      const cacheKey = 'systemSettings';
      const cachedSettings = localStorage.getItem(cacheKey);
      const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

      if (cachedSettings) {
        const { data, timestamp } = JSON.parse(cachedSettings);
        if (Date.now() - timestamp < cacheExpiry) {
          setSystemSettings(data);
          document.title = data.companyName;
          if (data.favicon) {
            const faviconLink = document.querySelector("link[rel='icon']");
            if (faviconLink) {
              faviconLink.href = data.favicon;
            } else {
              const newFavicon = document.createElement("link");
              newFavicon.rel = "icon";
              newFavicon.href = data.favicon;
              document.head.appendChild(newFavicon);
            }
          }
          return;
        }
      }

      try {
        const response = await fetch(`${API}/system-setting/system-data`);
        if (response.ok) {
          const data = await response.json();
          const settings = {
            companyName: data.data?.companyName || "SAFEVOLT SOLUTIONS",
            favicon: data.data?.favicon || null,
          };
          setSystemSettings(settings);

          // Cache the settings
          localStorage.setItem(cacheKey, JSON.stringify({ data: settings, timestamp: Date.now() }));

          // Update document title
          document.title = settings.companyName;

          // Update favicon
          if (settings.favicon) {
            const faviconLink = document.querySelector("link[rel='icon']");
            if (faviconLink) {
              faviconLink.href = settings.favicon;
            } else {
              const newFavicon = document.createElement("link");
              newFavicon.rel = "icon";
              newFavicon.href = settings.favicon;
              document.head.appendChild(newFavicon);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching system settings:", error);
      }
    };

    fetchSystemSettings();
  }, [API]);

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
      {location.pathname === '/customer/services' && <Footer />}
    </Suspense>
  );
};

export default App;