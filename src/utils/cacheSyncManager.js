// Unified Cache Sync Manager
// Consolidates sync logic, progress tracking, and cache utilities
import { hybridCache } from './hybridCache';
import { apiPost, apiGet } from './apiUtils';
import { deobfuscateStockItems } from './frontendDeobfuscate';
import { getApiUrl } from '../config';

// Cache version and utilities
export const CACHE_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
export const CACHE_KEY_PREFIX = 'datalynk_';

// Helper: Add cache buster to URLs
export const addCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
};

// Helper to remove a key and its chunked data if it exists
const removeSessionStorageKey = (key) => {
  try {
    sessionStorage.removeItem(key);
    // Also remove chunked version if it exists
    const chunksStr = sessionStorage.getItem(`${key}_chunks`);
    if (chunksStr) {
      const totalChunks = parseInt(chunksStr, 10);
      for (let i = 0; i < totalChunks; i++) {
        sessionStorage.removeItem(`${key}_chunk_${i}`);
      }
      sessionStorage.removeItem(`${key}_chunks`);
    }
  } catch (e) {
    // Ignore errors removing individual items
  }
};

// Clear all application caches (preserves auth data)
export const clearAllCaches = () => {
  try {
    console.log('🧹 clearAllCaches called');
    
    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear only cache-related sessionStorage items, NOT authentication tokens
    const authKeys = ['token', 'email', 'name', 'tallyloc_id', 'company', 'guid', 'status', 'access_type'];
    const sessionKeys = Object.keys(sessionStorage);
    
    let clearedCount = 0;
    sessionKeys.forEach(key => {
      const isCacheKey = key.startsWith(CACHE_KEY_PREFIX) || 
                        key.startsWith('ledgerlist-w-addrs_') || 
        key.startsWith('stockitem_') ||
        key.endsWith('_chunks') ||
        key.includes('_chunk_');
      const isAuthKey = authKeys.includes(key);
      
      if (!isAuthKey && isCacheKey) {
        // Check if this is a chunk metadata or chunk item
        if (key.endsWith('_chunks') || key.includes('_chunk_')) {
          // Remove chunked data
        sessionStorage.removeItem(key);
        clearedCount++;
        } else {
          // Remove main key and its chunks
          removeSessionStorageKey(key);
          clearedCount++;
        }
      }
    });
    
    // Clear service worker caches if available
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    console.log(`🧹 All caches cleared successfully (authentication data preserved). Cleared ${clearedCount} cache keys`);
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

// Check if app version has changed
export const checkVersionUpdate = () => {
  const storedVersion = localStorage.getItem(`${CACHE_KEY_PREFIX}version`);
  
  // Don't clear if storedVersion is a placeholder (build issue)
  if (storedVersion && storedVersion.includes('%') && storedVersion.includes('REACT_APP_VERSION')) {
    console.log('⚠️ Detected placeholder version, setting to current version without clearing');
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
    return false;
  }
  
  if (storedVersion && storedVersion !== CACHE_VERSION) {
    console.log(`🔄 Version changed from ${storedVersion} to ${CACHE_VERSION} - clearing caches`);
    clearAllCaches();
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
    return true;
  } else if (!storedVersion) {
    console.log('🔄 No stored version found, setting initial version');
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
  }
  
  return false;
};


// Detect mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Fetch with timeout and retry logic
// Increased timeout and retries for large data downloads
const fetchWithTimeout = async (url, options, timeout = 300000, retries = 10) => {
  const isMobile = isMobileDevice();
  // Use longer timeout for large data - 5 minutes default, 7.5 minutes for mobile
  const effectiveTimeout = isMobile ? 450000 : timeout;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, effectiveTimeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          cache: 'no-cache',
          mode: 'cors',
          credentials: 'omit'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error message');
          const errorMessage = `HTTP ${response.status}: ${response.statusText}. ${errorText.substring(0, 200)}`;
          
          // Don't retry on 500 errors - stop immediately
          if (response.status === 500) {
            throw new Error(errorMessage);
          }
          
          throw new Error(errorMessage);
        }
        
        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // Check for CORS errors - don't retry, stop immediately
        const isCorsError = fetchError.message.includes('CORS') || 
                           fetchError.message.includes('cors') ||
                           fetchError.message.includes('Access-Control') ||
                           (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch'));
        
        if (isCorsError) {
          throw new Error(`CORS Error: ${fetchError.message}. Please check server configuration and try again.`);
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Check for 500 errors - don't retry, stop immediately
      const is500Error = error.message.includes('HTTP 500') || error.message.includes('500');
      
      // Check for CORS errors - don't retry, stop immediately
      // This includes errors we've already marked as CORS errors in the inner catch
      const isCorsError = error.message.includes('CORS Error:') ||
                         error.message.includes('CORS') || 
                         error.message.includes('cors') ||
                         error.message.includes('Access-Control');
      
      if (is500Error || isCorsError) {
        throw error;
      }
      
      const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
      const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Network request failed');
      
      // Don't retry on non-retryable errors
      if (!isTimeout && !isNetworkError && !error.message.includes('504') && !error.message.includes('408') && !error.message.includes('502')) {
        throw error;
      }
      
      // If last attempt, throw detailed error
      if (attempt === retries) {
        throw new Error(
          `Failed after ${retries} attempts. ` +
          `Last error: ${error.message}. ` +
          `Device: ${isMobile ? 'Mobile' : 'Desktop'}. ` +
          `Online: ${navigator.onLine}. ` +
          `Please check your internet connection and try again.`
        );
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Helper functions for date conversion
const convertDateToYYYYMMDD = (dateString) => {
  if (!dateString) return null;
  if (/^\d{8}$/.test(dateString)) return dateString;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return dateString.replace(/-/g, '');

  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthName = parts[1].toLowerCase();
      const year = parseInt(parts[2], 10);
      const monthIndex = monthNames.findIndex(m => m === monthName);
      if (monthIndex === -1) return null;
      const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
      const month = String(monthIndex + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return `${fullYear}${month}${dayStr}`;
    }
  } catch (error) {
    console.warn('Error parsing date:', dateString, error);
  }
  return null;
};

const formatDateForAPI = (dateString) => {
  const converted = convertDateToYYYYMMDD(dateString);
  if (converted) return converted;
  if (dateString.includes('-')) return dateString.replace(/-/g, '');
  return dateString;
};

const splitDateRange = (startDate, endDate) => {
  const chunks = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let currentStart = new Date(start);
  while (currentStart <= end) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + 1); // 2-day chunks (start + 1 day = 2 days total)
    if (currentEnd > end) currentEnd = new Date(end);
    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    currentStart.setDate(currentStart.getDate() + 2); // Move to next chunk (2 days forward)
  }
  return chunks;
};

const calculateMaxAlterId = (data) => {
  if (!data || !data.vouchers || !Array.isArray(data.vouchers)) return null;
  let maxAlterId = null;
  for (const voucher of data.vouchers) {
    const alterid = voucher.alterid || voucher.ALTERID;
    if (alterid !== null && alterid !== undefined) {
      const numId = typeof alterid === 'string' ? parseInt(alterid, 10) : alterid;
      if (!isNaN(numId) && (maxAlterId === null || numId > maxAlterId)) {
        maxAlterId = numId;
      }
    }
  }
  return maxAlterId;
};

/**
 * Remove vouchers from cache by master ID
 * @param {Object} companyInfo - Company information { tallyloc_id, company, guid }
 * @param {Array<string>} deletedMasterIds - Array of master IDs to remove (as strings)
 * @param {string} email - User email for cache access
 * @returns {Promise<{removed: number, remaining: number}>} Number of vouchers removed and remaining
 */
const removeVouchersByMasterId = async (companyInfo, deletedMasterIds, email) => {
  if (!deletedMasterIds || !Array.isArray(deletedMasterIds) || deletedMasterIds.length === 0) {
    console.log('ℹ️ No deleted master IDs provided, skipping cleanup');
    return { removed: 0, remaining: 0 };
  }

  try {
    console.log(`🧹 Starting cleanup: Removing ${deletedMasterIds.length} master IDs from cache`);
    
    // Load current cache data
    const cachedData = await hybridCache.getCompleteSalesData(companyInfo, email);
    if (!cachedData || !cachedData.data || !cachedData.data.vouchers || !Array.isArray(cachedData.data.vouchers)) {
      console.log('ℹ️ No cached vouchers found, nothing to clean');
      return { removed: 0, remaining: 0 };
    }

    const originalCount = cachedData.data.vouchers.length;
    console.log(`📋 Cache contains ${originalCount} vouchers before cleanup`);

    // Convert deleted IDs to a Set for fast lookup (all as strings, trim whitespace)
    const deletedIdsSet = new Set(deletedMasterIds.map(id => String(id).trim()));
    
    // Also create a set with numeric comparisons for edge cases
    const deletedIdsNumericSet = new Set(
      deletedMasterIds
        .map(id => {
          const num = parseInt(String(id).trim(), 10);
          return isNaN(num) ? null : num;
        })
        .filter(id => id !== null)
    );

    // Filter out vouchers with matching master IDs
    // Check all possible master ID field variations
    const filteredVouchers = cachedData.data.vouchers.filter(voucher => {
      // Get master ID from any possible field
      const mstid = voucher.mstid || voucher.MSTID || voucher.masterid || voucher.MASTERID;
      
      // If voucher has no master ID, check if it should be removed for other reasons
      if (mstid === null || mstid === undefined || mstid === '') {
        // Also remove vouchers with empty ledgerentries and allinventoryentries
        const hasEmptyEntries = (
          (!voucher.ledgerentries || !Array.isArray(voucher.ledgerentries) || voucher.ledgerentries.length === 0) &&
          (!voucher.allinventoryentries || !Array.isArray(voucher.allinventoryentries) || voucher.allinventoryentries.length === 0)
        );
        
        if (hasEmptyEntries) {
          console.log(`🗑️ Removing voucher with no master ID and empty entries:`, {
            alterid: voucher.alterid || voucher.ALTERID,
            vouchertypename: voucher.vouchertypename || voucher.VOUCHERTYPENAME
          });
          return false; // Remove it
        }
        
        return true; // Keep vouchers without master ID that have entries
      }

      // Convert to string for comparison (trim whitespace)
      const mstidStr = String(mstid).trim();
      
      // Check string match
      if (deletedIdsSet.has(mstidStr)) {
        console.log(`🗑️ Removing voucher with master ID: ${mstidStr}`);
        return false; // Remove it
      }
      
      // Also check numeric match (in case of type mismatches)
      const mstidNum = parseInt(mstidStr, 10);
      if (!isNaN(mstidNum) && deletedIdsNumericSet.has(mstidNum)) {
        console.log(`🗑️ Removing voucher with master ID (numeric match): ${mstidNum}`);
        return false; // Remove it
      }
      
      // Also remove vouchers with empty ledgerentries and allinventoryentries (even if not in deleted list)
      const hasEmptyEntries = (
        (!voucher.ledgerentries || !Array.isArray(voucher.ledgerentries) || voucher.ledgerentries.length === 0) &&
        (!voucher.allinventoryentries || !Array.isArray(voucher.allinventoryentries) || voucher.allinventoryentries.length === 0)
      );
      
      if (hasEmptyEntries) {
        console.log(`🗑️ Removing voucher with empty entries (master ID: ${mstidStr}):`, {
          masterid: mstidStr,
          alterid: voucher.alterid || voucher.ALTERID,
          vouchertypename: voucher.vouchertypename || voucher.VOUCHERTYPENAME
        });
        return false; // Remove it
      }
      
      return true; // Keep the voucher
    });

    const removedCount = originalCount - filteredVouchers.length;
    const remainingCount = filteredVouchers.length;

    console.log(`🧹 Cleanup complete: Removed ${removedCount} vouchers, ${remainingCount} remaining`);

    // If vouchers were removed, save the filtered data back to cache
    if (removedCount > 0) {
      // Get metadata from existing cache
      const metadata = cachedData.metadata || {};
      
      // Update cache with filtered vouchers
      await hybridCache.setCompleteSalesData(
        companyInfo,
        { vouchers: filteredVouchers },
        {
          ...metadata,
          email: email || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null) || 'unknown'
        }
      );
      
      console.log(`✅ Cache updated: Removed ${removedCount} vouchers with deleted master IDs`);
    } else {
      console.log(`ℹ️ No matching vouchers found to remove (checked ${deletedMasterIds.length} deleted IDs)`);
    }

    return { removed: removedCount, remaining: remainingCount };
  } catch (error) {
    console.error('❌ Error removing vouchers by master ID:', error);
    // Don't throw - gracefully handle errors so update doesn't fail
    return { removed: 0, remaining: 0, error: error.message };
  }
};

/**
 * Deduplicates vouchers by mstid, keeping only the voucher with the highest alterid for each mstid.
 * Vouchers without both mstid and alterid are preserved as-is.
 * @param {Array} vouchers - Array of voucher objects
 * @returns {Array} Deduplicated array of vouchers
 */
const deduplicateVouchersByMstid = (vouchers) => {
  if (!vouchers || !Array.isArray(vouchers)) {
    return vouchers || [];
  }

  // Separate vouchers with mstid+alterid from those without
  const vouchersWithMstid = [];
  const vouchersWithoutMstid = [];
  const mstidGroups = new Map(); // Map<mstid, {vouchers: Array, maxAlterId: number, bestVoucher: object}>

  vouchers.forEach(voucher => {
    const mstid = voucher.mstid || voucher.MSTID || voucher.masterid || voucher.MASTERID;
    const alterid = voucher.alterid || voucher.ALTERID;

    // If voucher has both mstid and alterid, group by mstid
    if (mstid !== null && mstid !== undefined && alterid !== null && alterid !== undefined) {
      const mstidKey = String(mstid);
      const alteridNum = typeof alterid === 'string' ? parseInt(alterid, 10) : alterid;

      if (!isNaN(alteridNum)) {
        if (!mstidGroups.has(mstidKey)) {
          mstidGroups.set(mstidKey, {
            vouchers: [],
            maxAlterId: alteridNum,
            bestVoucher: voucher
          });
        }

        const group = mstidGroups.get(mstidKey);
        group.vouchers.push(voucher);

        // Update best voucher if this one has a higher alterid
        if (alteridNum > group.maxAlterId) {
          group.maxAlterId = alteridNum;
          group.bestVoucher = voucher;
        }
      } else {
        // Invalid alterid, treat as voucher without mstid
        vouchersWithoutMstid.push(voucher);
      }
    } else {
      // Voucher doesn't have both mstid and alterid, preserve as-is
      vouchersWithoutMstid.push(voucher);
    }
  });

  // Build result: one voucher per mstid (the one with highest alterid) + all vouchers without mstid
  const deduplicated = [];
  let duplicatesRemoved = 0;

  mstidGroups.forEach((group, mstid) => {
    deduplicated.push(group.bestVoucher);
    if (group.vouchers.length > 1) {
      duplicatesRemoved += group.vouchers.length - 1;
    }
  });

  // Add vouchers without mstid/alterid
  deduplicated.push(...vouchersWithoutMstid);

  if (duplicatesRemoved > 0) {
    console.log(`🔄 Deduplicated vouchers by mstid: Removed ${duplicatesRemoved} duplicate(s) across ${mstidGroups.size} unique mstid(s). Original: ${vouchers.length}, Deduplicated: ${deduplicated.length}`);
  }

  return deduplicated;
};

/**
 * Merges new vouchers with existing vouchers from cache and saves to cache incrementally.
 * This function performs deduplication, replaces vouchers with higher alterid, and saves the result.
 * @param {Array} existingVouchers - Existing vouchers from cache
 * @param {Array} newVouchers - New vouchers from API response
 * @param {Object} companyInfo - Company information object
 * @param {string} email - User email
 * @param {string} booksfrom - Books from date
 * @returns {Promise<{mergedVouchers: Array, maxAlterId: number}>} Merged vouchers and calculated max alterid
 */
const mergeAndSaveVouchers = async (existingVouchers, newVouchers, companyInfo, email, booksfrom) => {
  console.log(`🔄 Starting incremental merge: ${existingVouchers.length} existing + ${newVouchers.length} new vouchers`);

  // If no existing vouchers, just use new vouchers
  if (!existingVouchers || existingVouchers.length === 0) {
    console.log(`📊 No existing vouchers, using ${newVouchers.length} new vouchers only`);
    
    // Deduplicate new vouchers by mstid
    const deduplicated = deduplicateVouchersByMstid(newVouchers);
    const mergedData = { vouchers: deduplicated };
    const maxAlterId = calculateMaxAlterId(mergedData);
    
    // Save to cache
    const metadata = {
      booksfrom: booksfrom || null,
      lastaltid: maxAlterId
    };
    
    await hybridCache.setCompleteSalesData(companyInfo, mergedData, { ...metadata, email });
    console.log(`✅ Saved ${deduplicated.length} vouchers to cache, maxAlterId=${maxAlterId}`);
    
    return { mergedVouchers: deduplicated, maxAlterId };
  }

  // Build a map of existing vouchers by masterid for quick lookup and replacement
  // Store ALL vouchers with same masterid to check against, but keep track of highest alterid
  const existingVouchersByMstid = new Map(); // Map<masterid, { voucher: object, alterid: number }>
  const existingIds = new Set(); // For exact ID matching (mstid_alterid)
  
  // First pass: Build map keeping voucher with highest alterid for each masterid
  // This ensures we have the best existing voucher to compare against
  existingVouchers.forEach(v => {
    const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
    const alterid = v.alterid || v.ALTERID;
    const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
    const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
    const amount = v.amount || v.AMT || v.amt;

    // Store by masterid for replacement logic
    if (mstid !== null && mstid !== undefined) {
      const mstidKey = String(mstid);
      const alteridNum = alterid !== null && alterid !== undefined 
        ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
        : null;
      
      if (!isNaN(alteridNum)) {
        if (!existingVouchersByMstid.has(mstidKey)) {
          existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
        } else {
          const existing = existingVouchersByMstid.get(mstidKey);
          // Keep the voucher with the highest alterid for this masterid
          if (alteridNum > existing.alterid) {
            existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
          }
        }
      } else if (!existingVouchersByMstid.has(mstidKey)) {
        existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: null });
      }
    }

    // Also create exact ID set for duplicate detection
    if (mstid && alterid) {
      existingIds.add(`${mstid}_${alterid}`);
      existingIds.add(`${String(mstid)}_${String(alterid)}`);
    }
    if (vchno && date) {
      existingIds.add(`${vchno}_${date}`);
      existingIds.add(`${String(vchno)}_${String(date)}`);
    }
    if (vchno && date && amount) {
      existingIds.add(JSON.stringify({ vchno: String(vchno), date: String(date), amount: String(amount) }));
    }
  });

  // Log summary of existing vouchers by masterid
  console.log(`📊 Cache contains ${existingVouchersByMstid.size} unique masterids (from ${existingVouchers.length} total vouchers)`);

  // Process new vouchers: replace existing ones with same masterid if alterid is higher
  const vouchersToKeep = new Map(); // Map<masterid, voucher> - final vouchers to keep
  const vouchersWithoutMstid = [];
  let replacedCount = 0;
  let newCount = 0;
  let skippedCount = 0;
  const apiVoucherIds = new Set();

  // Start with existing vouchers (these will be replaced if response has higher alterid)
  existingVouchersByMstid.forEach((entry, mstidKey) => {
    vouchersToKeep.set(mstidKey, entry.voucher);
  });

  // Process new vouchers from API response
  newVouchers.forEach(v => {
    const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
    const alterid = v.alterid || v.ALTERID;
    const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
    const date = v.cp_date || v.DATE || v.date || v.CP_DATE;

    // Create exact ID for duplicate detection
    let exactVoucherId = null;
    if (mstid && alterid) {
      exactVoucherId = `${mstid}_${alterid}`;
    } else if (vchno && date) {
      exactVoucherId = `${vchno}_${date}`;
    }

    // Check if this is an exact duplicate (same masterid AND same alterid)
    if (exactVoucherId && existingIds.has(exactVoucherId)) {
      skippedCount++;
      return;
    }

    // Handle vouchers with masterid
    if (mstid !== null && mstid !== undefined) {
      const mstidKey = String(mstid);
      const alteridNum = alterid !== null && alterid !== undefined 
        ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
        : null;

      if (!isNaN(alteridNum)) {
        // Check if we have an existing voucher with this masterid in cache
        if (vouchersToKeep.has(mstidKey)) {
          const existing = existingVouchersByMstid.get(mstidKey);
          if (existing && existing.alterid !== null && existing.alterid !== undefined) {
            // Ensure both are numbers for comparison
            const existingAlterIdNum = typeof existing.alterid === 'string' ? parseInt(existing.alterid, 10) : existing.alterid;
            const newAlterIdNum = typeof alteridNum === 'string' ? parseInt(alteridNum, 10) : alteridNum;
            
            if (!isNaN(existingAlterIdNum) && !isNaN(newAlterIdNum)) {
              if (newAlterIdNum > existingAlterIdNum) {
                // Response alterid is higher than cache alterid - REPLACE the voucher
                vouchersToKeep.set(mstidKey, v);
                replacedCount++;
              } else if (newAlterIdNum === existingAlterIdNum) {
                // Same alterid, keep existing voucher (response is duplicate)
                skippedCount++;
              } else {
                // Response alterid is lower than cache alterid - KEEP existing voucher
                skippedCount++;
              }
            } else {
              // Invalid alterid values, replace with new one
              vouchersToKeep.set(mstidKey, v);
              replacedCount++;
            }
          } else {
            // Existing voucher has no alterid, replace with new one that has alterid
            vouchersToKeep.set(mstidKey, v);
            replacedCount++;
          }
        } else {
          // New masterid (not in cache), add it
          vouchersToKeep.set(mstidKey, v);
          newCount++;
        }
      } else {
        // Response voucher has masterid but invalid alterid
        if (!vouchersToKeep.has(mstidKey)) {
          vouchersToKeep.set(mstidKey, v);
          newCount++;
        } else {
          // Keep existing voucher since response has invalid alterid
          skippedCount++;
        }
      }
    } else {
      // Voucher without masterid - use exact ID matching
      if (!exactVoucherId) {
        const fallbackId = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
        if (!existingIds.has(fallbackId) && !apiVoucherIds.has(fallbackId)) {
          vouchersWithoutMstid.push(v);
          apiVoucherIds.add(fallbackId);
          newCount++;
        } else {
          skippedCount++;
        }
      } else if (!existingIds.has(exactVoucherId) && !apiVoucherIds.has(exactVoucherId)) {
        vouchersWithoutMstid.push(v);
        apiVoucherIds.add(exactVoucherId);
        newCount++;
      } else {
        skippedCount++;
      }
    }
  });

  // Combine all vouchers
  let mergedVouchers = [...vouchersToKeep.values(), ...vouchersWithoutMstid];

  console.log(`✅ Incremental merge complete: ${replacedCount} replaced, ${newCount} new, ${skippedCount} skipped from ${newVouchers.length} new vouchers`);
  console.log(`📊 Merge result: ${existingVouchers.length} existing -> ${mergedVouchers.length} total vouchers`);

  // Deduplicate vouchers by mstid to ensure only one voucher per masterid (with highest alterid)
  // This handles any remaining duplicates that might exist after the merge
  const beforeDedupCount = mergedVouchers.length;
  mergedVouchers = deduplicateVouchersByMstid(mergedVouchers);
  const afterDedupCount = mergedVouchers.length;
  if (beforeDedupCount !== afterDedupCount) {
    console.log(`🔄 Deduplication after merge: ${beforeDedupCount} -> ${afterDedupCount} vouchers (removed ${beforeDedupCount - afterDedupCount} duplicates)`);
  }

  // Calculate max alterid from merged data
  const mergedData = { vouchers: mergedVouchers };
  const maxAlterId = calculateMaxAlterId(mergedData);

  // Save to cache
  const metadata = {
    booksfrom: booksfrom || null,
    lastaltid: maxAlterId
  };

  console.log(`💾 Saving ${mergedVouchers.length} merged vouchers to cache (maxAlterId=${maxAlterId})...`);
  await hybridCache.setCompleteSalesData(companyInfo, mergedData, { ...metadata, email });
  console.log(`✅ Successfully saved ${mergedVouchers.length} vouchers to cache`);

  return { mergedVouchers, maxAlterId };
};

