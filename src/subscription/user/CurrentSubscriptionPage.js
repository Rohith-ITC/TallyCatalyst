// Current Subscription Dashboard - Show user's current subscription status
import React, { useState, useEffect } from 'react';
import { getCurrentSubscription } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
import UsageCard from '../components/UsageCard';
import './CurrentSubscriptionPage.css';

const CurrentSubscriptionPage = ({ onUpgrade, onDowngrade, onViewBilling }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentSubscription();
      console.log('📊 Subscription data received:', data);
      console.log('📊 External users data:', data?.usage?.external_users);
      setSubscription(data);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError('Failed to load subscription details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysRemaining = (endDate) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="current-subscription-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="current-subscription-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchSubscription} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="current-subscription-page">
        <div className="no-subscription-container">
          <h2>No Active Subscription</h2>
          <p>You don't have an active subscription. Please purchase a plan to continue.</p>
          {onUpgrade && (
            <button onClick={() => onUpgrade()} className="purchase-button">
              Purchase Plan
            </button>
          )}
        </div>
      </div>
    );
  }

  const daysRemaining = subscription.days_remaining !== undefined 
    ? subscription.days_remaining 
    : getDaysRemaining(subscription.end_date);

  return (
    <div className="current-subscription-page">
      <div className="subscription-page-header">
        <h1>My Subscription</h1>
      </div>

      <div className="subscription-cards-container">
        <div className="subscription-status-card">
          <div className="status-card-header">
            <div>
              <h2>Subscription Status</h2>
              <StatusBadge 
                status={subscription.status} 
                daysRemaining={subscription.is_trial ? daysRemaining : null}
              />
            </div>
          </div>

          <div className="status-card-details">
            <div className="detail-row">
              <span className="detail-label">Plan:</span>
              <span className="detail-value">{subscription.internal_slab_name || (subscription.internal_slab_id ? `Slab ${subscription.internal_slab_id}` : 'N/A')}</span>
            </div>
            
            <div className="detail-row">
              <span className="detail-label">Billing Cycle:</span>
              <span className="detail-value">
                {subscription.billing_cycle ? subscription.billing_cycle.charAt(0).toUpperCase() + subscription.billing_cycle.slice(1) : 'N/A'}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Start Date:</span>
              <span className="detail-value">{formatDate(subscription.start_date)}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">End Date:</span>
              <span className="detail-value">{formatDate(subscription.end_date)}</span>
            </div>

            {subscription.is_trial && daysRemaining !== null && (
              <div className="detail-row">
                <span className="detail-label">Trial Days Remaining:</span>
                <span className="detail-value highlight">{daysRemaining} days</span>
              </div>
            )}

            {!subscription.is_trial && subscription.end_date && (
              <div className="detail-row">
                <span className="detail-label">Renewal Date:</span>
                <span className="detail-value">{formatDate(subscription.end_date)}</span>
              </div>
            )}
          </div>
        </div>

        {subscription.usage && (
          <div className="usage-section-card">
            <div className="usage-section-header">
              <h2>Usage Statistics</h2>
            </div>
            <div className="usage-cards-container">
              {subscription.usage.internal_users && (
                <UsageCard
                  title="Internal Users"
                  current={subscription.usage.internal_users.current}
                  limit={subscription.usage.internal_users.limit}
                  remaining={subscription.usage.internal_users.remaining}
                />
              )}
              {subscription.usage.external_users && typeof subscription.usage.external_users === 'object' && (() => {
                const freeUsed = subscription.usage.external_users.free_used ?? 0;
                const freeAvailable = subscription.usage.external_users.free_available ?? 0;
                const paidCount = subscription.usage.external_users.paid_count ?? 0;
                const current = freeUsed + paidCount;
                const limit = freeAvailable + freeUsed; // Total free allocation
                const remaining = freeAvailable;
                
                return (
                  <UsageCard
                    title="External Users"
                    current={current}
                    limit={limit}
                    remaining={remaining}
                  />
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {(onUpgrade || (onDowngrade && subscription.status === 'active') || onViewBilling) && (
        <div className="subscription-actions">
          {onUpgrade && (
            <button onClick={() => onUpgrade()} className="action-button action-button-primary">
              Upgrade Plan
            </button>
          )}
          
          {onDowngrade && subscription.status === 'active' && (
            <button onClick={() => onDowngrade()} className="action-button action-button-secondary">
              Downgrade Plan
            </button>
          )}
          
          {onViewBilling && (
            <button onClick={() => onViewBilling()} className="action-button action-button-outline">
              View Billing History
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentSubscriptionPage;

