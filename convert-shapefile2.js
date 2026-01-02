const shapefile = require("shapefile");
const fs = require("fs");
const path = require("path");

// Mapping function to normalize state names from shapefile to expected format
function normalizeStateName(name) {
  if (!name) return '';
  
  // Normalize common variations and misspellings
  const stateNameMap = {
    'Chhattishgarh': 'CHHATTISGARH',
    'Telengana': 'TELANGANA',
    'Tamilnadu': 'TAMIL NADU',
    'Andaman & Nicobar': 'ANDAMAN AND NICOBAR ISLANDS',
    'Daman and Diu and Dadra and Nagar Haveli': 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
    'Jammu and Kashmir': 'JAMMU AND KASHMIR',
  };
  
  // Check if there's a direct mapping
  if (stateNameMap[name]) {
    return stateNameMap[name];
  }
  
  // Otherwise, convert to uppercase and handle common patterns
  let normalized = name.toUpperCase();
  
  // Handle "&" to "AND"
  normalized = normalized.replace(/&/g, 'AND');
  
  return normalized;
}

async function convertShapefileToGeoJSON() {
  const inputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/raw/india-states/India_State_Boundary.shp");
  const outputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/indiaStates.json");
  
  console.log("Converting shapefile to GeoJSON...");
  console.log("Input:", inputPath);
  console.log("Output:", outputPath);
  
  const features = [];
  
  try {
    const source = await shapefile.open(inputPath);
    let result = await source.read();
    
    while (!result.done) {
      const feature = result.value;
      
      // Map Name property to STATE property (in uppercase, normalized)
      const originalName = feature.properties.Name || '';
      const normalizedState = normalizeStateName(originalName);
      
      // Update properties to include STATE property for ECharts ma tching
      feature.properties = {
        ...feature.properties,
        STATE: normalizedState,
        Name: originalName, // Keep original name for reference
      };
      
      features.push(feature);
      result = await source.read();
    }
    
    const geojson = {
      type: "FeatureCollection",
      features: features
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    console.log(`✅ Successfully converted! Created ${features.length} features.`);
    console.log(`File saved to: ${outputPath}`);
    
    // Print all feature properties to see what fields are available
    if (features.length > 0) {
      console.log("\n📋 Sample feature properties:");
      console.log(JSON.stringify(features[0].properties, null, 2));
      
      console.log("\n📋 All state names (Name → STATE):");
      features.forEach(f => {
        console.log(`  - "${f.properties.Name}" → "${f.properties.STATE}"`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

convertShapefileToGeoJSON();

