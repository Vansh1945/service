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
export const getBrandingSettings = (role, params = {}) => {
    return axiosInstance.get(`/system-setting/settings/branding/${role}`, { params });
};
export const updateBrandingSettings = (role, data) => {
    return axiosInstance.put(`/system-setting/settings/branding/${role}`, data);
};

export const publishBrandingSettings = (role, data) => {
    return axiosInstance.post(`/system-setting/settings/branding/${role}/publish`, data);
};

export const uploadBrandingAsset = (role, formData) => {
    return axiosInstance.post(`/system-setting/settings/branding/${role}/upload`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};
export const getEmailTemplates = () => {
    return axiosInstance.get("/system-setting/settings/email-templates");
};

export const updateEmailTemplate = (type, data) => {
    return axiosInstance.put(`/system-setting/settings/email-templates/${type}`, data);
};

export const previewEmailTemplate = (data) => {
    return axiosInstance.post("/system-setting/settings/email-templates/preview", data);
};

export const testSendEmailTemplate = (data) => {
    return axiosInstance.post("/system-setting/settings/email-templates/test", data);
};

export const restoreDefaultTemplate = (data) => {
    return axiosInstance.post("/system-setting/settings/email-templates/restore", data);
};

// Dynamic Template APIs
export const getTemplates = () => {
    return axiosInstance.get("/templates");
};

export const getTemplateByKey = (key) => {
    return axiosInstance.get(`/templates/${key}`);
};

export const saveTemplateVersion = (key, data) => {
    return axiosInstance.post(`/templates/${key}/version`, data);
};

export const publishTemplateVersion = (key, version) => {
    return axiosInstance.post(`/templates/${key}/version/${version}/publish`);
};

export const restoreTemplateVersion = (key, version) => {
    return axiosInstance.post(`/templates/${key}/version/${version}/restore`);
};

export const duplicateTemplateVersion = (key, version) => {
    return axiosInstance.post(`/templates/${key}/version/${version}/duplicate`);
};

export const previewTemplate = (key, data) => {
    return axiosInstance.post(`/templates/${key}/preview`, data, { responseType: 'blob' });
};

