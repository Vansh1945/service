import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import LoadingSpinner from "../components/ui/Loader";

const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("../features/admin/dashboard/Dashboard"));
const AdminProfile = lazy(() => import("../features/admin/profile/Profile"));
const ProviderList = lazy(() => import("../features/admin/providers/Approved-Provider"));
const AdminProvidersPage = lazy(() => import("../features/admin/providers/Providers"));
const AdminCustomersView = lazy(() => import("../features/admin/customers/Customer"));
const AdminBookingsView = lazy(() => import("../features/admin/bookings/Bookings"));
const AdminCommissionPage = lazy(() => import("../features/admin/finance/Commision"));
const AdminCoupons = lazy(() => import("../features/admin/marketing/Coupon"));
const AdminQuestions = lazy(() => import("../features/admin/services/Question"));
const AdminServices = lazy(() => import("../features/admin/services/Services"));
const AdminComplaints = lazy(() => import("../features/admin/complaints/Complaint"));
const AdminRefund = lazy(() => import("../features/admin/complaints/Refund"));
const AdminServiceFeedback = lazy(() => import("../features/admin/complaints/Feedback"));
const AdminReports = lazy(() => import("../features/admin/finance/Earning-Reports"));
const AdminPayout = lazy(() => import("../features/admin/finance/Payout"));
const CategoryBanner = lazy(() => import("../features/admin/marketing/CategoryBanner"));
const SystemSetting = lazy(() => import("../features/admin/system/System-Setting"));
const Branding = lazy(() => import("../features/admin/system/Branding"));
const EmailTemplate = lazy(() => import("../features/admin/system/EmailTemplate"));
const TemplateManagement = lazy(() => import("../features/admin/system/TemplateManagement"));

const UserContacts = lazy(() => import("../features/admin/marketing/User-Contacts"));
const ComposeNotification = lazy(() => import("../features/admin/marketing/ComposeNotification"));
const RuleBasedTemplates = lazy(() => import("../features/admin/system/RuleBasedTemplates"));
const BroadcastHistory = lazy(() => import("../features/admin/marketing/BroadcastHistory"));
const AdminTransactions = lazy(() => import("../features/admin/finance/Transactions"));
const AdminFraud = lazy(() => import("../features/admin/finance/fraud"));
const SystemLogs = lazy(() => import("../features/admin/system/SystemLogs"));
const LiveTrackingPage = lazy(() => import("../features/admin/tracking/LiveTrackingPage"));
const ZoneManagement = lazy(() => import("../features/admin/system/ZoneManagement"));
const AdminChatMonitor = lazy(() => import("../features/admin/chat/AdminChatMonitor"));
const ReferralManagement = lazy(() => import("../features/admin/marketing/ReferralManagement"));
const SurgeManagement = lazy(() => import("../features/admin/services/SurgeManagement"));

const FinanceDashboardPage = lazy(() => import("../features/admin/finance/FinanceDashboardPage"));
const PaymentManagementPage = lazy(() => import("../features/admin/finance/PaymentManagementPage"));
const CashPaymentsPage = lazy(() => import("../features/admin/finance/CashPaymentsPage"));
const CustomerWalletsPage = lazy(() => import("../features/admin/finance/CustomerWalletsPage"));
const ProviderWalletsPage = lazy(() => import("../features/admin/finance/ProviderWalletsPage"));
const ProviderEarningsPage = lazy(() => import("../features/admin/finance/ProviderEarningsPage"));
const SettlementsPage = lazy(() => import("../features/admin/finance/SettlementsPage"));
const RazorpayManagementPage = lazy(() => import("../features/admin/finance/RazorpayManagementPage"));
const FailedPaymentsPage = lazy(() => import("../features/admin/finance/FailedPaymentsPage"));
const AuditLogsPage = lazy(() => import("../features/admin/finance/AuditLogsPage"));

import { AdminFilterProvider } from "../context/AdminFilterContext";

const AdminRoutes = () => {
    return (
        <AdminFilterProvider>
            <Suspense fallback={<LoadingSpinner />}>
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
                            <Route path="commision" element={<AdminCommissionPage />} />
                            <Route path="coupons" element={<AdminCoupons />} />
                            <Route path="surge" element={<SurgeManagement />} />
                            <Route path="add-questions" element={<AdminQuestions />} />
                            <Route path="add-services" element={<AdminServices />} />
                            <Route path="complaints" element={<AdminComplaints />} />
                            <Route path="refunds" element={<AdminRefund />} />
                            <Route path="feedback" element={<AdminServiceFeedback />} />
                            <Route path="earning-reports" element={<AdminReports />} />
                            <Route path="payout" element={<AdminPayout />} />
                            <Route path="category-banner" element={<CategoryBanner />} />
                            <Route path="settings" element={<SystemSetting />} />
                            <Route path="branding" element={<Branding />} />
                            <Route path="email-templates" element={<EmailTemplate />} />
                            <Route path="pdf-templates" element={<TemplateManagement />} />

                            <Route path="user-contacts" element={<UserContacts />} />
                            <Route path="compose-notification" element={<ComposeNotification />} />
                            <Route path="event-templates" element={<RuleBasedTemplates />} />
                            <Route path="broadcast-history" element={<BroadcastHistory />} />

                            <Route path="finance-dashboard" element={<FinanceDashboardPage />} />
                            <Route path="payments" element={<PaymentManagementPage />} />
                            <Route path="transactions" element={<AdminTransactions />} />
                            <Route path="cash-payments" element={<CashPaymentsPage />} />
                            <Route path="customer-wallets" element={<CustomerWalletsPage />} />
                            <Route path="provider-wallets" element={<ProviderWalletsPage />} />
                            <Route path="provider-earnings" element={<ProviderEarningsPage />} />
                            <Route path="settlements" element={<SettlementsPage />} />
                            <Route path="razorpay" element={<RazorpayManagementPage />} />
                            <Route path="failed-payments" element={<FailedPaymentsPage />} />
                            <Route path="audit-logs" element={<AuditLogsPage />} />

                            <Route path="fraud" element={<AdminFraud />} />
                            <Route path="system-logs" element={<SystemLogs />} />
                            <Route path="live-map" element={<LiveTrackingPage />} />
                            <Route path="zone-management" element={<ZoneManagement />} />
                            <Route path="chat-monitor" element={<AdminChatMonitor />} />
                            <Route path="surge-management" element={<SurgeManagement />} />
                            <Route path="referrals" element={<ReferralManagement />} />
                        </Route>
                    </Route>
                </Routes>
            </Suspense>
        </AdminFilterProvider>
    );
}

export default AdminRoutes;
