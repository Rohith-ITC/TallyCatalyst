const fs = require("fs");
const path = require("path");

async function importPincodeCSV() {
  const inputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/raw/pincode-csv/India_Pincode_Boundary_with_LatLong_and_Shape_2022.csv");
  const outputPath = path.join(__dirname, "src/TallyDashboard/salesdashboard/data/pincodeCoordinates.js");
  
  console.log("Importing pincode CSV to coordinates file...");
  console.log("Input:", inputPath);
  console.log("Output:", outputPath);
  
  try {
    // Read CSV file
    const csvContent = fs.readFileSync(inputPath, 'utf-8');
    const lines = csvContent.split('\n');
    
    // Parse header
    const header = lines[0].split(',');
    const pinCodeIndex = header.indexOf('pin_code');
    const latitudeIndex = header.indexOf('latitude');
    const longitudeIndex = header.indexOf('longitude');
    
    console.log("\n📋 CSV Header indices:");
    console.log(`  - pin_code: ${pinCodeIndex}`);
    console.log(`  - latitude: ${latitudeIndex}`);
    console.log(`  - longitude: ${longitudeIndex}`);
    
    if (pinCodeIndex === -1 || latitudeIndex === -1 || longitudeIndex === -1) {
      throw new Error("Required columns not found in CSV");
    }
    
    // Parse data
    const pincodeCoordinates = {};
    let processedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line (handling quoted values)
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue);
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue); // Add last value
      
      if (values.length <= Math.max(pinCodeIndex, latitudeIndex, longitudeIndex)) {
        skippedCount++;
        continue;
      }
      
      const pinCode = values[pinCodeIndex]?.trim();
      const latitude = parseFloat(values[latitudeIndex]?.trim());
      const longitude = parseFloat(values[longitudeIndex]?.trim());
      
      // Validate data - skip empty, zero, or invalid pincodes
      if (pinCode && pinCode !== '0' && pinCode !== '' && 
          !isNaN(latitude) && !isNaN(longitude) && 
          latitude >= -90 && latitude <= 90 && 
          longitude >= -180 && longitude <= 180) {
        // Store as [longitude, latitude] format (ECharts expects lng, lat)
        pincodeCoordinates[pinCode] = [longitude, latitude];
        processedCount++;
      } else {
        skippedCount++;
      }
    }
    
    // Generate JavaScript file content
    const fileContent = `/**
 * Indian PIN Code to Geographic Coordinates Mapping
 * 
 * This dataset contains latitude and longitude coordinates for Indian PIN codes.
 * Format: { 'pincode': [longitude, latitude] }
 * 
 * Coordinates are in decimal degrees (WGS84 format)
 * - Index 0: Longitude (East-West position)
 * - Index 1: Latitude (North-South position)
 * 
 * Usage: Used for plotting pincode-based data on geographic scatter maps
 * 
 * Source: India_Pincode_Boundary_with_LatLong_and_Shape_2022.csv
 * Total PIN codes: ${processedCount}
 */

export const PINCODE_COORDINATES = ${JSON.stringify(pincodeCoordinates, null, 2)};
`;
    
    // Write to file
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    
    console.log(`\n✅ Successfully imported!`);
    console.log(`  - Processed: ${processedCount} PIN codes`);
    console.log(`  - Skipped: ${skippedCount} invalid rows`);
    console.log(`  - File saved to: ${outputPath}`);
    
    // Show sample data
    const samplePincodes = Object.keys(pincodeCoordinates).slice(0, 5);
    console.log("\n📋 Sample PIN codes:");
    samplePincodes.forEach(pin => {
      console.log(`  - ${pin}: [${pincodeCoordinates[pin][0]}, ${pincodeCoordinates[pin][1]}]`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

importPincodeCSV();

