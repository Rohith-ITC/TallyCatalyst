# Geographic Map Drilldown Implementation

## Overview
This document describes the comprehensive drilldown functionality implemented for geographical maps across the Sales Dashboard. The implementation ensures that users can drill down from country → state → pincode levels in all contexts: default cards, custom cards, dashboard view, and fullscreen mode.

## Implementation Date
January 12, 2026

## Changes Made

### 1. Enhanced FilterHandler for Region/State GroupBy (Lines 25579-25604)

**Previous Behavior:**
- Clicking on a state would only set the region filter
- No pincode drilldown capability

**New Behavior:**
- **State Level**: Clicking on a state drills down to show pincodes for that state
- **Pincode Level**: Clicking on a pincode sets the pincode filter
- **Back Navigation**: 
  - If pincode is selected, back button clears pincode (stays at state level)
  - If only state is selected, back button returns to state overview

**Code Location:** `src/TallyDashboard/salesdashboard/SalesDashboard.js` (lines 25579-25604)

### 2. Enhanced FilterHandler for Country GroupBy (Lines 25605-25652)

**Previous Behavior:**
- Clicking on a country would only set the country filter
- No state or pincode drilldown capability

**New Behavior:**
- **Country Level**: Clicking on a country drills down to show states (India only)
- **State Level**: Clicking on a state drills down to show pincodes for that state
- **Pincode Level**: Clicking on a pincode sets the pincode filter
- **Back Navigation**: 
  - If pincode is selected, back button clears pincode (stays at state level)
  - If state is selected, back button clears state (returns to country level)
  - If only country is selected, back button returns to country overview

**Special Handling:**
- Only India supports state-level drilldown
- Other countries remain at country level (no state drilldown)

**Code Location:** `src/TallyDashboard/salesdashboard/SalesDashboard.js` (lines 25605-25652)

### 3. Custom Card GeoMap Rendering with Drilldown Logic (Lines 26427-26534)

**Previous Behavior:**
- Custom cards with geographic groupBy showed static maps
- No drilldown functionality
- mapType was determined only by the groupBy field

**New Behavior:**
- **Dynamic Map Type Detection**: Automatically determines the correct map type based on:
  - Current groupBy field (country, region/state, pincode)
  - Selected filters (selectedCountry, selectedRegion, selectedPincode)
  - Available data (countryStateChartData, regionPincodeChartData)

- **Country GroupBy Drilldown**:
  - Base level: Shows world map with countries
  - After clicking India: Shows India state map
  - After clicking a state: Shows pincode map for that state

- **Region/State GroupBy Drilldown**:
  - Base level: Shows India state map
  - After clicking a state: Shows pincode map for that state

- **Pincode GroupBy**:
  - Shows pincode map (no drilldown, already at lowest level)

- **Back Button Management**: Automatically shows/hides back button based on drilldown level

**Code Location:** `src/TallyDashboard/salesdashboard/SalesDashboard.js` (lines 26427-26534)

### 4. Added Pincode Props to CustomCard Component

**Changes:**
- Added `setSelectedPincode` prop to CustomCard component signature (line 25391)
- Added `selectedPincode` prop to CustomCard component signature (line 25406)
- Added both props to regular CustomCard instances (line 17413, 17428)
- Added both props to fullscreen CustomCard instances (line 21240, 21248)

**Purpose:**
- Enables custom cards to set and read pincode filter state
- Allows pincode-level filtering to work consistently across all card types

**Code Locations:**
- Component signature: Lines 25375-25413
- Regular card instance: Lines 17377-17434
- Fullscreen card instance: Lines 21215-21257

## Data Flow

### State Management
The implementation uses existing state variables:
- `selectedCountry`: Tracks selected country
- `selectedRegion`: Tracks selected state/region
- `selectedPincode`: Tracks selected pincode

### Data Sources
The implementation leverages existing computed data:
- `countryStateChartData`: State-level data for selected country (computed via useMemo)
- `regionPincodeChartData`: Pincode-level data for selected region (computed via useMemo)
- Custom card data: Generated dynamically based on card configuration

