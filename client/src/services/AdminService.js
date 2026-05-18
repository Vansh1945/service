import axiosInstance from "../api/axiosInstance";

export const registerAdmin = (data) => {
    return axiosInstance.post("/admin/register", data);
};

export const getAdminProfile = () => {
    return axiosInstance.get("/admin/profile");
};

export const updateAdminProfile = (data) => {
    return axiosInstance.put("/admin/profile", data);
};

export const getAllAdmins = (params) => {
    return axiosInstance.get("/admin/admins", { params });
};

export const deleteAdmin = (id) => {
    return axiosInstance.delete(`/admin/admins/${id}`);
};

export const getAllCustomers = () => {
    return axiosInstance.get("/admin/customers");
};

export const getCustomerById = (id) => {
    return axiosInstance.get(`/admin/customers/${id}`);
};

export const getPendingProviders = () => {
    return axiosInstance.get("/admin/providers/pending");
};

export const updateProviderStatus = (id, data) => {
    return axiosInstance.put(`/admin/providers/${id}/status`, data);
};

export const getAllProviders = () => {
    return axiosInstance.get("/admin/providers");
};

export const getProviderDetails = (id) => {
    return axiosInstance.get(`/admin/providers/${id}`);
};

export const getDashboardStats = () => {
    return axiosInstance.get("/admin/dashboard/stats");
};

export const getDashboardSummary = (params) => {
    return axiosInstance.get("/admin/dashboard/summary", { params });
};

export const getDashboardRevenue = (params) => {
    return axiosInstance.get("/admin/dashboard/revenue", { params });
};

export const getDashboardBookingsStatus = (params) => {
    return axiosInstance.get("/admin/dashboard/bookings-status", { params });
};

export const getDashboardTopProviders = (params) => {
    return axiosInstance.get("/admin/dashboard/top-providers", { params });
};

export const getDashboardPendingActions = (params) => {
    return axiosInstance.get("/admin/dashboard/pending-actions", { params });
};

export const getDashboardLiveStats = (params) => {
    return axiosInstance.get("/admin/dashboard/live-stats", { params });
};

export const getDashboardRecentActivity = (params) => {
    return axiosInstance.get("/admin/dashboard/recent-activity", { params });
};

export const getDashboardAnalytics = (params) => {
    return axiosInstance.get("/admin/dashboard/analytics", { params });
};

// Dispute & Refund Management
export const processRefund = (bookingId, data) => {
    return axiosInstance.post(`/admin/refund/${bookingId}/process`, data);
};

export const rejectRefund = (bookingId, data) => {
    return axiosInstance.post(`/admin/refund/${bookingId}/reject`, data);
};


export const togglePayoutHold = (bookingId, data) => {
    return axiosInstance.patch(`/admin/payout/${bookingId}/hold`, data);
};

// Fraud Detection
export const getSameIPFraud = () => {
    return axiosInstance.get("/admin/fraud/same-ip");
};

export const getDeviceAbuse = () => {
    return axiosInstance.get("/admin/fraud/device-abuse");
};

export const getCancellationAlerts = () => {
    return axiosInstance.get("/admin/fraud/cancellation-alerts");
};

export const markFraudLogSafe = (id, data) => {
    return axiosInstance.patch(`/admin/fraud/${id}/safe`, data);
};

export const addFraudLogNote = (id, data) => {
    return axiosInstance.post(`/admin/fraud/${id}/notes`, data);
};

export const suspendUserAccount = (userId, data) => {
    return axiosInstance.patch(`/admin/fraud/user/${userId}/suspend`, data);
};


// System Logs
export const getSystemLogs = (params) => {
    return axiosInstance.get("/admin/system-logs", { params });
};