// Purchase Subscription Page - Complete subscription purchase with payment details
import React, { useState, useEffect } from 'react';
import { purchaseSubscription, getInternalSlabs } from '../api/subscriptionApi';
import './PurchaseSubscriptionPage.css';

const PurchaseSubscriptionPage = ({ selectedPlan, billingCycle, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    internal_slab_id: selectedPlan?.id || '',
    billing_cycle: billingCycle || 'monthly',
    user_count: null, // Number of users to purchase (required)
    employee_partner_code: null,
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_proof_url: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (selectedPlan) {
      setFormData(prev => ({ ...prev, internal_slab_id: selectedPlan.id }));
      // Auto-set user_count if min equals max
      if (selectedPlan.min_users === selectedPlan.max_users && selectedPlan.min_users) {
        setFormData(prev => ({ ...prev, user_count: selectedPlan.min_users }));
      }
    }
    fetchPlans();
  }, [selectedPlan]);

  // Auto-set user_count when plan data is loaded and min equals max
  useEffect(() => {
    const plan = plans.find(p => p.id === formData.internal_slab_id);
    if (plan && plan.min_users === plan.max_users && plan.min_users && !formData.user_count) {
      setFormData(prev => ({ ...prev, user_count: plan.min_users }));
    }
  }, [plans, formData.internal_slab_id]);

  const fetchPlans = async () => {
    try {
      const response = await getInternalSlabs();
      setPlans(response.slabs);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value || null
    }));
    setError(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // TODO: Implement file upload to server and get URL
    // For now, just store the file name
    setFormData(prev => ({
      ...prev,
      payment_proof_url: file.name
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Calculate total amount and external free count
      const selectedPlanData = plans.find(p => p.id === formData.internal_slab_id) || selectedPlan;
      const pricePerUser = formData.billing_cycle === 'yearly' 
        ? (selectedPlanData?.yearly_price || 0)
        : (selectedPlanData?.monthly_price || 0);
      const userCount = formData.user_count || selectedPlanData?.min_users || 1;
      const totalAmount = userCount * pricePerUser;
      const externalFreeCount = userCount * (selectedPlanData?.free_external_users_per_internal_user || 10);

      // Prepare payload according to API structure
      const purchasePayload = {
        internal_slab_id: formData.internal_slab_id,
        billing_cycle: formData.billing_cycle,
        user_count: userCount,
        // Optional fields
        external_free_count: externalFreeCount || null,
        total_amount: totalAmount || null,
        employee_partner_code: formData.employee_partner_code?.trim() || null,
        payment_method: formData.payment_method,
        payment_reference: formData.payment_reference,
        payment_proof_url: formData.payment_proof_url || null,
        payment_date: formData.payment_date
      };

      const result = await purchaseSubscription(purchasePayload);
      if (result) {
        setSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(result);
          }
        }, 2000);
      }
    } catch (err) {
      console.error('Error purchasing subscription:', err);
      setError(err.message || 'Failed to purchase subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlanData = plans.find(p => p.id === formData.internal_slab_id) || selectedPlan;

  if (success) {
    return (
      <div className="purchase-subscription-page">
        <div className="success-container">
          <div className="success-icon">✓</div>
          <h2>Payment Submitted Successfully!</h2>
          <p>Your payment is pending validation. You will be notified once it's approved.</p>
          <p className="success-note">Invoice Number: {formData.payment_reference || 'Pending'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-subscription-page">
      <div className="purchase-page-header">
        <h1>Purchase Subscription</h1>
        <p>Complete your subscription purchase by providing payment details</p>
      </div>

      <form onSubmit={handleSubmit} className="purchase-form">
        <div className="form-section">
          <h2>Plan Summary</h2>
          {selectedPlanData && (
            <div className="plan-summary">
              <div className="summary-row">
                <span className="summary-label">Plan:</span>
                <span className="summary-value">{selectedPlanData.name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">User Range:</span>
                <span className="summary-value">
                  {selectedPlanData.min_users === selectedPlanData.max_users
                    ? `${selectedPlanData.min_users} user${selectedPlanData.min_users > 1 ? 's' : ''}`
                    : `${selectedPlanData.min_users}-${selectedPlanData.max_users} users`}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Billing Cycle:</span>
                <span className="summary-value">
                  {formData.billing_cycle.charAt(0).toUpperCase() + formData.billing_cycle.slice(1)}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Price:</span>
                <span className="summary-value">
                  ₹{formData.billing_cycle === 'yearly' 
                    ? selectedPlanData.yearly_price?.toLocaleString('en-IN')
                    : selectedPlanData.monthly_price?.toLocaleString('en-IN')}
                  /{formData.billing_cycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User Selection Section - Required for purchase */}
        {selectedPlanData && (
          <div className="form-section">
            <h2>Select Number of Users</h2>
            <div className="form-group">
              <label htmlFor="user_count">
                Number of Internal Users * 
                <span className="field-hint">
                  {selectedPlanData.min_users === selectedPlanData.max_users
                    ? `(${selectedPlanData.min_users} users)`
                    : `(Select between ${selectedPlanData.min_users} and ${selectedPlanData.max_users} users)`}
                </span>
              </label>
              <input
                type="number"
                id="user_count"
                name="user_count"
                min={selectedPlanData.min_users}
                max={selectedPlanData.max_users}
                value={formData.user_count || ''}
                onChange={handleInputChange}
                required
                placeholder={`Enter number of users${selectedPlanData.min_users !== selectedPlanData.max_users ? ` (${selectedPlanData.min_users}-${selectedPlanData.max_users})` : ''}`}
              />
              {formData.user_count && selectedPlanData.free_external_users_per_internal_user && (
                <div className="user-count-info">
                  <p>
                    You will get {formData.user_count * (selectedPlanData.free_external_users_per_internal_user || 10)} external users 
                    ({formData.user_count} × {selectedPlanData.free_external_users_per_internal_user || 10})
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-section">
          <h2>Payment Details</h2>
          
          <div className="form-group">
            <label htmlFor="payment_method">Payment Method *</label>
            <select
              id="payment_method"
              name="payment_method"
              value={formData.payment_method}
              onChange={handleInputChange}
              required
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="payment_reference">
              Payment Reference * 
              <span className="field-hint">(Transaction ID, Cheque Number, etc.)</span>
            </label>
            <input
              type="text"
              id="payment_reference"
              name="payment_reference"
              value={formData.payment_reference}
              onChange={handleInputChange}
              required
              placeholder="Enter payment reference"
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_date">Payment Date *</label>
            <input
              type="date"
              id="payment_date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleInputChange}
              required
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label htmlFor="payment_proof">Payment Proof (Optional but Recommended)</label>
            <input
              type="file"
              id="payment_proof"
              name="payment_proof"
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <small className="field-hint">Upload payment receipt, screenshot, or proof document</small>
          </div>
        </div>

        <div className="form-section">
          <h2>Optional Information</h2>
          
          <div className="form-group">
            <label htmlFor="employee_partner_code">Employee/Partner Code (Optional)</label>
            <input
              type="text"
              id="employee_partner_code"
              name="employee_partner_code"
              value={formData.employee_partner_code || ''}
              onChange={handleInputChange}
              placeholder="Enter employee or partner code"
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-actions">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Payment'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseSubscriptionPage;

