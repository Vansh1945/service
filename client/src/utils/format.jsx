/**
 * Standard Single Source of Truth for Data & Value Formatting.
 * All data formatting (Dates, Times, Currencies, Numbers, Phone, Address, IDs, Files)
 * must be done through these functions to guarantee application-wide consistency.
 */
import { getCachedTimeFormat, readCachedSystemSettings } from './systemSettingsCache';
import { latLngToS2CellId } from './s2Helper';

const FALLBACK = "--";

/* =========================================================
   CLOCK & TIME PARSING HELPERS
   ========================================================= */

const parseClockTime = (time) => {
  if (!time || typeof time !== "string") return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return { hour, minute };
};

const formatClockTime = ({ hour, minute }, timeFormat = getCachedTimeFormat()) => {
  const formattedMinute = String(minute).padStart(2, "0");

  if (timeFormat === "24h") {
    return `${String(hour).padStart(2, "0")}:${formattedMinute}`;
  }

  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${formattedMinute} ${ampm}`;
};

export { parseClockTime, formatClockTime };

/* =========================================================
   DATE & TIME FORMATTERS (SYSTEM SETTINGS REACTIVE)
   ========================================================= */

/**
 * Format date to a readable string based on System Settings (e.g., 15 May 2024 or DD/MM/YYYY)
 * @param {Date|string|number} date - The date to format
 * @param {Object} [options] - Optional overrides
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return FALLBACK;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return FALLBACK;

    const settings = readCachedSystemSettings();
    const timezone = options.timezone || settings.timezone || "Asia/Kolkata";
    const locale = options.locale || settings.locale || "en-IN";

    // Standard localized date string
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: timezone,
      ...options
    });
  } catch {
    return FALLBACK;
  }
};

export const fmtDate = formatDate;
export const fmtDateOnly = formatDate;

/**
 * Format time using configured System Settings (e.g., 10:30 AM or 22:30)
 * @param {Date|string} time - The time to format
 * @returns {string} Formatted time string
 */
export const formatTime = (time) => {
  if (!time) return FALLBACK;
  try {
    const timeFormat = getCachedTimeFormat();

    if (time instanceof Date || (typeof time === "string" && time.includes("T"))) {
      const d = new Date(time);
      if (isNaN(d.getTime())) return FALLBACK;
      const settings = readCachedSystemSettings();
      const timezone = settings.timezone || "Asia/Kolkata";
      const locale = settings.locale || "en-IN";

      return d.toLocaleTimeString(locale, {
        hour: timeFormat === "24h" ? "2-digit" : "numeric",
        minute: "2-digit",
        hour12: timeFormat === "12h",
        timeZone: timezone
      });
    }

    if (typeof time === "string" && time.includes(":")) {
      const parsedTime = parseClockTime(time);
      if (!parsedTime) return FALLBACK;
      return formatClockTime(parsedTime, timeFormat);
    }

    return FALLBACK;
  } catch {
    return FALLBACK;
  }
};

/**
 * Format date and time together (e.g., 15 May 2024, 10:30 AM)
 * @param {Date|string} date - The datetime to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date) => {
  if (!date) return FALLBACK;
  const d = formatDate(date);
  const t = formatTime(date);
  if (d === FALLBACK || t === FALLBACK) return FALLBACK;
  return `${d}, ${t}`;
};

export const fmtDateTime = formatDateTime;

/**
 * Format relative time (e.g. Just now, 5 sec ago, 10 min ago, 2 hr ago, 3 d ago)
 * @param {Date|string|number} timestamp - The timestamp to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Never";
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    if (isNaN(diffMs)) return FALLBACK;

    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec} sec ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay} d ago`;

    return formatDate(timestamp);
  } catch {
    return FALLBACK;
  }
};

export const fmtRelativeTime = formatRelativeTime;

/* =========================================================
   CURRENCY, AMOUNT & NUMBER FORMATTERS (SYSTEM SETTINGS)
   ========================================================= */

const currencyFormatters = new Map();
const numberFormatters = new Map();

/**
 * Format currency dynamically using System Settings configuration
 * @param {number|string} amount - The amount to format
 * @param {Object} [options] - Custom formatting overrides
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, options = {}) => {
  if (amount === null || amount === undefined || amount === "" || isNaN(amount)) return FALLBACK;
  try {
    const settings = readCachedSystemSettings();
    const currency = options.currency || settings.defaultCurrency || "INR";
    const locale = options.locale || settings.locale || (currency === "INR" ? "en-IN" : "en-US");
    const num = Number(amount);
    if (isNaN(num)) return FALLBACK;

    const minDecimals = options.minDecimals ?? options.decimalPrecision ?? (options.alwaysShowDecimals === false ? 0 : 2);
    const maxDecimals = options.maxDecimals ?? options.decimalPrecision ?? 2;

    const cacheKey = `${locale}-${currency}-${minDecimals}-${maxDecimals}`;
    let formatter = currencyFormatters.get(cacheKey);

    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      });
      currencyFormatters.set(cacheKey, formatter);
    }
    let formatted = formatter.format(num);

    if (settings.currencySymbol && !formatted.includes(settings.currencySymbol)) {
      const formattedNum = num.toLocaleString(locale, {
        minimumFractionDigits: minDecimals,
        maximumFractionDigits: maxDecimals,
      });
      if (settings.currencyPosition === "suffix") {
        formatted = `${formattedNum} ${settings.currencySymbol}`;
      } else if (settings.currencyPosition === "prefix") {
        formatted = `${settings.currencySymbol}${formattedNum}`;
      }
    }

    return formatted;
  } catch {
    return FALLBACK;
  }
};

/**
 * Format raw amount with optional currency symbol or decimals
 * @param {number|string} amount - Amount value
 * @param {Object} [options] - Override options
 * @returns {string} Formatted amount string
 */
