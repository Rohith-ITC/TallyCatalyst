import React, { useState, useEffect, useRef } from 'react';
import { hybridCache } from '../utils/hybridCache';

import { apiPost, apiGet } from '../utils/apiUtils';
import { syncSalesData, syncCustomers, syncItems, cacheSyncManager } from '../utils/cacheSyncManager';
import { useIsMobile } from './MobileViewConfig';

const CacheManagement = () => {
  const [cacheStats, setCacheStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedCompany, setSelectedCompany] = useState(null);
  const selectedCompanyRef = useRef(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedCompanyRef.current = selectedCompany;
  }, [selectedCompany]);
  const [cacheEntries, setCacheEntries] = useState(null);
  const [showCacheViewer, setShowCacheViewer] = useState(false);
  const showCacheViewerRef = React.useRef(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [cacheExpiryDays, setCacheExpiryDays] = useState(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const [downloadingComplete, setDownloadingComplete] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, message: '' });
  const [viewingJsonCache, setViewingJsonCache] = useState(null);
  const [jsonCacheData, setJsonCacheData] = useState(null);
  const [timeRange, setTimeRange] = useState('all');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('');
  const [financialYearOptions, setFinancialYearOptions] = useState([]);
  
  // Detect if running on mobile
  const isMobile = useIsMobile();

  // Session Cache State
  const [sessionCacheStats, setSessionCacheStats] = useState({
    customers: 0,
    items: 0
  });
  const [refreshingSession, setRefreshingSession] = useState({
    customers: false,
    items: false
  });

  // Load progress for selected company
  const loadCompanyProgress = async () => {
    // Use ref to get current selected company to avoid stale closure
    const currentSelectedCompany = selectedCompanyRef.current;
    if (!currentSelectedCompany) {
      setDownloadProgress({ current: 0, total: 0, message: '' });
      setDownloadingComplete(false);
      return;
    }

    try {
      console.log('📊 Loading progress for company:', currentSelectedCompany.company);
      
      // Check if there's progress for this company (this will also check active sync)
      const companyProgress = await cacheSyncManager.getCompanyProgress(currentSelectedCompany);
      
      if (companyProgress) {
        console.log('📊 Found progress:', companyProgress);
        // Show progress for this company
        setDownloadProgress(companyProgress);
        setDownloadingComplete(true);
      } else {
        // No progress for this company
        console.log('📊 No progress found for company');
        setDownloadProgress({ current: 0, total: 0, message: '' });
        setDownloadingComplete(false);
      }
    } catch (error) {
      console.error('Error loading company progress:', error);
      setDownloadProgress({ current: 0, total: 0, message: '' });
      setDownloadingComplete(false);
    }
  };

  useEffect(() => {
    loadCacheStats();
    loadCurrentCompany();
    loadCacheExpiry();
    
    // Subscribe to shared sync progress
    const unsubscribe = cacheSyncManager.subscribe((progress) => {
      // Only update if this progress is for the currently selected company
      const currentCompanyInfo = cacheSyncManager.getCompanyInfo();
      if (currentCompanyInfo && selectedCompany && 
          currentCompanyInfo.guid === selectedCompany.guid) {
        setDownloadProgress(progress);
        setDownloadingComplete(cacheSyncManager.isSyncInProgress());
      } else {
        // Check if there's stored progress for selected company
        loadCompanyProgress();
      }
    });
    
    // Initialize state - check progress for selected company
    const initProgress = async () => {
      await loadCompanyProgress();
    };
    initProgress();
    
    // Listen for company changes from header
    const handleCompanyChange = () => {
      console.log('🔄 CacheManagement: Company changed event received');
      loadCurrentCompany();
      loadCacheStats();
      // Reload progress for new company
      setTimeout(() => {
        loadCompanyProgress();
      }, 100); // Small delay to ensure selectedCompany is updated
      // Reload cache entries if viewer is open
      if (showCacheViewerRef.current) {
        loadCacheEntries();
      }
    };
    
    window.addEventListener('companyChanged', handleCompanyChange);
    
    return () => {
      unsubscribe();
      window.removeEventListener('companyChanged', handleCompanyChange);
    };
  }, []);

  // Reload progress when selected company changes
  useEffect(() => {
    if (selectedCompany) {
      loadCompanyProgress();
      
      // Set up periodic polling for progress updates (every 2 seconds)
      // This ensures we show progress even when sync is happening in background
      const progressInterval = setInterval(async () => {
        await loadCompanyProgress();
      }, 2000);
      
      return () => {
        clearInterval(progressInterval);
      };
    } else {
      setDownloadProgress({ current: 0, total: 0, message: '' });
      setDownloadingComplete(false);
    }
  }, [selectedCompany]);

  const loadSessionCacheStats = () => {
    if (!selectedCompany) return;
    const { tallyloc_id, company } = selectedCompany;

    const customerKey = `ledgerlist-w-addrs_${tallyloc_id}_${company}`;
    const itemKey = `stockitems_${tallyloc_id}_${company}`;

    let customerCount = 0;
    let itemCount = 0;

    try {
      const customers = sessionStorage.getItem(customerKey);
      if (customers) customerCount = JSON.parse(customers).length;
    } catch (e) { }

    try {
      const items = sessionStorage.getItem(itemKey);
      if (items) itemCount = JSON.parse(items).length;
    } catch (e) { }

    setSessionCacheStats({ customers: customerCount, items: itemCount });
  };

  useEffect(() => {
    if (selectedCompany) {
      loadSessionCacheStats();
    } else {
      // Reset session cache stats when no company is selected
      setSessionCacheStats({ customers: 0, items: 0 });
    }
  }, [selectedCompany]);

  // Sync ref with showCacheViewer state
  useEffect(() => {
    showCacheViewerRef.current = showCacheViewer;
  }, [showCacheViewer]);

  const handleRefreshSessionCache = async (type) => {
    if (!selectedCompany) return;

    setRefreshingSession(prev => ({ ...prev, [type]: true }));
    setMessage({ type: '', text: '' });

    try {
      if (type === 'customers') {
        const result = await syncCustomers(selectedCompany);
        setMessage({ type: 'success', text: `Successfully refreshed ${result.count} customers!` });
      } else if (type === 'items') {
        const result = await syncItems(selectedCompany);
        setMessage({ type: 'success', text: `Successfully refreshed ${result.count} items!` });
      }
      loadSessionCacheStats();
    } catch (error) {
      console.error(`Error refreshing ${type}:`, error);
      setMessage({ type: 'error', text: `Failed to refresh ${type}: ${error.message}` });
    } finally {
      setRefreshingSession(prev => ({ ...prev, [type]: false }));
    }
  };

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
      showCacheViewerRef.current = true;
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

      // Clear session storage for items and customers
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('stockitems_') || key.startsWith('ledgerlist-w-addrs_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
      setSessionCacheStats({ customers: 0, items: 0 });

      // Note: We keep the keys directory as it contains user encryption keys
      // Clearing it would prevent decryption of any remaining cached data

      // Clear in-memory metadata cache to ensure listAllCacheEntries shows updated data
      await hybridCache.clearMetadataCache();

      setMessage({ type: 'success', text: 'All cache cleared successfully!' });
      
      // Reload cache entries if cache viewer is open
      if (showCacheViewer) {
        await loadCacheEntries();
      }
      
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

      // Clear session storage for this company
      if (selectedCompany) {
        const { tallyloc_id, company } = selectedCompany;
        sessionStorage.removeItem(`stockitems_${tallyloc_id}_${company}`);
        sessionStorage.removeItem(`ledgerlist-w-addrs_${tallyloc_id}_${company}`);
        setSessionCacheStats({ customers: 0, items: 0 });
      }

      // Clear in-memory metadata cache to ensure listAllCacheEntries shows updated data
      await hybridCache.clearMetadataCache();

      setMessage({ type: 'success', text: `Cache cleared successfully for ${selectedCompany.company}!` });
      
      // Reload cache entries if cache viewer is open
      if (showCacheViewer) {
        await loadCacheEntries();
      }
      
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

      // Clear in-memory metadata cache to ensure listAllCacheEntries shows updated data
      await hybridCache.clearMetadataCache();

      setMessage({ type: 'success', text: `Sales cache cleared successfully for ${selectedCompany.company}!` });
      
      // Reload cache entries if cache viewer is open
      if (showCacheViewer) {
        await loadCacheEntries();
      }
      
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

  // Generate Financial Year options
  useEffect(() => {
    const generateFYOptions = async () => {
      const today = new Date();
      const currentYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      const options = [];

      // Default: last 10 years
      let startYear = currentYear - 10;

      // Try to get booksfrom to limit the range
      const booksFromDate = await fetchBooksFrom();
      if (booksFromDate) {
        // booksFromDate is in YYYYMMDD format
        const bfYear = parseInt(booksFromDate.substring(0, 4));
        const bfMonth = parseInt(booksFromDate.substring(4, 6));
        // If booksfrom is after April, start from that FY
        startYear = bfMonth >= 4 ? bfYear : bfYear - 1;
      }

      for (let y = currentYear; y >= startYear; y--) {
        options.push(`${y}-${y + 1}`);
      }
      setFinancialYearOptions(options);
      if (options.length > 0 && !selectedFinancialYear) {
        setSelectedFinancialYear(options[0]);
      }
    };

    if (selectedCompany) {
      generateFYOptions();
    }
  }, [selectedCompany]);

  // Download complete sales data
  const downloadCompleteData = async (isUpdate = false) => {
    console.log('='.repeat(60));
    console.log('🎯 DOWNLOAD COMPLETE DATA CALLED');
    console.log('='.repeat(60));
    
    if (!selectedCompany) {
      console.error('❌ No company selected');
      setMessage({ type: 'error', text: 'No company selected' });
      return;
    }

    console.log('✅ Company selected:', selectedCompany);

    // Check if sync is already in progress for this company
    if (cacheSyncManager.isSyncInProgress() && cacheSyncManager.isSameCompany(selectedCompany)) {
      console.log('🔄 Sync already in progress for this company, showing existing progress');
      setMessage({ type: 'info', text: 'Sync already in progress. Progress will update automatically.' });
      // Progress will be updated via subscription
      return;
    }

    // Check network connectivity before starting
    if (!navigator.onLine) {
      console.error('❌ No internet connection (navigator.onLine = false)');
      setMessage({ type: 'error', text: 'No internet connection. Please check your network and try again.' });
      return;
    }

    console.log('✅ Network is online');

    // Check sessionStorage for required data
    const sessionData = {
      token: sessionStorage.getItem('token'),
      email: sessionStorage.getItem('email'),
      booksfrom: sessionStorage.getItem('booksfrom'),
      allConnections: sessionStorage.getItem('allConnections'),
      selectedCompanyGuid: sessionStorage.getItem('selectedCompanyGuid')
    };

    console.log('📦 SessionStorage check:', {
      hasToken: !!sessionData.token,
      tokenLength: sessionData.token?.length || 0,
      hasEmail: !!sessionData.email,
      email: sessionData.email,
      hasBooksfrom: !!sessionData.booksfrom,
      booksfrom: sessionData.booksfrom,
      hasAllConnections: !!sessionData.allConnections,
      connectionsCount: sessionData.allConnections ? JSON.parse(sessionData.allConnections).length : 0,
      hasSelectedGuid: !!sessionData.selectedCompanyGuid,
      selectedGuid: sessionData.selectedCompanyGuid
    });

    // Log network info for debugging
    console.log('📱 Network diagnostics:', {
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt,
        saveData: navigator.connection.saveData
      } : 'not available',
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      location: {
        href: window.location.href,
        origin: window.location.origin,
        protocol: window.location.protocol,
        hostname: window.location.hostname
      }
    });

    setMessage({ type: '', text: '' });

    console.log('🚀 Calling syncSalesData...');
    
    try {
      // syncSalesData will now use cacheSyncManager internally
      const result = await syncSalesData(selectedCompany);

      setMessage({
        type: 'success',
        text: `Successfully ${isUpdate ? 'updated' : 'downloaded'} ${result.count} vouchers! Last Alter ID: ${result.lastAlterId || 'N/A'}`
      });
      await loadCacheStats();

    } catch (error) {
      console.error('❌ Error downloading complete data:', error);
      
      // Provide more helpful error messages
      let errorMsg = error.message || 'Unknown error occurred';
      
      if (!navigator.onLine) {
        errorMsg = 'Lost internet connection during download. Please check your network and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMsg = 'Cannot reach the server. Please check if you have internet access and the server is available.';
      } else if (error.message.includes('timeout')) {
        errorMsg = 'Request timed out. Your connection might be too slow. Try using WiFi or reducing the data range.';
      } else if (error.message.includes('CORS')) {
        errorMsg = 'Security error (CORS). This usually means the server configuration needs updating.';
      } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMsg = 'Your session has expired. Please log in again.';
      } else if (error.message.includes('404')) {
        errorMsg = 'API endpoint not found. The server might be misconfigured.';
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        errorMsg = 'Server error. Please try again later or contact support.';
      }
      
      setMessage({ type: 'error', text: 'Failed to download data: ' + errorMsg });
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
      padding: isMobile ? '16px 12px' : '24px',
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
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '8px' : '12px',
          flexWrap: isMobile ? 'wrap' : 'nowrap'
        }}>
          <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '32px', color: '#3b82f6' }}>
            storage
          </span>
          Cache Management
        </h1>
        <p style={{
          fontSize: isMobile ? '14px' : '16px',
          color: '#64748b',
          marginTop: '8px',
          marginLeft: isMobile ? '0' : '44px'
        }}>
          Manage and clear cached data stored in OPFS (Origin Private File System)
        </p>
      </div>

      {/* Mobile Information Banner */}
      {isMobile && (
        <div style={{
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}>
          <span className="material-icons" style={{
            fontSize: '20px',
            color: '#2563eb',
            flexShrink: 0
          }}>
            phone_android
          </span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1e40af',
              marginBottom: '6px'
            }}>
              Mobile Device Detected
            </div>
            <div style={{
              fontSize: '12px',
              color: '#1e40af',
              lineHeight: '1.5'
            }}>
              Data downloads may take longer on mobile devices. Please ensure:
              <ul style={{ margin: '6px 0 0 18px', paddingLeft: 0, fontSize: '12px' }}>
                <li>You have a stable internet connection (WiFi recommended)</li>
                <li>Your device has sufficient storage space</li>
                <li>Keep this browser tab active during download</li>
                <li>If download fails, try downloading in smaller chunks by selecting a Financial Year</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Message Display */}
      {message.text && (
        <div style={{
          background: message.type === 'success' ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${message.type === 'success' ? '#6ee7b7' : '#fca5a5'}`,
          borderRadius: '12px',
          padding: isMobile ? '12px 16px' : '16px 20px',
          marginBottom: isMobile ? '16px' : '24px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '12px'
        }}>
          <span className="material-icons" style={{
            fontSize: isMobile ? '20px' : '24px',
            color: message.type === 'success' ? '#059669' : '#dc2626',
            flexShrink: 0
          }}>
            {message.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <div style={{
            fontSize: isMobile ? '13px' : '15px',
            fontWeight: 500,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            flex: 1,
            wordBreak: 'break-word'
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
          padding: isMobile ? '16px' : '20px',
          marginBottom: isMobile ? '16px' : '24px'
        }}>
          <h3 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 600,
            color: '#0369a1',
            marginBottom: isMobile ? '10px' : '12px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '6px' : '8px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px' }}>business</span>
            Current Company
          </h3>
          <div style={{ fontSize: isMobile ? '14px' : '15px', color: '#0c4a6e' }}>
            <strong>{selectedCompany.company}</strong>
            <div style={{ fontSize: isMobile ? '12px' : '13px', color: '#075985', marginTop: '4px', wordBreak: 'break-word' }}>
              ID: {selectedCompany.tallyloc_id} | GUID: {selectedCompany.guid.substring(0, 8)}...
            </div>
          </div>
        </div>
      )}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: isMobile ? '16px' : '24px', 
        marginBottom: isMobile ? '16px' : '24px' 
      }}>
        {/* Download Complete Sales Data */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '24px',
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
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Complete Sales Data
            </h3>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            marginBottom: isMobile ? '16px' : '20px',
            lineHeight: '1.6'
          }}>
            Download and cache complete sales data from the beginning of your books. Update to fetch only new records since last download.
          </p>

          {(downloadingComplete || downloadProgress.total > 0 || downloadProgress.message) && (
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
                {downloadProgress.message || 'Preparing sync...'}
              </div>
              {downloadProgress.total > 0 ? (
                <>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: '#e0f2fe',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min(100, (downloadProgress.current / downloadProgress.total) * 100)}%`,
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
                </>
              ) : (
                <div style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  Initializing...
                </div>
              )}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            flexDirection: 'column'
          }}>
            {/* Time Range Selection */}
            <div style={{ 
              marginBottom: '8px', 
              display: 'flex', 
              gap: isMobile ? '8px' : '12px', 
              flexWrap: 'wrap',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <div style={{ flex: isMobile ? '1 1 100%' : '1 1 200px', width: isMobile ? '100%' : 'auto' }}>
                <label style={{ display: 'block', fontSize: isMobile ? '13px' : '14px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: isMobile ? '12px' : '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: isMobile ? '15px' : '14px',
                    color: '#1e293b',
                    outline: 'none',
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc'
                  }}
                >
                  <option value="all">All Time (From Books Begin)</option>
                  <option value="1y">Last 1 Year</option>
                  <option value="2y">Last 2 Years</option>
                  <option value="5y">Last 5 Years</option>
                  <option value="10y">Last 10 Years</option>
                  <option value="fy">Specific Financial Year</option>
                </select>
              </div>

              {timeRange === 'fy' && (
                <div style={{ flex: isMobile ? '1 1 100%' : '1 1 200px', width: isMobile ? '100%' : 'auto' }}>
                  <label style={{ display: 'block', fontSize: isMobile ? '13px' : '14px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                    Financial Year
                  </label>
                  <select
                    value={selectedFinancialYear}
                    onChange={(e) => setSelectedFinancialYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: isMobile ? '12px' : '10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: isMobile ? '15px' : '14px',
                      color: '#1e293b',
                      outline: 'none',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    {financialYearOptions.map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              gap: isMobile ? '8px' : '12px', 
              flexWrap: 'wrap', 
              width: '100%',
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <button
                onClick={() => downloadCompleteData(false)}
                disabled={downloadingComplete || !selectedCompany}
                style={{
                  flex: isMobile ? '1 1 100%' : '1 1 calc(50% - 6px)',
                  minWidth: isMobile ? '100%' : '150px',
                  width: isMobile ? '100%' : 'auto',
                  padding: isMobile ? '14px 16px' : '12px 16px',
                  background: (downloadingComplete || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: isMobile ? '15px' : '14px',
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
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      refresh
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Downloading...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', flexShrink: 0 }}>
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
                  flex: isMobile ? '1 1 100%' : '1 1 calc(50% - 6px)',
                  minWidth: isMobile ? '100%' : '150px',
                  width: isMobile ? '100%' : 'auto',
                  padding: isMobile ? '14px 16px' : '12px 16px',
                  background: (downloadingComplete || !selectedCompany) ? '#94a3b8' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: isMobile ? '15px' : '14px',
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
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                      refresh
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Updating...</span>
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '18px', flexShrink: 0 }}>
                      update
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Update Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Session Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '12px' : '16px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '28px', color: '#10b981' }}>
              memory
            </span>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Session Cache
            </h3>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            marginBottom: isMobile ? '16px' : '20px',
            lineHeight: '1.6'
          }}>
            Manage temporary session cache for customers and items. This data is refreshed automatically every 30 minutes.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Customers */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Customers</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {sessionCacheStats.customers} cached
                </div>
              </div>
              <button
                onClick={() => handleRefreshSessionCache('customers')}
                disabled={refreshingSession.customers || !selectedCompany}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: (refreshingSession.customers || !selectedCompany) ? 'not-allowed' : 'pointer',
                  color: '#475569',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!refreshingSession.customers && selectedCompany) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!refreshingSession.customers && selectedCompany) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }
                }}
              >
                <span className="material-icons" style={{
                  fontSize: '16px',
                  animation: refreshingSession.customers ? 'spin 1s linear infinite' : 'none'
                }}>
                  refresh
                </span>
                Refresh
              </button>
            </div>

            {/* Items */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Items</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {sessionCacheStats.items} cached
                </div>
              </div>
              <button
                onClick={() => handleRefreshSessionCache('items')}
                disabled={refreshingSession.items || !selectedCompany}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: (refreshingSession.items || !selectedCompany) ? 'not-allowed' : 'pointer',
                  color: '#475569',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!refreshingSession.items && selectedCompany) {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!refreshingSession.items && selectedCompany) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }
                }}
              >
                <span className="material-icons" style={{
                  fontSize: '16px',
                  animation: refreshingSession.items ? 'spin 1s linear infinite' : 'none'
                }}>
                  refresh
                </span>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Cache Section */}
      <div style={{
        marginTop: '0',
        marginBottom: isMobile ? '20px' : '32px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? '16px' : '20px',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? '12px' : '0'
        }}>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: 600,
            color: '#1e293b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            flex: isMobile ? '1 1 100%' : 'auto'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>
              folder_open
            </span>
            View Cache Contents
          </h3>
          <button
            onClick={loadCacheEntries}
            disabled={loadingEntries}
            style={{
              padding: isMobile ? '10px 16px' : '10px 20px',
              width: isMobile ? '100%' : 'auto',
              background: loadingEntries ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: isMobile ? '14px' : '14px',
              cursor: loadingEntries ? 'not-allowed' : 'pointer',
              boxShadow: loadingEntries ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: isMobile ? '8px' : '12px',
              marginBottom: isMobile ? '16px' : '20px'
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
                maxHeight: isMobile ? '400px' : '600px',
                overflowY: 'auto',
                overflowX: isMobile ? 'auto' : 'hidden',
                WebkitOverflowScrolling: 'touch'
              }}>
                <div style={{
                  overflowX: 'auto',
                  width: '100%'
                }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: isMobile ? '12px' : '14px',
                  minWidth: isMobile ? '600px' : 'auto'
                }}>
                  <thead style={{
                    background: '#f8fafc',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <tr>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Type</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Cache Key</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Date Range</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Size</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Age</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
                    }}>Cached Date</th>
                    <th style={{
                      padding: isMobile ? '8px' : '12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#1e293b',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: isMobile ? '11px' : '14px'
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
                        <td style={{ padding: isMobile ? '8px' : '12px' }}>
                          <span style={{
                            padding: isMobile ? '3px 6px' : '4px 8px',
                            borderRadius: '4px',
                            fontSize: isMobile ? '10px' : '12px',
                            fontWeight: 600,
                            background: entry.type === 'sales' ? '#dbeafe' : '#dcfce7',
                            color: entry.type === 'sales' ? '#1e40af' : '#166534'
                          }}>
                            {entry.type === 'sales' ? 'Sales' : 'Dashboard'}
                          </span>
                        </td>
                        <td style={{
                          padding: isMobile ? '8px' : '12px',
                          fontFamily: 'monospace',
                          fontSize: isMobile ? '10px' : '12px',
                          color: '#475569',
                          wordBreak: 'break-all',
                          maxWidth: isMobile ? '200px' : '400px'
                        }}>
                          {entry.cacheKey}
                        </td>
                        <td style={{ padding: isMobile ? '8px' : '12px', color: '#64748b', fontSize: isMobile ? '11px' : '13px' }}>
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
                        <td style={{ padding: isMobile ? '8px' : '12px', color: '#1e293b', fontWeight: 500, fontSize: isMobile ? '11px' : '14px' }}>
                          {entry.sizeMB} MB
                          <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#94a3b8' }}>
                            ({entry.sizeKB} KB)
                          </div>
                        </td>
                        <td style={{ padding: isMobile ? '8px' : '12px', color: '#64748b', fontSize: isMobile ? '11px' : '14px' }}>
                          {entry.ageDays === 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>Today</span>
                          ) : entry.ageDays === 1 ? (
                            <span style={{ color: '#3b82f6' }}>1 day ago</span>
                          ) : (
                            <span>{entry.ageDays} days ago</span>
                          )}
                        </td>
                        <td style={{ padding: isMobile ? '8px' : '12px', color: '#64748b', fontSize: isMobile ? '11px' : '13px' }}>
                          {entry.date}
                        </td>
                        <td style={{ padding: isMobile ? '8px' : '12px' }}>
                          <button
                            onClick={() => viewCacheAsJson(entry.cacheKey)}
                            style={{
                              padding: isMobile ? '5px 8px' : '6px 12px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: isMobile ? '11px' : '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px' }}>code</span>
                            {isMobile ? 'JSON' : 'View JSON'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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
        padding: isMobile ? '16px' : '24px',
        marginBottom: isMobile ? '16px' : '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: isMobile ? '16px' : '20px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '6px' : '8px'
        }}>
          <span className="material-icons" style={{ fontSize: isMobile ? '18px' : '20px', color: '#3b82f6' }}>
            schedule
          </span>
          Cache Expiry Period
        </h2>
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          color: '#64748b',
          marginBottom: isMobile ? '12px' : '16px',
          lineHeight: '1.6'
        }}>
          Set how long cached data should be kept before automatically expiring. Set to "Never" to keep cache indefinitely.
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '12px' : '16px',
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row'
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
              padding: isMobile ? '12px' : '10px 16px',
              fontSize: isMobile ? '15px' : '15px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              background: '#fff',
              color: '#1e293b',
              cursor: savingExpiry ? 'not-allowed' : 'pointer',
              minWidth: isMobile ? '100%' : '200px',
              width: isMobile ? '100%' : 'auto',
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
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            fontStyle: 'italic',
            width: isMobile ? '100%' : 'auto',
            textAlign: isMobile ? 'center' : 'left'
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
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: isMobile ? '16px' : '20px'
      }}>
        {/* Clear All Cache */}
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '12px' : '16px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '28px', color: '#dc2626' }}>
              delete_sweep
            </span>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear All Cache
            </h3>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            marginBottom: isMobile ? '16px' : '20px',
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
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '12px' : '16px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '28px', color: '#f59e0b' }}>
              business_center
            </span>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Company Cache
            </h3>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            marginBottom: isMobile ? '16px' : '20px',
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


        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '8px' : '12px',
            marginBottom: isMobile ? '12px' : '16px'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? '24px' : '28px', color: '#3b82f6' }}>
              analytics
            </span>
            <h3 style={{
              fontSize: isMobile ? '16px' : '18px',
              fontWeight: 600,
              color: '#1e293b',
              margin: 0
            }}>
              Clear Sales Cache
            </h3>
          </div>
          <p style={{
            fontSize: isMobile ? '13px' : '14px',
            color: '#64748b',
            marginBottom: isMobile ? '16px' : '20px',
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
            padding: isMobile ? '16px' : '24px',
            maxWidth: '90%',
            maxHeight: '90%',
            width: isMobile ? '95%' : '800px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isMobile ? '16px' : '20px'
            }}>
              <h3 style={{
                fontSize: isMobile ? '18px' : '20px',
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
              padding: isMobile ? '12px' : '16px',
              fontFamily: 'monospace',
              fontSize: isMobile ? '11px' : '12px',
              WebkitOverflowScrolling: 'touch'
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

