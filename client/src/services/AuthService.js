import axiosInstance from "../api/axiosInstance";

export const login = (data) => {
    return axiosInstance.post("/auth/login", data);
};

export const register = (data) => {
    return axiosInstance.post("/customer/register", data);
};

export const forgetpassword = (data) => {
    return axiosInstance.post("/auth/forgot-password", data);
};

export const verifyotp = (data) => {
    return axiosInstance.post("/auth/verify-otp", data);
};

export const resetpassword = (data) => {
    return axiosInstance.post("/auth/reset-password", data);
};

export const resendotp = (data) => {
    return axiosInstance.post("/auth/resend-otp", data);
};

export const firebaseLogin = (data) => {
    return axiosInstance.post("/auth/firebase-login", data);
};

export const refreshAccessToken = (data) => {
    return axiosInstance.post("/auth/refresh-token", data);
};

export const logoutApi = (data) => {
    return axiosInstance.post("/auth/logout", data);
};