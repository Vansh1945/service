import axiosInstance from "../api/axiosInstance";

// Public Routes
export const submitContact = (data) => {
    return axiosInstance.post("/contact/", data);
};

// Admin Routes
export const getAllContacts = (params) => {
    return axiosInstance.get("/contact/admin", { params });
};

export const getContactById = (id) => {
    return axiosInstance.get(`/contact/${id}`);
};

export const replyToContact = (id, data) => {
    return axiosInstance.post(`/contact/${id}/reply`, data);
};
