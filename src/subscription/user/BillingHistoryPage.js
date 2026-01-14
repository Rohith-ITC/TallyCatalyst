// Billing History Page - Display all billing records and invoices
import React, { useState, useEffect } from 'react';
import { getBillingHistory, getInvoice } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
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

  const handleViewInvoice = async (invoiceId) => {
    try {
      const invoice = await getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      if (onViewInvoice) {
        onViewInvoice(invoice);
      }
    } catch (err) {
      console.error('Error fetching invoice:', err);
      alert('Failed to load invoice details.');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
        <h1>Billing History</h1>
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
                <th>Invoice Number</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment Method</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {billingHistory.map((billing) => (
                <tr key={billing.id}>
                  <td className="invoice-number">{billing.invoice_number || 'N/A'}</td>
                  <td>{formatDate(billing.billing_date || billing.payment_date)}</td>
                  <td>{formatCurrency(billing.amount || 0)}</td>
                  <td>{formatCurrency(billing.discount_amount || 0)}</td>
                  <td>{formatCurrency(billing.tax_amount || 0)}</td>
                  <td className="total-amount">{formatCurrency(billing.total_amount || 0)}</td>
                  <td>
                    <StatusBadge status={billing.status} />
                  </td>
                  <td>{billing.payment_method || 'N/A'}</td>
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
                <span className="invoice-detail-label">Invoice Number:</span>
                <span className="invoice-detail-value">{selectedInvoice.invoice_number}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Billing Date:</span>
                <span className="invoice-detail-value">{formatDate(selectedInvoice.billing_date)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.amount || 0)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Discount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.discount_amount || 0)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Tax:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.tax_amount || 0)}</span>
              </div>
              <div className="invoice-detail-row highlight">
                <span className="invoice-detail-label">Total Amount:</span>
                <span className="invoice-detail-value">{formatCurrency(selectedInvoice.total_amount || 0)}</span>
              </div>
              <div className="invoice-detail-row">
                <span className="invoice-detail-label">Status:</span>
                <span className="invoice-detail-value">
                  <StatusBadge status={selectedInvoice.status} />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingHistoryPage;

