const fs = require("fs");
const path = require("path");

function optimizeGeoJSON(inputPath, outputPath, precision = 6) {
  console.log(`Reading GeoJSON from: ${inputPath}`);
  const originalContent = fs.readFileSync(inputPath, "utf8");
  const originalSize = Buffer.byteLength(originalContent, "utf8");
  console.log(`Original file size: ${(originalSize / 1024).toFixed(2)} KB (${originalSize} bytes)`);

  const geojson = JSON.parse(originalContent);

  console.log(`Processing ${geojson.features.length} features...`);

  // Round coordinates to specified precision
  function roundCoordinates(coords, precision) {
    if (Array.isArray(coords[0])) {
      return coords.map(coord => roundCoordinates(coord, precision));
    } else {
      return coords.map(coord => parseFloat(coord.toFixed(precision)));
    }
  }

  // Optimize each feature
  const optimizedFeatures = geojson.features.map(feature => {
    // Round coordinates to reduce precision
    const optimizedGeometry = {
      ...feature.geometry,
      coordinates: roundCoordinates(feature.geometry.coordinates, precision)
    };

    // Keep only necessary properties (STATE is what the code uses)
    const optimizedProperties = {
      STATE: feature.properties.STATE
    };

    return {
      type: "Feature",
      properties: optimizedProperties,
      geometry: optimizedGeometry
    };
  });

  const optimizedGeoJSON = {
    type: "FeatureCollection",
    features: optimizedFeatures
  };

  // Minify JSON (no indentation)
  const optimizedContent = JSON.stringify(optimizedGeoJSON);
  const optimizedSize = Buffer.byteLength(optimizedContent, "utf8");
  
  const reduction = originalSize - optimizedSize;
  const reductionPercent = ((reduction / originalSize) * 100).toFixed(2);

  console.log(`\nOptimized file size: ${(optimizedSize / 1024).toFixed(2)} KB (${optimizedSize} bytes)`);
  console.log(`Size reduction: ${(reduction / 1024).toFixed(2)} KB (${reductionPercent}%)`);

  if (reductionPercent >= 20) {
    console.log(`✅ Successfully reduced file size by ${reductionPercent}% (target: 20%)`);
  } else {
    console.log(`⚠️  Size reduction is ${reductionPercent}%, which is less than 20% target`);
  }

  fs.writeFileSync(outputPath, optimizedContent, "utf8");
  console.log(`\n✅ Optimized GeoJSON saved to: ${outputPath}`);
}

// Run optimization
const inputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/indiaStates.json");
const outputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/indiaStates.json");

optimizeGeoJSON(inputPath, outputPath, 6); // 6 decimal places = ~10cm accuracy, sufficient for maps





