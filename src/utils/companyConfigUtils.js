// Utility functions for fetching and using company configurations
import { apiGet } from './apiUtils';

// Cache for company configurations
const configCache = new Map();

/**
 * Get company configuration value by config key
 * @param {string} configKey - The configuration key (e.g., 'recvdash_salesprsn', 'salesdash_salesprsn')
 * @param {number} tallyloc_id - Tally location ID
 * @param {string} co_guid - Company GUID
 * @returns {Promise<string|null>} - The permission_value or null if not found/disabled
 */
export const getCompanyConfigValue = async (configKey, tallyloc_id, co_guid) => {
  if (!tallyloc_id || !co_guid) {
    console.warn('⚠️ Missing tallyloc_id or co_guid for config lookup');
    return null;
  }

  const cacheKey = `${tallyloc_id}_${co_guid}_${configKey}`;
  
  // Check cache first
  if (configCache.has(cacheKey)) {
    const cached = configCache.get(cacheKey);
    // Cache valid for 5 minutes
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.value;
    }
  }

  try {
    const cacheBuster = Date.now();
    // Use the same endpoint as tallyconfig.js for consistency
    const data = await apiGet(`/api/cmpconfig/list?tallyloc_id=${tallyloc_id}&co_guid=${co_guid}&ts=${cacheBuster}`);
    
    // Handle various response structures (same as tallyconfig.js)
    let configs = [];
    if (data) {
      // Case 1: { success: true, data: [...] }
      if (data.success && Array.isArray(data.data)) {
        configs = data.data;
      }
      // Case 2: { success: true, data: { configurations: [...] } }
      else if (data.success && data.data && !Array.isArray(data.data)) {
        configs = data.data.configurations || data.data.configs || [];
      }
      // Case 3: { data: [...] } without success flag
      else if (Array.isArray(data.data)) {
        configs = data.data;
      }
      // Case 4: { configurations: [...] }
      else if (data.configurations || data.configs) {
        configs = data.configurations || data.configs || [];
      }
      // Case 5: Direct array
      else if (Array.isArray(data)) {
        configs = data;
      }
      // Case 6: Try nested structures
      else {
        configs = data.configurations || data.configs || data.list || [];
      }
    }
    
    // Find the configuration by key
    const config = configs.find(c => {
      const key = (c.config_key || c.config_name || '').toLowerCase();
      return key === configKey.toLowerCase();
    });
    
    if (config) {
      // Check if configuration is enabled
      const isEnabled = config.is_enabled === true || config.is_enabled === 1;
      const value = isEnabled ? (config.permission_value || config.config_value || config.value || null) : null;
      
      // Cache the result
      configCache.set(cacheKey, {
        value,
        timestamp: Date.now()
      });
      
      return value;
    }
    
    // Cache null result to avoid repeated API calls
    configCache.set(cacheKey, {
      value: null,
      timestamp: Date.now()
    });
    
    return null;
  } catch (error) {
    console.error(`Error fetching company config for ${configKey}:`, error);
    return null;
  }
};

/**
 * Clear configuration cache (useful when configurations are updated)
 */
export const clearConfigCache = () => {
  configCache.clear();
};

/**
 * Clear configuration cache for a specific company
 */
export const clearCompanyConfigCache = (tallyloc_id, co_guid) => {
  const keysToDelete = [];
  configCache.forEach((value, key) => {
    if (key.startsWith(`${tallyloc_id}_${co_guid}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => configCache.delete(key));
};

