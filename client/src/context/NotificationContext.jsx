import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '../../firebase';
import { useAuth } from './auth';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket/socket';

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
    const activeAudioRef = useRef(null);

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

            const payloadData = payload.data || {};
            const payloadNotif = payload.notification || {};

            const title = payloadNotif.title || payloadData.title || 'New Notification';
            const body = payloadNotif.body || payloadData.body || '';

            // Foreground App Update Interceptor
            if (payloadData.type === 'app_update') {
                console.log('[FCM Foreground Intercept] App update notification detected.');
                window.dispatchEvent(new CustomEvent('appUpdateReceived', {
                    detail: {
                        forceRefresh: payloadData.forceRefresh,
                        body: body,
                        releaseNotes: body
                    }
                }));
                return;
            }

            const targetRoute = payloadData.route || payloadData.url || '/';
            const requiredRole = payloadData.role;
            const entityId = payloadData.entityId;

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

            // Stop any currently playing alert tone
            if (activeAudioRef.current) {
                try {
                    activeAudioRef.current.pause();
                    activeAudioRef.current.currentTime = 0;
                } catch (audioErr) {
                    console.error('Error stopping previous audio:', audioErr);
                }
                activeAudioRef.current = null;
            }

            // Handle dedicated provider booking alert sound/vibrate in foreground
            const isBookingAlert = payloadData.isBookingAlert === 'true';
            if (isBookingAlert) {
                const soundUrl = payloadData.soundUrl;
                const bookingAlertTone = payloadData.bookingAlertTone !== 'false';
                const bookingVibration = payloadData.bookingVibration !== 'false';
                const bookingAlertDuration = Number(payloadData.bookingAlertDuration || 30);
                const bookingRepeatAlert = payloadData.bookingRepeatAlert === 'true';

                if (bookingAlertTone && soundUrl) {
                    const audio = new Audio(soundUrl);
                    audio.loop = bookingRepeatAlert;
                    activeAudioRef.current = audio;
                    audio.play().catch((playErr) => {
                        console.warn('[FCM Context] Foreground audio auto-play blocked by browser. Awaiting user interaction.', playErr);
                    });

                    // Set timeout to auto-stop the alert tone
                    setTimeout(() => {
                        if (activeAudioRef.current === audio) {
                            try {
                                audio.pause();
                                audio.currentTime = 0;
                            } catch (pauseErr) {
                                console.error('Error auto-stopping alert audio:', pauseErr);
                            }
                            if (activeAudioRef.current === audio) {
                                activeAudioRef.current = null;
                            }
                        }
                    }, bookingAlertDuration * 1000);
                }

                if (bookingVibration && 'vibrate' in navigator) {
                    navigator.vibrate([500, 200, 500, 200, 500]);
                }
            }

            if (Notification.permission === 'granted') {
                const notif = new Notification(title, {
                    body: body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    data: { url: targetRoute, role: requiredRole, entityId: entityId, notificationId: payloadData.notificationId || null }
                });

                notif.onclick = () => {
                    // Stop playing ringtone immediately when user clicks the notification banner
                    if (activeAudioRef.current) {
                        try {
                            activeAudioRef.current.pause();
                            activeAudioRef.current.currentTime = 0;
                        } catch (audioErr) {
                            console.error('Error stopping audio on notification click:', audioErr);
                        }
                        activeAudioRef.current = null;
                    }

                    if (payloadData.notificationId) {
                        NotificationService.markClicked(payloadData.notificationId).catch(err => {
                            console.error('[FCM Foreground] Click event tracking failed:', err);
                        });
                    }
                    handleNavigation();
                    notif.close();
                };
            }
        });

        return () => {
            unsubscribe();
            if (activeAudioRef.current) {
                try {
                    activeAudioRef.current.pause();
                } catch (e) {}
            }
        };
    }, [isAuthenticated, token, userRole, isAdmin]);

    // Socket-based fallback to trigger ringtone for real-time notifications
    useEffect(() => {
        if (!token) return;

        const socket = getSocket();
        if (!socket) return;

        const handleSocketNotification = (payload) => {
            console.log('[Socket] Notification received in context:', payload);
            if (payload.isBookingAlert) {
                const soundUrl = payload.soundUrl;
                const bookingAlertTone = payload.bookingAlertTone !== false;
                const bookingVibration = payload.bookingVibration !== false;
                const bookingAlertDuration = Number(payload.bookingAlertDuration || 30);
                const bookingRepeatAlert = payload.bookingRepeatAlert === true;

                // Stop any currently playing alert tone
                if (activeAudioRef.current) {
                    try {
                        activeAudioRef.current.pause();
                        activeAudioRef.current.currentTime = 0;
                    } catch (audioErr) {
                        console.error('Error stopping previous audio:', audioErr);
                    }
                    activeAudioRef.current = null;
                }

                if (bookingAlertTone && soundUrl) {
                    const audio = new Audio(soundUrl);
                    audio.loop = bookingRepeatAlert;
                    activeAudioRef.current = audio;
                    audio.play().catch((playErr) => {
                        console.warn('[Socket Context] Foreground audio auto-play blocked by browser. Awaiting user interaction.', playErr);
                    });

                    // Set timeout to auto-stop the alert tone
                    setTimeout(() => {
                        if (activeAudioRef.current === audio) {
                            try {
                                audio.pause();
                                audio.currentTime = 0;
                            } catch (pauseErr) {
                                console.error('Error auto-stopping alert audio:', pauseErr);
                            }
                            if (activeAudioRef.current === audio) {
                                activeAudioRef.current = null;
                            }
                        }
                    }, bookingAlertDuration * 1000);
                }

                if (bookingVibration && 'vibrate' in navigator) {
                    navigator.vibrate([500, 200, 500, 200, 500]);
                }
            }
        };

        socket.on('new_notification', handleSocketNotification);
        return () => {
            socket.off('new_notification', handleSocketNotification);
        };
    }, [token]);

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
