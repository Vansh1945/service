import axiosInstance from "../api/axiosInstance";

// Provider Test Routes
export const getTestCategories = () => {
    return axiosInstance.get("/test/categories");
};

export const startTest = (data) => {
    return axiosInstance.post("/test/start", data);
};

export const submitTest = (data) => {
    return axiosInstance.post("/test/submit", data);
};

export const getTestResults = () => {
    return axiosInstance.get("/test/results");
};

export const getActiveTest = () => {
    return axiosInstance.get("/test/active");
};

export const getTestDetails = (testId) => {
    return axiosInstance.get(`/test/details/${testId}`);
};
