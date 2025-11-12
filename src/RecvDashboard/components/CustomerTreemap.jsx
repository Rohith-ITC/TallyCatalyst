import React, { useMemo, useCallback } from 'react';
import { ResponsiveTreeMap } from '@nivo/treemap';

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

const CustomNode = ({ node, style = {}, handlers = {}, selectedName, onNodeClick }) => {
  const { x, y, width, height, data } = node;
  const isSelected = selectedName ? data.name === selectedName : false;
  const baseOpacity = style.opacity ?? 0.9;
  const opacity = selectedName ? (isSelected ? 1 : 0.35) : baseOpacity;
  const fill = data.color || style.color || '#2563eb';
  const borderColor = isSelected
    ? '#1d4ed8'
    : style.borderColor || '#ffffff';
  const borderWidth = isSelected ? 3 : style.borderWidth ?? 2;
  const showLabel = width > 70 && height > 40;
  const labelFontSize = Math.max(10, Math.min(13, Math.floor(width / 10)));
  const valueFontSize = Math.max(9, Math.min(12, Math.floor(width / 12)));

  let displayName = data.name;
  if (displayName.length > 26) {
    displayName = `${displayName.substring(0, 23)}…`;
  }

  const handleClick = (event) => {
    handlers.onClick?.(event);
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <g transform={`translate(${x}, ${y})`} {...handlers} style={{ cursor: 'pointer' }} onClick={handleClick}>
      <rect
        width={width}
        height={height}
        fill={fill}
        opacity={opacity}
        stroke={borderColor}
        strokeWidth={borderWidth}
        rx={4}
        ry={4}
      />
      {showLabel && (
        <>
          <text
            x={width / 2}
            y={height / 2 - 6}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={labelFontSize}
            fontWeight={600}
            fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
            style={{
              pointerEvents: 'none',
              textShadow: '1px 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            {displayName}
          </text>
          <text
            x={width / 2}
            y={height / 2 + 12}
            textAnchor="middle"
            fill="#f1f5f9"
            fontSize={valueFontSize}
            fontWeight={400}
            fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
            style={{
              pointerEvents: 'none',
              textShadow: '1px 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            {formatCompactCurrency(data.value)}
          </text>
        </>
      )}
    </g>
  );
};

const CustomerTreemap = ({ data, selectedCustomer, onCustomerClick }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    return {
      name: 'root',
      children: data.map((item, index) => ({
        name: item.name || 'Unknown',
        value: item.value || 0,
        billCount: item.billCount || 0,
        color: colorPalette[index % colorPalette.length],
      })),
    };
  }, [data]);

  const handleClick = useCallback(
    (node) => {
      const name = node.data?.name;
      if (!name) return;
      const nextSelection = selectedCustomer === name ? null : name;
      onCustomerClick?.(nextSelection);
    },
    [selectedCustomer, onCustomerClick]
  );

  const nodeRenderer = useCallback(
    (props) => (
      <CustomNode {...props} selectedName={selectedCustomer} onNodeClick={handleClick} />
    ),
    [selectedCustomer, handleClick]
  );

  if (!chartData) return null;

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveTreeMap
        data={chartData}
        identity="name"
        value="value"
        leavesOnly
        outerPadding={4}
        innerPadding={5}
        inheritColorFromParent={false}
        colors={(node) => node.data.color}
        nodeComponent={nodeRenderer}
        orientLabel={false}
        borderWidth={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.25]] }}
        onClick={handleClick}
        tooltip={({ node }) => (
          <div
            style={{
              background: 'rgba(17, 24, 39, 0.95)',
              padding: '0.7rem 0.95rem',
              color: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 32px -20px rgba(15, 23, 42, 0.9)',
              minWidth: '220px',
              fontFamily:
                "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
              {node.data.name}
            </div>
            <div style={{ opacity: 0.95 }}>Total Outstanding: {formatCompactCurrency(node.data.value)}</div>
            <div style={{ opacity: 0.85 }}>Bills Count: {node.data.billCount || 0}</div>
          </div>
        )}
        theme={{
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          labels: {
            text: {
              fontWeight: 500,
            },
          },
        }}
      />
    </div>
  );
};

export default CustomerTreemap;

