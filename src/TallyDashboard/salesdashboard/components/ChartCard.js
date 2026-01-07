import React from 'react';

/**
 * Common ChartCard component that provides consistent UI for all chart cards
 * @param {Object} props
 * @param {React.ReactNode} props.children - Chart content to render
 * @param {boolean} props.isMobile - Whether the view is mobile
 * @param {string} props.className - Additional CSS class name
 * @param {Object} props.style - Additional inline styles
 */
const ChartCard = ({ children, isMobile = false, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '400px',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: isMobile ? '12px' : '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default ChartCard;

