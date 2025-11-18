import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrialStatus, dismissTrialReminder, getTrialDaysRemaining } from '../../utils/subscriptionUtils';
import { apiGet } from '../../utils/apiUtils';

function TrialReminderModal() {
  const [showModal, setShowModal] = useState(false);
  const [trialStatus, setTrialStatus] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAndShowReminder();
  }, []);

  const checkAndShowReminder = async () => {
    try {
      const status = await getTrialStatus();
      
      if (status && status.isTrial && status.daysRemaining <= 7 && !status.reminderDismissed) {
        setTrialStatus(status);
        
        // Fetch plans for display
        try {
          const plansData = await apiGet('/api/subscription/plans');
          if (plansData?.plans) {
            setPlans(plansData.plans);
          }
        } catch (error) {
          console.error('Error fetching plans:', error);
        }
        
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error checking trial status:', error);
    }
  };

  const handleSubscribeNow = () => {
    setShowModal(false);
    navigate('/admin-dashboard?view=subscription');
  };

  const handleRemindMeLater = async () => {
    setLoading(true);
    try {
      const success = await dismissTrialReminder('7_day');
      if (success) {
        setShowModal(false);
        // Store in localStorage as backup
        localStorage.setItem('trialReminderDismissed', Date.now().toString());
      }
    } catch (error) {
      console.error('Error dismissing reminder:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
  };

  if (!showModal || !trialStatus) return null;

  const daysRemaining = trialStatus.daysRemaining || getTrialDaysRemaining(trialStatus.trialEndDate);

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
      onClick={handleClose}
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
          onClick={handleClose}
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
          }}>
            <span className="material-icons" style={{ fontSize: 32, color: '#fff' }}>schedule</span>
          </div>
          <h2 style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 8
          }}>
            Trial Ending Soon
          </h2>
          <p style={{
            margin: 0,
            fontSize: 16,
            color: '#64748b'
          }}>
            Your free trial expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
          </p>
        </div>

        {/* Trial Info */}
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          border: '1px solid #fbbf24'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span className="material-icons" style={{ fontSize: 24, color: '#f59e0b' }}>info</span>
            <span style={{ fontWeight: 600, color: '#92400e', fontSize: 16 }}>
              Don't lose access to your data
            </span>
          </div>
          <p style={{ margin: 0, color: '#78350f', fontSize: 14, lineHeight: 1.6 }}>
            Subscribe now to continue using all features and maintain access to your Tally connections, 
            user management, and analytics after your trial ends.
          </p>
        </div>

        {/* Plans Preview */}
        {plans.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: 18,
              fontWeight: 600,
              color: '#1e293b'
            }}>
              Choose a Plan
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {plans.slice(0, 2).map((plan) => (
                <div
                  key={plan.id}
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={handleSubscribeNow}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 4 }}>
                        {plan.name}
                      </div>
                      <div style={{ fontSize: 14, color: '#64748b' }}>
                        {plan.baseUsers} base users
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: 20, color: '#1e40af' }}>
                        ₹{plan.monthlyPrice}/mo
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        or ₹{plan.annualPrice}/yr
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleSubscribeNow}
            style={{
              flex: 1,
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
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
            <span className="material-icons" style={{ fontSize: 20 }}>credit_card</span>
            Subscribe Now
          </button>
          <button
            onClick={handleRemindMeLater}
            disabled={loading}
            style={{
              padding: '14px 24px',
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: loading ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#e2e8f0';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#f1f5f9';
              }
            }}
          >
            {loading ? 'Dismissing...' : 'Remind Me Later'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrialReminderModal;

