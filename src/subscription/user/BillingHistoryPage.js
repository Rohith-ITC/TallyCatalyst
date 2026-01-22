// Billing History Page - Display all billing records and invoices
import React, { useState, useEffect } from 'react';
import { getBillingHistory, getInvoice } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
import * as XLSX from 'xlsx';
import './BillingHistoryPage.css';

const BillingHistoryPage = ({ onViewInvoice }) => {
  const [billingHistory, setBillingHistory] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    limit: 50,
    offset: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    fetchBillingHistory();
  }, [filters]);

  const fetchBillingHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBillingHistory(filters);
      setBillingHistory(data);
    } catch (err) {
      console.error('Error fetching billing history:', err);
      setError('Failed to load billing history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
      offset: 0 // Reset offset when filter changes
    }));
  };

  const handleViewInvoice = (billingId) => {
    // Use the billing record directly from the table since we already have all the data
    const billingRecord = billingHistory.find(b => b.id === billingId);
    if (billingRecord) {
      setSelectedInvoice(billingRecord);
      if (onViewInvoice) {
        onViewInvoice(billingRecord);
      }
    } else {
      // Fallback: try to fetch from API if not found in current list
      getInvoice(billingId)
        .then(invoice => {
          if (invoice && invoice.data) {
            setSelectedInvoice(invoice.data);
            if (onViewInvoice) {
              onViewInvoice(invoice.data);
            }
          } else if (invoice) {
            setSelectedInvoice(invoice);
            if (onViewInvoice) {
              onViewInvoice(invoice);
            }
          } else {
            alert('Invoice details not found.');
          }
        })
        .catch(err => {
          console.error('Error fetching invoice:', err);
          alert('Failed to load invoice details.');
        });
    }
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

  const getChangeTypeLabel = (changeType) => {
    const labels = {
      'purchase': 'Purchase',
      'upgrade': 'Upgrade',
      'downgrade': 'Downgrade',
      'renewal': 'Renewal',
      'initial': 'Initial'
    };
    return labels[changeType] || changeType || 'N/A';
  };

  const exportToExcel = () => {
    if (billingHistory.length === 0) {
      alert('No data to export.');
      return;
    }

    // Prepare data for Excel export
    const excelData = billingHistory.map(billing => ({
      'Invoice Number': billing.invoice_number || 'N/A',
      'Date': formatDate(billing.payment_date || billing.billing_period_start),
      'Billing Period Start': formatDate(billing.billing_period_start),
      'Billing Period End': formatDate(billing.billing_period_end),
      'Plan Name': billing.slab_name || 'N/A',
      'User Count': billing.user_count || 0,
      'Total Amount': billing.total_amount || 0,
      'Wallet Utilized': billing.wallet_utilized_amount || 0,
      'Actual Paid Amount': billing.actual_paid_amount || 0,
      'Status': billing.status || 'N/A',
      'Payment Method': billing.payment_method || 'N/A',
      'Payment Reference': billing.payment_reference || 'N/A',
      'Payment Date': formatDate(billing.payment_date),
      'Change Type': getChangeTypeLabel(billing.change_type),
      'From Plan': billing.from_slab_name || 'N/A',
      'To Plan': billing.to_slab_name || 'N/A',
      'Subscription Status': billing.subscription_status || 'N/A',
      'Billing Cycle': billing.billing_cycle || 'N/A',
      'Validated By': billing.validated_by || 'N/A',
      'Validated At': formatDateTime(billing.validated_at),
      'Validation Notes': billing.validation_notes || 'N/A',
      'Created At': formatDateTime(billing.created_at)
    }));

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Billing History');

    // Set column widths
    const colWidths = [
      { wch: 18 }, // Invoice Number
      { wch: 12 }, // Date
      { wch: 18 }, // Billing Period Start
      { wch: 18 }, // Billing Period End
      { wch: 15 }, // Plan Name
      { wch: 12 }, // User Count
      { wch: 15 }, // Total Amount
      { wch: 15 }, // Wallet Utilized
      { wch: 18 }, // Actual Paid Amount
      { wch: 18 }, // Status
      { wch: 15 }, // Payment Method
      { wch: 20 }, // Payment Reference
      { wch: 15 }, // Payment Date
      { wch: 12 }, // Change Type
      { wch: 15 }, // From Plan
      { wch: 15 }, // To Plan
      { wch: 18 }, // Subscription Status
      { wch: 15 }, // Billing Cycle
      { wch: 12 }, // Validated By
      { wch: 20 }, // Validated At
      { wch: 30 }, // Validation Notes
      { wch: 20 }  // Created At
    ];
    ws['!cols'] = colWidths;

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Billing_History_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  };

  if (loading && billingHistory.length === 0) {
    return (
      <div className="billing-history-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading billing history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="billing-history-page">
      <div className="billing-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h1>Billing History</h1>
          {billingHistory.length > 0 && (
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
        <p>View all your invoices and payment records</p>
      </div>

      <div className="billing-filters">
        <div className="filter-group">
          <label htmlFor="status_filter">Filter by Status:</label>
          <select
            id="status_filter"
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending_validation">Pending Validation</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchBillingHistory} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {billingHistory.length === 0 && !loading ? (
        <div className="no-billing-container">
          <p>No billing records found.</p>
        </div>
      ) : (
        <div className="billing-table-container">
          <table className="billing-table">
            <thead>
              <tr>
                <th>Reference No</th>
                <th>Date</th>
                <th>Plan</th>
                <th>Users</th>
                <th>Total</th>
                <th>Wallet Used</th>
                <th>Paid Amount</th>
                <th>Status</th>
                <th>Payment Method</th>
                <th>Change Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((billing) => (
                <tr key={billing.id}>
                  <td className="invoice-number">{billing.invoice_number || 'N/A'}</td>
                  <td>{formatDate(billing.payment_date || billing.billing_period_start)}</td>
                  <td>{billing.slab_name || 'N/A'}</td>
                  <td>{billing.user_count || 0}</td>
                  <td className="total-amount">{formatCurrency(billing.total_amount || 0)}</td>
                  <td>
                    {billing.wallet_utilized_amount > 0 ? (
                      <span style={{ color: '#28a745', fontWeight: 600 }}>
                        {formatCurrency(billing.wallet_utilized_amount)}
                      </span>
                    ) : (
                      formatCurrency(0)
                    )}
                  </td>
                  <td className="total-amount" style={{ color: '#007bff' }}>
                    {formatCurrency(billing.actual_paid_amount || 0)}
                  </td>
                  <td>
                    <StatusBadge status={billing.status} />
                  </td>
                  <td>{billing.payment_method ? billing.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: billing.change_type === 'upgrade' ? '#d4edda' : 
                                       billing.change_type === 'downgrade' ? '#fff3cd' :
                                       billing.change_type === 'renewal' ? '#d1ecf1' : '#e2e3e5',
                      color: billing.change_type === 'upgrade' ? '#155724' :
                             billing.change_type === 'downgrade' ? '#856404' :
                             billing.change_type === 'renewal' ? '#0c5460' : '#383d41'
                    }}>
                      {getChangeTypeLabel(billing.change_type)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="view-invoice-button"
                      onClick={() => handleViewInvoice(billing.id)}
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

      {selectedInvoice && (
        <div className="invoice-modal">
          <div className="invoice-modal-content">
            <div className="invoice-modal-header">
              <h2>Invoice Details</h2>
              <button
                className="close-button"
                onClick={() => setSelectedInvoice(null)}
              >
                ×
              </button>
            </div>
            <div className="invoice-modal-body">
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Reference No:</span>
                <span className="invoice-detail-value">{selectedInvoice.invoice_number || 'N/A'}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Billing Period:</span>
                <span className="invoice-detail-value">
                  {formatDate(selectedInvoice.billing_period_start)} - {formatDate(selectedInvoice.billing_period_end)}
                </span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Plan Name:</span>
                <span className="invoice-detail-value">{selectedInvoice.slab_name || 'N/A'}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">User Count:</span>
                <span className="invoice-detail-value">{selectedInvoice.user_count || 0}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Billing Cycle:</span>
                <span className="invoice-detail-value">
                  {selectedInvoice.billing_cycle ? selectedInvoice.billing_cycle.charAt(0).toUpperCase() + selectedInvoice.billing_cycle.slice(1) : 'N/A'}
                </span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Change Type:</span>
                <span className="invoice-detail-value">{getChangeTypeLabel(selectedInvoice.change_type)}</span>
              </div>
              {selectedInvoice.from_slab_name && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">From Plan:</span>
                  <span className="invoice-detail-value">{selectedInvoice.from_slab_name}</span>
                </div>
              )}
              {selectedInvoice.to_slab_name && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">To Plan:</span>
                  <span className="invoice-detail-value">{selectedInvoice.to_slab_name}</span>
                </div>
              )}
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Base Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.base_amount || selectedInvoice.amount || 0)}</span>
              </div>
              {selectedInvoice.discount_amount > 0 && (
                <>
                  <div className="invoice-detail-row">
                    <span className="invoice-detail-label">Discount Type:</span>
                    <span className="invoice-detail-value">{selectedInvoice.discount_type || 'N/A'}</span>
                  </div>
                  <div className="invoice-detail-row">
                    <span className="invoice-detail-label">Discount Value:</span>
                    <span className="invoice-detail-value">
                      {selectedInvoice.discount_type === 'percentage' 
                        ? `${selectedInvoice.discount_value || 0}%` 
                        : formatCurrency(selectedInvoice.discount_value || 0)}
                    </span>
                  </div>
                  <div className="invoice-detail-row">
                    <span className="invoice-detail-label">Discount Amount:</span>
                    <span className="invoice-detail-value">{formatCurrency(selectedInvoice.discount_amount || 0)}</span>
                  </div>
                  {selectedInvoice.discount_reason && (
                    <div className="invoice-detail-row">
                      <span className="invoice-detail-label">Discount Reason:</span>
                      <span className="invoice-detail-value">{selectedInvoice.discount_reason}</span>
                    </div>
                  )}
                </>
              )}
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Tax Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.tax_amount || 0)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Total Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.total_amount || 0)}</span>
              </div>
              {selectedInvoice.wallet_utilized_amount > 0 && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">Wallet Utilized:</span>
                  <span className="invoice-detail-value" style={{ color: '#28a745' }}>
                    {formatCurrency(selectedInvoice.wallet_utilized_amount || 0)}
                  </span>
                </div>
              )}
              <div className="invoice-detail-row highlight">
                <span className="invoice-detail-label">Actual Paid Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.actual_paid_amount || 0)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Status:</span>
                <span className="invoice-detail-value">
                  <StatusBadge status={selectedInvoice.status} />
                </span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Payment Method:</span>
                <span className="invoice-detail-value">
                  {selectedInvoice.payment_method ? selectedInvoice.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}
                </span>
              </div>
              {selectedInvoice.payment_reference && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">Payment Reference:</span>
                  <span className="invoice-detail-value">{selectedInvoice.payment_reference}</span>
                </div>
              )}
              {selectedInvoice.payment_date && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">Payment Date:</span>
                  <span className="invoice-detail-value">{formatDate(selectedInvoice.payment_date)}</span>
                </div>
              )}
              {selectedInvoice.payment_proof_url && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">Payment Proof:</span>
                  <span className="invoice-detail-value">
                    <a href={selectedInvoice.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>
                      View Proof
                    </a>
                  </span>
                </div>
              )}
              {selectedInvoice.validated_at && (
                <>
                  <div className="invoice-detail-row">
                    <span className="invoice-detail-label">Validated At:</span>
                    <span className="invoice-detail-value">{formatDateTime(selectedInvoice.validated_at)}</span>
                  </div>
                  {selectedInvoice.validated_by && (
                    <div className="invoice-detail-row">
                      <span className="invoice-detail-label">Validated By:</span>
                      <span className="invoice-detail-value">Admin ID: {selectedInvoice.validated_by}</span>
                    </div>
                  )}
                </>
              )}
              {selectedInvoice.validation_notes && (
                <div className="invoice-detail-row">
                  <span className="invoice-detail-label">Validation Notes:</span>
                  <span className="invoice-detail-value" style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                    {selectedInvoice.validation_notes}
                  </span>
                </div>
              )}
              {selectedInvoice.wallet_credits && selectedInvoice.wallet_credits.length > 0 && (
                <div className="invoice-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="invoice-detail-label" style={{ marginBottom: '8px' }}>Wallet Credits:</span>
                  <div style={{ width: '100%' }}>
                    {selectedInvoice.wallet_credits.map((credit, idx) => (
                      <div key={idx} style={{ 
                        padding: '8px', 
                        marginBottom: '4px', 
                        backgroundColor: '#d4edda', 
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <strong>{formatCurrency(credit.amount)}</strong> - {credit.description}
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                          {formatDateTime(credit.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedInvoice.wallet_debits && selectedInvoice.wallet_debits.length > 0 && (
                <div className="invoice-detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="invoice-detail-label" style={{ marginBottom: '8px' }}>Wallet Debits:</span>
                  <div style={{ width: '100%' }}>
                    {selectedInvoice.wallet_debits.map((debit, idx) => (
                      <div key={idx} style={{ 
                        padding: '8px', 
                        marginBottom: '4px', 
                        backgroundColor: '#f8d7da', 
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}>
                        <strong>{formatCurrency(debit.amount)}</strong> - {debit.description}
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                          {formatDateTime(debit.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Created At:</span>
                <span className="invoice-detail-value">{formatDateTime(selectedInvoice.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingHistoryPage;
