import React, { useState, useEffect } from 'react';
import { FiSmartphone, FiDownload, FiX } from 'react-icons/fi';

const PwaInstallBanner = ({ role = 'customer' }) => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (already installed/PWA)
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone || 
      document.referrer.includes('android-app://') ||
      localStorage.getItem('installMode') === 'standalone';

    // Check if user previously dismissed the install prompt
    const isDismissed = localStorage.getItem(`pwa_install_dismissed_${role}`);

    if (!isStandaloneMode && !isDismissed) {
      // Small timeout to let the page load first for a smoother entry
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowBanner(false);
    }
  }, [role]);

  const handleInstall = () => {
    // Dispatch the PWA install event with the target role details
    const event = new CustomEvent('triggerPwaInstall', {
      detail: { role }
    });
    window.dispatchEvent(event);
  };

  const handleDismiss = () => {
    localStorage.setItem(`pwa_install_dismissed_${role}`, 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  const appName = role === 'provider' ? 'Raj Partner' : 'Raj Service';

  // Use Tailwind Config values: primary (teal) and accent (orange)
  const themeColor = role === 'provider' ? 'from-accent to-accent/80' : 'from-primary to-primary/80';
  const buttonBg = role === 'provider' ? 'bg-accent hover:bg-accent/90' : 'bg-primary hover:bg-primary/90';

  return (
    <div className="fixed top-2 left-1/2 transform -translate-x-1/2 z-[999] w-[92%] max-w-lg animate-in slide-in-from-top-6 duration-350 ease-out">
      <div className="relative overflow-hidden bg-white/95 backdrop-blur-md border border-slate-150 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.12)] p-4 pr-10 flex flex-col sm:flex-row items-center justify-between gap-4">

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2.5 right-2.5 p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-655 rounded-full transition-all active:scale-90"
          aria-label="Dismiss banner"
        >
          <FiX className="w-4 h-4" />
        </button>

        {/* Brand Accent Indicator */}
        <div className={`absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b ${themeColor}`} />

        <div className="flex items-center gap-3.5 text-left w-full">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${themeColor} text-white flex items-center justify-center flex-shrink-0 shadow-md`}>
            <FiSmartphone className="w-5.5 h-5.5 animate-pulse" />
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <h3 className="font-bold text-slate-800 text-sm font-poppins flex items-center gap-1.5 flex-wrap">
              Install {appName} App
              <span className="text-[8px] bg-green-100 text-green-700 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">App</span>
            </h3>
            <p className="text-[11px] text-slate-500 leading-normal max-w-[280px] sm:max-w-none truncate sm:whitespace-normal">
              For live tracking, faster response, and instant updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 hover:bg-slate-50 text-slate-500 rounded-lg font-bold text-xs transition-all active:scale-95"
          >
            Later
          </button>
          <button
            onClick={handleInstall}
            className={`px-4 py-2 ${buttonBg} text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95`}
          >
            <FiDownload className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
