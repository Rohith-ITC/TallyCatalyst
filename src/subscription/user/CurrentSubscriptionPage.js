// Current Subscription Dashboard - Show user's current subscription status
import React, { useState, useEffect } from 'react';
import { getCurrentSubscription, getPendingSubscription } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
import UsageCard from '../components/UsageCard';
import './CurrentSubscriptionPage.css';

const CurrentSubscriptionPage = ({ onUpgrade, onDowngrade, onViewBilling }) => {
  const [subscription, setSubscription] = useState(null);
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both current and pending subscriptions
      const [currentData, pendingData] = await Promise.all([
        getCurrentSubscription(),
        getPendingSubscription()
      ]);
      
      console.log('📊 Current subscription:', currentData);
      console.log('📊 Pending subscription:', pendingData);
      
      setSubscription(currentData);
      setPendingSubscription(pendingData);
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
    
    // Parse the end date - handle both ISO strings and date objects
    const end = new Date(endDate);
    
    // Check if date is valid
    if (isNaN(end.getTime())) {
      console.error('Invalid end date:', endDate);
      return null;
    }
    
    const now = new Date();
    
    // Set both dates to start of day (midnight) in local timezone for accurate day comparison
    const endStartOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = endStartOfDay - nowStartOfDay;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    console.log('Date calculation:', {
      endDate,
      parsedEnd: end,
      endStartOfDay,
      nowStartOfDay,
      diffTime,
      diffDays
    });
    
    // Return the number of days (can be negative if expired)
    return diffDays;
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
          <button 
            onClick={() => {
              const basename = process.env.REACT_APP_HOMEPAGE || '';
              const path = basename ? `${basename}/admin-dashboard?view=subscription_plans&from=my_subscription` : `/admin-dashboard?view=subscription_plans&from=my_subscription`;
              window.location.href = path;
            }}
            className="purchase-button"
          >
            Subscription Plan
          </button>
        </div>
      </div>
    );
  }

  // Calculate days remaining from end_date (always calculate fresh for accuracy)
  // Only use API's days_remaining as fallback if end_date is not available
  let daysRemaining = null;
  if (subscription.end_date) {
    daysRemaining = getDaysRemaining(subscription.end_date);
  } else if (subscription.days_remaining !== undefined) {
    daysRemaining = subscription.days_remaining;
  }
  
  // For display purposes, treat negative as null
  const daysRemainingForDisplay = daysRemaining !== null && daysRemaining < 0 ? null : daysRemaining;
  
  // Debug logging
  console.log('Subscription status calculation:', {
    end_date: subscription.end_date,
    days_remaining_from_api: subscription.days_remaining,
    calculated_days_remaining: daysRemaining,
    is_trial: subscription.is_trial,
    status_from_api: subscription.status
  });
  
  // Determine actual status - check if subscription has expired
  const getActualStatus = () => {
    // If it's a trial, use the original status (no changes for trial)
    if (subscription.is_trial) {
      return subscription.status;
    }
    
    // For non-trial subscriptions, always calculate status based on days remaining from end_date
    // If we don't have daysRemaining calculated, fallback to API status
    if (daysRemaining === null || daysRemaining === undefined) {
      console.warn('Could not calculate days remaining, using API status:', subscription.status);
      return subscription.status;
    }
    
    // Check if expired (negative days)
    if (daysRemaining < 0) {
      return 'expired';
    }
    
    // If expires today (0 days remaining)
    if (daysRemaining === 0) {
      return 'expiry_today';
    }
    
    // If expires tomorrow (1 day remaining)
    if (daysRemaining === 1) {
      return 'expiry_tomorrow';
    }
    
    // If expires within 7 days (2-7 days remaining)
    if (daysRemaining > 1 && daysRemaining <= 7) {
      return 'about_to_expire';
    }
    
    // If more than 7 days remaining, show as Active
    if (daysRemaining > 7) {
      return 'active';
    }
    
    // Fallback to API status (should not reach here)
    console.warn('Unexpected daysRemaining value:', daysRemaining);
    return subscription.status;
  };
  
  const actualStatus = getActualStatus();
  
  console.log('Final status:', actualStatus, 'for daysRemaining:', daysRemaining);

  // Get current user count from subscription (for renewal, use the limit/purchased count, not current usage)
  const getCurrentUserCount = () => {
    // First check purchased_user_count (most reliable)
    if (subscription.purchased_user_count !== undefined && subscription.purchased_user_count > 0) {
      return subscription.purchased_user_count;
    }
    // If not available, use the limit from usage (this is the total purchased users)
    if (subscription.usage && subscription.usage.internal_users) {
      return subscription.usage.internal_users.limit || subscription.usage.internal_users.current || 1;
    }
    return 1;
  };

  // Handle Renewal button click
  const handleRenewal = () => {
    const currentUserCount = getCurrentUserCount();
    const billingCycle = subscription.billing_cycle || 'monthly';
    const planId = subscription.internal_slab_id;
    
    // Navigate to subscription plans with renewal parameters (will auto-show payment modal)
    const basename = process.env.REACT_APP_HOMEPAGE || '';
    const params = new URLSearchParams({
      view: 'subscription_plans',
      renewal: 'true',
      plan_id: planId || '',
      billing_cycle: billingCycle,
      user_count: currentUserCount.toString()
    });
    const path = basename 
      ? `${basename}/admin-dashboard?${params.toString()}` 
      : `/admin-dashboard?${params.toString()}`;
    window.location.href = path;
  };

  // Handle Increase Users button click
  const handleIncreaseUsers = () => {
    const currentUserCount = getCurrentUserCount();
    const billingCycle = subscription.billing_cycle || 'monthly';
    const planId = subscription.internal_slab_id;
    const endDate = subscription.end_date;
    
    // Navigate to subscription plans with increase users parameters
    const basename = process.env.REACT_APP_HOMEPAGE || '';
    const params = new URLSearchParams({
      view: 'subscription_plans',
      increase_users: 'true',
      plan_id: planId || '',
      billing_cycle: billingCycle,
      user_count: currentUserCount.toString(),
      end_date: endDate || ''
    });
    const path = basename 
      ? `${basename}/admin-dashboard?${params.toString()}` 
      : `/admin-dashboard?${params.toString()}`;
    window.location.href = path;
  };

  // Determine which buttons to show based on subscription state
  const shouldShowButtons = () => {
    // If trial: Show only "Subscription Plan" button
    if (subscription.is_trial) {
      return {
        showRenewal: false,
        showIncreaseUsers: false,
        showSubscriptionPlan: true
      };
    }
    
    // If not trial and has validity (not expired)
    if (!subscription.is_trial && daysRemainingForDisplay !== null && daysRemainingForDisplay >= 0) {
      return {
        showRenewal: true,
        showIncreaseUsers: true,
        showSubscriptionPlan: true // Always show Subscription Plan button
      };
    }
    
    // If expired, show renewal button
    if (!subscription.is_trial && (daysRemainingForDisplay === null || daysRemainingForDisplay < 0)) {
      return {
        showRenewal: true,
        showIncreaseUsers: false,
        showSubscriptionPlan: true // Always show Subscription Plan button
      };
    }
    
    return {
      showRenewal: false,
      showIncreaseUsers: false,
      showSubscriptionPlan: true // Always show Subscription Plan button
    };
  };

  const buttonConfig = shouldShowButtons();

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
                status={actualStatus} 
                daysRemaining={subscription.is_trial ? daysRemainingForDisplay : null}
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
              <span className="detail-label">Subscription Valid till:</span>
              <span className="detail-value">{formatDate(subscription.end_date)}</span>
            </div>

            {subscription.is_trial && (
              <div className="detail-row">
                <span className="detail-label">Trial Status:</span>
                <span className={`detail-value ${daysRemainingForDisplay === null ? 'expired' : daysRemainingForDisplay === 0 ? 'warning' : 'highlight'}`}>
                  {daysRemainingForDisplay === null 
                    ? 'Trial Expired' 
                    : daysRemainingForDisplay === 0
                    ? 'Expires Today'
                    : `${daysRemainingForDisplay} ${daysRemainingForDisplay === 1 ? 'day' : 'days'} remaining`}
                </span>
              </div>
            )}

            {/* Show purchased user count if available */}
            {subscription.purchased_user_count !== undefined && (
              <div className="detail-row">
                <span className="detail-label">Purchased Users:</span>
                <span className="detail-value">{subscription.purchased_user_count}</span>
              </div>
            )}

            {/* Show wallet balance only when user has balance */}
            {subscription.wallet_balance !== undefined && subscription.wallet_balance > 0 && (
              <div className="detail-row">
                <span className="detail-label">Wallet Balance:</span>
                <span className="detail-value highlight">₹{subscription.wallet_balance.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Pending Subscription Section */}
          {pendingSubscription && (
            <div className="pending-subscription-section">
              <div className="pending-subscription-header">
                <h3>Pending Subscription Change</h3>
                <StatusBadge status={pendingSubscription.status} />
              </div>
              <div className="pending-subscription-details">
                {pendingSubscription.new_slab && (
                  <div className="detail-row">
                    <span className="detail-label">New Plan:</span>
                    <span className="detail-value">
                      {pendingSubscription.new_slab.name || `Slab ${pendingSubscription.new_slab.id}`}
                    </span>
                  </div>
                )}
                {pendingSubscription.previous_slab && (
                  <div className="detail-row">
                    <span className="detail-label">Current Plan:</span>
                    <span className="detail-value">
                      {pendingSubscription.previous_slab.name || `Slab ${pendingSubscription.previous_slab.id}`}
                    </span>
                  </div>
                )}
                {pendingSubscription.purchased_user_count !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Selected Users:</span>
                    <span className="detail-value">{pendingSubscription.purchased_user_count}</span>
                  </div>
                )}
                {pendingSubscription.credit_amount !== null && pendingSubscription.credit_amount !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Credit Amount:</span>
                    <span className="detail-value highlight">₹{pendingSubscription.credit_amount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="pending-note">
                  <p>
                    Your subscription change is pending approval. 
                    {subscription ? ' Your current plan remains active until approval.' : ' You will be notified once approved.'}
                  </p>
                </div>
              </div>
            </div>
          )}
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
                
                // Calculate total free external users allocation
                // The limit should be ONLY free external users, not including internal users
                // If freeAvailable + freeUsed includes internal users (e.g., 43 = 3 internal + 40 free external),
                // we need to recalculate based on purchased_user_count only
                const purchasedUserCount = subscription.purchased_user_count || 
                  (subscription.usage?.internal_users?.limit || 0);
                const freeExternalPerInternal = 10; // Default: 10 free external users per internal user
                
                // Calculate expected limit: purchased users * free external per internal
                const expectedFreeExternalLimit = purchasedUserCount * freeExternalPerInternal;
                
                // If the API returns a limit that seems to include internal users (limit > expected),
                // use the expected limit instead
                const calculatedLimit = freeAvailable + freeUsed;
                const limit = (calculatedLimit > expectedFreeExternalLimit && purchasedUserCount > 0) 
                  ? expectedFreeExternalLimit 
                  : calculatedLimit;
                
                // Calculate remaining: limit - current (not just freeAvailable)
                // remaining should be the total remaining external users (limit - current)
                const remaining = Math.max(0, limit - current);
                
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

      {(buttonConfig.showRenewal || buttonConfig.showIncreaseUsers || buttonConfig.showSubscriptionPlan) && (
        <div className="subscription-actions">
          {buttonConfig.showSubscriptionPlan && (
            <button 
              onClick={() => {
                const basename = process.env.REACT_APP_HOMEPAGE || '';
                const path = basename ? `${basename}/admin-dashboard?view=subscription_plans&from=my_subscription` : `/admin-dashboard?view=subscription_plans&from=my_subscription`;
                window.location.href = path;
              }}
              className="action-button action-button-primary"
            >
              Subscription Plan
            </button>
          )}
          {buttonConfig.showRenewal && (
            <button 
              onClick={handleRenewal}
              className="action-button action-button-primary"
            >
              Renewal
            </button>
          )}
          {buttonConfig.showIncreaseUsers && (
            <button 
              onClick={handleIncreaseUsers}
              className="action-button action-button-secondary"
            >
              Upgrade/Downgrade
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrentSubscriptionPage;

