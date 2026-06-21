import axiosInstance from "../api/axiosInstance";

// All roles (Customer, Provider, Admin)
export const getNotifications = (params) => {
    return axiosInstance.get("/notifications/", { params });
};

export const getUnreadCount = () => {
    return axiosInstance.get("/notifications/unread-count");
};

export const markAllRead = () => {
    return axiosInstance.patch("/notifications/read-all");
};

export const markRead = (id) => {
    return axiosInstance.patch(`/notifications/read/${id}`);
};

export const saveToken = (data) => {
    return axiosInstance.post("/notifications/save-token", data);
};

export const removeToken = (data) => {
    return axiosInstance.post("/notifications/remove-token", data);
};


// Admin only
export const sendBroadcast = (data) => {
    return axiosInstance.post("/notifications/send-broadcast", data);
};

export const getBroadcastHistory = (params) => {
    return axiosInstance.get("/notifications/history", { params });
};

export const updateNotification = (id, data) => {
    return axiosInstance.patch(`/notifications/admin/${id}`, data);
};

export const deleteNotification = (id) => {
    return axiosInstance.delete(`/notifications/admin/${id}`);
};

export const cancelNotification = (id) => {
    return axiosInstance.patch(`/notifications/admin/cancel/${id}`);
};

export const resendNotification = (id) => {
    return axiosInstance.post(`/notifications/admin/resend/${id}`);
};

export const getAnalytics = (id) => {
    return axiosInstance.get(`/notifications/admin/analytics/${id}`);
};

export const markClicked = (id) => {
    const token = localStorage.getItem('fcmToken');
    const deviceId = localStorage.getItem('persistentDeviceId');
    return axiosInstance.patch(`/notifications/clicked/${id}`, { token, deviceId });
};

export const getAdminDashboardStats = () => {
    return axiosInstance.get("/notifications/admin/dashboard-stats");
};

// Admin Template management
export const getTemplates = () => {
    return axiosInstance.get("/notifications/templates");
};

export const createTemplate = (data) => {
    return axiosInstance.post("/notifications/templates", data);
};

export const updateTemplate = (id, data) => {
    return axiosInstance.put(`/notifications/templates/${id}`, data);
};

export const deleteTemplate = (id) => {
    return axiosInstance.delete(`/notifications/templates/${id}`);
};
