const shapefile = require("shapefile");
const fs = require("fs");
const path = require("path");

// Helper function to clean string (remove null characters and trim)
function cleanString(str) {
  if (!str) return '';
  return str.toString().replace(/\0/g, '').trim();
}

// Mapping function to normalize pincode names
function normalizePincode(pincode) {
  if (!pincode) return '';
  
  // Clean the pincode (remove null characters, spaces, trim)
  const cleaned = cleanString(pincode);
  
  // Remove spaces and ensure it's a string
  return String(cleaned).replace(/\s+/g, '').trim();
}

async function convertPincodeShapefileToGeoJSON() {
  const inputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/raw/india-pincodes/india_pincodes.shp");
  const outputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/indiaPincodes.json");
  
  console.log("Converting pincode shapefile to GeoJSON...");
  console.log("Input:", inputPath);
  console.log("Output:", outputPath);
  
  // Check if file exists and has content
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Shapefile not found at ${inputPath}`);
    console.error("Please ensure the shapefile is extracted from the split zip archive.");
    console.error("You may need to use 7-Zip or WinRAR to extract the split archive (.z01, .z02, etc.)");
    process.exit(1);
  }
  
  const stats = fs.statSync(inputPath);
  if (stats.size === 0) {
    console.error(`❌ Error: Shapefile is empty (0 bytes)`);
    console.error("The .shp file appears to be empty. You need to extract it from the split zip archive.");
    console.error("The archive is split into multiple parts (.z01, .z02, .z03, .z04, .z05).");
    console.error("Please use 7-Zip or WinRAR to extract india_pincodes.shp.zip (which will combine all parts).");
    process.exit(1);
  }
  
  const features = [];
  
  try {
    const source = await shapefile.open(inputPath);
    let result = await source.read();
    
    // Check first feature to see what properties are available
    let firstFeature = null;
    if (!result.done) {
      firstFeature = result.value;
      console.log("\n📋 Sample feature properties from shapefile:");
      console.log(JSON.stringify(firstFeature.properties, null, 2));
    }
    
    // Reset to read from beginning
    const source2 = await shapefile.open(inputPath);
    result = await source2.read();
    
    while (!result.done) {
      const feature = result.value;
      
      // Try to find pincode property (could be PINCODE, PIN_CODE, pincode, etc.)
      const pincodeProperty = feature.properties.PINCODE || 
                              feature.properties.PIN_CODE || 
                              feature.properties.pincode || 
                              feature.properties.Pincode ||
                              feature.properties.PIN ||
                              feature.properties.pin ||
                              feature.properties.POSTAL ||
                              feature.properties.postal ||
                              '';
      
      const normalizedPincode = normalizePincode(pincodeProperty);
      
      if (!normalizedPincode) {
        // Skip features without pincode
        result = await source2.read();
        continue;
      }
      
      // Clean all string properties
      const cleanedProperties = {};
      for (const key in feature.properties) {
        if (typeof feature.properties[key] === 'string') {
          cleanedProperties[key] = cleanString(feature.properties[key]);
        } else {
          cleanedProperties[key] = feature.properties[key];
        }
      }
      
      // Update properties to include 'pincode' property for ECharts matching
      feature.properties = {
        ...cleanedProperties,
        pincode: normalizedPincode, // This is what ECharts will use for matching
        PINCODE: normalizedPincode, // Keep original property name if it exists
      };
      
      features.push(feature);
      result = await source2.read();
    }
    
    const geojson = {
      type: "FeatureCollection",
      features: features
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    console.log(`\n✅ Successfully converted! Created ${features.length} pincode features.`);
    console.log(`File saved to: ${outputPath}`);
    
    // Print sample pincode names
    if (features.length > 0) {
      console.log("\n📋 Sample pincode names (first 20):");
      features.slice(0, 20).forEach(f => {
        console.log(`  - "${f.properties.pincode}"`);
      });
      
      // Check for common pincodes
      const commonPincodes = ['110001', '400001', '560001', '600001', '700001'];
      console.log("\n📋 Checking for common pincodes:");
      commonPincodes.forEach(pin => {
        const found = features.find(f => 
          f.properties.pincode === pin || 
          f.properties.pincode === String(pin)
        );
        if (found) {
          console.log(`  ✅ Found: "${found.properties.pincode}"`);
        } else {
          console.log(`  ❌ Not found: "${pin}"`);
        }
      });
      
      // Show property names for reference
      console.log("\n📋 Available property names in shapefile:");
      const propertyNames = Object.keys(features[0].properties);
      propertyNames.forEach(name => {
        console.log(`  - ${name}`);
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

convertPincodeShapefileToGeoJSON();
