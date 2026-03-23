import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/auth';
import { connectSocket, disconnectSocket, getSocket } from './socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { token, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const socketRef = useRef(null);

    // Connect when user logs in
    useEffect(() => {
        if (token && user) {
            const s = connectSocket();
            socketRef.current = s;

            s.on('connect', () => {
                setIsConnected(true);
                console.log('Socket connected:', s.id);
            });

            s.on('disconnect', () => {
                setIsConnected(false);
                console.log('Socket disconnected');
            });

            s.on('connect_error', (err) => {
                console.warn('Socket connection error:', err.message);
            });

            return () => {
                s.off('connect');
                s.off('disconnect');
                s.off('connect_error');
            };
        } else {
            // Disconnect when user logs out
            disconnectSocket();
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
        socket: socketRef.current,
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
