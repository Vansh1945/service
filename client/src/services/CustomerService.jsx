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
