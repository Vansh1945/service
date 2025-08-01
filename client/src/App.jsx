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

// Admin Pages
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

// Provider Pages
import ProviderBookingsPage from "./pages/Provider/Provider-Booking";
import ProviderInvoicesPage from "./pages/Provider/Invoice";
import ProviderEarning from "./pages/Provider/Earning";
import ProviderDashboard from "./pages/Provider/Dashboard";
import ProviderTestPage from "./pages/Provider/Test";

// Customer Pages
import CustomerDashboard from "./pages/Customer/Dashboard";
import ServiceBooking from "./pages/Customer/Service-Booking";
import ServiceListingPage from "./pages/Customer/Services";
import ServiceDetailPage from "./pages/Customer/Servicedetail";
import UserProfile from "./pages/Customer/Profile";
import PaymentPage from "./pages/Customer/Payments";
import CustomerFeedbackPage from "./pages/Customer/Feedback";
import BookService from "./pages/Customer/Book-Service";
import BookingConfirmation from "./pages/Customer/BookingConfirmation";
import CartPage from "./pages/Customer/Cart";

const App = () => {
  const location = useLocation();

  // Check if current route is a protected/dashboard route
  const isDashboardRoute = /^\/(admin|customer|provider)/.test(location.pathname);

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

        {/* Protected admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="approve-providers" element={<ProviderList />} />
            <Route path="providers" element={<AdminProvidersPage />} />
            <Route path="customers" element={<AdminCustomersView />} />
            <Route path="bookings" element={<AdminBookingsView />} />
            <Route path="assign-booking" element={<AdminBookingsPage />} />
            <Route path="commission" element={<AdminCommissionPage />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="questions" element={<AdminQuestions />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="complaints" element={<AdminComplaints />} />
            <Route path="feedback" element={<AdminServiceFeedback />} />
            <Route path="invoices" element={<AdminInvoice />} />
            <Route path="earnings" element={<AdminEarnings />} />
          </Route>
        </Route>

        {/* Protected customer routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route path="/customer" element={<CustomerLayout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="services" element={<ServiceListingPage />} />
            {/* service in detail */}
            <Route path="services/:id" element={<ServiceDetailPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="book-service/:serviceId" element={<BookService />} />
            <Route path="payments/:bookingId" element={<PaymentPage />} />

            {/* <Route path="booking-confirmation/:id" element={<BookingConfirmation />} />
            <Route path="payments" element={<PaymentPage />} />
            <Route path="feedback" element={<CustomerFeedbackPage />} /> */}
          </Route>
        </Route>

        {/* Protected provider routes */}
        <Route element={<ProtectedRoute allowedRoles={['provider']} requireApproval />}>
          <Route path="/provider" element={<ProviderLayout />}>
            <Route index element={<ProviderDashboard />} />
            <Route path="dashboard" element={<ProviderDashboard />} />
            <Route path="bookings" element={<ProviderBookingsPage />} />
            <Route path="test" element={<ProviderTestPage />} />
            <Route path="invoices" element={<ProviderInvoicesPage />} />
            <Route path="earnings" element={<ProviderEarning />} />
          </Route>
        </Route>

        {/* 404 Not Found Route - should be last */}
        <Route path="*" element={<Home />} />
      </Routes>

      {/* Only show Footer for public routes */}
      {!isDashboardRoute && <Footer />}
    </>
  );
};

export default App;