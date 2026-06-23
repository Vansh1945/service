import axiosInstance from "../api/axiosInstance";

export const verifyReferralCode = (code, role) => {
    return axiosInstance.get("/referral/verify", { params: { code, role } });
};

export const getCustomerReferralDetails = () => {
    return axiosInstance.get("/referral/customer/details");
};

export const getCustomerEligibility = () => {
    return axiosInstance.get("/referral/customer/eligibility");
};

export const getProviderReferralDetails = () => {
    return axiosInstance.get("/referral/provider/details");
};

export const getProviderEligibility = () => {
    return axiosInstance.get("/referral/provider/eligibility");
};

export const getAdminDashboard = () => {
    return axiosInstance.get("/referral/admin/dashboard");
};

export const getSettings = () => {
    return axiosInstance.get("/referral/admin/settings");
};

export const updateSettings = (data) => {
    return axiosInstance.put("/referral/admin/settings", data);
};

export const getMilestones = () => {
    return axiosInstance.get("/referral/admin/milestones");
};

export const addMilestone = (data) => {
    return axiosInstance.post("/referral/admin/milestones", data);
};

export const deleteMilestone = (id) => {
    return axiosInstance.delete(`/referral/admin/milestones/${id}`);
};

export const getFraudReferrals = () => {
    return axiosInstance.get("/referral/admin/fraud");
};

export const getRewardLogs = () => {
    return axiosInstance.get("/referral/admin/logs");
};

export const releaseHeldReward = (referralId) => {
    return axiosInstance.post("/referral/admin/release", { referralId });
};
