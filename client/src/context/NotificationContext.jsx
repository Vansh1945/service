import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../../firebase';
import { useAuth } from './auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { token, isAuthenticated, API } = useAuth();
    const navigate = useNavigate();
    const [fcmToken, setFcmToken] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    const savedTokenRef = useRef(null);

    // Save token to backend
    const saveTokenToBackend = async (newToken, authToken) => {
        if (!newToken || !authToken) return;
        
        if (localStorage.getItem("fcmToken") === newToken) return;

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
                await saveTokenToBackend(currentToken, authToken);
            } else {
                console.warn('[FCM] No token available.');
            }
        } catch (err) {
            console.error('[FCM] Error generating token:', err);
        }
    };

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

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        const handleSWMessage = (event) => {
            if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
                navigate(event.data.url);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }, [navigate]);

    useEffect(() => {
        if (!isAuthenticated || !token) return;

        if (Notification.permission === 'granted') {
            initFCMToken(token);
        } else if (Notification.permission === 'default') {
            requestPermission();
        }

        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message received:', payload);

            const title = payload.notification?.title || payload.data?.title || 'New Notification';
            const body = payload.notification?.body || payload.data?.body || '';
            const url = payload.data?.url || '/';

            // Standard Toast notification (No custom UI)
            toast.info(`${title}: ${body}`, {
                onClick: () => {
                    if (url) navigate(url);
                },
                autoClose: 6000,
            });
            
            // Still trigger standard desktop notification if authorized
            if (Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { url }
                });

                notif.onclick = () => {
                    navigate(notif.data.url);
                    notif.close();
                };
            }
        });

        return () => unsubscribe();
    }, [isAuthenticated, token]);

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
