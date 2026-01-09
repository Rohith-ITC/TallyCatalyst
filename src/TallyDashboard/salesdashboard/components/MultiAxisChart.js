import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

const MultiAxisChart = ({
  categories = [],
  series = [],
  height = 500,
  isMobile = false,
  onCategoryClick,
  onBackClick,
  showBackButton = false,
  customHeader,
  formatValue,
  formatCompactValue,
}) => {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!chartRef.current) return;

    // Check if container has dimensions
    const checkDimensions = () => {
      if (!chartRef.current) return false;
      const containerWidth = chartRef.current.clientWidth;
      const containerHeight = chartRef.current.clientHeight;
      return containerWidth > 0 && containerHeight > 0;
    };

    // Initialize chart once container has dimensions
    if (checkDimensions() && !instanceRef.current) {
      try {
        instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize ECharts:', error);
      }
    } else if (!checkDimensions()) {
      // Retry after container is ready
      const timer = setTimeout(() => {
        if (checkDimensions() && !instanceRef.current) {
          try {
            instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'svg' });
            setIsReady(true);
          } catch (error) {
            console.error('Failed to initialize ECharts:', error);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !instanceRef.current || !categories || categories.length === 0) return;

    // Check if we have 2 y-axes being used
    const hasLeftAxis = series.some(s => s.axis !== 'right');
    const hasRightAxis = series.some(s => s.axis === 'right');
    const hasTwoAxes = hasLeftAxis && hasRightAxis;

    // Calculate actual data min/max for each axis
    let leftDataMin = null, leftDataMax = null;
    let rightDataMin = null, rightDataMax = null;

    series.forEach((s) => {
      const data = s.data || [];
      if (data.length > 0) {
        const validData = data.filter(d => d != null && !isNaN(d));
        if (validData.length > 0) {
          const min = Math.min(...validData);
          const max = Math.max(...validData);
          
          if (s.axis === 'right') {
            rightDataMin = rightDataMin === null ? min : Math.min(rightDataMin, min);
            rightDataMax = rightDataMax === null ? max : Math.max(rightDataMax, max);
          } else {
            leftDataMin = leftDataMin === null ? min : Math.min(leftDataMin, min);
            leftDataMax = leftDataMax === null ? max : Math.max(leftDataMax, max);
          }
        }
      }
    });

    // Calculate optimized min/max for each axis
    let leftMin = undefined, leftMax = undefined;
    let rightMin = undefined, rightMax = undefined;

    // Helper function to calculate optimized range with minimal padding
    const calculateOptimalRange = (dataMin, dataMax) => {
      if (dataMin === null || dataMax === null || dataMin === dataMax) {
        return { min: undefined, max: undefined };
      }

      const range = dataMax - dataMin;
      // Use smaller padding (5%) to minimize wasted space
      const padding = Math.max(range * 0.05, Math.abs(dataMax) * 0.02, Math.abs(dataMin) * 0.02);

      let min = dataMin - padding;
      let max = dataMax + padding;

      // Include zero if needed
      const needsZero = dataMin < 0 || dataMax > 0;
      if (needsZero && (min > 0 || max < 0)) {
        if (min > 0) min = -padding;
        if (max < 0) max = padding;
      }

      return { min, max };
    };

    if (hasTwoAxes) {
      // Calculate optimal ranges for both axes independently
      let leftRange = undefined, rightRange = undefined;
      
      if (leftDataMin !== null && leftDataMax !== null) {
        leftRange = calculateOptimalRange(leftDataMin, leftDataMax);
        leftMin = leftRange.min;
        leftMax = leftRange.max;
      }
      
      if (rightDataMin !== null && rightDataMax !== null) {
        rightRange = calculateOptimalRange(rightDataMin, rightDataMax);
        rightMin = rightRange.min;
        rightMax = rightRange.max;
      }

      // Align zero points if both axes cross zero, while maintaining independent scales
      const leftCrossesZero = leftMin !== undefined && leftMax !== undefined && leftMin < 0 && leftMax > 0;
      const rightCrossesZero = rightMin !== undefined && rightMax !== undefined && rightMin < 0 && rightMax > 0;

      if (leftCrossesZero && rightCrossesZero) {
        // Calculate zero position ratio for each axis (where zero appears in the range)
        const leftZeroRatio = Math.abs(leftMin) / (leftMax - leftMin);
        const rightZeroRatio = Math.abs(rightMin) / (rightMax - rightMin);

        // If zero ratios don't match, adjust ranges to align zeros
        if (Math.abs(leftZeroRatio - rightZeroRatio) > 0.01) {
          // Use the average ratio to align zeros at the same level
          const targetZeroRatio = (leftZeroRatio + rightZeroRatio) / 2;

          // Get the actual data extents (positive and negative) for each axis
          const leftPositiveData = Math.max(leftDataMax, 0);
          const leftNegativeData = Math.max(Math.abs(leftDataMin), 0);
          const rightPositiveData = Math.max(rightDataMax, 0);
          const rightNegativeData = Math.max(Math.abs(rightDataMin), 0);

          // Calculate minimum total range needed for each axis to fit data at target zero ratio
          // If targetZeroRatio = 0.3, then 30% below zero, 70% above zero
          // To fit leftNegativeData in 30%: totalRange >= leftNegativeData / 0.3
          // To fit leftPositiveData in 70%: totalRange >= leftPositiveData / 0.7
          const leftMinRange = Math.max(
            leftNegativeData / targetZeroRatio,
            leftPositiveData / (1 - targetZeroRatio)
          );
          const rightMinRange = Math.max(
            rightNegativeData / targetZeroRatio,
            rightPositiveData / (1 - targetZeroRatio)
          );

          // Add padding (5%)
          const leftTotalRange = leftMinRange * 1.05;
          const rightTotalRange = rightMinRange * 1.05;

          // Set ranges with aligned zero positions
          leftMin = -leftTotalRange * targetZeroRatio;
          leftMax = leftTotalRange * (1 - targetZeroRatio);
          rightMin = -rightTotalRange * targetZeroRatio;
          rightMax = rightTotalRange * (1 - targetZeroRatio);
        }
      }
    } else {
      // Single axis - just calculate optimal range
      if (hasLeftAxis && leftDataMin !== null && leftDataMax !== null) {
        const range = calculateOptimalRange(leftDataMin, leftDataMax);
        leftMin = range.min;
        leftMax = range.max;
      } else if (hasRightAxis && rightDataMin !== null && rightDataMax !== null) {
        const range = calculateOptimalRange(rightDataMin, rightDataMax);
        rightMin = range.min;
        rightMax = range.max;
      }
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        // Keep tooltip within the chart area to avoid clipping
        confine: true,
        // Dynamically place tooltip: top-half points -> below, bottom-half points -> above
        position: (pos, params, dom, rect, size) => {
          if (!size?.viewSize || !size?.contentSize || !Array.isArray(pos)) return undefined;

          const [mouseX, mouseY] = pos;
          const [viewW, viewH] = size.viewSize;
          const [tipW, tipH] = size.contentSize;
          const OFFSET = 12;

          // Center horizontally around cursor, clamp within viewport
          let x = mouseX - tipW / 2;
          x = Math.max(0, Math.min(x, viewW - tipW));

          // Top half => show below; bottom half => show above
          let y = mouseY < viewH / 2 ? mouseY + OFFSET : mouseY - tipH - OFFSET;
          y = Math.max(0, Math.min(y, viewH - tipH));

          return [x, y];
        },
        textStyle: {
          fontSize: isMobile ? 11 : 12,
        },
        formatter: (params) => {
          if (!params || !Array.isArray(params)) return '';
          let result = params[0]?.axisValue || '';
          params.forEach((param) => {
            const value = param.value;
            const seriesName = param.seriesName || '';
            const isCustomerField = seriesName.toLowerCase().includes('customer') || 
                                   seriesName.toLowerCase().includes('customers');
            
            let formattedValue;
            if (isCustomerField) {
              // Format customer count as a number, not currency
              formattedValue = Math.round(value).toLocaleString();
            } else {
              // Format other values as currency
              formattedValue = formatValue 
                ? formatValue(value, '₹')
                : `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            result += `<br/>${param.marker}${param.seriesName}: ${formattedValue}`;
          });
          return result;
        },
      },
      legend: {
        top: 0,
        type: 'scroll',
        icon: 'rect',
        itemWidth: 12,
        itemHeight: 8,
        textStyle: {
          fontSize: isMobile ? 10 : 11,
        },
      },
      grid: {
        left: isMobile ? 40 : 20,
        right: isMobile ? 40 : 20,
        top: 35,
        bottom: categories.length > 10 ? 30 : categories.length > 6 ? 30 : 30,
        containLabel: true,
      },
      xAxis: [
        {
          type: 'category',
          data: categories,
          axisLabel: {
            rotate: categories.length > 8 ? 35 : 0,
            fontSize: isMobile ? 10 : 11,
            overflow: 'truncate',
            interval: 0,
          },
        },
      ],
      yAxis: [
        {
          type: 'value',
          name: 'Left Axis',
          position: 'left',
          min: leftMin !== undefined ? leftMin : undefined,
          max: leftMax !== undefined ? leftMax : undefined,
          axisLabel: { 
            fontSize: isMobile ? 10 : 11,
            formatter: (value) => {
              if (formatCompactValue) {
                return formatCompactValue(value, '');
              }
              // Default formatting
              const absValue = Math.abs(value);
              if (absValue >= 10000000) {
                return `${(value / 10000000).toFixed(1)}Cr`;
              } else if (absValue >= 100000) {
                return `${(value / 100000).toFixed(1)}L`;
              } else if (absValue >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              } else {
                return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              }
            },
          },
          nameTextStyle: { fontSize: isMobile ? 10 : 11 },
          splitLine: { show: true },
        },
        {
          type: 'value',
          name: 'Right Axis',
          position: 'right',
          min: rightMin !== undefined ? rightMin : undefined,
          max: rightMax !== undefined ? rightMax : undefined,
          axisLabel: { 
            fontSize: isMobile ? 10 : 11,
            formatter: (value) => {
              if (formatCompactValue) {
                return formatCompactValue(value, '');
              }
              // Default formatting
              const absValue = Math.abs(value);
              if (absValue >= 10000000) {
                return `${(value / 10000000).toFixed(1)}Cr`;
              } else if (absValue >= 100000) {
                return `${(value / 100000).toFixed(1)}L`;
              } else if (absValue >= 1000) {
                return `${(value / 1000).toFixed(1)}K`;
              } else {
                return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              }
            },
          },
          nameTextStyle: { fontSize: isMobile ? 10 : 11 },
          splitLine: { show: false },
        },
      ],
      series: series.map((s) => ({
        name: s.name,
        type: s.type || 'bar',
        data: s.data || [],
        yAxisIndex: s.axis === 'right' ? 1 : 0,
        smooth: s.type === 'line',
        symbol: s.type === 'line' ? 'circle' : 'none',
        symbolSize: 6,
        barMaxWidth: 32,
        itemStyle: {
          color: s.color,
        },
        lineStyle: s.type === 'line' ? { width: 2, color: s.color } : undefined,
      })),
    };

    try {
      instanceRef.current.setOption(option, true);
      instanceRef.current.resize();
    } catch (error) {
      console.error('Failed to set chart options:', error);
    }

    // Add click event handler for cross-filtering
    const handleClick = (params) => {
      if (params.componentType === 'xAxis' || params.componentType === 'series') {
        const categoryIndex = params.dataIndex ?? params.value;
        const category = categories[categoryIndex] || params.name;
        if (category && onCategoryClick) {
          onCategoryClick(category);
        }
      }
    };

    // Remove old handler and add new one
    instanceRef.current.off('click');
    instanceRef.current.on('click', handleClick);

    return () => {
      if (instanceRef.current) {
        instanceRef.current.off('click', handleClick);
      }
    };
  }, [isReady, categories, series, isMobile, onCategoryClick, formatValue, formatCompactValue]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (instanceRef.current) {
        instanceRef.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: typeof height === 'number' ? `${height}px` : height, overflow: 'hidden' }}>
      {showBackButton && onBackClick && (
        <button
          onClick={onBackClick}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 100,
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
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
          }}
        >
          <span style={{ fontSize: isMobile ? '14px' : '16px' }}>←</span>
          <span>Back</span>
        </button>
      )}
      <div
        ref={chartRef}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};

export default MultiAxisChart;
