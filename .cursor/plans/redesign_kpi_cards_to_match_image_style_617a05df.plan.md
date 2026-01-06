---
name: Redesign KPI Cards to Match Image Style
overview: Redesign the KPI cards in the sales dashboard to match the visual style shown in the image, featuring large prominent values with status indicators, target information, difference calculations, and subtle background area charts.
todos:
  - id: create-kpi-component
    content: Create new KPICard component with title, value, target, status indicator, and background area chart
    status: completed
  - id: update-sales-dashboard
    content: Replace existing KPI card JSX in SalesDashboard.js with new KPICard components
    status: completed
    dependencies:
      - create-kpi-component
  - id: add-trend-data
    content: Generate trend data for background area charts from period/historical data
    status: completed
    dependencies:
      - create-kpi-component
  - id: test-responsive
    content: Test responsive design on mobile and desktop views
    status: completed
    dependencies:
      - update-sales-dashboard
---

# Redesign KPI

Cards to Match Image Style

## Overview

Transform the current KPI card design in the sales dashboard to match the visual style from the reference image. The new design will feature:

- Large prominent values with color coding (green/orange based on status)
- Status indicators (checkmark for good, exclamation for warning)
- Target information display
- Difference from target calculation
- Subtle background area chart visualization
- Period label in title

## Current Implementation

The KPI cards are currently rendered in [`src/TallyDashboard/salesdashboard/SalesDashboard.js`](src/TallyDashboard/salesdashboard/SalesDashboard.js) starting at line 8010. They use a simple card layout with:

- Uppercase title
- Large value
- Icon on the right

## Implementation Plan

### 1. Create New KPICard Component

- Create [`src/TallyDashboard/salesdashboard/components/KPICard.js`](src/TallyDashboard/salesdashboard/components/KPICard.js)
- Component props:
- `title`: KPI name
- `value`: Current value (number)
- `target`: Optional target value
- `period`: Period label (e.g., "last period", "current period")
- `status`: Status type ('met', 'below', 'above') - determines color and icon
- `additionalData`: Optional additional number to display
- `trendData`: Array of values for background area chart
- `format`: Value formatter function (currency, number, percentage)

### 2. Design Features

- **Title Format**: "KPI: [Name] ([period])"
- **Large Value Display**: 
- Prominent number with color coding
- Green (#16a34a) for met/exceeded targets
- Orange (#ea580c) for below target
- Status icon (checkmark ✓ or exclamation ⚠) next to value
- **Target Information**:
- "Target: [value]" display
- Difference calculation: "(+/-X%)" or "(+/-X)" format
- **Background Chart**:
- Subtle area chart using SVG
- Light color matching the status color
- Positioned behind content
- **Additional Data**: Optional number display below target info

### 3. Update SalesDashboard.js

- Replace existing KPI card JSX (lines 8010-8250) with new KPICard components
- Map existing metrics to new component:
- Total Revenue → KPICard with currency format
- Total Invoices → KPICard with number format
- Unique Customers → KPICard with number format
- Avg Invoice Value → KPICard with currency format
- Total Profit → KPICard with currency format (if canShowProfit)
- Profit Margin → KPICard with percentage format (if canShowProfit)
- Avg Profit Per Order → KPICard with currency format (if canShowProfit)
- Generate trend data for background charts from historical/period data
- Calculate status based on targets (if provided) or use default 'met' status

### 4. Styling

- Card background: white with subtle border
- Responsive design for mobile/desktop
- Smooth transitions and hover effects
- Area chart opacity: ~0.15-0.2 for subtle background effect

## Files to Modify

1. [`src/TallyDashboard/salesdashboard/components/KPICard.js`](src/TallyDashboard/salesdashboard/components/KPICard.js) - New component
2. [`src/TallyDashboard/salesdashboard/SalesDashboard.js`](src/TallyDashboard/salesdashboard/SalesDashboard.js) - Update KPI rendering section (lines 8010-8250)

## Notes

- Targets are optional - cards will work without targets, showing just the visual style
- Status indicators will default to 'met' (green checkmark) if no target is provided