// Usage Dashboard Page - Show current usage and limits
import React, { useState, useEffect } from 'react';
import { getCurrentUsage, validateUserAddition } from '../api/subscriptionApi';
import UsageCard from '../components/UsageCard';
import './UsageDashboardPage.css';

const UsageDashboardPage = ({ onAddUser, onUpgrade }) => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentUsage();
      setUsage(data);
    } catch (err) {
      console.error('Error fetching usage:', err);
      setError('Failed to load usage statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userType) => {
    try {
      const validation = await validateUserAddition(userType, 1);
      
      if (validation.allowed) {
        if (onAddUser) {
          onAddUser(userType);
        }
      } else {
        if (validation.requires_upgrade && onUpgrade) {
          if (window.confirm(`${validation.reason}\n\nWould you like to upgrade your plan?`)) {
            onUpgrade();
          }
        } else {
          alert(validation.reason);
        }
      }
    } catch (err) {
      console.error('Error validating user addition:', err);
      alert('Failed to validate user addition. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="usage-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading usage statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="usage-dashboard-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchUsage} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="usage-dashboard-page">
        <div className="no-usage-container">
          <h2>No Usage Data Available</h2>
          <p>Unable to load usage statistics. Please try again later.</p>
        </div>
      </div>
    );
  }

  const internalUsers = usage.internal_users;

  const canAddInternalUser = internalUsers && internalUsers.remaining > 0;

  return (
    <div className="usage-dashboard-page">
      <div className="usage-page-header">
        <h1>Usage Dashboard</h1>
        <p>Monitor your subscription usage and limits</p>
      </div>

      <div className="usage-cards-section">
        {internalUsers && (
          <div className="usage-card-wrapper">
            <UsageCard
              title="Internal Users"
              current={internalUsers.current}
              limit={internalUsers.limit}
              remaining={internalUsers.remaining}
            />
            <div className="usage-actions">
              <button
                className={`add-user-button ${canAddInternalUser ? '' : 'disabled'}`}
                onClick={() => handleAddUser('internal')}
                disabled={!canAddInternalUser}
              >
                {canAddInternalUser ? 'Add Internal User' : 'Limit Reached'}
              </button>
              {!canAddInternalUser && onUpgrade && (
                <button
                  className="upgrade-button"
                  onClick={onUpgrade}
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="usage-info-section">
        <h2>Usage Information</h2>
        <div className="info-cards">
          {internalUsers && (
            <div className="info-card">
              <h3>Internal Users</h3>
              <p>Internal users have full access to all features and can manage the subscription.</p>
              <ul>
                <li>Current: {internalUsers.current} users</li>
                <li>Limit: {internalUsers.limit} users</li>
                <li>Remaining: {internalUsers.remaining} users</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsageDashboardPage;

