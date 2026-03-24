import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../../firebase';
import { useAuth } from './auth';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { token, isAuthenticated, API } = useAuth();
    const [fcmToken, setFcmToken] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    const savedTokenRef = useRef(null); // Track last saved token to avoid duplicates

    // Save token to backend
    const saveTokenToBackend = async (newToken, authToken) => {
        if (!newToken || !authToken) return;
        
        // Prevent duplicate API call using localStorage
        if (localStorage.getItem("fcmToken") === newToken) {
            console.log('[FCM] Token already saved in this session.');
            return;
        }

        try {
            const res = await fetch(`${API}/notifications/save-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ token: newToken })
            });
            if (res.ok) {
                localStorage.setItem("fcmToken", newToken);
                console.log('[FCM] Token saved to backend successfully.');
            }
        } catch (err) {
            console.error('[FCM] Failed to save token to backend:', err);
        }
    };

    // Generate FCM token and save it
    const initFCMToken = async (authToken) => {
        try {
            const permission = Notification.permission;
            setNotificationPermission(permission);

            if (permission !== 'granted') return;

            const currentToken = await getToken(messaging, {
                vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
            });

            if (currentToken) {
                setFcmToken(currentToken);
                console.log('[FCM] Token:', currentToken);
                await saveTokenToBackend(currentToken, authToken);
            } else {
                console.warn('[FCM] No token available — permission not granted or SW not registered.');
            }
        } catch (err) {
            console.error('[FCM] Error generating token:', err);
        }
    };

    // Request notification permission from user
    const requestPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                await initFCMToken(token);
            }
        } catch (err) {
            console.error('[FCM] Permission request failed:', err);
        }
    };

    // Run on login or page reload when authenticated
    useEffect(() => {
        if (!isAuthenticated || !token) return;

        if (Notification.permission === 'granted') {
            // Already granted — just fetch & save token
            initFCMToken(token);
        } else if (Notification.permission === 'default') {
            // Ask for permission
            requestPermission();
        }
        // If 'denied', do nothing

        // Handle foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message received:', payload);
            
            // ✅ DO NOT manually show notification if notification key exists (Firebase handles it)
            if (payload.notification) return;

            // Only show custom notification for data messages (if needed)
            if (payload.data && payload.data.title) {
                new Notification(payload.data.title, {
                    body: payload.data.body,
                    icon: '/logo.png'
                });
            }
        });

        return () => unsubscribe();
    }, [isAuthenticated, token]); // Re-run when token changes (login/logout)

    const contextValue = {
        fcmToken,
        notificationPermission,
        requestPermission
    };

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
