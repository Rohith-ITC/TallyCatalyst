# Geographic Map Charts - User Guide

## What are Geographic Map Charts?

Geographic Map Charts allow you to visualize your sales data on interactive maps. When you group data by location (PIN code, state, or country), the system automatically offers map visualization options.

## When to Use Map Charts

Use map charts when you want to:
- See regional sales patterns at a glance
- Identify high-performing or underperforming regions
- Visualize geographic distribution of customers
- Analyze sales trends across states or countries
- Compare values across different locations

## How to Create a Map Chart

### Step 1: Open Custom Card Modal
Click the "+ Create Custom Card" button on your Sales Dashboard.

### Step 2: Select a Geographic Field
In the "Choose fields to add to report" section, select a geographic field for grouping:
- **PIN Code** (for city-level details)
- **State/Region** (for state-level overview)
- **Country** (for international sales)

### Step 3: Chart Type Dropdown
Once you select a geographic field, the **"Geographic Map" option will automatically appear** in the "Default Chart Type" dropdown.

### Step 4: Choose Map Style
After selecting "Geographic Map", you'll see a "Map Visualization Style" selector:

**For PIN Code:**
- **Scatter Map (Bubbles)**: Shows each PIN code as a bubble on the map. Bubble size represents the value.
- **Choropleth Map (Colored Regions)**: Aggregates PIN codes by state and colors the states.

**For State/Country:**
- **Choropleth Map (Colored Regions)**: Colors each state/country by value intensity (darker = higher value).

### Step 5: Configure Other Options
- **Card Title**: Give your map a meaningful name
- **Value Field**: Select what to measure (Amount, Quantity, etc.)
- **Aggregation**: Choose how to aggregate (Sum, Average, Count, etc.)
- **Filters**: Add filters to focus on specific data
- **Top N**: Limit to top N regions

### Step 6: Create the Card
Click "Create Card" and watch your data come to life on the map!

## Interacting with Map Charts

### Viewing Data
- **Hover over regions**: See tooltips with region name and value
- **Color legend**: Shows value range (High to Low)
- **Zoom/Pan**: Click and drag to pan, use mouse wheel to zoom

### Filtering the Dashboard
**Click on any region** to filter the entire dashboard to that region:
- All other cards update to show only that region's data
- A "Back" button appears to clear the filter
- The region remains highlighted while filtered

### Changing Visualization
Use the **dropdown in the card header** to switch between:
- Bar Chart
- Pie Chart
- Tree Map
- Line Chart
- Multi Axis
- **Geographic Map** ← Your current view

### Editing the Card
Click the **Edit button (pencil icon)** to:
- Change the map style (scatter ↔ choropleth)
- Update filters or Top N limit
- Modify the card title
- Change aggregation method

## Map Types Explained

### 1. PIN Code Scatter Map
**Best for:** Detailed city-level analysis in India

**Example Use Cases:**
- "Where are my top customers located?"
- "Which cities generate the most revenue?"
- "Show sales distribution across PIN codes"

**Visual:** Bubbles on India map, each representing a PIN code

### 2. State Choropleth Map
**Best for:** State-level comparison in India

**Example Use Cases:**
- "Which states have the highest sales?"
- "Compare performance across regions"
- "Identify underperforming states"

**Visual:** Indian states colored by value intensity

### 3. Country Choropleth Map
**Best for:** International sales analysis

**Example Use Cases:**
- "Which countries are our biggest markets?"
- "Show global sales distribution"
- "Compare revenue across countries"

**Visual:** World map with countries colored by value

## Tips for Best Results

### 1. Data Quality
- Ensure your data has standardized location names
- Common formats work: "Maharashtra", "Delhi", "India", "USA"
- System handles variations: "Orissa" → "Odisha", "US" → "United States"

### 2. Choosing Map Style
- **Use Scatter Map** when you have many distinct PIN codes and want to see exact locations
- **Use Choropleth Map** when you want regional overview and comparison

### 3. Using Filters
- Combine geographic grouping with date filters for time-series analysis
- Add product/customer filters to see location patterns for specific segments
- Use "Top N" to focus on key regions

### 4. Performance
- For large datasets (10K+ records), consider using filters or Top N
- Choropleth maps perform better than scatter maps with many points
- Mobile users: Use pinch-to-zoom for better navigation

## Examples

### Example 1: Top 10 States by Revenue
1. **Group By**: State
2. **Value Field**: Amount
3. **Aggregation**: Sum
4. **Chart Type**: Geographic Map
5. **Map Style**: Choropleth Map
6. **Top N**: 10

**Result**: See the top 10 revenue-generating states highlighted on India map

### Example 2: Customer Distribution by PIN Code
1. **Group By**: PIN Code
2. **Value Field**: Number of Unique Customers
3. **Aggregation**: Count
4. **Chart Type**: Geographic Map
5. **Map Style**: Scatter Map (Bubbles)

**Result**: Bubble map showing customer concentration across cities

### Example 3: International Sales by Country
1. **Group By**: Country
2. **Value Field**: Amount
3. **Aggregation**: Sum
4. **Chart Type**: Geographic Map
5. **Map Style**: Choropleth Map

**Result**: World map colored by sales volume per country

## Troubleshooting

### Map Option Not Appearing?
**Check if:** Your grouping field contains 'pincode', 'region', 'state', or 'country' in its name.

**Solution:** Ensure you've selected a geographic field from the dropdown.

### Regions Not Showing Color?
**Reason:** Region names in your data don't match GeoJSON names.

**Solution:** 
- Check for typos in region names
- Use standard names: "Tamil Nadu" not "TN"
- Contact support if specific regions are missing

### Map is Empty/Blank?
**Check:**
1. Do you have data for the selected filters?
2. Are region names valid?
3. Check browser console for errors

**Solution:** Try removing filters or selecting "All" in date range.

### Scatter Map Shows Few Points?
**Reason:** Not all PIN codes have coordinate data.

**Solution:** Switch to Choropleth Map for state-level view.

## Supported Regions

### India Coverage:
- ✅ All 28 states
- ✅ All 8 union territories
- ✅ 19,000+ PIN codes

### International Coverage:
- ✅ 51 major countries including:
  - SAARC nations (Pakistan, Bangladesh, Sri Lanka, Nepal, etc.)
  - Major Asian markets (China, Japan, Singapore, UAE, Saudi Arabia)
  - European countries (UK, Germany, France, Italy, etc.)
  - Americas (USA, Canada, Brazil, Mexico)
  - Other major markets (Australia, South Africa, etc.)

## FAQ

**Q: Can I export the map?**
A: Currently, use your browser's print/PDF feature. Native export coming soon.

**Q: Can I see district-level data?**
A: Not yet. Currently supports PIN code, state, and country levels.

**Q: Does it work on mobile?**
A: Yes! Maps are fully responsive with touch gestures for zoom/pan.

**Q: Can I customize colors?**
A: The system uses optimized color schemes. Custom colors coming in future updates.

**Q: How do I add my own regions?**
A: Contact support to add custom GeoJSON files for specific regions.

**Q: What if my country isn't in the list?**
A: Use the "All" option or contact support to add your country.

## Need Help?

If you encounter any issues:
1. Check this guide for common solutions
2. Open browser console (F12) and look for error messages
3. Contact your system administrator
4. Reach out to TallyCatalyst support

---

**Happy Mapping! 🗺️**

