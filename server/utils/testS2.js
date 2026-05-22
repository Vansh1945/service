const {
    latLngToS2CellId,
    s2CellIdToLatLng,
    s2CellIdToCorners,
    getNeighbors,
    getLevel
} = require('./s2Helper');

function testS2() {
    console.log("=== RUNNING S2 GEOMETRY UNIT TESTS ===");
    
    // Test Case 1: Coordinate roundtrip validation
    const origin = { lat: 12.971598, lng: 77.594562 }; // Bangalore coords
    console.log(`Original Coordinate: lat=${origin.lat}, lng=${origin.lng}`);
    
    const cell13 = latLngToS2CellId(origin.lat, origin.lng, 13);
    const cell15 = latLngToS2CellId(origin.lat, origin.lng, 15);
    console.log(`Level 13 Cell ID (hex): ${cell13}`);
    console.log(`Level 15 Cell ID (hex): ${cell15}`);
    
    const decoded13 = s2CellIdToLatLng(cell13);
    const decoded15 = s2CellIdToLatLng(cell15);
    
    console.log(`Decoded L13 Center: lat=${decoded13.lat.toFixed(6)}, lng=${decoded13.lng.toFixed(6)}`);
    console.log(`Decoded L15 Center: lat=${decoded15.lat.toFixed(6)}, lng=${decoded15.lng.toFixed(6)}`);
    
    const dist13 = Math.sqrt((decoded13.lat - origin.lat)**2 + (decoded13.lng - origin.lng)**2);
    const dist15 = Math.sqrt((decoded15.lat - origin.lat)**2 + (decoded15.lng - origin.lng)**2);
    
    console.log(`L13 precision offset: ${dist13.toFixed(6)} degrees`);
    console.log(`L15 precision offset: ${dist15.toFixed(6)} degrees`);
    
    if (dist13 > 0.05 || dist15 > 0.01) {
        throw new Error("FAIL: Roundtrip coordinate precision is too low!");
    }
    console.log("✅ Roundtrip encoding/decoding is correct.");
    
    // Test Case 2: Level discovery
    const lvl13 = getLevel(BigInt('0x' + cell13));
    const lvl15 = getLevel(BigInt('0x' + cell15));
    console.log(`Detected Level for cell13: ${lvl13}`);
    console.log(`Detected Level for cell15: ${lvl15}`);
    
    if (lvl13 !== 13 || lvl15 !== 15) {
        throw new Error("FAIL: S2 cell level discovery is broken!");
    }
    console.log("✅ Cell level detection is correct.");

    // Test Case 3: Bounding corner generation
    const corners15 = s2CellIdToCorners(cell15);
    console.log(`Corners returned: ${corners15.length}`);
    corners15.forEach((c, idx) => {
        console.log(`  Corner ${idx + 1}: [${c[0].toFixed(6)}, ${c[1].toFixed(6)}]`);
    });
    
    if (corners15.length !== 4) {
        throw new Error("FAIL: Corner generation must return exactly 4 points!");
    }
    console.log("✅ Bounding corner coordinates generated.");

    // Test Case 4: Neighbor coordinates
    const neighbors13 = getNeighbors(cell13);
    console.log(`Level 13 neighbors: ${neighbors13.length}`);
    neighbors13.forEach((n, idx) => {
        console.log(`  Neighbor ${idx + 1}: ${n}`);
    });
    
    if (neighbors13.length === 0 || neighbors13.includes(cell13)) {
        throw new Error("FAIL: Neighbors retrieval failed!");
    }
    console.log("✅ Adjacent neighbors generated.");
    
    console.log("=== ALL S2 TESTS PASSED SUCCESSFULLY ===");
}

try {
    testS2();
} catch (error) {
    console.error("Test failed with error:", error.message);
    process.exit(1);
}
