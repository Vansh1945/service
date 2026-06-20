import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from "./App";
import { AuthProvider } from "../src/context/auth";
import { NotificationProvider } from "../src/context/NotificationContext";
import { HelmetProvider } from "react-helmet-async";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import "leaflet/dist/leaflet.css";

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

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <ConfirmProvider>
              <HelmetProvider>
                <App />
              </HelmetProvider>
            </ConfirmProvider>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
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
  navigator.serviceWorker.register(`/sw.js?v=${version}`).catch(err => console.error('SW registration failed:', err));
}
