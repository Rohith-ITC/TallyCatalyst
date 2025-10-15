# Sales Dashboard

An interactive sales analytics dashboard built with React and Tailwind CSS, adapted from the bolt.new sales dashboard.

## Features

- **Interactive Charts**: Bar, Pie, Tree Map, and Line charts
- **Filtering**: Filter by date range, region, category, customer, and items
- **Real-time Metrics**: Total revenue, orders, quantity, unique customers, and average order value
- **Responsive Design**: Works on desktop and mobile devices
- **Hardcoded Data**: Currently uses sample data matching the provided dashboard images

## Components

### Main Component
- `SalesDashboard.js` - Main dashboard component with all functionality

### Chart Components
- `BarChart.js` - Horizontal bar charts with click interactions
- `PieChart.js` - Interactive pie charts with legends
- `TreeMap.js` - Tree map visualization for hierarchical data
- `LineChart.js` - Line charts with area fill and grid lines
- `MetricCard.js` - KPI cards with icons and color coding

## Usage

```javascript
import SalesDashboard from './TallyDashboard/salesdashboard';

// Use in your component
function App() {
  return (
    <div>
      <SalesDashboard />
    </div>
  );
}
```

## Data Structure

The dashboard expects sales data in the following format:

```javascript
const salesData = [
  {
    category: 'Brake Linings',
    region: 'TN',
    amount: 3710261.52,
    quantity: 6543,
    customer: 'TN\\CHN\\1240-Sparex Ltd',
    item: 'RBLL-TT/TP/SM/2 1MM GT11 HLS',
    date: '2025-06-15'
  },
  // ... more records
];
```

## Styling

The dashboard uses Tailwind CSS for styling. Make sure Tailwind is properly configured in your project:

1. Install Tailwind CSS dependencies
2. Configure `tailwind.config.js`
3. Include Tailwind directives in your CSS file

## Dependencies

- React 19+
- lucide-react (for icons)
- Tailwind CSS
- autoprefixer
- postcss

## Future Enhancements

- Connect to real API endpoints
- Add data export functionality
- Implement more chart types
- Add drill-down capabilities
- Add real-time data updates

## Notes

- Currently uses hardcoded data matching the provided dashboard screenshots
- All filtering and chart interactions are functional
- The dashboard is fully responsive and follows modern UI/UX principles
- Uses the project's brand colors (Tally Black #000000 and Catalyst Orange #F27020) where applicable
