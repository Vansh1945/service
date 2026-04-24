import axiosInstance from "../api/axiosInstance";

export const registerInitiate = (data) => {
    return axiosInstance.post("/provider/register/initiate", data);
};

export const registerComplete = (data) => {
    return axiosInstance.post("/provider/register/complete", data);
};

export const loginForCompletion = (data) => {
    return axiosInstance.post("/provider/login-for-completion", data);
};

export const completeProfile = (data) => {
    return axiosInstance.put("/provider/profile/complete", data);
};

export const getProfile = () => {
    return axiosInstance.get("/provider/profile");
};

export const updateProfile = (data) => {
    return axiosInstance.put("/provider/profile", data);
};

export const viewDocument = (type) => {
    return axiosInstance.get(`/provider/document/${type}`);
};

export const deleteAccount = () => {
    return axiosInstance.delete("/provider/profile");
};

// Admin delete provider account
export const permanentDeleteAccount = (id) => {
    return axiosInstance.delete(`/provider/${id}/permanent`);
};

export const getDashboardSummary = () => {
    return axiosInstance.get("/provider/dashboard/summary");
};

export const getEarningsAnalytics = (params) => {
    return axiosInstance.get("/provider/dashboard/earnings", { params });
};

export const getBookingStatusBreakdown = () => {
    return axiosInstance.get("/provider/dashboard/bookings");
};

export const getDashboardAnalytics = () => {
    return axiosInstance.get("/provider/dashboard/analytics");
};

export const getWalletInfo = () => {
    return axiosInstance.get("/provider/dashboard/wallet");
};

export const getPerformanceRatings = () => {
    return axiosInstance.get("/provider/dashboard/ratings");
};
