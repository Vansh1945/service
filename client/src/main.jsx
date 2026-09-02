import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from "@sentry/react";
import App from "./App";
import { AuthProvider } from "../src/context/auth";
import { NotificationProvider } from "../src/context/NotificationContext";
import { HelmetProvider } from "react-helmet-async";
import { initWebVitals } from "../firebase";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Initialize Sentry for React Frontend Error Monitoring
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE || 'production',
  });
  console.log('[Sentry React] Initialized successfully.');
}

// Initialize Real User Performance Web Vitals tracking
initWebVitals();

// Capture PWA beforeinstallprompt globally as early as possible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredInstallPrompt = e;
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30 seconds stale time
      gcTime: 5 * 60 * 1000, // 5 minutes cache/garbage collection time
    },
  },
});

import { ConfirmProvider } from "./context/ConfirmContext";
import { AppErrorBoundary } from "./components/ui/Error";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <ConfirmProvider>
                <HelmetProvider>
                  <App />
                </HelmetProvider>
              </ConfirmProvider>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
// PWA Service Worker Registration
const getBrandingVersion = () => {
  const custVer = localStorage.getItem("app_version_customer") || "1";
  const provVer = localStorage.getItem("app_version_provider") || "1";
  const adminVer = localStorage.getItem("app_version_admin") || "1";
  return `${custVer}_${provVer}_${adminVer}`;
};

if ('serviceWorker' in navigator) {
  const version = getBrandingVersion();
  navigator.serviceWorker.register(`/sw.js?v=${version}`).catch(err => {
    if (import.meta.env.DEV) {
      console.error('SW registration failed:', err);
    }
  });
}
