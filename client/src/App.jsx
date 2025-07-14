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
import ProviderList from "./pages/Admin/Approved-Provider";
import AdminProvidersPage from "./pages/Admin/Providers";
import AdminCustomersView from "./pages/Admin/Customer";
import AdminBookingsView from "./pages/Admin/Bookings";
import AdminBookingsPage from "./pages/Admin/AssignBooking";
import AdminCommissionPage from "./pages/Admin/Commision";
import AdminCoupons from "./pages/Admin/Coupon";
import AdminQuestions from "./pages/Admin/Question";
import AdminServices from "./pages/Admin/Services";
import AdminComplaints from "./pages/Admin/Complaint";
import AdminServiceFeedback from "./pages/Admin/Feedback";
import AdminInvoice from "./pages/Admin/Invoice";
import AdminEarnings from "./pages/Admin/Earning";
import AdminProfile from "./pages/Admin/Profile";
import AdminDashboard from "./pages/Admin/Dashboard";
import ProviderBookingsPage from "./pages/Provider/Provider-Booking";
import ProviderInvoicesPage from "./pages/Provider/Invoice";
import ProviderEarning from "./pages/Provider/Earning";
import ProviderDashboard from "./pages/Provider/Dashboard";
import ProviderTestPage from "./pages/Provider/Test";
import CustomerDashboard from "./pages/Customer/Dashboard";
import ServiceBooking from "./pages/Customer/Service-Booking";
import ServiceListingPage from "./pages/Customer/Services";
import ServiceDetailPage from "./pages/Customer/Servicedetail";
import UserProfile from "./pages/Customer/Profile";
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
          <Route path="admin" element={<AdminLayout />}>
            <Route path="profile" element={<AdminProfile />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="approve-providers" element={<ProviderList />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="customers" element={<AdminCustomersView />} />
            <Route path="bookings" element={<AdminBookingsView />} />
            <Route path="assign-booking" element={<AdminBookingsPage />} />
            <Route path="commission" element={<AdminCommissionPage />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="add-question" element={<AdminQuestions />} />
            <Route path="add-services" element={<AdminServices />} />
            <Route path="complaint" element={<AdminComplaints />} />
            <Route path="feedback" element={<AdminServiceFeedback />} />
            <Route path="invoice" element={<AdminInvoice />} />
            <Route path="earning" element={<AdminEarnings />} />

          </Route>
        </Route>


        {/* Protected customer routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route path="customer" element={<CustomerLayout />}>
            <Route path="profile" element={<UserProfile />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="services" element={<ServiceListingPage />} />
            <Route path="service-detail" element={<ServiceDetailPage />} />

            <Route path="book-service" element={<ServiceBooking />} />
          </Route>
        </Route>

        {/* Protected provider routes - requires approval */}
        <Route element={<ProtectedRoute allowedRoles={['provider']} requireApproval />}>
          <Route path="/provider" element={<ProviderLayout />}>
            <Route path="dashboard" element={<ProviderDashboard />} />
            <Route path="booking-requests" element={<ProviderBookingsPage />} />
            <Route path="test" element={<ProviderTestPage />} />
            <Route path="invoice-creator" element={<ProviderInvoicesPage />} />
            <Route path="earnings" element={<ProviderEarning />} />
          </Route>
        </Route>

      </Routes>

      {/* Only show Footer for public routes */}
      {!isDashboardRoute && <Footer />}
    </>
  );
};

export default App;