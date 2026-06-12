import { io } from 'socket.io-client';

// Server URL without /api path
const SERVER_URL = import.meta.env.VITE_BACKEND_URL
    ? import.meta.env.VITE_BACKEND_URL.replace('/api', '')
    : window.location.origin;

let socket = null;

/**
 * Get or create the singleton socket instance
 */
const getSocket = () => {
    if (!socket) {
        socket = io(SERVER_URL, {
            auth: {
                token: null
            },
            transports: ['websocket', 'polling'],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
    }
    return socket;
};

/**
 * Connect socket with fresh token
 */
const connectSocket = (token) => {
    const s = getSocket();
    if (!token) return s;

    // Update auth token before connecting
    s.auth = { token };

    if (!s.connected) {
        s.connect();
    }
    return s;
};

/**
 * Disconnect and destroy socket
 */
const disconnectSocket = () => {
    if (socket && socket.connected) {
        socket.disconnect();
    }
    socket = null;
};

export { getSocket, connectSocket, disconnectSocket };
