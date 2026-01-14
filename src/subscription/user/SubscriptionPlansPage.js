// Subscription Plans Page - Display available subscription slabs
import React, { useState, useEffect } from 'react';
import { getInternalSlabs } from '../api/subscriptionApi';
import PlanCard from '../components/PlanCard';
import PaymentModal from '../components/PaymentModal';
import './SubscriptionPlansPage.css';

const SubscriptionPlansPage = ({ onPlanSelect, onContinue }) => {
  const [internalPlans, setInternalPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedInternalPlanId, setSelectedInternalPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrderDetails, setPaymentOrderDetails] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const [bankDetails, setBankDetails] = useState(null);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const internalResponse = await getInternalSlabs();
      setInternalPlans(internalResponse.slabs);
      setBankDetails(internalResponse.bank_details);
      if (internalResponse.slabs.length > 0) {
        setSelectedInternalPlanId(internalResponse.slabs[0].id);
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
      setError('Failed to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInternalPlanSelect = (planId) => {
    setSelectedInternalPlanId(planId);
  };

  const handleContinue = () => {
    if (!selectedInternalPlanId) {
      setError('Please select an internal user plan.');
      return;
    }
    setShowBillingDetails(true);
  };

  if (loading) {
    return (
      <div className="subscription-plans-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-plans-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchPlans} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (showBillingDetails) {
    const selectedInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId);
    
    return (
      <>
      <BillingDetailsScreen
        internalPlan={selectedInternalPlan}
        internalPlans={internalPlans}
        billingCycle={billingCycle}
        selectedInternalPlanId={selectedInternalPlanId}
        bankDetails={bankDetails}
        onPlanChange={(internalPlanId) => {
          if (internalPlanId) setSelectedInternalPlanId(internalPlanId);
        }}
        onBack={() => setShowBillingDetails(false)}
        onContinue={(details) => {
          // Show payment modal instead of directly calling onContinue
          const orderDetails = {
            internalPlan: selectedInternalPlan,
            billingCycle,
            bankDetails: bankDetails,
            ...details
          };
          setPaymentOrderDetails(orderDetails);
          setShowPaymentModal(true);
        }}
        onShowPaymentModal={(orderDetails) => {
          setPaymentOrderDetails(orderDetails);
          setShowPaymentModal(true);
        }}
      />
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentOrderDetails(null);
          }}
          orderDetails={paymentOrderDetails}
          onSuccess={(response) => {
            console.log('Payment successful:', response);
            // Call the original onContinue callback if provided
            if (onContinue && paymentOrderDetails) {
              onContinue(paymentOrderDetails);
            }
            // You can also show a success message or navigate to a success page
            alert('Payment submitted successfully! Your subscription is pending approval.');
          }}
        />
      </>
    );
  }

  const selectedInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId);

  return (
    <div className="subscription-plans-page">
      <div className="plans-page-header">
        <h1>Choose Your Subscription Plan</h1>
        <p>Select the plan that best fits your needs</p>
      </div>

      <div className="billing-cycle-toggle">
        <button
          className={`toggle-button ${billingCycle === 'monthly' ? 'active' : ''}`}
          onClick={() => setBillingCycle('monthly')}
        >
          Monthly
        </button>
        <button
          className={`toggle-button ${billingCycle === 'yearly' ? 'active' : ''}`}
          onClick={() => setBillingCycle('yearly')}
        >
          Yearly
          <span className="savings-badge">Save up to 20%</span>
        </button>
      </div>

      <div className="plans-section">
        <div className="plans-subsection">
          <h2>Subscription Plans</h2>
          <div className="plans-grid">
            {internalPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                isSelected={selectedInternalPlanId === plan.id}
                onSelect={() => handleInternalPlanSelect(plan.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedInternalPlanId && (
        <div className="plans-page-actions">
          <button 
            className="continue-button"
            onClick={handleContinue}
          >
            Continue to Billing Details
          </button>
        </div>
      )}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentOrderDetails(null);
        }}
        orderDetails={paymentOrderDetails}
        onSuccess={(response) => {
          console.log('Payment successful:', response);
          // Call the original onContinue callback if provided
          if (onContinue && paymentOrderDetails) {
            onContinue(paymentOrderDetails);
          }
          // You can also show a success message or navigate to a success page
          alert('Payment submitted successfully! Your subscription is pending approval.');
        }}
      />
    </div>
  );
};