const fetchBooksFrom = async (selectedGuid) => {
  try {
    // Check sessionStorage first
    const booksfromDirect = sessionStorage.getItem('booksfrom');
    if (booksfromDirect) {
      return booksfromDirect;
    }

    // Check allConnections in sessionStorage
    const connectionsStr = sessionStorage.getItem('allConnections');
    const connections = JSON.parse(connectionsStr || '[]');
    
    if (selectedGuid && Array.isArray(connections)) {
      const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
      // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
      const company = connections.find(c => 
        c.guid === selectedGuid && 
        (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
      );
      if (company && company.booksfrom) {
        return company.booksfrom;
      }
    }

    // Fallback to API call
    const response = await apiGet(`/api/tally/user-connections?ts=${Date.now()}`);
    
    if (response) {
      let apiConnections = [];
      if (Array.isArray(response)) {
        apiConnections = response;
      } else if (response.createdByMe && response.sharedWithMe) {
        const created = Array.isArray(response.createdByMe) ? response.createdByMe : [];
        const shared = Array.isArray(response.sharedWithMe) ? response.sharedWithMe : [];
        apiConnections = [...created, ...shared];
      }
      
      const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
      // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
      const company = apiConnections.find(c => 
        c.guid === selectedGuid && 
        (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
      );
      if (company && company.booksfrom) {
        sessionStorage.setItem('booksfrom', company.booksfrom);
        return company.booksfrom;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error in fetchBooksFrom:', error);
    return null;
  }
};

// Get sync progress key for storing in cache
const getSyncProgressKey = (email, guid, tallyloc_id) => {
  return `sync_progress_${email}_${guid}_${tallyloc_id}`;
};

// Check if there's an interrupted download for a company
export const checkInterruptedDownload = async (companyInfo) => {
  if (!companyInfo) return null;

  // Don't show resume modal if sync is currently active for this company
  if (cacheSyncManager.isSyncInProgress() && cacheSyncManager.isSameCompany(companyInfo)) {
    return null;
  }

  const email = getUserEmail();
  if (!email) return null;

  const progressKey = getSyncProgressKey(email, companyInfo.guid, companyInfo.tallyloc_id);
  try {
    const progress = await hybridCache.getDashboardState(progressKey);
    if (progress && progress.status === 'in_progress') {
      // Check if it's been more than 5 minutes since last update (likely interrupted)
      const timeSinceUpdate = Date.now() - (progress.lastUpdated || 0);
      const fiveMinutes = 5 * 60 * 1000;
      
      // Only show resume if:
      // 1. More than 5 minutes since last update (likely interrupted), OR
      // 2. Not all chunks completed (incomplete download)
      if (timeSinceUpdate > fiveMinutes || (progress.chunksCompleted < progress.totalChunks && progress.totalChunks > 0)) {
        return {
          current: progress.chunksCompleted || 0,
          total: progress.totalChunks || 0,
          companyName: companyInfo.company,
          companyGuid: companyInfo.guid
        };
      }
    }
    return null;
  } catch (error) {
    console.warn('Error checking interrupted download:', error);
    return null;
  }
};

// Clear progress for a company (when user chooses to start fresh)
export const clearDownloadProgress = async (companyInfo) => {
  if (!companyInfo) return;

  const email = getUserEmail();
  if (!email) return;

  const progressKey = getSyncProgressKey(email, companyInfo.guid, companyInfo.tallyloc_id);
  try {
    // Check if deleteDashboardState exists, otherwise use IndexedDB directly
    if (hybridCache.deleteDashboardState) {
      await hybridCache.deleteDashboardState(progressKey);
    } else {
      // Fallback: try to delete via IndexedDB if method doesn't exist
      await hybridCache.init();
      await hybridCache.db.dashboardState.delete(progressKey);
    }
    console.log('✅ Cleared download progress for', companyInfo.company);
  } catch (error) {
    console.warn('Error clearing download progress:', error);
  }
};

// Get email from sessionStorage
const getUserEmail = () => {
  return sessionStorage.getItem('email');
};

// Internal sync function that does the actual work
const syncSalesDataInternal = async (companyInfo, email, onProgress = () => { }, startFresh = false) => {
  if (!companyInfo) {
    throw new Error('No company selected');
  }

  console.log('🚀 Starting syncSalesData for company:', {
    tallyloc_id: companyInfo.tallyloc_id,
    company: companyInfo.company,
    guid: companyInfo.guid,
    email,
    startFresh
  });

  const progressKey = getSyncProgressKey(email, companyInfo.guid, companyInfo.tallyloc_id);
  let savedProgress = null;

  try {
    // Clear progress if starting fresh
    if (startFresh) {
      console.log('🔄 Starting fresh - clearing existing progress');
      try {
        await hybridCache.deleteDashboardState(progressKey);
        console.log('✅ Cleared existing progress');
      } catch (e) {
        console.warn('Could not clear progress:', e);
      }
    } else {
      // Load saved progress if exists (only if not starting fresh)
    try {
      savedProgress = await hybridCache.getDashboardState(progressKey);
    } catch (e) {
      console.warn('Could not load saved progress:', e);
      }
    }

    // Update progress to in_progress
    try {
    await hybridCache.setDashboardState(progressKey, {
      email,
      companyGuid: companyInfo.guid,
      tallylocId: companyInfo.tallyloc_id,
      status: 'in_progress',
      lastUpdated: Date.now(),
      chunksCompleted: savedProgress?.chunksCompleted || 0,
      totalChunks: savedProgress?.totalChunks || 0
    });
    } catch (e) {
      console.warn('Could not save progress state:', e);
    }

    const booksfrom = await fetchBooksFrom(companyInfo.guid);
    
    if (!booksfrom) {
      throw new Error('Unable to fetch booksfrom date. Please ensure you have access to this company.');
    }

    // CRITICAL: Always check for existing cached data first to determine if this is an update
    let lastaltid = null;
    let isUpdate = false;

    console.log('🔍 Checking for existing cached data to determine update mode...');

    try {
      const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
      if (existingData && existingData.data && existingData.data.vouchers && Array.isArray(existingData.data.vouchers) && existingData.data.vouchers.length > 0) {
        console.log(`✅ Found ${existingData.data.vouchers.length} existing vouchers in cache`);
        isUpdate = true;

        // CRITICAL: Calculate lastaltid from actual vouchers in cache (most reliable method)
        lastaltid = calculateMaxAlterId(existingData.data);

        // Fallback to metadata if calculation fails
        if (!lastaltid && existingData.metadata?.lastaltid) {
          lastaltid = existingData.metadata.lastaltid;
          console.log(`⚠️ Using lastaltid from metadata as fallback: ${lastaltid}`);
        }

        console.log(`✅ Calculated largest alterid from cache: ${lastaltid}`);
      } else {
        console.log('✅ No existing data found - confirmed as fresh download');
        isUpdate = false;
      }
    } catch (error) {
      console.warn('⚠️ Could not check for existing data:', error);
      // Fallback to saved progress if cache check fails
      lastaltid = savedProgress?.lastSyncedAlterId || await hybridCache.getLastAlterId(companyInfo, email);
      isUpdate = !!lastaltid;
      if (isUpdate) {
        console.log(`⚠️ Fallback: Using lastaltid from saved progress/metadata: ${lastaltid}`);
      }
    }

    console.log(`🔍 Update detection result: lastaltid=${lastaltid}, isUpdate=${isUpdate}`);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayAPI = formatDateForAPI(todayStr);

    let booksFromFormatted = todayAPI;
    if (booksfrom) {
      booksFromFormatted = convertDateToYYYYMMDD(booksfrom) || formatDateForAPI(booksfrom);
    }

    const payload = {
      tallyloc_id: companyInfo.tallyloc_id,
      company: companyInfo.company,
      guid: companyInfo.guid,
      fromdate: booksFromFormatted,
      todate: todayAPI,
      serverslice: isUpdate ? "Yes" : "No",
      vouchertype: "$$isSales, $$IsCreditNote"
    };

    if (isUpdate && lastaltid) {
      payload.lastaltid = lastaltid;
      console.log(`📡 API Request Mode: UPDATE (lastaltid=${lastaltid}, serverslice=Yes)`);
    } else {
      console.log(`📡 API Request Mode: FRESH DOWNLOAD (serverslice=No)`);
    }

    onProgress({ current: 0, total: 1, message: isUpdate ? 'Checking for updates...' : 'Fetching data...' });

    const salesextractUrl = `${getApiUrl('/api/reports/salesextract')}?ts=${Date.now()}`;
    const token = sessionStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    let response;
    let needsSlice = false;
    // For updates, we'll use the new voucherextract_sync endpoint with looping
    // For downloads, use chunking
    const shouldUseChunking = !isUpdate;
    const useNewUpdateApi = isUpdate && lastaltid;

    if (!shouldUseChunking && !useNewUpdateApi) {
      try {
        const fetchResponse = await fetchWithTimeout(
          salesextractUrl,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
          300000, // 5 minutes timeout
          5 // Increased retries
        );

        const responseText = await fetchResponse.text();
        if (!responseText) throw new Error('Empty response from server');
        response = JSON.parse(responseText);
        
        if (response && response.frontendslice === 'Yes') {
          needsSlice = true;
        } else {
          needsSlice = response && (
            response.message === 'slice' ||
            response.message === 'Slice' ||
            response.message?.toLowerCase().includes('slice') ||
            (response.error && response.error.toLowerCase().includes('slice'))
          );
        }
      } catch (error) {
        if (error.message.includes('timeout') || error.message.includes('504') || error.message.includes('408') || error.message.includes('Failed after')) {
          needsSlice = true;
        } else {
          throw error;
        }
      }
    } else {
      needsSlice = true;
    }

    let allVouchers = [];
    let mergedData = { vouchers: [] };
    let chunks = null;

    // For updates, load existing data FIRST before processing chunks to ensure we preserve it
    let existingVouchersForMerge = [];
    if (isUpdate) {
      console.log(`🔄 Update mode detected (lastaltid=${lastaltid}), loading existing cache...`);
      try {
        const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
        if (existingData && existingData.data && existingData.data.vouchers && Array.isArray(existingData.data.vouchers) && existingData.data.vouchers.length > 0) {
          existingVouchersForMerge = existingData.data.vouchers;
          console.log(`✅ Pre-loaded ${existingVouchersForMerge.length} existing vouchers for update merge`);
          console.log(`📋 Sample existing voucher IDs:`, existingVouchersForMerge.slice(0, 3).map(v => ({
            mstid: v.mstid || v.MSTID || v.masterid || v.MASTERID,
            alterid: v.alterid || v.ALTERID,
            vchno: v.voucher_number || v.VCHNO || v.vchno || v.VCHNO
          })));
        } else {
          console.warn('⚠️ Update mode but no existing vouchers found in cache');
          console.warn('⚠️ existingData:', existingData ? (existingData.data ? 'data exists but no vouchers array' : 'no data property') : 'null/undefined');
        }
      } catch (error) {
        console.error('❌ Could not pre-load existing cache for update:', error);
        console.error('❌ Error details:', error.message);
        // Try one more time as fallback with delay
        try {
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          const retryData = await hybridCache.getCompleteSalesData(companyInfo, email);
          if (retryData && retryData.data && retryData.data.vouchers && Array.isArray(retryData.data.vouchers) && retryData.data.vouchers.length > 0) {
            existingVouchersForMerge = retryData.data.vouchers;
            console.log(`✅ Retry successful: Loaded ${existingVouchersForMerge.length} existing vouchers for update merge`);
          } else {
            console.error('❌ Retry also found no existing vouchers');
          }
        } catch (retryError) {
          console.error('❌ Retry also failed to load existing cache:', retryError);
          console.error('❌ Retry error details:', retryError.message);
        }
      }

      if (existingVouchersForMerge.length === 0) {
        console.warn(`⚠️ Update mode detected (lastaltid=${lastaltid}) but no existing vouchers found in cache.`);
        console.warn(`⚠️ This may happen if cache was cleared or corrupted. Proceeding as fresh download.`);
        console.warn(`⚠️ The API will still use lastaltid=${lastaltid} to fetch only new records.`);
        // Don't throw error - proceed as fresh download but still use lastaltid in API call
        // This allows recovery if cache was accidentally cleared
      }
    }

    // Special handling for update mode: use new API endpoint with looping
    if (isUpdate && lastaltid) {
      console.log(`🔄 Update mode: Using voucherextract_sync API with incremental cache updates`);
      
      const voucherextractSyncUrl = `${getApiUrl('/api/reports/voucherextract_sync')}?ts=${Date.now()}`;
      const token = sessionStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      let currentLastAltId = lastaltid;
      let loopIteration = 0;
      let totalVouchersFetched = 0;
      
      // Load current cache state at the start - this will be updated incrementally
      let currentCacheVouchers = existingVouchersForMerge.length > 0 ? existingVouchersForMerge : [];

      onProgress({
        current: 0,
        total: 1,
        message: `Updating ${companyInfo.company}: Fetching new vouchers...`,
        companyGuid: companyInfo.guid,
        companyName: companyInfo.company
      });

      // Loop until we get an empty vouchers array
      while (true) {
        loopIteration++;
        console.log(`🔄 Update loop iteration ${loopIteration}: Fetching vouchers with lastaltid=${currentLastAltId}`);

        // Create payload with new structure
        const syncPayload = {
          tallyloc_id: companyInfo.tallyloc_id,
          company: companyInfo.company,
          guid: companyInfo.guid,
          lastaltid: currentLastAltId,
          vouchertype: "$$isSales, $$IsCreditNote"
        };

        try {
          onProgress({
            current: loopIteration,
            total: loopIteration + 1, // Dynamic total that increases
            message: `Updating ${companyInfo.company}: Iteration ${loopIteration} (lastaltid=${currentLastAltId})...`,
            companyGuid: companyInfo.guid,
            companyName: companyInfo.company
          });

          const fetchResponse = await fetchWithTimeout(
            voucherextractSyncUrl,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(syncPayload),
            },
            300000, // 5 minutes timeout
            5 // 5 retries
          );

          const responseText = await fetchResponse.text();
          if (!responseText) {
            console.warn('⚠️ Empty response from voucherextract_sync API');
            break;
          }

          const syncResponse = JSON.parse(responseText);

          // Check if vouchers array is empty (termination condition)
          if (!syncResponse.vouchers || !Array.isArray(syncResponse.vouchers) || syncResponse.vouchers.length === 0) {
            console.log(`✅ Update loop complete: Received empty vouchers array after ${loopIteration} iteration(s)`);
            break;
          }

          const fetchedVouchers = syncResponse.vouchers;
          console.log(`📥 Iteration ${loopIteration}: Fetched ${fetchedVouchers.length} vouchers`);

          totalVouchersFetched += fetchedVouchers.length;

          // Merge and save to cache incrementally
          try {
            const { mergedVouchers, maxAlterId } = await mergeAndSaveVouchers(
              currentCacheVouchers,
              fetchedVouchers,
              companyInfo,
              email,
              booksfrom
            );

            // Update current cache vouchers for next iteration
            currentCacheVouchers = mergedVouchers;

            // Calculate max alterid from merged data (already returned from function)
            if (maxAlterId === null || maxAlterId === undefined) {
              console.warn(`⚠️ Could not calculate max alterid from merged data, stopping loop`);
              break;
            }

            // Update currentLastAltId for next iteration
            if (maxAlterId <= currentLastAltId) {
              console.warn(`⚠️ Max alterid (${maxAlterId}) is not greater than current (${currentLastAltId}), stopping loop`);
              break;
            }

            console.log(`📊 Updating lastaltid: ${currentLastAltId} -> ${maxAlterId}`);
            currentLastAltId = maxAlterId;

            // Update progress with current state
            onProgress({
              current: loopIteration,
              total: loopIteration + 1,
              message: `Updating ${companyInfo.company}: Iteration ${loopIteration} - ${totalVouchersFetched} vouchers fetched, ${mergedVouchers.length} total in cache (maxAlterId=${maxAlterId})`,
              companyGuid: companyInfo.guid,
              companyName: companyInfo.company
            });

          } catch (mergeError) {
            console.error(`❌ Error merging/saving in iteration ${loopIteration}:`, mergeError);
            // If this is the first iteration and we have no saved data, throw error
            if (loopIteration === 1 && currentCacheVouchers.length === 0) {
              throw new Error(`Failed to merge and save vouchers in update mode: ${mergeError.message}`);
            } else {
              // For subsequent iterations, log warning but continue (data from previous iterations is saved)
              console.warn(`⚠️ Merge failed but continuing (previous iterations saved successfully)`);
              // Still try to update lastaltid from response to continue loop
              const maxAlterIdFromResponse = calculateMaxAlterId(syncResponse);
              if (maxAlterIdFromResponse && maxAlterIdFromResponse > currentLastAltId) {
                currentLastAltId = maxAlterIdFromResponse;
              } else {
                break;
              }
            }
          }

        } catch (error) {
          console.error(`❌ Error in update loop iteration ${loopIteration}:`, error);
          // If this is the first iteration, throw error (no data saved yet)
          if (loopIteration === 1) {
            throw new Error(`Failed to fetch vouchers in update mode: ${error.message}`);
          } else {
            // For subsequent iterations, break loop (data from previous iterations is saved)
            console.warn(`⚠️ Error occurred but data from previous ${loopIteration - 1} iteration(s) was saved successfully`);
            break;
          }
        }
      }

      console.log(`✅ Update loop completed: ${loopIteration} iteration(s), ${totalVouchersFetched} total vouchers fetched`);
      
      // Set mergedData to the final state from cache (already merged and saved incrementally)
      mergedData = { vouchers: currentCacheVouchers };

      // After update completes, check for deleted vouchers and remove them from cache
      try {
        console.log('🔍 Checking for deleted vouchers...');
        const deletedVouchersEndpoint = `/api/reports/deletedvouchers?ts=${Date.now()}`;
        const deletedVouchersPayload = {
          tallyloc_id: companyInfo.tallyloc_id,
          company: companyInfo.company,
          guid: companyInfo.guid
        };

        const deletedVouchersResponse = await apiPost(deletedVouchersEndpoint, deletedVouchersPayload);
        
        if (deletedVouchersResponse && deletedVouchersResponse.deletedVoucherIds && Array.isArray(deletedVouchersResponse.deletedVoucherIds) && deletedVouchersResponse.deletedVoucherIds.length > 0) {
          console.log(`🗑️ Found ${deletedVouchersResponse.deletedVoucherIds.length} deleted voucher IDs to remove from cache`);
          const cleanupResult = await removeVouchersByMasterId(
            companyInfo,
            deletedVouchersResponse.deletedVoucherIds,
            email
          );
          
          if (cleanupResult.removed > 0) {
            console.log(`✅ Successfully removed ${cleanupResult.removed} vouchers from cache`);
            // Reload mergedData from cache after cleanup to reflect the changes
            const updatedCache = await hybridCache.getCompleteSalesData(companyInfo, email);
            if (updatedCache && updatedCache.data && updatedCache.data.vouchers) {
              mergedData = { vouchers: updatedCache.data.vouchers };
              console.log(`📋 Cache updated: ${mergedData.vouchers.length} vouchers remaining after cleanup`);
            }
          } else {
            console.log(`ℹ️ No matching vouchers found to remove (checked ${deletedVouchersResponse.deletedVoucherIds.length} deleted IDs)`);
          }
        } else {
          console.log('ℹ️ No deleted vouchers found or empty response from deletedvouchers API');
        }
      } catch (error) {
        // Log error but don't fail the update - deleted vouchers cleanup is not critical
        console.warn('⚠️ Error checking for deleted vouchers (non-critical, update continues):', error.message);
      }

      // Mark that we've processed update data, so we skip the chunking logic below
      needsSlice = false;
    }

    // Skip chunking if we've already processed update data via new API
    if ((needsSlice || shouldUseChunking) && !useNewUpdateApi) {
      let startDateForChunks = todayStr;
      if (booksfrom) {
        const booksfromYYYYMMDD = convertDateToYYYYMMDD(booksfrom);
        if (booksfromYYYYMMDD && booksfromYYYYMMDD.length === 8) {
          startDateForChunks = `${booksfromYYYYMMDD.slice(0, 4)}-${booksfromYYYYMMDD.slice(4, 6)}-${booksfromYYYYMMDD.slice(6, 8)}`;
        }
      }
      chunks = splitDateRange(startDateForChunks, todayStr);

      // Resume from saved chunk if available
      const startChunkIndex = savedProgress?.chunksCompleted || 0;

      onProgress({ 
        current: startChunkIndex, 
        total: chunks.length, 
        message: `Syncing ${companyInfo.company}: Resuming from chunk ${startChunkIndex + 1} of ${chunks.length}...`,
        companyGuid: companyInfo.guid,
        companyName: companyInfo.company
      });

      // Update total chunks in progress
      try {
      await hybridCache.setDashboardState(progressKey, {
        email,
        companyGuid: companyInfo.guid,
        tallylocId: companyInfo.tallyloc_id,
        status: 'in_progress',
        lastUpdated: Date.now(),
        chunksCompleted: startChunkIndex,
        totalChunks: chunks.length
      });
      } catch (e) {
        console.warn('Could not save progress state:', e);
      }

      for (let i = startChunkIndex; i < chunks.length; i++) {
        const chunk = chunks[i];
        onProgress({
          current: i + 1,
          total: chunks.length,
          message: `Syncing ${companyInfo.company}: ${i + 1} / ${chunks.length} chunks`,
          companyGuid: companyInfo.guid,
          companyName: companyInfo.company
        });

        const chunkPayload = {
          ...payload,
          fromdate: formatDateForAPI(chunk.start),
          todate: formatDateForAPI(chunk.end),
          serverslice: "No"
        };

        try {
          const chunkFetchResponse = await fetchWithTimeout(
            salesextractUrl,
            {
              method: 'POST',
              headers,
              body: JSON.stringify(chunkPayload),
            },
            300000, // 5 minutes timeout for large chunks
            10 // Increased retries to 10 for better resilience
          );

          const chunkResponseText = await chunkFetchResponse.text();
          if (chunkResponseText) {
            const chunkResponse = JSON.parse(chunkResponseText);
            if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
              allVouchers.push(...chunkResponse.vouchers);
            }
          }

          // Update progress after each chunk
          try {
          const chunkProgress = {
            email,
            companyGuid: companyInfo.guid,
            tallylocId: companyInfo.tallyloc_id,
            status: 'in_progress',
            lastUpdated: Date.now(),
            chunksCompleted: i + 1,
            totalChunks: chunks.length
          };
          await hybridCache.setDashboardState(progressKey, chunkProgress);
          console.log(`📊 Progress updated: ${i + 1}/${chunks.length} chunks for ${companyInfo.company}`);
          } catch (e) {
            console.warn('Could not save chunk progress:', e);
          }
          
          // Notify subscribers if this is the currently active sync
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: chunks.length,
              message: `Syncing ${companyInfo.company}: ${i + 1} / ${chunks.length} chunks`,
              companyGuid: companyInfo.guid,
              companyName: companyInfo.company
            });
          }
        } catch (chunkError) {
          // Check if this is a 500 error or CORS error - stop download immediately
          const is500Error = chunkError.message.includes('HTTP 500') || 
                            chunkError.message.includes('500') ||
                            chunkError.message.includes('Internal Server Error');
          
          const isCorsError = chunkError.message.includes('CORS') || 
                            chunkError.message.includes('cors') ||
                            chunkError.message.includes('Access-Control') ||
                            (chunkError.name === 'TypeError' && chunkError.message.includes('Failed to fetch'));
          
          if (is500Error || isCorsError) {
            console.error(`❌ Critical error fetching chunk ${i + 1}/${chunks.length} for ${companyInfo.company}:`, chunkError);
            
            // Stop the download and throw error to be caught by caller
            const errorType = is500Error ? '500 Internal Server Error' : 'CORS Error';
            throw new Error(
              `Download stopped due to ${errorType} at chunk ${i + 1}/${chunks.length} for ${companyInfo.company}. ` +
              `Please retry the download. Error: ${chunkError.message}`
            );
          }
          
          // Log error but continue with next chunk instead of stopping for other errors
          console.error(`❌ Error fetching chunk ${i + 1}/${chunks.length} for ${companyInfo.company}:`, chunkError);
          
          // Get current saved progress to track failed chunks
          // DISABLED: Dashboard cache storage disabled
          // let currentSavedProgress = null;
          // try {
          //   currentSavedProgress = await hybridCache.getDashboardState(progressKey);
          // } catch (e) {
          //   // Ignore errors getting saved progress
          // }
          
          // Save error state but don't mark as completely failed
          // DISABLED: Dashboard cache storage disabled
          // await hybridCache.setDashboardState(progressKey, {
          //   email,
          //   companyGuid: companyInfo.guid,
          //   tallylocId: companyInfo.tallyloc_id,
          //   status: 'in_progress',
          //   lastUpdated: Date.now(),
          //   chunksCompleted: i,
          //   totalChunks: chunks.length,
          //   error: `Chunk ${i + 1} failed: ${chunkError.message}`,
          //   failedChunks: [...(currentSavedProgress?.failedChunks || []), i]
          // });
          
          // Continue with next chunk instead of throwing - allow download to complete
          // We'll retry failed chunks at the end if needed
          console.warn(`⚠️ Continuing with next chunk despite error in chunk ${i + 1}`);
          
          // Update progress to show we're continuing
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: chunks.length,
              message: `Syncing ${companyInfo.company}: ${i + 1} / ${chunks.length} chunks (chunk ${i + 1} failed, continuing...)`,
              companyGuid: companyInfo.guid,
              companyName: companyInfo.company
            });
          }
          
          // Continue to next chunk instead of throwing
          continue;
        }
      }
      
      // After processing all chunks, retry any failed chunks
      let currentSavedProgress = null;
      try {
        currentSavedProgress = await hybridCache.getDashboardState(progressKey);
      } catch (e) {
        // Ignore errors
      }
      
      const failedChunks = currentSavedProgress?.failedChunks || [];
      if (failedChunks.length > 0) {
        console.log(`🔄 Retrying ${failedChunks.length} failed chunks...`);
        
        for (const failedChunkIndex of failedChunks) {
          if (failedChunkIndex >= chunks.length) continue;
          
          const chunk = chunks[failedChunkIndex];
          const chunkPayload = {
            ...payload,
            fromdate: formatDateForAPI(chunk.start),
            todate: formatDateForAPI(chunk.end),
            serverslice: "No"
          };

          try {
            console.log(`🔄 Retrying chunk ${failedChunkIndex + 1}/${chunks.length}...`);
            
            const chunkFetchResponse = await fetchWithTimeout(
              salesextractUrl,
              {
                method: 'POST',
                headers,
                body: JSON.stringify(chunkPayload),
              },
              300000, // 5 minutes timeout
              5 // 5 retries for failed chunks
            );

            const chunkResponseText = await chunkFetchResponse.text();
            if (chunkResponseText) {
              const chunkResponse = JSON.parse(chunkResponseText);
              if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
                allVouchers.push(...chunkResponse.vouchers);
                console.log(`✅ Successfully retried chunk ${failedChunkIndex + 1}`);
              }
            }
            
            // Update progress to remove from failed chunks
            if (onProgress) {
              onProgress({
                current: chunks.length,
                total: chunks.length,
                message: `Syncing ${companyInfo.company}: Retrying failed chunks... (${failedChunks.length - (failedChunks.indexOf(failedChunkIndex) + 1)} remaining)`,
                companyGuid: companyInfo.guid,
                companyName: companyInfo.company
              });
            }
          } catch (retryError) {
            console.error(`❌ Retry failed for chunk ${failedChunkIndex + 1}:`, retryError);
            
            // Check if this is a 500 error or CORS error - stop download immediately
            const is500Error = retryError.message.includes('HTTP 500') || 
                              retryError.message.includes('500') ||
                              retryError.message.includes('Internal Server Error');
            
            const isCorsError = retryError.message.includes('CORS') || 
                               retryError.message.includes('cors') ||
                               retryError.message.includes('Access-Control') ||
                               (retryError.name === 'TypeError' && retryError.message.includes('Failed to fetch'));
            
            if (is500Error || isCorsError) {
              // Stop the download and throw error to be caught by caller
              const errorType = is500Error ? '500 Internal Server Error' : 'CORS Error';
              throw new Error(
                `Download stopped due to ${errorType} while retrying chunk ${failedChunkIndex + 1} for ${companyInfo.company}. ` +
                `Please retry the download. Error: ${retryError.message}`
              );
            }
            
            // Continue with next failed chunk even if retry fails for other errors
          }
        }
      }
      
      // If this is an update, ALWAYS merge with existing cache data to preserve old data
      if (isUpdate) {
        console.log(`🔄 Chunked path: Processing update merge with ${allVouchers.length} vouchers from chunks`);

        // Use pre-loaded existing vouchers, or try to load them again if pre-load failed
        let existingVouchers = existingVouchersForMerge;
        if (existingVouchers.length === 0) {
          console.warn('⚠️ Pre-loaded existing vouchers is empty in chunked path, attempting to load from cache...');
          try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
            if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
              existingVouchers = existingData.data.vouchers;
              console.log(`📊 Loaded ${existingVouchers.length} existing vouchers for merge (fallback, chunked)`);
            } else {
              console.warn('⚠️ No existing vouchers found in cache during fallback load (chunked)');
            }
          } catch (error) {
            console.error('❌ Could not load existing cache for merge (chunked):', error);
          }
        }
        
        if (existingVouchers.length > 0) {
          console.log(`🔄 Starting merge: ${existingVouchers.length} existing vouchers + ${allVouchers.length} chunk vouchers`);

          // Always preserve existing vouchers - this is critical to prevent data loss
          // If we have new vouchers, merge them; otherwise just keep ALL existing
          if (allVouchers.length > 0) {
            // Build a map of existing vouchers by masterid for quick lookup and replacement
            // Map<masterid, {voucher, alterid}>
            const existingVouchersByMstid = new Map();
            const existingIds = new Set(); // For exact ID matching (mstid_alterid)
            
            existingVouchers.forEach(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
              const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
              const amount = v.amount || v.AMT || v.amt;

              // Store by masterid for replacement logic
              if (mstid !== null && mstid !== undefined) {
                const mstidKey = String(mstid);
                const alteridNum = alterid !== null && alterid !== undefined 
                  ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
                  : null;
                
                if (!isNaN(alteridNum)) {
                  // If we already have a voucher with this masterid, keep the one with higher alterid
                  if (!existingVouchersByMstid.has(mstidKey)) {
                    existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
                  } else {
                    const existing = existingVouchersByMstid.get(mstidKey);
                    if (alteridNum > existing.alterid) {
                      existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
                    }
                  }
                } else if (!existingVouchersByMstid.has(mstidKey)) {
                  // No alterid, but still store by masterid
                  existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: null });
                }
              }

              // Also create exact ID set for duplicate detection
              if (mstid && alterid) {
                existingIds.add(`${mstid}_${alterid}`);
                existingIds.add(`${String(mstid)}_${String(alterid)}`);
              }
              if (vchno && date) {
                existingIds.add(`${vchno}_${date}`);
                existingIds.add(`${String(vchno)}_${String(date)}`);
              }
              if (vchno && date && amount) {
                existingIds.add(JSON.stringify({ vchno: String(vchno), date: String(date), amount: String(amount) }));
              }
            });

            // Process new vouchers: replace existing ones with same masterid if alterid is higher
            const vouchersToKeep = new Map(); // Map<masterid, voucher> - will contain final vouchers
            const vouchersWithoutMstid = []; // Vouchers without masterid
            let replacedCount = 0;
            let newCount = 0;
            const apiVoucherIds = new Set(); // Track what we've seen from API

            // Start with existing vouchers
            existingVouchersByMstid.forEach((entry, mstidKey) => {
              vouchersToKeep.set(mstidKey, entry.voucher);
            });

            // Process new vouchers from API
            allVouchers.forEach(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
              const date = v.cp_date || v.DATE || v.date || v.CP_DATE;

              // Create exact ID for duplicate detection
              let exactVoucherId = null;
              if (mstid && alterid) {
                exactVoucherId = `${mstid}_${alterid}`;
              } else if (vchno && date) {
                exactVoucherId = `${vchno}_${date}`;
              }

              // Check if this is an exact duplicate (same mstid and alterid)
              if (exactVoucherId && existingIds.has(exactVoucherId)) {
                // Exact duplicate, skip it
                return;
              }

              // Handle vouchers with masterid
              if (mstid !== null && mstid !== undefined) {
                const mstidKey = String(mstid);
                const alteridNum = alterid !== null && alterid !== undefined 
                  ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
                  : null;

                if (!isNaN(alteridNum)) {
                  // Check if we have an existing voucher with this masterid
                  if (vouchersToKeep.has(mstidKey)) {
                    const existing = existingVouchersByMstid.get(mstidKey);
                    if (existing && existing.alterid !== null && alteridNum > existing.alterid) {
                      // Replace existing voucher with new one (higher alterid)
                      vouchersToKeep.set(mstidKey, v);
                      replacedCount++;
                      console.log(`🔄 Replacing voucher with masterid ${mstidKey}: alterid ${existing.alterid} -> ${alteridNum}`);
                    }
                    // If alterid is lower or equal, keep the existing one (skip this new voucher)
                  } else {
                    // New masterid, add it
                    vouchersToKeep.set(mstidKey, v);
                    newCount++;
                  }
                } else {
                  // Has masterid but no valid alterid
                  if (!vouchersToKeep.has(mstidKey)) {
                    vouchersToKeep.set(mstidKey, v);
                    newCount++;
                  }
                }
              } else {
                // Voucher without masterid - use exact ID matching
                if (!exactVoucherId) {
                  // Can't identify, use fallback
                  const fallbackId = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
                  if (!existingIds.has(fallbackId) && !apiVoucherIds.has(fallbackId)) {
                    vouchersWithoutMstid.push(v);
                    apiVoucherIds.add(fallbackId);
                    newCount++;
                  }
                } else if (!existingIds.has(exactVoucherId) && !apiVoucherIds.has(exactVoucherId)) {
                  vouchersWithoutMstid.push(v);
                  apiVoucherIds.add(exactVoucherId);
                  newCount++;
                }
              }
            });

            // Combine all vouchers: those with masterid (from map) + those without masterid
            allVouchers = [...vouchersToKeep.values(), ...vouchersWithoutMstid];

            console.log(`✅ Merge complete: ${replacedCount} replaced, ${newCount} new vouchers from ${allVouchers.length} chunk vouchers`);
            console.log(`📊 Final merge: ${existingVouchers.length} existing -> ${allVouchers.length} total vouchers (${replacedCount} replaced, ${newCount} new)`);
          } else {
            // No new vouchers from chunks, but preserve ALL existing data
            console.log(`📊 No new vouchers from chunks, preserving ALL ${existingVouchers.length} existing vouchers`);
            allVouchers = existingVouchers;
          }

          // Deduplicate vouchers by mstid (keep highest alterid for each mstid)
          // This is a safety net in case the merge logic missed something
          allVouchers = deduplicateVouchersByMstid(allVouchers);

          mergedData = { vouchers: allVouchers };

          // Final validation log
          console.log(`✅ Merge validation: ${mergedData.vouchers.length} vouchers in merged data`);
        } else {
          // No existing data found - this shouldn't happen in normal update flow
          // But if it does, use new vouchers (better than losing them)
          console.warn('⚠️ Update mode but no existing data found (chunked), using new vouchers only');
          console.warn(`⚠️ If this is not a first-time download, existing cache may have been lost!`);
          // Deduplicate vouchers by mstid before using
          allVouchers = deduplicateVouchersByMstid(allVouchers);
          mergedData = { vouchers: allVouchers };
        }
      } else {
        // Not an update, use new vouchers as-is (but still deduplicate)
        allVouchers = deduplicateVouchersByMstid(allVouchers);
        mergedData = { vouchers: allVouchers };
      }
    } else {
      if (response && response.vouchers && Array.isArray(response.vouchers)) {
        allVouchers = response.vouchers;
        console.log(`📥 API returned ${allVouchers.length} vouchers (non-chunked path)`);
        
        // If this is an update, ALWAYS merge with existing cache data to preserve old data
        if (isUpdate) {
          // Use pre-loaded existing vouchers, or try to load them again if pre-load failed
          let existingVouchers = existingVouchersForMerge;
          if (existingVouchers.length === 0) {
            console.warn('⚠️ Pre-loaded existing vouchers is empty, attempting to load from cache...');
            try {
              const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
              if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
                existingVouchers = existingData.data.vouchers;
                console.log(`📊 Loaded ${existingVouchers.length} existing vouchers for merge (fallback, non-chunked)`);
              } else {
                console.warn('⚠️ No existing vouchers found in cache during fallback load');
              }
            } catch (error) {
              console.error('❌ Could not load existing cache for merge (non-chunked):', error);
            }
          }
          
          if (existingVouchers.length > 0) {
            console.log(`🔄 Starting merge: ${existingVouchers.length} existing vouchers + ${allVouchers.length} API vouchers`);

            // Always preserve existing vouchers - this is critical to prevent data loss
            // If we have new vouchers, merge them; otherwise just keep ALL existing
            if (allVouchers.length > 0) {
              // Build a map of existing vouchers by masterid for quick lookup and replacement
              // Map<masterid, {voucher, alterid}>
              const existingVouchersByMstid = new Map();
              const existingIds = new Set(); // For exact ID matching (mstid_alterid)
              
              existingVouchers.forEach(v => {
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
                const amount = v.amount || v.AMT || v.amt;

                // Store by masterid for replacement logic
                if (mstid !== null && mstid !== undefined) {
                  const mstidKey = String(mstid);
                  const alteridNum = alterid !== null && alterid !== undefined 
                    ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
                    : null;
                  
                  if (!isNaN(alteridNum)) {
                    // If we already have a voucher with this masterid, keep the one with higher alterid
                    if (!existingVouchersByMstid.has(mstidKey)) {
                      existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
                    } else {
                      const existing = existingVouchersByMstid.get(mstidKey);
                      if (alteridNum > existing.alterid) {
                        existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: alteridNum });
                      }
                    }
                  } else if (!existingVouchersByMstid.has(mstidKey)) {
                    // No alterid, but still store by masterid
                    existingVouchersByMstid.set(mstidKey, { voucher: v, alterid: null });
                  }
                }

                // Also create exact ID set for duplicate detection
                if (mstid && alterid) {
                  existingIds.add(`${mstid}_${alterid}`);
                  existingIds.add(`${String(mstid)}_${String(alterid)}`);
                }
                if (vchno && date) {
                  existingIds.add(`${vchno}_${date}`);
                  existingIds.add(`${String(vchno)}_${String(date)}`);
                }
                if (vchno && date && amount) {
                  existingIds.add(JSON.stringify({ vchno: String(vchno), date: String(date), amount: String(amount) }));
                }
              });

              // Process new vouchers: replace existing ones with same masterid if alterid is higher
              const vouchersToKeep = new Map(); // Map<masterid, voucher> - will contain final vouchers
              const vouchersWithoutMstid = []; // Vouchers without masterid
              let replacedCount = 0;
              let newCount = 0;
              const apiVoucherIds = new Set(); // Track what we've seen from API

              // Start with existing vouchers
              existingVouchersByMstid.forEach((entry, mstidKey) => {
                vouchersToKeep.set(mstidKey, entry.voucher);
              });

              // Process new vouchers from API
              allVouchers.forEach(v => {
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.vouchernumber || v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;

                // Create exact ID for duplicate detection
                let exactVoucherId = null;
                if (mstid && alterid) {
                  exactVoucherId = `${mstid}_${alterid}`;
                } else if (vchno && date) {
                  exactVoucherId = `${vchno}_${date}`;
                }

                // Check if this is an exact duplicate (same mstid and alterid)
                if (exactVoucherId && existingIds.has(exactVoucherId)) {
                  // Exact duplicate, skip it
                  return;
                }

                // Handle vouchers with masterid
                if (mstid !== null && mstid !== undefined) {
                  const mstidKey = String(mstid);
                  const alteridNum = alterid !== null && alterid !== undefined 
                    ? (typeof alterid === 'string' ? parseInt(alterid, 10) : alterid)
                    : null;

                  if (!isNaN(alteridNum)) {
                    // Check if we have an existing voucher with this masterid
                    if (vouchersToKeep.has(mstidKey)) {
                      const existing = existingVouchersByMstid.get(mstidKey);
                      if (existing && existing.alterid !== null && alteridNum > existing.alterid) {
                        // Replace existing voucher with new one (higher alterid)
                        vouchersToKeep.set(mstidKey, v);
                        replacedCount++;
                        console.log(`🔄 Replacing voucher with masterid ${mstidKey}: alterid ${existing.alterid} -> ${alteridNum}`);
                      }
                      // If alterid is lower or equal, keep the existing one (skip this new voucher)
                    } else {
                      // New masterid, add it
                      vouchersToKeep.set(mstidKey, v);
                      newCount++;
                    }
                  } else {
                    // Has masterid but no valid alterid
                    if (!vouchersToKeep.has(mstidKey)) {
                      vouchersToKeep.set(mstidKey, v);
                      newCount++;
                    }
                  }
                } else {
                  // Voucher without masterid - use exact ID matching
                  if (!exactVoucherId) {
                    // Can't identify, use fallback
                    const fallbackId = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
                    if (!existingIds.has(fallbackId) && !apiVoucherIds.has(fallbackId)) {
                      vouchersWithoutMstid.push(v);
                      apiVoucherIds.add(fallbackId);
                      newCount++;
                    }
                  } else if (!existingIds.has(exactVoucherId) && !apiVoucherIds.has(exactVoucherId)) {
                    vouchersWithoutMstid.push(v);
                    apiVoucherIds.add(exactVoucherId);
                    newCount++;
                  }
                }
              });

              // Combine all vouchers: those with masterid (from map) + those without masterid
              allVouchers = [...vouchersToKeep.values(), ...vouchersWithoutMstid];

              console.log(`✅ Merge complete: ${replacedCount} replaced, ${newCount} new vouchers from ${allVouchers.length} API vouchers`);
              console.log(`📊 Final merge: ${existingVouchers.length} existing -> ${allVouchers.length} total vouchers (${replacedCount} replaced, ${newCount} new)`);
            } else {
              // No new vouchers from API, but preserve ALL existing data
              console.log(`📊 No new vouchers from API, preserving ALL ${existingVouchers.length} existing vouchers`);
              allVouchers = existingVouchers;
            }

            // Deduplicate vouchers by mstid (keep highest alterid for each mstid)
            // This is a safety net in case the merge logic missed something
            allVouchers = deduplicateVouchersByMstid(allVouchers);

            mergedData = { vouchers: allVouchers };

            // Final validation log
            console.log(`✅ Merge validation: ${mergedData.vouchers.length} vouchers in merged data`);
          } else {
            // No existing data found - this shouldn't happen in normal update flow
            console.warn('⚠️ Update mode but no existing data found (non-chunked). This might be a first-time download. Using API vouchers only.');
            console.warn(`⚠️ If this is not a first-time download, existing cache may have been lost!`);
            // Deduplicate vouchers by mstid before using
            allVouchers = deduplicateVouchersByMstid(allVouchers);
            mergedData = { vouchers: allVouchers };
          }
        } else {
          // Not an update, use new vouchers as-is (but still deduplicate)
          allVouchers = deduplicateVouchersByMstid(allVouchers);
          mergedData = { vouchers: allVouchers };
        }
      } else {
        // No response vouchers
        if (isUpdate) {
          // For updates, preserve existing data even if API returns nothing
          try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
            if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
              console.log(`📊 No new data from API, preserving ${existingData.data.vouchers.length} existing vouchers`);
              // Deduplicate existing vouchers by mstid
              const deduplicatedVouchers = deduplicateVouchersByMstid(existingData.data.vouchers);
              mergedData = { vouchers: deduplicatedVouchers };
            } else {
              mergedData = { vouchers: [] };
            }
          } catch (error) {
            console.error('Error loading existing cache:', error);
            mergedData = { vouchers: [] };
          }
        } else {
          mergedData = { vouchers: [] };
        }
      }
    }

    // Final validation - but don't fail if we have some data (even if some chunks failed)
    if (isUpdate && (!mergedData.vouchers || !Array.isArray(mergedData.vouchers) || mergedData.vouchers.length === 0)) {
      console.warn('⚠️ Update resulted in empty merged data, attempting to preserve existing cache...');
        try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
        if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
          // Deduplicate existing vouchers by mstid
          const deduplicatedVouchers = deduplicateVouchersByMstid(existingData.data.vouchers);
          mergedData = { vouchers: deduplicatedVouchers };
          console.log(`✅ Preserved ${deduplicatedVouchers.length} existing vouchers from cache (no new data from update, after deduplication)`);
        } else {
          // Don't throw error if we have no data - just log and continue
          console.warn('⚠️ Update resulted in empty data and no existing cache found, but continuing...');
          mergedData = { vouchers: [] };
        }
      } catch (error) {
        // Don't throw - just log and continue with empty array
        console.error('❌ Could not load existing cache for final validation:', error);
        mergedData = { vouchers: [] };
      }
    }

    if (!mergedData || !mergedData.vouchers || !Array.isArray(mergedData.vouchers)) {
      // Initialize empty array instead of throwing - better to have empty cache than crash
      console.warn('⚠️ Invalid data structure, initializing empty vouchers array');
      mergedData = { vouchers: [] };
    }

    // Final validation: For updates, ensure we have at least as many vouchers as we started with
    if (isUpdate && existingVouchersForMerge.length > 0) {
      const finalCount = mergedData.vouchers.length;
      const originalCount = existingVouchersForMerge.length;
      if (finalCount < originalCount) {
        console.error(`❌ CRITICAL VALIDATION FAILED: Final voucher count (${finalCount}) is less than original (${originalCount})!`);
        console.error(`❌ This indicates data loss during merge. Attempting emergency recovery...`);
        // Emergency recovery: merge existing + all new vouchers without filtering
        try {
          const emergencyMerged = [...existingVouchersForMerge];
          // Add all vouchers from API/chunks, let deduplication happen later if needed
          if (allVouchers && allVouchers.length > 0) {
            emergencyMerged.push(...allVouchers);
          }
          // Deduplicate by mstid (keep highest alterid for each mstid)
          const deduplicated = deduplicateVouchersByMstid(emergencyMerged);
          mergedData = { vouchers: deduplicated };
          console.log(`✅ Emergency recovery complete: ${mergedData.vouchers.length} vouchers preserved`);
        } catch (recoveryError) {
          console.error('❌ Emergency recovery failed:', recoveryError);
          // Last resort: use existing vouchers only (but still deduplicate)
          const deduplicated = deduplicateVouchersByMstid(existingVouchersForMerge);
          mergedData = { vouchers: deduplicated };
          console.log(`⚠️ Using existing vouchers only as last resort: ${mergedData.vouchers.length} vouchers`);
        }
      } else {
        console.log(`✅ Validation passed: Final count (${finalCount}) >= original count (${originalCount})`);
      }
    }

    // CRITICAL: Before saving, verify we're not losing data for updates
    if (isUpdate && existingVouchersForMerge.length > 0) {
      const finalVoucherCount = mergedData.vouchers.length;
      const originalVoucherCount = existingVouchersForMerge.length;

      console.log(`🔍 Pre-save validation: Original=${originalVoucherCount}, Final=${finalVoucherCount}`);

      if (finalVoucherCount < originalVoucherCount) {
        console.error(`❌ CRITICAL: About to save ${finalVoucherCount} vouchers but we had ${originalVoucherCount} originally!`);
        console.error(`❌ This would result in data loss. Attempting emergency recovery...`);

        // Emergency recovery: Load existing data one more time and merge properly
        try {
          const emergencyData = await hybridCache.getCompleteSalesData(companyInfo, email);
          if (emergencyData && emergencyData.data && emergencyData.data.vouchers && emergencyData.data.vouchers.length > 0) {
            const emergencyExisting = emergencyData.data.vouchers;
            console.log(`🚨 Emergency: Loaded ${emergencyExisting.length} existing vouchers`);

            // Create ID set from emergency existing
            const emergencyIds = new Set();
            emergencyExisting.forEach(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              if (mstid && alterid) {
                emergencyIds.add(`${mstid}_${alterid}`);
                emergencyIds.add(`${String(mstid)}_${String(alterid)}`);
              }
            });

            // Get truly new vouchers from API response
            const trulyNewVouchers = mergedData.vouchers.filter(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              if (mstid && alterid) {
                return !emergencyIds.has(`${mstid}_${alterid}`) && !emergencyIds.has(`${String(mstid)}_${String(alterid)}`);
              }
              return true; // Include if we can't identify
            });

            // Merge: existing + truly new, then deduplicate by mstid
            const emergencyMerged = [...emergencyExisting, ...trulyNewVouchers];
            const deduplicated = deduplicateVouchersByMstid(emergencyMerged);
            mergedData = { vouchers: deduplicated };
            console.log(`✅ Emergency recovery: ${emergencyExisting.length} existing + ${trulyNewVouchers.length} new = ${mergedData.vouchers.length} total (after deduplication)`);
          } else {
            console.error(`❌ Emergency recovery failed: Could not load existing data`);
            // Last resort: don't save, keep existing
            throw new Error(`Cannot save: Would lose ${originalVoucherCount - finalVoucherCount} vouchers. Aborting save to prevent data loss.`);
          }
        } catch (emergencyError) {
          console.error(`❌ Emergency recovery error:`, emergencyError);
          throw new Error(`Cannot save merged data: Would result in data loss. Original: ${originalVoucherCount}, Final: ${finalVoucherCount}. Error: ${emergencyError.message}`);
        }
      } else {
        console.log(`✅ Pre-save validation passed: Final count (${finalVoucherCount}) >= Original count (${originalVoucherCount})`);
      }
    }

    // Final deduplication by mstid before saving (ensures we have the highest alterid for each mstid)
    if (mergedData && mergedData.vouchers && Array.isArray(mergedData.vouchers)) {
      mergedData.vouchers = deduplicateVouchersByMstid(mergedData.vouchers);
    }

    const maxAlterId = calculateMaxAlterId(mergedData);
    const previousLastAltId = isUpdate ? lastaltid : null;
    const metadata = {
      booksfrom: booksfrom || formatDateForAPI(todayStr),
      lastaltid: maxAlterId
    };

    console.log(`📊 LastAltId calculation: Previous=${previousLastAltId}, New=${maxAlterId}, Vouchers=${mergedData.vouchers.length}`);
    if (isUpdate && previousLastAltId !== null && maxAlterId !== null) {
      if (maxAlterId > previousLastAltId) {
        console.log(`✅ LastAltId updated: ${previousLastAltId} -> ${maxAlterId} (+${maxAlterId - previousLastAltId})`);
      } else if (maxAlterId === previousLastAltId) {
        console.log(`ℹ️ LastAltId unchanged: ${maxAlterId}`);
      } else {
        console.warn(`⚠️ LastAltId decreased: ${previousLastAltId} -> ${maxAlterId} (this might indicate an issue)`);
      }
    }

    // CRITICAL: Final validation before save - ensure masterid coverage is preserved
    // Note: We check for masterid coverage, not exact voucher IDs, because vouchers with
    // same masterid but higher alterid are valid replacements
    if (isUpdate && existingVouchersForMerge.length > 0) {
      const finalCount = mergedData.vouchers.length;
      const originalCount = existingVouchersForMerge.length;

      // Build a set of masterids from existing vouchers
      const existingMasterIds = new Set();
      const existingVouchersWithoutMstid = [];
      existingVouchersForMerge.forEach(v => {
        const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
        if (mstid !== null && mstid !== undefined) {
          existingMasterIds.add(String(mstid));
        } else {
          existingVouchersWithoutMstid.push(v);
        }
      });

      // Build a set of masterids from merged vouchers
      const mergedMasterIds = new Set();
      const mergedVouchersWithoutMstid = [];
      mergedData.vouchers.forEach(v => {
        const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
        if (mstid !== null && mstid !== undefined) {
          mergedMasterIds.add(String(mstid));
        } else {
          mergedVouchersWithoutMstid.push(v);
        }
      });

      // Check for missing masterids (vouchers that were completely lost)
      const missingMasterIds = [];
      existingMasterIds.forEach(mstid => {
        if (!mergedMasterIds.has(mstid)) {
          missingMasterIds.push(mstid);
        }
      });

      // Validation: 
      // 1. All masterids from existing should be present in merged (or replaced with higher alterid)
      // 2. Count should be reasonable (may be less due to deduplication, but shouldn't be drastically less)
      const countDifference = originalCount - finalCount;
      const maxAllowedDifference = Math.max(100, originalCount * 0.1); // Allow up to 10% reduction or 100 vouchers, whichever is larger

      if (missingMasterIds.length > 0) {
        console.error(`❌ FINAL VALIDATION FAILED: Missing masterids: ${missingMasterIds.length}`, missingMasterIds.slice(0, 10));
        console.error(`❌ This indicates data loss. Attempting emergency recovery...`);
        
        // Emergency: Force merge with all existing + all new
        console.log(`🚨 EMERGENCY: Forcing merge with ALL existing vouchers...`);
        const emergencyMerged = [...existingVouchersForMerge, ...mergedData.vouchers];
        // Deduplicate by mstid (keep highest alterid for each mstid)
        const deduplicated = deduplicateVouchersByMstid(emergencyMerged);
        mergedData = { vouchers: deduplicated };
        console.log(`✅ Emergency merge complete: ${deduplicated.length} vouchers (${originalCount} existing + ${deduplicated.length - originalCount} new, after deduplication)`);

        // Re-check masterid coverage after emergency merge
        const emergencyMasterIds = new Set();
        mergedData.vouchers.forEach(v => {
          const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
          if (mstid !== null && mstid !== undefined) {
            emergencyMasterIds.add(String(mstid));
          }
        });
        const stillMissing = [];
        existingMasterIds.forEach(mstid => {
          if (!emergencyMasterIds.has(mstid)) {
            stillMissing.push(mstid);
          }
        });

        if (stillMissing.length > 0) {
          throw new Error(`EMERGENCY MERGE FAILED: Still missing ${stillMissing.length} masterids after emergency merge. Aborting.`);
        }
      } else if (countDifference > maxAllowedDifference) {
        // Count difference is too large, might indicate data loss
        console.warn(`⚠️ Large count difference: ${countDifference} vouchers (${originalCount} -> ${finalCount})`);
        console.warn(`⚠️ This might be due to deduplication. Checking masterid coverage...`);
        
        // If masterid coverage is good, allow it (deduplication can reduce count)
        if (mergedMasterIds.size >= existingMasterIds.size * 0.95) {
          console.log(`✅ Masterid coverage is good (${mergedMasterIds.size}/${existingMasterIds.size}), allowing save`);
        } else {
          console.error(`❌ Masterid coverage is poor (${mergedMasterIds.size}/${existingMasterIds.size}), attempting recovery...`);
          // Emergency recovery
          const emergencyMerged = [...existingVouchersForMerge, ...mergedData.vouchers];
          const deduplicated = deduplicateVouchersByMstid(emergencyMerged);
          mergedData = { vouchers: deduplicated };
        }
      } else {
        console.log(`✅ Final validation passed: All ${existingMasterIds.size} masterids are covered (${originalCount} -> ${finalCount} vouchers, ${countDifference} removed via deduplication/replacement)`);
      }
    }

    // Final log before save
    console.log(`💾 About to save ${mergedData.vouchers.length} vouchers to cache (isUpdate=${isUpdate}, useNewUpdateApi=${useNewUpdateApi})`);
    if (isUpdate && existingVouchersForMerge.length > 0) {
      console.log(`💾 Update save: ${existingVouchersForMerge.length} original vouchers should be preserved in the ${mergedData.vouchers.length} total vouchers`);
    }
    
    // Log sample vouchers to verify merge worked
    if (isUpdate && mergedData.vouchers.length > 0) {
      const sampleVouchers = mergedData.vouchers.slice(0, 3).map(v => ({
        mstid: v.mstid || v.MSTID || v.masterid || v.MASTERID,
        alterid: v.alterid || v.ALTERID,
        vchno: v.voucher_number || v.VCHNO || v.vchno || v.VCHNO
      }));
      console.log(`📋 Sample merged vouchers:`, sampleVouchers);
    }

    console.log(`💾 Calling hybridCache.setCompleteSalesData...`);
    await hybridCache.setCompleteSalesData(companyInfo, mergedData, { ...metadata, email });
    console.log(`✅ hybridCache.setCompleteSalesData completed`);

    // Post-save verification
    if (isUpdate && existingVouchersForMerge.length > 0) {
      try {
        const verifyData = await hybridCache.getCompleteSalesData(companyInfo, email);
        if (verifyData && verifyData.data && verifyData.data.vouchers) {
          const savedCount = verifyData.data.vouchers.length;
          const savedLastAltId = verifyData.metadata?.lastaltid || calculateMaxAlterId(verifyData.data);
          console.log(`✅ Post-save verification: ${savedCount} vouchers in cache, lastaltid=${savedLastAltId}`);
          if (savedCount < existingVouchersForMerge.length) {
            console.error(`❌ POST-SAVE VERIFICATION FAILED: Only ${savedCount} vouchers saved, expected at least ${existingVouchersForMerge.length}`);
          } else {
            console.log(`✅ Post-save verification passed: ${savedCount} >= ${existingVouchersForMerge.length}`);
          }
          if (savedLastAltId !== maxAlterId) {
            console.warn(`⚠️ LastAltId mismatch: Expected ${maxAlterId}, Got ${savedLastAltId}`);
          } else {
            console.log(`✅ LastAltId saved correctly: ${savedLastAltId}`);
          }
        }
      } catch (verifyError) {
        console.warn(`⚠️ Could not verify saved data:`, verifyError);
      }
    }
    
    // Mark progress as completed
    try {
    await hybridCache.setDashboardState(progressKey, {
      email,
      companyGuid: companyInfo.guid,
      tallylocId: companyInfo.tallyloc_id,
      status: 'completed',
      lastSyncedAlterId: maxAlterId,
      lastSyncedDate: todayStr,
      lastUpdated: Date.now(),
      chunksCompleted: chunks ? chunks.length : 0,
      totalChunks: chunks ? chunks.length : 0
    });
    } catch (e) {
      console.warn('Could not mark progress as completed:', e);
    }

    console.log(`✅ Successfully stored ${mergedData.vouchers.length} vouchers in cache`);
    return { success: true, count: mergedData.vouchers.length, lastAlterId: maxAlterId };

  } catch (error) {
    // Save error state
    try {
      await hybridCache.setDashboardState(progressKey, {
        email,
        companyGuid: companyInfo.guid,
        tallylocId: companyInfo.tallyloc_id,
        status: 'failed',
        lastUpdated: Date.now(),
        error: error.message
      });
    } catch (e) {
      console.error('Failed to save error state:', e);
    }
    console.error('Error syncing sales data:', error);
    throw error;
  }
};

