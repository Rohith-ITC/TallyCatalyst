// Usage Card Component
import React from 'react';
import './UsageCard.css';

const UsageCard = ({ 
  title, 
  current, 
  limit, 
  remaining
}) => {
  // Calculate percentage based on current/limit
  const percentage = limit ? Math.round((current / limit) * 100) : 0;
  
  const isWarning = percentage >= 80 && percentage < 95;
  const isCritical = percentage >= 95;

  const getProgressColor = () => {
    if (isCritical) return '#dc3545';
    if (isWarning) return '#ffc107';
    return '#28a745';
  };

  return (
    <div className="usage-card">
      <div className="usage-card-header">
        <h3>{title}</h3>
        <div className="usage-card-stats">
          <span className="usage-current">{current}</span>
          {limit && <span className="usage-separator">/</span>}
          {limit && <span className="usage-limit">{limit}</span>}
        </div>
      </div>

      {limit && (
        <div className="usage-progress-container">
          <div className="usage-progress-bar">
            <div
              className="usage-progress-fill"
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: getProgressColor()
              }}
            />
          </div>
          <div className="usage-progress-text">
            {remaining !== undefined && remaining >= 0 && (
              <span className="usage-remaining">{remaining} remaining</span>
            )}
            <span className="usage-percentage">{percentage}%</span>
          </div>
        </div>
      )}

      {isWarning && (
        <div className="usage-warning">
          ⚠️ Approaching limit ({percentage}% used)
        </div>
      )}

      {isCritical && (
        <div className="usage-critical">
          🚨 Limit reached! Please upgrade your plan.
        </div>
      )}
    </div>
  );
};

export default UsageCard;

