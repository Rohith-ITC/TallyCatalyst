// Subscription utility functions
import { apiGet, apiPost } from './apiUtils';

/**
 * Get current subscription status
 * @returns {Promise<Object>} Subscription status object
 * Note: API endpoint removed - returns null as backend doesn't support this endpoint
 */
export const checkSubscriptionStatus = async () => {
  // API endpoint /api/subscription/status does not exist in backend
  return null;
};

/**
 * Check if user can create more users
 * @returns {Promise<Object>} Object with canCreate and details
 * Note: API endpoints removed - returns allow creation as backend doesn't support these endpoints
 */
export const checkUserLimit = async () => {
  // API endpoints /api/subscription/status and /api/subscription/user-count do not exist in backend
  // Graceful degradation - allow creation if check fails
  return { canCreate: true, reason: 'API endpoints not available, allowing creation' };
};

/**
 * Get trial days remaining
 * @param {string} trialEndDate - ISO date string
 * @returns {number} Days remaining
 */
export const getTrialDaysRemaining = (trialEndDate) => {
  if (!trialEndDate) return null;
  
  const endDate = new Date(trialEndDate);
  const now = new Date();
  
  // Set both dates to start of day (midnight) for accurate day comparison
  const endStartOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const nowStartOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = endStartOfDay - nowStartOfDay;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Return null if expired (negative days), but allow 0 days (expires today is still valid today)
  return diffDays >= 0 ? diffDays : null;
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
 * Note: API endpoint removed - returns null as backend doesn't support this endpoint
 */
export const getTrialStatus = async () => {
  // API endpoint /api/subscription/trial-status does not exist in backend
  return null;
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

