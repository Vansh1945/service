import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/auth';
import { connectSocket, disconnectSocket, getSocket } from './socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // Connect when user logs in
    useEffect(() => {
        if (token && user) {
            const s = connectSocket();
            setSocket(s);

            const handleConnect = () => {
                setIsConnected(true);
                console.log('Socket connected:', s.id);
            };

            const handleDisconnect = () => {
                setIsConnected(false);
                console.log('Socket disconnected');
            };

            const handleConnectError = (err) => {
                console.warn('Socket connection error:', err.message);
            };

            s.on('connect', handleConnect);
            s.on('disconnect', handleDisconnect);
            s.on('connect_error', handleConnectError);

            if (s.connected) {
                setIsConnected(true);
            }

            return () => {
                s.off('connect', handleConnect);
                s.off('disconnect', handleDisconnect);
                s.off('connect_error', handleConnectError);
            };
        } else {
            // Disconnect when user logs out
            disconnectSocket();
            setSocket(null);
            setIsConnected(false);
        }
    }, [token, user]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectSocket();
        };
    }, []);

    const value = {
        socket,
        isConnected,
        onlineUsers
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be used within SocketProvider');
    return ctx;
};
