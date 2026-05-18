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

export const adminRetryVerify = (id) => {
    return axiosInstance.post(`/transaction/admin/retry-verify/${id}`);
};

export const adminMarkPaid = (id, reason) => {
    return axiosInstance.post(`/transaction/admin/mark-paid/${id}`, { reason });
};
