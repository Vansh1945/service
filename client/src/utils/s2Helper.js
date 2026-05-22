/**
 * s2Helper.js - Pure JavaScript Zero-Dependency S2 Geometry Engine
 *
 * Implements S2 projection, quadratic warping, Hilbert curve encoding/decoding,
 * and Level 13 (neighborhood matchmaking) and Level 15 (precise geofencing) support.
 */

// Hilbert quadrant lookup tables
const ijToPos = [
    [[0, 1], [3, 2]], // Orientation 0: (0,0)->0, (0,1)->1, (1,0)->3, (1,1)->2
    [[0, 3], [1, 2]], // Orientation 1
    [[2, 3], [1, 0]], // Orientation 2
    [[2, 1], [3, 0]]  // Orientation 3
];

const posToIJ = [
    [[0, 0], [0, 1], [1, 1], [1, 0]], // Orientation 0
    [[0, 0], [1, 0], [1, 1], [0, 1]], // Orientation 1
    [[1, 1], [1, 0], [0, 0], [0, 1]], // Orientation 2
    [[1, 1], [0, 1], [0, 0], [1, 0]]  // Orientation 3
];

const orientationChange = [
    [1, 0, 0, 3], // Orientation 0 -> transitions based on position (0-3)
    [0, 1, 1, 2], // Orientation 1
    [3, 2, 2, 1], // Orientation 2
    [2, 3, 3, 0]  // Orientation 3
];

const LIMIT = 1073741824; // 1 << 30

/**
 * Encodes Level 30 coordinates i, j to 60-bit Hilbert index
 */
function ijToHilbert(i, j) {
    let hilbert = 0n;
    let orientation = 0;
    for (let k = 29; k >= 0; k--) {
        const iBit = (i >> k) & 1;
        const jBit = (j >> k) & 1;
        const pos = ijToPos[orientation][iBit][jBit];
        hilbert = (hilbert << 2n) | BigInt(pos);
        orientation = orientationChange[orientation][pos];
    }
    return hilbert;
}

/**
 * Decodes 60-bit Hilbert index back to Level 30 coordinates i, j
 */
function hilbertToIJ(hilbert) {
    let i = 0;
    let j = 0;
    let orientation = 0;
    for (let k = 29; k >= 0; k--) {
        const pos = Number((hilbert >> BigInt(2 * k)) & 3n);
        const [iBit, jBit] = posToIJ[orientation][pos];
        i = (i << 1) | iBit;
        j = (j << 1) | jBit;
        orientation = orientationChange[orientation][pos];
    }
    return { i, j };
}

/**
 * Quadratic warping functions to ensure area uniformity across cube faces
 */
function warp(x) {
    if (x >= 0) {
        return 0.5 * Math.sqrt(1 + 3 * x);
    } else {
        return 1 - 0.5 * Math.sqrt(1 - 3 * x);
    }
}

function unwarp(w) {
    if (w >= 0.5) {
        return (4 * w * w - 1) / 3;
    } else {
        return (1 - 4 * (1 - w) * (1 - w)) / 3;
    }
}

/**
 * Projects a 3D unit vector to S2 face, u, and v coordinates
 */
function xyzToFaceUV(x, y, z) {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);
    let face = 0;
    let u = 0, v = 0;

    if (absX >= absY && absX >= absZ) {
        if (x > 0) {
            face = 0;
            u = y / x;
            v = z / x;
        } else {
            face = 3;
            u = z / x;
            v = y / x;
        }
    } else if (absY >= absX && absY >= absZ) {
        if (y > 0) {
            face = 1;
            u = -x / y;
            v = z / y;
        } else {
            face = 4;
            u = z / y;
            v = -x / y;
        }
    } else {
        if (z > 0) {
            face = 2;
            u = -x / z;
            v = -y / z;
        } else {
            face = 5;
            u = -y / z;
            v = -x / z;
        }
    }
    return { face, u, v };
}

/**
 * Projects S2 face, u, and v back to a normalized 3D unit vector
 */
function faceUVToXYZ(face, u, v) {
    let x = 0, y = 0, z = 0;
    switch (face) {
        case 0:
            x = 1; y = u; z = v;
            break;
        case 1:
            x = -u; y = 1; z = v;
            break;
        case 2:
            x = -u; y = -v; z = 1;
            break;
        case 3:
            x = -1; y = -v; z = -u;
            break;
        case 4:
            x = v; y = -1; z = -u;
            break;
        case 5:
            x = v; y = u; z = -1;
            break;
    }
    const len = Math.sqrt(x * x + y * y + z * z);
    return { x: x / len, y: y / len, z: z / len };
}

/**
 * Computes S2 Cell Level from a parsed BigInt Cell ID
 */
function getLevel(cellId) {
    for (let b = 0; b <= 60; b += 2) {
        if ((cellId & (1n << BigInt(b))) !== 0n) {
            return (60 - b) / 2;
        }
    }
    return 0;
}

/**
 * Converts Latitude/Longitude coordinates to 16-character hex S2 Cell ID
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @param {number} level S2 Cell Level (e.g. 13 or 15)
 * @returns {string} 16-character padded hex S2 Cell ID
 */