### Drilldown Logic Flow

```
Country GroupBy:
  1. Initial: Show world map (mapType='country')
  2. Click India → selectedCountry='India'
     → Show India states (mapType='state', data=countryStateChartData)
  3. Click Maharashtra → selectedRegion='Maharashtra'
     → Show Maharashtra pincodes (mapType='pincode', data=regionPincodeChartData)
  4. Click 400001 → selectedPincode='400001'
     → Dashboard filters by pincode

Region/State GroupBy:
  1. Initial: Show India states (mapType='state')
  2. Click Maharashtra → selectedRegion='Maharashtra'
     → Show Maharashtra pincodes (mapType='pincode', data=regionPincodeChartData)
  3. Click 400001 → selectedPincode='400001'
     → Dashboard filters by pincode

Pincode GroupBy:
  1. Show pincode map (mapType='pincode')
  2. Click pincode → Dashboard filters by pincode
```

## Testing Scenarios

### Default Cards
1. **Sales by State Card**:
   - ✅ Click on a state → drills down to pincodes
   - ✅ Click on a pincode → filters dashboard
   - ✅ Back button → returns to state view
   - ✅ Works in dashboard view
   - ✅ Works in fullscreen mode

2. **Sales by Country Card**:
   - ✅ Click on India → drills down to states
   - ✅ Click on a state → drills down to pincodes
   - ✅ Click on a pincode → filters dashboard
   - ✅ Back button navigation through all levels
   - ✅ Works in dashboard view
   - ✅ Works in fullscreen mode

### Custom Cards
1. **Country GroupBy**:
   - ✅ Shows world map initially
   - ✅ Drills down to states (India only)
   - ✅ Drills down to pincodes
   - ✅ Works in dashboard view
   - ✅ Works in fullscreen mode

2. **Region/State GroupBy**:
   - ✅ Shows state map initially
   - ✅ Drills down to pincodes
   - ✅ Works in dashboard view
   - ✅ Works in fullscreen mode

3. **Pincode GroupBy**:
   - ✅ Shows pincode map
   - ✅ Clicking sets pincode filter
   - ✅ Works in dashboard view
   - ✅ Works in fullscreen mode

## Benefits

1. **Consistent User Experience**: Drilldown works the same way across all card types and viewing modes
2. **Intuitive Navigation**: Users can explore data hierarchically from country → state → pincode
3. **No Breaking Changes**: Existing functionality remains intact
4. **Extensible**: Easy to add drilldown support for other countries in the future
5. **Performance**: Uses existing computed data (useMemo) for efficient rendering

## Future Enhancements

1. **Multi-Country Support**: Add state-level data for countries other than India
2. **Custom Drilldown Paths**: Allow users to configure custom drilldown hierarchies
3. **Breadcrumb Navigation**: Show current drilldown path in the card header
4. **Zoom to Region**: Automatically zoom to the selected region on the map
5. **Drilldown Animations**: Add smooth transitions between drilldown levels

## Technical Notes

- The implementation maintains backward compatibility with existing code
- No changes were made to the GeoMapChart component itself
- All drilldown logic is handled at the SalesDashboard level
- The solution leverages existing state management and data computation
- Console logging has been added for debugging drilldown behavior

## Files Modified

- `src/TallyDashboard/salesdashboard/SalesDashboard.js`
  - Updated filterHandler for region groupBy (lines 25579-25604)
  - Updated filterHandler for country groupBy (lines 25605-25652)
  - Enhanced custom card geoMap rendering (lines 26427-26534)
  - Added pincode props to CustomCard component (lines 25375-25413, 17377-17434, 21215-21257)

## Conclusion

The geographic map drilldown functionality is now fully implemented across all contexts in the Sales Dashboard. Users can seamlessly navigate from country-level data down to individual pincodes, with consistent behavior in default cards, custom cards, dashboard view, and fullscreen mode.

