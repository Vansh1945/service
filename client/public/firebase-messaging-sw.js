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

    // ✅ DO NOT manually show notification if notification key exists
    // Let Firebase handle the notification automatically to prevent duplicates
    if (payload.notification) return;

    const title = payload.data?.title || 'New Notification';
    const body = payload.data?.body || '';
    const icon = '/icon-192.png';
    const badge = '/icon-192.png';

    const notificationOptions = {
        body,
        icon,
        badge,
        tag: payload.data?.type || 'general', // Replaces same-type notifications instead of stacking
        data: payload.data || {},
        vibrate: [200, 100, 200],
        requireInteraction: false, // Auto-dismiss on mobile
        actions: [
            {
                action: 'open',
                title: 'Open App'
            }
        ]
    };

    self.registration.showNotification(title, notificationOptions);
});

// ✅ Handle notification click — deep-link to specific route
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    // Extract deep-link URL from notification data
    const data = event.notification.data || {};
    const deepLink = data.url || '/';
    const urlToOpen = self.location.origin + deepLink;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open, navigate it to the deep-link route
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'NAVIGATE', url: deepLink });
                    return client.focus();
                }
            }
            // Otherwise open a new window at the deep-link URL
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