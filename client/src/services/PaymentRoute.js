import axiosInstance from "../api/axiosInstance";

export const handleWebhook = (data) => {
    return axiosInstance.post("/payment/webhook", data);
};

export const getEarningsSummary = () => {
    return axiosInstance.get("/payment/summary");
};

export const requestBulkWithdrawal = (data) => {
    return axiosInstance.post("/payment/withdraw", data);
};

export const downloadEarningsReport = () => {
    return axiosInstance.get("/payment/earnings-report");
};

export const downloadWithdrawalReport = () => {
    return axiosInstance.get("/payment/withdrawal-report");
};

//ADMIN ROUTES

export const getAllWithdrawalRequests = () => {
    return axiosInstance.get("/payment/admin/withdrawal-requests");
};

export const approveWithdrawalRequest = (id) => {
    return axiosInstance.put(`/payment/admin/withdrawal-request/${id}/approve`);
};

export const rejectWithdrawalRequest = (id) => {
    return axiosInstance.put(`/payment/admin/withdrawal-request/${id}/reject`);
};

export const generateWithdrawalReport = () => {
    return axiosInstance.get("/payment/admin/withdrawal-report");
};

export const generateProviderEarningsReport = () => {
    return axiosInstance.get("/payment/admin/provider-earnings-report");
};

export const getCommissionReport = () => {
    return axiosInstance.get("/payment/admin/commission-report");
};

export const failedRejectedWithdrawalsReport = () => {
    return axiosInstance.get("/payment/admin/failed-rejected-report");
};

export const providerLedgerReport = (providerId) => {
    return axiosInstance.get(`/payment/admin/provider-ledger/${providerId}`);
};

export const earningsSummaryReport = () => {
    return axiosInstance.get("/payment/admin/earnings-summary-report");
};

export const payoutHistoryReport = () => {
    return axiosInstance.get("/payment/admin/payout-history-report");
};

export const outstandingBalanceReport = () => {
    return axiosInstance.get("/payment/admin/outstanding-balance-report");
};