import axiosInstance from "../api/axiosInstance";
import * as turf from "@turf/turf";

export const createZone = (data) => {
    return axiosInstance.post("/zones/create", data);
};

export const getAllZones = (params) => {
    return axiosInstance.get("/zones/all", { params });
};

export const getZoneById = (id) => {
    return axiosInstance.get(`/zones/${id}`);
};

export const updateZone = (id, data) => {
    return axiosInstance.put(`/zones/${id}`, data);
};

export const deleteZone = (id) => {
    return axiosInstance.delete(`/zones/${id}`);
};

export const toggleZoneStatus = (id) => {
    return axiosInstance.patch(`/zones/toggle/${id}`);
};

export const resolveZone = (data) => {
    return axiosInstance.post("/zones/resolve", data);
};

const intersectsBbox = (poly1Coords, poly2Coords) => {
    let minLat1 = Infinity, maxLat1 = -Infinity, minLng1 = Infinity, maxLng1 = -Infinity;
    for (const c of poly1Coords) {
        if (c[0] < minLat1) minLat1 = c[0];
        if (c[0] > maxLat1) maxLat1 = c[0];
        if (c[1] < minLng1) minLng1 = c[1];
        if (c[1] > maxLng1) maxLng1 = c[1];
    }
    
    let minLat2 = Infinity, maxLat2 = -Infinity, minLng2 = Infinity, maxLng2 = -Infinity;
    for (const c of poly2Coords) {
        if (c[0] < minLat2) minLat2 = c[0];
        if (c[0] > maxLat2) maxLat2 = c[0];
        if (c[1] < minLng2) minLng2 = c[1];
        if (c[1] > maxLng2) maxLng2 = c[1];
    }
    
    return !(maxLat1 < minLat2 || minLat1 > maxLat2 || maxLng1 < minLng2 || minLng1 > maxLng2);
};

const snapCoordinates = (coords, existingZones, thresholdMeters = 35) => {
    if (!coords || coords.length === 0) return coords;
    
    const thresholdKm = thresholdMeters / 1000;
    
    // Extract all vertices from all active zones
    const existingPoints = [];
    for (const zone of existingZones) {
        if (zone.coordinates && zone.coordinates.length >= 3) {
            for (const c of zone.coordinates) {
                existingPoints.push([c[1], c[0]]); // [lng, lat]
            }
        }
    }

    if (existingPoints.length === 0) return coords;

    // Check if it's a closed loop
    const isClosed = coords.length > 1 && 
                     coords[0][0] === coords[coords.length - 1][0] && 
                     coords[0][1] === coords[coords.length - 1][1];

    // If closed, snap only up to length - 1, then copy the first snapped coordinate to the last
    const pointsToSnap = isClosed ? coords.slice(0, coords.length - 1) : coords;

    const snapped = pointsToSnap.map(point => {
        let minDistance = Infinity;
        let bestPoint = point;

        for (const extP of existingPoints) {
            const dist = turf.distance(turf.point(point), turf.point(extP), { units: 'kilometers' });
            if (dist < minDistance) {
                minDistance = dist;
                bestPoint = extP;
            }
        }

        if (minDistance < thresholdKm) {
            return [bestPoint[0], bestPoint[1]];
        }
        return point;
    });

    if (isClosed) {
        snapped.push([snapped[0][0], snapped[0][1]]);
    }

    return snapped;
};

/**
 * Computes non-overlapping coordinates for a new polygon by subtracting all other active zones.
 * If the resulting geometry is split into a MultiPolygon, the largest polygon component is extracted.
 * Returns null if the polygon becomes empty/completely covered.
 * 
 * @param {Array<Array<number>>} newCoords Coordinates in [[latitude, longitude], ...] format.
 * @param {Array<Object>} existingZones Array of existing zone objects from state.
 * @param {string|null} editingZoneId ID of the zone currently being edited (to exclude it).
 * @returns {Array<Array<number>>|null} Clipped coordinates in [[latitude, longitude], ...] or null.
 */
