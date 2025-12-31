const shapefile = require("shapefile");
const fs = require("fs");
const path = require("path");

// Helper function to clean string (remove null characters and trim)
function cleanString(str) {
  if (!str) return '';
  return str.toString().replace(/\0/g, '').trim();
}

// Mapping function to normalize country names from shapefile to expected format
function normalizeCountryName(name) {
  if (!name) return '';
  
  // Clean the name first (remove null characters)
  const cleaned = cleanString(name);
  
  // Common country name mappings to standardize names
  const countryNameMap = {
    'United States of America': 'United States of America',
    'United States': 'United States of America',
    'USA': 'United States of America',
    'US': 'United States of America',
    'United Kingdom': 'United Kingdom',
    'UK': 'United Kingdom',
    'United Arab Emirates': 'United Arab Emirates',
    'UAE': 'United Arab Emirates',
    'Russian Federation': 'Russia',
    'Russia': 'Russia',
    'South Korea': 'South Korea',
    'Korea, South': 'South Korea',
    'Republic of Korea': 'South Korea',
    'North Korea': 'North Korea',
    'Korea, North': 'North Korea',
    'Democratic Republic of the Congo': 'Democratic Republic of the Congo',
    'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
    'Republic of the Congo': 'Republic of the Congo',
    'Congo, Republic of the': 'Republic of the Congo',
    'Myanmar': 'Myanmar',
    'Burma': 'Myanmar',
    'Ivory Coast': 'Ivory Coast',
    "Côte d'Ivoire": 'Ivory Coast',
    'Czech Republic': 'Czech Republic',
    'Czechia': 'Czech Republic',
  };
  
  // Check if there's a direct mapping
  if (countryNameMap[cleaned]) {
    return countryNameMap[cleaned];
  }
  
  // Return cleaned name
  return cleaned;
}

async function convertWorldShapefileToGeoJSON() {
  const inputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/raw/world-countries/ne_110m_admin_0_countries.shp");
  const outputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/worldCountries.json");
  
  console.log("Converting world shapefile to GeoJSON...");
  console.log("Input:", inputPath);
  console.log("Output:", outputPath);
  
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
      
      // Natural Earth shapefiles typically have NAME, NAME_LONG, or NAME_EN properties
      // Prefer NAME_LONG (full name) over NAME (short name)
      const countryName = cleanString(feature.properties.NAME_LONG) || 
                          cleanString(feature.properties.NAME_EN) || 
                          cleanString(feature.properties.NAME) || 
                          cleanString(feature.properties.ADMIN) || 
                          '';
      
      // Normalize the country name
      const normalizedName = normalizeCountryName(countryName) || countryName;
      
      // Update properties to include 'name' property for ECharts matching
      // Keep original properties for reference (but clean them)
      const cleanedProperties = {};
      for (const key in feature.properties) {
        if (typeof feature.properties[key] === 'string') {
          cleanedProperties[key] = cleanString(feature.properties[key]);
        } else {
          cleanedProperties[key] = feature.properties[key];
        }
      }
      
      feature.properties = {
        ...cleanedProperties,
        name: normalizedName, // This is what ECharts will use for matching
        NAME: countryName, // Keep original name for reference
      };
      
      features.push(feature);
      result = await source2.read();
    }
    
    const geojson = {
      type: "FeatureCollection",
      features: features
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    console.log(`\n✅ Successfully converted! Created ${features.length} country features.`);
    console.log(`File saved to: ${outputPath}`);
    
    // Print sample country names
    if (features.length > 0) {
      console.log("\n📋 Sample country names (first 20):");
      features.slice(0, 20).forEach(f => {
        console.log(`  - "${f.properties.name}"`);
      });
      
      // Check for common countries
      const commonCountries = ['India', 'United States of America', 'China', 'United Kingdom', 'Germany', 'France', 'Japan'];
      console.log("\n📋 Checking for common countries:");
      commonCountries.forEach(country => {
        const found = features.find(f => 
          f.properties.name === country || 
          f.properties.name.toLowerCase().includes(country.toLowerCase())
        );
        if (found) {
          console.log(`  ✅ Found: "${found.properties.name}"`);
        } else {
          console.log(`  ❌ Not found: "${country}"`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

convertWorldShapefileToGeoJSON();

