import axiosInstance from "../api/axiosInstance";

export const getTestCategories = () => {
    return axiosInstance.get("/test/admin/categories");
};

export const startTest = (data) => {
    return axiosInstance.post("/test/admin/start", data);
};

export const submitTest = (data) => {
    return axiosInstance.post("/test/admin/submit", data);
};

export const getTestResults = () => {
    return axiosInstance.get("/test/admin/results");
};

export const getActiveTest = () => {
    return axiosInstance.get("/test/admin/active");
};

export const getTestDetails = (testId) => {
    return axiosInstance.get(`/test/admin/details/${testId}`);
};
