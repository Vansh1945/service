import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import LoadingSpinner from "../components/ui-skeletons/Loader";

const CustomerLayout = lazy(() => import("../layouts/CustomerLayout"));
const ServiceListingPage = lazy(() => import("../features/customer/services/Services"));
const ServiceListingNew = lazy(() => import("../features/customer/services/ServiceListing"));
const ServiceDetailPage = lazy(() => import("../features/customer/services/Servicedetail"));
const BookService = lazy(() => import("../features/customer/booking-flow/Book-Service"));
const UserProfile = lazy(() => import("../features/customer/profile/Profile"));
const CustomerBookingsPage = lazy(() => import("../features/customer/my-bookings/CustomerBookingsPage"));
const BookingConfirmation = lazy(() => import("../features/customer/booking-flow/BookingConfirmation"));
const FeedbackManagement = lazy(() => import("../features/customer/complaints/Feedback"));
const ComplaintsPage = lazy(() => import("../features/customer/complaints/Complaint"));
const ReferEarn = lazy(() => import("../features/customer/marketing/ReferEarn"));
const LiveTrackingPage = lazy(() => import("../features/shared/live-tracking/LiveTrackingPage"));

const CustomerRoutes = () => {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route element={<ProtectedRoute allowedRoles={["customer"]} />}>
                    <Route element={<CustomerLayout />}>
                        <Route index element={<ServiceListingPage />} />
                        <Route path="profile" element={<UserProfile />} />
                        <Route path="services" element={<ServiceListingPage />} />
                        <Route path="services-list" element={<ServiceListingNew />} />
                        <Route path="services/:id" element={<ServiceDetailPage />} />
                        <Route path="book-service/:serviceId" element={<BookService />} />
                        <Route path="bookings" element={<CustomerBookingsPage />} />
                        <Route path="booking-confirm/:bookingId" element={<BookingConfirmation />} />
                        <Route path="feedback" element={<FeedbackManagement />} />
                        <Route path="complaints" element={<ComplaintsPage />} />
                        <Route path="refer-earn" element={<ReferEarn />} />
                    </Route>
                    <Route path="track/:bookingId" element={<LiveTrackingPage />} />
                </Route>
            </Routes>
        </Suspense>
    );
}

export default CustomerRoutes;
