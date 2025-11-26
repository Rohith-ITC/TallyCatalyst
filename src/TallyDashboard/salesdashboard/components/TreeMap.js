import React, { useMemo, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';

const TreeMap = ({ data, title, valuePrefix = '₹', onBoxClick, onBackClick, showBackButton, rowAction, customHeader }) => {
  // Generate colors if not provided (moved before hooks)
  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#8b5a2b', // Brown
    '#6b7280', // Gray
    '#dc2626', // Red-600
    '#059669', // Green-600
    '#d97706', // Orange-600
    '#7c3aed', // Purple-600
    '#0891b2', // Sky-600
    '#ca8a04'  // Yellow-600
  ];

  // Calculate total (before hooks)
  const total = useMemo(() => {
    if (!data || !Array.isArray(data)) return 0;
    return data.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [data]);

  // Convert data to Plotly format (must be before early returns)
  const plotlyData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0 || total === 0) {
      return {
        labels: [],
        values: [],
        parents: [],
        text: [],
        markerColors: [],
        hoverText: []
      };
    }

    const labels = [];
    const values = [];
    const parents = [];
    const text = [];
    const markerColors = [];
    const hoverText = [];

    data.forEach((item, index) => {
      if (item.value > 0) {
        labels.push(item.label || `Item ${index}`);
        values.push(item.value);
        parents.push(''); // Empty parent means root level
        markerColors.push(item.color || colors[index % colors.length]);
        
        // Text to display inside boxes (name and value)
        const label = item.label || `Item ${index}`;
        text.push(`${label}<br>${valuePrefix}${item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
        
        // Hover text (without label since it's already shown on the rectangle)
        const percentage = ((item.value / total) * 100).toFixed(1);
        hoverText.push(`${valuePrefix}${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>${percentage}%`);
      }
    });

    return {
      labels,
      values,
      parents,
      text,
      markerColors,
      hoverText
    };
  }, [data, total, valuePrefix, colors]);

  // Plotly layout configuration
  const layout = useMemo(() => ({
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      family: 'system-ui, -apple-system, sans-serif',
      size: 12,
      color: '#1e293b'
    },
    hovermode: 'closest',
    showlegend: false
  }), []);

  // Ref for the plot container (must be before early returns)
  const plotContainerRef = useRef(null);

  // Add CSS for text outline effect (must be before early returns)
  useEffect(() => {
    const styleId = 'treemap-text-outline-style';
    
    // Add global style for all Plotly text elements
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .js-plotly-plot .textlayer text,
        .js-plotly-plot .textlayer tspan {
          stroke: #000000 !important;
          stroke-width: 0.8px !important;
          paint-order: stroke fill !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Apply styles directly to text elements after Plotly renders
    const applyTextStyles = () => {
      if (plotContainerRef.current) {
        const textElements = plotContainerRef.current.querySelectorAll('.textlayer text, .textlayer tspan');
        textElements.forEach((el) => {
          el.style.stroke = '#000000';
          el.style.strokeWidth = '0.8px';
          el.style.paintOrder = 'stroke fill';
        });
      }
    };

    // Apply immediately
    applyTextStyles();

    // Use MutationObserver to apply styles when Plotly updates
    const observer = new MutationObserver(() => {
      applyTextStyles();
    });

    if (plotContainerRef.current) {
      observer.observe(plotContainerRef.current, {
        childList: true,
        subtree: true
      });
    }

    // Also use a timeout as a fallback
    const timeoutId = setTimeout(applyTextStyles, 100);
    const timeoutId2 = setTimeout(applyTextStyles, 500);

    // Cleanup
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, [plotlyData]); // Re-run when data changes

  // Validate data (after hooks)
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        color: '#64748b'
      }}>
        No data available
      </div>
    );
  }
  
  if (total === 0) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        color: '#64748b'
      }}>
        No data to display
      </div>
    );
  }

  // Plotly configuration
  const config = {
    displayModeBar: false,
    responsive: true,
    staticPlot: false
  };

  // Handle click events
  const handleClick = (event) => {
    if (onBoxClick && event.points && event.points.length > 0) {
      const point = event.points[0];
      const label = point.label;
      if (label) {
        console.log('TreeMap click:', label);
        onBoxClick(label);
      }
    }
  };

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
        padding: '12px 16px',
        flex: 1,
        minHeight: '250px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <div 
          ref={plotContainerRef}
          style={{ 
            width: '100%', 
            height: '400px', 
            position: 'relative',
            flexShrink: 0
          }}
        >
          <Plot
            data={[{
              type: 'treemap',
              labels: plotlyData.labels,
              values: plotlyData.values,
              parents: plotlyData.parents,
              text: plotlyData.text,
              textinfo: 'text',
              textfont: {
                size: 14,
                color: '#ffffff',
                family: 'system-ui, -apple-system, sans-serif'
              },
              textposition: 'middle center',
              hovertemplate: '<b>%{label}</b><br>%{customdata}<extra></extra>',
              customdata: plotlyData.hoverText,
              marker: {
                colors: plotlyData.markerColors,
                line: {
                  width: 2,
                  color: '#ffffff'
                },
                pad: {
                  t: 2,
                  l: 2,
                  r: 2,
                  b: 2
                }
              },
              branchvalues: 'total',
              pathbar: {
                visible: false
              }
            }]}
            layout={layout}
            config={config}
            style={{ width: '100%', height: '100%' }}
            onClick={handleClick}
            useResizeHandler={true}
          />
        </div>
        {rowAction && (
          <div style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {data.map((box, index) => (
              <div
                key={`${box.label}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '2px', 
                    background: box.color || colors[index % colors.length] 
                  }} />
                  <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>{box.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {((box.value / total) * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>
                    {valuePrefix}{box.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => rowAction.onClick?.(box)}
                    title={rowAction.title || 'View raw data'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#1e40af',
                      padding: '2px',
                      borderRadius: '50%'
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