// Billing Details Screen Component
const BillingDetailsScreen = ({ 
  internalPlan, 
  internalPlans = [],
  billingCycle, 
  selectedInternalPlanId,
  bankDetails,
  onPlanChange,
  onBack, 
  onContinue,
  onShowPaymentModal
}) => {
  const [totalInternalUsers, setTotalInternalUsers] = useState(0);

  // Get current plan from ID (in case plan changed)
  const currentInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId) || internalPlan;

  // Reset total users to minimum when plan changes
  useEffect(() => {
    const minUsers = currentInternalPlan?.min_users || 1;
    setTotalInternalUsers(minUsers);
  }, [selectedInternalPlanId, currentInternalPlan]);

  // Get price per user (per-user pricing)
  const internalPricePerUser = billingCycle === 'yearly' 
    ? (currentInternalPlan?.yearly_price || 0) 
    : (currentInternalPlan?.monthly_price || 0);

  // Get minimum and maximum users for plan (default to 1 if not specified)
  const internalMinUsers = currentInternalPlan?.min_users || 1;
  const internalMaxUsers = currentInternalPlan?.max_users || internalMinUsers;

  // Calculate effective total users (use input if >= min, otherwise use min)
  const effectiveInternalUsers = Math.max(internalMinUsers, totalInternalUsers || internalMinUsers);

  // Free external users per internal user
  const freeExternalUsersPerInternalUser = currentInternalPlan?.free_external_users_per_internal_user || 0;
  // Total free external users = freeExternalUsersPerInternalUser * effectiveInternalUsers
  const totalFreeExternalUsers = freeExternalUsersPerInternalUser * effectiveInternalUsers;

  // Find next plan if current plan limit is exceeded
  const findNextInternalPlan = (currentPlanId) => {
    const sortedPlans = [...internalPlans].sort((a, b) => (a.min_users || 0) - (b.min_users || 0));
    const currentIndex = sortedPlans.findIndex(p => p.id === currentPlanId);
    return currentIndex >= 0 && currentIndex < sortedPlans.length - 1 ? sortedPlans[currentIndex + 1] : null;
  };

  // Calculate prices: total users * price per user
  const internalTotalPrice = effectiveInternalUsers * internalPricePerUser;
  
  const totalAmount = internalTotalPrice;

  const handleContinue = () => {
    onContinue({
      totalInternalUsers: effectiveInternalUsers,
      totalAmount,
      totalFreeExternalUsers,
      freeExternalUsersPerInternalUser
    });
  };

  return (
    <div className="billing-details-screen">
      <div className="billing-details-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Plans
        </button>
        <h1>Review Your Order</h1>
      </div>

      <div className="billing-details-content">
        <div className="additional-users-section">
          <h2>Additional Users</h2>
          <div className="user-counter-group">
            <div className="user-counter">
              <label>Additional Internal Users</label>
              <div className="counter-controls">
                <button 
                  className="counter-btn"
                  onClick={() => {
                    const newValue = Math.max(internalMinUsers, (totalInternalUsers || internalMinUsers) - 1);
                    setTotalInternalUsers(newValue);
                  }}
                  disabled={(totalInternalUsers || internalMinUsers) <= internalMinUsers}
                >
                  -
                </button>
                <input 
                  type="number" 
                  value={totalInternalUsers || internalMinUsers} 
                  onChange={(e) => {
                    const inputValue = parseInt(e.target.value) || 0;
                    const value = Math.max(internalMinUsers, inputValue);
                    if (value > internalMaxUsers) {
                      // Auto-switch to next plan if available
                      const nextPlan = findNextInternalPlan(selectedInternalPlanId);
                      if (nextPlan && onPlanChange) {
                        onPlanChange(nextPlan.id);
                        // Reset will happen via useEffect
                      } else {
                        // If no next plan, cap at maximum
                        setTotalInternalUsers(internalMaxUsers);
                      }
                    } else {
                      setTotalInternalUsers(value);
                    }
                  }}
                  min={internalMinUsers}
                  max={internalMaxUsers}
                  className="counter-input"
                />
                <button 
                  className="counter-btn"
                  onClick={() => {
                    const currentValue = totalInternalUsers || internalMinUsers;
                    if (currentValue < internalMaxUsers) {
                      setTotalInternalUsers(currentValue + 1);
                    } else {
                      // Auto-switch to next plan if available
                      const nextPlan = findNextInternalPlan(selectedInternalPlanId);
                      if (nextPlan && onPlanChange) {
                        onPlanChange(nextPlan.id);
                        // Reset will happen via useEffect
                      }
                    }
                  }}
                  disabled={(totalInternalUsers || internalMinUsers) >= internalMaxUsers && !findNextInternalPlan(selectedInternalPlanId)}
                >
                  +
                </button>
              </div>
              <div className="counter-price">
                ₹{internalPricePerUser.toLocaleString('en-IN')} per user per {billingCycle === 'yearly' ? 'year' : 'month'}
                <br />
                <strong>Total: ₹{(effectiveInternalUsers * internalPricePerUser).toLocaleString('en-IN')}/{billingCycle === 'yearly' ? 'year' : 'month'}</strong>
                {internalMaxUsers > internalMinUsers && (
                  <div className="counter-limit">
                    (Range: {internalMinUsers} to {internalMaxUsers} users)
                  </div>
                )}
              </div>
            </div>

            {totalFreeExternalUsers > 0 && (
              <div className="free-users-info" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <strong>Free External Users Included:</strong>
                <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                  You will receive <strong>{totalFreeExternalUsers} free external users</strong> ({freeExternalUsersPerInternalUser} per internal user) with this plan.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="order-summary-section">
          <h2>Order Summary</h2>
          <div className="order-summary-card">
            <div className="order-item">
              <div>
                <strong>{currentInternalPlan?.name || 'Internal Plan'}</strong>
                <div className="order-item-detail">
                  {effectiveInternalUsers} user{effectiveInternalUsers > 1 ? 's' : ''} • {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Billing
                </div>
              </div>
              <div className="order-item-price">
                ₹{internalTotalPrice.toLocaleString('en-IN')} per {billingCycle === 'yearly' ? 'year' : 'month'}
              </div>
            </div>

            {totalFreeExternalUsers > 0 && (
              <div className="order-item">
                <div>
                  <strong>Free External Users</strong>
                  <div className="order-item-detail">
                    {totalFreeExternalUsers} user(s) included ({freeExternalUsersPerInternalUser} per internal user)
                  </div>
                </div>
                <div className="order-item-price">
                  ₹0.00 per {billingCycle === 'yearly' ? 'year' : 'month'}
                </div>
              </div>
            )}

            <div className="order-total">
              <strong>Total Amount</strong>
              <strong className="total-price">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per {billingCycle === 'yearly' ? 'year' : 'month'}</strong>
            </div>

            <div className="payment-methods">
              <div className="payment-methods-label">Accepted Payment Methods:</div>
              <div className="payment-icons">
                <span className="payment-icon">📱 UPI</span>
                <span className="payment-icon">🏦 Netbanking</span>
              </div>
            </div>

            <button className="subscribe-button" onClick={() => {
              const orderDetails = {
                internalPlan: currentInternalPlan,
                billingCycle,
                totalInternalUsers: effectiveInternalUsers,
                totalAmount,
                totalFreeExternalUsers,
                freeExternalUsersPerInternalUser,
                bankDetails: bankDetails
              };
              if (onShowPaymentModal) {
                onShowPaymentModal(orderDetails);
              }
            }}>
              <span className="material-icons">subscriptions</span>
              Subscribe Now & Pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPlansPage;

