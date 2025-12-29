const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';

export const updateMetaTags = async () => {
  try {
    const response = await fetch(`${API}/system-setting/system-data`);
    const data = await response.json();

    if (data.success && data.data) {
      const config = data.data;

      // Update document title
      document.title = config.companyName || 'Service App';

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
        faviconLink.type = "image/x-icon";
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = config.favicon || "/favicon.ico";

      // Update apple touch icon
      let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!appleTouchIcon) {
        appleTouchIcon = document.createElement("link");
        appleTouchIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleTouchIcon);
      }
      appleTouchIcon.href = config.favicon || "/apple-touch-icon.png";

      // Try to update PWA manifest
      updatePwaManifest(config);
    }
  } catch (error) {
    console.error("Failed to update meta tags:", error);
    setDefaultMetaTags();
  }
};

const updatePwaManifest = async (config) => {
  try {
    // Check if PWA is available
    if ('serviceWorker' in navigator) {
      // Try to get existing manifest
      let manifestLink = document.querySelector('link[rel="manifest"]');
      
      if (manifestLink) {
        // Update existing manifest
        const manifestResponse = await fetch(manifestLink.href);
        const existingManifest = await manifestResponse.json();
        
        const updatedManifest = {
          ...existingManifest,
          name: config.companyName || existingManifest.name,
          short_name: config.companyName ? 
            config.companyName.substring(0, 12) : existingManifest.short_name,
          description: config.tagline || existingManifest.description
        };

        // Update the manifest link
        const manifestBlob = new Blob([JSON.stringify(updatedManifest)], { type: 'application/json' });
        const newManifestUrl = URL.createObjectURL(manifestBlob);
        manifestLink.href = newManifestUrl;
      }
    }
  } catch (error) {
    console.warn("Could not update PWA manifest:", error);
  }
};

const setDefaultMetaTags = () => {
  // Set default values
  document.title = "Service App";
  
  let descriptionMeta = document.querySelector('meta[name="description"]');
  if (!descriptionMeta) {
    descriptionMeta = document.createElement("meta");
    descriptionMeta.name = "description";
    document.head.appendChild(descriptionMeta);
  }
  descriptionMeta.setAttribute("content", "A service booking application");
};

// Optional: Update meta tags on window focus
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    // Update meta tags only once every hour to avoid excessive API calls
    const lastUpdate = localStorage.getItem('metaLastUpdate');
    const now = Date.now();
    
    if (!lastUpdate || (now - parseInt(lastUpdate)) > 3600000) { // 1 hour
      updateMetaTags();
      localStorage.setItem('metaLastUpdate', now.toString());
    }
  });
}