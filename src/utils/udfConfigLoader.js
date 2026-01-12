/**
 * UDF Configuration Loader
 * Loads and parses UDF configurations from company config
 */

import { apiGet } from './apiUtils';

// Cache for UDF configurations
const udfConfigCache = new Map();

/**
 * Loads UDF configuration for a company
 * @param {string|number} tallyloc_id 
 * @param {string} co_guid 
 * @returns {Promise<Object|null>} - UDF config or null
 */
export async function loadUdfConfig(tallyloc_id, co_guid) {
  if (!tallyloc_id || !co_guid) {
    return null;
  }

  const cacheKey = `udf_${tallyloc_id}_${co_guid}`;
  
  // Check cache first (5 minute cache)
  if (udfConfigCache.has(cacheKey)) {
    const cached = udfConfigCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.config;
    }
  }

  try {
    const cacheBuster = Date.now();
    const data = await apiGet(`/api/cmpconfig/list?tallyloc_id=${tallyloc_id}&co_guid=${co_guid}&ts=${cacheBuster}`);
    
    // Handle various response structures (same as tallyconfig.js)
    let configs = [];
    if (data) {
      if (data.success && Array.isArray(data.data)) {
        configs = data.data;
      } else if (data.success && data.data && !Array.isArray(data.data)) {
        configs = data.data.configurations || data.data.configs || [];
      } else if (Array.isArray(data.data)) {
        configs = data.data;
      } else if (data.configurations || data.configs) {
        configs = data.configurations || data.configs || [];
      } else if (Array.isArray(data)) {
        configs = data;
      } else {
        configs = data.configurations || data.configs || data.list || [];
      }
    }
    
    // Find Voucher_udf config
    console.log('UDF Config Loader: Searching for Voucher_udf in', configs.length, 'configs');
    const voucherUdfConfig = configs.find(c => {
      const key = (c.config_key || c.config_name || '').toLowerCase();
      return key === 'voucher_udf';
    });
    
    if (!voucherUdfConfig) {
      console.log('UDF Config Loader: Voucher_udf config not found. Available config keys:', 
        configs.map(c => c.config_key || c.config_name));
      udfConfigCache.set(cacheKey, {
        config: null,
        timestamp: Date.now()
      });
      return null;
    }
    
    console.log('UDF Config Loader: Found Voucher_udf config', {
      is_enabled: voucherUdfConfig.is_enabled,
      has_permission_value_json: !!voucherUdfConfig.permission_value_json
    });
    
    // Check if enabled
    const isEnabled = voucherUdfConfig.is_enabled === true || voucherUdfConfig.is_enabled === 1;
    if (!isEnabled) {
      udfConfigCache.set(cacheKey, {
        config: null,
        timestamp: Date.now()
      });
      return null;
    }
    
    // Parse permission_value_json
    let udfConfig = null;
    if (voucherUdfConfig.permission_value_json) {
      try {
        udfConfig = typeof voucherUdfConfig.permission_value_json === 'string'
          ? JSON.parse(voucherUdfConfig.permission_value_json)
          : voucherUdfConfig.permission_value_json;
        console.log('UDF Config Loader: Parsed permission_value_json', udfConfig);
      } catch (error) {
        console.error('Error parsing UDF permission_value_json:', error, voucherUdfConfig.permission_value_json);
        udfConfig = null;
      }
    } else {
      console.log('UDF Config Loader: No permission_value_json found in config', voucherUdfConfig);
    }
    
    // Cache the result
    udfConfigCache.set(cacheKey, {
      config: udfConfig,
      timestamp: Date.now()
    });
    
    return udfConfig;
  } catch (error) {
    console.error('Error loading UDF config:', error);
    return null;
  }
}

/**
 * Gets list of all available UDF fields and aggregates
 * @param {Object} udfConfig - UDF configuration
 * @returns {Object} - { fields: [], aggregates: [] }
 */
export function getAvailableUdfFields(udfConfig) {
  if (!udfConfig) return { fields: [], aggregates: [] };
  
  const fields = [];
  const aggregates = [];
  
  Object.keys(udfConfig).forEach(tableName => {
    const tableConfig = udfConfig[tableName];
    if (!Array.isArray(tableConfig) || tableConfig.length === 0) return;
    
    const configObj = tableConfig[0];
    
    Object.keys(configObj).forEach(fieldName => {
      const formula = configObj[fieldName];
      
      if (Array.isArray(formula)) {
        // Aggregate
        const aggregateFields = Object.keys(formula[0] || {}).map(f => ({
          fullName: `${fieldName}.${f}`,
          aggregateName: fieldName,
          fieldName: f,
          formula: formula[0][f],
          table: tableName
        }));
        
        aggregates.push({
          name: fieldName,
          table: tableName,
          fields: aggregateFields
        });
      } else if (typeof formula === 'string') {
        // Simple field
        fields.push({
          name: fieldName,
          formula: formula,
          table: tableName
        });
      }
    });
  });
  
  return { fields, aggregates };
}

/**
 * Clear UDF config cache
 */
export function clearUdfConfigCache() {
  udfConfigCache.clear();
}

/**
 * Clear UDF config cache for a specific company
 */
export function clearCompanyUdfConfigCache(tallyloc_id, co_guid) {
  const cacheKey = `udf_${tallyloc_id}_${co_guid}`;
  udfConfigCache.delete(cacheKey);
  console.log('UDF Config Loader: Cleared cache for', cacheKey);
}

/**
 * Force reload UDF config (bypasses cache)
 */
export async function reloadUdfConfig(tallyloc_id, co_guid) {
  clearCompanyUdfConfigCache(tallyloc_id, co_guid);
  return await loadUdfConfig(tallyloc_id, co_guid);
}

