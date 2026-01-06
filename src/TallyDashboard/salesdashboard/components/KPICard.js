import React, { useMemo } from 'react';

const KPICard = ({
  title,
  value,
  target,
  period,
  status = 'met',
  additionalData,
  trendData = [],
  format = (val) => val.toLocaleString(),
  unit = '',
  isMobile = false,
  iconName,
  iconBgColor = '#dcfce7',
  iconColor = '#16a34a',
}) => {
  const isTargetMet = useMemo(() => {
    if (target === undefined || target === null) return true;
    return value >= target;
  }, [value, target]);

  const displayStatus = useMemo(() => {
    if (status === 'met') return 'met';
    if (status === 'below') return 'below';
    if (status === 'above') return 'above';
    return isTargetMet ? 'met' : 'below';
  }, [status, isTargetMet]);

  const valueColor = displayStatus === 'met' ? '#16a34a' : '#ea580c';

  const formattedValue = useMemo(() => format(value), [value, format]);
  
  // Calculate width based on value length
  const valueLength = (formattedValue + unit).length;
  
  // Base width calculation: minimum 120px, add ~15px per character over 8
  const baseWidth = 120;
  const charWidth = 15;
  const minChars = 8;
  const calculatedWidth = Math.max(
    baseWidth,
    baseWidth + (Math.max(0, valueLength - minChars) * charWidth)
  );
  
  // Cap at reasonable maximum
  const cardWidth = Math.min(calculatedWidth, 220);
  const formattedTarget = useMemo(() => target !== undefined && target !== null ? format(target) : null, [target, format]);

  const difference = useMemo(() => {
    if (target === undefined || target === null) return null;
    const diff = value - target;
    if (unit === '%') {
      return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    }
    return `${diff >= 0 ? '+' : ''}${format(diff)}`;
  }, [value, target, format, unit]);

  const areaChartPath = useMemo(() => {
    if (trendData.length < 2) return '';

    const chartWidth = 200;
    const chartHeight = 60;
    const padding = 5;

    const minVal = Math.min(...trendData);
    const maxVal = Math.max(...trendData);
    const range = maxVal - minVal;

    const points = trendData.map((d, i) => {
      const x = (i / (trendData.length - 1)) * (chartWidth - 2 * padding) + padding;
      const y = range === 0
        ? chartHeight / 2
        : chartHeight - ((d - minVal) / range) * (chartHeight - 2 * padding) - padding;
      return `${x},${y}`;
    });

    let path = `M${points[0]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i].split(',').map(Number);
      const [x2, y2] = points[i + 1].split(',').map(Number);
      const midX = (x1 + x2) / 2;
      path += ` Q${x1},${y1} ${midX},${y1}`;
      path += ` T${x2},${y2}`;
    }

    path += ` L${points[points.length - 1].split(',')[0]},${chartHeight}`;
    path += ` L${points[0].split(',')[0]},${chartHeight} Z`;

    return path;
  }, [trendData]);

  return (
    <div
      style={{
        position: 'relative',
        background: 'white',
        borderRadius: '8px',
        padding: isMobile ? '10px' : '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: isMobile ? '85px' : '95px',
        width: isMobile ? '100%' : `${cardWidth}px`,
        flex: isMobile ? '1 1 100%' : '0 0 auto',
      }}
    >
      {trendData.length > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '70%',
            opacity: 0.15,
            pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <path d={areaChartPath} fill={valueColor} />
          </svg>
        </div>
      )}

      {/* Icon in bottom right corner */}
      {iconName && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '8px' : '10px',
            right: isMobile ? '8px' : '10px',
            width: isMobile ? '28px' : '32px',
            height: isMobile ? '28px' : '32px',
            borderRadius: '8px',
            background: iconBgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            boxShadow: `0 2px 8px ${iconColor}26`,
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: iconColor }}>
            {iconName}
          </span>
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p
          style={{
            margin: '0 0 2px 0',
            fontSize: isMobile ? '8px' : '9px',
            fontWeight: '600',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', flexWrap: 'wrap' }}>
          <p
            style={{
              margin: 0,
              fontSize: isMobile ? '16px' : (valueLength > 15 ? '16px' : valueLength > 10 ? '18px' : '20px'),
              fontWeight: '700',
              color: valueColor,
              lineHeight: 1,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {formattedValue}
            {unit}
          </p>
        </div>

        {formattedTarget && (
          <p style={{ margin: 0, fontSize: isMobile ? '9px' : '10px', color: '#64748b' }}>
            Target: {formattedTarget}
            {unit} {difference && <span style={{ color: valueColor }}>({difference})</span>}
          </p>
        )}

        {additionalData !== undefined && additionalData !== null && (
          <p style={{ margin: '2px 0 0 0', fontSize: isMobile ? '9px' : '10px', color: '#475569' }}>
            {additionalData.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default KPICard;

