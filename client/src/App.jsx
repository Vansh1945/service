import React, { useEffect, useState, Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
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

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Only show Navbar for public routes */}
      {!isDashboardRoute && <Navbar />}

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

      {/* Only show Footer for public routes */}
      {!isDashboardRoute && <Footer />}
    </Suspense>
  );
};

export default App;