function latLngToS2CellId(lat, lng, level) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
        return null;
    }
    
    // Radian conversions
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const cosLat = Math.cos(latRad);

    // 3D Unit Vector
    const x = cosLat * Math.cos(lngRad);
    const y = cosLat * Math.sin(lngRad);
    const z = Math.sin(latRad);

    // Coordinate mapping and warping
    const { face, u, v } = xyzToFaceUV(x, y, z);
    const s = warp(u);
    const t = warp(v);

    // Leaf Coordinates (Level 30)
    const i = Math.min(LIMIT - 1, Math.max(0, Math.floor(s * LIMIT)));
    const j = Math.min(LIMIT - 1, Math.max(0, Math.floor(t * LIMIT)));

    // Hilbert encoding and cell formatting
    const hilbert = ijToHilbert(i, j);
    const leafId = (BigInt(face) << 61n) | (hilbert << 1n) | 1n;
    
    // Mask and truncate to the desired level
    const mask = ~((1n << BigInt(61 - 2 * level)) - 1n);
    const cellId = (leafId & mask) | (1n << BigInt(60 - 2 * level));

    return cellId.toString(16).padStart(16, '0');
}

/**
 * Decodes 16-character hex S2 Cell ID back to standard Latitude/Longitude
 * @param {string} cellIdHex S2 Cell ID (hex string)
 * @returns {{lat: number, lng: number}} Latitude/Longitude center of the cell
 */
function s2CellIdToLatLng(cellIdHex) {
    if (!cellIdHex) return null;
    const cellId = BigInt('0x' + cellIdHex);
    const face = Number(cellId >> 61n);
    const level = getLevel(cellId);

    // Recover lower-left Hilbert index
    const hilbertLowerLeft = (cellId & ((1n << 61n) - 1n)) & ~((1n << BigInt(61 - 2 * level)) - 1n);
    const hilbertLeaf = hilbertLowerLeft >> 1n;

    const { i, j } = hilbertToIJ(hilbertLeaf);

    // Midpoint leaf coordinate
    const offset = level === 30 ? 0.5 : (1 << (29 - level));
    const iCenter = i + offset;
    const jCenter = j + offset;

    const s = iCenter / LIMIT;
    const t = jCenter / LIMIT;

    const u = unwarp(s);
    const v = unwarp(t);

    const { x, y, z } = faceUVToXYZ(face, u, v);

    const latRad = Math.asin(z);
    const lngRad = Math.atan2(y, x);

    return {
        lat: (latRad * 180) / Math.PI,
        lng: (lngRad * 180) / Math.PI
    };
}

/**
 * Computes the 4 corners of an S2 cell
 * @param {string} cellIdHex S2 Cell ID (hex string)
 * @returns {Array<Array<number>>} Array of [latitude, longitude] pairs in CCW order
 */
function s2CellIdToCorners(cellIdHex) {
    if (!cellIdHex) return [];
    const cellId = BigInt('0x' + cellIdHex);
    const face = Number(cellId >> 61n);
    const level = getLevel(cellId);

    const hilbertLowerLeft = (cellId & ((1n << 61n) - 1n)) & ~((1n << BigInt(61 - 2 * level)) - 1n);
    const hilbertLeaf = hilbertLowerLeft >> 1n;

    const { i, j } = hilbertToIJ(hilbertLeaf);
    const span = 1 << (30 - level);

    // 4 Corner leaf coordinate offsets
    const corners = [
        { ci: i, cj: j },                 // Bottom-Left
        { ci: i + span, cj: j },          // Bottom-Right
        { ci: i + span, cj: j + span },   // Top-Right
        { ci: i, cj: j + span }           // Top-Left
    ];

    return corners.map(({ ci, cj }) => {
        const s = ci / LIMIT;
        const t = cj / LIMIT;
        const u = unwarp(s);
        const v = unwarp(t);
        const { x, y, z } = faceUVToXYZ(face, u, v);
        const lat = (Math.asin(z) * 180) / Math.PI;
        const lng = (Math.atan2(y, x) * 180) / Math.PI;
        return [lat, lng];
    });
}

/**
 * Gets 8 adjacent S2 cell neighbors at the same level
 * @param {string} cellIdHex S2 Cell ID (hex string)
 * @returns {Array<string>} Array of neighbor cell ID hex strings
 */
function getNeighbors(cellIdHex) {
    if (!cellIdHex) return [];
    const cellId = BigInt('0x' + cellIdHex);
    const face = Number(cellId >> 61n);
    const level = getLevel(cellId);

    const hilbertLowerLeft = (cellId & ((1n << 61n) - 1n)) & ~((1n << BigInt(61 - 2 * level)) - 1n);
    const hilbertLeaf = hilbertLowerLeft >> 1n;

    const { i, j } = hilbertToIJ(hilbertLeaf);

    const parentShift = 30 - level;
    const iL = i >> parentShift;
    const jL = j >> parentShift;

    const neighborSet = new Set();
    const maxVal = (1 << level) - 1;

    for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
            if (di === 0 && dj === 0) continue;

            const ni = iL + di;
            const nj = jL + dj;

            // Clamp coordinate within the S2 face boundary mapping
            const niClamped = Math.min(maxVal, Math.max(0, ni));
            const njClamped = Math.min(maxVal, Math.max(0, nj));

            const niLeaf = niClamped << parentShift;
            const njLeaf = njClamped << parentShift;

            const nhilbert = ijToHilbert(niLeaf, njLeaf);
            const nleafId = (BigInt(face) << 61n) | (nhilbert << 1n) | 1n;
            const mask = ~((1n << BigInt(61 - 2 * level)) - 1n);
            const ncellId = (nleafId & mask) | (1n << BigInt(60 - 2 * level));
            
            const nHex = ncellId.toString(16).padStart(16, '0');
            if (nHex !== cellIdHex) {
                neighborSet.add(nHex);
            }
        }
    }

    return Array.from(neighborSet);
}

export {
    latLngToS2CellId,
    s2CellIdToLatLng,
    s2CellIdToCorners,
    getNeighbors,
    getLevel
};
