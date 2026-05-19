/**
 * Standard utility for formatting data across the application.
 * All formatting should be done through these functions to ensure consistency.
 */

const FALLBACK = "--";

/**
 * Format date to a readable string (e.g., 15 May 2024)
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return FALLBACK;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return FALLBACK;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch (err) {
    return FALLBACK;
  }
};

/**
 * Format time to 12-hour string (e.g., 10:30 AM)
 * @param {Date|string} time - The time to format
 * @returns {string} Formatted time string
 */
export const formatTime = (time) => {
  if (!time) return FALLBACK;
  try {
    // If it's a date object or ISO string
    if (time instanceof Date || (typeof time === "string" && time.includes("T"))) {
      const d = new Date(time);
      if (isNaN(d.getTime())) return FALLBACK;
      return d.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
    
    // If it's a string like "14:30" or "14:30:00"
    if (typeof time === "string" && time.includes(":")) {
      const parts = time.split(":");
      const h = parseInt(parts[0]);
      const m = parts[1].split(" ")[0]; // handles "14:30:00"
      const ampm = h >= 12 ? "PM" : "AM";
      const formattedHour = h % 12 || 12;
      return `${formattedHour}:${m.padStart(2, "0")} ${ampm}`;
    }
    
    return FALLBACK;
  } catch (err) {
    return FALLBACK;
  }
};

/**
 * Format date and time (e.g., 15 May 2024, 10:30 AM)
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

/**
 * Format currency to INR (e.g., ₹1,250.00)
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === "" || isNaN(amount)) return FALLBACK;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format number with commas (e.g., 1,25,000)
 * @param {number|string} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined || num === "" || isNaN(num)) return FALLBACK;
  return new Intl.NumberFormat("en-IN").format(num);
};

/**
 * Format phone number (e.g., +91 98765 43210)
 * @param {string|number} phone - The phone number to format
 * @returns {string} Formatted phone string
 */
export const formatPhone = (phone) => {
  if (!phone) return FALLBACK;
  const cleaned = ("" + phone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

/**
 * Format duration (e.g., 2 hr 30 min)
 * @param {number} hours - Duration in decimal hours
 * @returns {string} Formatted duration string
 */
export const formatDuration = (hours) => {
  if (!hours) return FALLBACK;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hDisplay = h > 0 ? `${h} hr` : "";
  const mDisplay = m > 0 ? `${m} min` : "";
  return `${hDisplay} ${mDisplay}`.trim() || FALLBACK;
};

/**
 * Format percentage (e.g., 15.5%)
 * @param {number|string} value - The value to format
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value) => {
  if (value === null || value === undefined || value === "" || isNaN(value)) return FALLBACK;
  return `${parseFloat(value).toFixed(1)}%`;
};

/**
 * Format Cloudinary URLs to include delivery optimization parameters.
 * @param {string} url - The Cloudinary image URL
 * @param {number} width - Desired width parameter for dynamic CDN optimization
 * @returns {string} Optimized Cloudinary URL
 */
export const getOptimizedCloudinaryUrl = (url, width = 800) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('http') || !url.includes('res.cloudinary.com')) return url;
  
  // Clean existing auto/quality/width transformations to avoid duplicate paths
  let cleanUrl = url;
  const uploadRegex = /\/(image\/upload|upload)\/([^\/]+)\//;
  const match = cleanUrl.match(uploadRegex);
  if (match) {
    const transformStr = match[2];
    // If it looks like standard auto/quality/width transformation path rather than folder/id
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

/**
 * Helper for client-side image compression and resizing using HTML5 Canvas
 * @param {File} file - The file object to compress
 * @param {Object} options - Compression options (maxWidth, maxHeight, quality)
 * @returns {Promise<File>} Promise resolving to the compressed File object
 */
export const compressImage = (file, options = {}) => {
  return new Promise((resolve) => {
    const {
      maxWidth = 1600,
      maxHeight = 1600,
      quality = 0.82
    } = options;

    if (!file || !file.type.startsWith('image/')) {
      return resolve(file); // Return original if not an image
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize dimensions if they exceed max limits while preserving aspect ratio
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
          if (!blob) {
            return resolve(file); // Fallback to original
          }
          
          // Re-create the file object with jpeg extension and mime type
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
            type: "image/jpeg",
            lastModified: Date.now()
          });

          // Only return compressed if it actually reduced file size, otherwise return original
          if (compressedFile.size < file.size) {
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        }, "image/jpeg", quality);
      };

      img.onerror = (err) => {
        console.error("Image loading error:", err);
        resolve(file); // Fallback to original
      };
      
      img.src = event.target.result;
    };

    reader.onerror = (err) => {
      console.error("FileReader error:", err);
      resolve(file); // Fallback to original
    };

    reader.readAsDataURL(file);
  });
};