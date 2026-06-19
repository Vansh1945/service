export const SYSTEM_SETTINGS_CACHE_KEY = "systemSettings";
export const SYSTEM_SETTINGS_UPDATED_EVENT = "systemSettingsUpdated";
export const DEFAULT_TIME_FORMAT = "12h";

export const normalizeTimeFormat = (timeFormat) =>
  timeFormat === "24h" ? "24h" : DEFAULT_TIME_FORMAT;

// Pure in-memory cache — nothing stored in localStorage or sessionStorage
let _memoryCache = null;

export const readSystemSettingsCache = () => {
  if (typeof window === "undefined") {
    return null;
  }

  // Clean up any stale keys from localStorage/sessionStorage (legacy cleanup)
  if (window.localStorage && window.localStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY)) {
    window.localStorage.removeItem(SYSTEM_SETTINGS_CACHE_KEY);
  }
  if (window.sessionStorage && window.sessionStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY)) {
    window.sessionStorage.removeItem(SYSTEM_SETTINGS_CACHE_KEY);
  }

  if (!_memoryCache) return null;

  const data =
    _memoryCache?.data && typeof _memoryCache.data === "object"
      ? _memoryCache.data
      : {};

  return {
    data: {
      ...data,
      timeFormat: normalizeTimeFormat(data.timeFormat),
    },
    timestamp: Number(_memoryCache?.timestamp) || 0,
  };
};

export const readCachedSystemSettings = () => readSystemSettingsCache()?.data || {};

export const getCachedTimeFormat = () =>
  normalizeTimeFormat(readCachedSystemSettings().timeFormat);

export const writeSystemSettingsCache = (settings = {}, timestamp = Date.now()) => {
  // Clean up any stale keys from localStorage/sessionStorage (legacy cleanup)
  if (typeof window !== "undefined") {
    if (window.localStorage && window.localStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY)) {
      window.localStorage.removeItem(SYSTEM_SETTINGS_CACHE_KEY);
    }
    if (window.sessionStorage && window.sessionStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY)) {
      window.sessionStorage.removeItem(SYSTEM_SETTINGS_CACHE_KEY);
    }
  }

  const currentSettings = readCachedSystemSettings();
  const nextSettings = {
    ...currentSettings,
    ...settings,
    timeFormat: normalizeTimeFormat(settings.timeFormat ?? currentSettings.timeFormat),
  };

  // Store in memory only — not in any browser storage
  _memoryCache = { data: nextSettings, timestamp };

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SYSTEM_SETTINGS_UPDATED_EVENT, { detail: nextSettings })
    );
  }

  return nextSettings;
};
