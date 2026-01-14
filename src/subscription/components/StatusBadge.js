// Status Badge Component
import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status, daysRemaining = null }) => {
  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'active':
        return { className: 'status-badge-active', label: 'Active' };
      case 'trial':
        return { 
          className: 'status-badge-trial', 
          label: daysRemaining !== null ? `Trial (${daysRemaining} days left)` : 'Trial' 
        };
      case 'pending_payment':
      case 'pending':
        return { className: 'status-badge-pending', label: 'Pending Payment' };
      case 'expired':
      case 'trial_expired':
        return { className: 'status-badge-expired', label: 'Expired' };
      default:
        return { className: 'status-badge-default', label: status || 'Unknown' };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;

