// Subscription utility functions
import { apiGet, apiPost } from './apiUtils';

/**
 * Get current subscription status
 * @returns {Promise<Object>} Subscription status object
 */
export const checkSubscriptionStatus = async () => {
  try {
    const data = await apiGet('/api/subscription/status');
    return data?.subscription || null;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return null;
  }
};

/**
 * Check if user can create more users
 * @returns {Promise<Object>} Object with canCreate and details
 */
export const checkUserLimit = async () => {
  try {
    const [subscription, userCount] = await Promise.all([
      apiGet('/api/subscription/status'),
      apiGet('/api/subscription/user-count')
    ]);

    if (!subscription?.subscription || !userCount) {
      return { canCreate: true, reason: 'Unable to verify subscription' };
    }

    const { total_user_limit } = subscription.subscription;
    const { count } = userCount;

    if (count >= total_user_limit) {
      return {
        canCreate: false,
        reason: 'User limit reached',
        currentUsers: count,
        maxUsers: total_user_limit
      };
    }

    return {
      canCreate: true,
      currentUsers: count,
      maxUsers: total_user_limit
    };
  } catch (error) {
    console.error('Error checking user limit:', error);
    // Graceful degradation - allow creation if check fails
    return { canCreate: true, reason: 'Check failed, allowing creation' };
  }
};

/**
 * Get trial days remaining
 * @param {string} trialEndDate - ISO date string
 * @returns {number} Days remaining
 */
export const getTrialDaysRemaining = (trialEndDate) => {
  if (!trialEndDate) return 0;
  
  const endDate = new Date(trialEndDate);
  const now = new Date();
  const diffTime = endDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * Check if reminder should be shown
 * @param {Object} trialStatus - Trial status from API
 * @returns {boolean} Whether to show reminder
 */
export const shouldShowReminder = (trialStatus) => {
  if (!trialStatus) return false;
  
  const { isTrial, daysRemaining, reminderDismissed } = trialStatus;
  
  // Show if trial active, <= 7 days remaining, and not dismissed
  return isTrial && daysRemaining <= 7 && !reminderDismissed;
};

/**
 * Format currency amount
 * @param {number} amount - Amount in paise (Razorpay) or rupees
 * @param {boolean} isPaise - Whether amount is in paise
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, isPaise = false) => {
  if (typeof amount !== 'number') return '₹0';
  
  const rupees = isPaise ? amount / 100 : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(rupees);
};

/**
 * Calculate total amount from base plan and add-ons (for display only)
 * @param {Object} plan - Plan object
 * @param {string} billingCycle - 'monthly' or 'annual'
 * @param {number} addOnUsers - Number of add-on users
 * @returns {number} Total amount
 */
export const calculateTotalAmount = (plan, billingCycle, addOnUsers = 0) => {
  if (!plan) return 0;
  
  const basePrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  const addOnPrice = billingCycle === 'annual' 
    ? plan.perUserAddOn * addOnUsers * 12 
    : plan.perUserAddOn * addOnUsers;
  
  return basePrice + addOnPrice;
};

/**
 * Get trial status from API
 * @returns {Promise<Object>} Trial status object
 */
export const getTrialStatus = async () => {
  try {
    const data = await apiGet('/api/subscription/trial-status');
    return data || null;
  } catch (error) {
    console.error('Error fetching trial status:', error);
    return null;
  }
};

/**
 * Dismiss trial reminder
 * @param {string} reminderType - Type of reminder ('7_day' or 'expiry')
 * @returns {Promise<boolean>} Success status
 */
export const dismissTrialReminder = async (reminderType = '7_day') => {
  try {
    const data = await apiPost('/api/subscription/dismiss-reminder', { reminderType });
    return data?.success || false;
  } catch (error) {
    console.error('Error dismissing reminder:', error);
    return false;
  }
};

