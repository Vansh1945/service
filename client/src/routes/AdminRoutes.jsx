import { Routes, Route } from "react-router-dom";
import { lazy } from "react";
import ProtectedRoute from "../components/ProtectedRoute";

const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("../pages/Admin/Dashboard"));
const AdminProfile = lazy(() => import("../pages/Admin/Profile"));
const ProviderList = lazy(() => import("../pages/Admin/Approved-Provider"));
const AdminProvidersPage = lazy(() => import("../pages/Admin/Providers"));
const AdminCustomersView = lazy(() => import("../pages/Admin/Customer"));
const AdminBookingsView = lazy(() => import("../pages/Admin/Bookings"));
const AdminCommissionPage = lazy(() => import("../pages/Admin/Commision"));
const AdminCoupons = lazy(() => import("../pages/Admin/Coupon"));
const AdminQuestions = lazy(() => import("../pages/Admin/Question"));
const AdminServices = lazy(() => import("../pages/Admin/Services"));
const AdminComplaints = lazy(() => import("../pages/Admin/Complaint"));
const AdminServiceFeedback = lazy(() => import("../pages/Admin/Feedback"));
const AdminReports = lazy(() => import("../pages/Admin/Earning-Reports"));
const AdminPayout = lazy(() => import("../pages/Admin/Payout"));
const CategoryBanner = lazy(() => import("../pages/Admin/CategoryBanner"));
const SystemSetting = lazy(() => import("../pages/Admin/System-Setting"));
const UserContacts = lazy(() => import("../pages/Admin/User-Contacts"));
const AdminNotification = lazy(() => import("../pages/Admin/AdminNotification"));

const AdminRoutes = () => {
    return (
        <Routes>
            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="profile" element={<AdminProfile />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="approve-providers" element={<ProviderList />} />
                    <Route path="providers" element={<AdminProvidersPage />} />
                    <Route path="customers" element={<AdminCustomersView />} />
                    <Route path="bookings" element={<AdminBookingsView />} />
                    <Route path="commission" element={<AdminCommissionPage />} />
                    <Route path="coupons" element={<AdminCoupons />} />
                    <Route path="add-questions" element={<AdminQuestions />} />
                    <Route path="add-services" element={<AdminServices />} />
                    <Route path="complaints" element={<AdminComplaints />} />
                    <Route path="feedback" element={<AdminServiceFeedback />} />
                    <Route path="earning-reports" element={<AdminReports />} />
                    <Route path="payout" element={<AdminPayout />} />
                    <Route path="category-banner" element={<CategoryBanner />} />
                    <Route path="settings" element={<SystemSetting />} />
                    <Route path="user-contacts" element={<UserContacts />} />
                    <Route path="notifications" element={<AdminNotification />} />
                </Route>
            </Route>
        </Routes>
    );
}

export default AdminRoutes;
