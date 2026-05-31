import axiosInstance from "../api/axiosInstance";

export const createSurgeRule = (data) => {
    return axiosInstance.post("/surge/rules", data);
};

export const listSurgeRules = (params) => {
    return axiosInstance.get("/surge/rules", { params });
};

export const getSurgeRuleById = (id) => {
    return axiosInstance.get(`/surge/rules/${id}`);
};

export const toggleSurgeRuleStatus = (id) => {
    return axiosInstance.patch(`/surge/rules/${id}/toggle-status`);
};

export const updateSurgeRule = (id, data) => {
    return axiosInstance.put(`/surge/rules/${id}`, data);
};

export const deleteSurgeRule = (id) => {
    return axiosInstance.delete(`/surge/rules/${id}`);
};

export const resolveActiveSurcharges = (params) => {
    return axiosInstance.get("/surge/resolve", { params });
};
