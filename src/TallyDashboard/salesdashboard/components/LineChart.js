import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveLine } from '@nivo/line';

const LineChart = ({ data, title, valuePrefix = '₹', onPointClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert data to Nivo format
  const nivoData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    return [{
      id: 'value',
      data: data.map((item, index) => ({
        x: item.label || `Point ${index}`,
        y: item.value || 0,
        originalData: item
      }))
    }];
  }, [data]);

  // Calculate dynamic left margin based on longest Y-axis value and rotated X-axis labels
  const leftMargin = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return isMobile ? 50 : 60;
    }
    // Find the maximum value to estimate the longest Y-axis label
    const maxValue = Math.max(...data.map(item => Math.abs(item.value || 0)));
    
    // Format the max value to estimate width
    let formattedMax;
    const absValue = Math.abs(maxValue);
    if (absValue >= 10000000) {
      formattedMax = `${valuePrefix}${(maxValue / 10000000).toFixed(1)}Cr`;
    } else if (absValue >= 100000) {
      formattedMax = `${valuePrefix}${(maxValue / 100000).toFixed(1)}L`;
    } else if (absValue >= 1000) {
      formattedMax = `${valuePrefix}${(maxValue / 1000).toFixed(1)}K`;
    } else {
      formattedMax = `${valuePrefix}${maxValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    
    // Estimate Y-axis label width: ~7-8px per character, plus padding
    const charWidth = isMobile ? 7 : 8;
    const yAxisWidth = formattedMax.length * charWidth + (isMobile ? 20 : 30);
    
    // Also account for rotated X-axis labels that extend to the left
    // Find the longest X-axis label
    const maxXLabelLength = Math.max(...data.map(item => (item.label || '').length));
    const xAxisCharWidth = isMobile ? 6 : 7;
    const fontSize = isMobile ? 10 : 12;
    const xAxisTextWidth = maxXLabelLength * xAxisCharWidth;
    
    // For -45 degree rotation, the horizontal projection to the left is approximately:
    // textWidth * sin(45°) = textWidth * 0.707
    const rotatedHorizontalSpace = (xAxisTextWidth * 0.707) + (fontSize * 0.707);
    
    // Use the maximum of Y-axis width and rotated X-axis space, plus extra padding
    const estimatedWidth = Math.max(yAxisWidth, rotatedHorizontalSpace) + (isMobile ? 15 : 25);
    
    // Set minimum and maximum bounds
    const minMargin = isMobile ? 50 : 60;
    const maxMargin = isMobile ? 180 : 250;
    return Math.min(Math.max(estimatedWidth, minMargin), maxMargin);
  }, [data, isMobile, valuePrefix]);

  // Calculate dynamic bottom margin based on longest X-axis label (rotated at -45 degrees)
  const bottomMargin = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return isMobile ? 70 : 80;
    }
    // Find the longest label (X-axis category name)
    const maxLabelLength = Math.max(...data.map(item => (item.label || '').length));
    
    // For rotated labels at -45 degrees, we need to account for:
    // 1. Text width when rotated (diagonal projection)
    // 2. Text height
    // 3. Padding for spacing
    
    // Character width for rotated text
    const charWidth = isMobile ? 6 : 7;
    const fontSize = isMobile ? 10 : 12;
    
    // Estimate text width
    const textWidth = maxLabelLength * charWidth;
    
    // For -45 degree rotation, the vertical space needed is approximately:
    // The diagonal projection = sqrt(width² + height²) * sin(45°)
    // Simplified: we need space for both width and height components
    // A practical approximation: textWidth * 0.707 (sin/cos of 45°) + fontSize * 0.707
    const rotatedVerticalSpace = (textWidth * 0.707) + (fontSize * 0.707);
    
    // Add padding for spacing between labels and chart edge
    const padding = isMobile ? 25 : 35;
    const estimatedHeight = rotatedVerticalSpace + padding;
    
    // Set minimum and maximum bounds
    const minMargin = isMobile ? 70 : 80;
    const maxMargin = isMobile ? 120 : 150;
    return Math.min(Math.max(estimatedHeight, minMargin), maxMargin);
  }, [data, isMobile]);

  // Handle empty or invalid data - return empty card structure
  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: isMobile ? '12px' : '16px',
        padding: '0',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%'
      }}>
        {customHeader ? (
          <div style={{ 
            padding: isMobile ? '12px 16px' : '16px 20px',
            position: 'sticky',
            top: 0,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            zIndex: 10,
            borderBottom: '2px solid #e2e8f0',
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
            borderBottom: '2px solid #e2e8f0',
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
                  padding: isMobile ? '6px 10px' : '8px 14px',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  fontSize: isMobile ? '11px' : '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>arrow_back</span>
                {!isMobile && <span>Back</span>}
              </button>
            )}
          </div>
        )}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
          padding: '0',
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)'
        }}>
          <div style={{ 
            height: isMobile ? '280px' : 'min(400px, calc(100% - 40px))', 
            minHeight: isMobile ? '280px' : '320px',
            maxHeight: isMobile ? '350px' : '500px',
            width: '100%',
            maxWidth: '100%',
            borderRadius: isMobile ? '8px' : '12px',
            background: 'white',
            padding: '0',
            boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            flexShrink: 0
          }} />
        </div>
      </div>
    );
  }

  // Handle click events
  const handleClick = (point) => {
    console.log('📈 LineChart click:', { point, pointData: point.data, label: point.data.originalData?.label });
    if (onPointClick && point.data.originalData) {
      onPointClick(point.data.originalData.label);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: isMobile ? '12px' : '16px',
      padding: '0',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100%'
    }}>
      {customHeader ? (
        <div style={{ 
          padding: isMobile ? '12px 16px' : '16px 20px',
          position: 'sticky',
          top: 0,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          zIndex: 10,
          borderBottom: '2px solid #e2e8f0',
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
          borderBottom: '2px solid #e2e8f0',
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
                padding: isMobile ? '6px 10px' : '8px 14px',
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#475569',
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
              }}
            >
              <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>arrow_back</span>
              {!isMobile && <span>Back</span>}
            </button>
          )}
        </div>
      )}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        padding: '0',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
        minHeight: 0,
        background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)'
      }}>
        <div style={{ 
          height: isMobile ? '280px' : 'min(400px, calc(100% - 40px))', 
          minHeight: isMobile ? '280px' : '320px',
          maxHeight: isMobile ? '350px' : '500px',
          width: '100%',
          maxWidth: '100%',
          borderRadius: isMobile ? '8px' : '12px',
          background: 'white',
          padding: '0',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <ResponsiveLine
            data={nivoData}
            margin={isMobile ? { top: 15, right: 10, bottom: bottomMargin, left: leftMargin } : { top: 20, right: 25, bottom: bottomMargin, left: leftMargin }}
            xScale={{ type: 'point' }}
            yScale={{
              type: 'linear',
              min: 'auto',
              max: 'auto',
              stacked: false,
              reverse: false
            }}
            curve="monotoneX"
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: isMobile ? 5 : 8,
              tickPadding: isMobile ? 8 : 12,
              tickRotation: -45,
              legend: '',
              legendOffset: isMobile ? 45 : 55,
              legendPosition: 'middle',
              format: (value) => {
                // For rotated labels, allow more characters but still truncate if too long
                const maxLength = isMobile ? 15 : 20;
                if (value.length > maxLength) {
                  return value.substring(0, maxLength - 3) + '...';
                }
                return value;
              }
            }}
            axisLeft={{
              tickSize: isMobile ? 5 : 8,
              tickPadding: isMobile ? 4 : 10,
              tickRotation: 0,
              legend: '',
              legendOffset: isMobile ? -30 : -50,
              legendPosition: 'middle',
              format: (value) => {
                // Use abbreviated format for Y-axis labels to prevent overlap
                const absValue = Math.abs(value);
                let formatted;
                
                // Use abbreviated format for large numbers
                if (absValue >= 10000000) {
                  formatted = `${valuePrefix}${(value / 10000000).toFixed(1)}Cr`;
                } else if (absValue >= 100000) {
                  formatted = `${valuePrefix}${(value / 100000).toFixed(1)}L`;
                } else if (absValue >= 1000) {
                  formatted = `${valuePrefix}${(value / 1000).toFixed(1)}K`;
                } else {
                  formatted = `${valuePrefix}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                }
                
                return formatted;
              }
            }}
            pointSize={isMobile ? 8 : 10}
            pointColor="#ffffff"
            pointBorderWidth={isMobile ? 2.5 : 3}
            pointBorderColor="#3b82f6"
            pointLabelYOffset={-12}
            enableArea={true}
            areaOpacity={0.25}
            areaBaselineValue={Math.min(...data.map(d => d.value || 0))}
            useMesh={true}
            colors={['#3b82f6']}
            lineWidth={isMobile ? 3 : 4}
            enableGridX={false}
            enableGridY={true}
            gridYValues={isMobile ? 4 : 5}
            animate={true}
            motionConfig={{
              stiffness: 90,
              damping: 15,
              mass: 1
            }}
            onClick={handleClick}
            tooltip={({ point }) => {
              return (
                <div style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  padding: isMobile ? '8px 12px' : '12px 16px',
                  borderRadius: isMobile ? '8px' : '12px',
                  border: '2px solid #e2e8f0',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  fontSize: isMobile ? '11px' : '13px',
                  minWidth: isMobile ? '140px' : '180px',
                  maxWidth: isMobile ? '200px' : 'none'
                }}>
                  <div style={{ 
                    fontWeight: '700', 
                    marginBottom: isMobile ? '4px' : '8px', 
                    color: '#1e293b',
                    fontSize: isMobile ? '12px' : '14px',
                    letterSpacing: '-0.025em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {point.data.x}
                  </div>
                  <div style={{ 
                    color: '#475569',
                    fontSize: isMobile ? '13px' : '15px',
                    fontWeight: '600'
                  }}>
                    {valuePrefix}{point.data.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            }}
            theme={{
              tooltip: {
                container: {
                  background: 'transparent',
                  padding: 0
                }
              },
              axis: {
                ticks: {
                  text: {
                    fontSize: isMobile ? 10 : 12,
                    fill: '#64748b',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontWeight: 600
                  },
                  line: {
                    stroke: '#cbd5e1',
                    strokeWidth: 1
                  }
                },
                grid: {
                  line: {
                    stroke: '#e2e8f0',
                    strokeWidth: 1,
                    strokeDasharray: '4 4'
                  }
                }
              }
            }}
          />
        </div>
        {rowAction && (
          <div style={{
            marginTop: isMobile ? '12px' : '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '8px' : '10px',
            width: '100%',
            maxWidth: '100%'
          }}>
            {data.map((point, index) => (
              <div
                key={`${point.label}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  borderRadius: isMobile ? '8px' : '10px',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  gap: isMobile ? '8px' : '12px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                  if (!isMobile) {
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: isMobile ? '8px' : '10px',
                    height: isMobile ? '8px' : '10px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                    flexShrink: 0
                  }} />
                  <span style={{ 
                    fontSize: isMobile ? '11px' : '13px', 
                    fontWeight: '600', 
                    color: '#475569',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {point.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
                  <span style={{ 
                    fontSize: isMobile ? '11px' : '13px', 
                    fontWeight: '700', 
                    color: '#1e293b'
                  }}>
                    {valuePrefix}{(point.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(point)}
                    title={rowAction.title || 'View raw data'}
                    style={{
                      border: 'none',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      cursor: 'pointer',
                      color: '#1e40af',
                      padding: isMobile ? '4px' : '6px',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                      if (!isMobile) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px' }}>
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

