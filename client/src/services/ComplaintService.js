import axiosInstance from "../api/axiosInstance";

export const submitComplaint = (data) => {
    return axiosInstance.post("/complaint/", data);
};

export const getCustomerComplaints = () => {
    return axiosInstance.get("/complaint/my-complaints");
};

export const getComplaint = (id) => {
    return axiosInstance.get(`/complaint/${id}`);
};

export const reopenComplaint = (id, data) => {
    return axiosInstance.put(`/complaint/${id}/reopen`, data);
};


// Admin routes
export const getAllComplaints = (params) => {
    return axiosInstance.get("/complaint", { params });
};

export const getComplaintDetails = (id) => {
    return axiosInstance.get(`/complaint/${id}/details`);
};

export const resolveComplaint = (id, data) => {
    return axiosInstance.put(`/complaint/${id}/resolve`, data);
};

export const updateComplaintStatus = (id, status) => {
    return axiosInstance.put(`/complaint/${id}/status`, { status });
};

