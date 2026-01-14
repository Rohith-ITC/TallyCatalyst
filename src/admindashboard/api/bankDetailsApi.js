// Bank Details API service layer
// Centralized API calls for company bank details management (Superadmin only)
import { apiGet, apiPost, apiPut } from '../../utils/apiUtils';

const BASE_URL = '/api/subscriptions/admin/bank-details';

/**
 * Get all bank details (including inactive)
 */
export const getAllBankDetails = async () => {
  const response = await apiGet(BASE_URL);
  return response?.data || [];
};

/**
 * Get specific bank details by ID
 */
export const getBankDetailsById = async (id) => {
  const response = await apiGet(`${BASE_URL}/${id}`);
  return response?.data || null;
};

/**
 * Create new bank details (automatically deactivates existing active records)
 */
export const createBankDetails = async (bankData) => {
  const response = await apiPost(BASE_URL, bankData);
  return response?.data || null;
};

/**
 * Update existing bank details
 */
export const updateBankDetails = async (id, bankData) => {
  // Exclude created_at and updated_at from payload
  const { created_at, updated_at, id: bankId, created_by, ...payload } = bankData;
  const response = await apiPut(`${BASE_URL}/${id}`, payload);
  return response?.data || null;
};

