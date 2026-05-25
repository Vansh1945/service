export const SYSTEM_SETTINGS_CACHE_KEY = "systemSettings";
export const SYSTEM_SETTINGS_UPDATED_EVENT = "systemSettingsUpdated";
export const DEFAULT_TIME_FORMAT = "12h";

export const normalizeTimeFormat = (timeFormat) =>
  timeFormat === "24h" ? "24h" : DEFAULT_TIME_FORMAT;

export const readSystemSettingsCache = () => {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const cachedSettings = window.localStorage.getItem(SYSTEM_SETTINGS_CACHE_KEY);
    if (!cachedSettings) return null;

    const parsedSettings = JSON.parse(cachedSettings);
    const data =
      parsedSettings?.data && typeof parsedSettings.data === "object"
        ? parsedSettings.data
        : {};

    return {
      data: {
        ...data,
        timeFormat: normalizeTimeFormat(data.timeFormat),
      },
      timestamp: Number(parsedSettings?.timestamp) || 0,
    };
  } catch {
    return null;
  }
};

export const readCachedSystemSettings = () => readSystemSettingsCache()?.data || {};

export const getCachedTimeFormat = () =>
  normalizeTimeFormat(readCachedSystemSettings().timeFormat);

export const writeSystemSettingsCache = (settings = {}, timestamp = Date.now()) => {
  if (typeof window === "undefined" || !window.localStorage) {
    return {
      ...settings,
      timeFormat: normalizeTimeFormat(settings.timeFormat),
    };
  }

  const currentSettings = readCachedSystemSettings();
  const nextSettings = {
    ...currentSettings,
    ...settings,
    timeFormat: normalizeTimeFormat(settings.timeFormat ?? currentSettings.timeFormat),
  };

  window.localStorage.setItem(
    SYSTEM_SETTINGS_CACHE_KEY,
    JSON.stringify({ data: nextSettings, timestamp })
  );

  window.dispatchEvent(
    new CustomEvent(SYSTEM_SETTINGS_UPDATED_EVENT, { detail: nextSettings })
  );

  return nextSettings;
};
