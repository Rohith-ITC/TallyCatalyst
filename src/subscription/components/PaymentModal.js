// Payment Modal Component - Shows bank details, UPI QR code, and payment form
import React, { useState, useEffect, useRef } from 'react';
import { purchaseSubscription } from '../api/subscriptionApi';
import { apiGet } from '../../utils/apiUtils';
import './PaymentModal.css';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  orderDetails,
  onSuccess 
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Get employee/partner code from sessionStorage (from login response)
  const getInitialEmployeePartnerCode = () => {
    const employeeCode = sessionStorage.getItem('employee_code');
    const partnerCode = sessionStorage.getItem('partner_code');
    // Prefer employee code over partner code (employees have priority)
    return employeeCode || partnerCode || '';
  };
  
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    employee_partner_code: getInitialEmployeePartnerCode()
  });
  const [formErrors, setFormErrors] = useState({});
  
  // Dropdown states for employee/partner code
  const [employees, setEmployees] = useState([]);
  const [partners, setPartners] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [employeePartnerCodeFocused, setEmployeePartnerCodeFocused] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get bank details from orderDetails (already fetched from slab API)
  const bankDetails = orderDetails?.bankDetails || null;

  // Reset form when modal opens/closes, and auto-populate employee/partner code
  useEffect(() => {
    if (isOpen) {
      // Auto-populate employee/partner code from sessionStorage when modal opens
      const employeeCode = sessionStorage.getItem('employee_code');
      const partnerCode = sessionStorage.getItem('partner_code');
      const codeToUse = employeeCode || partnerCode || '';
      
      setPaymentForm(prev => ({
        ...prev,
        employee_partner_code: codeToUse
      }));
    }
  }, [isOpen]);

  // Fetch employees and partners on component mount
  useEffect(() => {
    if (!isOpen) return; // Only fetch when modal is open
    
    const fetchEmployeePartnerData = async () => {
      try {
        setLoadingSuggestions(true);
        // Try to fetch employees and partners
        const [employeesData, partnersData] = await Promise.allSettled([
          apiGet('/api/subscriptions/admin/employees/all?is_active=true'),
          apiGet('/api/subscriptions/admin/partners/all?is_active=true')
        ]);

        if (employeesData.status === 'fulfilled' && employeesData.value) {
          const employeesList = Array.isArray(employeesData.value) 
            ? employeesData.value 
            : (employeesData.value.employees || employeesData.value.data || []);
          setEmployees(employeesList);
        }

        if (partnersData.status === 'fulfilled' && partnersData.value) {
          const partnersList = Array.isArray(partnersData.value) 
            ? partnersData.value 
            : (partnersData.value.partners || partnersData.value.data || []);
          setPartners(partnersList);
        }
      } catch (err) {
        // Silently fail - dropdown won't show suggestions but field still works
        console.log('Could not fetch employee/partner data:', err.message);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchEmployeePartnerData();
  }, [isOpen]);

  // Filter suggestions when user types or when field is focused
  useEffect(() => {
    const trimmedCode = paymentForm.employee_partner_code.trim();
    const searchTerm = trimmedCode.toLowerCase();
    const allCodes = [];
    
    // Add employees first (priority) - use employee_id
    employees.forEach(emp => {
      const code = emp.employee_id || '';
      const codeStr = String(code);
      const name = emp.name || emp.employee_name || emp.employeeName || '';
      const nameStr = String(name);
      
      if (codeStr) {
        // If user has typed something, filter by code OR name; otherwise show all
        if (trimmedCode.length === 0 || 
            codeStr.toLowerCase().includes(searchTerm) || 
            nameStr.toLowerCase().includes(searchTerm)) {
          allCodes.push({ 
            code: codeStr, 
            type: 'Employee', 
            name: nameStr
          });
        }
      }
    });
    
    // Then add partners - use referral_code
    partners.forEach(partner => {
      const code = partner.referral_code || '';
      const codeStr = String(code);
      const name = partner.name || partner.partner_name || partner.partnerName || '';
      const nameStr = String(name);
      
      if (codeStr) {
        // If user has typed something, filter by code OR name; otherwise show all
        if (trimmedCode.length === 0 || 
            codeStr.toLowerCase().includes(searchTerm) || 
            nameStr.toLowerCase().includes(searchTerm)) {
          allCodes.push({ 
            code: codeStr, 
            type: 'Partner', 
            name: nameStr
          });
        }
      }
    });

    // Remove duplicates and limit to 20 suggestions when showing all, 10 when filtering
    const limit = trimmedCode.length === 0 ? 20 : 10;
    const uniqueCodes = Array.from(
      new Map(allCodes.map(item => [item.code, item])).values()
    ).slice(0, limit);

    setSuggestions(uniqueCodes);
    // Show dropdown if field is focused and we have suggestions
    if (employeePartnerCodeFocused && uniqueCodes.length > 0) {
      setShowDropdown(true);
    }
  }, [paymentForm.employee_partner_code, employees, partners, employeePartnerCodeFocused]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inputElement = document.getElementById('employee_partner_code');
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        inputElement &&
        !inputElement.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      // Send employee_partner_code - backend will check employees first, then partners
      const userCount = orderDetails.totalInternalUsers || orderDetails.internalPlan?.min_users || 1;
      
      // Calculate external_free_count if not provided
      const freeExternalPerInternal = orderDetails.freeExternalUsersPerInternalUser || 
                                      orderDetails.internalPlan?.free_external_users_per_internal_user || 
                                      10;
      const externalFreeCount = orderDetails.totalFreeExternalUsers || (userCount * freeExternalPerInternal);

      // Determine action type from orderDetails
      const action = orderDetails.action || 'purchase'; // 'purchase', 'renewal', 'upgrade', 'downgrade'
      
      let purchaseData;
      
      // Get wallet utilized amount from orderDetails
      const walletUtilizedAmount = orderDetails.walletBalance || 0;

      if (action === 'upgrade') {
        // Upgrade action format
        // Add billing_cycle only if it has changed from current subscription
        const currentBillingCycle = orderDetails.currentBillingCycle;
        const newBillingCycle = orderDetails.billingCycle;
        const billingCycleChanged = currentBillingCycle && currentBillingCycle !== newBillingCycle;
        
        // Calculate credit amount if prorated amount is negative (credit scenario)
        const proratedInfo = orderDetails.proratedInfo;
        const creditAmount = proratedInfo && proratedInfo.proratedAmount < 0 
          ? Math.abs(proratedInfo.proratedAmount) 
          : 0;
        
        purchaseData = {
          action: 'upgrade',
          new_slab_id: orderDetails.internalPlan?.id,
          user_count: userCount,
          amount: orderDetails.totalAmount || 0,
          wallet_utilized_amount: walletUtilizedAmount,
          employee_partner_code: paymentForm.employee_partner_code?.trim() || null,
          payment_method: paymentForm.payment_method,
          payment_reference: paymentForm.payment_reference,
          payment_proof_url: null,
          payment_date: paymentForm.payment_date
        };
        
        // Add billing_cycle only if it has changed
        if (billingCycleChanged) {
          purchaseData.billing_cycle = newBillingCycle;
        }
        
        // Add credit_amount if there's a credit (negative prorated amount)
        if (creditAmount > 0) {
          purchaseData.credit_amount = creditAmount;
        }
      } else if (action === 'renewal') {
        // Renewal action format
        purchaseData = {
          action: 'renewal',
          internal_slab_id: orderDetails.internalPlan?.id,
          billing_cycle: orderDetails.billingCycle || 'monthly',
          user_count: userCount,
          total_amount: orderDetails.totalAmount || 0,
          wallet_utilized_amount: walletUtilizedAmount,
          employee_partner_code: paymentForm.employee_partner_code?.trim() || null,
          payment_method: paymentForm.payment_method,
          payment_reference: paymentForm.payment_reference,
          payment_proof_url: null,
          payment_date: paymentForm.payment_date
        };
      } else {
        // Purchase action format (default)
        purchaseData = {
          action: 'purchase',
          internal_slab_id: orderDetails.internalPlan?.id,
          billing_cycle: orderDetails.billingCycle || 'monthly',
          user_count: userCount,
          // Optional fields
          external_free_count: externalFreeCount || null,
          total_amount: orderDetails.totalAmount || null,
          wallet_utilized_amount: walletUtilizedAmount,
          employee_partner_code: paymentForm.employee_partner_code?.trim() || null,
          payment_method: paymentForm.payment_method,
          payment_reference: paymentForm.payment_reference,
          payment_proof_url: null,
          payment_date: paymentForm.payment_date
        };
      }

      const response = await purchaseSubscription(purchaseData);
      
      if (response) {
        if (onSuccess) {
          onSuccess(response);
        }
        onClose();
        // Navigate to My Subscription page after successful payment
        const basename = process.env.REACT_APP_HOMEPAGE || '';
        const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
        window.location.href = path;
      } else {
        const errorMsg = 'Failed to process payment. Please try again.';
        setError(errorMsg);
        setErrorMessage(errorMsg);
        setShowErrorPopup(true);
      }
    } catch (err) {
      console.error('Error submitting payment:', err);
      
      // Extract error message from API response
      let errorMsg = 'Failed to process payment. Please try again.';
      
      if (err.message) {
        // Try to parse JSON error message
        try {
          const errorMatch = err.message.match(/\{.*\}/);
          if (errorMatch) {
            const errorObj = JSON.parse(errorMatch[0]);
            if (errorObj.error && errorObj.error.message) {
              errorMsg = errorObj.error.message;
            } else if (errorObj.message) {
              errorMsg = errorObj.message;
            }
          } else {
            errorMsg = err.message;
          }
        } catch (parseErr) {
          // If parsing fails, use the original message
          errorMsg = err.message;
        }
      }
      
      setError(errorMsg);
      setErrorMessage(errorMsg);
      setShowErrorPopup(true);
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

  if (!isOpen && !showErrorPopup) return null;

  const totalAmount = orderDetails?.totalAmount || 0;
  const qrCodeUrl = bankDetails?.upi_id ? generateUPIQRCode(bankDetails.upi_id, totalAmount) : null;

  return (
    <>
    {isOpen && (
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
                  {orderDetails?.baseTotalAmount !== undefined && orderDetails?.baseTotalAmount !== orderDetails?.totalAmount && (
                    <div className="summary-item">
                      <span>Subtotal</span>
                      <span>₹{orderDetails.baseTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {orderDetails?.walletBalance > 0 && (
                    <div className="summary-item" style={{ color: '#10b981' }}>
                      <span>Wallet Balance Applied</span>
                      <span>- ₹{orderDetails.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="summary-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                    <span>Total Amount Payable</span>
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

                <div className="form-group" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label htmlFor="employee_partner_code">Employee/Partner Code</label>
                    {paymentForm.employee_partner_code && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentForm(prev => ({
                            ...prev,
                            employee_partner_code: ''
                          }));
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: 12,
                          padding: '4px 8px',
                          textDecoration: 'underline'
                        }}
                        title="Clear code"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    id="employee_partner_code"
                    name="employee_partner_code"
                    value={paymentForm.employee_partner_code}
                    onChange={handleInputChange}
                    onFocus={() => {
                      setEmployeePartnerCodeFocused(true);
                    }}
                    onBlur={() => {
                      setTimeout(() => {
                        setEmployeePartnerCodeFocused(false);
                      }, 200);
                    }}
                    placeholder="Enter employee or partner code (optional)"
                    className={formErrors.employee_partner_code ? 'error' : ''}
                  />
                  {formErrors.employee_partner_code && (
                    <span className="error-message">{formErrors.employee_partner_code}</span>
                  )}
                  {/* Dropdown suggestions */}
                  {showDropdown && suggestions.length > 0 && (
                    <div
                      ref={dropdownRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        zIndex: 10000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        marginTop: 4,
                        width: '100%',
                      }}
                    >
                      {suggestions.map((item, index) => (
                        <div
                          key={`${item.code}-${index}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPaymentForm(prev => ({
                              ...prev,
                              employee_partner_code: item.code
                            }));
                            setShowDropdown(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: index < suggestions.length - 1 ? '1px solid #e2e8f0' : 'none',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff';
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                            {item.code}
                          </div>
                          {item.name && (
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              {item.name} ({item.type})
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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
        </div>
      </div>
    )}

      {/* Error Popup Modal */}
      {showErrorPopup && (
        <div className="payment-modal-overlay" style={{ zIndex: 10001 }} onClick={() => {
          setShowErrorPopup(false);
          setError(null);
        }}>
          <div className="payment-modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h2 style={{ color: '#ef4444' }}>Error</h2>
              <button className="payment-modal-close" onClick={() => {
                setShowErrorPopup(false);
                setError(null);
              }}>×</button>
            </div>
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ 
                fontSize: '48px', 
                color: '#ef4444', 
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                ⚠️
              </div>
              <p style={{ 
                fontSize: '16px', 
                color: '#1f2937', 
                marginBottom: '24px',
                lineHeight: '1.5',
                wordWrap: 'break-word'
              }}>
                {errorMessage}
              </p>
              <button
                onClick={() => {
                  setShowErrorPopup(false);
                  setError(null);
                }}
                style={{
                  padding: '12px 32px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentModal;

