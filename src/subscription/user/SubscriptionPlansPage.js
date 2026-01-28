// Subscription Plans Page - Display available subscription slabs
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getInternalSlabs, purchaseSubscription, getCurrentSubscription } from '../api/subscriptionApi';
import PlanCard from '../components/PlanCard';
import PaymentModal from '../components/PaymentModal';
import { calculateTieredPricing } from '../../utils/subscriptionUtils';
import './SubscriptionPlansPage.css';

const SubscriptionPlansPage = ({ onPlanSelect, onContinue }) => {
  const [searchParams] = useSearchParams();
  const fromMySubscription = searchParams.get('from') === 'my_subscription';
  const [internalPlans, setInternalPlans] = useState([]);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedInternalPlanId, setSelectedInternalPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrderDetails, setPaymentOrderDetails] = useState(null);
  const [autoUserCount, setAutoUserCount] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [currentSubscriptionData, setCurrentSubscriptionData] = useState(null);
  const [validatedSubscriptionEndDate, setValidatedSubscriptionEndDate] = useState(null);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  // Fetch current subscription when page loads
  useEffect(() => {
    const fetchCurrentSubscription = async () => {
      try {
        const subscription = await getCurrentSubscription();
        setCurrentSubscriptionData(subscription);
        
        // Auto-select current subscription's plan when plans are loaded
        if (subscription && subscription.internal_slab_id && internalPlans.length > 0) {
          const currentPlan = internalPlans.find(p => p.id === subscription.internal_slab_id);
          if (currentPlan) {
            // Only set if no plan is selected yet, or if coming from "Subscription Plan" button
            if (!selectedInternalPlanId || selectedInternalPlanId !== subscription.internal_slab_id) {
              setSelectedInternalPlanId(subscription.internal_slab_id);
            }
            // Also set billing cycle to match current subscription
            if (subscription.billing_cycle && subscription.billing_cycle !== billingCycle) {
              setBillingCycle(subscription.billing_cycle);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching current subscription on page load:', error);
        setCurrentSubscriptionData(null);
      }
    };
    fetchCurrentSubscription();
  }, [internalPlans.length]); // Re-run when plans are loaded

  // Handle renewal and increase users query parameters
  useEffect(() => {
    const isRenewal = searchParams.get('renewal') === 'true';
    const isIncreaseUsers = searchParams.get('increase_users') === 'true';
    
    if ((isRenewal || isIncreaseUsers) && internalPlans.length > 0 && currentSubscriptionData) {
      const planId = searchParams.get('plan_id');
      const billingCycleParam = searchParams.get('billing_cycle');
      const userCountParam = searchParams.get('user_count');
      const endDateParam = searchParams.get('end_date');
      
      // Validate URL parameters against actual subscription data
      const actualPlanId = currentSubscriptionData.internal_slab_id;
      const actualBillingCycle = currentSubscriptionData.billing_cycle || 'monthly';
      const actualUserCount = currentSubscriptionData.purchased_user_count || currentSubscriptionData.usage?.internal_users?.limit || 0;
      const actualEndDate = currentSubscriptionData.end_date || currentSubscriptionData.current_period_end;
      
      // Only use URL parameters if they match the actual subscription data
      // This prevents URL manipulation
      const validatedPlanId = (planId && parseInt(planId) === actualPlanId) ? parseInt(planId) : actualPlanId;
      const validatedBillingCycle = (billingCycleParam && billingCycleParam === actualBillingCycle) ? billingCycleParam : actualBillingCycle;
      const validatedUserCount = (userCountParam && parseInt(userCountParam) === actualUserCount) ? parseInt(userCountParam) : actualUserCount;
      const validatedEndDate = (endDateParam && endDateParam === actualEndDate) ? endDateParam : actualEndDate;
      
      // Log warning if URL parameters don't match (potential manipulation attempt)
      if (planId && parseInt(planId) !== actualPlanId) {
        console.warn('URL parameter plan_id does not match current subscription. Using actual subscription data.');
      }
      if (billingCycleParam && billingCycleParam !== actualBillingCycle) {
        console.warn('URL parameter billing_cycle does not match current subscription. Using actual subscription data.');
      }
      if (userCountParam && parseInt(userCountParam) !== actualUserCount) {
        console.warn('URL parameter user_count does not match current subscription. Using actual subscription data.');
      }
      if (endDateParam && endDateParam !== actualEndDate) {
        console.warn('URL parameter end_date does not match current subscription. Using actual subscription data.');
      }
      
      // Set validated values
      if (validatedPlanId) {
        const plan = internalPlans.find(p => p.id === validatedPlanId);
        if (plan) {
          setSelectedInternalPlanId(validatedPlanId);
        }
      }
      
      if (validatedBillingCycle && (validatedBillingCycle === 'monthly' || validatedBillingCycle === 'yearly')) {
        setBillingCycle(validatedBillingCycle);
      }
      
      if (validatedUserCount > 0) {
        setAutoUserCount(validatedUserCount);
      }
      
      // Store validated end date for use in BillingDetailsScreen
      if (validatedEndDate) {
        setValidatedSubscriptionEndDate(validatedEndDate);
      } else if (currentSubscriptionData) {
        // Fallback to actual subscription end date
        const actualEndDate = currentSubscriptionData.end_date || currentSubscriptionData.current_period_end;
        setValidatedSubscriptionEndDate(actualEndDate);
      }
      
      // For renewal: Auto-show payment modal directly (skip billing details screen)
      // Use validated values instead of URL parameters
      if (isRenewal && validatedPlanId && validatedBillingCycle && validatedUserCount > 0 && bankDetails) {
        // Wait a bit for plans and bank details to be set, then fetch wallet balance
        setTimeout(async () => {
          const selectedPlan = internalPlans.find(p => p.id === validatedPlanId);
          if (selectedPlan) {
            const userCount = validatedUserCount;
            // Calculate tiered pricing instead of flat per-user pricing
            const tieredPricing = calculateTieredPricing(internalPlans, userCount, validatedBillingCycle);
            const baseTotalAmount = tieredPricing?.totalAmount || 0;
            
            // Fetch wallet balance for renewal
            let walletBalance = 0;
            let walletBalanceToApply = 0;
            try {
              const subscription = await getCurrentSubscription();
              if (subscription && subscription.wallet_balance !== undefined) {
                walletBalance = subscription.wallet_balance || 0;
                // Calculate wallet balance to apply (reduce from total amount)
                walletBalanceToApply = (walletBalance > 0 && baseTotalAmount > 0) 
                  ? Math.min(walletBalance, baseTotalAmount) 
                  : 0;
              }
            } catch (error) {
              console.error('Error fetching wallet balance for renewal:', error);
            }
            
            // Calculate final total amount after wallet balance deduction
            const totalAmount = Math.max(0, baseTotalAmount - walletBalanceToApply);
            const freeExternalUsersPerInternalUser = selectedPlan.free_external_users_per_internal_user || 10;
            const totalFreeExternalUsers = userCount * freeExternalUsersPerInternalUser;
            
            // If total amount is 0 or less (fully covered by wallet balance), call API directly
            if (totalAmount <= 0) {
              try {
                const renewalData = {
                  action: 'renewal',
                  internal_slab_id: selectedPlan.id,
                  billing_cycle: validatedBillingCycle,
                  user_count: userCount,
                  total_amount: baseTotalAmount,
                  wallet_utilized_amount: walletBalanceToApply,
                  employee_partner_code: (() => {
                    // Get employee/partner code from sessionStorage (last used code)
                    const employeeCode = sessionStorage.getItem('employee_code');
                    const partnerCode = sessionStorage.getItem('partner_code');
                    // Prefer employee code over partner code (employees have priority)
                    return employeeCode || partnerCode || null;
                  })(),
                  payment_method: null,
                  payment_reference: null,
                  payment_proof_url: null,
                  payment_date: null
                };
                
                const response = await purchaseSubscription(renewalData);
                
                if (response) {
                  // Show success message
                  let successMessage = 'Subscription renewed successfully!';
                  if (walletBalanceToApply > 0) {
                    successMessage = `Subscription renewed successfully! ₹${walletBalanceToApply.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been deducted from your wallet.`;
                  }
                  alert(successMessage);
                  
                  // Navigate to current subscription page
                  const basename = process.env.REACT_APP_HOMEPAGE || '';
                  const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
                  window.location.href = path;
                }
              } catch (error) {
                console.error('Error processing renewal:', error);
                const errorMessage = error?.message || error?.error?.message || 'Failed to process renewal. Please try again.';
                alert(errorMessage);
              }
              return; // Don't show payment modal
            }
            
            // If payment is required, show payment modal
            const orderDetails = {
              action: 'renewal',
              internalPlan: selectedPlan,
              billingCycle: validatedBillingCycle,
              bankDetails: bankDetails,
              totalInternalUsers: userCount,
              totalAmount,
              baseTotalAmount, // Store base amount before wallet deduction
              totalFreeExternalUsers,
              freeExternalUsersPerInternalUser,
              walletBalance, // Current wallet balance
              walletBalance: walletBalanceToApply // Amount to be utilized
            };
            setPaymentOrderDetails(orderDetails);
            setShowPaymentModal(true);
          }
        }, 500);
      }
      
      // For increase users: Auto-show billing details screen (Review Your Order page) immediately
      // Use validated values instead of URL parameters
      if (isIncreaseUsers && validatedPlanId && validatedBillingCycle && validatedUserCount > 0) {
        // Set showBillingDetails immediately without delay to skip plans page
        setShowBillingDetails(true);
      }
    }
  }, [searchParams, internalPlans, bankDetails, currentSubscriptionData]);

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

  // Check if coming from upgrade/downgrade or renewal - if so, skip plans page
  const isIncreaseUsersFromUrl = searchParams.get('increase_users') === 'true';
  const isRenewal = searchParams.get('renewal') === 'true';
  const shouldShowBillingDetailsDirectly = isIncreaseUsersFromUrl && 
    internalPlans.length > 0 && 
    currentSubscriptionData && 
    selectedInternalPlanId &&
    autoUserCount;
  
  // For renewal, we show payment modal directly, so we need to hide the plans page
  const isRenewalMode = isRenewal && internalPlans.length > 0 && currentSubscriptionData && bankDetails;

  if (shouldShowBillingDetailsDirectly || showBillingDetails) {
    const selectedInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId);
    const isIncreaseUsers = isIncreaseUsersFromUrl || showBillingDetails;
    
    return (
      <>
      <BillingDetailsScreen
        internalPlan={selectedInternalPlan}
        internalPlans={internalPlans}
        billingCycle={billingCycle}
        selectedInternalPlanId={selectedInternalPlanId}
        bankDetails={bankDetails}
        autoUserCount={autoUserCount}
        subscriptionEndDate={validatedSubscriptionEndDate || (currentSubscriptionData ? (currentSubscriptionData.end_date || currentSubscriptionData.current_period_end) : null)}
        currentUserCount={autoUserCount || (currentSubscriptionData ? (currentSubscriptionData.purchased_user_count || currentSubscriptionData.usage?.internal_users?.limit || null) : null)}
        isIncreaseUsers={isIncreaseUsers}
        onPlanChange={(internalPlanId) => {
          if (internalPlanId) setSelectedInternalPlanId(internalPlanId);
        }}
        onBack={() => setShowBillingDetails(false)}
        onContinue={(details) => {
          // Show payment modal instead of directly calling onContinue
          const isIncreaseUsers = searchParams.get('increase_users') === 'true';
          const orderDetails = {
            action: isIncreaseUsers ? 'upgrade' : 'purchase',
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
            // If renewal mode, navigate back to My Subscription page
            if (isRenewal) {
              const basename = process.env.REACT_APP_HOMEPAGE || '';
              const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
              window.location.href = path;
            }
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
  
  // For renewal mode, don't show plans page - payment modal will be shown directly
  if (isRenewalMode && !showPaymentModal) {
    // Show loading state while payment modal is being prepared
    return (
      <div className="subscription-plans-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Preparing renewal...</p>
        </div>
      </div>
    );
  }

  const selectedInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId);

  return (
    <div className="subscription-plans-page">
      <div className="plans-page-header">
        <h1>Subscription Plan</h1>
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
        </button>
      </div>

      <div className="plans-section">
        <div className="plans-subsection">
          <h2>Subscription Plans</h2>
          <div className="plans-grid">
            {internalPlans.map(plan => {
              const isCurrentPlan = currentSubscriptionData && currentSubscriptionData.internal_slab_id === plan.id;
              // Check if user has active subscription (not trial, not expired)
              const hasActiveSubscription = currentSubscriptionData && 
                currentSubscriptionData.status === 'active' && 
                !currentSubscriptionData.is_trial;
              // Show select button if: not from my subscription OR user doesn't have active subscription (trial/no subscription) OR it's the current plan
              const shouldShowSelectButton = !fromMySubscription || !hasActiveSubscription || isCurrentPlan;
              return (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  isSelected={selectedInternalPlanId === plan.id}
                  isCurrent={isCurrentPlan}
                  onSelect={shouldShowSelectButton ? () => handleInternalPlanSelect(plan.id) : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>

      {(() => {
        // Check if user has active subscription (not trial, not expired)
        const hasActiveSubscription = currentSubscriptionData && 
          currentSubscriptionData.status === 'active' && 
          !currentSubscriptionData.is_trial;
        // Show continue button if: not from my subscription OR user doesn't have active subscription (trial/no subscription)
        // Also show if user has selected their current plan (to allow proceeding to billing)
        const isCurrentPlanSelected = currentSubscriptionData && 
          currentSubscriptionData.internal_slab_id === selectedInternalPlanId;
        const shouldShowContinueButton = (!fromMySubscription || !hasActiveSubscription || isCurrentPlanSelected) && 
          selectedInternalPlanId;
        
        return shouldShowContinueButton ? (
          <div className="plans-page-actions">
            <button 
              className="continue-button"
              onClick={handleContinue}
            >
              Continue to Billing Details
            </button>
          </div>
        ) : null;
      })()}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentOrderDetails(null);
          // If renewal mode, navigate back to My Subscription page
          if (isRenewal) {
            const basename = process.env.REACT_APP_HOMEPAGE || '';
            const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
            window.location.href = path;
          }
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
  autoUserCount = null,
  subscriptionEndDate = null,
  currentUserCount = null,
  isIncreaseUsers = false,
  onPlanChange,
  onBack, 
  onContinue,
  onShowPaymentModal
}) => {
  const [totalInternalUsers, setTotalInternalUsers] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState(billingCycle);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  // Get current plan from ID (in case plan changed)
  const currentInternalPlan = internalPlans.find(p => p.id === selectedInternalPlanId) || internalPlan;

  // Find the appropriate slab based on user count
  const findSlabForUserCount = (userCount) => {
    if (!userCount || userCount < 1) return null;
    
    // Sort plans by min_users ascending
    const sortedPlans = [...internalPlans].sort((a, b) => (a.min_users || 0) - (b.min_users || 0));
    
    // Find the plan where userCount falls within its range
    for (let i = sortedPlans.length - 1; i >= 0; i--) {
      const plan = sortedPlans[i];
      const minUsers = plan.min_users || 1;
      const maxUsers = plan.max_users || minUsers;
      
      if (userCount >= minUsers && userCount <= maxUsers) {
        return plan;
      }
    }
    
    // If user count exceeds all plans, return the highest plan
    if (sortedPlans.length > 0) {
      return sortedPlans[sortedPlans.length - 1];
    }
    
    return null;
  };

  // Fetch current subscription to get wallet balance and current plan details
  useEffect(() => {
    const fetchCurrentSubscription = async () => {
      try {
        const subscription = await getCurrentSubscription();
        // Store the full subscription for accessing current plan details
        setCurrentSubscription(subscription);
        // Wallet balance is included in the current subscription response
        if (subscription && subscription.wallet_balance !== undefined) {
          setWalletBalance(subscription.wallet_balance || 0);
        } else {
          setWalletBalance(0);
        }
      } catch (error) {
        console.error('Error fetching current subscription:', error);
        setCurrentSubscription(null);
        setWalletBalance(0);
      }
    };
    fetchCurrentSubscription();
  }, []);

  // Helper function to check if subscription has expired based on end_date
  const isSubscriptionExpired = (subscription) => {
    if (!subscription || !subscription.end_date) {
      return false;
    }
    const endDate = new Date(subscription.end_date);
    const today = new Date();
    // Set both dates to start of day for accurate comparison
    const endStartOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return endStartOfDay < todayStartOfDay;
  };

  // Check if it's trial or no subscription (treat as first-time subscription)
  // Also treat expired subscriptions as no subscription (allow new purchase)
  const isTrialOrNoSubscription = !currentSubscription || 
    currentSubscription.is_trial || 
    currentSubscription.status !== 'active' ||
    isSubscriptionExpired(currentSubscription);
  
  // For trial/no subscription, treat as first-time subscription (not upgrade/downgrade)
  const effectiveIsIncreaseUsers = isTrialOrNoSubscription ? false : isIncreaseUsers;

  // Initialize user count when component first loads (only once, don't reset on slab change)
  useEffect(() => {
    if (autoUserCount && autoUserCount > 0 && totalInternalUsers === 0) {
      setTotalInternalUsers(autoUserCount);
    } else if (totalInternalUsers === 0 && currentInternalPlan) {
      if (isTrialOrNoSubscription) {
        // For trial/no subscription, auto-fill with plan's min_users
        const minUsers = currentInternalPlan.min_users || 1;
        setTotalInternalUsers(minUsers);
      } else if (!effectiveIsIncreaseUsers) {
        // Only set to min users if it's a new selection (not upgrade/downgrade mode)
        const minUsers = currentInternalPlan.min_users || 1;
        setTotalInternalUsers(minUsers);
      }
    }
  }, [autoUserCount, isTrialOrNoSubscription, currentInternalPlan]); // Include isTrialOrNoSubscription and currentInternalPlan

  // Auto-switch slab when user count is outside current slab range
  useEffect(() => {
    if (totalInternalUsers > 0 && currentInternalPlan && internalPlans.length > 0) {
      const minUsers = currentInternalPlan.min_users || 1;
      const maxUsers = currentInternalPlan.max_users || minUsers;
      
      // Check if user count is outside current slab range
      if (totalInternalUsers < minUsers || totalInternalUsers > maxUsers) {
        const appropriateSlab = findSlabForUserCount(totalInternalUsers);
        if (appropriateSlab && appropriateSlab.id !== selectedInternalPlanId && onPlanChange) {
          // Use setTimeout to avoid state update conflicts
          setTimeout(() => {
            onPlanChange(appropriateSlab.id);
          }, 0);
        }
      }
    }
  }, [totalInternalUsers, currentInternalPlan, selectedInternalPlanId, onPlanChange, internalPlans]);

  // Get price per user (per-user pricing) for the selected plan
  // Use selectedBillingCycle for upgrade/downgrade, fallback to billingCycle prop
  const effectiveBillingCycle = isIncreaseUsers ? selectedBillingCycle : billingCycle;
  const internalPricePerUser = effectiveBillingCycle === 'yearly' 
    ? (currentInternalPlan?.yearly_price || 0) 
    : (currentInternalPlan?.monthly_price || 0);

  // Get price per user for the current subscription plan
  const getCurrentPlanPricePerUser = () => {
    if (!currentSubscription || !currentSubscription.internal_slab_id || !internalPlans.length) {
      return internalPricePerUser; // Fallback to selected plan price
    }
    
    // Find the current plan from internalPlans using internal_slab_id
    const currentPlan = internalPlans.find(p => p.id === currentSubscription.internal_slab_id);
    if (!currentPlan) {
      return internalPricePerUser; // Fallback to selected plan price
    }
    
    // Get price based on current subscription's billing cycle
    const currentBillingCycle = currentSubscription.billing_cycle || 'monthly';
    return currentBillingCycle === 'yearly'
      ? (currentPlan.yearly_price || 0)
      : (currentPlan.monthly_price || 0);
  };

  const currentPlanPricePerUser = getCurrentPlanPricePerUser();

  // Get minimum and maximum users for plan (default to 1 if not specified)
  const internalMinUsers = currentInternalPlan?.min_users || 1;
  const internalMaxUsers = currentInternalPlan?.max_users || internalMinUsers;

  // For upgrade/downgrade mode, allow any user count (no restrictions)
  // For regular mode, use the user input directly
  const effectiveInternalUsers = totalInternalUsers || (isIncreaseUsers && currentUserCount ? currentUserCount : internalMinUsers);

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

  // Calculate prorated amount for increase users flow
  const calculateProratedAmount = () => {
    // For trial/no subscription, don't calculate proration (treat as first-time subscription)
    if (isTrialOrNoSubscription) {
      return null;
    }
    if (!effectiveIsIncreaseUsers || !subscriptionEndDate || !currentUserCount) {
      return null;
    }
    
    const endDate = new Date(subscriptionEndDate);
    const today = new Date();
    
    // Set both dates to start of day for accurate calculation
    const endStartOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = endStartOfDay - todayStartOfDay;
    // Add 1 to include the expiry date itself in the calculation
    // Formula: (end_date - today) + 1
    const remainingDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
    
    if (remainingDays <= 0) {
      return null; // Subscription expired, no proration
    }
    
    // Calculate total days in billing cycle - use current subscription's billing cycle for remaining days calculation
    const currentBillingCycle = currentSubscription?.billing_cycle || billingCycle;
    const totalDaysInCycle = currentBillingCycle === 'yearly' ? 365 : 30;
    
    // For new amount calculation, use the selected billing cycle (if changed)
    const newBillingCycleDays = effectiveBillingCycle === 'yearly' ? 365 : 30;
    
    // Calculate additional users (new count - current count)
    // Can be positive (upgrade) or negative (downgrade)
    const additionalUsers = effectiveInternalUsers - currentUserCount;
    
    // Calculate prorated amount using tiered pricing:
    // Current paid amount = tiered_price_for_current_users * (remaining_days / current_billing_cycle_days)
    // New amount = tiered_price_for_new_users * (remaining_days / new_billing_cycle_days)
    // Prorated amount = new_amount - current_paid_amount
    
    // Calculate tiered pricing for current users (currentBillingCycle already declared above)
    const currentTieredPricing = calculateTieredPricing(internalPlans, currentUserCount, currentBillingCycle);
    const currentPaidForRemainingDays = (remainingDays / totalDaysInCycle) * currentTieredPricing.totalAmount;
    
    // Calculate new amount based on billing cycle change:
    // - If switching from yearly to monthly: use full monthly amount (no proration)
    // - If switching from monthly to yearly: use full yearly amount (no proration)
    // - If staying in same cycle: prorate by remaining days
    let newAmountForRemainingDays;
    const newTieredPricing = calculateTieredPricing(internalPlans, effectiveInternalUsers, effectiveBillingCycle);
    
    if (currentBillingCycle === 'yearly' && effectiveBillingCycle === 'monthly') {
      // Switching from yearly to monthly: use full monthly amount
      newAmountForRemainingDays = newTieredPricing.totalAmount;
    } else if (currentBillingCycle === 'monthly' && effectiveBillingCycle === 'yearly') {
      // Switching from monthly to yearly: use full yearly amount
      newAmountForRemainingDays = newTieredPricing.totalAmount;
    } else if (effectiveBillingCycle === 'yearly') {
      // Staying yearly: prorate by remainingDays / 365
      newAmountForRemainingDays = (remainingDays / newBillingCycleDays) * newTieredPricing.totalAmount;
    } else {
      // Staying monthly: prorate by remainingDays / 30
      newAmountForRemainingDays = (remainingDays / newBillingCycleDays) * newTieredPricing.totalAmount;
    }
    
    const proratedAmount = newAmountForRemainingDays - currentPaidForRemainingDays;
    
    return {
      remainingDays,
      totalDaysInCycle,
      additionalUsers,
      proratedAmount: Math.round(proratedAmount * 100) / 100 // Round to 2 decimal places
    };
  };

  const proratedInfo = calculateProratedAmount();

  // Calculate tiered pricing: each user is charged based on the slab they fall into
  const tieredPricing = calculateTieredPricing(internalPlans, effectiveInternalUsers, effectiveBillingCycle) || { totalAmount: 0, breakdown: [] };
  const internalTotalPrice = tieredPricing.totalAmount || 0;
  
  // Calculate current paid amount (for remaining days) in upgrade/downgrade mode
  const calculateCurrentPaidAmount = () => {
    // For trial/no subscription, no current paid amount (treat as first-time subscription)
    if (isTrialOrNoSubscription) {
      return 0;
    }
    if (!effectiveIsIncreaseUsers || !subscriptionEndDate || !currentUserCount || !proratedInfo) {
      return 0;
    }
    
    // Current paid amount = tiered price for current users * (remaining days / total days)
    // Use tiered pricing for current users with current billing cycle
    const currentBillingCycle = currentSubscription?.billing_cycle || billingCycle;
    const currentTieredPricing = calculateTieredPricing(internalPlans, currentUserCount, currentBillingCycle);
    const currentPaidAmount = (proratedInfo.remainingDays / proratedInfo.totalDaysInCycle) * currentTieredPricing.totalAmount;
    return Math.round(currentPaidAmount * 100) / 100;
  };

  const currentPaidAmount = calculateCurrentPaidAmount();
  
  // Calculate total amount for new users (for remaining days) in upgrade/downgrade mode
  const calculateNewTotalAmount = () => {
    // For trial/no subscription, return full price (no proration)
    if (isTrialOrNoSubscription) {
      return internalTotalPrice;
    }
    if (!effectiveIsIncreaseUsers || !subscriptionEndDate || !proratedInfo) {
      return internalTotalPrice;
    }
    
    // Calculate new amount based on billing cycle change using tiered pricing:
    // - If switching from yearly to monthly: use full monthly amount (no proration)
    // - If switching from monthly to yearly: use full yearly amount (no proration)
    // - If staying in same cycle: prorate by remaining days
    const currentBillingCycle = currentSubscription?.billing_cycle || billingCycle;
    const newTieredPricing = calculateTieredPricing(internalPlans, effectiveInternalUsers, effectiveBillingCycle);
    let newTotalAmount;
    if (currentBillingCycle === 'yearly' && effectiveBillingCycle === 'monthly') {
      // Switching from yearly to monthly: use full monthly amount
      newTotalAmount = newTieredPricing.totalAmount;
    } else if (currentBillingCycle === 'monthly' && effectiveBillingCycle === 'yearly') {
      // Switching from monthly to yearly: use full yearly amount
      newTotalAmount = newTieredPricing.totalAmount;
    } else if (effectiveBillingCycle === 'yearly') {
      // Staying yearly: prorate by remainingDays / 365
      const newBillingCycleDays = 365;
      newTotalAmount = (proratedInfo.remainingDays / newBillingCycleDays) * newTieredPricing.totalAmount;
    } else {
      // Staying monthly: prorate by remainingDays / 30
      const newBillingCycleDays = 30;
      newTotalAmount = (proratedInfo.remainingDays / newBillingCycleDays) * newTieredPricing.totalAmount;
    }
    return Math.round(newTotalAmount * 100) / 100;
  };

  const newTotalAmount = calculateNewTotalAmount();
  
  // Calculate base total amount before wallet balance deduction
  // For increase users: net amount after subtracting current paid amount (proratedAmount)
  // For regular flow (including trial/no subscription): full price
  const baseTotalAmount = (effectiveIsIncreaseUsers && proratedInfo && !isTrialOrNoSubscription)
    ? proratedInfo.proratedAmount
    : internalTotalPrice;

  // Calculate total amount after deducting wallet balance (if applicable)
  // Only apply wallet balance if it's greater than 0 and total amount is positive
  const walletBalanceToApply = (walletBalance > 0 && baseTotalAmount > 0) 
    ? Math.min(walletBalance, baseTotalAmount) 
    : 0;
  const totalAmount = Math.max(0, baseTotalAmount - walletBalanceToApply);

  const handleContinue = () => {
    onContinue({
      totalInternalUsers: effectiveInternalUsers,
      totalAmount,
      totalFreeExternalUsers,
      freeExternalUsersPerInternalUser,
      proratedInfo: proratedInfo || null,
      isIncreaseUsers: isIncreaseUsers || false,
      walletBalance: walletBalanceToApply,
      billingCycle: effectiveBillingCycle // Include selected billing cycle
    });
  };

  return (
    <div className="billing-details-screen">
      <div className="billing-details-header">
        {!isIncreaseUsers && (
          <button className="back-button" onClick={onBack}>
            ← Back to Plans
          </button>
        )}
        <h1>Review Your Order</h1>
      </div>

      <div className="billing-details-content">
        <div className="additional-users-section">
          <h2>Additional Users</h2>
          <div className="user-counter-group">
            <div className="user-counter">
              <label>{isIncreaseUsers ? 'Internal Users' : 'Additional Internal Users'}</label>
              <div className="counter-controls">
                <button 
                  className="counter-btn"
                  onClick={() => {
                    const newValue = Math.max(1, (totalInternalUsers || (isIncreaseUsers && currentUserCount ? currentUserCount : internalMinUsers)) - 1);
                    setTotalInternalUsers(newValue);
                    
                    // Auto-switch to appropriate slab if user count is outside current slab range
                    // Use setTimeout to ensure state is updated first
                    setTimeout(() => {
                      const appropriateSlab = findSlabForUserCount(newValue);
                      if (appropriateSlab && appropriateSlab.id !== selectedInternalPlanId && onPlanChange) {
                        onPlanChange(appropriateSlab.id);
                      }
                    }, 0);
                  }}
                  disabled={(totalInternalUsers || internalMinUsers) <= 1}
                >
                  -
                </button>
                <input 
                  type="number" 
                  value={totalInternalUsers > 0 ? totalInternalUsers : (isIncreaseUsers && currentUserCount ? currentUserCount : (internalMinUsers || 1))} 
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    // Allow empty string while typing
                    if (inputValue === '' || inputValue === null || inputValue === undefined) {
                      // Don't reset, allow user to clear and type
                      return;
                    }
                    
                    const parsedValue = parseInt(inputValue, 10);
                    // Allow any positive number, including values outside current slab range
                    if (isNaN(parsedValue) || parsedValue < 1) {
                      // Only prevent negative or zero values - but allow typing
                      return;
                    }
                    
                    // Always set the value, regardless of slab range
                    setTotalInternalUsers(parsedValue);
                    
                    // Auto-switch to appropriate slab if user count is outside current slab range
                    // Use setTimeout to ensure state is updated first
                    setTimeout(() => {
                      const appropriateSlab = findSlabForUserCount(parsedValue);
                      if (appropriateSlab && appropriateSlab.id !== selectedInternalPlanId && onPlanChange) {
                        onPlanChange(appropriateSlab.id);
                      }
                    }, 10);
                  }}
                  onBlur={(e) => {
                    // Ensure value is preserved on blur
                    const inputValue = e.target.value;
                    if (!inputValue || inputValue === '') {
                      // If empty, restore to current value
                      const restoreValue = totalInternalUsers > 0 
                        ? totalInternalUsers 
                        : (effectiveIsIncreaseUsers && currentUserCount ? currentUserCount : (internalMinUsers || 1));
                      setTotalInternalUsers(restoreValue);
                    } else {
                      const parsedValue = parseInt(inputValue, 10);
                      if (isNaN(parsedValue) || parsedValue < 1) {
                        // If invalid, restore to current value
                        const restoreValue = totalInternalUsers > 0 
                          ? totalInternalUsers 
                          : (effectiveIsIncreaseUsers && currentUserCount ? currentUserCount : (internalMinUsers || 1));
                        setTotalInternalUsers(restoreValue);
                      } else {
                        // Valid value, ensure it's set
                        setTotalInternalUsers(parsedValue);
                      }
                    }
                  }}
                  min={1}
                  step={1}
                  className="counter-input"
                  style={{ WebkitAppearance: 'textfield' }}
                />
                <button 
                  className="counter-btn"
                  onClick={() => {
                    const currentValue = totalInternalUsers || (effectiveIsIncreaseUsers && currentUserCount ? currentUserCount : internalMinUsers);
                    const newValue = currentValue + 1;
                    setTotalInternalUsers(newValue);
                    
                    // Auto-switch to appropriate slab if user count is outside current slab range
                    // Use setTimeout to ensure state is updated first
                    setTimeout(() => {
                      const appropriateSlab = findSlabForUserCount(newValue);
                      if (appropriateSlab && appropriateSlab.id !== selectedInternalPlanId && onPlanChange) {
                        onPlanChange(appropriateSlab.id);
                      }
                    }, 0);
                  }}
                >
                  +
                </button>
              </div>
              <div className="counter-price">
                {tieredPricing.breakdown && tieredPricing.breakdown.length > 0 && tieredPricing.breakdown.length === 1 && tieredPricing.breakdown[0]?.pricePerUser ? (
                  // Single slab: show per-user price
                  <>₹{tieredPricing.breakdown[0].pricePerUser.toLocaleString('en-IN')} per user per {effectiveBillingCycle === 'yearly' ? 'year' : 'month'}</>
                ) : (
                  // Multiple slabs: show tiered pricing
                  <>Tiered pricing (based on user position)</>
                )}
                <br />
                {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo ? (
                  proratedInfo.additionalUsers > 0 ? (
                    <>
                      <strong>Prorated Amount: ₹{proratedInfo.proratedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        ({proratedInfo.remainingDays} days remaining of {proratedInfo.totalDaysInCycle} days • {proratedInfo.additionalUsers} additional user{proratedInfo.additionalUsers > 1 ? 's' : ''})
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>Amount: ₹0.00</strong>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        (No additional users selected)
                      </div>
                    </>
                  )
                ) : (
                  <strong>Total: ₹{internalTotalPrice.toLocaleString('en-IN')}/{effectiveBillingCycle === 'yearly' ? 'year' : 'month'}</strong>
                )}
                {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && currentUserCount && (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
                    <strong>Current Subscription:</strong> {currentUserCount} user{currentUserCount > 1 ? 's' : ''} • Valid till {subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                  </div>
                )}
                {!isTrialOrNoSubscription && currentInternalPlan && (
                  <div className="counter-limit">
                    (Current Plan: {currentInternalPlan.name || `Slab ${currentInternalPlan.id}`} - Range: {internalMinUsers} to {internalMaxUsers} users)
                  </div>
                )}
              </div>
            </div>

            {/* Billing Cycle Selection for Upgrade/Downgrade */}
            {isIncreaseUsers && (
              <div className="billing-cycle-selection" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9ff', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#1a1a1a' }}>
                  Billing Cycle
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedBillingCycle('monthly')}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      border: `2px solid ${selectedBillingCycle === 'monthly' ? '#667eea' : '#e0e7ff'}`,
                      borderRadius: '8px',
                      backgroundColor: selectedBillingCycle === 'monthly' ? '#667eea' : '#ffffff',
                      color: selectedBillingCycle === 'monthly' ? '#ffffff' : '#1a1a1a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBillingCycle('yearly')}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      border: `2px solid ${selectedBillingCycle === 'yearly' ? '#667eea' : '#e0e7ff'}`,
                      borderRadius: '8px',
                      backgroundColor: selectedBillingCycle === 'yearly' ? '#667eea' : '#ffffff',
                      color: selectedBillingCycle === 'yearly' ? '#ffffff' : '#1a1a1a',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Yearly
                  </button>
                </div>
                {currentSubscription?.billing_cycle && currentSubscription.billing_cycle !== selectedBillingCycle && (
                  <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>
                    <strong>Note:</strong> You are changing from {currentSubscription.billing_cycle === 'yearly' ? 'Yearly' : 'Monthly'} to {selectedBillingCycle === 'yearly' ? 'Yearly' : 'Monthly'} billing cycle.
                  </div>
                )}
              </div>
            )}

            {totalFreeExternalUsers > 0 && (
              <div className="free-users-info" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
                <strong>Free External Users Included:</strong>
                <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                  You will receive <strong>{totalFreeExternalUsers} free external users</strong> ({freeExternalUsersPerInternalUser} per internal user) with this plan.
                </p>
              </div>
            )}

            {/* Show wallet balance on left side when increasing or reducing users, or for regular purchases */}
            {/* For trial/no subscription, show wallet balance if available */}
            {((!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo) || (!effectiveIsIncreaseUsers && walletBalance > 0) || (isTrialOrNoSubscription && walletBalance > 0)) && (
              <div className="free-users-info" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                <strong>Wallet Balance:</strong>
                <p style={{ margin: '8px 0 0 0', color: '#666' }}>
                  {walletBalance > 0 ? (
                    <>Current wallet balance: <strong>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></>
                  ) : (
                    <>No wallet balance available</>
                  )}
                  {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.additionalUsers > 0 && walletBalanceToApply > 0 && (
                    <><br />Wallet balance of <strong>₹{walletBalanceToApply.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> will be applied to this order.</>
                  )}
                  {(!effectiveIsIncreaseUsers || isTrialOrNoSubscription) && walletBalanceToApply > 0 && (
                    <><br />Wallet balance of <strong>₹{walletBalanceToApply.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> will be applied to this order.</>
                  )}
                  {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.proratedAmount < 0 && (
                    <><br />Credit amount <strong>₹{Math.abs(proratedInfo.proratedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> will be added to your wallet.</>
                  )}
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
                  {effectiveInternalUsers} user{effectiveInternalUsers > 1 ? 's' : ''} • {effectiveBillingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Billing
                  {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && currentUserCount && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Current: {currentUserCount} user{currentUserCount > 1 ? 's' : ''} • Selected: {effectiveInternalUsers} user{effectiveInternalUsers > 1 ? 's' : ''}
                      {proratedInfo && proratedInfo.remainingDays > 0 && (
                        <> • Prorated for {proratedInfo.remainingDays} days</>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="order-item-price">
                {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.remainingDays > 0 ? (
                  <>
                    <span 
                      style={{ cursor: 'pointer', textDecoration: 'underline', color: '#2563eb' }}
                      onClick={() => setShowBreakdownModal(true)}
                      title="Click to view tiered pricing breakdown"
                    >
                      ₹{newTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                      {(() => {
                        const currentBillingCycle = currentSubscription?.billing_cycle || billingCycle;
                        // Show tiered pricing breakdown if available
                        if (tieredPricing.breakdown && tieredPricing.breakdown.length > 0) {
                          if (currentBillingCycle === 'yearly' && effectiveBillingCycle === 'monthly') {
                            // Switching cycles: show full amount
                            return <>(Tiered pricing for {effectiveInternalUsers} users - Click amount for breakdown)</>;
                          } else if (currentBillingCycle === 'monthly' && effectiveBillingCycle === 'yearly') {
                            // Switching cycles: show full amount
                            return <>(Tiered pricing for {effectiveInternalUsers} users - Click amount for breakdown)</>;
                          } else {
                            // Prorated: show with days
                            return <>(Tiered pricing for {effectiveInternalUsers} users × {proratedInfo.remainingDays}/{effectiveBillingCycle === 'yearly' ? 365 : 30} days - Click amount for breakdown)</>;
                          }
                        }
                        // Fallback
                        return <>({effectiveInternalUsers} users)</>;
                      })()}
                    </div>
                  </>
                ) : (
                  <span 
                    style={{ cursor: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? 'pointer' : 'default', textDecoration: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? 'underline' : 'none', color: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? '#2563eb' : 'inherit' }}
                    onClick={() => tieredPricing.breakdown && tieredPricing.breakdown.length > 0 && setShowBreakdownModal(true)}
                    title={tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? "Click to view tiered pricing breakdown" : ""}
                  >
                    ₹{internalTotalPrice.toLocaleString('en-IN')} per {effectiveBillingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                )}
              </div>
            </div>

            {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.remainingDays > 0 && currentPaidAmount > 0 && (
              <div className="order-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
                <div>
                  <strong>Current Paid Amount</strong>
                  <div className="order-item-detail" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    (Tiered pricing for {currentUserCount} users × {proratedInfo.remainingDays}/{proratedInfo.totalDaysInCycle} days)
                  </div>
                </div>
                <div className="order-item-price" style={{ color: '#ef4444' }}>
                  - ₹{currentPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {walletBalance > 0 && (
              <div className="order-item" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px', marginTop: '12px' }}>
                <div>
                  <strong>Wallet Balance</strong>
                  <div className="order-item-detail" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Applied to this order
                  </div>
                </div>
                <div className="order-item-price" style={{ color: '#10b981' }}>
                  - ₹{walletBalanceToApply.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {totalFreeExternalUsers > 0 && (
              <div className="order-item">
                <div>
                  <strong>Free External Users</strong>
                  <div className="order-item-detail">
                    {totalFreeExternalUsers} user(s) included ({freeExternalUsersPerInternalUser} per internal user)
                  </div>
                </div>
                <div className="order-item-price">
                  ₹0.00 per {effectiveBillingCycle === 'yearly' ? 'year' : 'month'}
                </div>
              </div>
            )}

            <div className="order-total">
              <strong>Total Amount Payable</strong>
              <strong className="total-price">
                <span 
                  style={{ cursor: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? 'pointer' : 'default', textDecoration: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? 'underline' : 'none', color: tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? '#2563eb' : 'inherit' }}
                  onClick={() => tieredPricing.breakdown && tieredPricing.breakdown.length > 0 && setShowBreakdownModal(true)}
                  title={tieredPricing.breakdown && tieredPricing.breakdown.length > 0 ? "Click to view tiered pricing breakdown" : ""}
                >
                  ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo ? (
                  proratedInfo.additionalUsers > 0 ? (
                    <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: '4px' }}>
                      (Prorated for remaining {proratedInfo.remainingDays} days)
                    </div>
                  ) : proratedInfo.additionalUsers < 0 ? (
                    <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#10b981', marginTop: '4px' }}>
                      (Credit will be applied)
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginTop: '4px' }}>
                      (No change)
                    </div>
                  )
                ) : (
                  ` per ${effectiveBillingCycle === 'yearly' ? 'year' : 'month'}`
                )}
              </strong>
            </div>

            <div className="payment-methods">
              <div className="payment-methods-label">Accepted Payment Methods:</div>
              <div className="payment-icons">
                <span className="payment-icon">📱 UPI</span>
                <span className="payment-icon">🏦 Netbanking</span>
              </div>
            </div>

            <button 
              className="subscribe-button" 
              disabled={
                (!isTrialOrNoSubscription && effectiveIsIncreaseUsers && currentUserCount && effectiveInternalUsers === currentUserCount && 
                 currentSubscription?.billing_cycle === effectiveBillingCycle) ||
                isProcessing
              }
              onClick={async () => {
                // Prevent click if disabled (no change in user count AND no change in billing cycle)
                // For trial/no subscription, always allow (treat as first-time subscription)
                if (!isTrialOrNoSubscription && effectiveIsIncreaseUsers && currentUserCount && effectiveInternalUsers === currentUserCount && 
                    currentSubscription?.billing_cycle === effectiveBillingCycle) {
                  return;
                }
                
                if (isProcessing) {
                  return;
                }
                
                // For trial/no subscription, treat as purchase (not upgrade/downgrade)
                if (isTrialOrNoSubscription) {
                  // Show payment modal for first-time subscription
                  const orderDetails = {
                    action: 'purchase',
                    internalPlan: currentInternalPlan,
                    billingCycle: effectiveBillingCycle,
                    totalInternalUsers: effectiveInternalUsers,
                    totalAmount,
                    totalFreeExternalUsers,
                    freeExternalUsersPerInternalUser,
                    bankDetails: bankDetails,
                    proratedInfo: null, // No proration for first-time subscription
                    isIncreaseUsers: false,
                    walletBalance: walletBalanceToApply
                  };
                  if (onShowPaymentModal) {
                    onShowPaymentModal(orderDetails);
                  }
                  return;
                }
                
                // Check if it's a downgrade (negative amount or fewer users)
                const isDowngrade = effectiveIsIncreaseUsers && (
                  totalAmount < 0 || 
                  (proratedInfo && proratedInfo.additionalUsers < 0) ||
                  effectiveInternalUsers < currentUserCount
                );
                
                // If downgrade, call API directly without payment modal
                if (isDowngrade) {
                  setIsProcessing(true);
                  try {
                    // For downgrade, calculate credit amount
                    // If proratedAmount is negative, it's a credit to be added to wallet
                    // If proratedAmount is positive, it means there's an amount due (even if covered by wallet)
                    let creditAmount = 0;
                    if (proratedInfo && proratedInfo.proratedAmount < 0) {
                      // Negative prorated amount means credit to be added to wallet
                      creditAmount = Math.abs(proratedInfo.proratedAmount);
                    } else if (proratedInfo && proratedInfo.proratedAmount > 0 && totalAmount <= 0) {
                      // Positive prorated amount but total is 0 or negative after wallet
                      // This means wallet covered the full amount, no credit
                      creditAmount = 0;
                    } else if (baseTotalAmount < 0) {
                      // Base amount itself is negative (credit scenario)
                      creditAmount = Math.abs(baseTotalAmount);
                    }
                    
                    // Add billing_cycle only if it has changed from current subscription
                    const currentBillingCycle = currentSubscription?.billing_cycle;
                    const billingCycleChanged = currentBillingCycle && currentBillingCycle !== effectiveBillingCycle;
                    
                    // Get employee/partner code from sessionStorage (last used code)
                    const getEmployeePartnerCode = () => {
                      const employeeCode = sessionStorage.getItem('employee_code');
                      const partnerCode = sessionStorage.getItem('partner_code');
                      // Prefer employee code over partner code (employees have priority)
                      return employeeCode || partnerCode || null;
                    };
                    
                    const downgradeData = {
                      action: 'downgrade',
                      new_slab_id: currentInternalPlan?.id,
                      user_count: effectiveInternalUsers,
                      amount: creditAmount, // Credit amount to be added to wallet
                      wallet_utilized_amount: walletBalanceToApply, // Wallet balance applied (if any)
                      employee_partner_code: getEmployeePartnerCode() // Use last code from sessionStorage
                    };
                    
                    // Add billing_cycle only if it has changed
                    if (billingCycleChanged) {
                      downgradeData.billing_cycle = effectiveBillingCycle;
                    }
                    
                    const response = await purchaseSubscription(downgradeData);
                    
                    if (response) {
                      // Show success message about wallet credit
                      alert(`Downgrade successful! ₹${creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been credited to your wallet and will be deducted from your next billing cycle.`);
                      
                      // Navigate to current subscription page
                      const basename = process.env.REACT_APP_HOMEPAGE || '';
                      const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
                      window.location.href = path;
                    }
                  } catch (error) {
                    console.error('Error processing downgrade:', error);
                    const errorMessage = error?.message || error?.error?.message || 'Failed to process downgrade. Please try again.';
                    alert(errorMessage);
                    setIsProcessing(false);
                  }
                  return;
                }
                
                // If total amount is 0 (no payment needed), call API directly without payment modal
                if (totalAmount === 0 && effectiveIsIncreaseUsers) {
                  setIsProcessing(true);
                  try {
                    // Calculate credit amount if prorated amount is negative
                    const creditAmount = proratedInfo && proratedInfo.proratedAmount < 0 
                      ? Math.abs(proratedInfo.proratedAmount) 
                      : 0;
                    
                    // Add billing_cycle only if it has changed from current subscription
                    const currentBillingCycle = currentSubscription?.billing_cycle;
                    const billingCycleChanged = currentBillingCycle && currentBillingCycle !== effectiveBillingCycle;
                    
                    // Get employee/partner code from sessionStorage (last used code)
                    const getEmployeePartnerCode = () => {
                      const employeeCode = sessionStorage.getItem('employee_code');
                      const partnerCode = sessionStorage.getItem('partner_code');
                      // Prefer employee code over partner code (employees have priority)
                      return employeeCode || partnerCode || null;
                    };
                    
                    const upgradeData = {
                      action: 'upgrade',
                      new_slab_id: currentInternalPlan?.id,
                      user_count: effectiveInternalUsers,
                      amount: 0,
                      wallet_utilized_amount: walletBalanceToApply,
                      employee_partner_code: getEmployeePartnerCode(), // Use last code from sessionStorage
                      payment_method: null,
                      payment_reference: null,
                      payment_proof_url: null,
                      payment_date: null
                    };
                    
                    // Add billing_cycle only if it has changed
                    if (billingCycleChanged) {
                      upgradeData.billing_cycle = effectiveBillingCycle;
                    }
                    
                    // Add credit_amount if there's a credit
                    if (creditAmount > 0) {
                      upgradeData.credit_amount = creditAmount;
                    }
                    
                    const response = await purchaseSubscription(upgradeData);
                    
                    if (response) {
                      // Show success message
                      let successMessage = 'Subscription updated successfully!';
                      if (creditAmount > 0) {
                        successMessage = `Subscription updated successfully! ₹${creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been credited to your wallet.`;
                      }
                      alert(successMessage);
                      
                      // Navigate to current subscription page
                      const basename = process.env.REACT_APP_HOMEPAGE || '';
                      const path = basename ? `${basename}/admin-dashboard?view=current_subscription` : `/admin-dashboard?view=current_subscription`;
                      window.location.href = path;
                    }
                  } catch (error) {
                    console.error('Error processing upgrade:', error);
                    const errorMessage = error?.message || error?.error?.message || 'Failed to process subscription update. Please try again.';
                    alert(errorMessage);
                    setIsProcessing(false);
                  }
                  return;
                }
                
                // For upgrade or purchase with payment, show payment modal
                const orderDetails = {
                  action: isIncreaseUsers ? 'upgrade' : 'purchase',
                  internalPlan: currentInternalPlan,
                  billingCycle: effectiveBillingCycle, // Use selected billing cycle
                  currentBillingCycle: currentSubscription?.billing_cycle || null, // Current billing cycle for comparison
                  totalInternalUsers: effectiveInternalUsers,
                  totalAmount,
                  totalFreeExternalUsers,
                  freeExternalUsersPerInternalUser,
                  bankDetails: bankDetails,
                  proratedInfo: proratedInfo || null,
                  isIncreaseUsers: isIncreaseUsers || false,
                  walletBalance: walletBalanceToApply
                };
                if (onShowPaymentModal) {
                  onShowPaymentModal(orderDetails);
                }
              }}
              title={
                isProcessing 
                  ? 'Processing...' 
                  : (isIncreaseUsers && currentUserCount && effectiveInternalUsers === currentUserCount && 
                     currentSubscription?.billing_cycle === effectiveBillingCycle)
                  ? 'Please change the user count or billing cycle to proceed' 
                  : ''
              }
            >
              <span className="material-icons">subscriptions</span>
              {isProcessing ? 'Processing...' : 'Subscribe Now & Pay'}
            </button>
          </div>
        </div>
      </div>

      {/* Tiered Pricing Breakdown Modal */}
      {showBreakdownModal && tieredPricing.breakdown && tieredPricing.breakdown.length > 0 && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowBreakdownModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>Tiered Pricing Breakdown</h2>
              <button
                onClick={() => setShowBreakdownModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Total Users: <strong>{effectiveInternalUsers}</strong></div>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Billing Cycle: <strong>{effectiveBillingCycle === 'yearly' ? 'Yearly' : 'Monthly'}</strong></div>
              {!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.remainingDays > 0 && (
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Prorated for: <strong>{proratedInfo.remainingDays} days</strong> (out of {effectiveBillingCycle === 'yearly' ? 365 : 30} days)
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Pricing by Slab:</h3>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>Slab</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>User Range</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>Users in Slab</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>Price/User</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontSize: '14px', fontWeight: '600' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tieredPricing.breakdown.map((item, index) => {
                      const slab = item.slab;
                      const userRange = slab.min_users === slab.max_users
                        ? `${slab.min_users} user${slab.min_users > 1 ? 's' : ''}`
                        : `${slab.min_users}-${slab.max_users} users`;
                      
                      // Show full amount in main column, prorated in note if applicable
                      const fullAmount = item.total;
                      let proratedAmount = null;
                      let proratedNote = '';
                      
                      if (!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.remainingDays > 0) {
                        const totalDaysInCycle = effectiveBillingCycle === 'yearly' ? 365 : 30;
                        const proratedFactor = proratedInfo.remainingDays / totalDaysInCycle;
                        proratedAmount = fullAmount * proratedFactor;
                        proratedNote = `Prorated (${proratedInfo.remainingDays}/${totalDaysInCycle} days): ₹${proratedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }
                      
                      return (
                        <tr key={index} style={{ borderBottom: index < tieredPricing.breakdown.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{slab.name || `Slab ${slab.id}`}</td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#666' }}>{userRange}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>{item.users}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px' }}>
                            ₹{item.pricePerUser.toLocaleString('en-IN')} / {effectiveBillingCycle === 'yearly' ? 'year' : 'month'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: '600' }}>
                            <div>₹{fullAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            {proratedNote && (
                              <div style={{ fontSize: '11px', color: '#666', fontWeight: 'normal', marginTop: '4px' }}>
                                {proratedNote}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                      <td colSpan="4" style={{ padding: '12px', textAlign: 'right', fontSize: '16px', fontWeight: '600' }}>Total Amount:</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>
                        ₹{(!isTrialOrNoSubscription && effectiveIsIncreaseUsers && proratedInfo && proratedInfo.remainingDays > 0 ? newTotalAmount : internalTotalPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowBreakdownModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlansPage;



