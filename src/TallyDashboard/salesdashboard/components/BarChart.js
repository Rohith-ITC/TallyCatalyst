import React, { useState, Fragment } from 'react';
import TreeViewModal from './TreeViewModal';

const BarChart = ({ data, title, valuePrefix = '₹', onBarClick, onBackClick, showBackButton, rowAction, customHeader, stacked = false, formatValue }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [showTreeModal, setShowTreeModal] = useState(false);
  
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

  // Calculate max value based on whether it's stacked or not
  const maxValue = stacked 
    ? Math.max(...data.map(d => d.segments?.reduce((sum, seg) => sum + seg.value, 0) || d.value || 0), 0)
    : Math.max(...data.map(d => d.value || 0), 0);

  // Check if data has segments (stacked)
  const hasStackedData = stacked && data && data.some(item => item.segments && Array.isArray(item.segments) && item.segments.length > 0);

  return (
    <Fragment>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
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
            {/* Tree Icon - Only show if stacked and has segments */}
            {hasStackedData && (
              <button
                onClick={() => setShowTreeModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  background: 'transparent',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  width: '32px',
                  height: '32px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#64748b';
                }}
                title="View as tree"
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>account_tree</span>
              </button>
            )}
          </div>
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
        padding: '20px',
        overflowY: 'auto',
        overflowX: 'hidden',
        flex: '1 1 0',
        minHeight: 0,
        height: 0
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0px'
        }}>
          {data.map((item) => {
            const totalValue = stacked 
              ? (item.segments?.reduce((sum, seg) => sum + (seg.value || 0), 0) || 0)
              : (item.value || 0);
            
            return (
              <div
                key={item.label}
                onClick={() => onBarClick?.(item.label)}
                style={{
                  cursor: onBarClick ? 'pointer' : 'default',
                  padding: onBarClick ? '0px' : '0',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (onBarClick) {
                    e.currentTarget.style.background = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onBarClick) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '13px' : '14px',
                    fontWeight: '600',
                    color: '#1e293b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '60%',
                    letterSpacing: '-0.01em'
                  }}>
                    {item.label}
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}>
                      {formatValue ? formatValue(totalValue, valuePrefix) : `${valuePrefix}${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
                          background: '#eff6ff',
                          cursor: 'pointer',
                          color: '#1e40af',
                          padding: '0px',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                          e.currentTarget.style.color = '#1e3a8a';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                          e.currentTarget.style.color = '#1e40af';
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '18px' }}>
                          {rowAction.icon || 'table_view'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Stacked or Regular Bar */}
                <div style={{
                  width: '100%',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  height: '10px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {stacked && item.segments && Array.isArray(item.segments) && item.segments.length > 0 ? (
                    // Stacked segments
                    <div style={{
                      display: 'flex',
                      height: '10px',
                      width: `${maxValue > 0 ? (totalValue / maxValue) * 100 : 0}%`,
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      {item.segments.map((segment, idx) => {
                        const segmentValue = segment.value || 0;
                        const segmentWidth = totalValue > 0 ? (segmentValue / totalValue) * 100 : 0;
                        return (
                          <div
                            key={`${item.label}-segment-${idx}`}
                            style={{
                              height: '10px',
                              width: `${segmentWidth}%`,
                              minWidth: segmentValue > 0 ? '1px' : '0',
                              backgroundColor: segment.color || '#3b82f6',
                              transition: 'all 0.3s ease',
                              cursor: 'pointer',
                              opacity: hoveredSegment === `${item.label}-${idx}` ? 0.8 : 1
                            }}
                            onMouseEnter={() => setHoveredSegment(`${item.label}-${idx}`)}
                            onMouseLeave={() => setHoveredSegment(null)}
                            title={`${segment.label || `Segment ${idx + 1}`}: ${formatValue ? formatValue(segmentValue, valuePrefix) : `${valuePrefix}${segmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}`}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    // Regular single bar
                    <div
                      style={{
                        height: '10px',
                        borderRadius: '4px',
                        transition: 'all 0.5s ease-out',
                        width: `${maxValue > 0 ? ((item.value || 0) / maxValue) * 100 : 0}%`,
                        backgroundColor: item.color || '#3b82f6',
                      }}
                    />
                  )}
                </div>
                
                {/* Tooltip for stacked bar segments */}
                {stacked && item.segments && Array.isArray(item.segments) && hoveredSegment?.startsWith(item.label) && (() => {
                  const segmentIndex = parseInt(hoveredSegment.split('-').pop());
                  const segment = item.segments[segmentIndex];
                  if (!segment) return null;
                  const segmentValue = segment.value || 0;
                  return (
                    <div style={{
                      marginTop: '4px',
                      padding: '0px 8px',
                      background: '#1e293b',
                      color: 'white',
                      fontSize: '11px',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      {segment.label || `Segment ${segmentIndex + 1}`}: {formatValue ? formatValue(segmentValue, valuePrefix) : `${valuePrefix}${segmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Tree Modal */}
      {hasStackedData && (
        <TreeViewModal
          isOpen={showTreeModal}
          onClose={() => setShowTreeModal(false)}
          data={data}
          title={title}
          valuePrefix={valuePrefix}
          formatValue={formatValue}
        />
      )}
    </Fragment>
  );
};

export default BarChart;
