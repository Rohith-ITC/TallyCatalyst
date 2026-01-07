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

    // Calculate min/max for each axis to align zero points
    let leftMin = 0, leftMax = 0;
    let rightMin = 0, rightMax = 0;

    if (hasTwoAxes) {
      series.forEach((s) => {
        const data = s.data || [];
        if (data.length > 0) {
          const min = Math.min(...data);
          const max = Math.max(...data);
          
          if (s.axis === 'right') {
            rightMin = Math.min(rightMin, min);
            rightMax = Math.max(rightMax, max);
          } else {
            leftMin = Math.min(leftMin, min);
            leftMax = Math.max(leftMax, max);
          }
        }
      });

      // Calculate the ratio of the ranges to align zero points
      // We want zero to be at the same proportional position on both axes
      const leftRange = leftMax - leftMin;
      const rightRange = rightMax - rightMin;

      if (leftRange > 0 && rightRange > 0) {
        // Determine if zero should be included in the scale
        const leftNeedsZero = leftMin < 0 || leftMax > 0;
        const rightNeedsZero = rightMin < 0 || rightMax > 0;

        if (leftNeedsZero || rightNeedsZero) {
          // Calculate padding (10% on each side)
          const leftPadding = leftRange * 0.1;
          const rightPadding = rightRange * 0.1;

          // Ensure zero is included and properly positioned
          if (leftMin >= 0) {
            // All values are positive, ensure zero is at bottom
            leftMin = -leftPadding;
          } else if (leftMax <= 0) {
            // All values are negative, ensure zero is at top
            leftMax = leftPadding;
          } else {
            // Zero is within range
            leftMin = leftMin - leftPadding;
            leftMax = leftMax + leftPadding;
          }

          if (rightMin >= 0) {
            rightMin = -rightPadding;
          } else if (rightMax <= 0) {
            rightMax = rightPadding;
          } else {
            rightMin = rightMin - rightPadding;
            rightMax = rightMax + rightPadding;
          }

          // Calculate the ratio to align zero
          const leftZeroRatio = leftMin < 0 ? Math.abs(leftMin) / (leftMax - leftMin) : 0;
          const rightZeroRatio = rightMin < 0 ? Math.abs(rightMin) / (rightMax - rightMin) : 0;

          // Adjust ranges to make zero align
          if (leftZeroRatio !== rightZeroRatio) {
            // Find the maximum range needed
            const maxPositiveRange = Math.max(leftMax, rightMax);
            const maxNegativeRange = Math.max(Math.abs(leftMin), Math.abs(rightMin));
            
            // Set both axes to have the same proportional zero position
            const targetRatio = Math.max(leftZeroRatio, rightZeroRatio);
            const leftNewNegative = maxPositiveRange * targetRatio / (1 - targetRatio);
            const rightNewNegative = maxPositiveRange * targetRatio / (1 - targetRatio);

            leftMin = -leftNewNegative;
            rightMin = -rightNewNegative;
            leftMax = maxPositiveRange;
            rightMax = maxPositiveRange;
          }
        }
      }
    }

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        textStyle: {
          fontSize: isMobile ? 11 : 12,
        },
        formatter: (params) => {
          if (!params || !Array.isArray(params)) return '';
          let result = params[0]?.axisValue || '';
          params.forEach((param) => {
            const value = param.value;
            const formattedValue = formatValue 
              ? formatValue(value, '₹')
              : `₹${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            result += `<br/>${param.marker}${param.seriesName}: ${formattedValue}`;
          });
          return result;
        },
      },
      legend: {
        top: 10,
        type: 'scroll',
        icon: 'rect',
        itemWidth: 12,
        itemHeight: 8,
        textStyle: {
          fontSize: isMobile ? 10 : 11,
        },
      },
      grid: {
        left: isMobile ? 50 : 60,
        right: isMobile ? 50 : 70,
        top: 50,
        bottom: categories.length > 10 ? 70 : categories.length > 6 ? 60 : 50,
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
          min: hasTwoAxes && leftMin !== 0 ? leftMin : undefined,
          max: hasTwoAxes && leftMax !== 0 ? leftMax : undefined,
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
          min: hasTwoAxes && rightMin !== 0 ? rightMin : undefined,
          max: hasTwoAxes && rightMax !== 0 ? rightMax : undefined,
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
    <div style={{ position: 'relative', width: '100%', height: typeof height === 'number' ? `${height}px` : height }}>
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
        }}
      />
    </div>
  );
};

export default MultiAxisChart;
