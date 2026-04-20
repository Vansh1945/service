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
export const getAllComplaints = (data) => {
    return axiosInstance.get(`/complaint/`, data);
};

export const getComplaintDetails = (id) => {
    return axiosInstance.get(`/complaint/${id}/details`);
};

export const resolveComplaint = (id, data) => {
    return axiosInstance.put(`/complaint/${id}/resolve`, data);
};

export const updateComplaintStatus = (id, data) => {
    return axiosInstance.put(`/complaint/${id}/status`, data);
};

