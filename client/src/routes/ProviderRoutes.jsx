import { Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import LoadingSpinner from "../components/Loader";
import ProtectedRoute from "../components/ProtectedRoute";

// 🚀 Advanced preloading factory for critical components
const lazyWithPreload = (factory) => {
    const Component = lazy(factory);
    Component.preload = factory;
    return Component;
};

const ProviderLayout = lazyWithPreload(() => import("../layouts/ProviderLayout"));
const ProviderProfile = lazyWithPreload(() => import("../pages/Provider/Profile"));
const ProviderDashboard = lazyWithPreload(() => import("../pages/Provider/Dashboard"));
const ProviderBookingDashboard = lazyWithPreload(() => import("../pages/Provider/Provider-Booking"));
const ProviderTestPage = lazyWithPreload(() => import("../pages/Provider/Test"));
const ProviderEarning = lazyWithPreload(() => import("../pages/Provider/Earning"));
const ProviderFeedback = lazyWithPreload(() => import("../pages/Provider/Feedback"));
const ProviderSupport = lazyWithPreload(() => import("../pages/Provider/Support"));

const ProviderRoutes = () => {
    // ⚡ Preload critical components on mount for smoother interactions
    useEffect(() => {
        ProviderDashboard.preload();
        ProviderProfile.preload();
    }, []);

    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                <Route element={<ProtectedRoute allowedRoles={["provider"]} requireApproval requireTest />}>
                    <Route element={<ProviderLayout />}>
                        <Route index element={<ProviderDashboard />} />
                        <Route path="profile" element={<ProviderProfile />} />
                        <Route path="dashboard" element={<ProviderDashboard />} />
                        <Route path="test" element={<ProviderTestPage />} />
                        <Route path="booking-requests" element={<ProviderBookingDashboard />} />
                        <Route path="earnings" element={<ProviderEarning />} />
                        <Route path="feedbacks" element={<ProviderFeedback />} />
                        <Route path="support" element={<ProviderSupport />} />
                    </Route>
                </Route>
            </Routes>
        </Suspense>
    );
}

export default ProviderRoutes;
