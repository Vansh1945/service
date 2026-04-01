import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../../firebase';
import { useAuth } from './auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
    const { token, isAuthenticated, role: userRole, isAdmin, setIsDeepLink, setIntendedRoute, API } = useAuth();
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
                const targetRoute = event.data.url;
                const requiredRole = event.data.role;
                
                setIsDeepLink?.(true);

                if (!isAuthenticated) {
                    setIntendedRoute?.(targetRoute);
                    navigate('/login');
                    return;
                }

                if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                    if (userRole === 'admin' || isAdmin) navigate('/admin/dashboard');
                    else if (userRole === 'provider') navigate('/provider/dashboard');
                    else navigate('/customer/services');
                    return;
                }

                navigate(targetRoute, { state: { fromNotification: true } });
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
            const targetRoute = payload.data?.route || payload.data?.url || '/';
            const requiredRole = payload.data?.role;

            const handleNavigation = () => {
                setIsDeepLink?.(true);
                
                if (!isAuthenticated) {
                    setIntendedRoute?.(targetRoute);
                    navigate('/login');
                    return;
                }

                if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                    if (userRole === 'admin' || isAdmin) navigate('/admin/dashboard');
                    else if (userRole === 'provider') navigate('/provider/dashboard');
                    else navigate('/customer/services');
                    return;
                }

                navigate(targetRoute, { state: { fromNotification: true } });
            };

            toast.info(`${title}: ${body}`, {
                onClick: handleNavigation,
                autoClose: 6000,
            });
            
            if (Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { url: targetRoute, role: requiredRole }
                });

                notif.onclick = () => {
                    handleNavigation();
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
