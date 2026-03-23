import axiosInstance from "../api/axiosInstance";

// Admin related routes
export const createQuestion = (data) => {
    return axiosInstance.post("/question/", data);
};

export const updateQuestion = (data) => {
    return axiosInstance.put("/question/edit/:id", data);
};

export const disableQuestion = (data) => {
    return axiosInstance.put("/question/disable/:id", data);
};

export const toggleQuestionStatus = (data) => {
    return axiosInstance.put("/question/toggle/:id", data);
};

export const deleteQuestion = (data) => {
    return axiosInstance.delete("/question/:id", data);
};

export const getAllQuestions = (data) => {
    return axiosInstance.get("/question/get", data);
};

export const getQuestion = (data) => {
    return axiosInstance.get("/question/:id", data);
};

export const createBulkQuestions = () => {
    return axiosInstance.post("/question/bulk")
}

export const downloadQuestionsPDF = () => {
    return axiosInstance.get("/download/pdf")
}
