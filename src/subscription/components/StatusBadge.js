// Status Badge Component
import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status, daysRemaining = null }) => {
  const getStatusConfig = () => {
    switch (status?.toLowerCase()) {
      case 'active':
        return { className: 'status-badge-active', label: 'Active' };
      case 'trial':
        if (daysRemaining === null || daysRemaining < 0) {
          return { 
            className: 'status-badge-expired', 
            label: 'Trial Expired' 
          };
        }
        if (daysRemaining === 0) {
          return { 
            className: 'status-badge-trial', 
            label: 'Trial (Expires Today)' 
          };
        }
        return { 
          className: 'status-badge-trial', 
          label: `Trial (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left)` 
        };
      case 'pending_payment':
      case 'pending':
        return { className: 'status-badge-pending', label: 'Pending Payment' };
      case 'pending_upgrade':
        return { className: 'status-badge-pending', label: 'Pending Upgrade' };
      case 'pending_downgrade':
        return { className: 'status-badge-pending', label: 'Pending Downgrade' };
      case 'expired':
      case 'trial_expired':
        return { className: 'status-badge-expired', label: 'Expired' };
      case 'expiry_today':
        return { className: 'status-badge-warning', label: 'Expiry Today' };
      case 'expiry_tomorrow':
        return { className: 'status-badge-warning', label: 'Expiry Tomorrow' };
      case 'about_to_expire':
        return { className: 'status-badge-warning', label: 'About to Expire' };
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

