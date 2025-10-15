import React from 'react';

const MetricCard = ({ title, value, icon: Icon, subtitle, color = 'blue' }) => {
  const colorStyles = {
    blue: { background: '#dbeafe', color: '#3b82f6' },
    green: { background: '#dcfce7', color: '#16a34a' },
    orange: { background: '#fed7aa', color: '#ea580c' },
    purple: { background: '#e9d5ff', color: '#9333ea' },
  };

  const iconStyle = colorStyles[color] || colorStyles.blue;

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'all 0.2s ease'
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </p>
        <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
          {value}
        </p>
        {subtitle && (
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: iconStyle.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span className="material-icons" style={{ fontSize: '24px', color: iconStyle.color }}>
          {Icon}
        </span>
      </div>
    </div>
  );
};

export default MetricCard;
