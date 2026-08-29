import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';

// Simple Event Bus for global toast management without extra libraries
const toastListeners = new Set();
let toastIdCounter = 0;
const recentToastsMap = new Map();

function notifyListeners(toastAction) {
  toastListeners.forEach(listener => listener(toastAction));
}



// Global imperative toast object matching standard API signatures
export const toast = (message, options = {}) => {
  return toast.info(message, options);
};

toast.success = (message, options = {}) => {
  return createToast('success', message, options);
};

toast.error = (message, options = {}) => {
  return createToast('error', message, options);
};

toast.warning = (message, options = {}) => {
  return createToast('warning', message, options);
};

toast.info = (message, options = {}) => {
  return createToast('info', message, options);
};

toast.loading = (message, options = {}) => {
  return createToast('loading', message, { autoClose: false, ...options });
};

toast.dismiss = (toastId) => {
  notifyListeners({ action: 'dismiss', id: toastId });
};

toast.update = (toastId, newOptions = {}) => {
  notifyListeners({ action: 'update', id: toastId, payload: newOptions });
};

toast.promise = async (promise, msgs = {}, options = {}) => {
  const id = toast.loading(msgs.loading || 'Loading...', options);
  try {
    const result = await promise;
    toast.update(id, {
      type: 'success',
      message: typeof msgs.success === 'function' ? msgs.success(result) : (msgs.success || 'Success!'),
      autoClose: options.duration || 4000
    });
    return result;
  } catch (err) {
    toast.update(id, {
      type: 'error',
      message: typeof msgs.error === 'function' ? msgs.error(err) : (msgs.error || err.message || 'An error occurred'),
      autoClose: options.duration || 5000
    });
    throw err;
  }
};

function createToast(type, message, options = {}) {
  // Rapid duplicate spam prevention (suppress identical messages within 400ms)
  const toastKey = `${type}:${message}`;
  const now = Date.now();
  if (recentToastsMap.has(toastKey) && now - recentToastsMap.get(toastKey) < 400 && !options.allowDuplicate) {
    return null;
  }
  recentToastsMap.set(toastKey, now);

  const id = options.id || `toast-${++toastIdCounter}`;
  const duration = typeof options.autoClose === 'number' ? options.autoClose : (options.duration !== undefined ? options.duration : 2000);

  notifyListeners({
    action: 'add',
    toast: {
      id,
      type,
      message,
      title: options.title,
      duration,
      autoClose: type === 'loading' ? false : duration,
      createdAt: now,
      ...options
    }
  });

  return id;
}

// Component Configuration for Status Types matching tailwind.config.js tokens
const TOAST_CONFIG = {
  success: {
    borderAccent: 'border-l-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-1 dark:ring-emerald-500/20',
    icon: CheckCircle,
    role: 'status',
    ariaLive: 'polite'
  },
  error: {
    borderAccent: 'border-l-rose-500',
    badgeBg: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-1 dark:ring-rose-500/20',
    icon: AlertCircle,
    role: 'alert',
    ariaLive: 'assertive'
  },
  warning: {
    borderAccent: 'border-l-amber-500',
    badgeBg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-1 dark:ring-amber-500/20',
    icon: AlertTriangle,
    role: 'alert',
    ariaLive: 'assertive'
  },
  info: {
    borderAccent: 'border-l-sky-500',
    badgeBg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-1 dark:ring-sky-500/20',
    icon: Info,
    role: 'status',
    ariaLive: 'polite'
  },
  loading: {
    borderAccent: 'border-l-blue-500',
    badgeBg: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-1 dark:ring-blue-500/20',
    icon: Loader2,
    role: 'status',
    ariaLive: 'polite'
  }
};

// Single Toast Item Component
const ToastItem = ({ toastItem, onDismiss }) => {
  const config = TOAST_CONFIG[toastItem.type] || TOAST_CONFIG.info;
  const Icon = config.icon;
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!toastItem.autoClose || isPaused) return;

    const timer = setTimeout(() => {
      onDismiss(toastItem.id);
    }, toastItem.duration || 2000);

    return () => clearTimeout(timer);
  }, [toastItem.autoClose, toastItem.duration, toastItem.id, isPaused, onDismiss]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDismiss(toastItem.id);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, y: -12 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role={config.role}
      aria-live={config.ariaLive}
      className={`pointer-events-auto flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 border-l-4 ${config.borderAccent} shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.04)] dark:shadow-none transition-all duration-150 w-full max-w-md`}
    >
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.badgeBg}`}>
        <Icon className={`w-4 h-4 ${toastItem.type === 'loading' ? 'animate-spin' : ''}`} />
      </div>

      <div className="flex-1 min-w-0 pt-0.5 pr-1">
        {toastItem.title && (
          <h5 className="font-semibold text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 tracking-tight mb-0.5 leading-snug">
            {toastItem.title}
          </h5>
        )}
        <p className="text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-relaxed break-words">
          {toastItem.message}
        </p>
      </div>

      {toastItem.type !== 'loading' && (
        <button
          type="button"
          onClick={() => onDismiss(toastItem.id)}
          onKeyDown={handleKeyDown}
          aria-label="Close notification"
          className="shrink-0 p-1 -mr-1 mt-0.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

// Global ToastContainer Component
export const ToastContainer = ({ position = 'top-right', maxToasts = 5 }) => {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handleAction = (event) => {
      if (event.action === 'add') {
        setToasts(prev => {
          // If a toast with the same ID exists, update it
          const existingIndex = prev.findIndex(t => t.id === event.toast.id);
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = { ...updated[existingIndex], ...event.toast };
            return updated;
          }
          // Otherwise add new toast and limit stack to maxToasts
          const updated = [event.toast, ...prev];
          return updated.slice(0, maxToasts);
        });
      } else if (event.action === 'dismiss') {
        if (!event.id) {
          setToasts([]); // Dismiss all if no ID passed
        } else {
          dismissToast(event.id);
        }
      } else if (event.action === 'update') {
        setToasts(prev => prev.map(t => {
          if (t.id === event.id) {
            const newType = event.payload.type || t.type;
            return {
              ...t,
              ...event.payload,
              type: newType,
              autoClose: newType === 'loading' ? false : (event.payload.autoClose !== undefined ? event.payload.autoClose : 2000)
            };
          }
          return t;
        }));
      }
    };

    toastListeners.add(handleAction);
    return () => toastListeners.delete(handleAction);
  }, [dismissToast, maxToasts]);

  return (
    <div
      aria-label="Notifications"
      tabIndex={-1}
      className="fixed top-4 right-0 left-0 sm:left-auto sm:right-4 z-[9999] pointer-events-none flex flex-col items-center sm:items-end gap-2.5 px-4 sm:px-0 max-w-full"
    >
      <AnimatePresence mode="sync">
        {toasts.map(t => (
          <ToastItem key={t.id} toastItem={t} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
