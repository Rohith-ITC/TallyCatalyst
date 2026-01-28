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

/**
 * Calculate tiered pricing based on user count
 * Each user is charged based on the slab they fall into based on their position
 * Example: 3 users = 1st user (₹375) + 2nd-3rd users (₹300 × 2) = ₹975
 * @param {Array} slabs - Array of slab objects with min_users, max_users, monthly_price, yearly_price
 * @param {number} userCount - Total number of users
 * @param {string} billingCycle - 'monthly' or 'yearly'
 * @returns {Object} Object with totalAmount, breakdown (array of {slab, users, price})
 */
export const calculateTieredPricing = (slabs, userCount, billingCycle = 'monthly') => {
  if (!slabs || slabs.length === 0 || !userCount || userCount < 1) {
    return { totalAmount: 0, breakdown: [] };
  }

  // Sort slabs by min_users ascending
  const sortedSlabs = [...slabs].sort((a, b) => (a.min_users || 0) - (b.min_users || 0));
  
  // Helper function to find which slab a user position falls into
  const findSlabForUserPosition = (userPosition) => {
    // Check slabs in reverse order (highest to lowest) to find the first match
    for (let i = sortedSlabs.length - 1; i >= 0; i--) {
      const slab = sortedSlabs[i];
      const minUsers = slab.min_users || 1;
      const maxUsers = slab.max_users || minUsers;
      
      if (userPosition >= minUsers && userPosition <= maxUsers) {
        return slab;
      }
    }
    
    // If user position exceeds all slabs, use the highest slab
    if (sortedSlabs.length > 0) {
      return sortedSlabs[sortedSlabs.length - 1];
    }
    
    return null;
  };

  // Group users by their slab
  const slabGroups = {};
  
  // For each user position (1 to userCount), find which slab they belong to
  for (let userPos = 1; userPos <= userCount; userPos++) {
    const slab = findSlabForUserPosition(userPos);
    if (slab) {
      const slabId = slab.id || JSON.stringify(slab);
      if (!slabGroups[slabId]) {
        slabGroups[slabId] = {
          slab: slab,
          users: 0,
          pricePerUser: billingCycle === 'yearly' 
            ? (slab.yearly_price || 0) 
            : (slab.monthly_price || 0)
        };
      }
      slabGroups[slabId].users++;
    }
  }

  // Calculate total and create breakdown
  let totalAmount = 0;
  const breakdown = [];
  
  for (const slabId in slabGroups) {
    const group = slabGroups[slabId];
    const slabTotal = group.users * group.pricePerUser;
    totalAmount += slabTotal;
    breakdown.push({
      slab: group.slab,
      users: group.users,
      pricePerUser: group.pricePerUser,
      total: slabTotal
    });
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100, // Round to 2 decimal places
    breakdown: breakdown
  };
};

