import axios from "axios";

// Track pending requests to prevent duplicates
const pendingRequests = new Map();

const getRequestKey = (config) => {
    const { method, url, data, params } = config;
    return `${method}:${url}:${JSON.stringify(data)}:${JSON.stringify(params)}`;
};

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api',
    timeout: 30000 // Increased timeout for heavy requests
});

// Add a request interceptor to include the auth token and prevent duplicates
api.interceptors.request.use(
    (config) => {
        // Prevent duplicate concurrent mutation requests
        if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
            const key = getRequestKey(config);
            if (pendingRequests.has(key)) {
                const controller = new AbortController();
                config.signal = controller.signal;
                controller.abort("Duplicate request blocked");
            } else {
                pendingRequests.set(key, true);
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

// Cleanup pending requests on response
api.interceptors.response.use(
    (response) => {
        if (['post', 'put', 'patch', 'delete'].includes(response.config.method)) {
            pendingRequests.delete(getRequestKey(response.config));
        }
        return response;
    },
    (error) => {
        if (error.config && ['post', 'put', 'patch', 'delete'].includes(error.config.method)) {
            pendingRequests.delete(getRequestKey(error.config));
        }
        return Promise.reject(error);
    }
);

export default api;