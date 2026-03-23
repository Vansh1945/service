const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { addUser, removeUser } = require('./userSocketMap');
const { setIO: setNotifIO } = require('../utils/notificationHelper');

let io = null;

const initSocket = (httpServer) => {
    const frontendUrl = process.env.FRONTEND_URL;

    io = new Server(httpServer, {
        cors: {
            origin: [frontendUrl, 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5173'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Share io instance with controllers
    setNotifIO(io);

    // JWT Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;

            if (!token || token === 'null' || token === 'undefined') {
                return next(new Error('Authentication token missing'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id?.toString();
            socket.userRole = decoded.role || 'customer';
            socket.userName = decoded.name || 'User';

            if (!socket.userId) {
                return next(new Error('Invalid token payload'));
            }

            next();
        } catch (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication failed'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`✅ Socket connected: ${userId} (${socket.userRole})`);

        // Register user in socket map
        addUser(userId, socket.id);

        // Auto-join personal room and role room (for notifications)
        socket.join(userId.toString());
        if (socket.userRole) {
            socket.join('role_' + socket.userRole);
        }

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`❌ Socket disconnected: ${userId} — ${reason}`);
            removeUser(socket.id);
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
};

/**
 * Get the io instance (for use outside of controllers)
 */
const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

module.exports = { initSocket, getIO };
