import axiosInstance from "../api/axiosInstance";

// Customer routes
export const submitFeedback = (data) => {
    return axiosInstance.post("/feedback", data);
};

export const getCustomerFeedbacks = () => {
    return axiosInstance.get("/feedback/my-feedbacks");
};

export const getFeedback = (feedbackId) => {
    return axiosInstance.get(`/feedback/${feedbackId}`);
};

export const editFeedback = (feedbackId, data) => {
    return axiosInstance.put(`/feedback/edit/${feedbackId}`, data);
};

// Provider routes
export const getProviderFeedbacks = () => {
    return axiosInstance.get("/feedback/provider/my-feedbacks");
};

export const getProviderAverageRating = () => {
    return axiosInstance.get("/feedback/provider/average-rating");
};

// Admin routes
export const getAllFeedbacks = (params) => {
    return axiosInstance.get("/feedback/admin/all-feedbacks", { params });
};

export const getFeedbackAdmin = (feedbackId) => {
    return axiosInstance.get(`/feedback/admin/${feedbackId}`);
};

export const toggleFeedbackApproval = (feedbackId) => {
    return axiosInstance.patch(`/feedback/admin/toggle-approval/${feedbackId}`);
};

// Public route
export const getServiceFeedbacks = (serviceId) => {
    return axiosInstance.get(`/feedback/service/${serviceId}`);
};
