import { Routes, Route } from "react-router-dom";
import { lazy } from "react";
import ProtectedRoute from "../components/ProtectedRoute";

const CustomerLayout = lazy(() => import("../layouts/CustomerLayout"));
const ServiceListingPage = lazy(() => import("../pages/Customer/Services"));
const ServiceDetailPage = lazy(() => import("../pages/Customer/Servicedetail"));
const BookService = lazy(() => import("../pages/Customer/Book-Service"));
const UserProfile = lazy(() => import("../pages/Customer/Profile"));
const CustomerBookingsPage = lazy(() => import("../pages/Customer/CustomerBookingsPage"));
const BookingConfirmation = lazy(() => import("../pages/Customer/BookingConfirmation"));
const FeedbackManagement = lazy(() => import("../pages/Customer/Feedback"));
const ComplaintsPage = lazy(() => import("../pages/Customer/Complaint"));

const CustomerRoutes = () => {
    return (
        <Routes>
            <Route element={<ProtectedRoute allowedRoles={["customer"]} />}>
                <Route element={<CustomerLayout />}>
                    <Route index element={<ServiceListingPage />} />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="services" element={<ServiceListingPage />} />
                    <Route path="services/:id" element={<ServiceDetailPage />} />
                    <Route path="book-service/:serviceId" element={<BookService />} />
                    <Route path="bookings" element={<CustomerBookingsPage />} />
                    <Route path="booking-confirm/:bookingId" element={<BookingConfirmation />} />
                    <Route path="feedback" element={<FeedbackManagement />} />
                    <Route path="complaints" element={<ComplaintsPage />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default CustomerRoutes;
