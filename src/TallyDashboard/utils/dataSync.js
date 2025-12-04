import { hybridCache } from '../../utils/hybridCache';
import { apiPost, apiGet } from '../../utils/apiUtils';
import { deobfuscateStockItems } from '../../utils/frontendDeobfuscate';
import { getApiUrl } from '../../config';
import { cacheSyncManager } from './cacheSyncManager';

// Detect mobile device
const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Fetch with timeout and retry logic
const fetchWithTimeout = async (url, options, timeout = 60000, retries = 3) => {
    const isMobile = isMobileDevice();
    // Use longer timeout on mobile (90 seconds vs 60 seconds)
    const effectiveTimeout = isMobile ? 90000 : timeout;
    
    console.log('🔍 Fetch request details:', {
        url,
        method: options.method || 'GET',
        hasAuth: !!options.headers?.Authorization,
        headers: Object.keys(options.headers || {}),
        bodySize: options.body ? options.body.length : 0,
        isMobile,
        timeout: effectiveTimeout
    });
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🌐 Fetch attempt ${attempt}/${retries} to ${url}`);
            console.log(`   Device: ${isMobile ? 'Mobile' : 'Desktop'}`);
            console.log(`   Timeout: ${effectiveTimeout}ms`);
            console.log(`   User-Agent: ${navigator.userAgent}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.warn(`⏰ Request timeout after ${effectiveTimeout}ms`);
                controller.abort();
            }, effectiveTimeout);
            
            const startTime = Date.now();
            
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    // Add these for better mobile compatibility
                    cache: 'no-cache',
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                const duration = Date.now() - startTime;
                clearTimeout(timeoutId);
                
                console.log(`📡 Response received in ${duration}ms:`, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        contentType: response.headers.get('content-type'),
                        contentLength: response.headers.get('content-length')
                    }
                });
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unable to read error message');
                    console.error(`❌ HTTP Error:`, {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorText.substring(0, 500)
                    });
                    throw new Error(`HTTP ${response.status}: ${response.statusText}. ${errorText.substring(0, 200)}`);
                }
                
                console.log(`✅ Fetch successful on attempt ${attempt} (${duration}ms)`);
                return response;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                throw fetchError;
            }
        } catch (error) {
            const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
            const isNetworkError = error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Network request failed');
            const isCORSError = error.message.includes('CORS') || error.message.includes('Origin');
            
            console.error(`❌ Fetch attempt ${attempt}/${retries} failed:`, {
                errorName: error.name,
                errorMessage: error.message,
                isTimeout,
                isNetworkError,
                isCORSError,
                isMobile,
                url: url.substring(0, 100),
                navigator: {
                    online: navigator.onLine,
                    connection: navigator.connection ? {
                        effectiveType: navigator.connection.effectiveType,
                        downlink: navigator.connection.downlink,
                        rtt: navigator.connection.rtt
                    } : 'not available'
                }
            });
            
            // Don't retry on non-retryable errors
            if (!isTimeout && !isNetworkError && !error.message.includes('504') && !error.message.includes('408') && !error.message.includes('502')) {
                console.error(`🛑 Non-retryable error, throwing immediately`);
                throw error;
            }
            
            // If last attempt, throw detailed error
            if (attempt === retries) {
                const detailedError = new Error(
                    `Failed after ${retries} attempts. ` +
                    `Last error: ${error.message}. ` +
                    `Device: ${isMobile ? 'Mobile' : 'Desktop'}. ` +
                    `Online: ${navigator.onLine}. ` +
                    `Please check your internet connection and try again.`
                );
                console.error(`🛑 All attempts exhausted:`, detailedError.message);
                throw detailedError;
            }
            
            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Helper functions
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
    console.log('📅 fetchBooksFrom called with guid:', selectedGuid);
    
    try {
        // Check sessionStorage first
        const booksfromDirect = sessionStorage.getItem('booksfrom');
        if (booksfromDirect) {
            console.log('✅ Found booksfrom in sessionStorage:', booksfromDirect);
            return booksfromDirect;
        }
        console.log('ℹ️ No booksfrom in sessionStorage, checking allConnections...');

        // Check allConnections in sessionStorage
        const connectionsStr = sessionStorage.getItem('allConnections');
        console.log('ℹ️ allConnections exists:', !!connectionsStr);
        
        const connections = JSON.parse(connectionsStr || '[]');
        console.log('ℹ️ Parsed connections count:', connections.length);
        
        if (selectedGuid && Array.isArray(connections)) {
            const company = connections.find(c => c.guid === selectedGuid);
            if (company) {
                console.log('✅ Found company in allConnections:', {
                    name: company.company,
                    hasBooksfrom: !!company.booksfrom,
                    booksfrom: company.booksfrom
                });
                if (company.booksfrom) {
                    return company.booksfrom;
                }
            } else {
                console.warn('⚠️ Company not found in allConnections for guid:', selectedGuid);
            }
        }

        // Fallback to API call
        console.log('🌐 Fetching from API: /api/tally/user-connections');
        const response = await apiGet(`/api/tally/user-connections?ts=${Date.now()}`);
        console.log('🌐 API response received:', !!response);
        
        if (response) {
            let apiConnections = [];
            if (Array.isArray(response)) {
                apiConnections = response;
            } else if (response.createdByMe && response.sharedWithMe) {
                const created = Array.isArray(response.createdByMe) ? response.createdByMe : [];
                const shared = Array.isArray(response.sharedWithMe) ? response.sharedWithMe : [];
                apiConnections = [...created, ...shared];
            }
            console.log('ℹ️ API connections count:', apiConnections.length);
            
            const company = apiConnections.find(c => c.guid === selectedGuid);
            if (company && company.booksfrom) {
                console.log('✅ Found booksfrom from API:', company.booksfrom);
                sessionStorage.setItem('booksfrom', company.booksfrom);
                return company.booksfrom;
            } else {
                console.warn('⚠️ Company found but no booksfrom:', company);
            }
        } else {
            console.error('❌ No response from API');
        }
        
        console.error('❌ Could not find booksfrom anywhere');
        return null;
    } catch (error) {
        console.error('❌ Error in fetchBooksFrom:', {
            message: error.message,
            stack: error.stack
        });
        return null;
    }
};

