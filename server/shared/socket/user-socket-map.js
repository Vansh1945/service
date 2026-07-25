/**
 * In-memory store for tracking connected users
 * Maps userId (string) → socketId (string)
 */
const userSocketMap = {};

/**
 * Add a user when they connect
 */
const addUser = (userId, socketId) => {
    userSocketMap[userId.toString()] = socketId;
};

/**
 * Remove a user when they disconnect
 */
const removeUser = (socketId) => {
    for (const userId in userSocketMap) {
        if (userSocketMap[userId] === socketId) {
            delete userSocketMap[userId];
            break;
        }
    }
};

/**
 * Get socketId for a given userId
 */
const getSocketId = (userId) => {
    return userSocketMap[userId?.toString()] || null;
};

/**
 * Get all connected user IDs
 */
const getConnectedUsers = () => {
    return Object.keys(userSocketMap);
};

module.exports = { addUser, removeUser, getSocketId, getConnectedUsers, userSocketMap };
