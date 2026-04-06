import axiosInstance from "../api/axiosInstance";

export const createService = () => {
    return axiosInstance.post("/service/admin/services");
};

export const updateService = (id, data) => {
    return axiosInstance.put(`/service/admin/service/${id}`, data);
};

export const updateBasePrice = (id, data) => {
    return axiosInstance.patch(`/service/admin/services/${id}/price`, data);
};

export const deleteService = (id) => {
    return axiosInstance.delete(`/service/admin/services/${id}`);
};

export const getAllServices = () => {
    return axiosInstance.get("/service/admin/services")
}

export const getServiceById = (id) => {
    return axiosInstance.get(`/service/admin/services/${id}`)
}

export const bulkImportServices = () => {
    return axiosInstance.post("/service/admin/bulk-import")
}

export const exportServicesToExcel = () => {
    return axiosInstance.get("/service/admin/services-export")
}

//PROVIDER ROUTES

export const getServicesForProvider = () => {
    return axiosInstance.get("/service/provider/services")
}

export const getServiceDetailsForProvider = (id) => {
    return axiosInstance.get(`/service/provider/services/${id}`)
}

//PUBLIC ROUTES

export const getActiveServices = () => {
    return axiosInstance.get("/service/services")
}

export const getPublicServices = (page = 1, limit = 10) => {
    return axiosInstance.get(`/service/services?page=${page}&limit=${limit}`);
};

export const getPublicServiceById = (id) => {
    return axiosInstance.get(`/service/services/${id}`)
}

export const getServicesByCategory = (category) => {
    return axiosInstance.get(`/service/services/category/${category}`)
}