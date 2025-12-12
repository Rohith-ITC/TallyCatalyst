// Cache access control utilities
import { hybridCache } from './hybridCache';
import { apiGet } from './apiUtils';

// Cache for per-user external cache settings (email -> enabled)
let externalUserCacheEnabledCache = new Map(); // Map<email, enabled>
let externalUserCacheEnabledCacheTime = new Map(); // Map<email, timestamp>
const CACHE_SETTING_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if current user is an external user based on access_type
 * @returns {boolean} True if user is external
 */
export const isExternalUser = () => {
  try {
    const accessType = sessionStorage.getItem('access_type') || '';
    return accessType.toLowerCase() === 'external';
  } catch (error) {
    console.error('Error checking if user is external:', error);
    return false;
  }
};

/**
 * Check if current user has full access or is internal
 * @returns {boolean} True if user has full access or is internal
 */
export const isFullAccessOrInternal = () => {
  try {
    const accessType = sessionStorage.getItem('access_type') || '';
    const accessTypeLower = accessType.toLowerCase();
    return accessTypeLower === 'full access' || accessTypeLower === 'internal';
  } catch (error) {
    console.error('Error checking access type:', error);
    return false;
  }
};

/**
 * Fetch external user cache setting from backend for a specific user
 * @param {string} userEmail - Email of the user to check (defaults to current user's email)
 * @returns {Promise<boolean>} True if this external user is allowed to cache
 */
export const fetchExternalUserCacheEnabled = async (userEmail = null) => {
  try {
    // Get user email - use provided email or current user's email
    const email = userEmail || sessionStorage.getItem('email');
    if (!email) {
      console.warn('No email provided for cache setting check');
      return false;
    }

    // Check cache first
    const now = Date.now();
    const cachedTime = externalUserCacheEnabledCacheTime.get(email);
    if (externalUserCacheEnabledCache.has(email) && 
        cachedTime && 
        (now - cachedTime) < CACHE_SETTING_TTL) {
      return externalUserCacheEnabledCache.get(email);
    }

    // Fetch from API with user email
    const cacheBuster = Date.now();
    const response = await apiGet(`/api/tally/external-user-cache-enabled?email=${encodeURIComponent(email)}&ts=${cacheBuster}`);
    
    if (response && typeof response.enabled === 'boolean') {
      externalUserCacheEnabledCache.set(email, response.enabled);
      externalUserCacheEnabledCacheTime.set(email, now);
      return response.enabled;
    }

    // Default to false if API fails or returns invalid response
    externalUserCacheEnabledCache.set(email, false);
    externalUserCacheEnabledCacheTime.set(email, now);
    return false;
  } catch (error) {
    console.error('Error fetching external user cache setting:', error);
    // Default to false on error
    const email = userEmail || sessionStorage.getItem('email');
    if (email) {
      externalUserCacheEnabledCache.set(email, false);
      externalUserCacheEnabledCacheTime.set(email, Date.now());
    }
    return false;
  }
};

/**
 * Clear the cache for external user cache setting (call after updating setting)
 * @param {string} userEmail - Optional email to clear cache for specific user, or clear all if not provided
 */
export const clearExternalUserCacheSettingCache = (userEmail = null) => {
  if (userEmail) {
    externalUserCacheEnabledCache.delete(userEmail);
    externalUserCacheEnabledCacheTime.delete(userEmail);
  } else {
    // Clear all cached settings
    externalUserCacheEnabledCache.clear();
    externalUserCacheEnabledCacheTime.clear();
  }
};

/**
 * Check if external user is allowed to cache (synchronous check using cache)
 * @param {string} userEmail - Optional email of the user to check (defaults to current user's email)
 * @returns {boolean} True if this external user can cache
 */
export const canExternalUserCache = (userEmail = null) => {
  const email = userEmail || sessionStorage.getItem('email');
  if (!email) {
    return false;
  }
  // If cache is not set, return false (will be fetched async when needed)
  if (!externalUserCacheEnabledCache.has(email)) {
    return false;
  }
  return externalUserCacheEnabledCache.get(email);
};

/**
 * Get cache access permission for current user
 * @param {boolean} externalUserCacheEnabled - Whether external user cache is enabled (from async fetch)
 * @param {string} userEmail - Optional email of the user to check (defaults to current user's email)
 * @returns {boolean} True if user can access cache management
 */
export const getCacheAccessPermission = (externalUserCacheEnabled = false, userEmail = null) => {
  // Full access and internal users always have access
  if (isFullAccessOrInternal()) {
    return true;
  }

  // External users only have access if per-user setting allows it
  if (isExternalUser()) {
    return externalUserCacheEnabled;
  }

  // Default: no access
  return false;
};

