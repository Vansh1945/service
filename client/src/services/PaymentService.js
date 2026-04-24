import axiosInstance from "../api/axiosInstance";

export const handleWebhook = (data) => {
    return axiosInstance.post("/payment/webhook", data);
};

export const getEarningsSummary = (params) => {
    return axiosInstance.get("/payment/summary", { params });
};

export const withdraw = (data) => {
    return axiosInstance.post("/payment/withdraw", data);
};

export const getEarningsReport = (params) => {
    return axiosInstance.get("/payment/earnings-report", { params });
};

export const getWithdrawalReport = (params) => {
    return axiosInstance.get("/payment/withdrawal-report", { params });
};

export const downloadEarningsReport = (params, config) => {
    return axiosInstance.get("/payment/earnings-report", { params, ...config });
};

export const downloadWithdrawalReport = (params, config) => {
    return axiosInstance.get("/payment/withdrawal-report", { params, ...config });
};

//ADMIN ROUTES

export const getAllWithdrawalRequests = (params) => {
    return axiosInstance.get("/payment/admin/withdrawal-requests", { params });
};

export const approveWithdrawalRequest = (id, data) => {
    return axiosInstance.put(`/payment/admin/withdrawal-request/${id}/approve`, data);
};

export const rejectWithdrawalRequest = (id, data) => {
    return axiosInstance.put(`/payment/admin/withdrawal-request/${id}/reject`, data);
};

export const generateWithdrawalReport = (params, config) => {
    return axiosInstance.get("/payment/admin/withdrawal-report", { params, ...config });
};

export const generateProviderEarningsReport = (params, config) => {
    return axiosInstance.get("/payment/admin/provider-earnings-report", { params, ...config });
};

export const getCommissionReport = (params, config) => {
    return axiosInstance.get("/payment/admin/commission-report", { params, ...config });
};

export const failedRejectedWithdrawalsReport = (params, config) => {
    return axiosInstance.get("/payment/admin/failed-rejected-report", { params, ...config });
};

export const providerLedgerReport = (providerId, params, config) => {
    return axiosInstance.get(`/payment/admin/provider-ledger/${providerId}`, { params, ...config });
};

export const earningsSummaryReport = (params, config) => {
    return axiosInstance.get("/payment/admin/earnings-summary-report", { params, ...config });
};

export const payoutHistoryReport = (params, config) => {
    return axiosInstance.get("/payment/admin/payout-history-report", { params, ...config });
};

export const outstandingBalanceReport = (params, config) => {
    return axiosInstance.get("/payment/admin/outstanding-balance-report", { params, ...config });
};