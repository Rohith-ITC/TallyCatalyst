import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveBar } from '@nivo/bar';

const BarChart = ({ data, title, valuePrefix = '₹', onBarClick, onBackClick, showBackButton, rowAction, customHeader }) => {
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
  if (!data || !Array.isArray(data) || data.length === 0) {
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
        maxHeight: '100%',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        position: 'relative'
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
          flex: '1 1 0',
          minHeight: isMobile ? '200px' : '300px',
          maxHeight: '100%',
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          borderRadius: isMobile ? '8px' : '12px',
          background: 'white',
          padding: '0',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          position: 'relative'
        }} />
      </div>
    );
  }

  // Handle click events
  const handleClick = (bar) => {
    // For ResponsiveBar with indexBy="id", the actual index value is in bar.indexValue or bar.data.id
    const clickedLabel = bar.indexValue || bar.data?.id || bar.id;
    console.log('📊 BarChart click:', { 
      bar, 
      barId: bar.id, 
      indexValue: bar.indexValue,
      dataId: bar.data?.id,
      clickedLabel,
      barData: bar.data 
    });
    if (onBarClick) {
      onBarClick(clickedLabel);
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
      maxHeight: '100%',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '100%',
      position: 'relative'
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
        display: 'flex', 
        flexDirection: 'column', 
        gap: isMobile ? '12px' : '16px',
        padding: '0',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        maxHeight: '100%',
        background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
        width: '100%',
        maxWidth: '100%'
      }}>
        <div style={{ 
          flex: '1 1 0',
          minHeight: isMobile ? '200px' : '300px',
          minWidth: 0,
          maxHeight: '100%',
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          borderRadius: isMobile ? '8px' : '12px',
          background: 'white',
          padding: '0',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <ResponsiveBar
            data={nivoData}
            keys={['value']}
            indexBy="id"
            layout="horizontal"
            margin={isMobile ? { top: 10, right: 10, bottom: 40, left: 80 } : { top: 15, right: 20, bottom: 50, left: 120 }}
            padding={isMobile ? 0.25 : 0.35}
            valueScale={{ type: 'linear' }}
            indexScale={{ type: 'band', round: true }}
            colors={(bar) => bar.data.color}
            borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
            borderWidth={isMobile ? 1.5 : 2}
            borderRadius={isMobile ? 4 : 6}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: isMobile ? 5 : 8,
              tickPadding: isMobile ? 5 : 8,
              tickRotation: 0,
              format: (value) => {
                const formatted = `${valuePrefix}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                return isMobile && formatted.length > 8 ? formatted.substring(0, 6) + '...' : formatted;
              },
              legend: '',
              legendPosition: 'middle',
              legendOffset: isMobile ? 30 : 40,
              tickValues: isMobile ? 3 : 5
            }}
            axisLeft={{
              tickSize: isMobile ? 5 : 8,
              tickPadding: isMobile ? 4 : 10,
              tickRotation: 0,
              legend: '',
              legendPosition: 'middle',
              legendOffset: isMobile ? -30 : -50,
              format: (value) => {
                const maxLength = isMobile ? 12 : 22;
                return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
              }
            }}
            labelSkipWidth={12}
            labelSkipHeight={12}
            labelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
            animate={true}
            motionConfig={{
              stiffness: 90,
              damping: 15,
              mass: 1
            }}
            onClick={handleClick}
            tooltip={({ indexValue, value }) => (
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
                  {indexValue}
                </div>
                <div style={{ 
                  color: '#475569',
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: '600'
                }}>
                  {valuePrefix}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
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
            marginTop: isMobile ? '8px' : '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '8px' : '10px',
            width: '100%',
            maxWidth: '100%',
            maxHeight: isMobile ? '150px' : '200px',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 0
          }}>
            {data.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
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
                    width: isMobile ? '12px' : '16px', 
                    height: isMobile ? '12px' : '16px', 
                    borderRadius: '4px', 
                    background: `linear-gradient(135deg, ${item.color || colors[index % colors.length]} 0%, ${item.color || colors[index % colors.length]}dd 100%)`,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
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
                    {item.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
                  <span style={{ 
                    fontSize: isMobile ? '11px' : '13px', 
                    fontWeight: '700', 
                    color: '#1e293b'
                  }}>
                    {valuePrefix}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(item)}
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

export default BarChart;
