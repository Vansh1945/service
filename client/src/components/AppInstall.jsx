import React, { useState, useEffect } from 'react';
import { FiX, FiUser, FiSliders, FiSmartphone, FiArrowRight } from 'react-icons/fi';
import * as SystemService from '../services/SystemService';

const AppInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isIosInstructions, setIsIosInstructions] = useState(false);
  const [customerBranding, setCustomerBranding] = useState(null);
  const [providerBranding, setProviderBranding] = useState(null);

  useEffect(() => {
    const handleBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBIP);
    return () => window.removeEventListener('beforeinstallprompt', handleBIP);
  }, []);

  useEffect(() => {
    const handleTrigger = () => {
      setIsOpen(true);
      setIsIosInstructions(false);
      setSelectedRole(null);
    };
    window.addEventListener('triggerPwaInstall', handleTrigger);
    return () => window.removeEventListener('triggerPwaInstall', handleTrigger);
  }, []);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const custRes = await SystemService.getBrandingSettings('customer');
        const provRes = await SystemService.getBrandingSettings('provider');
        if (custRes.data?.success) setCustomerBranding(custRes.data.data);
        if (provRes.data?.success) setProviderBranding(provRes.data.data);
      } catch (err) {
        console.error("Failed to load branding data in PWA modal:", err);
      }
    };
    fetchBranding();
  }, []);

  if (!isOpen) return null;

  const handleSelectRole = async (role) => {
    setSelectedRole(role);
    const apiBase = import.meta.env.VITE_BACKEND_URL || (window.location.origin + "/api");
    const version = Date.now();
    const manifestUrl = `${apiBase}/system-setting/settings/branding/${role}/manifest?v=${version}`;

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
      setTimeout(async () => {
        try {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`[PWA Install] Install prompt outcome: ${outcome}`);
          if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setIsOpen(false);
          }
        } catch (err) {
          console.error("PWA Install error:", err);
        }
      }, 300);
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        setIsIosInstructions(true);
      } else {
        alert("This app can be installed from your browser's menu (click on the share/install button in your browser address bar).");
        setIsOpen(false);
      }
    }
  };

  const activeBranding = selectedRole === 'customer' ? customerBranding : providerBranding;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-white border border-slate-100 rounded-3xl shadow-2xl overflow-hidden relative animate-scale-up">
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition-all"
        >
          <FiX className="w-5 h-5" />
        </button>

        {!isIosInstructions ? (
          <div className="p-6 md:p-8 space-y-6">
            <div className="space-y-2 text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-bold font-poppins text-slate-900 flex items-center justify-center md:justify-start gap-2">
                <FiSmartphone className="text-teal-500 w-6 h-6 animate-pulse" /> Install Application
              </h2>
              <p className="text-xs md:text-sm text-slate-500">
                Choose which application role branding manifest you want to install on your device's home screen.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Customer Selection Card */}
              <button
                onClick={() => handleSelectRole('customer')}
                className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-teal-500 hover:bg-teal-50/20 flex items-center gap-4 transition-all group relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform">
                  {customerBranding?.icon || customerBranding?.logo ? (
                    <img src={customerBranding.icon || customerBranding.logo} alt="Customer" className="w-8 h-8 object-cover rounded-lg" />
                  ) : (
                    <FiUser className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-black text-teal-600 uppercase tracking-widest">Customer Application</span>
                  <h3 className="font-extrabold text-sm text-slate-850 mt-0.5 truncate">
                    {customerBranding?.appName || "Raj Electrical Customer"}
                  </h3>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {customerBranding?.description || "Book certified electricians instantly"}
                  </span>
                </div>
                <FiArrowRight className="w-5 h-5 text-slate-450 group-hover:translate-x-1.5 transition-transform" />
              </button>

              {/* Provider Selection Card */}
              <button
                onClick={() => handleSelectRole('provider')}
                className="w-full text-left p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/20 flex items-center gap-4 transition-all group relative overflow-hidden"
              >
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                  {providerBranding?.icon || providerBranding?.logo ? (
                    <img src={providerBranding.icon || providerBranding.logo} alt="Provider" className="w-8 h-8 object-cover rounded-lg" />
                  ) : (
                    <FiSliders className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-xs font-black text-emerald-600 uppercase tracking-widest">Provider Partner App</span>
                  <h3 className="font-extrabold text-sm text-slate-850 mt-0.5 truncate">
                    {providerBranding?.appName || "Raj Provider App"}
                  </h3>
                  <span className="block text-[10px] text-slate-400 truncate">
                    {providerBranding?.description || "Accept bookings and manage jobs"}
                  </span>
                </div>
                <FiArrowRight className="w-5 h-5 text-slate-450 group-hover:translate-x-1.5 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
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

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"
              >
                Understood, Got It
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInstall;
