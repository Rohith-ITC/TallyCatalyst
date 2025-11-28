import { hybridCache } from '../../utils/hybridCache';
import { apiPost, apiGet } from '../../utils/apiUtils';
import { deobfuscateStockItems } from '../../utils/frontendDeobfuscate';

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
    try {
        const booksfromDirect = sessionStorage.getItem('booksfrom');
        if (booksfromDirect) return booksfromDirect;

        const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
        if (selectedGuid && Array.isArray(connections)) {
            const company = connections.find(c => c.guid === selectedGuid);
            if (company && company.booksfrom) return company.booksfrom;
        }

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
        console.error('Error fetching booksfrom:', error);
        return null;
    }
};

// Sync functions
export const syncSalesData = async (companyInfo, onProgress = () => { }) => {
    if (!companyInfo) throw new Error('No company selected');

    try {
        const booksfrom = await fetchBooksFrom(companyInfo.guid);
        if (!booksfrom) throw new Error('Unable to fetch booksfrom date');

        const lastaltid = await hybridCache.getLastAlterId(companyInfo);
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

        const apiBaseUrl = 'https://itcatalystindia.com/Development/CustomerPortal_API';
        const salesextractUrl = `${apiBaseUrl}/api/reports/salesextract?ts=${Date.now()}`;
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
                const fetchResponse = await fetch(salesextractUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });

                if (!fetchResponse.ok) {
                    if (fetchResponse.status === 504 || fetchResponse.status === 408) {
                        needsSlice = true;
                    } else {
                        const errorText = await fetchResponse.text();
                        throw new Error(`API request failed: ${fetchResponse.status} ${fetchResponse.statusText}. ${errorText.substring(0, 500)}`);
                    }
                } else {
                    const responseText = await fetchResponse.text();
                    if (!responseText) throw new Error('Empty response from server');
                    response = JSON.parse(responseText);
                    needsSlice = response && (
                        response.message === 'slice' ||
                        response.message === 'Slice' ||
                        response.message?.toLowerCase().includes('slice') ||
                        (response.error && response.error.toLowerCase().includes('slice'))
                    );
                }
            } catch (error) {
                if (error.message.includes('timeout') || error.message.includes('504') || error.message.includes('408')) {
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

                const chunkFetchResponse = await fetch(salesextractUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(chunkPayload),
                });

                if (!chunkFetchResponse.ok) {
                    const errorText = await chunkFetchResponse.text();
                    throw new Error(`API request failed: ${chunkFetchResponse.status} ${chunkFetchResponse.statusText}. ${errorText.substring(0, 500)}`);
                }

                const chunkResponseText = await chunkFetchResponse.text();
                if (chunkResponseText) {
                    const chunkResponse = JSON.parse(chunkResponseText);
                    if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
                        allVouchers.push(...chunkResponse.vouchers);
                    }
                }
            }
            mergedData = { vouchers: allVouchers };
        } else {
            if (response && response.vouchers && Array.isArray(response.vouchers)) {
                if (isUpdate) {
                    const existingData = await hybridCache.getCompleteSalesData(companyInfo);
                    if (existingData && existingData.data && existingData.data.vouchers) {
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
                    } else {
                        allVouchers = response.vouchers;
                    }
                } else {
                    allVouchers = response.vouchers;
                }
                mergedData = { vouchers: allVouchers };
            }
        }

        const maxAlterId = calculateMaxAlterId(mergedData);
        const metadata = {
            booksfrom: booksfrom || formatDateForAPI(todayStr),
            lastaltid: maxAlterId
        };

        await hybridCache.setCompleteSalesData(companyInfo, mergedData, metadata);
        return { success: true, count: mergedData.vouchers.length, lastAlterId: maxAlterId };

    } catch (error) {
        console.error('Error syncing sales data:', error);
        throw error;
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