/**
 * Clear all cache storage types for external users
 * This includes OPFS, IndexedDB, sessionStorage, and localStorage cache
 */
export const clearAllCacheForExternalUser = async () => {
  try {
    console.log('🧹 Clearing all cache for external user...');

    // Get company info if available
    const company = sessionStorage.getItem('company');
    const guid = sessionStorage.getItem('guid');
    const tallyloc_id = sessionStorage.getItem('tallyloc_id');

    let companyInfo = null;
    if (company && guid && tallyloc_id) {
      companyInfo = {
        company,
        guid,
        tallyloc_id
      };
    }

    // Clear OPFS and IndexedDB cache via hybridCache
    if (companyInfo) {
      try {
        await hybridCache.clearCompanyCache(companyInfo);
        console.log('✅ Cleared OPFS/IndexedDB cache');
      } catch (error) {
        console.error('Error clearing OPFS/IndexedDB cache:', error);
      }
    }

    // Clear all cache entries from hybridCache
    try {
      const allEntries = await hybridCache.listAllCacheEntries();
      if (allEntries && allEntries.length > 0) {
        for (const entry of allEntries) {
          try {
            await hybridCache.deleteCacheKey(entry.cacheKey);
          } catch (error) {
            console.warn(`Error deleting cache key ${entry.cacheKey}:`, error);
          }
        }
        console.log(`✅ Cleared ${allEntries.length} cache entries from hybridCache`);
      }
    } catch (error) {
      console.error('Error listing/clearing cache entries:', error);
    }

    // Clear sessionStorage cache (preserve auth data)
    const authKeys = ['token', 'email', 'name', 'tallyloc_id', 'company', 'guid', 'status', 'access_type', 'selectedCompanyGuid', 'allConnections', 'userAccessPermissions'];
    const sessionKeys = Object.keys(sessionStorage);
    let clearedSessionCount = 0;
    
    sessionKeys.forEach(key => {
      const isCacheKey = key.startsWith('datalynk_') || 
                        key.startsWith('ledgerlist-w-addrs_') || 
                        key.startsWith('stockitem_') ||
                        key.startsWith('stockitems_') ||
                        key.endsWith('_chunks') ||
                        key.includes('_chunk_') ||
                        key.includes('_count') ||
                        key.includes('cache') ||
                        key.includes('Cache');
      const isAuthKey = authKeys.includes(key);
      
      if (!isAuthKey && isCacheKey) {
        try {
          sessionStorage.removeItem(key);
          clearedSessionCount++;
        } catch (error) {
          console.warn(`Error removing sessionStorage key ${key}:`, error);
        }
      }
    });
    console.log(`✅ Cleared ${clearedSessionCount} sessionStorage cache keys`);

    // Clear localStorage cache entries
    const localStorageKeys = Object.keys(localStorage);
    let clearedLocalCount = 0;
    
    localStorageKeys.forEach(key => {
      const isCacheKey = key.startsWith('datalynk_') || 
                        key.includes('cache') ||
                        key.includes('Cache') ||
                        key.startsWith('tallyCompaniesCache_') ||
                        key.startsWith('tallyLedgersCache_');
      
      if (isCacheKey) {
        try {
          localStorage.removeItem(key);
          clearedLocalCount++;
        } catch (error) {
          console.warn(`Error removing localStorage key ${key}:`, error);
        }
      }
    });
    console.log(`✅ Cleared ${clearedLocalCount} localStorage cache keys`);

    // Clear IndexedDB directly (Dexie database)
    try {
      if ('indexedDB' in window) {
        const dbName = 'DatalynkCacheDB';
        const deleteReq = indexedDB.deleteDatabase(dbName);
        await new Promise((resolve, reject) => {
          deleteReq.onsuccess = () => {
            console.log('✅ Cleared IndexedDB cache');
            resolve();
          };
          deleteReq.onerror = () => {
            console.warn('Error deleting IndexedDB:', deleteReq.error);
            reject(deleteReq.error);
          };
        });
      }
    } catch (error) {
      console.warn('Error clearing IndexedDB:', error);
    }

    // Clear service worker caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log(`✅ Cleared ${cacheNames.length} service worker caches`);
      } catch (error) {
        console.warn('Error clearing service worker caches:', error);
      }
    }

    console.log('✅ All cache cleared for external user');
  } catch (error) {
    console.error('Error clearing all cache for external user:', error);
  }
};

