// Payment Validation Page - Review and validate pending payments (Superadmin only)
import React, { useState, useEffect } from 'react';
import { getPendingPayments, getPendingPayment, validatePayment } from '../api/subscriptionApi';
import StatusBadge from '../components/StatusBadge';
import './PaymentValidationPage.css';

const PaymentValidationPage = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [filters, setFilters] = useState({
    limit: 10,
    offset: 0,
    date_from: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [validationModal, setValidationModal] = useState(null);
  const [validationNotes, setValidationNotes] = useState('');

  useEffect(() => {
    fetchPendingPayments();
  }, [filters]);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPendingPayments(filters);
      setPendingPayments(data);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
      setError('Failed to load pending payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (paymentId) => {
    try {
      const payment = await getPendingPayment(paymentId);
      setSelectedPayment(payment);
    } catch (err) {
      console.error('Error fetching payment details:', err);
      alert('Failed to load payment details.');
    }
  };

  const handleOpenValidation = (payment) => {
    setValidationModal(payment);
    setValidationNotes('');
  };

  const handleValidatePayment = async (action) => {
    if (!validationModal) return;

    try {
      const result = await validatePayment(
        validationModal.id,
        action,
        validationNotes
      );

      if (result) {
        setValidationModal(null);
        setValidationNotes('');
        fetchPendingPayments();
        alert(`Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully.`);
      }
    } catch (err) {
      console.error('Error validating payment:', err);
      alert(`Failed to ${action} payment. Please try again.`);
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

  if (loading && pendingPayments.length === 0) {
    return (
      <div className="payment-validation-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading pending payments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-validation-page">
      <div className="validation-page-header">
        <h1>Payment Validation</h1>
        <p>Review and validate pending payment submissions</p>
      </div>

      <div className="validation-filters">
        <div className="filter-group">
          <label htmlFor="date_from">Date From:</label>
          <input
            type="date"
            id="date_from"
            name="date_from"
            value={filters.date_from}
            onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="limit">Results per page:</label>
          <select
            id="limit"
            name="limit"
            value={filters.limit}
            onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchPendingPayments} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {pendingPayments.length === 0 && !loading ? (
        <div className="no-payments-container">
          <p>No pending payments found.</p>
        </div>
      ) : (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Payment Reference</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="invoice-number">{payment.invoice_number || 'N/A'}</td>
                  <td>{payment.owner_name || 'N/A'}</td>
                  <td>{payment.owner_email || 'N/A'}</td>
                  <td>{formatCurrency(payment.total_amount || 0)}</td>
                  <td>{payment.payment_method || 'N/A'}</td>
                  <td>{payment.payment_reference || 'N/A'}</td>
                  <td>{formatDate(payment.payment_date)}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="view-button"
                        onClick={() => handleViewDetails(payment.id)}
                      >
                        View
                      </button>
                      <button
                        className="validate-button"
                        onClick={() => handleOpenValidation(payment)}
                      >
                        Validate
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPayment && (
        <div className="payment-modal">
          <div className="payment-modal-content">
            <div className="payment-modal-header">
              <h2>Payment Details</h2>
              <button
                className="close-button"
                onClick={() => setSelectedPayment(null)}
              >
                ×
              </button>
            </div>
            <div className="payment-modal-body">
              <div className="payment-detail-row">
                <span className="payment-detail-label">Invoice Number:</span>
                <span className="payment-detail-value">{selectedPayment.invoice_number}</span>
              </div>
              <div className="payment-detail-row">
                <span className="payment-detail-label">Owner:</span>
                <span className="payment-detail-value">{selectedPayment.owner_name}</span>
              </div>
              <div className="payment-detail-row">
                <span className="payment-detail-label">Email:</span>
                <span className="payment-detail-value">{selectedPayment.owner_email}</span>
              </div>
              <div className="payment-detail-row">
                <span className="payment-detail-label">Amount:</span>
                <span className="payment-detail-value">{formatCurrency(selectedPayment.total_amount || 0)}</span>
              </div>
              <div className="payment-detail-row">
                <span className="payment-detail-label">Payment Method:</span>
                <span className="payment-detail-value">{selectedPayment.payment_method}</span>
              </div>
              <div className="payment-detail-row">
                <span className="payment-detail-label">Payment Reference:</span>
                <span className="payment-detail-value">{selectedPayment.payment_reference}</span>
              </div>
              {selectedPayment.payment_proof_url && (
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Payment Proof:</span>
                  <a
                    href={selectedPayment.payment_proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-link"
                  >
                    View Proof
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {validationModal && (
        <div className="validation-modal">
          <div className="validation-modal-content">
            <div className="validation-modal-header">
              <h2>Validate Payment</h2>
              <button
                className="close-button"
                onClick={() => {
                  setValidationModal(null);
                  setValidationNotes('');
                }}
              >
                ×
              </button>
            </div>
            <div className="validation-modal-body">
              <p className="validation-info">
                Invoice: <strong>{validationModal.invoice_number}</strong><br />
                Amount: <strong>{formatCurrency(validationModal.total_amount || 0)}</strong><br />
                Owner: <strong>{validationModal.owner_name}</strong>
              </p>

              <div className="form-group">
                <label htmlFor="validation_notes">Validation Notes:</label>
                <textarea
                  id="validation_notes"
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  rows="4"
                  placeholder="Enter validation notes (optional)"
                />
              </div>

              <div className="validation-actions">
                <button
                  className="reject-button"
                  onClick={() => handleValidatePayment('reject')}
                >
                  Reject
                </button>
                <button
                  className="approve-button"
                  onClick={() => handleValidatePayment('approve')}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentValidationPage;

