import axiosInstance from "../api/axiosInstance";

export const getProfile = () => {
    return axiosInstance.get("/customer/profile");
};

export const updateProfile = (data) => {
    return axiosInstance.put("/customer/profile-update", data);
};

export const updateprofilepic = (data) => {
    return axiosInstance.post("/customer/profile-picture", data);
};

export const getDashboardStats = () => {
    return axiosInstance.get("/customer/dashboard");
};

export const getWalletHistory = () => {
    return axiosInstance.get("/customer/wallet/history");
};

export const toggleFavoriteProvider = (data) => {
    return axiosInstance.post("/customer/favorite-providers/toggle", data);
};

export const checkFavoriteProviderAvailability = (providerId, categoryId) => {
    const params = categoryId ? { categoryId } : {};
    return axiosInstance.get(`/customer/favorite-providers/check/${providerId}`, { params });
};

// Saved Addresses API Services
export const getSavedAddresses = () => {
    return axiosInstance.get("/customer/addresses");
};

export const createSavedAddress = (data) => {
    return axiosInstance.post("/customer/addresses", data);
};

export const updateSavedAddress = (addressId, data) => {
    return axiosInstance.put(`/customer/addresses/${addressId}`, data);
};

export const deleteSavedAddress = (addressId) => {
    return axiosInstance.delete(`/customer/addresses/${addressId}`);
};

export const setDefaultSavedAddress = (addressId) => {
    return axiosInstance.patch(`/customer/addresses/${addressId}/default`);
};


