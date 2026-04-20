import axiosInstance from "../api/axiosInstance";

export const createCommissionRule = (data) => {
    return axiosInstance.post("/commission/rules", data);
};

export const listCommissionRules = (data) => {
    return axiosInstance.get("/commission/rules", data);
};

export const getCommissionRuleById = (id) => {
    return axiosInstance.get(`/commission/rules/${id}`);
};

export const toggleCommissionRuleStatus = (id, data) => {
    return axiosInstance.patch(`/commission/rules/${id}/toggle-status`, data);
};

export const updateCommissionRule = (id, data) => {
    return axiosInstance.put(`/commission/rules/${id}`, data);
};

export const deleteCommissionRule = (id) => {
    return axiosInstance.delete(`/commission/rules/${id}`);
};


