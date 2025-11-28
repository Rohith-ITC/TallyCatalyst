import React, { useState, useEffect } from 'react';
import { hybridCache } from '../utils/hybridCache';
import { apiPost, apiGet } from '../utils/apiUtils';

const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [cacheEntries, setCacheEntries] = useState(null);
  const [showCacheViewer, setShowCacheViewer] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [cacheExpiryDays, setCacheExpiryDays] = useState(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [downloadingComplete, setDownloadingComplete] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, message: '' });
  const [viewingJsonCache, setViewingJsonCache] = useState(null);
  const [jsonCacheData, setJsonCacheData] = useState(null);

  useEffect(() => {
    loadCacheStats();
    loadCurrentCompany();
    loadCacheExpiry();
  }, []);

  const loadCacheExpiry = () => {
    try {
      const stored = localStorage.getItem('cacheExpiryDays');
      if (stored === null || stored === 'null' || stored === 'never') {
        setCacheExpiryDays('never');
      } else {
        const days = parseInt(stored, 10);
        setCacheExpiryDays(isNaN(days) || days < 0 ? 'never' : days.toString());
      }
    } catch (error) {
      setCacheExpiryDays('never');
    }
  };

  const saveCacheExpiry = async (days) => {
    setSavingExpiry(true);
    try {
      hybridCache.setCacheExpiryDays(days);
      setCacheExpiryDays(days === null || days === 'never' || days === '' ? 'never' : days.toString());
      setMessage({ type: 'success', text: 'Cache expiry period updated successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving cache expiry:', error);
      setMessage({ type: 'error', text: 'Failed to save cache expiry period' });
    } finally {
      setSavingExpiry(false);
    }
  };

  const loadCurrentCompany = () => {
    try {
      const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      const selectedGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (selectedGuid && Array.isArray(connections)) {
        const company = connections.find(c => c.guid === selectedGuid);
        if (company) {
          setSelectedCompany({
            tallyloc_id: company.tallyloc_id,
            guid: company.guid,
            company: company.company
          });
        }
      }
    } catch (error) {
      console.error('Error loading current company:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await hybridCache.getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('Error loading cache stats:', error);
      setMessage({ type: 'error', text: 'Failed to load cache statistics' });
    }
  };

  const loadCacheEntries = async () => {
    setLoadingEntries(true);
    try {
      const entries = await hybridCache.listAllCacheEntries();
      setCacheEntries(entries);
      setShowCacheViewer(true);
    } catch (error) {
      console.error('Error loading cache entries:', error);
      setMessage({ type: 'error', text: 'Failed to load cache entries: ' + error.message });
    } finally {
      setLoadingEntries(false);
    }
  };

  const clearAllCache = async () => {
    if (!window.confirm('Are you sure you want to clear ALL cache? This will remove all cached sales data and dashboard states for all companies.')) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Clear all cache by clearing OPFS directories
      const opfsRoot = await navigator.storage.getDirectory();

      // Clear sales directory
      try {
        await opfsRoot.removeEntry('sales', { recursive: true });
        await opfsRoot.getDirectoryHandle('sales', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Clear dashboard directory
      try {
        await opfsRoot.removeEntry('dashboard', { recursive: true });
        await opfsRoot.getDirectoryHandle('dashboard', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Clear metadata
      try {
        const metadataDir = await opfsRoot.getDirectoryHandle('metadata', { create: true });
        const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
        const dashboardFile = await metadataDir.getFileHandle('dashboard.json', { create: true });
        const salesWritable = await salesFile.createWritable();
        const dashboardWritable = await dashboardFile.createWritable();
        await salesWritable.write(JSON.stringify([]));
        await dashboardWritable.write(JSON.stringify([]));
        await salesWritable.close();
        await dashboardWritable.close();
      } catch (err) {
        console.warn('Failed to clear metadata:', err);
      }

      // Note: We keep the keys directory as it contains user encryption keys
      // Clearing it would prevent decryption of any remaining cached data

      setMessage({ type: 'success', text: 'All cache cleared successfully!' });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing all cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearCompanyCache = async () => {
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    if (!window.confirm(`Are you sure you want to clear cache for "${selectedCompany.company}"? This will remove all cached sales data and dashboard states for this company.`)) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await hybridCache.clearCompanyCache(selectedCompany);
      setMessage({ type: 'success', text: `Cache cleared successfully for ${selectedCompany.company}!` });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing company cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear company cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const clearSalesCache = async () => {
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    if (!window.confirm(`Are you sure you want to clear sales cache for "${selectedCompany.company}"? This will remove all cached sales data for this company.`)) {
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Clear sales cache by deleting sales directory
      const opfsRoot = await navigator.storage.getDirectory();
      try {
        await opfsRoot.removeEntry('sales', { recursive: true });
        // Recreate empty directory
        await opfsRoot.getDirectoryHandle('sales', { create: true });
      } catch (err) {
        // Directory might not exist
      }

      // Also clear sales metadata
      try {
        const metadataDir = await opfsRoot.getDirectoryHandle('metadata', { create: true });
        const salesFile = await metadataDir.getFileHandle('sales.json', { create: true });
        const writable = await salesFile.createWritable();
        await writable.write(JSON.stringify([]));
        await writable.close();
      } catch (err) {
        console.warn('Failed to clear sales metadata:', err);
      }

      setMessage({ type: 'success', text: `Sales cache cleared successfully for ${selectedCompany.company}!` });
      await loadCacheStats();
    } catch (error) {
      console.error('Error clearing sales cache:', error);
      setMessage({ type: 'error', text: 'Failed to clear sales cache: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert date from various formats to YYYYMMDD
  const convertDateToYYYYMMDD = (dateString) => {
    if (!dateString) return null;

    // If already in YYYYMMDD format, return as is
    if (/^\d{8}$/.test(dateString)) {
      return dateString;
    }

    // If in YYYY-MM-DD format, convert to YYYYMMDD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString.replace(/-/g, '');
    }

    // Handle format like "1-Apr-24" or "15-Jul-2024"
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    try {
      // Match pattern: day-month-year (e.g., "1-Apr-24" or "15-Jul-2024")
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthName = parts[1].toLowerCase();
        const year = parseInt(parts[2], 10);

        const monthIndex = monthNames.findIndex(m => m === monthName);
        if (monthIndex === -1) {
          console.warn('Unknown month in date:', dateString);
          return null;
        }

        // Determine full year (if 2-digit, assume 20XX for years < 50, 19XX otherwise)
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

  // Helper function to format date for display (YYYY-MM-DD)
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return dateString;

    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // If in YYYYMMDD format, convert to YYYY-MM-DD
    if (/^\d{8}$/.test(dateString)) {
      return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
    }

    // If in format like "1-Apr-24" or "1-Apr-2024", convert to YYYY-MM-DD
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthName = parts[1].toLowerCase();
        const year = parseInt(parts[2], 10);

        const monthIndex = monthNames.findIndex(m => m === monthName);
        if (monthIndex !== -1) {
          const fullYear = year < 50 ? 2000 + year : (year < 100 ? 1900 + year : year);
          const month = String(monthIndex + 1).padStart(2, '0');
          const dayStr = String(day).padStart(2, '0');
          return `${fullYear}-${month}-${dayStr}`;
        }
      }
    } catch (error) {
      console.warn('Error formatting date for display:', dateString, error);
    }

    // Return as-is if we can't parse it
    return dateString;
  };

  // Helper function to format date for API (YYYYMMDD)
  const formatDateForAPI = (dateString) => {
    // First try to convert from various formats
    const converted = convertDateToYYYYMMDD(dateString);
    if (converted) {
      return converted;
    }

    // Fallback: try removing dashes if it's YYYY-MM-DD format
    if (dateString.includes('-')) {
      return dateString.replace(/-/g, '');
    }

    return dateString;
  };

  // Helper function to split date range into 5-day chunks
  const splitDateRange = (startDate, endDate) => {
    const chunks = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    let currentStart = new Date(start);

    while (currentStart <= end) {
      let currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 4); // 5-day chunks

      if (currentEnd > end) {
        currentEnd = new Date(end);
      }

      chunks.push({
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0]
      });

      currentStart.setDate(currentStart.getDate() + 5);
    }

    return chunks;
  };

  // Helper function to calculate max alterid from vouchers
  const calculateMaxAlterId = (data) => {
    if (!data || !data.vouchers || !Array.isArray(data.vouchers)) {
      return null;
    }

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

  // Fetch booksfrom from user-connections
  const fetchBooksFrom = async () => {
    try {
      // First, check if booksfrom is directly stored in sessionStorage
      const booksfromDirect = sessionStorage.getItem('booksfrom');
      if (booksfromDirect) {
        console.log('📋 Found booksfrom in sessionStorage:', booksfromDirect);
        return booksfromDirect; // This should be in YYYYMMDD format
      }

      // Second, check allConnections array in sessionStorage
      const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      const selectedGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (selectedGuid && Array.isArray(connections)) {
        const company = connections.find(c => c.guid === selectedGuid);
        if (company && company.booksfrom) {
          console.log('📋 Found booksfrom in allConnections:', company.booksfrom);
          return company.booksfrom; // This is in YYYYMMDD format
        }
      }

      // Third, fetch from API if not found in sessionStorage
      console.log('📋 booksfrom not in sessionStorage, fetching from API...');
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
          console.log('📋 Found booksfrom from API:', company.booksfrom);
          // Also store it in sessionStorage for next time
          sessionStorage.setItem('booksfrom', company.booksfrom);
          return company.booksfrom; // This is in YYYYMMDD format
        }
      }

      console.warn('⚠️ booksfrom not found in any source');
      return null;
    } catch (error) {
      console.error('Error fetching booksfrom:', error);
      return null;
    }
  };

  // Download complete sales data
  const downloadCompleteData = async (isUpdate = false) => {
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    setDownloadingComplete(true);
    setMessage({ type: '', text: '' });
    setDownloadProgress({ current: 0, total: 0, message: 'Starting download...' });

    try {
      // Get booksfrom date
      const booksfrom = await fetchBooksFrom();
      if (!booksfrom && !isUpdate) {
        setMessage({ type: 'error', text: 'Unable to fetch booksfrom date. Please try again.' });
        setDownloadingComplete(false);
        return;
      }

      // Get lastaltid if updating
      let lastaltid = null;
      if (isUpdate) {
        lastaltid = await hybridCache.getLastAlterId(selectedCompany);
        if (!lastaltid) {
          setMessage({ type: 'error', text: 'No existing data found. Please download complete data first.' });
          setDownloadingComplete(false);
          return;
        }
      }

      // Format dates
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const todayAPI = formatDateForAPI(todayStr);

      // Convert booksfrom to YYYYMMDD format if it's in a different format
      let fromdateFormatted = todayAPI;
      if (booksfrom) {
        fromdateFormatted = convertDateToYYYYMMDD(booksfrom);
        if (!fromdateFormatted) {
          // If conversion fails, try formatDateForAPI as fallback
          fromdateFormatted = formatDateForAPI(booksfrom);
        }
        console.log(`📅 Converted booksfrom "${booksfrom}" to "${fromdateFormatted}"`);
      }

      // First request: Try with serverslice: "Yes" if updating
      let payload = {
        tallyloc_id: selectedCompany.tallyloc_id,
        company: selectedCompany.company,
        guid: selectedCompany.guid,
        fromdate: fromdateFormatted,
        todate: todayAPI,
        serverslice: isUpdate ? "Yes" : "No"
      };

      if (isUpdate && lastaltid) {
        payload.lastaltid = lastaltid;
      }

      setDownloadProgress({ current: 0, total: 1, message: isUpdate ? 'Fetching updates...' : 'Fetching data...' });

      // Use production API URL directly for salesextract calls
      const apiBaseUrl = 'https://itcatalystindia.com/Development/CustomerPortal_API';
      const salesextractUrl = `${apiBaseUrl}/api/reports/salesextract?ts=${Date.now()}`;

      // Make direct fetch call to production API
      const token = sessionStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      let response;
      let needsSlice = false;

      // For initial downloads (not updates), always use chunking to avoid timeouts
      // For updates with lastaltid, try direct request first, but fallback to chunking on timeout
      const shouldUseChunking = !isUpdate; // Always chunk for initial downloads

      if (!shouldUseChunking) {
        // Try direct request for updates
        try {
          setDownloadProgress({ current: 0, total: 1, message: 'Fetching updates (may take a moment)...' });

          const fetchResponse = await fetch(salesextractUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });

          if (!fetchResponse.ok) {
            // If timeout or error, fall back to chunking
            if (fetchResponse.status === 504 || fetchResponse.status === 408) {
              console.log('⚠️ Request timed out, falling back to chunked requests');
              needsSlice = true;
            } else {
              const errorText = await fetchResponse.text();
              throw new Error(`API request failed: ${fetchResponse.status} ${fetchResponse.statusText}. ${errorText.substring(0, 500)}`);
            }
          } else {
            const responseText = await fetchResponse.text();
            if (!responseText) {
              throw new Error('Empty response from server');
            }

            try {
              response = JSON.parse(responseText);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              throw new Error(`Failed to parse JSON response: ${parseError.message}`);
            }

            // Check if backend wants us to slice
            needsSlice = response && (
              response.message === 'slice' ||
              response.message === 'Slice' ||
              response.message?.toLowerCase().includes('slice') ||
              (response.error && response.error.toLowerCase().includes('slice'))
            );
          }
        } catch (error) {
          // If fetch itself fails (network error, timeout, etc.), use chunking
          if (error.message.includes('timeout') || error.message.includes('504') || error.message.includes('408') || error.message.includes('Gateway Timeout')) {
            console.log('⚠️ Request failed with timeout, using chunked requests');
            needsSlice = true;
          } else {
            throw error;
          }
        }
      } else {
        // For initial downloads, always use chunking
        console.log('📦 Initial download: Using chunked requests to avoid timeouts');
        needsSlice = true;
      }

      let allVouchers = [];
      let mergedData = { vouchers: [] };

      if (needsSlice || shouldUseChunking) {
        // Need to fetch in chunks
        setDownloadProgress({ current: 0, total: 1, message: 'Preparing chunks...' });

        // Convert booksfrom to YYYY-MM-DD format for date calculations
        let startDateForChunks = todayStr;
        if (booksfrom) {
          const booksfromYYYYMMDD = convertDateToYYYYMMDD(booksfrom);
          if (booksfromYYYYMMDD && booksfromYYYYMMDD.length === 8) {
            startDateForChunks = `${booksfromYYYYMMDD.slice(0, 4)}-${booksfromYYYYMMDD.slice(4, 6)}-${booksfromYYYYMMDD.slice(6, 8)}`;
          }
        }
        const chunks = splitDateRange(startDateForChunks, todayStr);

        setDownloadProgress({ current: 0, total: chunks.length, message: `Fetching ${chunks.length} chunks...` });

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          setDownloadProgress({
            current: i + 1,
            total: chunks.length,
            message: `Fetching chunk ${i + 1}/${chunks.length}: ${chunk.start} to ${chunk.end}`
          });

          const chunkPayload = {
            ...payload,
            fromdate: formatDateForAPI(chunk.start),
            todate: formatDateForAPI(chunk.end),
            serverslice: "No"
          };

          // Use production API URL directly for chunked requests
          const chunkUrl = `${apiBaseUrl}/api/reports/salesextract?ts=${Date.now()}`;
          const chunkFetchResponse = await fetch(chunkUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(chunkPayload),
          });

          if (!chunkFetchResponse.ok) {
            const errorText = await chunkFetchResponse.text();
            throw new Error(`API request failed: ${chunkFetchResponse.status} ${chunkFetchResponse.statusText}. ${errorText.substring(0, 500)}`);
          }

          const chunkResponseText = await chunkFetchResponse.text();
          if (!chunkResponseText) {
            throw new Error('Empty response from server');
          }

          let chunkResponse;
          try {
            chunkResponse = JSON.parse(chunkResponseText);
          } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error(`Failed to parse JSON response: ${parseError.message}`);
          }

          if (chunkResponse && chunkResponse.vouchers && Array.isArray(chunkResponse.vouchers)) {
            allVouchers.push(...chunkResponse.vouchers);
          }
        }

        mergedData = { vouchers: allVouchers };
      } else {
        // Direct response
        if (response && response.vouchers && Array.isArray(response.vouchers)) {
          if (isUpdate) {
            // For update, merge with existing data
            const existingData = await hybridCache.getCompleteSalesData(selectedCompany);
            if (existingData && existingData.data && existingData.data.vouchers) {
              const existingVouchers = existingData.data.vouchers;
              // Create a set of existing voucher IDs using multiple possible field combinations
              const existingIds = new Set(existingVouchers.map(v => {
                // Try different field name variations
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;

                // Use mstid + alterid combination if available, otherwise use vchno + date
                if (mstid && alterid) {
                  return `${mstid}_${alterid}`;
                } else if (vchno && date) {
                  return `${vchno}_${date}`;
                } else if (mstid) {
                  return mstid.toString();
                } else {
                  // Fallback: use JSON string of key fields
                  return JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
                }
              }));

              // Add only new vouchers
              const newVouchers = response.vouchers.filter(v => {
                const mstid = v.mstid || v.MSTID || v.masterid || v.MASTERID;
                const alterid = v.alterid || v.ALTERID;
                const vchno = v.voucher_number || v.VCHNO || v.vchno || v.VCHNO;
                const date = v.cp_date || v.DATE || v.date || v.CP_DATE;

                let id;
                if (mstid && alterid) {
                  id = `${mstid}_${alterid}`;
                } else if (vchno && date) {
                  id = `${vchno}_${date}`;
                } else if (mstid) {
                  id = mstid.toString();
                } else {
                  id = JSON.stringify({ vchno, date, amount: v.amount || v.AMT || v.amt });
                }

                return !existingIds.has(id);
              });

              console.log(`📊 Update: ${existingVouchers.length} existing vouchers, ${newVouchers.length} new vouchers`);
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

      // Calculate max alterid
      const maxAlterId = calculateMaxAlterId(mergedData);

      // Store in cache
      const metadata = {
        booksfrom: booksfrom || formatDateForAPI(todayStr),
        lastaltid: maxAlterId
      };

      await hybridCache.setCompleteSalesData(selectedCompany, mergedData, metadata);

      setMessage({
        type: 'success',
        text: `Successfully ${isUpdate ? 'updated' : 'downloaded'} ${mergedData.vouchers.length} vouchers! Last Alter ID: ${maxAlterId || 'N/A'}`
      });
      await loadCacheStats();

    } catch (error) {
      console.error('Error downloading complete data:', error);
      setMessage({ type: 'error', text: 'Failed to download data: ' + error.message });
    } finally {
      setDownloadingComplete(false);
      setDownloadProgress({ current: 0, total: 0, message: '' });
    }
  };

  // View cache file as JSON
  const viewCacheAsJson = async (cacheKey) => {
    setViewingJsonCache(cacheKey);
    setJsonCacheData(null);

    try {
      const data = await hybridCache.getCacheFileAsJson(cacheKey);
      setJsonCacheData(data);
    } catch (error) {
      console.error('Error viewing cache as JSON:', error);
      setMessage({ type: 'error', text: 'Failed to load cache data: ' + error.message });
      setViewingJsonCache(null);
    }
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, Roboto, Arial, sans-serif'
    }}>
      <div style={{
        marginBottom: '32px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '24px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons" style={{ fontSize: '32px', color: '#3b82f6' }}>
            storage
          </span>
          Cache Management
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          marginTop: '8px',
          marginLeft: '44px'
        }}>
          Manage and clear cached data stored in OPFS (Origin Private File System)
        </p>
      </div>

      {/* Message Display */}
      {message.text && (
        <div style={{
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span className="material-icons" style={{
            fontSize: '24px',
            color: message.type === 'success' ? '#059669' : '#dc2626'
          }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <div style={{
            fontSize: '15px',
            fontWeight: 500,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            flex: 1
          }}>
            {message.text}
          </div>
        </div>
      )}

      {/* Current Company Info */}
      {selectedCompany && (
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#0369a1',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px' }}>business</span>
            Current Company
          </h3>
          <div style={{ fontSize: '15px', color: '#0c4a6e' }}>
            <strong>{selectedCompany.company}</strong>
            <div style={{ fontSize: '13px', color: '#075985', marginTop: '4px' }}>
              ID: {selectedCompany.tallyloc_id} | GUID: {selectedCompany.guid.substring(0, 8)}...
            </div>
          </div>
        </div>
      )}

      {/* Download Complete Sales Data */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <span className="material-icons" style={{ fontSize: '28px', color: '#10b981' }}>
            download
          </span>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0
          }}>
            Complete Sales Data
          </h3>
        </div>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          marginBottom: '20px',
          lineHeight: '1.6'
        }}>
          Download and cache complete sales data from the beginning of your books. Update to fetch only new records since last download.
        </p>

        {downloadProgress.total > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '13px',
              color: '#0369a1',
              marginBottom: '8px',
              fontWeight: 500
            }}>
              {downloadProgress.message}
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              background: '#e0f2fe',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(downloadProgress.current / downloadProgress.total) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '4px',
              textAlign: 'right'
            }}>
              {downloadProgress.current} / {downloadProgress.total}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => downloadCompleteData(false)}
            disabled={downloadingComplete || !selectedCompany}
            style={{
              flex: '1 1 calc(50% - 6px)',
              minWidth: '150px',
              padding: '12px 16px',
              background: (downloadingComplete || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (downloadingComplete || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (downloadingComplete || !selectedCompany) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {downloadingComplete ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                  refresh
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Downloading...</span>
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px', flexShrink: 0 }}>
                  download
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Download Complete Data</span>
              </>
            )}
          </button>
          <button
            onClick={() => downloadCompleteData(true)}
            disabled={downloadingComplete || !selectedCompany}
            style={{
              flex: '1 1 calc(50% - 6px)',
              minWidth: '150px',
              padding: '12px 16px',
              background: (downloadingComplete || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (downloadingComplete || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (downloadingComplete || !selectedCompany) ? 'none' : '0 2px 8px rgba(139, 92, 246, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {downloadingComplete ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                  refresh
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Updating...</span>
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px', flexShrink: 0 }}>
                  update
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Update Data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* View Cache Section */}
      <div style={{
        marginTop: '0',
        marginBottom: '32px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>
              folder_open
            </span>
            View Cache Contents
          </h3>
          <button
            onClick={loadCacheEntries}
            disabled={loadingEntries}
            style={{
              padding: '10px 20px',
              background: loadingEntries ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loadingEntries ? 'not-allowed' : 'pointer',
              boxShadow: loadingEntries ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loadingEntries) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingEntries) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {loadingEntries ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Loading...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  refresh
                </span>
                {showCacheViewer ? 'Refresh' : 'View Cache'}
              </>
            )}
          </button>
        </div>

        {cacheEntries && showCacheViewer && (
          <div>
            {/* Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
                  {cacheEntries.totalEntries}
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Total Size</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b' }}>
                  {cacheEntries.totalSizeMB} MB
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Sales Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#3b82f6' }}>
                  {cacheEntries.salesCount}
                </div>
              </div>
              <div style={{
                background: '#f8fafc',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Dashboard Entries</div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#10b981' }}>
                  {cacheEntries.dashboardCount}
                </div>
              </div>
            </div>

            {/* Cache Entries Table */}
            {cacheEntries.entries.length > 0 ? (
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                maxHeight: '600px',
                overflowY: 'auto'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '14px'
                }}>
                  <thead style={{
                    background: '#f8fafc',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <tr>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Type</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Cache Key</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Date Range</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Size</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Age</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Cached Date</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderBottom: '2px solid #e2e8f0'
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheEntries.entries.map((entry, index) => (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: index % 2 === 0 ? '#fff' : '#f8fafc'
                        }}
                      >
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: entry.type === 'sales' ? '#dbeafe' : '#dcfce7',
                            color: entry.type === 'sales' ? '#1e40af' : '#166534'
                          }}>
                            {entry.type === 'sales' ? 'Sales' : 'Dashboard'}
                          </span>
                        </td>
                        <td style={{
                          padding: '12px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#475569',
                          wordBreak: 'break-all',
                          maxWidth: '400px'
                        }}>
                          {entry.cacheKey}
                        </td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                          {entry.startDate && entry.endDate ? (
                            <div>
                              <div>{formatDateForDisplay(entry.startDate)}</div>
                              <div style={{ color: '#94a3b8' }}>to</div>
                              <div>{formatDateForDisplay(entry.endDate)}</div>
                            </div>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#1e293b', fontWeight: 500 }}>
                          {entry.sizeMB} MB
                          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                            ({entry.sizeKB} KB)
                          </div>
                        </td>
                        <td style={{ padding: '12px', color: '#64748b' }}>
                          {entry.ageDays === 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Today</span>
                          ) : entry.ageDays === 1 ? (
                            <span style={{ color: '#3b82f6' }}>1 day ago</span>
                          ) : (
                            <span>{entry.ageDays} days ago</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '13px' }}>
                          {entry.date}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button
                            onClick={() => viewCacheAsJson(entry.cacheKey)}
                            style={{
                              padding: '6px 12px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: '16px' }}>code</span>
                            View JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                <span className="material-icons" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>
                  folder_off
                </span>
                No cache entries found
              </div>
            )}
          </div>
        )}

        {!showCacheViewer && (
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            textAlign: 'center',
            padding: '20px',
            fontStyle: 'italic'
          }}>
            Click "View Cache" to see all cached entries
          </p>
        )}
      </div>

      {/* Cache Expiry Settings */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>
            schedule
          </span>
          Cache Expiry Period
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          marginBottom: '16px',
          lineHeight: '1.6'
        }}>
          Set how long cached data should be kept before automatically expiring. Set to "Never" to keep cache indefinitely.
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <select
            value={cacheExpiryDays || 'never'}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                const customDays = prompt('Enter number of days (0 for never):', '');
                if (customDays !== null) {
                  const days = parseInt(customDays, 10);
                  if (!isNaN(days) && days >= 0) {
                    saveCacheExpiry(days === 0 ? 'never' : days);
                  } else if (customDays === '' || customDays.toLowerCase() === 'never') {
                    saveCacheExpiry('never');
                  }
                }
              } else {
                saveCacheExpiry(value);
              }
            }}
            disabled={savingExpiry}
            style={{
              padding: '10px 16px',
              fontSize: '15px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#fff',
              color: '#1e293b',
              cursor: savingExpiry ? 'not-allowed' : 'pointer',
              minWidth: '200px',
              fontWeight: 500
            }}
          >
            <option value="never">Never (Keep Forever)</option>
            <option value="1">1 Day</option>
            <option value="3">3 Days</option>
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
            <option value="custom">Custom...</option>
          </select>
          {savingExpiry && (
            <span className="material-icons" style={{
              fontSize: '20px',
              color: '#3b82f6',
              animation: 'spin 1s linear infinite'
            }}>
              refresh
            </span>
          )}
          <div style={{
            fontSize: '14px',
            color: '#64748b',
            fontStyle: 'italic'
          }}>
            {cacheExpiryDays === 'never'
              ? 'Cache will never expire automatically'
              : `Cache will expire after ${cacheExpiryDays} day${parseInt(cacheExpiryDays) !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* Cache Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Clear All Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#dc2626' }}>
              delete_sweep
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear All Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove all cached data for all companies. This includes sales data, dashboard states, and metadata.
          </p>
          <button
            onClick={clearAllCache}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: loading ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  delete_sweep
                </span>
                Clear All Cache
              </>
            )}
          </button>
        </div>

        {/* Clear Company Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#f59e0b' }}>
              business_center
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Company Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove all cached data for the currently selected company. This includes sales data and dashboard states.
          </p>
          <button
            onClick={clearCompanyCache}
            disabled={loading || !selectedCompany}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: (loading || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: (loading || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !selectedCompany) ? 'none' : '0 2px 8px rgba(245, 158, 11, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  business_center
                </span>
                Clear Company Cache
              </>
            )}
          </button>
        </div>

        {/* Clear Sales Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#3b82f6' }}>
              analytics
            </span>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Sales Cache
            </h3>
          </div>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Remove only sales data cache for the currently selected company. Dashboard states will be preserved.
          </p>
          <button
            onClick={clearSalesCache}
            disabled={loading || !selectedCompany}
            style={{
              width: '100%',
              padding: '12px 20px',
              background: (loading || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '15px',
              cursor: (loading || !selectedCompany) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !selectedCompany) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && selectedCompany) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
              }
            }}
          >
            {loading ? (
              <>
                <span className="material-icons" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>
                  refresh
                </span>
                Clearing...
              </>
            ) : (
              <>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  analytics
                </span>
                Clear Sales Cache
              </>
            )}
          </button>
        </div>

      </div>

      {/* JSON Viewer Modal */}
      {viewingJsonCache && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => {
          setViewingJsonCache(null);
          setJsonCacheData(null);
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '90%',
            maxHeight: '90%',
            width: '800px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#1e293b',
                margin: 0
              }}>
                Cache Data (JSON)
              </h3>
              <button
                onClick={() => {
                  setViewingJsonCache(null);
                  setJsonCacheData(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <span className="material-icons" style={{ fontSize: '24px', color: '#64748b' }}>
                  close
                </span>
              </button>
            </div>
            <div style={{
              flex: 1,
              overflow: 'auto',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {jsonCacheData === null ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
                  <span className="material-icons" style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>
                    hourglass_empty
                  </span>
                  Loading...
                </div>
              ) : (
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#1e293b'
                }}>
                  {JSON.stringify(jsonCacheData, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}


      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CacheManagement;

