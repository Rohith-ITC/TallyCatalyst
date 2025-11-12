import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

const AgingChart = ({ data, selectedBucket, onBucketClick, currencyScale = 'auto', colors = {} }) => {
  const formatCompactCurrency = (value) => {
    if (!value || value === 0) return '₹0.00';
    const absValue = Math.abs(value);
    let formatted = '';
    let unit = '';
    
    // Use selected scale or auto-detect based on value
    if (currencyScale === 'crore' || (currencyScale === 'auto' && absValue >= 10000000)) {
      formatted = '₹' + (absValue / 10000000).toFixed(2);
      unit = ' Cr'; // Cr = Crore (Indian numbering)
    } else if (currencyScale === 'lakh' || (currencyScale === 'auto' && absValue >= 100000)) {
      formatted = '₹' + (absValue / 100000).toFixed(2);
      unit = ' L';
    } else if (currencyScale === 'thousand' || (currencyScale === 'auto' && absValue >= 1000)) {
      formatted = '₹' + (absValue / 1000).toFixed(2);
      unit = ' K';
    } else {
      // Full amount (no scaling)
      formatted = '₹' + absValue.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      unit = '';
    }
    
    return formatted + unit + ' Dr';
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{payload[0].payload.name}</p>
          <p className="tooltip-value">{formatCompactCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  // Use provided colors or fallback to default colors
  const defaultColors = {
    '0-30': '#68d391',
    '30-90': '#f6ad55',
    '90-180': '#ed8936',
    '180-360': '#dd6b20',
    '>360': '#f56565',
  };
  const bucketColors = Object.keys(defaultColors).reduce((acc, key) => {
    acc[key] = colors[key] || defaultColors[key];
    return acc;
  }, {});

  const handleBarClick = (entry) => {
    if (entry && entry.name) {
      const newSelection = selectedBucket === entry.name ? null : entry.name;
      if (onBucketClick) {
        onBucketClick(newSelection);
      }
    }
  };

  const CustomVerticalBar = (props) => {
    const { x, y, width, height, payload } = props;
    if (!payload || !payload.name) {
      return null;
    }
    const isSelected = selectedBucket === payload.name;
    const baseColor = bucketColors[payload.name] || '#60a5fa';
    const fillColor = isSelected ? '#2563eb' : baseColor;

    const handleClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleBarClick(payload);
    };

    return (
      <g onClick={handleClick} onMouseDown={handleClick} style={{ cursor: 'pointer' }}>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fillColor}
          stroke={isSelected ? '#1e40af' : 'none'}
          strokeWidth={isSelected ? 2 : 0}
          opacity={isSelected ? 1 : 0.9}
          rx={6}
          ry={6}
        />
      </g>
    );
  };

  return (
    <div className="compact-aging-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 0, left: 0, bottom: 10 }}
          barCategoryGap={12}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#4a5568', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#4a5568', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => {
              const absValue = Math.abs(value);
              // Use selected scale or auto-detect based on value
              if (currencyScale === 'crore' || (currencyScale === 'auto' && absValue >= 10000000)) {
                return `${(value / 10000000).toFixed(1)}Cr`;
              }
              if (currencyScale === 'lakh' || (currencyScale === 'auto' && absValue >= 100000)) {
                return `${(value / 100000).toFixed(1)}L`;
              }
              if (currencyScale === 'thousand' || (currencyScale === 'auto' && absValue >= 1000)) {
                return `${(value / 1000).toFixed(1)}K`;
              }
              if (currencyScale === 'full') {
                return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
              }
              return value.toFixed(0);
            }}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Bar dataKey="value" shape={(props) => <CustomVerticalBar {...props} />} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AgingChart;

