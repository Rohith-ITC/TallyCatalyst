import React from 'react';

const TreeMap = ({ data, title, valuePrefix = '₹', onBoxClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Generate colors if not provided
  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#8b5a2b', // Brown
    '#6b7280', // Gray
    '#dc2626', // Red-600
    '#059669', // Green-600
    '#d97706', // Orange-600
    '#7c3aed', // Purple-600
    '#0891b2', // Sky-600
    '#ca8a04'  // Yellow-600
  ];

  const boxes = data.map((item, index) => ({
    ...item,
    color: item.color || colors[index % colors.length],
    percentage: (item.value / total) * 100,
  }));

  // Simple treemap layout algorithm
  const layoutBoxes = (boxes, width, height) => {
    const result = [];
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    let rowWidth = 0;

    boxes.forEach((box) => {
      const area = (box.percentage / 100) * width * height;
      let boxWidth = Math.sqrt(area * (width / height));
      let boxHeight = area / boxWidth;

      if (currentX + boxWidth > width) {
        currentX = 0;
        currentY += rowHeight;
        rowHeight = 0;
        rowWidth = 0;
      }

      result.push({
        ...box,
        x: currentX,
        y: currentY,
        width: boxWidth,
        height: boxHeight,
      });

      currentX += boxWidth;
      rowWidth += boxWidth;
      rowHeight = Math.max(rowHeight, boxHeight);
    });

    return result;
  };

  const containerWidth = 600;
  const containerHeight = 400;
  const layoutedBoxes = layoutBoxes(boxes, containerWidth, containerHeight);

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '0',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      {customHeader ? (
        <div style={{ 
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10,
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '0'
        }}>
          {customHeader}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 10,
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '0'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            {title}
          </h3>
          {showBackButton && onBackClick && (
            <button
              onClick={onBackClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                color: '#64748b',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f1f5f9';
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>arrow_back</span>
              Back
            </button>
          )}
        </div>
      )}
      <div style={{
        padding: '12px 16px',
        overflowY: 'auto',
        flex: 1
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: `${(containerHeight / containerWidth) * 100}%`,
          minHeight: '250px',
          marginTop: '0'
        }}>
          <svg
            viewBox={`0 0 ${containerWidth} ${containerHeight}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          >
            {layoutedBoxes.map((box, index) => (
              <g
                key={index}
                onClick={() => onBoxClick?.(box.label)}
                style={{ cursor: onBoxClick ? 'pointer' : 'default' }}
              >
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  fill={box.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (onBoxClick) {
                      e.target.style.opacity = '0.8';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onBoxClick) {
                      e.target.style.opacity = '1';
                    }
                  }}
                />
                {box.width > 60 && box.height > 40 && (
                  <>
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2 - 10}
                      textAnchor="middle"
                      className="fill-white text-xs font-semibold"
                      style={{ fontSize: '12px' }}
                    >
                      {box.label.length > 15 ? box.label.substring(0, 15) + '...' : box.label}
                    </text>
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2 + 8}
                      textAnchor="middle"
                      className="fill-white text-xs font-bold"
                      style={{ fontSize: '14px' }}
                    >
                      {valuePrefix}{box.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </text>
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height / 2 + 24}
                      textAnchor="middle"
                      className="fill-white text-xs"
                      style={{ fontSize: '11px', opacity: 0.9 }}
                    >
                      {box.percentage.toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>
        {rowAction && (
          <div style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {boxes.map((box, index) => (
              <div
                key={`${box.label}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: box.color }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>{box.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{box.percentage.toFixed(1)}%</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {valuePrefix}{box.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(box)}
                    title={rowAction.title || 'View raw data'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#1e40af',
                      padding: '2px',
                      borderRadius: '50%'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e0e7ff';
                      e.currentTarget.style.color = '#1e3a8a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#1e40af';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>
                      {rowAction.icon || 'table_view'}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeMap;
