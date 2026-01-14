// Subscription API service layer
// Centralized API calls for subscription module
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiUtils';

const BASE_URL = '/api/subscriptions';

// ==================== Slab Management APIs ====================

/**
 * Get all internal user slabs
 * Returns { slabs: [], bank_details: {} }
 */
export const getInternalSlabs = async () => {
  const response = await apiGet(`${BASE_URL}/slabs/internal`);
  return {
    slabs: response?.data || [],
    bank_details: response?.bank_details || null
  };
};

/**
 * Get specific internal slab by ID
 */
export const getInternalSlab = async (id) => {
  const response = await apiGet(`${BASE_URL}/slabs/internal/${id}`);
  return response?.data || null;
};

/**
 * Create new internal slab (Superadmin only)
 */
export const createInternalSlab = async (slabData) => {
  const response = await apiPost(`${BASE_URL}/slabs/internal`, slabData);
  return response?.data || null;
};

/**
 * Update internal slab (Superadmin only)
 */
export const updateInternalSlab = async (id, slabData) => {
  // Exclude created_at and updated_at from payload
  const { created_at, updated_at, ...payload } = slabData;
  const response = await apiPut(`${BASE_URL}/slabs/internal/${id}`, payload);
  return response?.data || null;
};

/**
 * Delete internal slab (Superadmin only)
 */
export const deleteInternalSlab = async (id) => {
  const response = await apiDelete(`${BASE_URL}/slabs/internal/${id}`);
  return response?.success || false;
};


// ==================== Subscription Management APIs ====================

/**
 * Create trial subscription
 */
export const createTrial = async (tallyLocationId = null) => {
  const response = await apiPost(`${BASE_URL}/trial/create`, { tally_location_id: tallyLocationId });
  return response?.data || null;
};

/**
 * Purchase new subscription
 */
export const purchaseSubscription = async (purchaseData) => {
  const response = await apiPost(`${BASE_URL}/purchase`, purchaseData);
  return response?.data || null;
};

/**
 * Get current user's subscription
 */
export const getCurrentSubscription = async () => {
  const response = await apiGet(`${BASE_URL}/current`);
  return response?.data || null;
};

/**
 * Get subscription history
 */
export const getSubscriptionHistory = async (limit = 50, offset = 0) => {
  const response = await apiGet(`${BASE_URL}/history?limit=${limit}&offset=${offset}`);
  return response?.data || [];
};

/**
 * Upgrade subscription
 */
export const upgradeSubscription = async (upgradeData) => {
  const response = await apiPost(`${BASE_URL}/upgrade`, upgradeData);
  return response?.data || null;
};

/**
 * Downgrade subscription
 */
export const downgradeSubscription = async (downgradeData) => {
  const response = await apiPost(`${BASE_URL}/downgrade`, downgradeData);
  return response?.data || null;
};

// ==================== Billing APIs ====================

/**
 * Get billing history
 */
export const getBillingHistory = async (filters = {}) => {
  const { limit = 50, offset = 0, status = '' } = filters;
  let url = `${BASE_URL}/billing/history?limit=${limit}&offset=${offset}`;
  if (status) {
    url += `&status=${status}`;
  }
  const response = await apiGet(url);
  return response?.data || [];
};

/**
 * Get specific invoice
 */
export const getInvoice = async (id) => {
  const response = await apiGet(`${BASE_URL}/billing/invoice/${id}`);
  return response?.data || null;
};

/**
 * Calculate pro-rated amount for upgrade (preview)
 */
export const calculateUpgradeAmount = async (newSlabId) => {
  const response = await apiPost(`${BASE_URL}/billing/calculate-upgrade`, { new_slab_id: newSlabId });
  return response?.data || null;
};

// ==================== Usage APIs ====================

/**
 * Get current usage statistics
 */
export const getCurrentUsage = async () => {
  const response = await apiGet(`${BASE_URL}/usage/current`);
  return response?.data || null;
};

/**
 * Validate if user can be added
 */