export const formatAmount = (amount, options = {}) => {
  if (amount === null || amount === undefined || amount === "" || isNaN(amount)) return FALLBACK;
  const num = Number(amount);
  if (isNaN(num)) return FALLBACK;

  const minDec = options.minDecimals ?? options.decimalPrecision ?? options.decimals ?? 2;
  const maxDec = options.maxDecimals ?? options.decimalPrecision ?? options.decimals ?? 2;
  const locale = options.locale || "en-IN";

  if (options.raw || options.noSymbol) {
    const useGrouping = options.useGrouping ?? (!options.noCommas);
    return num.toLocaleString(locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
      useGrouping,
    });
  }

  return formatCurrency(amount, {
    minDecimals: minDec,
    maxDecimals: maxDec,
    ...options
  });
};

/**
 * Universal Financial Report Amount Formatter.
 * Formats any financial report field (grossAmount, totalAmount, subtotal, discount, surcharge,
 * commissionAmount, commission, netAmount, providerEarnings, platformFee, visitingCharge,
 * rainCharge, trafficCharge, nightCharge, demandSurge, providerSurgeShare, companySurgeShare,
 * refundAmount, walletRefund, gatewayRefund, payoutAmount, withdrawnAmount, outstandingBalance,
 * collectedAmount, attemptedAmount, cashCollected, couponSubsidy, referralReward, tax, etc.)
 * consistently displaying exactly 2 decimal places.
 *
 * Respects project conventions:
 * - If showSymbol: true (default for currency displays), formats with currency symbol (e.g. ₹71.00).
 * - If showSymbol: false or raw: true or noSymbol: true (used when table headers include currency symbol),
 *   formats as raw 2-decimal string (e.g. 71.00 or 1,000.00).
 *
 * @param {number|string|Object} input - Financial value or object containing financial field
 * @param {string|Object} [fieldOrOptions] - Field name if input is object, or options object
 * @param {Object} [options] - Additional formatting options
 * @returns {string} Formatted 2-decimal financial report display string
 */
export const formatFinancialReportAmount = (input, fieldOrOptions = {}, options = {}) => {
  let val = input;
  let opts = {};

  if (input && typeof input === 'object' && typeof fieldOrOptions === 'string') {
    val = input[fieldOrOptions];
    opts = options || {};
  } else if (typeof fieldOrOptions === 'object') {
    opts = fieldOrOptions || {};
  }

  if (val === null || val === undefined || val === "" || isNaN(val)) return FALLBACK;

  const showSymbol = opts.showSymbol ?? (!opts.raw && !opts.noSymbol);

  if (!showSymbol) {
    return formatAmount(val, { raw: true, decimals: 2, ...opts });
  }

  return formatCurrency(val, { alwaysShowDecimals: true, minDecimals: 2, maxDecimals: 2, ...opts });
};

export const fmtFinancialReport = formatFinancialReportAmount;
export const formatFinancialValue = formatFinancialReportAmount;

/**
 * Utility to identify monetary column field names
 */
