import React from 'react';

const LineChart = ({ data, title, valuePrefix = '₹', onPointClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  // Handle empty or invalid data
  if (!data || data.length === 0) {
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
            borderBottom: '1px solid #e2e8f0'
          }}>
            {customHeader}
          </div>
        ) : (
          <div style={{
            padding: '12px 16px',
            position: 'sticky',
            top: 0,
            background: 'white',
            zIndex: 10,
            borderBottom: '1px solid #e2e8f0'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
              {title}
            </h3>
          </div>
        )}
        <div style={{
          padding: '12px 16px',
          textAlign: 'center',
          color: '#64748b',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <p style={{ margin: 0 }}>No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value || 0));
  const minValue = Math.min(...data.map(d => d.value || 0));
  const range = maxValue - minValue || 1; // Avoid division by zero

  const width = 600;
  const height = 300;
  const padding = 40;
  const bottomPadding = 60; // Extra padding for rotated x-axis labels
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding - bottomPadding;

  const points = data.map((item, index) => {
    // Handle single data point or empty data
    const divisor = Math.max(data.length - 1, 1);
    const x = padding + (index / divisor) * chartWidth;
    const y = padding + chartHeight - ((item.value || 0) - minValue) / range * chartHeight;
    return { ...item, x, y };
  });
  
  const bottomY = height - bottomPadding;

  const pathD = points.length > 0 
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPathD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${bottomY} L ${padding} ${bottomY} Z`
    : '';

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
        position: 'relative',
        width: '100%',
        padding: '12px 16px',
        overflowY: 'auto',
        flex: 1
      }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minHeight: '300px' }}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const y = padding + (i / 4) * chartHeight;
            const value = maxValue - (i / 4) * range;
            return (
              <g key={i}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={padding - 10}
                  y={y + 4}
                  textAnchor="end"
                  style={{ fontSize: '10px', fill: '#6b7280' }}
                >
                  {valuePrefix}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
              </g>
            );
          })}

          {/* Area under line */}
          <path
            d={areaPathD}
            fill="url(#gradient)"
            opacity="0.2"
          />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke="#3b82f6"
                strokeWidth="3"
                style={{
                  cursor: onPointClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => onPointClick?.(point.label)}
                onMouseEnter={(e) => {
                  if (onPointClick) {
                    e.target.setAttribute('r', '6');
                  }
                }}
                onMouseLeave={(e) => {
                  if (onPointClick) {
                    e.target.setAttribute('r', '5');
                  }
                }}
              />
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            // Show labels at intervals to avoid crowding (show every nth label based on total count)
            const totalPoints = points.length;
            let labelInterval = 1;
            if (totalPoints > 10) labelInterval = Math.ceil(totalPoints / 8); // Show max 8 labels
            
            // Always show first and last labels, and labels at intervals
            const shouldShow = index === 0 || index === totalPoints - 1 || index % labelInterval === 0;
            if (!shouldShow) return null;
            
            // Truncate long labels
            const maxLabelLength = 12;
            const displayLabel = point.label.length > maxLabelLength 
              ? point.label.substring(0, maxLabelLength) + '...' 
              : point.label;
            
            return (
              <text
                key={index}
                x={point.x}
                y={bottomY + 25}
                textAnchor="middle"
                style={{ fontSize: '10px', fill: '#4b5563' }}
                transform={`rotate(-45 ${point.x} ${bottomY + 25})`}
              >
                {displayLabel}
              </text>
            );
          })}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        {rowAction && (
          <div style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {points.map((point, index) => (
              <div
                key={`${point.label}-${index}`}
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
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>{point.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {valuePrefix}{(point.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(point)}
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

export default LineChart;
