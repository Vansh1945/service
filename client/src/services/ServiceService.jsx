import axiosInstance from "../api/axiosInstance";

export const createService = () => {
    return axiosInstance.post("/service/admin/services");
};

export const updateService = () => {
    return axiosInstance.put("/service/admin/service/:id");
};

export const updateBasePrice = () => {
    return axiosInstance.patch("/service/admin/services/:id/price");
};

export const deleteService = () => {
    return axiosInstance.delete("/service/admin/services/:id");
};

export const getAllServices = () => {
    return axiosInstance.get("/service/admin/services")
}

export const getServiceById = () => {
    return axiosInstance.get("/service/admin/services/:id")
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

export const getServiceDetailsForProvider = () => {
    return axiosInstance.get("/service/provider/services/:id")
}

//PUBLIC ROUTES

export const getActiveServices = () => {
    return axiosInstance.get("/service/services")
}

export const getPublicServiceById = () => {
    return axiosInstance.get("/service/services/:id")
}

export const getServicesByCategory = () => {
    return axiosInstance.get("/service/services/category/:category")
}