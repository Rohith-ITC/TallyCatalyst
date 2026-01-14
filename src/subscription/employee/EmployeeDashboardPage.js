// Employee Portal Dashboard - Employee view of subscriptions and performance
import React, { useState, useEffect } from 'react';
import { getEmployeeDashboard } from '../api/subscriptionApi';
import './EmployeeDashboardPage.css';

const EmployeeDashboardPage = () => {
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
      const data = await getEmployeeDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching employee dashboard:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="employee-dashboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-dashboard-page">
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
      <div className="employee-dashboard-page">
        <div className="no-data-container">
          <p>No dashboard data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-dashboard-page">
      <div className="dashboard-header">
        <h1>Employee Dashboard</h1>
        <p>Welcome, {dashboardData.employee_name || 'Employee'}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Subscriptions</div>
          <div className="stat-value">{dashboardData.total_subscriptions || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Subscriptions</div>
          <div className="stat-value">{dashboardData.active_subscriptions || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiring Soon</div>
          <div className="stat-value">{dashboardData.expiring_soon || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expired</div>
          <div className="stat-value">{dashboardData.expired || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Current Month</div>
          <div className="stat-value">{dashboardData.current_month_subscriptions || 0}</div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboardPage;

