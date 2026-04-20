import axiosInstance from "../api/axiosInstance";

// customer routes
export const submitFeedback = (data) => {
    return axiosInstance.post("/feedback", data);
};

export const getCustomerFeedbacks = (data) => {
    return axiosInstance.get("/feedback/my-feedbacks", data);
};

export const getFeedback = (feedbackId) => {
    return axiosInstance.get(`/feedback/${feedbackId}`);
};


export const editFeedback = (feedbackId, data) => {
    return axiosInstance.put(`/feedback/edit/${feedbackId}`, data);
};


// provider routes
export const getProviderFeedbacks = (data) => {
    return axiosInstance.get("/feedback/provider/my-feedbacks", data);
};

export const getProviderAverageRating = (data) => {
    return axiosInstance.get("/feedback/provider/average-rating", data);
};


// admin routes
export const getAllFeedbacks = (data) => {
    return axiosInstance.get("/feedback/admin/all-feedbacks", data);
};

export const getFeedbackadmin = (data) => {
    return axiosInstance.get("/feedback/admin/:feedbackId", data);
};

// public route
export const getServiceFeedbacks = (data) => {
    return axiosInstance.get("/feedback/service/:serviceId", data);
};