export const isMonetaryField = (key) => {
  if (!key || typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return (
    k.includes('amount') ||
    k.includes('total') ||
    k.includes('paid') ||
    k.includes('earning') ||
    k.includes('commission') ||
    k.includes('discount') ||
    k.includes('surcharge') ||
    k.includes('fee') ||
    k.includes('impact') ||
    k.includes('value') ||
    k.includes('subtotal') ||
    k.includes('refund') ||
    k.includes('payout') ||
    k.includes('subsidy') ||
    k.includes('reward') ||
    k.includes('balance') ||
    k.includes('collected') ||
    k.includes('tax') ||
    k.includes('gst') ||
    k.includes('receivable') ||
    k.includes('gross') ||
    k.includes('net')
  ) && !k.includes('rate') && !k.includes('percent') && !k.includes('percentage') && !k.includes('id') && !k.includes('count') && !k.includes('date') && !k.includes('status') && !k.includes('type') && !k.includes('code');
};

export const isMonetaryColumnKey = isMonetaryField;

/**
 * Utility to identify percentage column field names
 */
export const isPercentageField = (key) => {
  if (!key || typeof key !== 'string') return false;
  const k = key.toLowerCase();
  return k.includes('rate') || k.includes('percent') || k.includes('percentage');
};

export const isPercentageColumnKey = isPercentageField;

/**
 * Format numbers with comma separators or compact notation (1.2K, 2.5L, 3.2Cr / 100K)
 * @param {number|string} num - The number to format
 * @param {Object} [options] - { compact: boolean, decimals: number }
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, options = {}) => {
  if (num === null || num === undefined || num === "" || isNaN(num)) return FALLBACK;
  const n = Number(num);
  if (isNaN(n)) return FALLBACK;
  const settings = readCachedSystemSettings();
  const currency = settings.defaultCurrency || "INR";
  const locale = options.locale || settings.locale || (currency === "INR" ? "en-IN" : "en-US");

  if (options.compact || settings.compactNumbers) {
    if (locale === "en-IN") {
      const abs = Math.abs(n);
      if (abs >= 10000000) return `${(n / 10000000).toFixed(options.decimals ?? 1)}Cr`;
      if (abs >= 100000) return `${(n / 100000).toFixed(options.decimals ?? 1)}L`;
      if (abs >= 1000) return `${(n / 1000).toFixed(options.decimals ?? 1)}K`;
      return n.toString();
    } else {
      const abs = Math.abs(n);
      if (abs >= 1000000000) return `${(n / 1000000000).toFixed(options.decimals ?? 1)}B`;
      if (abs >= 1000000) return `${(n / 1000000).toFixed(options.decimals ?? 1)}M`;
      if (abs >= 1000) return `${(n / 1000).toFixed(options.decimals ?? 1)}K`;
      return n.toString();
    }
  }

  const minDecimals = options.minDecimals ?? options.decimals ?? (options.forceDecimals ? 2 : 0);
  const maxDecimals = options.maxDecimals ?? options.decimals ?? (options.forceDecimals ? 2 : 2);

  const cacheKey = `${locale}-${minDecimals}-${maxDecimals}`;
  let formatter = numberFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
    numberFormatters.set(locale, formatter);
  }
  return formatter.format(n);
};

/**
 * Format percentage value (e.g., 15.5%)
 * @param {number|string} value - Value to format
 * @param {number} [decimals=1] - Decimal precision
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === null || value === undefined || value === "" || isNaN(value)) return FALLBACK;
  return `${parseFloat(value).toFixed(decimals)}%`;
};

export const formatPercent = formatPercentage;

/* =========================================================
   CONTACT, LOCATION & FILE FORMATTERS
   ========================================================= */

/**
 * Format phone number cleanly (e.g. +91 98765 43210)
 * @param {string|number} phone - Phone number
 * @returns {string} Formatted phone number
 */
export const formatPhone = (phone) => {
  if (!phone) return FALLBACK;
  const settings = readCachedSystemSettings();
  const companyPhone = settings.phone || "";
  let countryCode = "+91";
  if (companyPhone.startsWith("+")) {
    const match = companyPhone.match(/^(\+\d{1,4})/);
    if (match) countryCode = match[1];
  }
  const cleaned = ("" + phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${countryCode} ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `${countryCode} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

/**
 * Format and trim email string
 * @param {string} email - Email address
 * @returns {string} Clean email string
 */
export const formatEmail = (email) => {
  if (!email || typeof email !== 'string') return FALLBACK;
  const trimmed = email.trim().toLowerCase();
  return trimmed || FALLBACK;
};

/**
 * Format duration in decimal hours to readable string (e.g., 2 hr 30 min)
 * @param {number} hours - Duration in decimal hours
 * @returns {string} Formatted duration string
 */
export const formatDuration = (hours) => {
  if (hours === null || hours === undefined || isNaN(hours) || hours <= 0) return FALLBACK;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hDisplay = h > 0 ? `${h} hr` : "";
  const mDisplay = m > 0 ? `${m} min` : "";
  return `${hDisplay} ${mDisplay}`.trim() || FALLBACK;
};

/**
 * Format distance in meters or kilometers (e.g., 850 m, 4.2 km)
 * @param {number} metersOrKm - Distance value
 * @param {boolean} [isKm=false] - Whether input is already in kilometers
 * @returns {string} Formatted distance string
 */
export const formatDistance = (metersOrKm, isKm = false) => {
  if (metersOrKm === null || metersOrKm === undefined || isNaN(metersOrKm)) return FALLBACK;
  const meters = isKm ? metersOrKm * 1000 : metersOrKm;
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

/**
 * Format byte size to readable string (e.g. 1.5 MB, 450 KB)
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return FALLBACK;
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/* =========================================================
   ID FORMATTERS
   ========================================================= */

/**
 * Truncate long IDs with ellipsis (e.g., 65fa10...9b2)
 * @param {string} id - The ID string
 * @param {number} [chars=14] - Max length threshold
 * @returns {string} Truncated ID string
 */
export const truncateId = (id, chars = 14) => {
  if (!id) return FALLBACK;
  const str = String(id).trim();
  if (str.length <= chars) return str;
  return `${str.slice(0, chars)}…`;
};

export const formatBookingId = (id) => (id ? (String(id).startsWith("BK-") ? String(id) : `BK-${truncateId(id, 10)}`) : FALLBACK);
export const formatPaymentId = (id) => (id ? (String(id).startsWith("pay_") ? String(id) : truncateId(id, 14)) : FALLBACK);
export const formatTransactionId = (id) => (id ? (String(id).startsWith("TXN-") ? String(id) : `TXN-${truncateId(id, 10)}`) : FALLBACK);
export const formatRefundId = (id) => (id ? (String(id).startsWith("rfnd_") || String(id).startsWith("RFD-") ? String(id) : `RFD-${truncateId(id, 10)}`) : FALLBACK);
export const formatSettlementId = (id) => (id ? (String(id).startsWith("STL-") || String(id).startsWith("set_") ? String(id) : `STL-${truncateId(id, 10)}`) : FALLBACK);
export const formatWithdrawalId = (id) => (id ? (String(id).startsWith("WTD-") || String(id).startsWith("pout_") ? String(id) : `WTD-${truncateId(id, 10)}`) : FALLBACK);
export const formatWalletId = (id) => (id ? (String(id).startsWith("WAL-") ? String(id) : `WAL-${truncateId(id, 10)}`) : FALLBACK);
export const formatProviderId = (id) => (id ? (String(id).startsWith("PRV-") ? String(id) : `PRV-${truncateId(id, 10)}`) : FALLBACK);
export const formatCustomerId = (id) => (id ? (String(id).startsWith("CUST-") ? String(id) : `CUST-${truncateId(id, 10)}`) : FALLBACK);
export const formatInvoiceId = (id) => (id ? (String(id).startsWith("INV-") ? String(id) : `INV-${truncateId(id, 10)}`) : FALLBACK);

/* =========================================================
   COMMON STRING & UTILITY HELPERS
   ========================================================= */

/**
 * Capitalize first letter of string
 * @param {string} str
 * @returns {string}
 */
export const capitalize = (str) => {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convert snake_case, kebab-case, or spaced string to Title Case
 * @param {string} str
 * @returns {string}
 */
const TITLE_CASE_ACRONYMS = new Set(['ID', 'UTR', 'IFSC', 'GST', 'API', 'PDF', 'CSV', 'XLSX', 'URL', 'UPI', 'QR']);

export const titleCase = (str) => {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (TITLE_CASE_ACRONYMS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

/**
 * Safely return value or fallback if empty/falsy
 * @param {*} val
 * @param {string} [fallback=FALLBACK]
 * @returns {*}
 */
export const safeValue = (val, fallback = FALLBACK) => {
  if (val === null || val === undefined || val === "" || (typeof val === "number" && isNaN(val))) {
    return fallback;
  }
  return val;
};

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param {*} val
 * @returns {boolean}
 */
export const isEmptyValue = (val) => {
  if (val === null || val === undefined || val === "") return true;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === "object") return Object.keys(val).length === 0;
  return false;
};

/**
 * Copy text to user clipboard with fallback support
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
};

/**
 * Programmatically download a file from URL
 * @param {string} url
 * @param {string} fileName
 */
export const downloadFile = (url, fileName = "download") => {
  if (!url) return;
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* =========================================================
   PRESERVED IMAGE, GEOCODING & MAP UTILITIES
   ========================================================= */

export const getOptimizedCloudinaryUrl = (url, width = 800) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('http') || !url.includes('res.cloudinary.com')) return url;
  if (url.includes('/s--')) return url;

  let cleanUrl = url;
  const uploadRegex = /\/(image\/upload|upload)\/([^/]+)\//;
  const match = cleanUrl.match(uploadRegex);
  if (match) {
    const transformStr = match[2];
    if (transformStr.includes('f_auto') || transformStr.includes('q_auto') || transformStr.includes('w_') || transformStr.includes('c_')) {
      cleanUrl = cleanUrl.replace(`/${match[1]}/${transformStr}/`, `/${match[1]}/`);
    }
  }

  const transform = `f_auto,q_auto,w_${width}`;
  if (cleanUrl.includes('/image/upload/')) {
    return cleanUrl.replace('/image/upload/', `/image/upload/${transform}/`);
  } else if (cleanUrl.includes('/upload/') && !cleanUrl.includes('/raw/upload/') && !cleanUrl.includes('/video/upload/')) {
    return cleanUrl.replace('/upload/', `/upload/${transform}/`);
  }
  return cleanUrl;
};

export const compressImage = (file, options = {}) => {
  return new Promise((resolve) => {
    const { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = options;
    if (!file || !file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          resolve(compressedFile.size < file.size ? compressedFile : file);
        }, "image/jpeg", quality);
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export const buildAddressPreview = (address = {}) => {
  const cleanPart = (val) => {
    if (!val) return "";
    return val.toString()
      .replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, "")
      .replace(/\s+district$/i, "")
      .replace(/^[,.\s-]+|[,.\s-]+$/g, "")
      .trim();
  };

  const houseNumber = cleanPart(address.houseNumber || address.house_number || address.house || address.flat || address.apartment || address.unit || address.office);
  const road = cleanPart(address.road || address.streetName || address.street || address.footway || address.path);
  const landmark = cleanPart(address.landmark);
  const area = cleanPart(address.area || address.locality || address.residential || address.neighbourhood || address.suburb || address.quarter || address.hamlet || address.village);
  const city = cleanPart(address.city || address.town || address.municipality || address.city_district || address.county || address.state_district);
  const pincode = cleanPart(address.pincode || address.postalCode || address.postcode || address.postal_code);

  const parts = [];
  for (const part of [houseNumber, road, landmark, area, city, pincode]) {
    if (!part) continue;
    const partLower = part.toLowerCase();
    let duplicateIndex = -1;
    const isDuplicate = parts.some((existing, index) => {
      const existingLower = existing.toLowerCase();
      const matched = existingLower === partLower || existingLower.includes(partLower) || partLower.includes(existingLower);
      if (matched) duplicateIndex = index;
      return matched;
    });
    if (isDuplicate) {
      if (duplicateIndex !== -1 && part.length > parts[duplicateIndex].length) {
        parts[duplicateIndex] = part;
      }
    } else {
      parts.push(part);
    }
  }
  return parts.join(", ");
};

export const formatAddress = (address) => {
  if (!address) return FALLBACK;
  if (typeof address === 'string') return address.trim() || FALLBACK;
  if (typeof address === 'object') {
    const preview = buildAddressPreview(address);
    if (preview) return preview;
    return [address.street || address.addressLine, address.city, address.state, address.postalCode || address.pincode, address.country]
      .filter(Boolean)
      .join(', ') || FALLBACK;
  }
  return FALLBACK;
};

export const smartAddressBuilder = (addressObj, displayName = "") => {
  const addr = addressObj || {};
  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, "");
    s = s.replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  const isUnwanted = (val) => {
    if (!val) return true;
    const s = val.toString().toLowerCase();
    return (
      s.includes("tahsil") || s.includes("tehsil") || s.includes("तहसील") ||
      s.includes("ਤਹਿਸੀਲ") || s.includes("taluk") || s.includes("taluka") ||
      s.includes("subdistrict") || s.includes("sub-district") || s === "india" ||
      s === "county" || s === "state district" || s === "district" || s === "state_district" ||
      /[\u0900-\u097F\u0A00-\u0A7F]/.test(val)
    );
  };

  let houseNo = cleanPart(addr.house_number || addr.house || addr.flat || addr.apartment || addr.unit || addr.office);
  let building = cleanPart(addr.building || addr.apartments || addr.amenity);
  let road = cleanPart(addr.road || addr.street || addr.footway || addr.path);
  let locality = cleanPart(addr.suburb) || cleanPart(addr.neighbourhood) || cleanPart(addr.residential) || cleanPart(addr.quarter) || cleanPart(addr.hamlet) || "";
  let city = cleanPart(addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || addr.state_district).replace(/\s+district$/i, "").trim();
  let state = cleanPart(addr.state);
  let pincode = cleanPart(addr.postcode || addr.postal_code);

  const fallbackList = [houseNo, building, road, locality].filter(Boolean);
  const getFallback = (val) => (val && val.trim() ? val : fallbackList[0] || "");

  houseNo = getFallback(houseNo);
  building = getFallback(building);
  road = getFallback(road);
  locality = getFallback(locality);

  if (isUnwanted(houseNo)) houseNo = "";
  if (isUnwanted(building)) building = "";
  if (isUnwanted(road)) road = "";
  if (isUnwanted(locality)) locality = "";
  if (isUnwanted(city)) city = "";
  if (isUnwanted(state)) state = "";

  const parts = [];
  let houseBuildingPart = [houseNo, building].filter(Boolean).join(", ");
  if (houseNo && building && (houseNo.toLowerCase().includes(building.toLowerCase()) || building.toLowerCase().includes(houseNo.toLowerCase()))) {
    houseBuildingPart = houseNo.length > building.length ? houseNo : building;
  }
  if (houseBuildingPart) parts.push(houseBuildingPart);
  if (road) parts.push(road);

  if (displayName) {
    const displayParts = displayName.split(",").map(cleanPart).filter(p => p && !isUnwanted(p));
    const cityLower = city ? city.toLowerCase() : "";
    const stateLower = state ? state.toLowerCase() : "";
    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      if (dpLower.includes("phase") || dpLower.includes("sector") || dpLower.includes("block") || dpLower.includes("colony") || dpLower.includes("estate") || dpLower.includes("town") || dpLower.includes("urban")) {
        const matched = parts.some(p => p.toLowerCase().includes(dpLower) || dpLower.includes(p.toLowerCase()));
        if (!matched && dpLower !== cityLower && dpLower !== stateLower) parts.push(dp);
      }
    }
  }

  if (locality && !parts.some(p => p.toLowerCase().includes(locality.toLowerCase()) || locality.toLowerCase().includes(p.toLowerCase()))) parts.push(locality);
  if (city && !parts.some(p => p.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(p.toLowerCase()))) parts.push(city);
  if (state) {
    const matched = parts.some(p => p.toLowerCase().includes(state.toLowerCase()) || state.toLowerCase().includes(p.toLowerCase()));
    let stateString = pincode ? `${state} ${pincode}` : state;
    if (!matched) parts.push(stateString);
    else {
      const idx = parts.findIndex(p => p.toLowerCase().includes(state.toLowerCase()));
      if (idx !== -1) parts[idx] = stateString;
    }
  } else if (pincode) parts.push(pincode);

  const uniqueParts = [];
  for (const part of parts) {
    if (!uniqueParts.some(p => p.toLowerCase() === part.toLowerCase())) uniqueParts.push(part);
  }
  return uniqueParts.join(", ");
};

export const cleanAddressFields = (addressObj, displayName = "") => {
  const addr = addressObj || {};
  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, "").replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  const isUnwanted = (val) => {
    if (!val) return true;
    const s = val.toString().toLowerCase();
    return s.includes("tahsil") || s.includes("tehsil") || s.includes("subdistrict") || s === "india" || s === "county" || s === "district" || /[\u0900-\u097F\u0A00-\u0A7F]/.test(val);
  };

  let houseNo = cleanPart(addr.house_number || addr.house || addr.flat || addr.apartment || addr.unit || addr.office);
  let building = cleanPart(addr.building || addr.apartments || addr.amenity);
  let road = cleanPart(addr.road || addr.street || addr.footway || addr.path);
  let residential = cleanPart(addr.residential || addr.development);
  let neighbourhood = cleanPart(addr.neighbourhood || addr.quarter);
  let suburb = cleanPart(addr.suburb || addr.village || addr.townland);
  let quarter = cleanPart(addr.quarter);
  let hamlet = cleanPart(addr.hamlet);
  let landmark = cleanPart(addr.landmark || addr.place || addr.commercial || addr.industrial);
  let city = cleanPart(addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || addr.state_district).replace(/\s+district$/i, "").trim();
  let state = cleanPart(addr.state);
  let pincode = cleanPart(addr.postcode || addr.postal_code);

  let locality = suburb || neighbourhood || residential || quarter || hamlet || "";
  let area = locality || "";
  const fallbackList = [houseNo, building, road, residential, suburb, neighbourhood].filter(Boolean);
  const getFallback = (val) => (val && val.trim() ? val : fallbackList[0] || "");

  let finalHouseNumber = getFallback(houseNo);
  let finalBuilding = getFallback(building);
  let finalRoad = getFallback(road);
  let finalLocality = getFallback(locality);
  let finalLandmark = getFallback(landmark);
  let finalArea = getFallback(area);
  let finalCity = city || locality || "";
  let finalState = state || "";
  let finalPincode = pincode || "";

  if (isUnwanted(finalHouseNumber)) finalHouseNumber = "";
  if (isUnwanted(finalBuilding)) finalBuilding = "";
  if (isUnwanted(finalRoad)) finalRoad = "";
  if (isUnwanted(finalLocality)) finalLocality = "";
  if (isUnwanted(finalLandmark)) finalLandmark = "";
  if (isUnwanted(finalArea)) finalArea = "";
  if (isUnwanted(finalCity)) finalCity = "";
  if (isUnwanted(finalState)) finalState = "";

  finalHouseNumber = getFallback(finalHouseNumber);
  finalBuilding = getFallback(finalBuilding);
  finalRoad = getFallback(finalRoad);
  finalLocality = getFallback(finalLocality);
  finalArea = getFallback(finalArea);

  let candidates = [finalHouseNumber, finalBuilding, finalRoad, finalLocality].filter(Boolean);
  if (displayName) {
    const displayParts = displayName.split(",").map(cleanPart).filter(p => p && !isUnwanted(p));
    const cityLower = finalCity.toLowerCase();
    const stateLower = finalState.toLowerCase();
    const pincodeLower = finalPincode.toLowerCase();

    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      if (dpLower === cityLower || dpLower === stateLower || dpLower === pincodeLower || (cityLower && cityLower.includes(dpLower)) || (stateLower && stateLower.includes(dpLower))) continue;
      const alreadyMatched = candidates.some(c => {
        const cLower = c.toLowerCase();
        return cLower.includes(dpLower) || dpLower.includes(cLower);
      });
      if (!alreadyMatched) {
        candidates.push(dp);
        if (!finalRoad) finalRoad = dp;
        else if (!finalLocality || finalLocality === finalRoad) finalLocality = dp;
      }
    }
  }

  const uniqueCandidates = [];
  for (const cand of candidates) {
    const candLower = cand.toLowerCase();
    let isDup = false;
    for (let i = 0; i < uniqueCandidates.length; i++) {
      const existingLower = uniqueCandidates[i].toLowerCase();
      if (existingLower === candLower || existingLower.includes(candLower)) {
        isDup = true;
        break;
      }
      if (candLower.includes(existingLower)) {
        uniqueCandidates[i] = cand;
        isDup = true;
        break;
      }
    }
    if (!isDup) uniqueCandidates.push(cand);
  }

  let streetAddress = uniqueCandidates.join(", ");
  const formattedAddress = smartAddressBuilder(addr, displayName);
  const fullAddressPreview = buildAddressPreview({
    houseNumber: finalHouseNumber,
    road: finalRoad,
    area: finalArea || finalLocality,
    city: finalCity,
    pincode: finalPincode
  });

  const hasGranularDetails = !!(houseNo || building || road || residential || neighbourhood || suburb || quarter || hamlet || landmark);

  return {
    street: streetAddress || finalRoad || formattedAddress || "",
    city: finalCity,
    state: finalState,
    postalCode: finalPincode,
    pincode: finalPincode,
    addressLine: streetAddress || finalRoad || "",
    houseNumber: finalHouseNumber || "",
    building: finalBuilding || "",
    road: finalRoad || "",
    locality: finalLocality || "",
    landmark: finalLandmark || "",
    area: finalArea || finalLocality || "",
    country: cleanPart(addr.country) || "India",
    formattedAddress: fullAddressPreview || formattedAddress || streetAddress || "",
    isCityCenterOnly: !hasGranularDetails,
    lat: null,
    lng: null
  };
};

export const LIGHT_MAP_TILES = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const LIGHT_MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const GEOCODE_CACHE = new Map();
const GEOCODE_CACHE_TTL_MS = 5 * 60 * 1000;
const GEOCODE_USER_AGENT = "RajServiceBooking/1.0 (service-booking-app)";
const coordCacheKey = (lat, lng) => `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;

const mergePhotonNominatim = (photonProps, nominatimAddr, displayName) => {
  const p = photonProps || {};
  const n = nominatimAddr || {};
  return {
    house_number: p.housenumber || n.house_number || n.house || "",
    building: p.name || n.building || n.apartments || "",
    road: p.street || n.road || n.street || n.footway || "",
    neighbourhood: n.neighbourhood || n.quarter || n.residential || "",
    suburb: p.district || n.suburb || n.city_district || "",
    city: p.city || n.city || n.town || n.municipality || n.city_district || n.village || n.county || n.state_district || "",
    state: p.state || n.state || "",
    postcode: p.postcode || n.postcode || "",
    country: p.country || n.country || "India",
    landmark: n.amenity || n.place || "",
    _displayName: displayName || ""
  };
};

export const reverseGeocode = async (lat, lng) => {
  const cacheKey = coordCacheKey(lat, lng);
  const cached = GEOCODE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL_MS) {
    return cached.data;
  }

  let photonProps = null;
  let nominatimAddr = null;
  let displayName = "";

  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": GEOCODE_USER_AGENT } }
    );
    const nomJson = await nomRes.json();
    if (nomJson?.address) {
      nominatimAddr = nomJson.address;
      displayName = nomJson.display_name || "";
    }
  } catch { /* fallback */ }

  if (!nominatimAddr) {
    try {
      const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`);
      const photonJson = await photonRes.json();
      if (photonJson?.features?.[0]?.properties) {
        photonProps = photonJson.features[0].properties;
        const props = photonJson.features[0].properties;
        displayName = props.name || props.street || "";
        if (props.city) displayName += (displayName ? ", " : "") + props.city;
        if (props.state) displayName += (displayName ? ", " : "") + props.state;
      }
    } catch { /* fallback */ }
  }

  let merged = mergePhotonNominatim(photonProps, nominatimAddr, displayName);
  let structured = cleanAddressFields(merged, displayName);
  structured.lat = lat;
  structured.lng = lng;

  GEOCODE_CACHE.set(cacheKey, { ts: Date.now(), data: structured });
  return structured;
};

export const detectCurrentLocation = (options = {}) => {
  const targetAccuracy = options.targetAccuracy ?? 80;
  const maxUpdates = options.maxUpdates ?? 2;
  const timeoutMs = options.timeout ?? 10000;
  const maxRetries = options.maxRetries ?? 0;
  let retryCount = 0;

  const executeDetection = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }
      let watchId = null;
      let updateCount = 0;
      let bestPos = null;

      const clearWatchSafe = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
      };

      const timeoutId = setTimeout(() => {
        clearWatchSafe();
        if (bestPos && bestPos.coords.accuracy <= targetAccuracy) {
          resolvePosition(bestPos);
        } else if (bestPos) {
          resolvePosition(bestPos);
        } else {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => resolvePosition(fallbackPos),
            (fallbackErr) => reject(new Error("Location request timed out. Please select your address manually.")),
            { enableHighAccuracy: false, timeout: 3000 }
          );
        }
      }, timeoutMs);

      const resolvePosition = async (pos) => {
        clearTimeout(timeoutId);
        clearWatchSafe();
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const address = await reverseGeocode(latitude, longitude);
          const s2CellId = latLngToS2CellId(latitude, longitude, 13);
          const s2CellIdPrecise = latLngToS2CellId(latitude, longitude, 20);
          resolve({ latitude, longitude, accuracy, address: { ...address, lat: latitude, lng: longitude, s2CellId, s2CellIdPrecise } });
        } catch (err) {
          reject(err);
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateCount++;
          if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
            bestPos = pos;
          }
          if (pos.coords.accuracy <= targetAccuracy || updateCount >= maxUpdates) {
            resolvePosition(bestPos || pos);
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          clearWatchSafe();
          if (err.code === 2 || err.code === 3) {
            navigator.geolocation.getCurrentPosition(
              (fallbackPos) => resolvePosition(fallbackPos),
              (fallbackErr) => reject(new Error("Location unavailable. Please select your address manually.")),
              { enableHighAccuracy: false, timeout: 3000 }
            );
          } else {
            reject(new Error("Location permission denied. Enable GPS in browser settings."));
          }
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    });

  return executeDetection();
};

export const toLegacyAddressFields = (structured) => {
  const lat = structured.lat;
  const lng = structured.lng;
  const s2CellId = (lat && lng) ? latLngToS2CellId(lat, lng, 13) : (structured.s2CellId || null);
  const s2CellIdPrecise = (lat && lng) ? latLngToS2CellId(lat, lng, 20) : (structured.s2CellIdPrecise || null);
  const formattedAddress = buildAddressPreview(structured) || structured.formattedAddress || smartAddressBuilder(structured, "");
  return {
    street: structured.street || structured.addressLine || formattedAddress || "",
    city: structured.city || "",
    state: structured.state || "",
    postalCode: structured.postalCode || structured.pincode || "",
    country: structured.country || "India",
    lat,
    lng,
    s2CellId,
    s2CellIdPrecise,
    addressLine: structured.addressLine || structured.street || "",
    houseNumber: structured.houseNumber || "",
    road: structured.road || "",
    landmark: structured.landmark || "",
    area: structured.area || "",
    pincode: structured.pincode || structured.postalCode || "",
    formattedAddress
  };
};

export const filterGPSJitter = (prev, next, minMeters = 8) => {
  if (!prev || prev.lat == null || prev.lng == null) return next;
  const R = 6371000;
  const dLat = ((next.lat - prev.lat) * Math.PI) / 180;
  const dLng = ((next.lng - prev.lng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((prev.lat * Math.PI) / 180) * Math.cos((next.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return dist < minMeters ? prev : next;
};

export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const buildStreetAddress = (houseNumber, road) => {
  const houseNum = (houseNumber || '').trim();
  const rd = (road || '').trim();
  return houseNum && rd ? `${houseNum}, ${rd}` : (houseNum || rd);
};

const BANK_NAMES = {
  PUNB: 'Punjab National Bank',
  HDFC: 'HDFC Bank',
  SBIN: 'State Bank of India',
  ICIC: 'ICICI Bank',
  UTIB: 'Axis Bank',
  AXIS: 'Axis Bank',
  KKBK: 'Kotak Mahindra Bank',
  BARB: 'Bank of Baroda',
  CNRB: 'Canara Bank',
  UBIN: 'Union Bank of India',
  IDIB: 'Indian Bank',
  BKID: 'Bank of India',
  IOBA: 'Indian Overseas Bank',
  MAHB: 'Bank of Maharashtra',
  PSIB: 'Punjab & Sind Bank',
  UCOB: 'UCO Bank',
  CUB: 'City Union Bank',
  CSB: 'CSB Bank',
  DCB: 'DCB Bank',
  DLXB: 'Dhanlaxmi Bank',
  FDRL: 'Federal Bank',
  IDFB: 'IDFC First Bank',
  INDB: 'IndusInd Bank',
  INDUS: 'IndusInd Bank',
  JAKA: 'Jammu & Kashmir Bank',
  KARB: 'Karnataka Bank',
  KVBL: 'Karur Vysya Bank',
  KVB: 'Karur Vysya Bank',
  NAIN: 'Nainital Bank',
  RBL: 'RBL Bank',
  SIBL: 'South Indian Bank',
  TMBL: 'Tamilnad Mercantile Bank',
  YESB: 'YES Bank',
  BDBL: 'Bandhan Bank',
  AUBL: 'AU Small Finance Bank',
  ESFB: 'Equitas Small Finance Bank',
  USFB: 'Ujjivan Small Finance Bank',
  AIRP: 'Airtel Payments Bank',
  IPPB: 'India Post Payments Bank',
  PYTM: 'Paytm Payments Bank',
};

export const formatBankName = (code) => {
  if (!code) return 'N/A';
  const cleanCode = String(code).trim().toUpperCase();
  const baseCode = cleanCode.replace(/_[A-Z0-9]+$/, '');
  const bankName = BANK_NAMES[cleanCode] || BANK_NAMES[baseCode];
  if (bankName) {
    return `${bankName} (${cleanCode})`;
  }
  return cleanCode;
};
