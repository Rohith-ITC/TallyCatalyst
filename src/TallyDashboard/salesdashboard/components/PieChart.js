import React from 'react';

const PieChart = ({ data, title, valuePrefix = '₹', onSliceClick, onBackClick, showBackButton, rowAction }) => {
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

  let currentAngle = -90; // Start from top
  const slices = data.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    return {
      ...item,
      color: item.color || colors[index % colors.length],
      percentage,
      startAngle,
      endAngle,
    };
  });

  const createArc = (startAngle, endAngle) => {
    const start = polarToCartesian(50, 50, 45, endAngle);
    const end = polarToCartesian(50, 50, 45, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M 50 50 L ${start.x} ${start.y} A 45 45 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
  };

  function polarToCartesian(centerX, centerY, radius, angle) {
    const radians = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians),
    };
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
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
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <svg viewBox="0 0 100 100" style={{ width: '256px', height: '256px', flexShrink: 0 }}>
          {slices.map((slice, index) => (
            <path
              key={index}
              d={createArc(slice.startAngle, slice.endAngle)}
              fill={slice.color}
              style={{
                cursor: onSliceClick ? 'pointer' : 'default',
                transition: 'opacity 0.2s ease'
              }}
              onClick={() => onSliceClick?.(slice.label)}
              onMouseEnter={(e) => {
                if (onSliceClick) {
                  e.target.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (onSliceClick) {
                  e.target.style.opacity = '1';
                }
              }}
            />
          ))}
        </svg>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '200px'
        }}>
          {slices.map((slice, index) => (
            <div
              key={index}
              onClick={() => onSliceClick?.(slice.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                borderRadius: '6px',
                cursor: onSliceClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (onSliceClick) {
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                if (onSliceClick) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: 1,
                minWidth: 0
              }}>
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '2px',
                    flexShrink: 0,
                    backgroundColor: slice.color
                  }}
                />
                <span style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#64748b',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {slice.label}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0
              }}>
                <span style={{
                  fontSize: '12px',
                  color: '#9ca3af'
                }}>
                  {slice.percentage.toFixed(1)}%
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  {valuePrefix}{slice.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {rowAction && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      rowAction.onClick?.(slice);
                    }}
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
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
