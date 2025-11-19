import React from 'react';

const BarChart = ({ data, title, valuePrefix = '₹', onBarClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  const maxValue = Math.max(...data.map(d => d.value));

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
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px',
        padding: '12px 16px',
        overflowY: 'auto',
        flex: 1
      }}>
        {data.map((item) => (
          <div
            key={item.label}
            onClick={() => onBarClick?.(item.label)}
            style={{
              cursor: onBarClick ? 'pointer' : 'default',
              padding: onBarClick ? '6px' : '0',
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
              gap: '8px',
              marginBottom: '4px'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: rowAction ? '55%' : '60%'
              }}>
                {item.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#1e293b'
                }}>
                  {valuePrefix}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {rowAction && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      rowAction.onClick?.(item);
                    }}
                    title={rowAction.title || 'View raw data'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#1e40af',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s ease, color 0.2s ease'
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
            <div style={{
              width: '100%',
              background: '#e2e8f0',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  height: '8px',
                  borderRadius: '4px',
                  transition: 'all 0.5s ease-out',
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || '#3b82f6',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
