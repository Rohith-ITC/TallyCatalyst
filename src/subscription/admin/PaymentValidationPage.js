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
                <th>Reference No</th>
                <th>Owner</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Change Type</th>
                <th>Users</th>
                <th>Billing Period</th>
                <th>Total Amount</th>
                <th>Wallet Used</th>
                <th>Actual Paid</th>
                <th>Payment Method</th>
                <th>Payment Ref</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayments.map((payment) => (
                <tr key={payment.id}>
                  <td className="invoice-number">{payment.payment_reference || payment.invoice_number || 'N/A'}</td>
                  <td>{payment.owner_name || 'N/A'}</td>
                  <td>{payment.owner_email || 'N/A'}</td>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600 }}>{payment.slab_name || payment.to_slab_name || 'N/A'}</div>
                      {payment.change_type === 'upgrade' || payment.change_type === 'downgrade' ? (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                          {payment.from_slab_name ? `${payment.from_slab_name} → ` : ''}
                          {payment.to_slab_name || payment.slab_name || ''}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {payment.change_type ? (
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: payment.change_type === 'upgrade' ? '#d4edda' : 
                                         payment.change_type === 'downgrade' ? '#fff3cd' :
                                         payment.change_type === 'renewal' ? '#d1ecf1' : 
                                         payment.change_type === 'purchase' ? '#e2e3e5' : '#f8d7da',
                        color: payment.change_type === 'upgrade' ? '#155724' :
                               payment.change_type === 'downgrade' ? '#856404' :
                               payment.change_type === 'renewal' ? '#0c5460' : 
                               payment.change_type === 'purchase' ? '#383d41' : '#721c24'
                      }}>
                        {payment.change_type.charAt(0).toUpperCase() + payment.change_type.slice(1)}
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <div>{payment.user_count || 0}</div>
                      {payment.slab_max_users && (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          / {payment.slab_max_users} max
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>
                      <div>{formatDate(payment.billing_period_start)}</div>
                      <div style={{ color: '#666' }}>to {formatDate(payment.billing_period_end)}</div>
                    </div>
                  </td>
                  <td className="total-amount">{formatCurrency(payment.total_amount || 0)}</td>
                  <td>
                    {payment.wallet_utilized_amount > 0 ? (
                      <span style={{ color: '#28a745', fontWeight: 600 }}>
                        {formatCurrency(payment.wallet_utilized_amount)}
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td className="actual-paid-amount" style={{ color: '#007bff', fontWeight: 600 }}>
                    {formatCurrency(payment.actual_paid_amount || (payment.total_amount - (payment.wallet_utilized_amount || 0)) || 0)}
                  </td>
                  <td>{payment.payment_method ? payment.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</td>
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
              <div className="payment-section">
                <h3 className="payment-section-title">Owner Information</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Owner Name:</span>
                  <span className="payment-detail-value">{selectedPayment.owner_name || 'N/A'}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Owner Email:</span>
                  <span className="payment-detail-value">{selectedPayment.owner_email || 'N/A'}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">User ID:</span>
                  <span className="payment-detail-value">{selectedPayment.user_id || 'N/A'}</span>
                </div>
              </div>

              <div className="payment-section">
                <h3 className="payment-section-title">Invoice Information</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Reference Number:</span>
                  <span className="payment-detail-value">{selectedPayment.payment_reference || selectedPayment.invoice_number || 'N/A'}</span>
                </div>
                {selectedPayment.invoice_number && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Invoice Number:</span>
                    <span className="payment-detail-value">{selectedPayment.invoice_number}</span>
                  </div>
                )}
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Billing Period:</span>
                  <span className="payment-detail-value">
                    {formatDate(selectedPayment.billing_period_start)} - {formatDate(selectedPayment.billing_period_end)}
                  </span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Created At:</span>
                  <span className="payment-detail-value">{formatDateTime(selectedPayment.created_at)}</span>
                </div>
              </div>

              <div className="payment-section">
                <h3 className="payment-section-title">Subscription Information</h3>
                {selectedPayment.subscription_status && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Subscription Status:</span>
                    <span className="payment-detail-value">
                      <StatusBadge status={selectedPayment.subscription_status} />
                    </span>
                  </div>
                )}
                {(selectedPayment.slab_name || selectedPayment.to_slab_name) && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Plan Name:</span>
                    <span className="payment-detail-value">{selectedPayment.slab_name || selectedPayment.to_slab_name}</span>
                  </div>
                )}
                {selectedPayment.slab_max_users && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Max Users:</span>
                    <span className="payment-detail-value">{selectedPayment.slab_max_users}</span>
                  </div>
                )}
                <div className="payment-detail-row">
                  <span className="payment-detail-label">User Count:</span>
                  <span className="payment-detail-value">{selectedPayment.user_count || 0}</span>
                </div>
                {selectedPayment.billing_cycle && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Billing Cycle:</span>
                    <span className="payment-detail-value">
                      {selectedPayment.billing_cycle.charAt(0).toUpperCase() + selectedPayment.billing_cycle.slice(1)}
                    </span>
                  </div>
                )}
                {selectedPayment.subscription_start_date && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Subscription Start:</span>
                    <span className="payment-detail-value">{formatDate(selectedPayment.subscription_start_date)}</span>
                  </div>
                )}
                {selectedPayment.subscription_end_date && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Subscription End:</span>
                    <span className="payment-detail-value">{formatDate(selectedPayment.subscription_end_date)}</span>
                  </div>
                )}
                {selectedPayment.change_type && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Change Type:</span>
                    <span className="payment-detail-value">{getChangeTypeLabel(selectedPayment.change_type)}</span>
                  </div>
                )}
                {selectedPayment.from_slab_name && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">From Plan:</span>
                    <span className="payment-detail-value">{selectedPayment.from_slab_name}</span>
                  </div>
                )}
                {selectedPayment.to_slab_name && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">To Plan:</span>
                    <span className="payment-detail-value">{selectedPayment.to_slab_name}</span>
                  </div>
                )}
              </div>

              <div className="payment-section">
                <h3 className="payment-section-title">Amount Breakdown</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Base Amount:</span>
                  <span className="payment-detail-value">{formatCurrency(selectedPayment.base_amount || selectedPayment.amount || 0)}</span>
                </div>
                {selectedPayment.discount_amount > 0 && (
                  <>
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Discount Type:</span>
                      <span className="payment-detail-value">{selectedPayment.discount_type || 'N/A'}</span>
                    </div>
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Discount Value:</span>
                      <span className="payment-detail-value">
                        {selectedPayment.discount_type === 'percentage' 
                          ? `${selectedPayment.discount_value || 0}%` 
                          : formatCurrency(selectedPayment.discount_value || 0)}
                      </span>
                    </div>
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Discount Amount:</span>
                      <span className="payment-detail-value" style={{ color: '#28a745' }}>
                        {formatCurrency(selectedPayment.discount_amount || 0)}
                      </span>
                    </div>
                    {selectedPayment.discount_reason && (
                      <div className="payment-detail-row">
                        <span className="payment-detail-label">Discount Reason:</span>
                        <span className="payment-detail-value">{selectedPayment.discount_reason}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Tax Amount:</span>
                  <span className="payment-detail-value">{formatCurrency(selectedPayment.tax_amount || 0)}</span>
                </div>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Total Amount:</span>
                  <span className="payment-detail-value">{formatCurrency(selectedPayment.total_amount || 0)}</span>
                </div>
                {selectedPayment.wallet_utilized_amount > 0 && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Wallet Utilized:</span>
                    <span className="payment-detail-value" style={{ color: '#28a745', fontWeight: 600 }}>
                      {formatCurrency(selectedPayment.wallet_utilized_amount || 0)}
                    </span>
                  </div>
                )}
                <div className="payment-detail-row highlight">
                  <span className="payment-detail-label">Actual Paid Amount:</span>
                  <span className="payment-detail-value" style={{ color: '#007bff', fontWeight: 700, fontSize: '18px' }}>
                    {formatCurrency(selectedPayment.actual_paid_amount || (selectedPayment.total_amount - (selectedPayment.wallet_utilized_amount || 0)) || 0)}
                  </span>
                </div>
              </div>

              <div className="payment-section">
                <h3 className="payment-section-title">Payment Information</h3>
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Payment Method:</span>
                  <span className="payment-detail-value">
                    {selectedPayment.payment_method ? selectedPayment.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}
                  </span>
                </div>
                {selectedPayment.payment_reference && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Payment Reference:</span>
                    <span className="payment-detail-value">{selectedPayment.payment_reference}</span>
                  </div>
                )}
                {selectedPayment.payment_date && (
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Payment Date:</span>
                    <span className="payment-detail-value">{formatDate(selectedPayment.payment_date)}</span>
                  </div>
                )}
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
                <div className="payment-detail-row">
                  <span className="payment-detail-label">Status:</span>
                  <span className="payment-detail-value">
                    <StatusBadge status={selectedPayment.status} />
                  </span>
                </div>
              </div>

              {selectedPayment.wallet_credits && selectedPayment.wallet_credits.length > 0 && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Wallet Credits</h3>
                  <div style={{ width: '100%' }}>
                    {selectedPayment.wallet_credits.map((credit, idx) => (
                      <div key={idx} style={{ 
                        padding: '12px', 
                        marginBottom: '8px', 
                        backgroundColor: '#d4edda', 
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                          {formatCurrency(credit.amount)} - {credit.description || 'Credit'}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          {formatDateTime(credit.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPayment.wallet_debits && selectedPayment.wallet_debits.length > 0 && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Wallet Debits</h3>
                  <div style={{ width: '100%' }}>
                    {selectedPayment.wallet_debits.map((debit, idx) => (
                      <div key={idx} style={{ 
                        padding: '12px', 
                        marginBottom: '8px', 
                        backgroundColor: '#f8d7da', 
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                          {formatCurrency(debit.amount)} - {debit.description || 'Debit'}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px' }}>
                          {formatDateTime(debit.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedPayment.validation_notes && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Validation Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Validation Notes:</span>
                    <span className="payment-detail-value" style={{ fontSize: '13px', whiteSpace: 'pre-wrap', maxWidth: '60%' }}>
                      {selectedPayment.validation_notes}
                    </span>
                  </div>
                  {selectedPayment.validated_at && (
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Validated At:</span>
                      <span className="payment-detail-value">{formatDateTime(selectedPayment.validated_at)}</span>
                    </div>
                  )}
                  {selectedPayment.validated_by && (
                    <div className="payment-detail-row">
                      <span className="payment-detail-label">Validated By:</span>
                      <span className="payment-detail-value">Admin ID: {selectedPayment.validated_by}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedPayment.rejection_reason && (
                <div className="payment-section">
                  <h3 className="payment-section-title">Rejection Information</h3>
                  <div className="payment-detail-row">
                    <span className="payment-detail-label">Rejection Reason:</span>
                    <span className="payment-detail-value rejection-reason-text">{selectedPayment.rejection_reason}</span>
                  </div>
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
                Reference No: <strong>{validationModal.payment_reference || validationModal.invoice_number}</strong><br />
                Owner: <strong>{validationModal.owner_name || 'N/A'}</strong> ({validationModal.owner_email || 'N/A'})<br />
                {validationModal.slab_name && (
                  <>Plan: <strong>{validationModal.slab_name}</strong><br /></>
                )}
                {validationModal.change_type && (
                  <>Change Type: <strong>{getChangeTypeLabel(validationModal.change_type)}</strong><br /></>
                )}
                User Count: <strong>{validationModal.user_count || 0}</strong>
                {validationModal.slab_max_users && <> / {validationModal.slab_max_users} max</>}
                <br />
                Total Amount: <strong>{formatCurrency(validationModal.total_amount || 0)}</strong><br />
                {validationModal.wallet_utilized_amount > 0 && (
                  <>Wallet Utilized: <strong style={{ color: '#28a745' }}>{formatCurrency(validationModal.wallet_utilized_amount)}</strong><br /></>
                )}
                Actual Paid: <strong style={{ color: '#007bff' }}>
                  {formatCurrency(validationModal.actual_paid_amount || (validationModal.total_amount - (validationModal.wallet_utilized_amount || 0)) || 0)}
                </strong><br />
                Payment Method: <strong>{validationModal.payment_method ? validationModal.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</strong>
                {validationModal.rejection_reason && (
                  <>
                    <br />
                    Rejection Reason: <strong className="rejection-reason-text">{validationModal.rejection_reason}</strong>
                  </>
                )}
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

