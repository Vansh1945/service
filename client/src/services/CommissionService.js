import axiosInstance from "../api/axiosInstance";

export const createCommissionRule = (data) => {
    return axiosInstance.post("/commission/rules", data);
};

export const listCommissionRules = (params) => {
    return axiosInstance.get("/commission/rules", { params });
};

export const getCommissionRuleById = (id) => {
    return axiosInstance.get(`/commission/rules/${id}`);
};

export const toggleCommissionRuleStatus = (id) => {
    return axiosInstance.patch(`/commission/rules/${id}/toggle-status`);
};

export const updateCommissionRule = (id, data) => {
    return axiosInstance.put(`/commission/rules/${id}`, data);
};

export const deleteCommissionRule = (id) => {
    return axiosInstance.delete(`/commission/rules/${id}`);
};


