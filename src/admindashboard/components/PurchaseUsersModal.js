import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkSubscriptionStatus, formatCurrency } from '../../utils/subscriptionUtils';
import { apiGet } from '../../utils/apiUtils';
import RazorpayPayment from './RazorpayPayment';
import { apiPost } from '../../utils/apiUtils';

function PurchaseUsersModal({ isOpen, onClose, onSuccess }) {
  const [subscription, setSubscription] = useState(null);
  const [additionalUsers, setAdditionalUsers] = useState(1);
  const [loading, setLoading] = useState(false);
  const [perUserPrice, setPerUserPrice] = useState(200);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchSubscriptionData();
    }
  }, [isOpen]);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    try {
      const subData = await checkSubscriptionStatus();
      setSubscription(subData);
      
      if (subData) {
        setBillingCycle(subData.billingCycle || 'monthly');
        
        // Get per-user price from plans
        try {
          const plansData = await apiGet('/api/subscription/plans');
          if (plansData?.plans && plansData.plans.length > 0) {
            const currentPlan = plansData.plans.find(p => p.id === subData.planId);
            if (currentPlan) {
              setPerUserPrice(currentPlan.perUserAddOn || 200);
            }
          }
        } catch (error) {
          console.error('Error fetching plans:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (change) => {
    const newValue = Math.max(1, additionalUsers + change);
    setAdditionalUsers(newValue);
  };

  const calculateTotal = () => {
    // Calculate only for the additional users being purchased
    // The backend will handle proration if needed
    if (billingCycle === 'annual') {
      return perUserPrice * additionalUsers * 12;
    }
    return perUserPrice * additionalUsers;
  };

  const handlePaymentSuccess = async () => {
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  if (!isOpen) return null;

  const totalAmount = calculateTotal();
  const currentUsers = subscription?.total_user_limit || 0;
  const newLimit = currentUsers + additionalUsers;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 20,
          padding: 32,
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s',
            color: '#64748b'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
          }}
        >
          <span className="material-icons" style={{ fontSize: 24 }}>close</span>
        </button>

        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#fff' }}>person_add</span>
          </div>
          <h2 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 8
          }}>
            Purchase Additional Users
          </h2>
          <p style={{
            margin: 0,
            fontSize: 16,
            color: '#64748b'
          }}>
            You've reached your user limit. Add more users to continue.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <span className="material-icons" style={{ 
              fontSize: 48, 
              color: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }}>sync</span>
          </div>
        ) : (
          <>
            {/* Current Status */}
            <div style={{
              background: '#fef2f2',
              borderRadius: 12,
              padding: 20,
              marginBottom: 24,
              border: '1px solid #fecaca'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span className="material-icons" style={{ fontSize: 24, color: '#dc2626' }}>warning</span>
                <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 16 }}>
                  User Limit Reached
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.6, marginBottom: 8 }}>
                You have used all <strong>{currentUsers} user slots</strong> in your current subscription. 
                You cannot create more users until you purchase additional user slots.
              </div>
              <div style={{ 
                fontSize: 13, 
                color: '#92400e', 
                padding: '8px 12px',
                background: '#fef3c7',
                borderRadius: 6,
                border: '1px solid #fde68a'
              }}>
                <strong>Note:</strong> After payment, your user limit will be increased immediately, 
                and you'll be able to create the new users right away.
              </div>
            </div>

            {/* User Selection */}
            <div style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 4px 24px rgba(31,38,135,0.08)',
              padding: 24,
              marginBottom: 24
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: 18,
                fontWeight: 700,
                color: '#1e293b'
              }}>
                Select Number of Users
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <button
                  onClick={() => handleUserChange(-1)}
                  disabled={additionalUsers === 1}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '2px solid #e2e8f0',
                    background: additionalUsers === 1 ? '#f1f5f9' : '#fff',
                    cursor: additionalUsers === 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: additionalUsers === 1 ? '#cbd5e1' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (additionalUsers > 1) {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.background = '#f0f9ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (additionalUsers > 1) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#fff';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 24 }}>remove</span>
                </button>
                
                <div style={{ 
                  minWidth: 120, 
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontSize: 36, 
                    fontWeight: 700, 
                    color: '#1e293b',
                    marginBottom: 4
                  }}>
                    {additionalUsers}
                  </div>
                  <div style={{ fontSize: 14, color: '#64748b' }}>
                    {additionalUsers === 1 ? 'user' : 'users'}
                  </div>
                </div>
                
                <button
                  onClick={() => handleUserChange(1)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '2px solid #3b82f6',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#3b82f6',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f9ff';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 24 }}>add</span>
                </button>
              </div>

              {/* Pricing Info */}
              <div style={{
                padding: 16,
                background: '#f0f9ff',
                borderRadius: 12,
                border: '1px solid #bae6fd'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: '#64748b' }}>Price per user:</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    ₹{perUserPrice}/{billingCycle === 'annual' ? 'year' : 'month'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: '#64748b' }}>Number of users:</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {additionalUsers}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 12,
                  borderTop: '2px solid #bae6fd',
                  marginTop: 8
                }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Total Amount:</span>
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 }}>
                  per {billingCycle === 'annual' ? 'year' : 'month'}
                </div>
              </div>

              {/* New Limit Info */}
              <div style={{
                marginTop: 16,
                padding: 12,
                background: '#f0fdf4',
                borderRadius: 8,
                border: '1px solid #86efac'
              }}>
                <div style={{ fontSize: 14, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                  <span>
                    After purchase, your user limit will increase from <strong>{currentUsers}</strong> to <strong>{newLimit}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Section */}
            <div style={{ textAlign: 'center' }}>
              <RazorpayPayment
                subscriptionData={{
                  planId: subscription?.planId || null,
                  billingCycle: billingCycle,
                  addOnUsers: (subscription?.addOnUsers || 0) + additionalUsers, // Total add-ons after purchase
                  isUpgrade: false,
                  currentPlanId: subscription?.planId || null,
                  addUsersOnly: true,
                  additionalUsersCount: additionalUsers // Number of users being added
                }}
                onSuccess={handlePaymentSuccess}
                onError={(error) => {
                  console.error('Payment error:', error);
                }}
                buttonText={`Pay ${formatCurrency(totalAmount)} & Add ${additionalUsers} User${additionalUsers > 1 ? 's' : ''}`}
                buttonStyle={{ 
                  padding: '16px 48px', 
                  fontSize: 18,
                  fontWeight: 700,
                  minWidth: 300
                }}
              />
              
              <button
                onClick={onClose}
                style={{
                  marginTop: 16,
                  padding: '12px 24px',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default PurchaseUsersModal;

