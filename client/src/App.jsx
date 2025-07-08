import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import "./index.css";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Footer from "./components/Footer";
import AboutPage from "./pages/About";
import ServicesPage from "./pages/Service";
import CareersPage from "./pages/Careers";
import ContactPage from "./pages/Contact";
import LoginPage from "./pages/Login";
import ForgotPassword from "./pages/ForgetPassword";
import CustomerRegistration from "./pages/Customer-Register";
import ProviderRegistration from "./pages/Provider-Register";
import AdminLayout from "./components/AdminLayout";
import CustomerLayout from "./components/CustomerLayout";
import ProviderLayout from "./components/ProviderLayout";
import ProtectedRoute from "./components/ProtectedRoute";
// import AdminRegistration from "./pages/Admin/Admin-Register";

const App = () => {
  const location = useLocation();
  
  // Check if current route is a protected/dashboard route
  const isDashboardRoute = location.pathname.startsWith('/admin') || 
                          location.pathname.startsWith('/customer') || 
                          location.pathname.startsWith('/provider');

  return (
    <>
      {/* Only show Navbar for public routes */}
      {!isDashboardRoute && <Navbar />}
      
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/register" element={<CustomerRegistration />} />
        <Route path="/provider-register" element={<ProviderRegistration />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      
              {/* <Route path="/admin-register" element={<AdminRegistration />} /> */}


        {/* Protected admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin/*" element={<AdminLayout />} />
        </Route>

        {/* Protected customer routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route path="/customer/*" element={<CustomerLayout />} />
        </Route>

        {/* Protected provider routes - requires approval */}
        <Route element={<ProtectedRoute allowedRoles={['provider']} requireApproval />}>
          <Route path="/provider/*" element={<ProviderLayout />} />
        </Route>
      </Routes>
      
      {/* Only show Footer for public routes */}
      {!isDashboardRoute && <Footer />}
    </>
  );
};

export default App;