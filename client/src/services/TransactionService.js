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

// Admin Routes
export const getAllTransactions = (params) => {
    return axiosInstance.get("/transaction/admin/all", { params });
};

export const getTransactionById = (id) => {
    return axiosInstance.get(`/transaction/admin/details/${id}`);
};
