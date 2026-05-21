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

/**
 * Parses and builds a highly accurate, clean, human-readable address from Nominatim geocoding data.
 * Deduplicates tokens, removes tahsil/tehsil sub-structures, strips non-Latin scripts (e.g. Hindi/Punjabi names),
 * and structures address components into a premium, professional format.
 * 
 * @param {Object} addressObj - The address object returned by reverse-geocoding (Nominatim)
 * @param {string} displayName - The raw display_name string returned by reverse-geocoding
 * @returns {string} Formatted, human-readable address
 */
export const smartAddressBuilder = (addressObj, displayName = "") => {
  const addr = addressObj || {};
  
  // 1. Extract key address tokens
  let houseNo = addr.house_number || addr.building || addr.flat || addr.apartment || addr.house || addr.unit || addr.office || addr.amenity || "";
  let road = addr.road || addr.street || addr.footway || addr.path || "";
  let neighbourhood = addr.neighbourhood || addr.quarter || addr.residential || addr.development || "";
  let suburb = addr.suburb || addr.village || addr.townland || "";
  let landmark = addr.landmark || addr.place || addr.commercial || addr.industrial || "";
  let city = addr.city || addr.town || addr.municipality || addr.city_district || "";
  let state = addr.state || "";
  let pincode = addr.postcode || addr.postal_code || "";
  
  // Helper for cleaning up text tokens
  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    // Remove non-Latin characters (Devanagari, Gurmukhi, etc.)
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, "");
    // Clean any dangling punctuation or extra spaces
    s = s.replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  // Filter unwanted words
  const isUnwanted = (val) => {
    const s = val.toLowerCase();
    return (
      s.includes("tahsil") || 
      s.includes("tehsil") || 
      s.includes("तहसील") || 
      s.includes("ਤਹਿਸੀਲ") || 
      s.includes("taluk") || 
      s.includes("taluka") || 
      s === "india"
    );
  };
  
  const candidates = [];
  const addCandidate = (val) => {
    const clean = cleanPart(val);
    if (clean && !isUnwanted(clean)) {
      candidates.push(clean);
    }
  };

  // Add extracted components in preferred logical order
  addCandidate(houseNo);
  addCandidate(road);
  addCandidate(landmark);
  addCandidate(neighbourhood);
  addCandidate(suburb);
  addCandidate(city);
  addCandidate(state);
  
  // If we have a display_name, parse it to recover specific missing details (e.g. "Phase 1")
  if (displayName) {
    const displayParts = displayName.split(",")
      .map(cleanPart)
      .filter(p => p && !isUnwanted(p));
      
    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      // Only insert if not already represented in the structured candidates list
      const alreadyMatched = candidates.some(c => {
        const cLower = c.toLowerCase();
        return cLower.includes(dpLower) || dpLower.includes(cLower);
      });
      if (!alreadyMatched) {
        // Insert before city/state if found, otherwise append
        const cityLower = city ? city.toLowerCase() : "";
        const stateLower = state ? state.toLowerCase() : "";
        let insertIdx = candidates.length;
        for (let i = 0; i < candidates.length; i++) {
          const cLower = candidates[i].toLowerCase();
          if (cLower === cityLower || cLower === stateLower) {
            insertIdx = i;
            break;
          }
        }
        candidates.splice(insertIdx, 0, dp);
      }
    }
  }
  
  const cleanPincode = cleanPart(pincode);
  
  // Deduplicate candidate strings token-wise
  const uniqueCandidates = [];
  for (const cand of candidates) {
    const candLower = cand.toLowerCase();
    let isDup = false;
    for (let i = 0; i < uniqueCandidates.length; i++) {
      const existingLower = uniqueCandidates[i].toLowerCase();
      if (existingLower === candLower) {
        isDup = true;
        break;
      }
      // If one candidate is a sub-phrase of another, keep the longer/more specific one
      if (existingLower.includes(candLower)) {
        isDup = true;
        break;
      }
      if (candLower.includes(existingLower)) {
        uniqueCandidates[i] = cand;
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      uniqueCandidates.push(cand);
    }
  }
  
  // Separate out state for special formatting at the end with the pincode
  const cleanState = cleanPart(state);
  let stateIdx = -1;
  if (cleanState) {
    stateIdx = uniqueCandidates.findIndex(c => c.toLowerCase() === cleanState.toLowerCase());
  }
  
  let mainParts = [...uniqueCandidates];
  let statePart = "";
  
  if (stateIdx !== -1) {
    statePart = mainParts[stateIdx];
    mainParts.splice(stateIdx, 1);
  } else if (cleanState) {
    statePart = cleanState;
  }
  
  if (statePart && cleanPincode) {
    if (!statePart.includes(cleanPincode)) {
      statePart = `${statePart} ${cleanPincode}`;
    }
  } else if (cleanPincode) {
    statePart = cleanPincode;
  }
  
  if (statePart) {
    mainParts.push(statePart);
  }
  
  let formattedAddress = mainParts.join(", ");
  
  // Fallback to parsed displayName if the extracted structures were too sparse
  if (!formattedAddress || mainParts.length < 2) {
    if (displayName) {
      const dp = displayName.split(",")
        .map(cleanPart)
        .filter(p => p && !isUnwanted(p));
      
      const uniqueDp = [];
      for (const item of dp) {
        if (!uniqueDp.some(x => x.toLowerCase() === item.toLowerCase() || x.toLowerCase().includes(item.toLowerCase()))) {
          uniqueDp.push(item);
        }
      }
      
      if (cleanPincode) {
        const lastIdx = uniqueDp.length - 1;
        if (lastIdx >= 0) {
          if (!uniqueDp[lastIdx].includes(cleanPincode)) {
            uniqueDp[lastIdx] = `${uniqueDp[lastIdx]} ${cleanPincode}`;
          }
        } else {
          uniqueDp.push(cleanPincode);
        }
      }
      formattedAddress = uniqueDp.join(", ");
    }
  }
  
  return formattedAddress || displayName || "Unknown Location";
};

