import React, { useMemo, useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';

const TreeMap = ({ data, title, valuePrefix = '₹', onBoxClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const plotRef = useRef(null);
  
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

  // Prepare Plotly treemap data
  const plotlyData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0 || total === 0) {
      return null;
    }

    const filteredData = data.filter(item => item.value > 0);
    
    // Create labels with name on first line and value on second line
    const labels = filteredData.map((item, index) => {
      const name = item.label || `Item ${index}`;
      const value = `${valuePrefix}${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `${name}<br>${value}`;
    });

    const values = filteredData.map(item => item.value);
    const parents = filteredData.map(() => '');
    const customColors = filteredData.map((item, index) => item.color || colors[index % colors.length]);

    return {
      type: 'treemap',
      labels: labels,
      values: values,
      parents: parents,
      marker: {
        colors: customColors,
        line: {
          color: '#ffffff',
          width: isMobile ? 2 : 3
        }
      },
      textfont: {
        family: 'system-ui, -apple-system, sans-serif',
        size: isMobile ? 10 : 12,
        color: '#ffffff'
      },
      textinfo: 'label',
      textposition: 'middle center',
      hovertemplate: '<b>%{label}</b><br>' +
        `Value: ${valuePrefix}%{value:,.2f}<br>` +
        'Percentage: %{percentParent:.1f}%<extra></extra>',
      customdata: filteredData.map(item => ({
        label: item.label,
        value: item.value,
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
      }))
    };
  }, [data, total, colors, valuePrefix, isMobile]);

  // Handle click events
  const handleClick = (event) => {
    if (event && event.points && event.points[0] && onBoxClick) {
      const point = event.points[0];
      const customData = point.data.customdata[point.pointNumber];
      if (customData && customData.label) {
        onBoxClick(customData.label);
      }
    }
  };

  // Handle empty data
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
          padding: '0',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
          width: '100%',
          maxWidth: '100%'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '100%',
            height: isMobile ? '280px' : 'min(400px, calc(100vh - 400px))', 
            minHeight: isMobile ? '280px' : '320px',
            maxHeight: isMobile ? '350px' : '500px',
            position: 'relative',
            flexShrink: 0,
            borderRadius: isMobile ? '8px' : '12px',
            overflow: 'hidden',
            background: 'white',
            boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
          }} />
        </div>
      </div>
    );
  }

  if (!plotlyData) {
    return null;
  }

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
        padding: '0',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'radial-gradient(circle at top, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
        width: '100%',
        maxWidth: '100%'
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '100%',
          height: isMobile ? '280px' : 'min(400px, calc(100vh - 400px))', 
          minHeight: isMobile ? '280px' : '320px',
          maxHeight: isMobile ? '350px' : '500px',
          position: 'relative',
          flexShrink: 0,
          borderRadius: isMobile ? '8px' : '12px',
          overflow: 'hidden',
          background: 'white',
          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
        }}>
          <Plot
            ref={plotRef}
            data={[plotlyData]}
            layout={{
              margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: {
                family: 'system-ui, -apple-system, sans-serif',
                size: isMobile ? 10 : 12,
                color: '#ffffff'
              },
              autosize: true,
              showlegend: false
            }}
            config={{
              displayModeBar: false,
              responsive: true
            }}
            style={{ width: '100%', height: '100%' }}
            onClick={handleClick}
            useResizeHandler={true}
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
            {data.map((box, index) => (
              <div
                key={`${box.label}-${index}`}
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
                    background: `linear-gradient(135deg, ${box.color || colors[index % colors.length]} 0%, ${box.color || colors[index % colors.length]}dd 100%)`,
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
                    {box.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px', flexShrink: 0 }}>
                  <span style={{ 
                    fontSize: isMobile ? '10px' : '12px', 
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: isMobile ? '2px 6px' : '4px 8px',
                    borderRadius: '6px',
                    fontWeight: '600'
                  }}>
                    {((box.value / total) * 100).toFixed(1)}%
                  </span>
                  <span style={{ 
                    fontSize: isMobile ? '11px' : '13px', 
                    fontWeight: '700', 
                    color: '#1e293b'
                  }}>
                    {valuePrefix}{box.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(box)}
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

export default TreeMap;
