import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../../firebase';
import { useAuth } from './auth';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { token, isAuthenticated, API } = useAuth();
    const [fcmToken, setFcmToken] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    const messaging = getMessaging(app);

    // Request permission and get token
    const requestPermission = async () => {
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                const currentToken = await getToken(messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                });
                if (currentToken) {
                    setFcmToken(currentToken);
                    console.log('FCM Token Generated Successfully:', currentToken);
                    return currentToken;
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                }
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
        }
    };

    // Save token to backend
    const saveTokenToBackend = async (newToken) => {
        if (!isAuthenticated || !newToken) return;
        try {
            await fetch(`${API}/notifications/save-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: newToken })
            });
            console.log('FCM Token synchronized with backend successfully.');
        } catch (err) {
            console.error('Failed to save FCM token to backend:', err);
        }
    };

    // Initialize FCM
    useEffect(() => {
        if (isAuthenticated && notificationPermission === 'granted') {
            requestPermission().then(saveTokenToBackend);
        }

        // Handle foreground messages
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Message received. ', payload);
            // Show a custom toast or browser notification if the app is in foreground
            new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: payload.notification.icon || '/logo.png'
            });
        });

        return () => unsubscribe();
    }, [isAuthenticated, notificationPermission]);

    // Handle initial permission request
    useEffect(() => {
        if (isAuthenticated && notificationPermission === 'default') {
            requestPermission();
        }
    }, [isAuthenticated]);

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
