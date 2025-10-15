import React from 'react';

const LineChart = ({ data, title, valuePrefix = '₹', onPointClick, onBackClick, showBackButton }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue;

  const width = 600;
  const height = 300;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((item.value - minValue) / range) * chartHeight;
    return { ...item, x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaPathD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

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
        position: 'relative',
        width: '100%'
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
          {points.map((point, index) => (
            <text
              key={index}
              x={point.x}
              y={height - padding + 20}
              textAnchor="middle"
              style={{ fontSize: '10px', fill: '#4b5563' }}
            >
              {point.label}
            </text>
          ))}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

export default LineChart;
