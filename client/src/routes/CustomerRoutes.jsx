import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import LoadingSpinner from "../components/ui-skeletons/Loader";

const CustomerLayout = lazy(() => import("../layouts/CustomerLayout"));
const ServiceListingPage = lazy(() => import("../pages/Customer/Services"));
const ServiceListingNew = lazy(() => import("../pages/Customer/ServiceListing"));
const ServiceDetailPage = lazy(() => import("../pages/Customer/Servicedetail"));
const BookService = lazy(() => import("../pages/Customer/Book-Service"));
const UserProfile = lazy(() => import("../pages/Customer/Profile"));
const CustomerBookingsPage = lazy(() => import("../pages/Customer/CustomerBookingsPage"));
const BookingConfirmation = lazy(() => import("../pages/Customer/BookingConfirmation"));
const FeedbackManagement = lazy(() => import("../pages/Customer/Feedback"));
const ComplaintsPage = lazy(() => import("../pages/Customer/Complaint"));
const ReferEarn = lazy(() => import("../pages/Customer/ReferEarn"));
const LiveTrackingPage = lazy(() => import("../pages/Shared/LiveTrackingPage"));

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