/**
 * Unified Cache Sync Manager
 * Singleton pattern to manage cache sync operations globally.
 * Handles auto-sync on login, progress tracking, resume capability, and company switching.
 */
class CacheSyncManager {
  constructor() {
    this.isSyncing = false;
    this.progress = { current: 0, total: 0, message: '' };
    this.companyInfo = null;
    this.syncPromise = null;
    this.subscribers = new Set();
    this.syncStartTime = null;
    this.autoSyncQueue = [];
    this.autoSyncInProgress = false;
    this.initialized = false;
  }

  /**
   * Initialize the sync manager - check for incomplete syncs and resume
   */
  async init() {
    if (this.initialized) return;
    
    const email = getUserEmail();
    if (!email) {
      console.log('No user email found, skipping sync initialization');
      this.initialized = true;
      return;
    }

    try {
      // Check for incomplete syncs and resume them
      await this.resumeIncompleteSyncs(email);
    } catch (error) {
      console.error('Error initializing sync manager:', error);
    }
    
    this.initialized = true;
    
    // Listen for connections updates to trigger auto-sync
    const connectionsHandler = () => {
      this.handleConnectionsUpdate();
    };
    window.addEventListener('connectionsUpdated', connectionsHandler);

    // Listen for storage events (cross-tab sync)
    const storageHandler = (e) => {
      if (e.key === 'allConnections') {
        this.handleConnectionsUpdate();
      }
    };
    window.addEventListener('storage', storageHandler);
    
    // Also trigger immediately if connections are already available
    try {
      const connectionsStr = sessionStorage.getItem('allConnections');
      if (connectionsStr) {
        // Small delay to ensure everything is initialized
        setTimeout(() => {
          this.handleConnectionsUpdate();
        }, 1000);
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Resume incomplete syncs on app start
   */
  async resumeIncompleteSyncs(email) {
    try {
      // Get all companies from sessionStorage
      const connectionsStr = sessionStorage.getItem('allConnections');
      if (!connectionsStr) return;

      const connections = JSON.parse(connectionsStr);
      const eligibleCompanies = connections.filter(c => 
        c.status === 'Connected' && 
        (c.access_type === 'Internal' || c.access_type === 'Full Access')
      );

      for (const company of eligibleCompanies) {
        const progressKey = getSyncProgressKey(email, company.guid, company.tallyloc_id);
        try {
          const progress = await hybridCache.getDashboardState(progressKey);
          if (progress && progress.status === 'in_progress') {
            console.log(`📋 Found incomplete sync for ${company.company}, resuming...`);
            // Add to auto-sync queue
            this.queueCompanyForSync(company);
          }
        } catch (e) {
          // No progress found or error reading
        }
      }

      // Start processing queue if there are incomplete syncs
      if (this.autoSyncQueue.length > 0) {
        this.processAutoSyncQueue();
      }
    } catch (error) {
      console.error('Error resuming incomplete syncs:', error);
    }
  }

  /**
   * Handle connections update - trigger auto-sync for new companies
   */
  async handleConnectionsUpdate() {
    const email = getUserEmail();
    if (!email) return;

    try {
      const connectionsStr = sessionStorage.getItem('allConnections');
      if (!connectionsStr) return;

      const connections = JSON.parse(connectionsStr);
      const eligibleCompanies = connections.filter(c => 
        c.status === 'Connected' && 
        (c.access_type === 'Internal' || c.access_type === 'Full Access')
      );

      // Check each company - sync if not already completed or in progress
      for (const company of eligibleCompanies) {
        // Skip if already in queue
        if (this.autoSyncQueue.find(c => c.guid === company.guid && c.tallyloc_id === company.tallyloc_id)) {
          continue;
        }
        
        // Skip if currently being synced
        if (this.isSyncing && this.companyInfo && 
            this.companyInfo.guid === company.guid && 
            this.companyInfo.tallyloc_id === company.tallyloc_id) {
          continue;
        }
        
        const progressKey = getSyncProgressKey(email, company.guid, company.tallyloc_id);
        try {
          const progress = await hybridCache.getDashboardState(progressKey);
          // Only queue if not completed and not already in progress
          if (!progress || (progress.status !== 'completed' && progress.status !== 'in_progress')) {
            this.queueCompanyForSync(company);
          }
        } catch (e) {
          // No progress found, queue for sync
          this.queueCompanyForSync(company);
        }
      }

      // Start processing queue if not already processing
      if (this.autoSyncQueue.length > 0 && !this.autoSyncInProgress) {
        this.processAutoSyncQueue();
      }
    } catch (error) {
      console.error('Error handling connections update:', error);
    }
  }

  /**
   * Start auto-sync for multiple companies (called after login)
   */
  async startAutoSyncForCompanies(companies) {
    if (!companies || companies.length === 0) return;

    const email = getUserEmail();
    if (!email) {
      console.warn('Cannot start auto-sync: no user email found');
      return;
    }

    // Filter for eligible companies
    const eligibleCompanies = companies.filter(c => 
      c.status === 'Connected' && 
      (c.access_type === 'Internal' || c.access_type === 'Full Access')
    );

    console.log(`🚀 Starting auto-sync for ${eligibleCompanies.length} companies`);

    // Check each company - only queue if not already completed
    for (const company of eligibleCompanies) {
      const progressKey = getSyncProgressKey(email, company.guid, company.tallyloc_id);
      try {
        const progress = await hybridCache.getDashboardState(progressKey);
        // Only queue if not completed
        if (!progress || progress.status !== 'completed') {
          this.queueCompanyForSync(company);
        }
      } catch (e) {
        // No progress found, queue for sync
        this.queueCompanyForSync(company);
      }
    }

    // Start processing queue
    this.processAutoSyncQueue();
  }

  /**
   * Queue a company for auto-sync
   */
  queueCompanyForSync(company) {
    // Check if already in queue
    if (this.autoSyncQueue.find(c => c.guid === company.guid && c.tallyloc_id === company.tallyloc_id)) {
      return;
    }
    this.autoSyncQueue.push(company);
  }

  /**
   * Process auto-sync queue sequentially
   */
  async processAutoSyncQueue() {
    if (this.autoSyncInProgress || this.autoSyncQueue.length === 0) {
      return;
    }

    this.autoSyncInProgress = true;
    const email = getUserEmail();

    while (this.autoSyncQueue.length > 0) {
      const company = this.autoSyncQueue.shift();
      
      try {
        console.log(`🔄 Auto-syncing company: ${company.company}`);
        await this.startSync(company, async (companyInfo, progressCallback) => {
          return await syncSalesDataInternal(companyInfo, email, progressCallback);
        });
      } catch (error) {
        console.error(`❌ Auto-sync failed for ${company.company}:`, error);
        // Continue with next company
      }
    }

    this.autoSyncInProgress = false;
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.isSyncing) {
      callback(this.progress);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of progress update
   */
  notifySubscribers(progress) {
    this.progress = progress;
    this.subscribers.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in sync progress subscriber:', error);
      }
    });
  }

  /**
   * Check if a sync is currently in progress
   */
  isSyncInProgress() {
    return this.isSyncing;
  }

  /**
   * Get current progress
   */
  getProgress() {
    return { ...this.progress };
  }

  /**
   * Get progress for a specific company
   */
  async getCompanyProgress(companyInfo) {
    const email = getUserEmail();
    if (!email || !companyInfo) {
      return null;
    }

    // First check if this company is currently being synced
    if (this.isSyncing && this.companyInfo && 
        this.companyInfo.guid === companyInfo.guid && 
        this.companyInfo.tallyloc_id === companyInfo.tallyloc_id) {
      return {
        ...this.progress,
        companyGuid: companyInfo.guid,
        companyName: companyInfo.company
      };
    }

    // Otherwise check stored progress
    const progressKey = getSyncProgressKey(email, companyInfo.guid, companyInfo.tallyloc_id);
    try {
      const progress = await hybridCache.getDashboardState(progressKey);
      if (progress && progress.status === 'in_progress') {
        // Convert stored progress to display format
        const current = progress.chunksCompleted || 0;
        const total = progress.totalChunks || 0;
        return {
          current,
          total,
          message: total > 0 
            ? `Syncing ${companyInfo.company}: ${current} / ${total} chunks`
            : `Syncing ${companyInfo.company}...`,
          companyGuid: companyInfo.guid,
          companyName: companyInfo.company
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting company progress:', error);
      return null;
    }
  }

  /**
   * Get current company info being synced
   */
  getCompanyInfo() {
    return this.companyInfo;
  }

  /**
   * Check if sync is for the same company
   */
  isSameCompany(companyInfo) {
    if (!this.companyInfo || !companyInfo) return false;
    return (
      this.companyInfo.tallyloc_id === companyInfo.tallyloc_id &&
      this.companyInfo.guid === companyInfo.guid
    );
  }

  /**
   * Start a sync operation
   */
  async startSync(companyInfo, syncFunction) {
    // If sync is already in progress for the same company, return existing promise
    if (this.isSyncing && this.isSameCompany(companyInfo)) {
      return this.syncPromise;
    }

    // If sync is in progress for a different company, wait for it to complete
    if (this.isSyncing && !this.isSameCompany(companyInfo)) {
      try {
        await this.syncPromise;
      } catch (error) {
        // Ignore errors from previous sync
      }
    }

    // Start new sync
    this.isSyncing = true;
    this.companyInfo = companyInfo;
    this.syncStartTime = Date.now();
    this.notifySubscribers({ current: 0, total: 0, message: 'Starting sync...' });

    const progressCallback = (progress) => {
      this.notifySubscribers(progress);
    };

    this.syncPromise = syncFunction(companyInfo, progressCallback)
      .then((result) => {
        console.log('✅ Sync completed successfully');
        return result;
      })
      .catch((error) => {
        console.error('❌ Sync failed:', error);
        throw error;
      })
      .finally(() => {
        this.isSyncing = false;
        this.companyInfo = null;
        this.syncPromise = null;
        this.syncStartTime = null;
        setTimeout(() => {
          if (!this.isSyncing) {
            this.notifySubscribers({ current: 0, total: 0, message: '' });
          }
        }, 1000);
      });

    return this.syncPromise;
  }

  /**
   * Cancel current sync
   */
  cancelSync() {
    if (this.isSyncing) {
      console.log('🛑 Cancelling sync...');
      this.isSyncing = false;
      this.companyInfo = null;
      this.syncPromise = null;
      this.syncStartTime = null;
      this.notifySubscribers({ current: 0, total: 0, message: 'Cancelled' });
    }
  }
}

// Export singleton instance
export const cacheSyncManager = new CacheSyncManager();

// Export sync functions for backward compatibility
export const syncSalesData = async (companyInfo, onProgress = () => { }, startFresh = false) => {
  if (!companyInfo) {
    throw new Error('No company selected');
  }

  const email = getUserEmail();
  if (!email) {
    throw new Error('No user email found');
  }

  // Subscribe to progress updates
  const unsubscribe = cacheSyncManager.subscribe(onProgress);

  try {
    const result = await cacheSyncManager.startSync(companyInfo, async (companyInfo, progressCallback) => {
      return await syncSalesDataInternal(companyInfo, email, progressCallback, startFresh);
    });
    return result;
  } finally {
    unsubscribe();
  }
};


// Helper to retrieve chunked data (for backward compatibility with old sessionStorage data)
// Note: This is synchronous and only checks sessionStorage. For OPFS data, use getCustomersFromOPFS/getItemsFromOPFS
export const safeSessionStorageGet = (key) => {
  try {
    // Only check sessionStorage (synchronous operation)
    // For OPFS data, use the async getCustomersFromOPFS/getItemsFromOPFS functions
    const chunksStr = sessionStorage.getItem(`${key}_chunks`);
    if (chunksStr) {
      const totalChunks = parseInt(chunksStr, 10);
      let data = '';
      for (let i = 0; i < totalChunks; i++) {
        const chunk = sessionStorage.getItem(`${key}_chunk_${i}`);
        if (chunk === null) {
          throw new Error(`Missing chunk ${i} for key ${key}`);
        }
        data += chunk;
      }
      return data;
    } else {
      // Not chunked, return normally
      return sessionStorage.getItem(key);
    }
  } catch (error) {
    console.error('Error retrieving data from sessionStorage:', error);
    return null;
  }
};

// Helper to get customers from OPFS/IndexedDB (with sessionStorage fallback)
export const getCustomersFromOPFS = async (cacheKey) => {
  try {
    // Try OPFS/IndexedDB first (new storage)
    const data = await hybridCache.getSalesData(cacheKey);
    if (data && data.ledgers && Array.isArray(data.ledgers)) {
      return data.ledgers;
    }

    // Fallback to sessionStorage (old storage or chunked)
    const cached = safeSessionStorageGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : (parsed.ledgers || null);
      } catch (e) {
        console.warn('Error parsing cached customers:', e);
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting customers from OPFS:', error);
    // Try sessionStorage as last resort
    try {
      const cached = safeSessionStorageGet(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : (parsed.ledgers || null);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }
};

// Helper to get items from OPFS/IndexedDB (with sessionStorage fallback)
export const getItemsFromOPFS = async (cacheKey) => {
  try {
    // Try OPFS/IndexedDB first (new storage)
    const data = await hybridCache.getSalesData(cacheKey);
    if (data && data.stockItems && Array.isArray(data.stockItems)) {
      return data.stockItems;
    }

    // Fallback to sessionStorage (old storage or chunked)
    const cached = safeSessionStorageGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : (parsed.stockItems || null);
      } catch (e) {
        console.warn('Error parsing cached items:', e);
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting items from OPFS:', error);
    // Try sessionStorage as last resort
    try {
      const cached = safeSessionStorageGet(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : (parsed.stockItems || null);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }
};

export const syncCustomers = async (companyInfo) => {
  if (!companyInfo) throw new Error('No company selected');

  const { tallyloc_id, company, guid } = companyInfo;
  const cacheKey = `ledgerlist-w-addrs_${tallyloc_id}_${company}`;

  try {
    const data = await apiPost(`/api/tally/ledgerlist-w-addrs?ts=${Date.now()}`, {
      tallyloc_id,
      company,
      guid
    });

    if (data && data.ledgers && Array.isArray(data.ledgers)) {
      const dataSizeMB = (JSON.stringify(data.ledgers).length / (1024 * 1024)).toFixed(2);
      console.log(`📊 Customer data size: ${dataSizeMB} MB (${data.ledgers.length} customers)`);

      // Clear any existing corrupted cache data first
      try {
        console.log(`🧹 Clearing old cache data for key: ${cacheKey}`);
        await hybridCache.deleteCacheKey(cacheKey);
        console.log(`✅ Old cache cleared`);
      } catch (clearError) {
        console.warn('Could not clear old cache (might not exist):', clearError.message);
        // Continue anyway - old cache might not exist
      }

      // Store in OPFS/IndexedDB using hybridCache (handles large data)
      console.log(`🔄 Storing ${data.ledgers.length} customers in OPFS with key: ${cacheKey}`);
      await hybridCache.setSalesData(cacheKey, { ledgers: data.ledgers }, null);
      console.log(`✅ Successfully stored in OPFS`);

      // Note: Verification removed due to encryption/decryption timing issue
      // The data will be verified when it's actually read by getCustomersFromOPFS

      // Also keep a lightweight version in sessionStorage for quick access (just count)
      // This allows other parts of the app to quickly check if data exists
      try {
        sessionStorage.setItem(`${cacheKey}_count`, data.ledgers.length.toString());
      } catch (e) {
        // Ignore if sessionStorage fails, OPFS storage is the primary
        console.warn('Could not store customer count in sessionStorage:', e);
      }

      console.log(`✅ Stored ${data.ledgers.length} customers in OPFS/IndexedDB`);
      return { success: true, count: data.ledgers.length };
    }
    throw new Error(data?.error || 'Failed to fetch customers');
  } catch (error) {
    console.error('Error syncing customers:', error);
    throw error;
  }
};

export const syncItems = async (companyInfo) => {
  if (!companyInfo) throw new Error('No company selected');

  const { tallyloc_id, company, guid } = companyInfo;
  const cacheKey = `stockitems_${tallyloc_id}_${company}`;

  try {
    const data = await apiPost(`/api/tally/stockitem?ts=${Date.now()}`, {
      tallyloc_id,
      company,
      guid
    });

    if (data && data.stockItems && Array.isArray(data.stockItems)) {
      const decryptedItems = deobfuscateStockItems(data.stockItems);
      const dataSizeMB = (JSON.stringify(decryptedItems).length / (1024 * 1024)).toFixed(2);
      console.log(`📊 Item data size: ${dataSizeMB} MB (${decryptedItems.length} items)`);

      // Clear any existing corrupted cache data first
      try {
        console.log(`🧹 Clearing old cache data for key: ${cacheKey}`);
        await hybridCache.deleteCacheKey(cacheKey);
        console.log(`✅ Old cache cleared`);
      } catch (clearError) {
        console.warn('Could not clear old cache (might not exist):', clearError.message);
        // Continue anyway - old cache might not exist
      }

      // Store in OPFS/IndexedDB using hybridCache (handles large data)
      await hybridCache.setSalesData(cacheKey, { stockItems: decryptedItems }, null);

      // Also keep a lightweight version in sessionStorage for quick access (just count)
      // This allows other parts of the app to quickly check if data exists
      try {
        sessionStorage.setItem(`${cacheKey}_count`, decryptedItems.length.toString());
      } catch (e) {
        // Ignore if sessionStorage fails, OPFS storage is the primary
        console.warn('Could not store item count in sessionStorage:', e);
      }

      console.log(`✅ Stored ${decryptedItems.length} items in OPFS/IndexedDB`);
      return { success: true, count: decryptedItems.length };
    }
    throw new Error(data?.error || 'Failed to fetch stock items');
  } catch (error) {
    console.error('Error syncing items:', error);
    throw error;
  }
};

