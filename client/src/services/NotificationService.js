import axiosInstance from "../api/axiosInstance";

// All roles (Customer, Provider, Admin)
export const getNotifications = () => {
    return axiosInstance.get("/notifications/");
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

export const getBroadcastHistory = () => {
    return axiosInstance.get("/notifications/history");
};
