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

export const completeProfile = (data, config = {}) => {
    return axiosInstance.put("/provider/profile/complete", data, config);
};

export const getProfile = () => {
    return axiosInstance.get("/provider/profile");
};

export const updateProfile = (data, config = {}) => {
    return axiosInstance.put("/provider/profile", data, config);
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

export const getDashboardData = (params) => {
    return axiosInstance.get("/provider/dashboard", { params });
};

export const getAgreementPdf = () => {
    return axiosInstance.get("/provider/agreement-pdf");
};

// Payout Profile API methods
export const getPayoutAccounts = () => {
    return axiosInstance.get("/provider/payout-accounts");
};

export const addPayoutAccount = (data) => {
    return axiosInstance.post("/provider/payout-accounts", data);
};

export const updatePayoutAccount = (accountId, data) => {
    return axiosInstance.put(`/provider/payout-accounts/${accountId || 'primary'}`, data);
};

export const setDefaultPayoutAccount = (accountId, data = {}) => {
    return axiosInstance.patch(`/provider/payout-accounts/${accountId || 'primary'}/default`, data);
};

export const deletePayoutAccount = (accountId, params = {}) => {
    return axiosInstance.delete(`/provider/payout-accounts/${accountId || 'primary'}`, { params });
};

export const requestWithdrawal = (data) => {
    return axiosInstance.post("/payment/withdraw", data);
};

