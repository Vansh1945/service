import axios from "axios";

// Track pending requests to prevent duplicates
const pendingRequests = new Map();

// Variables for refresh token logic
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

const getRequestKey = (config) => {
    const { method, url, data, params } = config;
    return `${method}:${url}:${JSON.stringify(data)}:${JSON.stringify(params)}`;
};

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api"),
});

// Add a request interceptor to include the auth token and prevent duplicates
api.interceptors.request.use(
    (config) => {
        // Prevent duplicate concurrent mutation requests
        // Prevent duplicate concurrent mutation requests, but allow token save requests
        if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
            // Skip duplicate check for notification token saving to avoid CancelledError
            const isSaveToken = config.url && config.url.includes('/notifications/save-token');
            if (!isSaveToken) {
                const key = getRequestKey(config);
                if (pendingRequests.has(key)) {
                    const controller = new AbortController();
                    config.signal = controller.signal;
                    controller.abort("Duplicate request blocked");
                } else {
                    pendingRequests.set(key, true);
                }
            }
        }

        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Attach secure, non-personally-identifiable device characteristics for SHA-256 fingerprinting
        try {
            config.headers['x-device-screenresolution'] = `${window.screen.width || 0}x${window.screen.height || 0}`;
            config.headers['x-device-timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            config.headers['x-device-language'] = window.navigator.language || '';
            config.headers['x-device-platform'] = window.navigator.platform || '';
            config.headers['x-device-hardwareconcurrency'] = String(window.navigator.hardwareConcurrency || 0);
            config.headers['x-device-devicememory'] = String(window.navigator.deviceMemory || 0);
        } catch (e) {
            console.warn("Failed to capture browser telemetry headers:", e);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

const optimizeCloudinaryUrls = (data) => {
    if (!data) return data;
    if (typeof data === 'string') {
        if (data.startsWith('http') && data.includes('res.cloudinary.com')) {
            if (data.includes('/s--')) return data;
            if (data.includes('/image/upload/')) {
                if (!data.includes('/image/upload/f_auto,q_auto,w_800/')) {
                    return data.replace('/image/upload/', '/image/upload/f_auto,q_auto,w_800/');
                }
            } else if (data.includes('/upload/') && !data.includes('/raw/upload/') && !data.includes('/video/upload/')) {
                if (!data.includes('/upload/f_auto,q_auto,w_800/')) {
                    return data.replace('/upload/', '/upload/f_auto,q_auto,w_800/');
                }
            }
        }
        return data;
    }
    if (Array.isArray(data)) {
        return data.map(item => optimizeCloudinaryUrls(item));
    }
    if (typeof data === 'object') {
        if (data instanceof Date || data instanceof RegExp || data instanceof ArrayBuffer || (typeof Blob !== 'undefined' && data instanceof Blob)) {
            return data;
        }
        const optimized = {};
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                optimized[key] = optimizeCloudinaryUrls(data[key]);
            }
        }
        return optimized;
    }
    return data;
};

// Cleanup pending requests on response
api.interceptors.response.use(
    (response) => {
        if (['post', 'put', 'patch', 'delete'].includes(response.config.method)) {
            pendingRequests.delete(getRequestKey(response.config));
        }
        if (response.data) {
            response.data = optimizeCloudinaryUrls(response.data);
        }
        return response;
    },
    async (error) => {
        if (axios.isCancel(error)) {
            error.message = 'silent_cancel';
            return Promise.reject(error);
        }

        const originalRequest = error.config;

        if (error.config && ['post', 'put', 'patch', 'delete'].includes(error.config.method)) {
            pendingRequests.delete(getRequestKey(error.config));
        }

        // Check if error is due to token expiration and we haven't retried yet
        if (error.response?.status === 401 && error.response?.data?.tokenExpired && !originalRequest._retry) {
            if (isRefreshing) {
                try {
                    const token = await new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    });
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                } catch (err) {
                    return Promise.reject(err);
                }
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem("refreshToken");
            if (!refreshToken) {
                isRefreshing = false;
                // No refresh token -> logout
                const persistentDeviceId = localStorage.getItem("persistentDeviceId");
                const tempFcmToken = localStorage.getItem("tempFcmToken");
                const fcmToken = localStorage.getItem("fcmToken");
                localStorage.clear();
                if (persistentDeviceId) localStorage.setItem("persistentDeviceId", persistentDeviceId);
                if (tempFcmToken) localStorage.setItem("tempFcmToken", tempFcmToken);
                if (fcmToken) localStorage.setItem("fcmToken", fcmToken);
                window.location.href = '/login';
                return Promise.reject(error);
            }

            try {
                // Use standard axios to avoid interceptor loop
                const { data } = await axios.post(`${import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api")}/auth/refresh-token`, { refreshToken });
                if (data.success && data.token) {
                    localStorage.setItem("token", data.token);
                    if (data.refreshToken) localStorage.setItem("refreshToken", data.refreshToken);

                    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                    originalRequest.headers.Authorization = `Bearer ${data.token}`;

                    processQueue(null, data.token);
                    isRefreshing = false;
                    return api(originalRequest);
                }
            } catch (err) {
                processQueue(err, null);
                isRefreshing = false;
                // If refresh fails, they must login again
                const persistentDeviceId = localStorage.getItem("persistentDeviceId");
                const tempFcmToken = localStorage.getItem("tempFcmToken");
                const fcmToken = localStorage.getItem("fcmToken");
                localStorage.clear();
                if (persistentDeviceId) localStorage.setItem("persistentDeviceId", persistentDeviceId);
                if (tempFcmToken) localStorage.setItem("tempFcmToken", tempFcmToken);
                if (fcmToken) localStorage.setItem("fcmToken", fcmToken);
                window.location.href = '/login';
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    }
);

export default api;