/**
 * Standard utility for formatting data across the application.
 * All formatting should be done through these functions to ensure consistency.
 */
import { latLngToS2CellId } from './s2Helper';

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
  } catch {
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
  } catch {
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
  const uploadRegex = /\/(image\/upload|upload)\/([^/]+)\//;
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

export const buildAddressPreview = (address = {}) => {
  const cleanPart = (val) => {
    if (!val) return "";
    return val
      .toString()
      .replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, "")
      .replace(/\s+district$/i, "")
      .replace(/^[,.\s-]+|[,.\s-]+$/g, "")
      .trim();
  };

  const houseNumber = cleanPart(
    address.houseNumber ||
    address.house_number ||
    address.house ||
    address.flat ||
    address.apartment ||
    address.unit ||
    address.office
  );
  const road = cleanPart(address.road || address.streetName || address.street || address.footway || address.path);
  const area = cleanPart(
    address.area ||
    address.locality ||
    address.residential ||
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.hamlet ||
    address.village
  );
  const city = cleanPart(address.city || address.town || address.municipality || address.city_district || address.county || address.state_district);
  const pincode = cleanPart(address.pincode || address.postalCode || address.postcode || address.postal_code);

  const parts = [];
  for (const part of [houseNumber, road, area, city, pincode]) {
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

  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, ""); // strip Devanagari/Gurmukhi
    s = s.replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  const isUnwanted = (val) => {
    if (!val) return true;
    const s = val.toString().toLowerCase();
    return (
      s.includes("tahsil") ||
      s.includes("tehsil") ||
      s.includes("तहसील") ||
      s.includes("ਤਹਿਸੀਲ") ||
      s.includes("taluk") ||
      s.includes("taluka") ||
      s.includes(" i tahsil") ||
      s.includes("subdistrict") ||
      s.includes("sub-district") ||
      s === "india" ||
      s === "county" ||
      s === "state district" ||
      s.includes("district") ||
      s.includes("state_district") ||
      /[\u0900-\u097F\u0A00-\u0A7F]/.test(val)
    );
  };

  let houseNo = cleanPart(addr.house_number || addr.house || addr.flat || addr.apartment || addr.unit || addr.office);
  let building = cleanPart(addr.building || addr.apartments || addr.amenity);
  let road = cleanPart(addr.road || addr.street || addr.footway || addr.path);
  
  // Locality priority: 1. suburb, 2. neighbourhood, 3. residential, 4. quarter, 5. hamlet
  let locality = cleanPart(addr.suburb) ||
                 cleanPart(addr.neighbourhood) ||
                 cleanPart(addr.residential) ||
                 cleanPart(addr.quarter) ||
                 cleanPart(addr.hamlet) ||
                 "";

  let city = cleanPart(addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || addr.state_district);
  city = city.replace(/\s+district$/i, "").trim();
  let state = cleanPart(addr.state);
  let pincode = cleanPart(addr.postcode || addr.postal_code);

  const fallbackList = [houseNo, building, road, locality].filter(Boolean);
  const getFallback = (val) => {
    if (val && val.trim()) return val;
    return fallbackList[0] || "";
  };

  houseNo = getFallback(houseNo);
  building = getFallback(building);
  road = getFallback(road);
  locality = getFallback(locality);

  // Filter unwanted
  if (isUnwanted(houseNo)) houseNo = "";
  if (isUnwanted(building)) building = "";
  if (isUnwanted(road)) road = "";
  if (isUnwanted(locality)) locality = "";
  if (isUnwanted(city)) city = "";
  if (isUnwanted(state)) state = "";

  const parts = [];
  
  // House/building details first
  let houseBuildingPart = [houseNo, building].filter(Boolean).join(", ");
  if (houseNo && building && (houseNo.toLowerCase().includes(building.toLowerCase()) || building.toLowerCase().includes(houseNo.toLowerCase()))) {
    houseBuildingPart = houseNo.length > building.length ? houseNo : building;
  }
  if (houseBuildingPart) parts.push(houseBuildingPart);

  if (road) parts.push(road);

  // Recover specific missing details (e.g. "Phase 1", "Urban Estate Phase II", sector names) from displayName
  if (displayName) {
    const displayParts = displayName.split(",")
      .map(cleanPart)
      .filter(p => p && !isUnwanted(p));

    const cityLower = city ? city.toLowerCase() : "";
    const stateLower = state ? state.toLowerCase() : "";

    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      if (
        dpLower.includes("phase") ||
        dpLower.includes("sector") ||
        dpLower.includes("block") ||
        dpLower.includes("colony") ||
        dpLower.includes("estate") ||
        dpLower.includes("town") ||
        dpLower.includes("urban")
      ) {
        const matched = parts.some(p => p.toLowerCase().includes(dpLower) || dpLower.includes(p.toLowerCase()));
        if (!matched && dpLower !== cityLower && dpLower !== stateLower) {
          parts.push(dp);
        }
      }
    }
  }

  if (locality) {
    const matched = parts.some(p => p.toLowerCase().includes(locality.toLowerCase()) || locality.toLowerCase().includes(p.toLowerCase()));
    if (!matched) {
      parts.push(locality);
    }
  }

  if (city) {
    const matched = parts.some(p => p.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(p.toLowerCase()));
    if (!matched) {
      parts.push(city);
    }
  }

  if (state) {
    const matched = parts.some(p => p.toLowerCase().includes(state.toLowerCase()) || state.toLowerCase().includes(p.toLowerCase()));
    let stateString = state;
    if (pincode) {
      stateString = `${state} ${pincode}`;
    }
    if (!matched) {
      parts.push(stateString);
    } else {
      const idx = parts.findIndex(p => p.toLowerCase().includes(state.toLowerCase()));
      if (idx !== -1) {
        parts[idx] = stateString;
      }
    }
  } else if (pincode) {
    parts.push(pincode);
  }

  const uniqueParts = [];
  for (const part of parts) {
    if (!uniqueParts.some(p => p.toLowerCase() === part.toLowerCase())) {
      uniqueParts.push(part);
    }
  }

  return uniqueParts.join(", ");
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
  
  const cleanPart = (val) => {
    if (!val) return "";
    let s = val.toString().trim();
    s = s.replace(/[\u0900-\u097F\u0A00-\u0A7F]/g, ""); // strip Devanagari/Gurmukhi
    s = s.replace(/^[,.\s-]+|[,.\s-]+$/g, "").trim();
    return s;
  };

  const isUnwanted = (val) => {
    if (!val) return true;
    const s = val.toString().toLowerCase();
    return (
      s.includes("tahsil") ||
      s.includes("tehsil") ||
      s.includes("तहसील") ||
      s.includes("ਤਹਿਸੀਲ") ||
      s.includes("taluk") ||
      s.includes("taluka") ||
      s.includes(" i tahsil") ||
      s.includes("subdistrict") ||
      s.includes("sub-district") ||
      s === "india" ||
      s === "county" ||
      s === "state district" ||
      s.includes("district") ||
      s.includes("state_district") ||
      /[\u0900-\u097F\u0A00-\u0A7F]/.test(val)
    );
  };

  // 1. Gather raw tokens
  let houseNo = cleanPart(addr.house_number || addr.house || addr.flat || addr.apartment || addr.unit || addr.office);
  let building = cleanPart(addr.building || addr.apartments || addr.amenity);
  let road = cleanPart(addr.road || addr.street || addr.footway || addr.path);
  let residential = cleanPart(addr.residential || addr.development);
  let neighbourhood = cleanPart(addr.neighbourhood || addr.quarter);
  let suburb = cleanPart(addr.suburb || addr.village || addr.townland);
  let quarter = cleanPart(addr.quarter);
  let hamlet = cleanPart(addr.hamlet);
  let landmark = cleanPart(addr.landmark || addr.place || addr.commercial || addr.industrial);
  let city = cleanPart(addr.city || addr.town || addr.municipality || addr.city_district || addr.village || addr.county || addr.state_district);
  city = city.replace(/\s+district$/i, "").trim();
  let state = cleanPart(addr.state);
  let pincode = cleanPart(addr.postcode || addr.postal_code);

  // Apply locality priority list: suburb -> neighbourhood -> residential -> quarter -> hamlet
  let locality = suburb || neighbourhood || residential || quarter || hamlet || "";
  let area = locality || "";

  // The fallback array in order: house_number -> building -> road -> residential -> suburb -> neighbourhood
  const fallbackList = [houseNo, building, road, residential, suburb, neighbourhood].filter(Boolean);

  const getFallback = (val) => {
    if (val && val.trim()) return val;
    return fallbackList[0] || "";
  };

  // Populate all fields using empty field fallback order to avoid blank values
  let finalHouseNumber = getFallback(houseNo);
  let finalBuilding = getFallback(building);
  let finalRoad = getFallback(road);
  let finalLocality = getFallback(locality);
  let finalLandmark = getFallback(landmark);
  let finalArea = getFallback(area);
  let finalCity = city || locality || "";
  let finalState = state || "";
  let finalPincode = pincode || "";

  // Filter out unwanted terms from finalized fields
  if (isUnwanted(finalHouseNumber)) finalHouseNumber = "";
  if (isUnwanted(finalBuilding)) finalBuilding = "";
  if (isUnwanted(finalRoad)) finalRoad = "";
  if (isUnwanted(finalLocality)) finalLocality = "";
  if (isUnwanted(finalLandmark)) finalLandmark = "";
  if (isUnwanted(finalArea)) finalArea = "";
  if (isUnwanted(finalCity)) finalCity = "";
  if (isUnwanted(finalState)) finalState = "";

  // Make sure they have fallbacks if the clean operations emptied them
  finalHouseNumber = getFallback(finalHouseNumber);
  finalBuilding = getFallback(finalBuilding);
  finalRoad = getFallback(finalRoad);
  finalLocality = getFallback(finalLocality);
  finalArea = getFallback(finalArea);

  // If we have displayName, parse it for extra details (like "Phase 1")
  let candidates = [finalHouseNumber, finalBuilding, finalRoad, finalLocality].filter(Boolean);
  if (displayName) {
    const displayParts = displayName.split(",")
      .map(cleanPart)
      .filter(p => p && !isUnwanted(p));

    const cityLower = finalCity.toLowerCase();
    const stateLower = finalState.toLowerCase();
    const pincodeLower = finalPincode.toLowerCase();

    for (const dp of displayParts) {
      const dpLower = dp.toLowerCase();
      if (
        dpLower === cityLower || 
        dpLower === stateLower || 
        dpLower === pincodeLower || 
        (cityLower && cityLower.includes(dpLower)) ||
        (stateLower && stateLower.includes(dpLower))
      ) {
        continue;
      }

      const alreadyMatched = candidates.some(c => {
        const cLower = c.toLowerCase();
        return cLower.includes(dpLower) || dpLower.includes(cLower);
      });

      if (!alreadyMatched) {
        candidates.push(dp);
        // Put in road if road is blank, or in area
        if (!finalRoad) finalRoad = dp;
        else if (!finalLocality || finalLocality === finalRoad) finalLocality = dp;
      }
    }
  }

  // Final deduplication
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
    if (!isDup) {
      uniqueCandidates.push(cand);
    }
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

  // Check if we only found city + pincode (no granular details)
  const hasGranularDetails = !!(
    houseNo || building || road || residential || neighbourhood || suburb || quarter || hamlet || landmark
  );
  const isCityCenterOnly = !hasGranularDetails;

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
    isCityCenterOnly,
    lat: null,
    lng: null
  };
};

