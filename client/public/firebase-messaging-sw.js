// Firebase Messaging Service Worker
// IMPORTANT: This file must be in the PUBLIC folder (not src)
// It is served at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "%%VITE_FIREBASE_API_KEY%%",
    authDomain: "%%VITE_FIREBASE_AUTH_DOMAIN%%",
    projectId: "%%VITE_FIREBASE_PROJECT_ID%%",
    storageBucket: "%%VITE_FIREBASE_STORAGE_BUCKET%%",
    messagingSenderId: "%%VITE_FIREBASE_MESSAGING_SENDER_ID%%",
    appId: "%%VITE_FIREBASE_APP_ID%%",
    measurementId: "%%VITE_FIREBASE_MEASUREMENT_ID%%"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ✅ Background message handler
// This runs when the app is in background, minimized, or CLOSED
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const data = payload.data || {};
    const isBookingAlert = data.isBookingAlert === 'true';
    const soundUrl = data.soundUrl;

    if (soundUrl) {
        // Notify open tabs in the background to play the custom audio sound/ringtone
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    client.postMessage({
                        type: 'PLAY_SOUND',
                        soundUrl: soundUrl,
                        isBookingAlert: isBookingAlert
                    });
                }
            })
            .catch(err => console.error('[SW] Failed to broadcast sound to clients:', err));
    }

    // ✅ If payload contains a top-level notification, the browser/FCM SDK
    // will automatically display it. We return early to avoid showing a duplicate notification.
    if (payload.notification) {
        console.log('[SW] Notification payload exists, browser displays it automatically.');
        return;
    }

    // Fallback logic for data-only messages (silent/foreground-only push notifications)
    const title = data.title || 'New Notification';
    const body = data.body || '';
    
    // Resolve dynamic branding company logo/icon or fall back to standard assets
    const icon = data.icon || data.logo || '/icon-192.png';
    const badge = data.badge || data.icon || data.logo || '/icon-192.png';

    const notificationOptions = {
        body,
        icon,
        badge,
        tag: data.bookingId || data.chatId || data.type || 'general',
        data: data,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        actions: [
            {
                action: 'open',
                title: 'Open App'
            }
        ]
    };

    // Apply custom booking alert ringtone and vibration if configured
    const isHighPriority = data.isHighPriority === 'true' || isBookingAlert;
    
    if (isBookingAlert || isHighPriority) {
        notificationOptions.requireInteraction = true;
        notificationOptions.vibrate = [500, 200, 500, 200, 500];
    }

    self.registration.showNotification(title, notificationOptions);
});

// ✅ Handle notification click — deep-link to specific route
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    // Extract deep-link URL from notification data
    const data = event.notification.data || {};
    const route = data.targetUrl || data.route || data.url || '/';
    const role = data.role || null;
    const entityId = data.entityId || data.bookingId || data.chatId || null;
    const notificationId = data.notificationId || null;

    const searchParams = new URLSearchParams();
    searchParams.append('route', route);
    if (role) searchParams.append('role', role);
    if (entityId) searchParams.append('entityId', entityId);
    if (notificationId) searchParams.append('notificationId', notificationId);
    if (data.updateType) searchParams.append('updateType', data.updateType);
    if (data.version) searchParams.append('version', data.version);
    if (data.forceRefresh) searchParams.append('forceRefresh', data.forceRefresh);

    // Crucial: Must use trailing slash self.location.origin + '/' to correctly match PWA scope
    const urlToOpen = `${self.location.origin}/?${searchParams.toString()}`;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing tab if open
                for (const client of clientList) {
                    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                        client.postMessage({ 
                            type: 'NAVIGATE', 
                            url: route, 
                            role: role, 
                            entityId: entityId,
                            notificationId: notificationId,
                            updateType: data.updateType || null,
                            version: data.version || null,
                            forceRefresh: data.forceRefresh || null
                        });
                        return client.focus();
                    }
                }
                // On cold start, we open the PWA window using the root with trailing slash
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
            .catch((err) => {
                console.error('[SW] Navigation / Focus handler failed, attempting direct window open fallback:', err);
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ✅ Activate SW immediately (don't wait for old SW to die)
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});