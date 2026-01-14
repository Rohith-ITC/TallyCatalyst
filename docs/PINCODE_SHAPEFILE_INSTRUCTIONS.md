# Pincode Shapefile Conversion Instructions

## Overview
This guide explains how to convert the India Pincode shapefile to GeoJSON for use in the dashboard.

## Prerequisites
- The shapefile is located at: `C:\Users\ADMIN\Downloads\INDIA_PINCODES-master\INDIA_PINCODES-master\`
- The shapefile is split into multiple archive parts (.z01, .z02, .z03, .z04, .z05)

## Step 1: Extract the Shapefile

The shapefile is split into multiple parts. You need to extract it using one of these methods:

### Option A: Using 7-Zip (Recommended)
1. Download and install [7-Zip](https://www.7-zip.org/) if you don't have it
2. Right-click on `india_pincodes.shp.zip`
3. Select "7-Zip" → "Extract Here" or "Extract to india_pincodes/"
4. 7-Zip will automatically combine all the split parts (.z01, .z02, etc.)

### Option B: Using WinRAR
1. Right-click on `india_pincodes.shp.zip`
2. Select "Extract Here" or "Extract files..."
3. WinRAR will automatically combine all the split parts

### Option C: Using Command Line (7-Zip)
```powershell
# Navigate to the directory
cd "C:\Users\ADMIN\Downloads\INDIA_PINCODES-master\INDIA_PINCODES-master\"

# Extract using 7-Zip (if installed)
"C:\Program Files\7-Zip\7z.exe" x india_pincodes.shp.zip
```

## Step 2: Verify Extraction

After extraction, verify that `india_pincodes.shp` has content (should not be 0 bytes):

```powershell
Get-ChildItem "C:\Users\ADMIN\Downloads\INDIA_PINCODES-master\INDIA_PINCODES-master\india_pincodes.shp" | Select-Object Name, Length
```

The file should have a size greater than 0 bytes.

## Step 3: Run the Conversion Script

Once the shapefile is extracted, run the conversion script:

```bash
node convert-pincode-shapefile.js
```

This will:
- Read the shapefile from the specified location
- Convert it to GeoJSON format
- Save it to `src/TallyDashboard/salesdashboard/data/indiaPincodes.json`
- Display statistics about the conversion

## Step 4: Verify the Output

After conversion, check that the file was created:

```powershell
Test-Path "src/TallyDashboard/salesdashboard/data/indiaPincodes.json"
```

## Usage in Dashboard

Once converted, the pincode shapefile will be used for:
- **Pincode Choropleth Maps**: Shows pincode boundaries colored by value intensity
- **Pincode Scatter Maps**: Still available using coordinate points (existing functionality)

When creating a custom card with a pincode field:
1. Select "Geographic Map" as the chart type
2. Choose "Choropleth Map" for shapefile-based visualization (shows boundaries)
3. Choose "Scatter Map" for point-based visualization (shows dots/bubbles)

## Troubleshooting

### Error: "Shapefile is empty (0 bytes)"
- The shapefile hasn't been extracted from the split archive
- Follow Step 1 to extract it properly

### Error: "Cannot read properties of null"
- The shapefile files (.shp, .dbf, .shx) are missing or corrupted
- Ensure all three files are present and extracted correctly

### No pincodes showing on map
- Check the browser console for matching information
- Verify that pincode names in your data match the format in the shapefile
- Pincode names are normalized (spaces removed) for matching

## File Structure

The shapefile consists of three required files:
- `india_pincodes.shp` - Shape geometry
- `india_pincodes.dbf` - Attribute data (contains pincode numbers)
- `india_pincodes.shx` - Index file

All three files must be in the same directory for the conversion to work.