/**
 * Parses and returns clean, structured address fields (street, city, state, postalCode) 
 * from Nominatim geocoding data, stripping non-Latin script, redundant sub-districts/tahsils, 
 * and deduplicating tokens.
 * 
 * @param {Object} addressObj - The address object returned by reverse-geocoding (Nominatim)
 * @param {string} displayName - The raw display_name string returned by reverse-geocoding
 * @returns {Object} { street, city, state, postalCode }
 */
export const cleanAddressFields = (addressObj, displayName = "") => {
  const addr = addressObj || {};
  
  // Clean string helper
  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, ""); // strip Devanagari/Gurmukhi
    s = s.replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  const isUnwanted = (val) => {
    const s = val.toLowerCase();
    return (
      s.includes("tahsil") || 
      s.includes("tehsil") || 
      s.includes("तहसील") || 
      s.includes("ਤਹਿਸੀਲ") || 
      s.includes("taluk") || 
      s.includes("taluka") || 
      s === "india"
    );
  };

  // 1. Extract base fields
  let houseNo = addr.house_number || addr.building || addr.flat || addr.apartment || addr.house || addr.unit || addr.office || addr.amenity || "";
  let road = addr.road || addr.street || addr.footway || addr.path || "";
  let neighbourhood = addr.neighbourhood || addr.quarter || addr.residential || addr.development || "";
  let suburb = addr.suburb || addr.village || addr.townland || "";
  let landmark = addr.landmark || addr.place || addr.commercial || addr.industrial || "";
  
  let city = addr.city || addr.town || addr.municipality || addr.city_district || "";
  let state = addr.state || "";
  let pincode = addr.postcode || addr.postal_code || "";

  // Clean them
  houseNo = cleanPart(houseNo);
  road = cleanPart(road);
  neighbourhood = cleanPart(neighbourhood);
  suburb = cleanPart(suburb);
  landmark = cleanPart(landmark);
  city = cleanPart(city);
  state = cleanPart(state);
  pincode = cleanPart(pincode);

  // 2. Build candidates list for street
  const candidates = [];
  const addCandidate = (val) => {
    if (val && !isUnwanted(val)) {
      candidates.push(val);
    }
  };

  addCandidate(houseNo);
  addCandidate(road);
  addCandidate(landmark);
  addCandidate(neighbourhood);
  addCandidate(suburb);

  // If we have displayName, let's extract extra tokens (like "Phase 1") that are NOT city, state, or pincode
  if (displayName) {
    const displayParts = displayName.split(",")
      .map(cleanPart)
      .filter(p => p && !isUnwanted(p));

    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();
    const pincodeLower = pincode.toLowerCase();

    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      
      // Skip if it represents city, state, or pincode
      if (
        dpLower === cityLower || 
        dpLower === stateLower || 
        dpLower === pincodeLower || 
        cityLower.includes(dpLower) ||
        stateLower.includes(dpLower)
      ) {
        continue;
      }

      // Check if it's already in candidates
      const alreadyMatched = candidates.some(c => {
        const cLower = c.toLowerCase();
        return cLower.includes(dpLower) || dpLower.includes(cLower);
      });

      if (!alreadyMatched) {
        candidates.push(dp);
      }
    }
  }

  // Deduplicate candidates
  const uniqueCandidates = [];
  for (const cand of candidates) {
    const candLower = cand.toLowerCase();
    let isDup = false;
    for (let i = 0; i < uniqueCandidates.length; i++) {
      const existingLower = uniqueCandidates[i].toLowerCase();
      if (existingLower === candLower) {
        isDup = true;
        break;
      }
      if (existingLower.includes(candLower)) {
        isDup = true;
        break;
      }
      if (candLower.includes(existingLower)) {
        uniqueCandidates[i] = cand;
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      uniqueCandidates.push(cand);
    }
  }

  let streetAddress = uniqueCandidates.join(", ");

  // Fallback to parsing display_name if streetAddress is too sparse
  if ((!streetAddress || uniqueCandidates.length < 1) && displayName) {
    const displayParts = displayName.split(",")
      .map(cleanPart)
      .filter(p => p && !isUnwanted(p));

    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();
    const pincodeLower = pincode.toLowerCase();

    const filtered = displayParts.filter(p => {
      const pLower = p.toLowerCase();
      return (
        pLower !== cityLower && 
        pLower !== stateLower && 
        pLower !== pincodeLower &&
        !cityLower.includes(pLower) &&
        !stateLower.includes(pLower)
      );
    });

    const uniqueFiltered = [];
    for (const item of filtered) {
      if (!uniqueFiltered.some(x => x.toLowerCase() === item.toLowerCase() || x.toLowerCase().includes(item.toLowerCase()))) {
        uniqueFiltered.push(item);
      }
    }
    streetAddress = uniqueFiltered.join(", ");
  }

  // Make sure city, state, postalCode are cleaned of tahsils or non-Latin scripts
  if (isUnwanted(city)) city = "";
  if (isUnwanted(state)) state = "";

  return {
    street: streetAddress || "Unknown Street Address",
    city: city || "Jalandhar",
    state: state || "Punjab",
    postalCode: pincode || "144001"
  };
};