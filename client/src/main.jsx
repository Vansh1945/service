import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./store/auth";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Function to update meta tags and favicon
const updateMetaTags = async () => {
  try {
    const response = await fetch(`${API}/system-setting/system-data`);
    const data = await response.json();
    
    if (data.success) {
      const config = data.data;
      
      // Update document title
      document.title = config.companyName || "Service App";
      
      // Update description meta tag
      let descriptionMeta = document.querySelector('meta[name="description"]');
      if (!descriptionMeta) {
        descriptionMeta = document.createElement("meta");
        descriptionMeta.name = "description";
        document.head.appendChild(descriptionMeta);
      }
      descriptionMeta.setAttribute(
        "content",
        config.tagline || "A service booking application"
      );
      
      // Update favicon
      let faviconLink = document.querySelector('link[rel="icon"]');
      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = config.favicon || "/favicon.ico";
    }
  } catch (error) {
    console.error("Failed to update meta tags:", error);
    
    // Set default values
    document.title = "Service App";
    
    let descriptionMeta = document.querySelector('meta[name="description"]');
    if (!descriptionMeta) {
      descriptionMeta = document.createElement("meta");
      descriptionMeta.name = "description";
      document.head.appendChild(descriptionMeta);
    }
    descriptionMeta.setAttribute("content", "A service booking application");
  }
};

// Call the function to update meta tags
updateMetaTags();

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
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
            theme="light"
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);