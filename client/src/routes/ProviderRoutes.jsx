import { Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import LoadingSpinner from "../components/ui-skeletons/Loader";
import ProtectedRoute from "../components/ProtectedRoute";

// 🚀 Advanced preloading factory for critical components
const lazyWithPreload = (factory) => {
    const Component = lazy(factory);
    Component.preload = factory;
    return Component;
};

const ProviderLayout = lazyWithPreload(() => import("../layouts/ProviderLayout"));
const ProviderProfile = lazyWithPreload(() => import("../features/provider/profile/Profile"));
const ProviderDashboard = lazyWithPreload(() => import("../features/provider/dashboard/Dashboard"));
const ProviderBookingDashboard = lazyWithPreload(() => import("../features/provider/bookings/Provider-Booking"));
const ProviderTestPage = lazyWithPreload(() => import("../features/provider/dashboard/Test"));
const ProviderEarning = lazyWithPreload(() => import("../features/provider/earnings/Earning"));
const ProviderFeedback = lazyWithPreload(() => import("../features/provider/feedback/Feedback"));
const ProviderSupport = lazyWithPreload(() => import("../features/provider/support/Support"));
const ReferProviders = lazyWithPreload(() => import("../features/provider/support/ReferProviders"));
const ProviderCalendar = lazyWithPreload(() => import("../features/provider/bookings/Calendar"));
const ProviderTrackingPage = lazyWithPreload(() => import("../features/shared/live-tracking/LiveTrackingPage"));

const ProviderRoutes = () => {
    // ⚡ Preload critical components on mount for smoother interactions
    useEffect(() => {
        ProviderDashboard.preload();
        ProviderProfile.preload();
    }, []);

    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route element={<ProtectedRoute allowedRoles={["provider"]} requireTest />}>
                    <Route element={<ProviderLayout />}>
                        <Route index element={<ProviderDashboard />} />
                        <Route path="profile" element={<ProviderProfile />} />
                        <Route path="dashboard" element={<ProviderDashboard />} />
                        <Route path="calendar" element={<ProviderCalendar />} />
                        <Route path="test" element={<ProviderTestPage />} />
                        <Route path="booking-requests" element={<ProviderBookingDashboard />} />
                        <Route path="earnings" element={<ProviderEarning />} />
                        <Route path="feedbacks" element={<ProviderFeedback />} />
                        <Route path="support" element={<ProviderSupport />} />
                        <Route path="refer-providers" element={<ReferProviders />} />
                    </Route>
                    <Route path="track/:bookingId" element={<ProviderTrackingPage />} />
                </Route>
            </Routes>
        </Suspense>
    );
}

export default ProviderRoutes;
