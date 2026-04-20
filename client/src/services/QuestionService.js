import axiosInstance from "../api/axiosInstance";

// Admin related routes
export const createQuestion = (data) => {
    return axiosInstance.post("/question/", data);
};

export const updateQuestion = (id, data) => {
    return axiosInstance.put(`/question/edit/${id}`, data);
};

export const disableQuestion = (id, data) => {
    return axiosInstance.put(`/question/disable/${id}`, data);
};

export const toggleQuestionStatus = (id, data) => {
    return axiosInstance.put(`/question/toggle/${id}`, data);
};

export const deleteQuestion = (id) => {
    return axiosInstance.delete(`/question/${id}`);
};

export const getAllQuestions = () => {
    return axiosInstance.get("/question/get");
};

export const getQuestion = (id) => {
    return axiosInstance.get(`/question/${id}`);
};

export const createBulkQuestions = (data) => {
    return axiosInstance.post("/question/bulk", data);
};

export const downloadQuestionsPDF = () => {
    return axiosInstance.get("/question/download/pdf");
};
