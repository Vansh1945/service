import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import { getAuth } from "firebase/auth";
import { getAnalytics, logEvent, isSupported as isAnalyticsSupported } from "firebase/analytics";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase — single instance
const app = initializeApp(firebaseConfig);

// Single messaging instance (reused everywhere)
const messaging = getMessaging(app);

// Auth instance
const auth = getAuth(app);

// Initialize Firebase Analytics safely
let analytics = null;
if (typeof window !== "undefined" && firebaseConfig.measurementId) {
    isAnalyticsSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
            console.log("[Firebase Analytics] Initialized successfully.");
        }
    }).catch(err => {
        console.warn("[Firebase Analytics] Analytics initialization warning:", err.message);
    });
}

/**
 * Unified Single-Page Application (SPA) Page View Tracker
 * Sends page_view event to Google Analytics 4 (gtag) and Firebase Analytics
 */
export const trackPageView = (path, title = "") => {
    try {
        const fullPath = path || (window.location.pathname + window.location.search);
        const pageTitle = title || document.title;

        // 1. GA4 gtag config update
        const gaId = import.meta.env.VITE_GA_ID;
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
            if (gaId && gaId !== "%VITE_GA_ID%") {
                window.gtag("config", gaId, {
                    page_path: fullPath,
                    page_title: pageTitle
                });
            }
            window.gtag("event", "page_view", {
                page_path: fullPath,
                page_title: pageTitle
            });
        }

        // 2. Firebase Analytics logEvent
        if (analytics) {
            logEvent(analytics, "page_view", {
                page_path: fullPath,
                page_title: pageTitle
            });
        }
    } catch (err) {
        console.warn("[Analytics] trackPageView error:", err.message);
    }
};

/**
 * Unified External Business Event Tracker
 * Handles GA4, Firebase Analytics, and external event logging
 */
export const trackEvent = (eventName, eventParams = {}) => {
    try {
        if (!eventName) return;

        // 1. GA4 Event Tracking
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
            window.gtag("event", eventName, eventParams);
        }

        // 2. Firebase Analytics Event Tracking
        if (analytics) {
            logEvent(analytics, eventName, eventParams);
        }
    } catch (err) {
        console.warn(`[Analytics] trackEvent (${eventName}) error:`, err.message);
    }
};

/**
 * Core Web Vitals RUM (Real User Monitoring) Tracker
 * Measures LCP, INP, CLS, FCP, TTFB and reports to GA4 + Firebase + Sentry
 */
export const initWebVitals = () => {
    if (typeof window === "undefined") return;

    import("web-vitals").then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
        const sendMetric = (metric) => {
            const params = {
                event_category: "Web Vitals",
                value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
                metric_id: metric.id,
                metric_value: metric.value,
                metric_rating: metric.rating
            };

            trackEvent(metric.name, params);
        };

        onLCP(sendMetric);
        onINP(sendMetric);
        onCLS(sendMetric);
        onFCP(sendMetric);
        onTTFB(sendMetric);
    }).catch(err => {
        console.warn("[Web Vitals] Failed to load web-vitals module:", err.message);
    });
};

export { app, messaging, auth, analytics };
