import React, { useState, useEffect } from 'react';
import { FiX, FiSmartphone, FiPlusSquare, FiShare } from 'react-icons/fi';
import { useAuth } from '../context/auth';

const AppInstall = () => {
  const { systemSettings } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredInstallPrompt || null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isIosInstructions, setIsIosInstructions] = useState(false);
  const [isAndroidInstructions, setIsAndroidInstructions] = useState(false);
  const [customerBranding, setCustomerBranding] = useState(null);
  const [providerBranding, setProviderBranding] = useState(null);

  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.customerBranding) {
        setCustomerBranding(systemSettings.customerBranding);
      }
      if (systemSettings.providerBranding) {
        setProviderBranding(systemSettings.providerBranding);
      }
    }
  }, [systemSettings]);

  // Helper to detect current user role based on path or localStorage
  const detectRole = () => {
    let currentRole = localStorage.getItem("installRole");
    const path = window.location.pathname;
    if (path.startsWith("/admin")) {
      currentRole = "admin";
    }
    if (!currentRole || !["customer", "provider", "admin"].includes(currentRole)) {
      if (path.startsWith("/provider")) {
        currentRole = "provider";
      } else {
        currentRole = "customer";
      }
    }
    return currentRole;
  };

  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    const apiBase = import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api");
    const version = Date.now();
    const manifestUrl = `${apiBase}/system-setting/settings/branding/${role}/manifest?v=${version}&origin=${encodeURIComponent(window.location.origin)}`;

    let manifestLink = document.querySelector("link[rel='manifest']");
    if (manifestLink) {
      manifestLink.setAttribute("href", manifestUrl);
    } else {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      manifestLink.href = manifestUrl;
      document.head.appendChild(manifestLink);
    }

    localStorage.setItem("installMode", "standalone");
    localStorage.setItem("installRole", role);

    const branding = role === 'customer' ? customerBranding : providerBranding;
    if (branding) {
      const appleTitle = document.querySelector("meta[name='apple-mobile-web-app-title']");
      if (appleTitle) {
        appleTitle.setAttribute("content", branding.shortName || (role === 'customer' ? 'Customer App' : 'Provider App'));
      }
      
      const iconUrl = branding.icon || branding.logo || '/icon-192.png';
      const appleIcon = document.querySelector("link[rel='apple-touch-icon']");
      if (appleIcon) {
        appleIcon.setAttribute("href", iconUrl);
      }
      
      const splashUrl = branding.splashScreen || iconUrl;
      const appleSplash = document.querySelector("link[rel='apple-touch-startup-image']");
      if (appleSplash) {
        appleSplash.setAttribute("href", splashUrl);
      } else {
        const link = document.createElement("link");
        link.rel = "apple-touch-startup-image";
        link.href = splashUrl;
        document.head.appendChild(link);
      }
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA Install] Install prompt outcome: ${outcome}`);
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
        }
        setIsOpen(false);
      } catch (err) {
        console.error("PWA Install error:", err);
        setIsOpen(false);
      }
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        setIsIosInstructions(true);
      } else {
        setIsAndroidInstructions(true);
      }
    }
  };

  useEffect(() => {
    const handleBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredInstallPrompt = e;
    };
    window.addEventListener('beforeinstallprompt', handleBIP);
    return () => window.removeEventListener('beforeinstallprompt', handleBIP);
  }, []);

  useEffect(() => {
    const handleTrigger = () => {
      setIsOpen(true);
      setIsIosInstructions(false);
      setIsAndroidInstructions(false);
      setSelectedRole(null);
    };
    window.addEventListener('triggerPwaInstall', handleTrigger);
    return () => window.removeEventListener('triggerPwaInstall', handleTrigger);
  }, []);

  if (!isOpen) return null;

  const activeBranding = selectedRole === 'customer' ? customerBranding : providerBranding;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden relative animate-scale-up">
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 z-50 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-all"
        >
          <FiX className="w-5 h-5" />
        </button>

        {selectedRole === null ? (
          <div className="p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold font-poppins text-slate-900 mt-2">
                Choose App to Install
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select which version of the application you would like to install on your device.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {/* Customer App Option */}
              <button
                onClick={() => handleSelectRole('customer')}
                className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-teal-500 rounded-2xl transition-all duration-300 group active:scale-95 text-center"
              >
                <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {customerBranding?.icon || customerBranding?.logo ? (
                    <img src={customerBranding.icon || customerBranding.logo} alt="Customer Logo" className="w-10 h-10 object-cover rounded-lg" />
                  ) : (
                    <FiSmartphone className="w-8 h-8 text-teal-600" />
                  )}
                </div>
                <h3 className="font-bold text-sm text-slate-800 font-poppins">Customer App</h3>
                <p className="text-[10px] text-slate-500 mt-1">Book services & manage orders</p>
              </button>

              {/* Provider App Option */}
              <button
                onClick={() => handleSelectRole('provider')}
                className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-indigo-500 rounded-2xl transition-all duration-300 group active:scale-95 text-center"
              >
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {providerBranding?.icon || providerBranding?.logo ? (
                    <img src={providerBranding.icon || providerBranding.logo} alt="Provider Logo" className="w-10 h-10 object-cover rounded-lg" />
                  ) : (
                    <FiSmartphone className="w-8 h-8 text-indigo-600" />
                  )}
                </div>
                <h3 className="font-bold text-sm text-slate-800 font-poppins">Provider App</h3>
                <p className="text-[10px] text-slate-500 mt-1">Manage jobs, rates & settings</p>
              </button>
            </div>
          </div>
        ) : isIosInstructions ? (
          <div className="p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 mx-auto bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-550 mb-4">
                {activeBranding?.icon || activeBranding?.logo ? (
                  <img src={activeBranding.icon || activeBranding.logo} alt="Selected App" className="w-10 h-10 object-cover rounded-lg" />
                ) : (
                  <FiSmartphone className="w-8 h-8" />
                )}
              </div>
              <h2 className="text-xl font-bold font-poppins text-slate-900">
                How to install {activeBranding?.shortName || (selectedRole === 'customer' ? 'Customer App' : 'Provider App')}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your iOS device requires a manual installation step as standard Safari doesn't support automatic prompting.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">1</span>
                <p className="mt-0.5">Tap the <strong>Share</strong> button at the bottom of Safari (usually looks like a box with an upward arrow).</p>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">2</span>
                <p className="mt-0.5">Scroll down and tap <strong>Add to Home Screen</strong>.</p>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">3</span>
                <p className="mt-0.5">Confirm by tapping <strong>Add</strong> in the top-right corner to launch {activeBranding?.shortName}.</p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 text-slate-650 hover:bg-slate-100 rounded-xl font-medium text-xs transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Understood, Got It
              </button>
            </div>
          </div>
        ) : isAndroidInstructions ? (
          <div className="p-6 md:p-8 space-y-6 animate-fade-in">
            <div className="space-y-2 text-center">
              <div className="w-16 h-16 mx-auto bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-600 mb-4">
                {activeBranding?.icon || activeBranding?.logo ? (
                  <img src={activeBranding.icon || activeBranding.logo} alt="Selected App" className="w-10 h-10 object-cover rounded-lg" />
                ) : (
                  <FiSmartphone className="w-8 h-8" />
                )}
              </div>
              <h2 className="text-xl font-bold font-poppins text-slate-900">
                Install {activeBranding?.appName || (selectedRole === 'customer' ? 'Customer App' : 'Provider App')}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Follow these simple steps in your browser to add the app directly to your home screen:
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">1</span>
                <p className="mt-0.5 flex items-center gap-1">
                  Tap the browser menu button <strong className="text-slate-900">⋮</strong> or <strong className="text-slate-900">⋯</strong> (usually in top-right or bottom-center).
                </p>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">2</span>
                <p className="mt-0.5 flex items-center gap-1.5">
                  Look for <strong className="text-slate-900">Install App</strong> or <strong className="text-slate-900">Add to Home Screen</strong> <FiPlusSquare className="inline text-slate-700" />.
                </p>
              </div>
              <div className="flex items-start gap-3 text-xs text-slate-650">
                <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold flex-shrink-0">3</span>
                <p className="mt-0.5">
                  Click install to launch the application instantly as a standalone app!
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                onClick={() => setSelectedRole(null)}
                className="px-4 py-2 text-slate-650 hover:bg-slate-100 rounded-xl font-medium text-xs transition-all"
              >
                Back
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Close Instructions
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-6 text-center">
            <h2 className="text-xl font-bold font-poppins text-slate-900 flex items-center justify-center gap-2">
              Preparing Installation...
            </h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInstall;
