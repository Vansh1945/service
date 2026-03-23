import axiosInstance from "../api/axiosInstance";

export const registerAdmin = (data) => {
    return axiosInstance.post("/admin/register", data);
};

export const getAdminProfile = () => {
    return axiosInstance.get("/admin/profile");
};

export const updateAdminProfile = (data) => {
    return axiosInstance.patch("/admin/profile", data);
};

export const getAllAdmins = () => {
    return axiosInstance.get("/admin/admins");
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

export const approveProvider = (id) => {
    return axiosInstance.put(`/admin/providers/${id}/status`);
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

export const getDashboardSummary = () => {
    return axiosInstance.get("/admin/dashboard/summary");
};

export const getDashboardRevenue = () => {
    return axiosInstance.get("/admin/dashboard/revenue");
};

export const getDashboardBookingsStatus = () => {
    return axiosInstance.get("/admin/dashboard/bookings-status");
};

export const getDashboardTopProviders = () => {
    return axiosInstance.get("/admin/dashboard/top-providers");
};

export const getDashboardPendingActions = () => {
    return axiosInstance.get("/admin/dashboard/pending-actions");
};

export const getDashboardLiveStats = () => {
    return axiosInstance.get("/admin/dashboard/live-stats");
};

export const getDashboardRecentActivity = () => {
    return axiosInstance.get("/admin/dashboard/recent-activity");
};