/** Light Uber-style map tiles (road labels visible) */
export const LIGHT_MAP_TILES =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
export const LIGHT_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const GEOCODE_CACHE = new Map();
const GEOCODE_CACHE_TTL_MS = 5 * 60 * 1000;
const GEOCODE_USER_AGENT = "SafeVoltServiceBooking/1.0 (service-booking-app)";

const coordCacheKey = (lat, lng) =>
  `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;

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

/**
 * Reverse geocode with Nominatim (primary, zoom=18) + Photon (fallback) and smart cache.
 */
export const reverseGeocode = async (lat, lng) => {
  const cacheKey = coordCacheKey(lat, lng);
  const cached = GEOCODE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL_MS) {
    return cached.data;
  }

  let photonProps = null;
  let nominatimAddr = null;
  let displayName = "";

  // 1. Try Nominatim Primary (zoom=19 for building granularity)
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1&accept-language=en`,
      { headers: { "User-Agent": GEOCODE_USER_AGENT } }
    );
    const nomJson = await nomRes.json();
    if (nomJson?.address) {
      nominatimAddr = nomJson.address;
      displayName = nomJson.display_name || "";
    }
  } catch { /* Nominatim primary failed, fallback to Photon */ }

  // 2. Try Photon Fallback only if Nominatim failed
  if (!nominatimAddr) {
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`
      );
      const photonJson = await photonRes.json();
      if (photonJson?.features?.[0]?.properties) {
        photonProps = photonJson.features[0].properties;
        const props = photonJson.features[0].properties;
        displayName = props.name || props.street || "";
        if (props.city) displayName += (displayName ? ", " : "") + props.city;
        if (props.state) displayName += (displayName ? ", " : "") + props.state;
      }
    } catch { /* Photon fallback failed */ }
  }

  const merged = mergePhotonNominatim(photonProps, nominatimAddr, displayName);
  const structured = cleanAddressFields(merged, displayName);
  structured.lat = lat;
  structured.lng = lng;

  GEOCODE_CACHE.set(cacheKey, { ts: Date.now(), data: structured });
  return structured;
};

/**
 * GPS + reverse geocode — use for "Detect Location" buttons with stabilization (up to 3 watched readings, target accuracy <= 50m).
 */
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
        } else {
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`GPS accuracy too low or timed out. Retrying attempt ${retryCount}...`);
            clearTimeout(timeoutId);
            resolve(executeDetection());
          } else {
            if (bestPos) {
              console.warn(`Best position accuracy is ${bestPos.coords.accuracy}m (target <= ${targetAccuracy}m). Resolving anyway.`);
              resolvePosition(bestPos);
            } else {
              reject(new Error("Location request timed out. Please retry."));
            }
          }
        }
      }, timeoutMs);

      const resolvePosition = async (pos) => {
        clearTimeout(timeoutId);
        clearWatchSafe();
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const address = await reverseGeocode(latitude, longitude);
          // Compute S2 cell IDs so all callers get them immediately
          const s2CellId = latLngToS2CellId(latitude, longitude, 13);
          const s2CellIdPrecise = latLngToS2CellId(latitude, longitude, 15);
          resolve({ latitude, longitude, accuracy, address: { ...address, lat: latitude, lng: longitude, s2CellId, s2CellIdPrecise } });
        } catch (err) {
          reject(err);
        }
      };

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateCount++;
          const currentAccuracy = pos.coords.accuracy;

          if (!bestPos || currentAccuracy < bestPos.coords.accuracy) {
            bestPos = pos;
          }

          if (currentAccuracy <= targetAccuracy) {
            resolvePosition(pos);
          } else if (updateCount >= maxUpdates) {
            if (bestPos.coords.accuracy <= targetAccuracy) {
              resolvePosition(bestPos);
            } else {
              if (retryCount < maxRetries) {
                retryCount++;
                console.warn(`GPS accuracy too low (${bestPos.coords.accuracy}m > ${targetAccuracy}m) after ${maxUpdates} updates. Retrying...`);
                clearTimeout(timeoutId);
                clearWatchSafe();
                resolve(executeDetection());
              } else {
                resolvePosition(bestPos);
              }
            }
          }
        },
        (err) => {
          clearTimeout(timeoutId);
          clearWatchSafe();
          if (retryCount < maxRetries) {
            retryCount++;
            console.warn(`GPS error: ${err.message}. Retrying...`);
            resolve(executeDetection());
          } else {
            const msg =
              err.code === 1
                ? "Location permission denied. Enable GPS in browser settings."
                : err.code === 2
                  ? "Location unavailable. Try again outdoors."
                  : "Location request timed out. Please retry.";
            reject(new Error(msg));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        }
      );
    });

  return executeDetection();
};

/** Map structured address to legacy form fields (also computes S2 cells if lat/lng present) */
export const toLegacyAddressFields = (structured) => {
  const lat = structured.lat;
  const lng = structured.lng;
  const s2CellId = (lat && lng) ? latLngToS2CellId(lat, lng, 13) : (structured.s2CellId || null);
  const s2CellIdPrecise = (lat && lng) ? latLngToS2CellId(lat, lng, 15) : (structured.s2CellIdPrecise || null);
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

/** Filter GPS jitter — ignore moves smaller than minMeters */
export const filterGPSJitter = (prev, next, minMeters = 8) => {
  if (!prev || prev.lat == null || prev.lng == null) return next;
  const R = 6371000;
  const dLat = ((next.lat - prev.lat) * Math.PI) / 180;
  const dLng = ((next.lng - prev.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((prev.lat * Math.PI) / 180) *
      Math.cos((next.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return dist < minMeters ? prev : next;
};

/** Bearing in degrees for marker rotation */
export const calculateBearing = (lat1, lon1, lat2, lon2) => {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