export const validateUserAddition = async (userType, count = 1) => {
  const response = await apiPost(`${BASE_URL}/usage/validate`, {
    user_type: userType,
    count
  });
  return response?.data || null;
};

/**
 * Get current subscription limits
 */
export const getUsageLimits = async () => {
  const response = await apiGet(`${BASE_URL}/usage/limits`);
  return response?.data || null;
};

// ==================== Admin APIs ====================

/**
 * Get all pending payment validations (Superadmin only)
 */
export const getPendingPayments = async (filters = {}) => {
  const { limit = 10, offset = 0, date_from = '' } = filters;
  let url = `${BASE_URL}/admin/payments/pending?limit=${limit}&offset=${offset}`;
  if (date_from) {
    url += `&date_from=${date_from}`;
  }
  const response = await apiGet(url);
  return response?.data || [];
};

/**
 * Get specific pending payment details
 */
export const getPendingPayment = async (id) => {
  const response = await apiGet(`${BASE_URL}/admin/payments/pending/${id}`);
  return response?.data || null;
};

/**
 * Validate and approve/reject payment (Superadmin only)
 */
export const validatePayment = async (id, action, validationNotes = '') => {
  const response = await apiPost(`${BASE_URL}/admin/payments/validate/${id}`, {
    action,
    validation_notes: validationNotes
  });
  return response?.data || null;
};

/**
 * Apply discount to billing record (Superadmin only)
 */
export const applyDiscount = async (billingId, discountData) => {
  const response = await apiPost(`${BASE_URL}/admin/discounts/billing/${billingId}/apply`, discountData);
  return response?.data || null;
};

/**
 * Create new partner (Superadmin only)
 */
export const createPartner = async (partnerData) => {
  const response = await apiPost(`${BASE_URL}/admin/partners/create`, partnerData);
  return response?.data || null;
};

/**
 * Get all partners (Superadmin only)
 */
export const getAllPartners = async (filters = {}) => {
  const { limit = 10, offset = 0, is_active = '' } = filters;
  let url = `${BASE_URL}/admin/partners/all?limit=${limit}&offset=${offset}`;
  if (is_active !== '') {
    url += `&is_active=${is_active}`;
  }
  const response = await apiGet(url);
  return response?.data || [];
};

/**
 * Create new employee (Superadmin only)
 */
export const createEmployee = async (employeeData) => {
  const response = await apiPost(`${BASE_URL}/admin/employees/create`, employeeData);
  return response?.data || null;
};

/**
 * Get all employees (Superadmin only)
 */
export const getAllEmployees = async (filters = {}) => {
  const { limit = 10, offset = 0 } = filters;
  const response = await apiGet(`${BASE_URL}/admin/employees/all?limit=${limit}&offset=${offset}`);
  return response?.data || [];
};

/**
 * Update partner status (Superadmin only)
 */
export const updatePartnerStatus = async (partnerId, isActive) => {
  const response = await apiPut(`${BASE_URL}/admin/partners/${partnerId}/status`, {
    is_active: isActive
  });
  return response?.data || null;
};

/**
 * Update employee status (Superadmin only)
 */
export const updateEmployeeStatus = async (employeeId, isActive) => {
  const response = await apiPut(`${BASE_URL}/admin/employees/${employeeId}/status`, {
    is_active: isActive
  });
  return response?.data || null;
};

/**
 * Create incentive configuration (Superadmin only)
 */
export const createIncentiveConfig = async (configData) => {
  const response = await apiPost(`${BASE_URL}/admin/incentive-configs/create`, configData);
  return response?.data || null;
};

// ==================== Partner Portal APIs ====================

/**
 * Get partner dashboard data
 */
export const getPartnerDashboard = async () => {
  const response = await apiGet(`${BASE_URL}/partner/dashboard`);
  return response?.data || null;
};

// ==================== Employee Portal APIs ====================

/**
 * Get employee dashboard data
 */
export const getEmployeeDashboard = async () => {
  const response = await apiGet(`${BASE_URL}/employee/dashboard`);
  return response?.data || null;
};

