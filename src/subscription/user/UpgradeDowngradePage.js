// Upgrade/Downgrade Page - Change subscription plan mid-cycle
import React, { useState, useEffect } from 'react';
import { 
  getCurrentSubscription, 
  getInternalSlabs, 
  calculateUpgradeAmount,
  upgradeSubscription,
  downgradeSubscription
} from '../api/subscriptionApi';
import PlanCard from '../components/PlanCard';
import './UpgradeDowngradePage.css';

const UpgradeDowngradePage = ({ mode = 'upgrade', onSuccess, onCancel }) => {
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [userCount, setUserCount] = useState(null); // For upgrade: total users (current + additional)
  const [paymentData, setPaymentData] = useState({
    payment_method: 'bank_transfer',
    payment_reference: '',
    payment_proof_url: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPlanId && currentSubscription) {
      calculatePreview();
    }
  }, [selectedPlanId, mode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [subscription, plansResponse] = await Promise.all([
        getCurrentSubscription(),
        getInternalSlabs()
      ]);

      setCurrentSubscription(subscription);
      const allPlans = plansResponse.slabs;
      
      // Filter plans based on mode
      if (subscription) {
        const currentSlabId = subscription.internal_slab_id;
        const filteredPlans = allPlans.filter(plan => {
          if (mode === 'upgrade') {
            return plan.id > currentSlabId;
          } else {
            return plan.id < currentSlabId;
          }
        });
        setPlans(filteredPlans);
      } else {
        setPlans(allPlans);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load subscription data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = async () => {
    if (mode !== 'upgrade') return;

    try {
      setCalculating(true);
      setError(null);
      const data = await calculateUpgradeAmount(selectedPlanId);
      setPreviewData(data);
    } catch (err) {
      console.error('Error calculating upgrade:', err);
      setError('Failed to calculate upgrade amount. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(planId);
    setPreviewData(null);
    setShowPaymentForm(false);
    setError(null);
  };

  const handlePaymentInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value || null
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      let result;
      if (mode === 'upgrade') {
        const upgradePayload = {
          new_slab_id: selectedPlanId,
          ...paymentData
        };
        // Add user_count if provided (total users: current + additional)
        if (userCount !== null) {
          upgradePayload.user_count = userCount;
        }
        result = await upgradeSubscription(upgradePayload);
      } else {
        result = await downgradeSubscription({
          new_slab_id: selectedPlanId
        });
      }

      if (result) {
        if (onSuccess) {
          onSuccess(result);
        }
      }
    } catch (err) {
      console.error(`Error ${mode}ing subscription:`, err);
      
      // Handle specific error for downgrade
      if (err.error?.code === 'USER_COUNT_EXCEEDS_LIMIT') {
        setError({
          type: 'user_limit',
          message: err.error.message,
          currentCount: err.error.current_count,
          newLimit: err.error.new_limit,
          excessUsers: err.error.excess_users
        });
      } else {
        setError({
          type: 'general',
          message: err.message || `Failed to ${mode} subscription. Please try again.`
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="upgrade-downgrade-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading subscription data...</p>
        </div>
      </div>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentPlan = currentSubscription 
    ? plans.find(p => p.id === currentSubscription.internal_slab_id)
    : null;

  return (
    <div className="upgrade-downgrade-page">
      <div className="page-header">
        <h1>{mode === 'upgrade' ? 'Upgrade' : 'Downgrade'} Subscription</h1>
        <p>Select a new plan to {mode} your subscription</p>
      </div>

      {currentSubscription && currentPlan && (
        <div className="current-plan-section">
          <h2>Current Plan</h2>
          <PlanCard
            plan={currentPlan}
            billingCycle={currentSubscription.billing_cycle}
            isCurrent={true}
          />
        </div>
      )}

      <div className="available-plans-section">
        <h2>Available Plans</h2>
        {plans.length === 0 ? (
          <p className="no-plans-message">
            No {mode === 'upgrade' ? 'higher' : 'lower'} plans available.
          </p>
        ) : (
          <div className="plans-grid">
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingCycle={currentSubscription?.billing_cycle || 'monthly'}
                isSelected={selectedPlanId === plan.id}
                onSelect={() => handlePlanSelect(plan.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedPlan && mode === 'upgrade' && previewData && (
        <div className="preview-section">
          <h2>Upgrade Preview</h2>
          <div className="preview-card">
            <div className="preview-row">
              <span className="preview-label">Old Price:</span>
              <span className="preview-value">₹{previewData.oldPrice?.toLocaleString('en-IN')}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">New Price:</span>
              <span className="preview-value">₹{previewData.newPrice?.toLocaleString('en-IN')}</span>
            </div>
            <div className="preview-row">
              <span className="preview-label">Days Remaining:</span>
              <span className="preview-value">{previewData.daysRemaining} days</span>
            </div>
            <div className="preview-row highlight">
              <span className="preview-label">Amount to Charge:</span>
              <span className="preview-value">₹{previewData.total_amount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className={`error-container ${error.type === 'user_limit' ? 'error-user-limit' : ''}`}>
          <p className="error-message">{error.message}</p>
          {error.type === 'user_limit' && (
            <div className="error-details">
              <p>Current Users: {error.currentCount}</p>
              <p>New Limit: {error.newLimit}</p>
              <p>Excess Users: {error.excessUsers}</p>
              <p className="error-action">Please remove {error.excessUsers} user(s) before downgrading.</p>
            </div>
          )}
        </div>
      )}

      {selectedPlan && (
        <form onSubmit={handleSubmit} className="upgrade-form">
          {/* User Count Selection for Upgrade - Optional */}
          {mode === 'upgrade' && selectedPlan.min_users !== selectedPlan.max_users && (
            <div className="form-section">
              <h2>Select Total Number of Users</h2>
              <div className="form-group">
                <label htmlFor="user_count">
                  Total Users (Current + Additional) 
                  <span className="field-hint">
                    (Optional - Select between {selectedPlan.min_users} and {selectedPlan.max_users} users. 
                    If not provided, current user count will be used.)
                  </span>
                </label>
                <input
                  type="number"
                  id="user_count"
                  name="user_count"
                  min={selectedPlan.min_users}
                  max={selectedPlan.max_users}
                  value={userCount || ''}
                  onChange={(e) => setUserCount(parseInt(e.target.value) || null)}
                  placeholder={`Enter total users (${selectedPlan.min_users}-${selectedPlan.max_users})`}
                />
                {currentSubscription?.purchased_user_count && (
                  <small className="field-hint">
                    Current users: {currentSubscription.purchased_user_count}
                  </small>
                )}
              </div>
            </div>
          )}

          {mode === 'upgrade' && (
            <div className="payment-section">
              <h2>Payment Details</h2>
              
              <div className="form-group">
                <label htmlFor="payment_method">Payment Method *</label>
                <select
                  id="payment_method"
                  name="payment_method"
                  value={paymentData.payment_method}
                  onChange={handlePaymentInputChange}
                  required
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="payment_reference">Payment Reference *</label>
                <input
                  type="text"
                  id="payment_reference"
                  name="payment_reference"
                  value={paymentData.payment_reference}
                  onChange={handlePaymentInputChange}
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
                  value={paymentData.payment_date}
                  onChange={handlePaymentInputChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="form-group">
                <label htmlFor="payment_proof">Payment Proof (Optional)</label>
                <input
                  type="file"
                  id="payment_proof"
                  name="payment_proof"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
              </div>
            </div>
          )}

          {mode === 'downgrade' && previewData && (
            <div className="downgrade-preview">
              <h2>Downgrade Preview</h2>
              <div className="preview-card">
                <div className="preview-row highlight">
                  <span className="preview-label">Credit Amount:</span>
                  <span className="preview-value">₹{previewData.creditAmount?.toLocaleString('en-IN')}</span>
                </div>
                <p className="preview-note">
                  This amount will be credited to your account and applied to your next billing cycle.
                </p>
              </div>
            </div>
          )}

          <div className="form-actions">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="cancel-button"
                disabled={processing}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="submit-button"
              disabled={processing || calculating}
            >
              {processing 
                ? `${mode === 'upgrade' ? 'Upgrading' : 'Downgrading'}...` 
                : `Confirm ${mode === 'upgrade' ? 'Upgrade' : 'Downgrade'}`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UpgradeDowngradePage;

