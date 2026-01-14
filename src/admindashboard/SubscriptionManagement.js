import React, { useState, useEffect } from 'react';
import { checkSubscriptionStatus, formatCurrency, calculateTotalAmount } from '../utils/subscriptionUtils';
import { apiGet, apiPost } from '../utils/apiUtils';
import RazorpayPayment from './components/RazorpayPayment';
import { SUBSCRIPTION_PLANS } from '../config/subscriptionPlans';

function SubscriptionManagement() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [userCount, setUserCount] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview, plans, history
  
  // Plan selection state
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [addOnUsers, setAddOnUsers] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subData, plansData, paymentsData] = await Promise.allSettled([
        checkSubscriptionStatus(),
        apiGet('/api/subscription/plans'),
        apiGet('/api/subscription/payments')
      ]);

      // Handle subscription status
      const subscription = subData.status === 'fulfilled' ? subData.value : null;
      setSubscription(subscription);

      // Handle plans - use API if available, otherwise fallback to local config
      let finalPlans = SUBSCRIPTION_PLANS; // Default to local config
      if (plansData.status === 'fulfilled' && plansData.value?.plans && plansData.value.plans.length > 0) {
        finalPlans = plansData.value.plans;
      }
      setPlans(finalPlans);
      
      // Handle user count - API endpoint removed, set to null
      setUserCount(null);
      
      // Handle payments
      const payments = paymentsData.status === 'fulfilled' ? (paymentsData.value?.payments || []) : [];
      setPayments(payments);
      
      // Set current subscription as selected plan
      if (subscription) {
        setSelectedPlan(subscription.planId);
        setSelectedBillingCycle(subscription.billingCycle || 'monthly');
        setAddOnUsers(subscription.addOnUsers || 0);
      } else if (finalPlans.length > 0) {
        // If no subscription, select first plan as default
        setSelectedPlan(finalPlans[0].id);
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
      // On error, still use local plans as fallback
      setPlans(SUBSCRIPTION_PLANS);
      if (SUBSCRIPTION_PLANS.length > 0) {
        setSelectedPlan(SUBSCRIPTION_PLANS[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (planId) => {
    setSelectedPlan(planId);
    setUpdateMessage('');
  };

  const handleAddOnChange = (change) => {
    const newValue = Math.max(0, addOnUsers + change);
    setAddOnUsers(newValue);
    setUpdateMessage('');
  };

  const handleUpdateSubscription = async () => {
    if (!selectedPlan) return;

    setUpdating(true);
    setUpdateMessage('');

    try {
      const updateData = {
        planId: selectedPlan,
        billingCycle: selectedBillingCycle,
        addOnUsers: addOnUsers
      };

      const result = await apiPost('/api/subscription/update', updateData);

      if (result.success) {
        if (result.orderId && result.amount) {
          // Payment required
          setUpdateMessage(`Payment required: ${formatCurrency(result.amount)}`);
          // Payment will be handled by RazorpayPayment component
        } else if (result.proratedCredit) {
          // Credit applied
          setUpdateMessage(`Credit applied: ${formatCurrency(result.proratedCredit)}. Changes will take effect immediately.`);
          await fetchData();
        } else {
          setUpdateMessage('Subscription updated successfully!');
          await fetchData();
        }
      } else {
        setUpdateMessage(result.message || 'Failed to update subscription');
      }
    } catch (error) {
      setUpdateMessage(error.message || 'Failed to update subscription');
    } finally {
      setUpdating(false);
    }
  };

  // Check if only adding users (same plan, same billing cycle, just more add-ons)
  const isOnlyAddingUsers = subscription && 
    subscription.planId === selectedPlan && 
    subscription.billingCycle === selectedBillingCycle &&
    addOnUsers > (subscription.addOnUsers || 0);

  const handlePaymentSuccess = async () => {
    setUpdateMessage('Payment successful! Subscription updated.');
    await fetchData();
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <span className="material-icons" style={{ 
          fontSize: 48, 
          color: '#3b82f6',
          animation: 'spin 1s linear infinite'
        }}>sync</span>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.id === subscription?.planId);
  const selectedPlanData = plans.find(p => p.id === selectedPlan);
  const usagePercent = subscription?.total_user_limit 
    ? (userCount?.count || 0) / subscription.total_user_limit * 100 
    : 0;

  return (
    <div className="subscription-container" style={{ 
      maxWidth: 1200, 
      margin: '0 auto',
      padding: '20px',
      paddingTop: '84px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Responsive styles */
        @media (max-width: 768px) {
          .subscription-container {
            padding: 12px !important;
            padding-top: 76px !important;
          }
          .subscription-header {
            margin-bottom: 20px !important;
          }
          .subscription-header h2 {
            font-size: 22px !important;
          }
          .subscription-header .material-icons {
            font-size: 24px !important;
          }
          .subscription-header p {
            font-size: 14px !important;
          }
          .subscription-tabs {
            flex-wrap: wrap !important;
            gap: 4px !important;
          }
          .subscription-tab-button {
            padding: 10px 16px !important;
            font-size: 14px !important;
            flex: 1 1 auto !important;
            min-width: 100px !important;
          }
          .subscription-card {
            padding: 20px 16px !important;
          }
          .subscription-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .subscription-plans-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .subscription-plan-card {
            padding: 24px 16px !important;
          }
          .subscription-billing-selector {
            max-width: 100% !important;
            margin: 0 auto 24px !important;
          }
          .subscription-addon-controls {
            flex-direction: column !important;
            gap: 12px !important;
            align-items: stretch !important;
          }
          .subscription-addon-buttons {
            justify-content: center !important;
          }
          .subscription-quick-actions {
            flex-direction: column !important;
          }
          .subscription-quick-actions button {
            width: 100% !important;
          }
          .subscription-table-wrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .subscription-table {
            min-width: 600px !important;
          }
          .subscription-more-users-section {
            padding: 20px 16px !important;
          }
          .subscription-more-users-header {
            flex-direction: column !important;
            gap: 12px !important;
          }
          .subscription-order-summary {
            padding: 20px 16px !important;
          }
          .subscription-payment-button-wrapper {
            width: 100% !important;
          }
          .subscription-payment-button-wrapper button {
            width: 100% !important;
            min-width: auto !important;
            padding: 14px 24px !important;
          }
        }
        
        @media (max-width: 480px) {
          .subscription-container {
            padding: 8px !important;
            padding-top: 72px !important;
          }
          .subscription-header {
            margin-bottom: 16px !important;
          }
          .subscription-header h2 {
            font-size: 20px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          .subscription-header .material-icons {
            font-size: 20px !important;
          }
          .subscription-card {
            padding: 16px 12px !important;
            border-radius: 12px !important;
          }
          .subscription-plan-card {
            padding: 20px 12px !important;
          }
          .subscription-tab-button {
            padding: 8px 12px !important;
            font-size: 13px !important;
          }
          .subscription-billing-selector {
            padding: 6px !important;
          }
          .subscription-billing-button {
            padding: 10px 16px !important;
            font-size: 13px !important;
          }
        }
        
        @media (min-width: 769px) and (max-width: 1024px) {
          .subscription-plans-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="subscription-header" style={{ marginBottom: 32 }}>
        <h2 style={{ 
          color: '#1e40af', 
          fontWeight: 700, 
          fontSize: 28, 
          margin: '0 0 8px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <span className="material-icons" style={{ fontSize: 32 }}>subscriptions</span>
          Subscription Management
        </h2>
        <p style={{ color: '#64748b', fontSize: 16, margin: 0 }}>
          Manage your subscription plan, billing, and user limits
        </p>
      </div>

      {/* Tabs */}
      <div className="subscription-tabs" style={{ 
        display: 'flex', 
        gap: 8, 
        marginBottom: 24,
        borderBottom: '2px solid #e2e8f0'
      }}>
        {['overview', 'plans', 'history'].map(tab => (
          <button
            key={tab}
            className="subscription-tab-button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === tab ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === tab ? 700 : 500,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Current Subscription Card */}
          <div className="subscription-card" style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
            padding: 32,
            marginBottom: 24
          }}>
            <h3 style={{ 
              margin: '0 0 24px 0', 
              fontSize: 20, 
              fontWeight: 700, 
              color: '#1e293b' 
            }}>
              Current Subscription
            </h3>

            {subscription ? (
              <>
                <div className="subscription-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
                  {/* Plan Info */}
                  <div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Plan</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                      {subscription.planName || 'N/A'}
                    </div>
                    <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                      {subscription.billingCycle === 'annual' ? 'Annual' : 'Monthly'} billing
                    </div>
                  </div>

                  {/* User Limit */}
                  <div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>User Limit</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                      {userCount?.count || 0} / {subscription.total_user_limit}
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: 8, 
                      background: '#e2e8f0', 
                      borderRadius: 4, 
                      marginTop: 8,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(usagePercent, 100)}%`,
                        height: '100%',
                        background: usagePercent >= 100 ? '#ef4444' : usagePercent >= 80 ? '#f59e0b' : '#22c55e',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>Status</div>
                    <div style={{ 
                      fontSize: 24, 
                      fontWeight: 700, 
                      color: subscription.status === 'active' ? '#22c55e' : '#f59e0b',
                      textTransform: 'capitalize'
                    }}>
                      {subscription.isTrial ? 'Trial' : subscription.status}
                    </div>
                    {subscription.nextBillingDate && (
                      <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                        Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Add-on Users */}
                {subscription.addOnUsers > 0 && (
                  <div style={{ 
                    marginTop: 24, 
                    padding: 16, 
                    background: '#f0f9ff', 
                    borderRadius: 12,
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                      Add-on Users: {subscription.addOnUsers}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Base users: {subscription.baseUserLimit} + Add-ons: {subscription.addOnUsers} = Total: {subscription.total_user_limit}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                padding: 24,
                textAlign: 'center',
                background: '#f0f9ff',
                borderRadius: 12,
                border: '1px solid #bae6fd',
                marginBottom: 24
              }}>
                <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>
                  subscription
                </span>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>
                  No Active Subscription
                </div>
                <div style={{ fontSize: 14, color: '#64748b' }}>
                  Select a plan below to get started
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions - Only show when there's an active subscription */}
          {subscription && (
            <div className="subscription-card" style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
              padding: 24
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: 18, 
                fontWeight: 600, 
                color: '#1e293b' 
              }}>
                Quick Actions
              </h3>
              <div className="subscription-quick-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveTab('plans')}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>upgrade</span>
                  Change Plan
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    padding: '12px 24px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>history</span>
                  Payment History
                </button>
              </div>
            </div>
          )}

          {/* Plans Display - Show directly in overview when no active subscription */}
          {!subscription && (
            <>
              {/* Billing Cycle Selector */}
              <div className="subscription-billing-selector" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginBottom: 32,
                gap: 8,
                background: '#f1f5f9',
                padding: 8,
                borderRadius: 12,
                maxWidth: 400,
                margin: '24px auto 32px'
              }}>
                {['monthly', 'annual'].map(cycle => (
                  <button
                    key={cycle}
                    className="subscription-billing-button"
                    onClick={() => setSelectedBillingCycle(cycle)}
                    style={{
                      flex: 1,
                      padding: '12px 24px',
                      background: selectedBillingCycle === cycle 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
                        : 'transparent',
                      color: selectedBillingCycle === cycle ? '#fff' : '#64748b',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cycle === 'annual' ? 'Annual (Save 17%)' : 'Monthly'}
                  </button>
                ))}
              </div>

              {/* Plans Grid */}
              <div className="subscription-plans-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                gap: 24,
                marginBottom: 32
              }}>
                {plans.map(plan => {
                  const isSelected = selectedPlan === plan.id;
                  const price = selectedBillingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                  
                  return (
                    <div
                      key={plan.id}
                      className="subscription-plan-card"
                      onClick={() => handlePlanChange(plan.id)}
                      style={{
                        background: '#fff',
                        borderRadius: 16,
                        padding: 32,
                        boxShadow: isSelected 
                          ? '0 8px 32px rgba(59, 130, 246, 0.2)' 
                          : '0 4px 24px rgba(31,38,135,0.08)',
                        border: isSelected ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Popular Badge */}
                      {plan.popular && (
                        <div style={{
                          position: 'absolute',
                          top: -12,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          padding: '6px 20px',
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                          color: '#fff',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                          zIndex: 1
                        }}>
                          MOST POPULAR
                        </div>
                      )}

                      <h3 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: 24, 
                        fontWeight: 700, 
                        color: '#1e293b' 
                      }}>
                        {plan.name}
                      </h3>

                      {plan.description && (
                        <p style={{
                          margin: '0 0 16px 0',
                          fontSize: 14,
                          color: '#64748b',
                          lineHeight: 1.5
                        }}>
                          {plan.description}
                        </p>
                      )}
                      
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 36, fontWeight: 700, color: '#1e40af' }}>
                            ₹{price}
                          </span>
                          <span style={{ fontSize: 16, color: '#64748b' }}>
                            /{selectedBillingCycle === 'annual' ? 'year' : 'month'}
                          </span>
                        </div>
                        {selectedBillingCycle === 'annual' && plan.savings && (
                          <div style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: '#22c55e',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span className="material-icons" style={{ fontSize: 16 }}>savings</span>
                            {plan.savings}
                          </div>
                        )}
                      </div>

                      <div style={{ 
                        marginBottom: 20, 
                        padding: 12, 
                        background: '#f0f9ff', 
                        borderRadius: 8,
                        border: '1px solid #bae6fd'
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                          Base Users: {plan.baseUsers}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                          Add-on: ₹{plan.perUserAddOn}/{selectedBillingCycle === 'annual' ? 'year' : 'month'} per user
                        </div>
                      </div>

                      <div style={{
                        marginBottom: 16,
                        paddingBottom: 16,
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: 12
                        }}>
                          What's Included
                        </div>
                        <ul style={{ 
                          listStyle: 'none', 
                          padding: 0, 
                          margin: 0,
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}>
                          {plan.features?.map((feature, idx) => (
                            <li key={idx} style={{ 
                              padding: '10px 0', 
                              fontSize: 14, 
                              color: '#1e293b',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              borderBottom: idx < plan.features.length - 1 ? '1px solid #f1f5f9' : 'none'
                            }}>
                              <span className="material-icons" style={{ 
                                fontSize: 20, 
                                color: '#22c55e',
                                flexShrink: 0,
                                marginTop: 2
                              }}>check_circle</span>
                              <span style={{ lineHeight: 1.5 }}>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {isSelected && (
                        <div style={{
                          padding: 12,
                          background: '#f0f9ff',
                          borderRadius: 8,
                          border: '1px solid #bae6fd',
                          fontSize: 14,
                          color: '#0369a1',
                          textAlign: 'center',
                          fontWeight: 600
                        }}>
                          Selected
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add-on Users */}
              {selectedPlanData && (
                <div className="subscription-card" style={{
                  background: '#fff',
                  borderRadius: 16,
                  boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
                  padding: 32,
                  marginBottom: 24
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: 20, 
                    fontWeight: 700, 
                    color: '#1e293b' 
                  }}>
                    Additional Users
                  </h3>
                  <div className="subscription-addon-controls" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                      onClick={() => handleAddOnChange(-1)}
                      disabled={addOnUsers === 0}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: '2px solid #e2e8f0',
                        background: addOnUsers === 0 ? '#f1f5f9' : '#fff',
                        cursor: addOnUsers === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: addOnUsers === 0 ? '#cbd5e1' : '#64748b'
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 20 }}>remove</span>
                    </button>
                    <div style={{ 
                      minWidth: 80, 
                      textAlign: 'center',
                      fontSize: 24,
                      fontWeight: 700,
                      color: '#1e293b'
                    }}>
                      {addOnUsers}
                    </div>
                    <button
                      onClick={() => handleAddOnChange(1)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: '2px solid #3b82f6',
                        background: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6'
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: 20 }}>add</span>
                    </button>
                    <div style={{ marginLeft: 16, flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#64748b' }}>
                        ₹{selectedPlanData.perUserAddOn} per user per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                        Total: ₹{selectedPlanData.perUserAddOn * addOnUsers * (selectedBillingCycle === 'annual' ? 12 : 1)}/{selectedBillingCycle === 'annual' ? 'year' : 'month'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Order Summary and Payment */}
              {selectedPlanData && (
                <div 
                  className="subscription-order-summary"
                  data-payment-section
                  style={{
                    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                    borderRadius: 16,
                    boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
                    padding: 32,
                    marginBottom: 24,
                    border: '2px solid #bae6fd'
                  }}>
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{
                      margin: '0 0 16px 0',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#1e293b'
                    }}>
                      Order Summary
                    </h3>
                    
                    <div style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 16
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        paddingBottom: 12,
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                            {selectedPlanData.name} Plan
                          </div>
                          <div style={{ fontSize: 14, color: '#64748b' }}>
                            {selectedBillingCycle === 'annual' ? 'Annual' : 'Monthly'} Billing
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>
                            {formatCurrency(selectedBillingCycle === 'annual' ? selectedPlanData.annualPrice : selectedPlanData.monthlyPrice)}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                          </div>
                        </div>
                      </div>

                      {addOnUsers > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: 12,
                          paddingBottom: 12,
                          borderBottom: '1px solid #e2e8f0'
                        }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                              Additional Users ({addOnUsers})
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              ₹{selectedPlanData.perUserAddOn} per user
                            </div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                            {formatCurrency(selectedPlanData.perUserAddOn * addOnUsers * (selectedBillingCycle === 'annual' ? 12 : 1))}
                          </div>
                        </div>
                      )}

                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 12
                      }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                          Total Amount
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>
                          {formatCurrency(calculateTotalAmount(selectedPlanData, selectedBillingCycle, addOnUsers))}
                        </div>
                      </div>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#64748b', 
                        textAlign: 'right',
                        marginTop: 4
                      }}>
                        per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                      </div>
                    </div>

                    {/* Payment Button */}
                    <div className="subscription-payment-button-wrapper" style={{ textAlign: 'center' }}>
                      <RazorpayPayment
                        subscriptionData={{
                          planId: selectedPlan,
                          billingCycle: selectedBillingCycle,
                          addOnUsers: addOnUsers,
                          isUpgrade: false,
                          currentPlanId: null,
                          addUsersOnly: false
                        }}
                        onSuccess={handlePaymentSuccess}
                        onError={(error) => setUpdateMessage(error)}
                        buttonText="Subscribe Now & Pay"
                        buttonStyle={{ 
                          padding: '16px 48px', 
                          fontSize: 18,
                          fontWeight: 700,
                          minWidth: 250
                        }}
                      />
                      <div style={{
                        marginTop: 12,
                        fontSize: 12,
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}>
                        <span className="material-icons" style={{ fontSize: 16 }}>lock</span>
                        Secure payment powered by Razorpay
                      </div>
                    </div>
                  </div>

                  {updateMessage && (
                    <div style={{
                      padding: 12,
                      background: updateMessage.includes('success') || updateMessage.includes('Credit') 
                        ? '#f0fdf4' 
                        : '#fef2f2',
                      border: `1px solid ${updateMessage.includes('success') || updateMessage.includes('Credit') 
                        ? '#86efac' 
                        : '#fecaca'}`,
                      borderRadius: 8,
                      color: updateMessage.includes('success') || updateMessage.includes('Credit') 
                        ? '#16a34a' 
                        : '#dc2626',
                      fontSize: 14
                    }}>
                      {updateMessage}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Add More Users Section */}
          {subscription && (
            <div className="subscription-more-users-section" style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              borderRadius: 16,
              boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
              padding: 32,
              marginTop: 24,
              border: '2px solid #bae6fd'
            }}>
              <div className="subscription-more-users-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: 22, 
                    fontWeight: 700, 
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}>
                    <span className="material-icons" style={{ fontSize: 28, color: '#3b82f6' }}>person_add</span>
                    Need More Users?
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: 14, 
                    color: '#64748b',
                    lineHeight: 1.6
                  }}>
                    You can purchase additional users at any time. Additional users are added to your current plan 
                    and billed at the same frequency as your subscription.
                  </p>
                </div>
              </div>

              <div style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Current User Limit</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b' }}>
                      {userCount?.count || 0} / {subscription.total_user_limit}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, color: '#64748b', marginBottom: 4 }}>Per User Price</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>
                      {(() => {
                        const currentPlan = plans.find(p => p.id === subscription.planId);
                        return currentPlan ? `₹${currentPlan.perUserAddOn}/${subscription.billingCycle === 'annual' ? 'year' : 'month'}` : 'N/A';
                      })()}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: 16,
                  background: '#f0f9ff',
                  borderRadius: 8,
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 12 }}>
                    Quick Add Users
                  </div>
                  <div className="subscription-addon-buttons" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[1, 5, 10, 20].map(num => {
                      const currentPlan = plans.find(p => p.id === subscription.planId);
                      const price = currentPlan ? currentPlan.perUserAddOn * num * (subscription.billingCycle === 'annual' ? 12 : 1) : 0;
                      return (
                        <button
                          key={num}
                          onClick={() => {
                            setSelectedPlan(subscription.planId);
                            setAddOnUsers(subscription.addOnUsers + num);
                            setActiveTab('plans');
                            // Scroll to payment section
                            setTimeout(() => {
                              const paymentSection = document.querySelector('[data-payment-section]');
                              if (paymentSection) {
                                paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }, 100);
                          }}
                          style={{
                            padding: '12px 20px',
                            background: '#fff',
                            border: '2px solid #bae6fd',
                            borderRadius: 10,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            minWidth: 100
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#3b82f6';
                            e.currentTarget.style.background = '#f0f9ff';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#bae6fd';
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e40af' }}>
                            +{num}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {formatCurrency(price)}/{subscription.billingCycle === 'annual' ? 'yr' : 'mo'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('plans')}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                }}
              >
                <span className="material-icons" style={{ fontSize: 20 }}>add_circle</span>
                Add More Users
              </button>
            </div>
          )}
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          {/* Billing Cycle Selector */}
          <div className="subscription-billing-selector" style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            marginBottom: 32,
            gap: 8,
            background: '#f1f5f9',
            padding: 8,
            borderRadius: 12,
            maxWidth: 400,
            margin: '0 auto 32px'
          }}>
            {['monthly', 'annual'].map(cycle => (
              <button
                key={cycle}
                className="subscription-billing-button"
                onClick={() => setSelectedBillingCycle(cycle)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  background: selectedBillingCycle === cycle 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)' 
                    : 'transparent',
                  color: selectedBillingCycle === cycle ? '#fff' : '#64748b',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s'
                }}
              >
                {cycle === 'annual' ? 'Annual (Save 17%)' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* Plans Grid */}
          <div className="subscription-plans-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: 24,
            marginBottom: 32
          }}>
            {plans.map(plan => {
              const isSelected = selectedPlan === plan.id;
              const isCurrent = subscription?.planId === plan.id;
              const price = selectedBillingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
              
              return (
                <div
                  key={plan.id}
                  className="subscription-plan-card"
                  onClick={() => !isCurrent && handlePlanChange(plan.id)}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: 32,
                    boxShadow: isSelected 
                      ? '0 8px 32px rgba(59, 130, 246, 0.2)' 
                      : '0 4px 24px rgba(31,38,135,0.08)',
                    border: isSelected ? '3px solid #3b82f6' : '2px solid #e2e8f0',
                    cursor: isCurrent ? 'default' : 'pointer',
                    transition: 'all 0.3s',
                    position: 'relative',
                    opacity: isCurrent ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {isCurrent && (
                    <div style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      padding: '4px 12px',
                      background: '#22c55e',
                      color: '#fff',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600
                    }}>
                      Current
                    </div>
                  )}
                  
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div style={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '6px 20px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                      color: '#fff',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                      zIndex: 1
                    }}>
                      MOST POPULAR
                    </div>
                  )}

                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: 24, 
                    fontWeight: 700, 
                    color: '#1e293b' 
                  }}>
                    {plan.name}
                  </h3>

                  {plan.description && (
                    <p style={{
                      margin: '0 0 16px 0',
                      fontSize: 14,
                      color: '#64748b',
                      lineHeight: 1.5
                    }}>
                      {plan.description}
                    </p>
                  )}
                  
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ fontSize: 36, fontWeight: 700, color: '#1e40af' }}>
                        ₹{price}
                      </span>
                      <span style={{ fontSize: 16, color: '#64748b' }}>
                        /{selectedBillingCycle === 'annual' ? 'year' : 'month'}
                      </span>
                    </div>
                    {selectedBillingCycle === 'annual' && plan.savings && (
                      <div style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: '#22c55e',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <span className="material-icons" style={{ fontSize: 16 }}>savings</span>
                        {plan.savings}
                      </div>
                    )}
                  </div>

                  <div style={{ 
                    marginBottom: 20, 
                    padding: 12, 
                    background: '#f0f9ff', 
                    borderRadius: 8,
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0369a1', marginBottom: 4 }}>
                      Base Users: {plan.baseUsers}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      Add-on: ₹{plan.perUserAddOn}/{selectedBillingCycle === 'annual' ? 'year' : 'month'} per user
                    </div>
                  </div>

                  <div style={{
                    marginBottom: 16,
                    paddingBottom: 16,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 12
                    }}>
                      What's Included
                    </div>
                    <ul style={{ 
                      listStyle: 'none', 
                      padding: 0, 
                      margin: 0,
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {plan.features?.map((feature, idx) => (
                        <li key={idx} style={{ 
                          padding: '10px 0', 
                          fontSize: 14, 
                          color: '#1e293b',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          borderBottom: idx < plan.features.length - 1 ? '1px solid #f1f5f9' : 'none'
                        }}>
                          <span className="material-icons" style={{ 
                            fontSize: 20, 
                            color: '#22c55e',
                            flexShrink: 0,
                            marginTop: 2
                          }}>check_circle</span>
                          <span style={{ lineHeight: 1.5 }}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isSelected && !isCurrent && (
                    <div style={{
                      padding: 12,
                      background: '#f0f9ff',
                      borderRadius: 8,
                      border: '1px solid #bae6fd',
                      fontSize: 14,
                      color: '#0369a1',
                      textAlign: 'center',
                      fontWeight: 600
                    }}>
                      Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add-on Users */}
          {selectedPlanData && (
            <div className="subscription-card" style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
              padding: 32,
              marginBottom: 24
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: 20, 
                fontWeight: 700, 
                color: '#1e293b' 
              }}>
                Additional Users
              </h3>
              <div className="subscription-addon-controls" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={() => handleAddOnChange(-1)}
                  disabled={addOnUsers === 0}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: '2px solid #e2e8f0',
                    background: addOnUsers === 0 ? '#f1f5f9' : '#fff',
                    cursor: addOnUsers === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: addOnUsers === 0 ? '#cbd5e1' : '#64748b'
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20 }}>remove</span>
                </button>
                <div style={{ 
                  minWidth: 80, 
                  textAlign: 'center',
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1e293b'
                }}>
                  {addOnUsers}
                </div>
                <button
                  onClick={() => handleAddOnChange(1)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    border: '2px solid #3b82f6',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6'
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20 }}>add</span>
                </button>
                <div style={{ marginLeft: 16, flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#64748b' }}>
                    ₹{selectedPlanData.perUserAddOn} per user per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                    Total: ₹{selectedPlanData.perUserAddOn * addOnUsers * (selectedBillingCycle === 'annual' ? 12 : 1)}/{selectedBillingCycle === 'annual' ? 'year' : 'month'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total and Update Button */}
          {selectedPlanData && (
            <div 
              className="subscription-order-summary"
              data-payment-section
              style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                borderRadius: 16,
                boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
                padding: 32,
                marginBottom: 24,
                border: '2px solid #bae6fd'
              }}>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#1e293b'
                }}>
                  Order Summary
                </h3>
                
                <div style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 16
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                        {selectedPlanData.name} Plan
                      </div>
                      <div style={{ fontSize: 14, color: '#64748b' }}>
                        {selectedBillingCycle === 'annual' ? 'Annual' : 'Monthly'} Billing
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>
                        {formatCurrency(selectedBillingCycle === 'annual' ? selectedPlanData.annualPrice : selectedPlanData.monthlyPrice)}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                      </div>
                    </div>
                  </div>

                  {addOnUsers > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      marginBottom: 12,
                      paddingBottom: 12,
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                          Additional Users ({addOnUsers})
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          ₹{selectedPlanData.perUserAddOn} per user
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                        {formatCurrency(selectedPlanData.perUserAddOn * addOnUsers * (selectedBillingCycle === 'annual' ? 12 : 1))}
                      </div>
                    </div>
                  )}

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 12
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                      Total Amount
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#1e40af' }}>
                      {formatCurrency(calculateTotalAmount(selectedPlanData, selectedBillingCycle, addOnUsers))}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: '#64748b', 
                    textAlign: 'right',
                    marginTop: 4
                  }}>
                    per {selectedBillingCycle === 'annual' ? 'year' : 'month'}
                  </div>
                </div>

                {/* Payment Button */}
                {!subscription || 
                 subscription?.planId !== selectedPlan || 
                 subscription?.billingCycle !== selectedBillingCycle ||
                 subscription?.addOnUsers !== addOnUsers ? (
                  <div className="subscription-payment-button-wrapper" style={{ textAlign: 'center' }}>
                    <RazorpayPayment
                      subscriptionData={{
                        planId: selectedPlan,
                        billingCycle: selectedBillingCycle,
                        addOnUsers: addOnUsers,
                        isUpgrade: !!subscription,
                        currentPlanId: subscription?.planId || null,
                        addUsersOnly: isOnlyAddingUsers || false
                      }}
                      onSuccess={handlePaymentSuccess}
                      onError={(error) => setUpdateMessage(error)}
                      buttonText={
                        !subscription 
                          ? "Subscribe Now & Pay" 
                          : isOnlyAddingUsers 
                            ? `Add ${addOnUsers - (subscription.addOnUsers || 0)} Users & Pay` 
                            : "Update Subscription & Pay"
                      }
                      buttonStyle={{ 
                        padding: '16px 48px', 
                        fontSize: 18,
                        fontWeight: 700,
                        minWidth: 250
                      }}
                    />
                    <div style={{
                      marginTop: 12,
                      fontSize: 12,
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}>
                      <span className="material-icons" style={{ fontSize: 16 }}>lock</span>
                      Secure payment powered by Razorpay
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '16px 32px',
                    background: '#f1f5f9',
                    color: '#64748b',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 16,
                    textAlign: 'center'
                  }}>
                    No Changes to Apply
                  </div>
                )}
              </div>

              {updateMessage && (
                <div style={{
                  padding: 12,
                  background: updateMessage.includes('success') || updateMessage.includes('Credit') 
                    ? '#f0fdf4' 
                    : '#fef2f2',
                  border: `1px solid ${updateMessage.includes('success') || updateMessage.includes('Credit') 
                    ? '#86efac' 
                    : '#fecaca'}`,
                  borderRadius: 8,
                  color: updateMessage.includes('success') || updateMessage.includes('Credit') 
                    ? '#16a34a' 
                    : '#dc2626',
                  fontSize: 14
                }}>
                  {updateMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="subscription-card" style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
          padding: 32,
          overflow: 'auto'
        }}>
          <h3 style={{ 
            margin: '0 0 24px 0', 
            fontSize: 20, 
            fontWeight: 700, 
            color: '#1e293b' 
          }}>
            Payment History
          </h3>

          {payments.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: 60, 
              color: '#64748b' 
            }}>
              <span className="material-icons" style={{ 
                fontSize: 64, 
                color: '#cbd5e1', 
                marginBottom: 16, 
                display: 'block' 
              }}>receipt_long</span>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                No payment history
              </div>
              <div style={{ fontSize: 14 }}>
                Your payment transactions will appear here
              </div>
            </div>
          ) : (
            <div className="subscription-table-wrapper" style={{ overflowX: 'auto', width: '100%' }}>
            <table className="subscription-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>Date</th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>Amount</th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>Method</th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>Status</th>
                  <th style={{ 
                    padding: '12px', 
                    textAlign: 'left', 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment, idx) => (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid #f1f5f9',
                    background: idx % 2 === 0 ? '#fff' : '#f8fafc'
                  }}>
                    <td style={{ padding: '12px', fontSize: 14, color: '#1e293b' }}>
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                      {formatCurrency(payment.amount, true)}
                    </td>
                    <td style={{ padding: '12px', fontSize: 14, color: '#64748b', textTransform: 'capitalize' }}>
                      {payment.paymentMethod || 'N/A'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        background: payment.status === 'success' ? '#dcfce7' : '#fef2f2',
                        color: payment.status === 'success' ? '#166534' : '#dc2626',
                        textTransform: 'capitalize'
                      }}>
                        {payment.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {payment.invoiceUrl ? (
                        <a
                          href={payment.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: '#3b82f6',
                            textDecoration: 'none',
                            fontSize: 14,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 18 }}>download</span>
                          Download
                        </a>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 14 }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SubscriptionManagement;

