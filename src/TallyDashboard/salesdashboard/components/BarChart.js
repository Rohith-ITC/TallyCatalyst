import React from 'react';

const BarChart = ({ data, title, valuePrefix = '₹', onBarClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

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

  const maxValue = Math.max(...data.map(d => d.value));


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
          gap: isMobile ? '12px' : '16px'
        }}>
          {data.map((item) => (
            <div
              key={item.label}
              onClick={() => onBarClick?.(item.label)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '12px' : '16px',
                cursor: onBarClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                padding: isMobile ? '4px 0' : '6px 0'
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
                height: isMobile ? '28px' : '32px',
                display: 'flex',
                alignItems: 'center'
              }}>
                {/* Background bar */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: isMobile ? '28px' : '32px',
                  background: '#f1f5f9',
                  borderRadius: '8px'
                }} />
                
                {/* Filled bar */}
                <div style={{
                  position: 'relative',
                  height: isMobile ? '28px' : '32px',
                  width: `${(item.value / maxValue) * 100}%`,
                  background: 'linear-gradient(90deg, #4ade80 0%, #22c55e 100%)',
                  borderRadius: '8px',
                  transition: 'all 0.5s ease-out',
                  boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '12px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '600',
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                  }}>
                    {valuePrefix}{(item.value / 10000000).toFixed(2)}M
                  </span>
                </div>
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
                <span>{valuePrefix}{(item.value / 10000000).toFixed(2)}M</span>
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
