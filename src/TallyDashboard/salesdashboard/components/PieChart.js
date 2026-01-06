import React, { useMemo, useState, useEffect } from 'react';
import { ResponsivePie } from '@nivo/pie';

const PieChart = ({ data, title, valuePrefix = '₹', onSliceClick, onBackClick, showBackButton, rowAction, customHeader, formatValue }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Professional color palette
  const colors = useMemo(() => [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#f43f5e', '#8b5a2b', '#6b7280', '#dc2626',
    '#059669', '#d97706', '#7c3aed', '#0891b2', '#ca8a04'
  ], []);

  // Calculate total
  const total = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [data]);

  // Convert data to Nivo format
  const nivoData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return [];
    }
    return data.map((item, index) => ({
      id: item.label || `Item ${index}`,
      value: item.value || 0,
      color: item.color || colors[index % colors.length],
      originalData: item
    }));
  }, [data, colors]);

  // Handle empty data - return empty card structure
  if (!data || !Array.isArray(data) || data.length === 0 || total === 0) {
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
          flex: 1,
          minHeight: isMobile ? '250px' : '300px',
          background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
          width: '100%',
          maxWidth: '100%'
        }} />
      </div>
    );
  }

  // Handle click events
  const handleClick = (slice) => {
    console.log('🥧 PieChart click:', { slice, sliceId: slice.id, sliceData: slice.data });
    if (onSliceClick) {
      onSliceClick(slice.id);
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
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'center' : 'flex-start',
        gap: isMobile ? '16px' : '20px',
        flexWrap: 'nowrap',
        padding: '0',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: 1,
        background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
        width: '100%',
        maxWidth: '100%',
        minHeight: 0
      }}>
        <div style={{ 
          width: isMobile ? '100%' : 'min(300px, 40%)', 
          height: isMobile ? '250px' : '100%', 
          minHeight: isMobile ? '250px' : '300px',
          maxHeight: isMobile ? '350px' : '450px',
          maxWidth: '100%',
          flexShrink: 0,
          borderRadius: isMobile ? '8px' : '12px',
          background: 'white',
          padding: '0',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          <ResponsivePie
            data={nivoData}
            margin={isMobile ? { top: 10, right: 10, bottom: 10, left: 10 } : { top: 20, right: 20, bottom: 20, left: 20 }}
            innerRadius={isMobile ? 0.4 : 0.5}
            padAngle={isMobile ? 2 : 3}
            cornerRadius={isMobile ? 4 : 6}
            activeOuterRadiusOffset={isMobile ? 8 : 12}
            colors={(slice) => slice.data.color}
            borderWidth={isMobile ? 2 : 3}
            borderColor={{ from: 'color', modifiers: [['darker', 0.3], ['opacity', 0.8]] }}
            enableArcLinkLabels={false}
            enableArcLabels={true}
            arcLabel={(slice) => {
              const percentage = total > 0 ? ((slice.value / total) * 100).toFixed(0) : 0;
              return percentage > (isMobile ? 8 : 5) ? `${percentage}%` : '';
            }}
            arcLabelsTextColor="#ffffff"
            arcLabelsSkipAngle={isMobile ? 20 : 15}
            animate={true}
            motionConfig={{
              stiffness: 90,
              damping: 15,
              mass: 1
            }}
            onClick={handleClick}
            tooltip={({ datum }) => {
              const percentage = total > 0 ? ((datum.value / total) * 100).toFixed(1) : 0;
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
                    {datum.id}
                  </div>
                  <div style={{ 
                    color: '#475569',
                    fontSize: isMobile ? '13px' : '15px',
                    fontWeight: '600',
                    marginBottom: isMobile ? '2px' : '4px'
                  }}>
                    {formatValue ? formatValue(datum.value, valuePrefix) : `${valuePrefix}${datum.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </div>
                  <div style={{ 
                    color: '#64748b', 
                    fontSize: isMobile ? '10px' : '12px',
                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                    padding: isMobile ? '2px 6px' : '4px 8px',
                    borderRadius: '6px',
                    display: 'inline-block',
                    fontWeight: '600'
                  }}>
                    {percentage}%
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
              labels: {
                text: {
                  fontSize: isMobile ? 11 : 13,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontWeight: 700,
                  fill: '#ffffff',
                  stroke: '#000000',
                  strokeWidth: isMobile ? 1 : 1.2,
                  paintOrder: 'stroke fill',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                }
              }
            }}
          />
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '8px' : '10px',
          minWidth: isMobile ? '100%' : '200px',
          width: isMobile ? '100%' : 'auto',
          maxWidth: '100%'
        }}>
          {data.map((slice, index) => {
            const percentage = total > 0 ? ((slice.value / total) * 100).toFixed(1) : 0;
            return (
              <div
                key={index}
                onClick={() => onSliceClick?.(slice.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '10px 12px' : '12px 16px',
                  borderRadius: isMobile ? '8px' : '10px',
                  cursor: onSliceClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  gap: isMobile ? '8px' : '12px'
                }}
                onMouseEnter={(e) => {
                  if (onSliceClick) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                    if (!isMobile) {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onSliceClick) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '8px' : '12px',
                  flex: 1,
                  minWidth: 0
                }}>
                  <div
                    style={{
                      width: isMobile ? '12px' : '16px',
                      height: isMobile ? '12px' : '16px',
                      borderRadius: '4px',
                      flexShrink: 0,
                      background: `linear-gradient(135deg, ${slice.color || colors[index % colors.length]} 0%, ${slice.color || colors[index % colors.length]}dd 100%)`,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                  />
                  <span style={{
                    fontSize: isMobile ? '11px' : '13px',
                    fontWeight: '600',
                    color: '#475569',
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
                  gap: isMobile ? '6px' : '12px',
                  flexShrink: 0
                }}>
                  <span style={{
                    fontSize: isMobile ? '10px' : '12px',
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: isMobile ? '2px 6px' : '4px 8px',
                    borderRadius: '6px',
                    fontWeight: '600'
                  }}>
                    {percentage}%
                  </span>
                  <span style={{
                    fontSize: isMobile ? '11px' : '13px',
                    fontWeight: '700',
                    color: '#1e293b'
                  }}>
                    {formatValue ? formatValue(slice.value, valuePrefix) : `${valuePrefix}${slice.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PieChart;

