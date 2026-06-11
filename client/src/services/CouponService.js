import BaseCrudService from "./BaseCrudService";
import axiosInstance from "../api/axiosInstance";

const adminCouponService = new BaseCrudService("/coupon/admin/coupons");

export const createCoupon = (data) => {
    return adminCouponService.create(data);
};

export const getAllCoupons = (data) => {
    return adminCouponService.getAll(data);
};

export const updateCoupon = (id, data) => {
    return axiosInstance.put(`/coupon/admin/coupon/${id}`, data);
};

export const deleteCoupon = (id) => {
    return adminCouponService.delete(id);
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

export const getAvailableCoupons = (params) => {
    return axiosInstance.get("/coupon/coupons/available", { params });
};
