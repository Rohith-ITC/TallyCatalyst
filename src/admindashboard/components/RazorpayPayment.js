import React, { useState } from 'react';
import { createOrderAndCheckout, handlePaymentSuccess } from '../../utils/razorpayUtils';
import { apiPost } from '../../utils/apiUtils';

function RazorpayPayment({ 
  subscriptionData, 
  onSuccess, 
  onError, 
  onDismiss,
  buttonText = 'Pay Now',
  buttonStyle = {}
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      await createOrderAndCheckout(subscriptionData, {
        onSuccess: (data) => {
          setLoading(false);
          if (onSuccess) {
            onSuccess(data);
          }
        },
        onError: (errorMessage) => {
          setLoading(false);
          setError(errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        },
        onDismiss: () => {
          setLoading(false);
          if (onDismiss) {
            onDismiss();
          }
        }
      });
    } catch (error) {
      setLoading(false);
      const errorMessage = error.message || 'Failed to process payment';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  return (
    <div>
      {error && (
        <div style={{
          padding: 12,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          marginBottom: 16,
          color: '#dc2626',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span className="material-icons" style={{ fontSize: 18 }}>error</span>
          {error}
        </div>
      )}
      
      {/* Payment Methods Info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 16,
        padding: '12px 16px',
        background: '#f8fafc',
        borderRadius: 8,
        fontSize: 12,
        color: '#64748b'
      }}>
        <span style={{ fontWeight: 600 }}>Accepted Payment Methods:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>💳</span>
          <span>Cards</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>📱</span>
          <span>UPI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🏦</span>
          <span>Netbanking</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>💼</span>
          <span>Wallets</span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 16,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
          transition: 'all 0.3s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: loading ? 0.7 : 1,
          ...buttonStyle
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }
        }}
      >
        {loading ? (
          <>
            <span className="material-icons" style={{ 
              fontSize: 18, 
              animation: 'spin 1s linear infinite' 
            }}>sync</span>
            Processing...
          </>
        ) : (
          <>
            <span className="material-icons" style={{ fontSize: 18 }}>payment</span>
            {buttonText}
          </>
        )}
      </button>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default RazorpayPayment;