export const computeNonOverlappingPolygon = (newCoords, existingZones, editingZoneId = null, parentZoneId = null) => {
    console.log("[Turf Clipping] computeNonOverlappingPolygon started.", {
        newCoordsLength: newCoords?.length,
        existingZonesCount: existingZones?.length,
        editingZoneId,
        parentZoneId
    });

    if (!newCoords || newCoords.length < 3) {
        console.warn("[Turf Clipping] Invalid newCoords length:", newCoords?.length);
        return null;
    }

    // Convert coordinates to Turf Polygon GeoJSON standard: [[longitude, latitude], ...]
    let newGeojsonCoords = newCoords.map(c => [c[1], c[0]]);

    // Filter active zones and exclude current editing zone and parent zone
    const activeZones = existingZones.filter(z => 
        z.status === 'active' && 
        z.id !== editingZoneId && 
        z._id !== editingZoneId &&
        z.id !== parentZoneId &&
        z._id !== parentZoneId
    );

    console.log("[Turf Clipping] Active zones to check for overlap:", activeZones.map(z => ({ id: z.id, name: z.name, coordsLength: z.coordinates?.length })));

    // Snap the input coordinates to existing active zone vertices to align boundaries before difference
    newGeojsonCoords = snapCoordinates(newGeojsonCoords, activeZones, 35);

    // Ensure coordinates are closed for GeoJSON compliance
    if (newGeojsonCoords[0][0] !== newGeojsonCoords[newGeojsonCoords.length - 1][0] ||
        newGeojsonCoords[0][1] !== newGeojsonCoords[newGeojsonCoords.length - 1][1]) {
        newGeojsonCoords.push([newGeojsonCoords[0][0], newGeojsonCoords[0][1]]);
    }

    let currentPoly = turf.polygon([newGeojsonCoords]);

    for (const zone of activeZones) {
        if (!zone.coordinates || zone.coordinates.length < 3) {
            console.log(`[Turf Clipping] Skipping zone ${zone.name} due to insufficient coordinates`);
            continue;
        }

        // Fast bounding box intersection check first
        if (!intersectsBbox(newCoords, zone.coordinates)) {
            console.log(`[Turf Clipping] Skipping zone ${zone.name} - bounding boxes do not overlap`);
            continue;
        }

        // Convert existing zone coordinates to Turf Polygon GeoJSON standard: [[longitude, latitude], ...]
        const zoneGeojsonCoords = zone.coordinates.map(c => [c[1], c[0]]);
        if (zoneGeojsonCoords[0][0] !== zoneGeojsonCoords[zoneGeojsonCoords.length - 1][0] ||
            zoneGeojsonCoords[0][1] !== zoneGeojsonCoords[zoneGeojsonCoords.length - 1][1]) {
            zoneGeojsonCoords.push([zoneGeojsonCoords[0][0], zoneGeojsonCoords[0][1]]);
        }

        const zonePoly = turf.polygon([zoneGeojsonCoords]);

        try {
            console.log(`[Turf Clipping] Subtracting zone: ${zone.name}`);
            // Compute difference: currentPoly - zonePoly
            const diff = turf.difference(turf.featureCollection([currentPoly, zonePoly]));
            if (!diff) {
                console.log(`[Turf Clipping] Zone ${zone.name} completely covers the drawn polygon.`);
                // Polygon is completely covered by existing active zones
                return null;
            }

            if (diff.geometry.type === 'MultiPolygon') {
                console.log(`[Turf Clipping] Subtraction resulted in MultiPolygon. Extracting largest area...`);
                // Find and extract the polygon component with the largest surface area
                let maxArea = -1;
                let largestPolyCoords = null;

                for (const coords of diff.geometry.coordinates) {
                    const tempPoly = turf.polygon(coords);
                    const area = turf.area(tempPoly);
                    if (area > maxArea) {
                        maxArea = area;
                        largestPolyCoords = coords;
                    }
                }
                if (largestPolyCoords) {
                    currentPoly = turf.polygon(largestPolyCoords);
                } else {
                    console.warn(`[Turf Clipping] Failed to extract largest polygon from MultiPolygon`);
                    return null;
                }
            } else {
                currentPoly = diff;
            }
        } catch (err) {
            console.error("Error computing Turf difference for zone:", zone.name, err);
            // In case of any geometry computation issues, fall back to current progress
        }
    }

    // Snap the final difference result coordinates to align them perfectly
    let finalGeojsonCoords = snapCoordinates(currentPoly.geometry.coordinates[0], activeZones, 35);

    // Convert back to [[latitude, longitude], ...] format and remove the closed-loop duplicate at the end for rendering/saving
    const finalCoords = finalGeojsonCoords.map(c => [c[1], c[0]]);
    if (finalCoords.length > 1 && finalCoords[0][0] === finalCoords[finalCoords.length - 1][0] && finalCoords[0][1] === finalCoords[finalCoords.length - 1][1]) {
        finalCoords.pop();
    }

    console.log("[Turf Clipping] Completed successfully. Final coords length:", finalCoords.length);
    return finalCoords;
};