// Internal sync function that does the actual work
const syncSalesDataInternal = async (companyInfo, onProgress = () => { }) => {
    if (!companyInfo) {
        console.error('❌ No company selected');
        throw new Error('No company selected');
    }

    console.log('🚀 Starting syncSalesData for company:', {
        tallyloc_id: companyInfo.tallyloc_id,
        company: companyInfo.company,
        guid: companyInfo.guid
    });

    try {
        console.log('📅 Fetching booksfrom date...');
        const booksfrom = await fetchBooksFrom(companyInfo.guid);
        console.log('📅 Booksfrom result:', booksfrom);
        
        if (!booksfrom) {
            console.error('❌ Unable to fetch booksfrom date - this will prevent API call!');
            throw new Error('Unable to fetch booksfrom date. Please ensure you have access to this company.');
        }

        console.log('💾 Checking for cached data...');
        const lastaltid = await hybridCache.getLastAlterId(companyInfo);
        console.log('💾 Last alter ID:', lastaltid);
        const isUpdate = !!lastaltid;

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const todayAPI = formatDateForAPI(todayStr);

        let booksFromFormatted = todayAPI;
        if (booksfrom) {
            booksFromFormatted = convertDateToYYYYMMDD(booksfrom) || formatDateForAPI(booksfrom);
        }

        let fromdateFormatted = booksFromFormatted;
        // For updates, we might want to start from the last sync date, but the API logic in CacheManagement 
        // uses booksfrom/timeRange for the 'fromdate' even for updates, relying on 'lastaltid' to filter.
        // However, to be safe and consistent with CacheManagement, we'll use booksFromFormatted as base.

        const payload = {
            tallyloc_id: companyInfo.tallyloc_id,
            company: companyInfo.company,
            guid: companyInfo.guid,
            fromdate: fromdateFormatted,
            todate: todayAPI,
            serverslice: isUpdate ? "Yes" : "No"
        };

        if (isUpdate && lastaltid) {
            payload.lastaltid = lastaltid;
        }

        onProgress({ current: 0, total: 1, message: isUpdate ? 'Checking for updates...' : 'Fetching data...' });

        // Use getApiUrl to get the correct URL (relative in dev for proxy, absolute in prod)
        // This ensures CORS works correctly on mobile when accessing via IP address
        const salesextractUrl = `${getApiUrl('/api/reports/salesextract')}?ts=${Date.now()}`;
        console.log('🌐 Salesextract URL:', salesextractUrl);
        console.log('🌐 Current origin:', window.location.origin);
        console.log('🌐 Using proxy:', !salesextractUrl.startsWith('http'));
        
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
                    60000, // 60 second timeout (will be 90s on mobile)
                    2 // 2 retries
                );

                const responseText = await fetchResponse.text();
                if (!responseText) throw new Error('Empty response from server');
                response = JSON.parse(responseText);
                
                // Check if server wants frontend to handle slicing
                if (response && response.frontendslice === 'Yes') {
                    console.log('📋 Server requested frontend slicing, switching to chunk mode');
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
                console.warn('⚠️ Initial fetch failed, will try chunked approach:', error.message);
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

        if (needsSlice || shouldUseChunking) {
            let startDateForChunks = todayStr;
            if (booksfrom) {
                const booksfromYYYYMMDD = convertDateToYYYYMMDD(booksfrom);
                if (booksfromYYYYMMDD && booksfromYYYYMMDD.length === 8) {
                    startDateForChunks = `${booksfromYYYYMMDD.slice(0, 4)}-${booksfromYYYYMMDD.slice(4, 6)}-${booksfromYYYYMMDD.slice(6, 8)}`;
                }
            }
            const chunks = splitDateRange(startDateForChunks, todayStr);

            onProgress({ current: 0, total: chunks.length, message: `Fetching ${chunks.length} chunks...` });

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                onProgress({
                    current: i + 1,
                    total: chunks.length,
                    message: `Fetching chunk ${i + 1}/${chunks.length}`
                });

                const chunkPayload = {
                    ...payload,
                    fromdate: formatDateForAPI(chunk.start),
                    todate: formatDateForAPI(chunk.end),
                    serverslice: "No"
                };

                const chunkFetchResponse = await fetchWithTimeout(
                    salesextractUrl,
                    {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(chunkPayload),
                    },
                    60000, // 60 second timeout (will be 90s on mobile)
                    3 // 3 retries for chunks
                );

                const chunkResponseText = await chunkFetchResponse.text();
                if (chunkResponseText) {
                    const chunkResponse = JSON.parse(chunkResponseText);
                    if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
                        allVouchers.push(...chunkResponse.vouchers);
                    }
                }
            }
            mergedData = { vouchers: allVouchers };
            
            // If this is an update, merge with existing cache data
            if (isUpdate && allVouchers.length > 0) {
                try {
                    console.log(`🔄 Update mode: Merging ${allVouchers.length} new vouchers with existing cache...`);
                    const existingData = await hybridCache.getCompleteSalesData(companyInfo);
                    if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
                        const existingVouchers = existingData.data.vouchers;
                        console.log(`📦 Found ${existingVouchers.length} existing vouchers in cache`);
                        
                        // Create set of existing voucher IDs for deduplication
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

                        // Filter out duplicates from new vouchers
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
                        
                        console.log(`✅ After deduplication: ${newVouchers.length} new vouchers to add`);
                        allVouchers = [...existingVouchers, ...newVouchers];
                        mergedData = { vouchers: allVouchers };
                        console.log(`📊 Final merged count: ${allVouchers.length} vouchers (${existingVouchers.length} existing + ${newVouchers.length} new)`);
                    } else {
                        console.log(`⚠️ No existing cache found or empty, using only new vouchers`);
                        // Keep mergedData as is (only new vouchers)
                    }
                } catch (error) {
                    console.error('⚠️ Error loading existing cache for merge, using only new vouchers:', error);
                    // Continue with only new vouchers if merge fails
                }
            }
        } else {
            if (response && response.vouchers && Array.isArray(response.vouchers)) {
                if (isUpdate) {
                    try {
                        console.log(`🔄 Update mode: Merging ${response.vouchers.length} new vouchers with existing cache...`);
                        const existingData = await hybridCache.getCompleteSalesData(companyInfo);
                        if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
                            const existingVouchers = existingData.data.vouchers;
                            console.log(`📦 Found ${existingVouchers.length} existing vouchers in cache`);
                            
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
                            
                            console.log(`✅ After deduplication: ${newVouchers.length} new vouchers to add`);
                            allVouchers = [...existingVouchers, ...newVouchers];
                            mergedData = { vouchers: allVouchers };
                            console.log(`📊 Final merged count: ${allVouchers.length} vouchers (${existingVouchers.length} existing + ${newVouchers.length} new)`);
                        } else {
                            console.log(`⚠️ No existing cache found or empty, using only new vouchers`);
                            allVouchers = response.vouchers;
                            mergedData = { vouchers: allVouchers };
                        }
                    } catch (error) {
                        console.error('⚠️ Error loading existing cache for merge, using only new vouchers:', error);
                        // Fallback: use only new vouchers if merge fails
                        allVouchers = response.vouchers;
                        mergedData = { vouchers: allVouchers };
                    }
                } else {
                    allVouchers = response.vouchers;
                    mergedData = { vouchers: allVouchers };
                }
            } else {
                // Response structure is unexpected - for updates, preserve existing data
                if (isUpdate) {
                    console.warn('⚠️ Unexpected response structure in update mode, attempting to preserve existing cache...');
                    try {
                        const existingData = await hybridCache.getCompleteSalesData(companyInfo);
                        if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
                            console.log(`✅ Preserving existing cache with ${existingData.data.vouchers.length} vouchers`);
                            mergedData = existingData.data;
                        } else {
                            console.error('❌ No existing cache to preserve, update will result in empty cache');
                            mergedData = { vouchers: [] };
                        }
                    } catch (error) {
                        console.error('❌ Error preserving existing cache:', error);
                        mergedData = { vouchers: [] };
                    }
                } else {
                    console.warn('⚠️ Unexpected response structure, no data to cache');
                    mergedData = { vouchers: [] };
                }
            }
        }

        // Final validation: Ensure we don't overwrite cache with empty data for updates
        if (isUpdate && (!mergedData.vouchers || !Array.isArray(mergedData.vouchers) || mergedData.vouchers.length === 0)) {
            console.error('❌ Update mode: Attempted to store empty data, preserving existing cache instead');
            try {
                const existingData = await hybridCache.getCompleteSalesData(companyInfo);
                if (existingData && existingData.data && existingData.data.vouchers && existingData.data.vouchers.length > 0) {
                    console.log(`✅ Preserving existing cache with ${existingData.data.vouchers.length} vouchers`);
                    mergedData = existingData.data;
                } else {
                    throw new Error('No existing cache to preserve and update resulted in empty data');
                }
            } catch (error) {
                console.error('❌ Cannot preserve existing cache:', error);
                throw new Error('Update failed: No data to store and no existing cache to preserve');
            }
        }

        // Validate mergedData structure before storing
        if (!mergedData || !mergedData.vouchers || !Array.isArray(mergedData.vouchers)) {
            console.error('❌ Invalid mergedData structure:', mergedData);
            throw new Error('Invalid data structure: mergedData must have vouchers array');
        }

        const maxAlterId = calculateMaxAlterId(mergedData);
        const metadata = {
            booksfrom: booksfrom || formatDateForAPI(todayStr),
            lastaltid: maxAlterId
        };

        // Log what we're about to store
        console.log(`💾 Storing complete sales data:`, {
            voucherCount: mergedData.vouchers.length,
            isUpdate,
            lastAlterId: maxAlterId,
            booksfrom: metadata.booksfrom
        });

        await hybridCache.setCompleteSalesData(companyInfo, mergedData, metadata);
        console.log(`✅ Successfully stored ${mergedData.vouchers.length} vouchers in cache`);
        return { success: true, count: mergedData.vouchers.length, lastAlterId: maxAlterId };

    } catch (error) {
        console.error('Error syncing sales data:', error);
        throw error;
    }
};

// Sync functions - exported wrapper that uses cacheSyncManager
export const syncSalesData = async (companyInfo, onProgress = () => { }) => {
    if (!companyInfo) {
        console.error('❌ No company selected');
        throw new Error('No company selected');
    }

    // Check if sync is already in progress for this company
    if (cacheSyncManager.isSyncInProgress() && cacheSyncManager.isSameCompany(companyInfo)) {
        console.log('🔄 Sync already in progress for this company, subscribing to existing sync');
        // Subscribe to progress updates
        const unsubscribe = cacheSyncManager.subscribe(onProgress);
        try {
            // Wait for existing sync to complete
            const result = await cacheSyncManager.syncPromise;
            return result;
        } finally {
            unsubscribe();
        }
    }

    // Subscribe to progress updates
    const unsubscribe = cacheSyncManager.subscribe(onProgress);

    try {
        // Use cacheSyncManager to start sync (prevents duplicates)
        const result = await cacheSyncManager.startSync(companyInfo, async (companyInfo, progressCallback) => {
            return await syncSalesDataInternal(companyInfo, progressCallback);
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
