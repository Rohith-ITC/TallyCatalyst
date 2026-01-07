import React, { useState } from 'react';

const TableChart = ({ 
  data, 
  title, 
  valuePrefix = '₹', 
  onRowClick, 
  onBackClick, 
  showBackButton, 
  rowAction, 
  customHeader, 
  formatValue,
  formatCompactValue 
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate total for percentage calculation
  const total = React.useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [data]);

  // Handle sorting
  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!data || !Array.isArray(data) || sortConfig.key === null) {
      return data || [];
    }

    return [...data].sort((a, b) => {
      let aValue, bValue;

      if (sortConfig.key === 'label') {
        aValue = (a.label || '').toLowerCase();
        bValue = (b.label || '').toLowerCase();
      } else if (sortConfig.key === 'value') {
        aValue = a.value || 0;
        bValue = b.value || 0;
      } else if (sortConfig.key === 'percentage') {
        aValue = total > 0 ? ((a.value || 0) / total) * 100 : 0;
        bValue = total > 0 ? ((b.value || 0) / total) * 100 : 0;
      }

      if (sortConfig.key === 'label') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
    });
  }, [data, sortConfig, total]);

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
          </div>
        )}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: '#64748b',
          fontSize: '14px'
        }}>
          No data available
        </div>
      </div>
    );
  }

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="material-icons" style={{ 
          fontSize: '16px', 
          color: '#94a3b8',
          marginLeft: '4px'
        }}>
          unfold_more
        </span>
      );
    }
    return (
      <span className="material-icons" style={{ 
        fontSize: '16px', 
        color: '#3b82f6',
        marginLeft: '4px'
      }}>
        {sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    );
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
          marginBottom: '0',
          borderBottom: '1px solid #e2e8f0'
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
          gap: isMobile ? '8px' : '12px',
          borderBottom: '1px solid #e2e8f0'
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
        overflowY: 'auto',
        overflowX: 'auto',
        minHeight: 0
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <thead style={{
            position: 'sticky',
            top: 0,
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            zIndex: 5,
            borderBottom: '2px solid #e2e8f0'
          }}>
            <tr>
              <th
                onClick={() => handleSort('label')}
                style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'left',
                  fontWeight: '700',
                  color: '#1e293b',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  borderRight: '1px solid #e2e8f0',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  Category
                  <SortIcon columnKey="label" />
                </div>
              </th>
              <th
                onClick={() => handleSort('percentage')}
                style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'right',
                  fontWeight: '700',
                  color: '#1e293b',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  borderRight: '1px solid #e2e8f0',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Percentage
                  <SortIcon columnKey="percentage" />
                </div>
              </th>
              <th
                onClick={() => handleSort('value')}
                style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'right',
                  fontWeight: '700',
                  color: '#1e293b',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  Value
                  <SortIcon columnKey="value" />
                </div>
              </th>
              {rowAction && (
                <th style={{
                  padding: isMobile ? '10px 8px' : '12px 16px',
                  textAlign: 'center',
                  fontWeight: '700',
                  color: '#1e293b',
                  width: '60px'
                }}>
                  Data
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => {
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
              const colors = [
                '#0d6464', '#2dd4bf', '#c55a39', '#f59e0b', '#16a34a',
                '#0891b2', '#dc2626', '#7c3aed', '#ea580c', '#059669',
                '#0284c7', '#db2777', '#65a30d', '#6366f1', '#ca8a04',
                '#14b8a6', '#e11d48', '#8b5cf6', '#d97706', '#10b981'
              ];
              const itemColor = item.color || colors[index % colors.length];

              return (
                <tr
                  key={item.label || index}
                  onClick={() => onRowClick?.(item.label)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                    background: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (onRowClick) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  <td style={{
                    padding: isMobile ? '12px 8px' : '14px 16px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: isMobile ? '12px' : '16px',
                          height: isMobile ? '12px' : '16px',
                          borderRadius: '4px',
                          flexShrink: 0,
                          background: `linear-gradient(135deg, ${itemColor} 0%, ${itemColor}dd 100%)`,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.3)'
                        }}
                      />
                      <span style={{
                        fontWeight: '600',
                        color: '#475569',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.label}
                      </span>
                    </div>
                  </td>
                  <td style={{
                    padding: isMobile ? '12px 8px' : '14px 16px',
                    textAlign: 'right',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    <span style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#64748b',
                      background: '#f1f5f9',
                      padding: isMobile ? '2px 6px' : '4px 8px',
                      borderRadius: '6px',
                      fontWeight: '600',
                      display: 'inline-block'
                    }}>
                      {percentage}%
                    </span>
                  </td>
                  <td style={{
                    padding: isMobile ? '12px 8px' : '14px 16px',
                    textAlign: 'right'
                  }}>
                    <span style={{
                      fontWeight: '700',
                      color: '#1e293b'
                    }}>
                      {formatValue ? formatValue(item.value, valuePrefix) : `${valuePrefix}${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </span>
                  </td>
                  {rowAction && (
                    <td style={{
                      padding: isMobile ? '12px 8px' : '14px 16px',
                      textAlign: 'center'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          rowAction.onClick?.(item);
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
                          justifyContent: 'center',
                          margin: '0 auto'
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
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableChart;

