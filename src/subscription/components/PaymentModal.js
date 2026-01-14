// Payment Modal Component - Shows bank details, UPI QR code, and payment form
import React, { useState } from 'react';
import { purchaseSubscription } from '../api/subscriptionApi';
import './PaymentModal.css';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  orderDetails,
  onSuccess 
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    employee_code: '',
    partner_code: ''
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Get bank details from orderDetails (already fetched from slab API)
  const bankDetails = orderDetails?.bankDetails || null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!paymentForm.payment_reference.trim()) {
      errors.payment_reference = 'Payment reference is required';
    }
    if (!paymentForm.payment_date) {
      errors.payment_date = 'Payment date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Prepare purchase data based on API requirements
      // Convert employee_code and partner_code to IDs if provided (or send codes if API accepts them)
      const purchaseData = {
        internal_slab_id: orderDetails.internalPlan?.id,
        billing_cycle: orderDetails.billingCycle || 'monthly',
        user_count: orderDetails.totalInternalUsers || orderDetails.internalPlan?.min_users || 1,
        partner_id: paymentForm.partner_code || null,
        employee_id: paymentForm.employee_code || null,
        payment_method: paymentForm.payment_method,
        payment_reference: paymentForm.payment_reference,
        payment_proof_url: null,
        payment_date: paymentForm.payment_date
      };

      const response = await purchaseSubscription(purchaseData);
      
      if (response) {
        if (onSuccess) {
          onSuccess(response);
        }
        onClose();
      } else {
        setError('Failed to process payment. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting payment:', err);
      setError(err.message || 'Failed to process payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate UPI QR code with amount
  const generateUPIQRCode = (upiId, amount) => {
    if (!upiId) return null;
    const payeeName = encodeURIComponent(bankDetails?.account_holder_name || bankDetails?.company_name || '');
    // Format amount as number (no commas, no currency symbol) for UPI
    const formattedAmount = amount ? amount.toFixed(2) : '';
    // Build UPI URI with amount and currency
    let upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payeeName}`;
    if (formattedAmount) {
      upiUri += `&am=${formattedAmount}&cu=INR`;
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
  };

  if (!isOpen) return null;

  const totalAmount = orderDetails?.totalAmount || 0;
  const qrCodeUrl = bankDetails?.upi_id ? generateUPIQRCode(bankDetails.upi_id, totalAmount) : null;

  return (
    <div className="payment-modal-overlay" onClick={onClose}>
      <div className="payment-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h2>Complete Payment</h2>
          <button className="payment-modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="payment-modal-error">
            {error}
          </div>
        )}

        <div className="payment-modal-body">
            <div className="payment-modal-left">
              <div className="bank-details-section">
                <h3>Company Bank Details</h3>
                {bankDetails ? (
                  <div className="bank-details-card">
                    <div className="bank-detail-item">
                      <label>Account Holder Name</label>
                      <div>{bankDetails.account_holder_name || '-'}</div>
                    </div>
                    <div className="bank-detail-row">
                      <div className="bank-detail-item bank-detail-half">
                        <label>Bank Name</label>
                        <div>{bankDetails.bank_name || '-'}</div>
                      </div>
                      <div className="bank-detail-item bank-detail-half">
                        <label>Branch Name</label>
                        <div>{bankDetails.branch_name || '-'}</div>
                      </div>
                    </div>
                    <div className="bank-detail-row">
                      <div className="bank-detail-item bank-detail-half">
                        <label>Account Number</label>
                        <div>{bankDetails.account_number || '-'}</div>
                      </div>
                      <div className="bank-detail-item bank-detail-half">
                        <label>IFSC Code</label>
                        <div>{bankDetails.ifsc_code || '-'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bank-details-error">
                    No bank details available
                  </div>
                )}
              </div>

              <div className="upi-section">
                <h3>UPI Payment</h3>
                {bankDetails?.upi_id ? (
                  <div className="upi-details-card">
                    <div className="upi-id-display">
                      <label>UPI ID</label>
                      <div className="upi-id-value">{bankDetails.upi_id}</div>
                    </div>
                    {qrCodeUrl && (
                      <div className="upi-qr-code">
                        <img 
                          src={qrCodeUrl} 
                          alt="UPI QR Code"
                          className="qr-code-image"
                        />
                        <p className="qr-code-hint">Scan to pay via UPI</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="upi-error">
                    UPI ID not available
                  </div>
                )}
              </div>
            </div>

            <div className="payment-modal-right">
              <div className="payment-summary-section">
                <h3>Payment Summary</h3>
                <div className="payment-summary-card">
                  <div className="summary-item">
                    <span>Total Amount</span>
                    <strong>₹{orderDetails?.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</strong>
                  </div>
                  <div className="summary-item">
                    <span>Billing Cycle</span>
                    <span>{orderDetails?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</span>
                  </div>
                  {orderDetails?.internalPlan && (
                    <div className="summary-item">
                      <span>{orderDetails.internalPlan.name}</span>
                      <span>{orderDetails.totalInternalUsers || 1} user(s)</span>
                    </div>
                  )}
                  {orderDetails?.totalFreeExternalUsers > 0 && (
                    <div className="summary-item">
                      <span>Free External Users</span>
                      <span>{orderDetails.totalFreeExternalUsers} user(s)</span>
                    </div>
                  )}
                </div>
              </div>

              <form className="payment-form" onSubmit={handleSubmit}>
                <h3>Payment Details</h3>
                
                <div className="form-row">
                  <div className="form-group form-group-half">
                    <label htmlFor="payment_method">Payment Method *</label>
                    <select
                      id="payment_method"
                      name="payment_method"
                      value={paymentForm.payment_method}
                      onChange={handleInputChange}
                      className={formErrors.payment_method ? 'error' : ''}
                    >
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="netbanking">Net Banking</option>
                    </select>
                    {formErrors.payment_method && (
                      <span className="error-message">{formErrors.payment_method}</span>
                    )}
                  </div>

                  <div className="form-group form-group-half">
                    <label htmlFor="payment_date">Payment Date *</label>
                    <input
                      type="date"
                      id="payment_date"
                      name="payment_date"
                      value={paymentForm.payment_date}
                      onChange={handleInputChange}
                      max={new Date().toISOString().split('T')[0]}
                      className={formErrors.payment_date ? 'error' : ''}
                    />
                    {formErrors.payment_date && (
                      <span className="error-message">{formErrors.payment_date}</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="payment_reference">Payment Reference / Transaction ID *</label>
                  <input
                    type="text"
                    id="payment_reference"
                    name="payment_reference"
                    value={paymentForm.payment_reference}
                    onChange={handleInputChange}
                    placeholder="Enter transaction ID or reference number"
                    className={formErrors.payment_reference ? 'error' : ''}
                  />
                  {formErrors.payment_reference && (
                    <span className="error-message">{formErrors.payment_reference}</span>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group form-group-half">
                    <label htmlFor="employee_code">Employee Code</label>
                    <input
                      type="text"
                      id="employee_code"
                      name="employee_code"
                      value={paymentForm.employee_code}
                      onChange={handleInputChange}
                      placeholder="Enter employee code (optional)"
                      className={formErrors.employee_code ? 'error' : ''}
                    />
                    {formErrors.employee_code && (
                      <span className="error-message">{formErrors.employee_code}</span>
                    )}
                  </div>

                  <div className="form-group form-group-half">
                    <label htmlFor="partner_code">Partner Code</label>
                    <input
                      type="text"
                      id="partner_code"
                      name="partner_code"
                      value={paymentForm.partner_code}
                      onChange={handleInputChange}
                      placeholder="Enter partner code (optional)"
                      className={formErrors.partner_code ? 'error' : ''}
                    />
                    {formErrors.partner_code && (
                      <span className="error-message">{formErrors.partner_code}</span>
                    )}
                  </div>
                </div>

                <div className="payment-form-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={onClose}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="submit-button"
                    disabled={submitting}
                  >
                    {submitting ? 'Processing...' : 'Accept & Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;

