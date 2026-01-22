// User Summary Page - View comprehensive user summary report (Superadmin only)
import React, { useState, useEffect } from 'react';
import { getUserSummary } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
import * as XLSX from 'xlsx';
import './PaymentValidationPage.css';

const UserSummaryPage = () => {
  const [userSummary, setUserSummary] = useState([]);
  const [filters, setFilters] = useState({
    limit: 100,
    offset: 0,
    status: '',
    partner_id: '',
    employee_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUserSummary();
  }, [filters]);

  const fetchUserSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUserSummary(filters);
      setUserSummary(data);
    } catch (err) {
      console.error('Error fetching user summary:', err);
      setError('Failed to load user summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (user) => {
    setSelectedUser(user);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToExcel = () => {
    if (userSummary.length === 0) {
      alert('No data to export.');
      return;
    }

    // Prepare data for Excel export
    const excelData = userSummary.map(user => ({
      'User ID': user.user_id || 'N/A',
      'User Name': user.user_name || 'N/A',
      'Email': user.user_email || 'N/A',
      'Mobile': user.mobileno || 'N/A',
      'User Active': user.user_active ? 'Yes' : 'No',
      'User Created At': formatDateTime(user.user_created_at),
      'Subscription ID': user.subscription_id || 'N/A',
      'Subscription Status': user.subscription_status || 'N/A',
      'Subscription Start Date': formatDate(user.subscription_start_date),
      'Subscription End Date': formatDate(user.subscription_end_date),
      'Billing Cycle': user.billing_cycle || 'N/A',
      'Is Trial': user.is_trial ? 'Yes' : 'No',
      'Trial Start Date': formatDate(user.trial_start_date),
      'Trial End Date': formatDate(user.trial_end_date),
      'Plan Name': user.plan_name || 'N/A',
      'Plan Max Users': user.plan_max_users || 'N/A',
      'Plan Min Users': user.plan_min_users || 'N/A',
      'Monthly Price': user.monthly_price || 0,
      'Yearly Price': user.yearly_price || 0,
      'Free External Users per Internal': user.free_external_users_per_internal_user || 'N/A',
      'Purchased User Count': user.purchased_user_count || 0,
      'Actual Internal Users': user.actual_internal_users || 0,
      'Actual External Users': user.actual_external_users || 0,
      'Partner ID': user.partner ? user.partner.partner_id : 'N/A',
      'Partner Name': user.partner ? user.partner.partner_name : 'N/A',
      'Partner Code': user.partner ? user.partner.partner_code : 'N/A',
      'Employee ID': user.employee ? user.employee.employee_id : 'N/A',
      'Employee Name': user.employee ? user.employee.employee_name : 'N/A',
      'Employee Code': user.employee ? user.employee.employee_code : 'N/A',
      'Wallet Balance': user.wallet_balance || 0,
      'Last Payment Invoice': user.last_payment ? user.last_payment.invoice_number : 'N/A',
      'Last Payment Date': user.last_payment ? formatDate(user.last_payment.payment_date) : 'N/A',
      'Last Payment Method': user.last_payment ? (user.last_payment.payment_method ? user.last_payment.payment_method.replace('_', ' ').toUpperCase() : 'N/A') : 'N/A',
      'Last Payment Reference': user.last_payment ? user.last_payment.payment_reference : 'N/A',
      'Last Payment Total Amount': user.last_payment ? user.last_payment.total_amount : 0,
      'Last Payment Wallet Utilized': user.last_payment ? user.last_payment.wallet_utilized_amount : 0,
      'Last Payment Net Paid': user.last_payment ? user.last_payment.net_paid_amount : 0,
      'Last Payment Validated At': user.last_payment ? formatDateTime(user.last_payment.validated_at) : 'N/A'
    }));

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'User Summary');

    // Set column widths
    const colWidths = [
      { wch: 10 }, // User ID
      { wch: 20 }, // User Name
      { wch: 30 }, // Email
      { wch: 15 }, // Mobile
      { wch: 12 }, // User Active
      { wch: 20 }, // User Created At
      { wch: 15 }, // Subscription ID
      { wch: 18 }, // Subscription Status
      { wch: 20 }, // Subscription Start Date
      { wch: 20 }, // Subscription End Date
      { wch: 15 }, // Billing Cycle
      { wch: 10 }, // Is Trial
      { wch: 18 }, // Trial Start Date
      { wch: 18 }, // Trial End Date
      { wch: 18 }, // Plan Name
      { wch: 15 }, // Plan Max Users
      { wch: 15 }, // Plan Min Users
      { wch: 15 }, // Monthly Price
      { wch: 15 }, // Yearly Price
      { wch: 25 }, // Free External Users per Internal
      { wch: 20 }, // Purchased User Count
      { wch: 20 }, // Actual Internal Users
      { wch: 20 }, // Actual External Users
      { wch: 12 }, // Partner ID
      { wch: 20 }, // Partner Name
      { wch: 15 }, // Partner Code
      { wch: 12 }, // Employee ID
      { wch: 20 }, // Employee Name
      { wch: 15 }, // Employee Code
      { wch: 15 }, // Wallet Balance
      { wch: 20 }, // Last Payment Invoice
      { wch: 18 }, // Last Payment Date
      { wch: 18 }, // Last Payment Method
      { wch: 20 }, // Last Payment Reference
      { wch: 20 }, // Last Payment Total Amount
      { wch: 22 }, // Last Payment Wallet Utilized
      { wch: 20 }, // Last Payment Net Paid
      { wch: 22 }  // Last Payment Validated At
    ];
    ws['!cols'] = colWidths;

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `User_Summary_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  if (loading && userSummary.length === 0) {
    return (
      <div className="payment-validation-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading user summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-validation-page">
      <div className="validation-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h1>User Summary</h1>
          {userSummary.length > 0 && (
            <button
              onClick={exportToExcel}
              className="export-excel-button"
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#218838';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#28a745';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
              Export to Excel
            </button>
          )}
        </div>
        <p>Comprehensive overview of all users with subscription and payment details</p>
      </div>

      <div className="validation-filters">
        <div className="filter-group">
          <label htmlFor="status">Subscription Status:</label>
          <select
            id="status"
            name="status"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="limit">Results per page:</label>
          <select
            id="limit"
            name="limit"
            value={filters.limit}
            onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchUserSummary} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {userSummary.length === 0 && !loading ? (
        <div className="no-payments-container">
          <p>No users found.</p>
        </div>
      ) : (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Purchased Users</th>
                <th>Actual Internal</th>
                <th>Actual External</th>
                <th>Subscription Period</th>
                <th>Wallet Balance</th>
                <th>Last Payment</th>
                <th>Partner/Employee</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {userSummary.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.user_id}</td>
                  <td>{user.user_name || 'N/A'}</td>
                  <td>{user.user_email || 'N/A'}</td>
                  <td>{user.mobileno || 'N/A'}</td>
                  <td>
                    {user.plan_name ? (
                      <div>
                        <div style={{ fontWeight: 600 }}>{user.plan_name}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          Max: {user.plan_max_users || 'N/A'}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>No Plan</span>
                    )}
                  </td>
                  <td>
                    {user.subscription_status ? (
                      <StatusBadge status={user.subscription_status} />
                    ) : (
                      <span style={{ color: '#999' }}>No Subscription</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <div>{user.purchased_user_count || 0}</div>
                      {user.plan_max_users && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          / {user.plan_max_users} max
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{user.actual_internal_users || 0}</td>
                  <td>{user.actual_external_users || 0}</td>
                  <td>
                    {user.subscription_start_date && user.subscription_end_date ? (
                      <div style={{ fontSize: '13px' }}>
                        <div>{formatDate(user.subscription_start_date)}</div>
                        <div style={{ color: '#666' }}>to {formatDate(user.subscription_end_date)}</div>
                        {user.is_trial && (
                          <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '2px' }}>
                            Trial
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>N/A</span>
                    )}
                  </td>
                  <td>
                    {user.wallet_balance > 0 ? (
                      <span style={{ color: '#28a745', fontWeight: 600 }}>
                        {formatCurrency(user.wallet_balance)}
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>{formatCurrency(0)}</span>
                    )}
                  </td>
                  <td>
                    {user.last_payment ? (
                      <div style={{ fontSize: '13px' }}>
                        <div style={{ fontWeight: 600 }}>{formatCurrency(user.last_payment.net_paid_amount || 0)}</div>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          {formatDate(user.last_payment.payment_date)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>No Payment</span>
                    )}
                  </td>
                  <td>
                    {user.partner ? (
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#007bff' }}>Partner</div>
                        <div>{user.partner.partner_name}</div>
                        <div style={{ color: '#666', fontSize: '11px' }}>{user.partner.partner_code}</div>
                      </div>
                    ) : user.employee ? (
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#28a745' }}>Employee</div>
                        <div>{user.employee.employee_name}</div>
                        <div style={{ color: '#666', fontSize: '11px' }}>{user.employee.employee_code}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="view-button"
                      onClick={() => handleViewDetails(user)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUser && (
        <div className="payment-modal">
          <div className="payment-modal-content">
            <div className="payment-modal-header">
              <h2>User Details</h2>
              <button
                className="close-button"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>
            <div className="payment-modal-body">
              <div className="payment-section">
                <h3 className="payment-section-title">User Information</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">User ID:</span>
                  <span className="payment-detail-value">{selectedUser.user_id}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Name:</span>
                  <span className="payment-detail-value">{selectedUser.user_name || 'N/A'}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Email:</span>
                  <span className="payment-detail-value">{selectedUser.user_email || 'N/A'}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Mobile:</span>
                  <span className="payment-detail-value">{selectedUser.mobileno || 'N/A'}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Active:</span>
                  <span className="payment-detail-value">
                    {selectedUser.user_active ? (
                      <span style={{ color: '#28a745', fontWeight: 600 }}>Yes</span>
                    ) : (
                      <span style={{ color: '#dc3545', fontWeight: 600 }}>No</span>
                    )}
                  </span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Created At:</span>
                  <span className="payment-detail-value">{formatDateTime(selectedUser.user_created_at)}</span>
                </div>
              </div>

              {selectedUser.subscription_id && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Subscription Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Subscription ID:</span>
                    <span className="payment-detail-value">{selectedUser.subscription_id}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Status:</span>
                    <span className="payment-detail-value">
                      <StatusBadge status={selectedUser.subscription_status} />
                    </span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Start Date:</span>
                    <span className="payment-detail-value">{formatDate(selectedUser.subscription_start_date)}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">End Date:</span>
                    <span className="payment-detail-value">{formatDate(selectedUser.subscription_end_date)}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Billing Cycle:</span>
                    <span className="payment-detail-value">
                      {selectedUser.billing_cycle ? selectedUser.billing_cycle.charAt(0).toUpperCase() + selectedUser.billing_cycle.slice(1) : 'N/A'}
                    </span>
                  </div>
                  {selectedUser.is_trial && (
                    <>
                      <div className="payment-detail-row">
                        <span className="payment-detail-label">Trial Start:</span>
                        <span className="payment-detail-value">{formatDate(selectedUser.trial_start_date)}</span>
                      </div>
                      <div className="payment-detail-row">
                        <span className="payment-detail-label">Trial End:</span>
                        <span className="payment-detail-value">{formatDate(selectedUser.trial_end_date)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {selectedUser.plan_name && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Plan Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Plan Name:</span>
                    <span className="payment-detail-value">{selectedUser.plan_name}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Max Users:</span>
                    <span className="payment-detail-value">{selectedUser.plan_max_users || 'N/A'}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Min Users:</span>
                    <span className="payment-detail-value">{selectedUser.plan_min_users || 'N/A'}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Monthly Price:</span>
                    <span className="payment-detail-value">{formatCurrency(selectedUser.monthly_price || 0)}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Yearly Price:</span>
                    <span className="payment-detail-value">{formatCurrency(selectedUser.yearly_price || 0)}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Free External Users per Internal:</span>
                    <span className="payment-detail-value">{selectedUser.free_external_users_per_internal_user || 'N/A'}</span>
                  </div>
                </div>
              )}

              <div className="payment-section">
                <h3 className="payment-section-title">User Counts</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Purchased User Count:</span>
                  <span className="payment-detail-value">{selectedUser.purchased_user_count || 0}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Actual Internal Users:</span>
                  <span className="payment-detail-value">{selectedUser.actual_internal_users || 0}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Actual External Users:</span>
                  <span className="payment-detail-value">{selectedUser.actual_external_users || 0}</span>
                </div>
              </div>

              <div className="payment-section">
                <h3 className="payment-section-title">Wallet Information</h3>
                <div className="payment-detail-row highlight">
                  <span className="payment-detail-label">Wallet Balance:</span>
                  <span className="payment-detail-value" style={{ color: '#28a745', fontWeight: 700, fontSize: '18px' }}>
                    {formatCurrency(selectedUser.wallet_balance || 0)}
                  </span>
                </div>
              </div>

              {selectedUser.partner && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Partner Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Partner ID:</span>
                    <span className="payment-detail-value">{selectedUser.partner.partner_id}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Partner Name:</span>
                    <span className="payment-detail-value">{selectedUser.partner.partner_name}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Partner Code:</span>
                    <span className="payment-detail-value">{selectedUser.partner.partner_code}</span>
                  </div>
                </div>
              )}

              {selectedUser.employee && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Employee Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Employee ID:</span>
                    <span className="payment-detail-value">{selectedUser.employee.employee_id}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Employee Name:</span>
                    <span className="payment-detail-value">{selectedUser.employee.employee_name}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Employee Code:</span>
                    <span className="payment-detail-value">{selectedUser.employee.employee_code}</span>
                  </div>
                </div>
              )}

              {selectedUser.last_payment && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Last Payment Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Invoice Number:</span>
                    <span className="payment-detail-value">{selectedUser.last_payment.invoice_number}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Payment Date:</span>
                    <span className="payment-detail-value">{formatDate(selectedUser.last_payment.payment_date)}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Payment Method:</span>
                    <span className="payment-detail-value">
                      {selectedUser.last_payment.payment_method ? selectedUser.last_payment.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}
                    </span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Payment Reference:</span>
                    <span className="payment-detail-value">{selectedUser.last_payment.payment_reference}</span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Total Amount:</span>
                    <span className="payment-detail-value">{formatCurrency(selectedUser.last_payment.total_amount || 0)}</span>
                  </div>
                  {selectedUser.last_payment.wallet_utilized_amount > 0 && (
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Wallet Utilized:</span>
                      <span className="payment-detail-value" style={{ color: '#28a745' }}>
                        {formatCurrency(selectedUser.last_payment.wallet_utilized_amount)}
                      </span>
                    </div>
                  )}
                  <div className="payment-detail-row highlight">
                    <span className="payment-detail-label">Net Paid Amount:</span>
                    <span className="payment-detail-value" style={{ color: '#007bff', fontWeight: 700, fontSize: '18px' }}>
                      {formatCurrency(selectedUser.last_payment.net_paid_amount || 0)}
                    </span>
                  </div>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Validated At:</span>
                    <span className="payment-detail-value">{formatDateTime(selectedUser.last_payment.validated_at)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSummaryPage;

