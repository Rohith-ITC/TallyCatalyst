import React, { useState } from 'react';

const BarChart = ({ data, title, valuePrefix = '₹', onBarClick, onBackClick, showBackButton, rowAction, customHeader, stacked = false, formatValue }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        position: 'relative',
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {customHeader ? (
          <div>
            {customHeader}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobile ? '8px' : '12px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: '700',
              color: '#1e293b',
              letterSpacing: '-0.025em',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title}
            </h3>
            {showBackButton && onBackClick && (
              <button
                onClick={onBackClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  color: '#475569',
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>arrow_back</span>
                {!isMobile && <span>Back</span>}
              </button>
            )}
          </div>
        )}
        <div style={{
          flex: '1 1 0',
          minHeight: isMobile ? '200px' : '300px',
          maxHeight: '100%',
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          padding: '0',
          overflow: 'hidden',
          position: 'relative'
        }} />
      </div>
    );
  }

  // Calculate max value based on whether it's stacked or not
  const maxValue = stacked 
    ? Math.max(...data.map(d => d.segments?.reduce((sum, seg) => sum + seg.value, 0) || d.value || 0))
    : Math.max(...data.map(d => d.value));

  // Color palette for stacked segments
  const segmentColors = [
    'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)', // Green
    'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)', // Blue
    'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', // Amber
    'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)', // Purple
    'linear-gradient(90deg, #ec4899 0%, #db2777 100%)', // Pink
    'linear-gradient(90deg, #06b6d4 0%, #0891b2 100%)', // Cyan
    'linear-gradient(90deg, #84cc16 0%, #65a30d 100%)', // Lime
    'linear-gradient(90deg, #f97316 0%, #ea580c 100%)', // Orange
    'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)', // Indigo
    'linear-gradient(90deg, #14b8a6 0%, #0d9488 100%)', // Teal
  ];


  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      maxHeight: '100%',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100%',
      position: 'relative',
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      {customHeader ? (
        <div style={{
          padding: isMobile ? '12px 16px' : '16px 20px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          zIndex: 10,
          marginBottom: '0'
        }}>
          {customHeader}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '16px 20px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          zIndex: 10,
          marginBottom: '0',
          gap: isMobile ? '8px' : '12px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '700',
            color: '#1e293b',
            letterSpacing: '-0.025em',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {title}
          </h3>
            {showBackButton && onBackClick && (
              <button
                onClick={onBackClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: 'none',
                  color: '#475569',
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>arrow_back</span>
                {!isMobile && <span>Back</span>}
              </button>
            )}
        </div>
      )}
      <div style={{
        padding: isMobile ? '16px' : '24px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: '1 1 0',
        minHeight: 0,
        background: 'white'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '6px' : '8px'
        }}>
          {data.map((item, itemIndex) => (
            <div
              key={item.label}
              onClick={() => onBarClick?.(item.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '12px' : '16px',
                cursor: onBarClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                padding: isMobile ? '2px 0' : '3px 0',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (onBarClick) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                if (onBarClick) {
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              {/* Label */}
              <div style={{
                minWidth: isMobile ? '120px' : '180px',
                maxWidth: isMobile ? '120px' : '180px',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '500',
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textAlign: 'left'
              }}>
                {item.label}
              </div>

              {/* Bar Container */}
              <div style={{
                flex: 1,
                position: 'relative',
                height: isMobile ? '20px' : '14px',
                display: 'flex',
                alignItems: 'center',
                overflow: 'visible'
              }}>
                {/* Background bar */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: isMobile ? '20px' : '14px',
                  background: '#f1f5f9',
                  borderRadius: '6px'
                }} />
                
                {/* Filled bar - stacked or single */}
                {stacked && item.segments && item.segments.length > 0 ? (
                  <div style={{
                    position: 'relative',
                    height: isMobile ? '20px' : '14px',
                    width: `${((item.segments.reduce((sum, seg) => sum + seg.value, 0)) / maxValue) * 100}%`,
                    display: 'flex',
                    borderRadius: '6px',
                    overflow: 'visible'
                  }}>
                    {item.segments.map((segment, segIndex) => {
                      const segmentTotal = item.segments.reduce((sum, seg) => sum + seg.value, 0);
                      const segmentWidth = segmentTotal > 0 ? (segment.value / segmentTotal) * 100 : 0;
                      const colorIndex = segIndex % segmentColors.length;
                      const isFirst = segIndex === 0;
                      const isLast = segIndex === item.segments.length - 1;
                      const isHovered = hoveredSegment?.itemIndex === itemIndex && hoveredSegment?.segIndex === segIndex;
                      
                      // Calculate segment center position
                      let segmentLeftPercent = 0;
                      for (let i = 0; i < segIndex; i++) {
                        segmentLeftPercent += (item.segments[i].value / segmentTotal) * 100;
                      }
                      const segmentCenterPercent = segmentLeftPercent + (segmentWidth / 2);
                      
                      return (
                        <React.Fragment key={segIndex}>
                          <div
                            style={{
                              width: `${segmentWidth}%`,
                              height: '100%',
                              background: segmentColors[colorIndex],
                              transition: 'all 0.5s ease-out',
                              boxShadow: segIndex === 0 ? '0 2px 4px rgba(0, 0, 0, 0.15)' : 'none',
                              borderTopLeftRadius: isFirst ? '6px' : '0',
                              borderBottomLeftRadius: isFirst ? '6px' : '0',
                              borderTopRightRadius: isLast ? '6px' : '0',
                              borderBottomRightRadius: isLast ? '6px' : '0',
                              borderRight: segIndex < item.segments.length - 1 ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
                              position: 'relative',
                              cursor: 'pointer',
                              zIndex: isHovered ? 10 : 1
                            }}
                            onMouseEnter={() => setHoveredSegment({ itemIndex, segIndex })}
                            onMouseLeave={() => setHoveredSegment(null)}
                          />
                          {/* Tooltip positioned relative to the bar container */}
                          {isHovered && (
                            <div style={{
                              position: 'absolute',
                              bottom: '100%',
                              left: `${segmentCenterPercent}%`,
                              transform: 'translateX(-50%)',
                              marginBottom: '8px',
                              padding: '6px 10px',
                              background: '#1e293b',
                              color: 'white',
                              borderRadius: '6px',
                              fontSize: isMobile ? '11px' : '12px',
                              fontWeight: '500',
                              whiteSpace: 'nowrap',
                              zIndex: 1000,
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                              pointerEvents: 'none'
                            }}>
                              <div style={{ marginBottom: '2px', fontWeight: '600' }}>
                                {segment.label || `Segment ${segIndex + 1}`}
                              </div>
                              <div style={{ fontSize: isMobile ? '10px' : '11px', opacity: 0.9 }}>
                                {`${valuePrefix}${(segment.value / 10000000).toFixed(2)}M`}
                              </div>
                              {/* Tooltip arrow */}
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 0,
                                height: 0,
                                borderLeft: '6px solid transparent',
                                borderRight: '6px solid transparent',
                                borderTop: '6px solid #1e293b'
                              }} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    position: 'relative',
                    height: isMobile ? '20px' : '14px',
                    width: `${(item.value / maxValue) * 100}%`,
                    background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
                    borderRadius: '6px',
                    transition: 'all 0.5s ease-out',
                    boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
                  }} />
                )}
              </div>

              {/* Value */}
              <div style={{
                minWidth: isMobile ? '70px' : '90px',
                fontSize: isMobile ? '12px' : '14px',
                fontWeight: '600',
                color: '#1e293b',
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px'
              }}>
                <span>
                  {stacked && item.segments && item.segments.length > 0
                    ? `${valuePrefix}${(item.segments.reduce((sum, seg) => sum + seg.value, 0) / 10000000).toFixed(2)}M`
                    : `${valuePrefix}${(item.value / 10000000).toFixed(2)}M`}
                </span>
                {rowAction && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      rowAction.onClick?.(item);
                    }}
                    title={rowAction.title || 'View raw data'}
                    style={{
                      border: 'none',
                      background: '#f1f5f9',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: isMobile ? '4px' : '6px',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: isMobile ? '24px' : '28px',
                      height: isMobile ? '24px' : '28px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.color = '#1e293b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>
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

export default BarChart;
