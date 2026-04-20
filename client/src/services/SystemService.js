import axiosInstance from "../api/axiosInstance";

export const getSystemSetting = () => {
    return axiosInstance.get("/system-setting/system-data");
};

export const getCategories = () => {
    return axiosInstance.get("/system-setting/categories");
};

export const getBanners = () => {
    return axiosInstance.get("/system-setting/banners");
};

// Admin Reletad routes
export const getCategoriesAdmin = () => {
    return axiosInstance.get("/system-setting/admin/categories");
};

export const getBannersAdmin = () => {
    return axiosInstance.get("/system-setting/admin/banners");
};

export const getSystemSettingAdmin = () => {
    return axiosInstance.get("/system-setting/admin/system-setting");
};

export const updateSystemSetting = (data) => {
    return axiosInstance.put("/system-setting/admin/system-setting", data);
};

export const createCategory = (data) => {
    return axiosInstance.post("/system-setting/admin/categories", data);
};

export const updateCategory = (id, data) => {
    return axiosInstance.put(`/system-setting/admin/categories/${id}`, data);
};

export const deleteCategory = (id) => {
    return axiosInstance.delete(`/system-setting/admin/categories/${id}`);
};

export const toggleCategoryStatus = (id) => {
    return axiosInstance.patch(`/system-setting/admin/categories/${id}/toggle`);
};

export const createBanner = (data) => {
    return axiosInstance.post("/system-setting/admin/banners", data);
};

export const updateBanner = (id, data) => {
    return axiosInstance.put(`/system-setting/admin/banners/${id}`, data);
};

export const deleteBanner = (id) => {
    return axiosInstance.delete(`/system-setting/admin/banners/${id}`);
};

