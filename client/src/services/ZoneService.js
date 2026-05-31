import axiosInstance from "../api/axiosInstance";

export const createZone = (data) => {
    return axiosInstance.post("/zones/create", data);
};

export const getAllZones = (params) => {
    return axiosInstance.get("/zones/all", { params });
};

export const getZoneById = (id) => {
    return axiosInstance.get(`/zones/${id}`);
};

export const updateZone = (id, data) => {
    return axiosInstance.put(`/zones/${id}`, data);
};

export const deleteZone = (id) => {
    return axiosInstance.delete(`/zones/${id}`);
};

export const toggleZoneStatus = (id) => {
    return axiosInstance.patch(`/zones/toggle/${id}`);
};

export const resolveZone = (data) => {
    return axiosInstance.post("/zones/resolve", data);
};
