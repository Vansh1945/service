import axiosInstance from "../api/axiosInstance";

export const createCoupon = (data) => {
    return axiosInstance.post("/coupon/admin/coupons", data);
};

export const getAllCoupons = (data) => {
    return axiosInstance.get("/coupon/admin/coupons", data);
};


export const updateCoupon = (id, data) => {
    return axiosInstance.put(`/coupon/admin/coupons/${id}`, data);
};

export const deleteCoupon = (id) => {
    return axiosInstance.delete(`/coupon/admin/coupons/${id}`);
};

export const hardDeleteCoupon = (id) => {
    return axiosInstance.delete(`/coupon/admin/coupons/${id}/hard`);
};

// Customer Routes
export const applyCoupon = (data) => {
    return axiosInstance.post("/coupon/coupons/apply", data);
};

export const markCouponUsed = (data) => {
    return axiosInstance.post("/coupon/coupons/mark-used", data);
};

export const getAvailableCoupons = (data) => {
    return axiosInstance.get("/coupon/coupons/available", data);
};
