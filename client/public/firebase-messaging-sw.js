// Firebase Messaging Service Worker
// IMPORTANT: This file must be in the PUBLIC folder (not src)
// It is served at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyBa4POZSvx62cqq8Mdc8rIBhjIGreNJ-GA",
    authDomain: "raj-electrical.firebaseapp.com",
    projectId: "raj-electrical",
    storageBucket: "raj-electrical.firebasestorage.app",
    messagingSenderId: "710160850410",
    appId: "1:710160850410:web:2e5a539d56b3e12025a693",
    measurementId: "G-DMD24Q474W"
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

// ✅ Handle notification click — opens the app
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    event.notification.close();

    const urlToOpen = self.location.origin + '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
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