import React, { useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip as RechartsTooltip,
} from 'recharts';

const colorPalette = [
  '#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#805ad5',
  '#dd6b20', '#319795', '#c53030', '#2c5282', '#276749',
  '#744210', '#553c9a', '#7c2d12', '#234e52', '#742a2a',
  '#1a365d', '#22543d', '#78350f', '#5b21b6', '#702459',
  '#97266d', '#702459', '#553c9a', '#4c1d95', '#3c366b',
  '#2d3748', '#1a202c', '#2c5282', '#2c7a7b', '#2f855a',
  '#38a169', '#48bb78', '#68d391', '#9ae6b4', '#c6f6d5',
  '#f6e05e', '#fbd38d', '#fc8181', '#f687b3', '#b794f4',
  '#9f7aea', '#7c3aed', '#6b46c1', '#553c9a', '#4c1d95',
  '#44337a', '#322659', '#2d1b69', '#1a202c', '#1e3a8a',
  '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
];

const formatCompactCurrency = (value) => {
  if (!value || value === 0) return '₹0.00';
  const absValue = Math.abs(value);
  let formatted = '';
  let unit = '';
  if (absValue >= 10000000) {
    formatted = '₹' + (absValue / 10000000).toFixed(2);
    unit = ' Crore';
  } else if (absValue >= 100000) {
    formatted = '₹' + (absValue / 100000).toFixed(2);
    unit = ' L';
  } else if (absValue >= 1000) {
    formatted = '₹' + (absValue / 1000).toFixed(2);
    unit = ' K';
  } else {
    formatted = '₹' + absValue.toFixed(2);
  }
  return formatted;
};

const SalespersonChart = ({ data, selectedSalesperson, onSalespersonClick }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => {
      const name = item.name || 'Unknown';
      const isDimmed = !!selectedSalesperson && selectedSalesperson !== name;
      return {
        name,
        value: item.value || 0,
        billCount: item.billCount || 0,
        fill: isDimmed
          ? 'rgba(148, 163, 184, 0.45)'
          : colorPalette[index % colorPalette.length],
      };
    });
  }, [data, selectedSalesperson]);

  const handleClick = useCallback(
    (node) => {
      const name = node?.name;
      if (!name) return;
      const nextSelection = selectedSalesperson === name ? null : name;
      onSalespersonClick?.(nextSelection);
    },
    [selectedSalesperson, onSalespersonClick]
  );

  if (!chartData || chartData.length === 0) {
    return null;
  }

  return (
    <div className="compact-salesperson-chart">
      <ResponsiveContainer width="100%" height={320}>
        <Treemap
          data={chartData}
          dataKey="value"
          stroke="#ffffff"
          animationDuration={400}
          isAnimationActive
          content={
            <CustomTreemapCell selectedSalesperson={selectedSalesperson} />
          }
          onClick={handleClick}
        >
          <RechartsTooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) {
                return null;
              }
              const node = payload[0].payload || {};
              return (
                <div className="treemap-tooltip">
                  <div className="treemap-tooltip__title">{node.name}</div>
                  <div className="treemap-tooltip__line">
                    Total Outstanding: {formatCompactCurrency(node.value)}
                  </div>
                  <div className="treemap-tooltip__line">
                    Bills Count: {node.billCount || 0}
                  </div>
                </div>
              );
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

const CustomTreemapCell = ({
  depth,
  x,
  y,
  width,
  height,
  name,
  fill,
  value,
  selectedSalesperson,
}) => {
  if (depth === 0) return null;

  const isSelected = !selectedSalesperson || selectedSalesperson === name;
  const textColor = isSelected ? '#0f172a' : '#475569';

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: '#ffffff',
          strokeWidth: 2,
          opacity: isSelected ? 0.95 : 0.7,
          transition: 'opacity 0.2s',
        }}
      />
      {width > 70 && height > 46 && (
        <>
          <text
            x={x + 10}
            y={y + 24}
            fill={textColor}
            fontSize={14}
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {name}
          </text>
          <text
            x={x + 10}
            y={y + 44}
            fill={textColor}
            fontSize={12}
            style={{ pointerEvents: 'none' }}
          >
            {formatCompactCurrency(value)}
          </text>
        </>
      )}
    </g>
  );
};

export default SalespersonChart;

