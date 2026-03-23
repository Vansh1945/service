// This file is in the public folder and is not parsed by Vite
// Therefore, we use importScripts to load the Firebase SDK from CDN

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

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png',
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});