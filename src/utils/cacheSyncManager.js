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
                        key.startsWith('stockitem_');
      const isAuthKey = authKeys.includes(key);
      
      if (!isAuthKey && isCacheKey) {
        sessionStorage.removeItem(key);
        clearedCount++;
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

// Force reload with cache busting
export const forceReload = () => {
  const timestamp = new Date().getTime();
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('_t', timestamp);
  clearAllCaches();
  window.location.href = currentUrl.toString();
};

// Detect mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Fetch with timeout and retry logic
const fetchWithTimeout = async (url, options, timeout = 60000, retries = 3) => {
  const isMobile = isMobileDevice();
  const effectiveTimeout = isMobile ? 90000 : timeout;
  
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
          throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText.substring(0, 200)}`);
        }
        
        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
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
    currentEnd.setDate(currentEnd.getDate() + 4);
    if (currentEnd > end) currentEnd = new Date(end);
    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    currentStart.setDate(currentStart.getDate() + 5);
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
      const company = connections.find(c => c.guid === selectedGuid);
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
      
      const company = apiConnections.find(c => c.guid === selectedGuid);
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
const getSyncProgressKey = (email, guid) => {
  return `sync_progress_${email}_${guid}`;
};

// Get email from sessionStorage
const getUserEmail = () => {
  return sessionStorage.getItem('email');
};

// Internal sync function that does the actual work
const syncSalesDataInternal = async (companyInfo, email, onProgress = () => {}) => {
  if (!companyInfo) {
    throw new Error('No company selected');
  }

  console.log('🚀 Starting syncSalesData for company:', {
    tallyloc_id: companyInfo.tallyloc_id,
    company: companyInfo.company,
    guid: companyInfo.guid,
    email
  });

  const progressKey = getSyncProgressKey(email, companyInfo.guid);
  let savedProgress = null;

  try {
    // Load saved progress if exists
    try {
      savedProgress = await hybridCache.getDashboardState(progressKey);
    } catch (e) {
      console.warn('Could not load saved progress:', e);
    }

    // Update progress to in_progress
    await hybridCache.setDashboardState(progressKey, {
      email,
      companyGuid: companyInfo.guid,
      tallylocId: companyInfo.tallyloc_id,
      status: 'in_progress',
      lastUpdated: Date.now(),
      chunksCompleted: savedProgress?.chunksCompleted || 0,
      totalChunks: savedProgress?.totalChunks || 0
    });

    const booksfrom = await fetchBooksFrom(companyInfo.guid);
    
    if (!booksfrom) {
      throw new Error('Unable to fetch booksfrom date. Please ensure you have access to this company.');
    }

    const lastaltid = savedProgress?.lastSyncedAlterId || await hybridCache.getLastAlterId(companyInfo, email);
    const isUpdate = !!lastaltid;

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
      serverslice: isUpdate ? "Yes" : "No"
    };

    if (isUpdate && lastaltid) {
      payload.lastaltid = lastaltid;
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
    const shouldUseChunking = !isUpdate;

    if (!shouldUseChunking) {
      try {
        const fetchResponse = await fetchWithTimeout(
          salesextractUrl,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          },
          60000,
          2
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

    if (needsSlice || shouldUseChunking) {
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
      await hybridCache.setDashboardState(progressKey, {
        email,
        companyGuid: companyInfo.guid,
        tallylocId: companyInfo.tallyloc_id,
        status: 'in_progress',
        lastUpdated: Date.now(),
        chunksCompleted: startChunkIndex,
        totalChunks: chunks.length
      });

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
            60000,
            3
          );

          const chunkResponseText = await chunkFetchResponse.text();
          if (chunkResponseText) {
            const chunkResponse = JSON.parse(chunkResponseText);
            if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
              allVouchers.push(...chunkResponse.vouchers);
            }
          }

          // Update progress after each chunk
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
          // Save progress before throwing
          await hybridCache.setDashboardState(progressKey, {
            email,
            companyGuid: companyInfo.guid,
            tallylocId: companyInfo.tallyloc_id,
            status: 'failed',
            lastUpdated: Date.now(),
            chunksCompleted: i,
            totalChunks: chunks.length,
            error: chunkError.message
          });
          throw chunkError;
        }
      }
      mergedData = { vouchers: allVouchers };
      
      // If this is an update, merge with existing cache data
      if (isUpdate && allVouchers.length > 0) {
        try {
          const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
          if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
            const existingVouchers = existingData.data.vouchers;
            
            const existingIds = new Set(existingVouchers.map(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
              const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
              if (mstid && alterid) return `${mstid}_${alterid}`;
              if (vchno && date) return `${vchno}_${date}`;
              if (mstid) return mstid.toString();
              return JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
            }));

            const newVouchers = allVouchers.filter(v => {
              const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
              const alterid = v.alterid || v.ALTERID;
              const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
              const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
              let id;
              if (mstid && alterid) id = `${mstid}_${alterid}`;
              else if (vchno && date) id = `${vchno}_${date}`;
              else if (mstid) id = mstid.toString();
              else id = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
              return !existingIds.has(id);
            });
            
            allVouchers = [...existingVouchers, ...newVouchers];
            mergedData = { vouchers: allVouchers };
          }
        } catch (error) {
          console.error('Error loading existing cache for merge, using only new vouchers:', error);
        }
      }
    } else {
      if (response && response.vouchers && Array.isArray(response.vouchers)) {
        if (isUpdate) {
          try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
            if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
              const existingVouchers = existingData.data.vouchers;
              
              const existingIds = new Set(existingVouchers.map(v => {
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
                if (mstid && alterid) return `${mstid}_${alterid}`;
                if (vchno && date) return `${vchno}_${date}`;
                if (mstid) return mstid.toString();
                return JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
              }));

              const newVouchers = response.vouchers.filter(v => {
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;
                let id;
                if (mstid && alterid) id = `${mstid}_${alterid}`;
                else if (vchno && date) id = `${vchno}_${date}`;
                else if (mstid) id = mstid.toString();
                else id = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
                return !existingIds.has(id);
              });
              
              allVouchers = [...existingVouchers, ...newVouchers];
              mergedData = { vouchers: allVouchers };
            } else {
              allVouchers = response.vouchers;
              mergedData = { vouchers: allVouchers };
            }
          } catch (error) {
            allVouchers = response.vouchers;
            mergedData = { vouchers: allVouchers };
          }
        } else {
          allVouchers = response.vouchers;
          mergedData = { vouchers: allVouchers };
        }
      } else {
        if (isUpdate) {
          try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
            if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
              mergedData = existingData.data;
            } else {
              mergedData = { vouchers: [] };
            }
          } catch (error) {
            mergedData = { vouchers: [] };
          }
        } else {
          mergedData = { vouchers: [] };
        }
      }
    }

    // Final validation
    if (isUpdate && (!mergedData.vouchers || !Array.isArray(mergedData.vouchers) || mergedData.vouchers.length === 0)) {
        try {
            const existingData = await hybridCache.getCompleteSalesData(companyInfo, email);
        if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
          mergedData = existingData.data;
        } else {
          throw new Error('No existing cache to preserve and update resulted in empty data');
        }
      } catch (error) {
        throw new Error('Update failed: No data to store and no existing cache to preserve');
      }
    }

    if (!mergedData || !mergedData.vouchers || !Array.isArray(mergedData.vouchers)) {
      throw new Error('Invalid data structure: mergedData must have vouchers array');
    }

    const maxAlterId = calculateMaxAlterId(mergedData);
    const metadata = {
      booksfrom: booksfrom || formatDateForAPI(todayStr),
      lastaltid: maxAlterId
    };

    await hybridCache.setCompleteSalesData(companyInfo, mergedData, { ...metadata, email });
    
    // Mark progress as completed
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
        const progressKey = getSyncProgressKey(email, company.guid);
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
        if (this.autoSyncQueue.find(c => c.guid === company.guid)) {
          continue;
        }
        
        // Skip if currently being synced
        if (this.isSyncing && this.companyInfo && this.companyInfo.guid === company.guid) {
          continue;
        }
        
        const progressKey = getSyncProgressKey(email, company.guid);
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
      const progressKey = getSyncProgressKey(email, company.guid);
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
    if (this.autoSyncQueue.find(c => c.guid === company.guid)) {
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
    if (this.isSyncing && this.companyInfo && this.companyInfo.guid === companyInfo.guid) {
      return {
        ...this.progress,
        companyGuid: companyInfo.guid,
        companyName: companyInfo.company
      };
    }

    // Otherwise check stored progress
    const progressKey = getSyncProgressKey(email, companyInfo.guid);
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
export const syncSalesData = async (companyInfo, onProgress = () => {}) => {
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
      return await syncSalesDataInternal(companyInfo, email, progressCallback);
    });
    return result;
  } finally {
    unsubscribe();
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
      sessionStorage.setItem(cacheKey, JSON.stringify(data.ledgers));
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
      sessionStorage.setItem(cacheKey, JSON.stringify(decryptedItems));
      return { success: true, count: decryptedItems.length };
    }
    throw new Error(data?.error || 'Failed to fetch stock items');
  } catch (error) {
    console.error('Error syncing items:', error);
    throw error;
  }
};

