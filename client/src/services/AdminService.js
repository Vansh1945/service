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