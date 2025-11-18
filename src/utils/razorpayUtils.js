// Razorpay utility functions
import { apiPost } from './apiUtils';

let razorpayLoaded = false;
let razorpayLoading = false;

/**
 * Load Razorpay SDK script
 * @returns {Promise<void>}
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve, reject) => {
    if (razorpayLoaded && window.Razorpay) {
      resolve();
      return;
    }

    if (razorpayLoading) {
      // Wait for existing load to complete
      const checkInterval = setInterval(() => {
        if (razorpayLoaded && window.Razorpay) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    razorpayLoading = true;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayLoaded = true;
      razorpayLoading = false;
      resolve();
    };
    script.onerror = () => {
      razorpayLoading = false;
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay instance
 * @param {Object} options - Razorpay options
 * @returns {Object} Razorpay instance
 */
export const initializeRazorpay = (options) => {
  if (!window.Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  return new window.Razorpay({
    ...options,
    theme: {
      color: '#1e40af',
      ...options.theme
    }
  });
};

/**
 * Open Razorpay checkout
 * @param {Object} orderData - Order data from backend
 * @param {Object} callbacks - Success and failure callbacks
 * @returns {Promise<void>}
 */
export const openCheckout = async (orderData, callbacks = {}) => {
  try {
    await loadRazorpayScript();

    const { orderId, amount, currency = 'INR', key } = orderData;

    if (!orderId || !amount || !key) {
      throw new Error('Invalid order data');
    }

    const options = {
      key: key || process.env.REACT_APP_RAZORPAY_KEY_ID,
      amount: amount, // Amount in paise
      currency: currency,
      name: 'DataLynk',
      description: 'Subscription Payment',
      order_id: orderId,
      handler: async (response) => {
        if (callbacks.onSuccess) {
          await callbacks.onSuccess(response);
        }
      },
      prefill: {
        email: sessionStorage.getItem('email') || '',
        name: sessionStorage.getItem('name') || '',
        contact: sessionStorage.getItem('mobile') || ''
      },
      notes: {
        order_id: orderId,
        subscription: 'true'
      },
      theme: {
        color: '#1e40af'
      },
      modal: {
        ondismiss: () => {
          if (callbacks.onDismiss) {
            callbacks.onDismiss();
          }
        }
      },
      // Enable all payment methods
      method: {
        netbanking: true,
        wallet: true,
        upi: true,
        card: true,
        emi: false
      }
    };

    const razorpay = initializeRazorpay(options);
    razorpay.open();

    return razorpay;
  } catch (error) {
    console.error('Error opening Razorpay checkout:', error);
    if (callbacks.onError) {
      callbacks.onError(error);
    }
    throw error;
  }
};

/**
 * Handle payment success
 * @param {Object} paymentResponse - Payment response from Razorpay
 * @param {Object} subscriptionData - Subscription data (planId, billingCycle, addOnUsers)
 * @returns {Promise<Object>} Verification result
 */
export const handlePaymentSuccess = async (paymentResponse, subscriptionData) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentResponse;
    const { planId, billingCycle, addOnUsers } = subscriptionData;

    const verificationData = await apiPost('/api/subscription/verify-payment', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billingCycle,
      addOnUsers
    });

    return {
      success: true,
      data: verificationData
    };
  } catch (error) {
    console.error('Error verifying payment:', error);
    return {
      success: false,
      error: error.message || 'Payment verification failed'
    };
  }
};

/**
 * Handle payment failure
 * @param {Object} error - Error object
 * @returns {Object} Error response
 */
export const handlePaymentFailure = (error) => {
  console.error('Payment failed:', error);
  return {
    success: false,
    error: error.error?.description || error.message || 'Payment failed'
  };
};

/**
 * Create payment order and open checkout
 * @param {Object} subscriptionData - Subscription data
 * @param {Object} callbacks - Callbacks
 * @returns {Promise<void>}
 */
export const createOrderAndCheckout = async (subscriptionData, callbacks = {}) => {
  try {
    // Create order on backend
    const orderData = await apiPost('/api/subscription/create-order', subscriptionData);

    if (!orderData || !orderData.orderId) {
      throw new Error('Failed to create order');
    }

    // Open Razorpay checkout
    await openCheckout(orderData, {
      onSuccess: async (response) => {
        const verification = await handlePaymentSuccess(response, subscriptionData);
        if (verification.success && callbacks.onSuccess) {
          callbacks.onSuccess(verification.data);
        } else if (!verification.success && callbacks.onError) {
          callbacks.onError(verification.error);
        }
      },
      onError: (error) => {
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      },
      onDismiss: () => {
        if (callbacks.onDismiss) {
          callbacks.onDismiss();
        }
      }
    });
  } catch (error) {
    console.error('Error in createOrderAndCheckout:', error);
    if (callbacks.onError) {
      callbacks.onError(error.message || 'Failed to process payment');
    }
  }
};

