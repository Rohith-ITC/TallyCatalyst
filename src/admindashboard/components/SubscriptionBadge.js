import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSubscriptionStatus, getTrialDaysRemaining } from '../../utils/subscriptionUtils';
import { apiGet } from '../../utils/apiUtils';

function SubscriptionBadge() {
  const [subscription, setSubscription] = useState(null);
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const [subData, countData] = await Promise.all([
        checkSubscriptionStatus(),
        apiGet('/api/subscription/user-count')
      ]);
      
      setSubscription(subData);
      setUserCount(countData);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !subscription) {
    return null;
  }

  const { planName, status, isTrial, total_user_limit, trialEndDate } = subscription;
  const currentUsers = userCount?.count || 0;
  const usagePercent = total_user_limit > 0 ? (currentUsers / total_user_limit) * 100 : 0;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = currentUsers >= total_user_limit;
  
  const daysRemaining = isTrial ? getTrialDaysRemaining(trialEndDate) : null;

  const getStatusColor = () => {
    if (isTrial) return '#f59e0b';
    if (isAtLimit) return '#ef4444';
    if (isNearLimit) return '#f59e0b';
    if (status === 'active') return '#22c55e';
    return '#64748b';
  };

  const getStatusText = () => {
    if (isTrial) return `Trial - ${daysRemaining} days left`;
    if (isAtLimit) return 'Limit Reached';
    if (isNearLimit) return 'Near Limit';
    return planName || 'Active';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        background: isAtLimit ? '#fef2f2' : isNearLimit ? '#fef3c7' : '#f0f9ff',
        border: `1px solid ${isAtLimit ? '#fecaca' : isNearLimit ? '#fde68a' : '#bae6fd'}`,
        borderRadius: 20,
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginRight: 16
      }}
      onClick={() => navigate('/admin-dashboard?view=subscription')}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title="View Subscription Details"
    >
      {/* Status Indicator */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: getStatusColor(),
          boxShadow: `0 0 8px ${getStatusColor()}40`
        }}
      />
      
      {/* Plan Name / Status */}
      <span style={{
        fontSize: 14,
        fontWeight: 600,
        color: '#1e293b'
      }}>
        {getStatusText()}
      </span>

      {/* User Count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        background: '#fff',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color: isAtLimit ? '#dc2626' : isNearLimit ? '#d97706' : '#0369a1'
      }}>
        <span className="material-icons" style={{ fontSize: 16 }}>people</span>
        <span>{currentUsers}/{total_user_limit}</span>
      </div>

      {/* Warning Icon if at limit */}
      {isAtLimit && (
        <span className="material-icons" style={{ 
          fontSize: 18, 
          color: '#dc2626' 
        }}>warning</span>
      )}
    </div>
  );
}

export default SubscriptionBadge;

