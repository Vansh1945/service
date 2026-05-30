import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../../firebase';
import { useAuth } from './auth';
import { useNavigate } from 'react-router-dom';

import * as NotificationService from '../services/NotificationService';

const NotificationContext = createContext(null);

const getPersistentDeviceId = () => {
    let deviceId = localStorage.getItem('persistentDeviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('persistentDeviceId', deviceId);
    }
    return deviceId;
};

export const NotificationProvider = ({ children }) => {
    const { token, isAuthenticated, role: userRole, isAdmin, setIsDeepLink, setIntendedRoute, API } = useAuth();
    const navigate = useNavigate();
    const [fcmToken, setFcmToken] = useState(null);
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
    const savedTokenRef = useRef(null);

    // Save token to backend
    const saveTokenToBackend = async (newToken, authToken) => {
        if (!newToken || !authToken) return;
        
        try {
            const res = await NotificationService.saveToken({
                token: newToken,
                deviceId: getPersistentDeviceId(),
                platform: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile Web' : 'Desktop Web',
                appVersion: '1.0.0'
            });
            if (res.data?.success) {
                localStorage.setItem("fcmToken", newToken);
                console.log('[FCM] Token saved to backend successfully.');
            }
        } catch (err) {
            // Ignore cancellation errors silently
            if (err.name === 'CanceledError' || err.message === 'canceled' || err.code === 'ERR_CANCELED') {
                return;
            }
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
                if (authToken) {
                    await saveTokenToBackend(currentToken, authToken);
                } else {
                    // Anonymous support: cache locally until user logs in
                    localStorage.setItem('tempFcmToken', currentToken);
                }
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
            if (event.data && event.data.type === 'NAVIGATE') {
                if (event.data.updateType === 'app_update' || event.data.updateType === 'branding_update' || event.data.forceRefresh === 'true') {
                    console.log('[FCM Notification Click] App update trigger received from SW:', event.data);
                    window.dispatchEvent(new CustomEvent('appUpdateReceived', { detail: event.data }));
                    return;
                }

                if (event.data.url) {
                    const targetRoute = event.data.url;
                    const requiredRole = event.data.role;
                    const entityId = event.data.entityId;
                    
                    setIsDeepLink?.(true);

                    const targetRouteWithEntity = targetRoute + (entityId ? (targetRoute.includes('?') ? '&' : '?') + 'entityId=' + entityId : '');

                    if (event.data.notificationId) {
                        NotificationService.markClicked(event.data.notificationId).catch(err => {
                            console.error('[FCM Context] Click event tracking failed:', err);
                        });
                    }

                    if (!isAuthenticated) {
                        setIntendedRoute?.(targetRouteWithEntity);
                        navigate('/login');
                        return;
                    }

                    if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                        if (userRole === 'admin' || isAdmin) navigate('/admin/dashboard');
                        else if (userRole === 'provider') navigate('/provider/dashboard');
                        else navigate('/customer/services');
                        return;
                    }

                    navigate(targetRouteWithEntity, { state: { fromNotification: true } });
                }
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    }, [navigate]);

    useEffect(() => {
        if (Notification.permission === 'granted') {
            initFCMToken(token);
        } else if (Notification.permission === 'default') {
            requestPermission();
        }
    }, [isAuthenticated, token]);

    // Attach anonymous token to user account post-login
    useEffect(() => {
        if (isAuthenticated && token) {
            const tempToken = localStorage.getItem('tempFcmToken') || fcmToken;
            if (tempToken) {
                saveTokenToBackend(tempToken, token);
                localStorage.removeItem('tempFcmToken');
            }
        }
    }, [isAuthenticated, token, fcmToken]);

    // Handle PWA cold start deep-linking from search parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const route = urlParams.get('route');
        const requiredRole = urlParams.get('role');
        const entityId = urlParams.get('entityId');
        const notificationId = urlParams.get('notificationId');

        if (route) {
            console.log('[FCM Cold Start] Routing query param detected:', route);
            // Clean up the URL search params so they do not persist
            window.history.replaceState({}, document.title, window.location.pathname);

            const targetRouteWithEntity = route + (entityId ? (route.includes('?') ? '&' : '?') + 'entityId=' + entityId : '');

            if (notificationId) {
                NotificationService.markClicked(notificationId).catch(err => {
                    console.error('[FCM Cold Start] Click event tracking failed:', err);
                });
            }

            if (!isAuthenticated) {
                setIntendedRoute?.(targetRouteWithEntity);
                navigate('/login');
            } else {
                if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                    if (userRole === 'admin' || isAdmin) navigate('/admin/dashboard');
                    else if (userRole === 'provider') navigate('/provider/dashboard');
                    else navigate('/customer/services');
                } else {
                    navigate(targetRouteWithEntity, { state: { fromNotification: true } });
                }
            }
        }
    }, [isAuthenticated, userRole, isAdmin]);

    useEffect(() => {
        if (!token) return;

        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message received:', payload);

            const title = payload.notification?.title || payload.data?.title || 'New Notification';
            const body = payload.notification?.body || payload.data?.body || '';
            
            // Foreground App Update Interceptor
            if (payload.data?.type === 'app_update') {
                console.log('[FCM Foreground Intercept] App update notification detected.');
                window.dispatchEvent(new CustomEvent('appUpdateReceived', { 
                    detail: { 
                        forceRefresh: payload.data?.forceRefresh, 
                        body: body,
                        releaseNotes: body
                    } 
                }));
                return;
            }

            const targetRoute = payload.data?.route || payload.data?.url || '/';
            const requiredRole = payload.data?.role;
            const entityId = payload.data?.entityId;

            const handleNavigation = () => {
                setIsDeepLink?.(true);

                const targetRouteWithEntity = targetRoute + (entityId ? (targetRoute.includes('?') ? '&' : '?') + 'entityId=' + entityId : '');
                
                if (!isAuthenticated) {
                    setIntendedRoute?.(targetRouteWithEntity);
                    navigate('/login');
                    return;
                }

                if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                    if (userRole === 'admin' || isAdmin) navigate('/admin/dashboard');
                    else if (userRole === 'provider') navigate('/provider/dashboard');
                    else navigate('/customer/services');
                    return;
                }

                navigate(targetRouteWithEntity, { state: { fromNotification: true } });
            };

            // Role-based filtering: only show notifications intended for the current user's role
            if (requiredRole && requiredRole !== userRole && !(requiredRole === 'admin' && isAdmin)) {
                console.log(`[FCM] Ignoring notification for role ${requiredRole} (current user role: ${userRole})`);
                return;
            }

            // Removed toast.info to avoid duplicate UI popups, 
            // relying purely on system-level Notification.
            
            if (Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { url: targetRoute, role: requiredRole, entityId: entityId, notificationId: payload.data?.notificationId || null }
                });

                notif.onclick = () => {
                    if (payload.data?.notificationId) {
                        NotificationService.markClicked(payload.data.notificationId).catch(err => {
                            console.error('[FCM Foreground] Click event tracking failed:', err);
                        });
                    }
                    handleNavigation();
                    notif.close();
                };
            }
        });

        return () => unsubscribe();
    }, [isAuthenticated, token, userRole, isAdmin]);

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
