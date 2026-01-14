// Partner Portal Dashboard - Partner view of referrals and commissions
import React, { useState, useEffect } from 'react';
import { getPartnerDashboard } from '../api/subscriptionApi';
import './PartnerDashboardPage.css';

const PartnerDashboardPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPartnerDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching partner dashboard:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="partner-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="partner-dashboard-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchDashboard} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="partner-dashboard-page">
        <div className="no-data-container">
          <p>No dashboard data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="partner-dashboard-page">
      <div className="dashboard-header">
        <h1>Partner Dashboard</h1>
        <p>Welcome, {dashboardData.partner_name || 'Partner'}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Customers</div>
          <div className="stat-value">{dashboardData.total_customers || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Customers</div>
          <div className="stat-value">{dashboardData.active_customers || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiring Soon</div>
          <div className="stat-value">{dashboardData.expiring_soon || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expired</div>
          <div className="stat-value">{dashboardData.expired || 0}</div>
        </div>
      </div>

      <div className="commission-section">
        <h2>Commission Summary</h2>
        <div className="commission-grid">
          <div className="commission-card">
            <div className="commission-label">Total Commissions</div>
            <div className="commission-value">{formatCurrency(dashboardData.total_commissions || 0)}</div>
          </div>
          <div className="commission-card">
            <div className="commission-label">Pending Commissions</div>
            <div className="commission-value">{formatCurrency(dashboardData.pending_commissions || 0)}</div>
          </div>
          <div className="commission-card">
            <div className="commission-label">Paid Commissions</div>
            <div className="commission-value">{formatCurrency(dashboardData.paid_commissions || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerDashboardPage;

