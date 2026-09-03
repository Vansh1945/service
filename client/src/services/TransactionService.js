import axiosInstance from "../api/axiosInstance";

// Customer Routes (Razorpay)

// Create Razorpay order for booking payment
export const createOrder = (data) => {
    return axiosInstance.post("/transaction/create-order", data);
};

// Verify payment and update records
export const verifyPayment = (data) => {
    return axiosInstance.post("/transaction/verify", data);
};

// Razorpay webhook (Public)
export const handleWebhook = (data) => {
    return axiosInstance.post("/transaction/webhook", data);
};

export const getCustomerTransactions = () => {
    return axiosInstance.get("/transaction/customer/all");
};

// Admin Routes
export const getAllTransactions = (params) => {
    return axiosInstance.get("/transaction/admin/all", { params });
};

export const getTransactionById = (id) => {
    return axiosInstance.get(`/transaction/admin/details/${id}`);
};

// Dedicated enriched payment details for Payment Management modal
// Returns: booking amount breakup, ledger, refund, complaint, settlement, audit
// Does NOT fetch live Razorpay data — use getUnifiedEntityDetails for Gateway tab
export const getAdminPaymentDetails = (id) => {
    return axiosInstance.get(`/transaction/admin/payment-details/${id}`);
};

export const getUnifiedEntityDetails = (entityType, id) => {
    return axiosInstance.get(`/transaction/admin/unified-details/${entityType}/${id}`);
};

export const adminRetryVerify = (id) => {
    return axiosInstance.post(`/transaction/admin/retry-verify/${id}`);
};

export const adminMarkPaid = (id, reason) => {
    return axiosInstance.post(`/transaction/admin/mark-paid/${id}`, { reason });
};

export const getFinanceOverview = (params) => {
    return axiosInstance.get("/transaction/admin/finance-overview", { params });
};

export const getChartTrends = (params = { days: 30 }) => {
    const queryParams = typeof params === 'number' ? { days: params } : params;
    return axiosInstance.get("/transaction/admin/chart-trends", { params: queryParams });
};

export const getCashLedger = (params) => {
    return axiosInstance.get("/transaction/admin/cash-ledger", { params });
};

export const getCustomerWallets = (params) => {
    return axiosInstance.get("/transaction/admin/wallets/customers", { params });
};

export const getProviderWallets = (params) => {
    return axiosInstance.get("/transaction/admin/wallets/providers", { params });
};

export const getSettlements = (params) => {
    return axiosInstance.get("/transaction/admin/settlements", { params });
};

export const getRazorpayLogs = (params) => {
    return axiosInstance.get("/transaction/admin/razorpay/logs", { params });
};

export const getFailedPayments = (params) => {
    return axiosInstance.get("/transaction/admin/failed-payments", { params });
};

export const getAuditLogs = (params) => {
    return axiosInstance.get("/transaction/admin/audit-logs", { params });
};

// ── Master Financial Ledger (new endpoints, additive only) ────────────────────

export const getMasterLedger = (params) => {
    return axiosInstance.get("/transaction/admin/ledger", { params });
};

export const getLedgerDetail = (id) => {
    return axiosInstance.get(`/transaction/admin/ledger-detail/${id}`);
};

// ── Razorpay Synchronization API ──────────────────────────────────────────────
export const syncRazorpayAll = (params) => {
    return axiosInstance.post("/transaction/admin/razorpay/sync-all", null, { params });
};

export const syncRazorpayPayments = (params) => {
    return axiosInstance.post("/transaction/admin/razorpay/sync-payments", null, { params });
};

export const syncRazorpaySettlements = (params) => {
    return axiosInstance.post("/transaction/admin/razorpay/sync-settlements", null, { params });
};

export const syncRazorpayRefunds = (params) => {
    return axiosInstance.post("/transaction/admin/razorpay/sync-refunds", null, { params });
};

export const syncRazorpayRecon = (params) => {
    return axiosInstance.post("/transaction/admin/razorpay/sync-recon", null, { params });
};

