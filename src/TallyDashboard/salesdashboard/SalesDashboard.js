import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
// import { apiPost } from '../../utils/apiUtils'; // REMOVED: Sales dashboard now uses cache only
import BarChart from './components/BarChart';
import PieChart from './components/PieChart';
import TreeMap from './components/TreeMap';
import LineChart from './components/LineChart';
import ChatBot from './components/ChatBot';
import { getUserModules, hasPermission } from '../../config/SideBarConfigurations';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip as RechartsTooltip,
} from 'recharts';
import BillDrilldownModal from '../../RecvDashboard/components/BillDrilldownModal';
import VoucherDetailsModal from '../../RecvDashboard/components/VoucherDetailsModal';
import {
  escapeForXML,
  cleanAndEscapeForXML,
  parseXMLResponse,
} from '../../RecvDashboard/utils/helpers';
import { getApiUrl } from '../../config';
import { getCompanyConfigValue, clearCompanyConfigCache } from '../../utils/companyConfigUtils';
import { hybridCache, DateRangeUtils } from '../../utils/hybridCache';
import { syncSalesData } from '../utils/dataSync';

const SalesDashboard = ({ onNavigationAttempt }) => {
  const RAW_DATA_PAGE_SIZE = 20;

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // API data state
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noCompanySelected, setNoCompanySelected] = useState(false);
  
  // Progress bar state
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  
  // Navigation warning modal state
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const abortLoadingRef = useRef(false);

  // Form state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedItem, setSelectedItem] = useState('all');
  const [selectedStockGroup, setSelectedStockGroup] = useState('all');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(null); // Format: "YYYY-MM"
  const [selectedLedgerGroup, setSelectedLedgerGroup] = useState('all');
  // Generic filter state for custom card fields that aren't explicitly mapped
  const [genericFilters, setGenericFilters] = useState(() => {
    try {
      const stored = sessionStorage.getItem('customCardGenericFilters');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [categoryChartType, setCategoryChartType] = useState('bar');
  const [ledgerGroupChartType, setLedgerGroupChartType] = useState('bar');
  const [regionChartType, setRegionChartType] = useState('bar');
  const [countryChartType, setCountryChartType] = useState('bar');
  const [periodChartType, setPeriodChartType] = useState('bar');
  const [topCustomersChartType, setTopCustomersChartType] = useState('bar');
  const [topItemsByRevenueChartType, setTopItemsByRevenueChartType] = useState('bar');
  const [topItemsByQuantityChartType, setTopItemsByQuantityChartType] = useState('bar');
  const [topCustomersN, setTopCustomersN] = useState(10);
  const [topItemsByRevenueN, setTopItemsByRevenueN] = useState(10);
  const [topItemsByQuantityN, setTopItemsByQuantityN] = useState(10);
  const [revenueVsProfitChartType, setRevenueVsProfitChartType] = useState('bar');
  const [topProfitableItemsChartType, setTopProfitableItemsChartType] = useState('bar');
  const [topLossItemsChartType, setTopLossItemsChartType] = useState('bar');
  const [monthWiseProfitChartType, setMonthWiseProfitChartType] = useState('line');
  const [selectedSalesperson, setSelectedSalesperson] = useState(null);
  const [enabledSalespersons, setEnabledSalespersons] = useState(new Set());
  const [showSalespersonConfig, setShowSalespersonConfig] = useState(false);
  const salespersonsInitializedRef = useRef(false);
  const [salespersonFormula, setSalespersonFormula] = useState(''); // Formula from company configuration
  const requestTimestampRef = useRef(Date.now());

  // Note: apiCache removed - using hybridCache (OPFS-only) instead
  const [shouldAutoLoad, setShouldAutoLoad] = useState(false);
  const loadSalesRef = useRef(null);
  const [rawDataModal, setRawDataModal] = useState({ open: false, title: '', rows: [], columns: [] });
  const [rawDataSearch, setRawDataSearch] = useState('');
  const [rawDataPage, setRawDataPage] = useState(1);
  
  // Bill drilldown modal state
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Voucher details modal state
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [voucherDetailsData, setVoucherDetailsData] = useState(null);
  const [voucherDetailsLoading, setVoucherDetailsLoading] = useState(false);
  const [voucherDetailsError, setVoucherDetailsError] = useState(null);

  // Custom cards state
  const [customCards, setCustomCards] = useState([]);
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [customCardChartTypes, setCustomCardChartTypes] = useState({});
  const customCardsSectionRef = useRef(null);

  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [booksFromDate, setBooksFromDate] = useState('');

  // Download dropdown state
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const downloadDropdownRef = useRef(null);

  // Background cache download state
  const [isDownloadingCache, setIsDownloadingCache] = useState(false);
  const [cacheDownloadProgress, setCacheDownloadProgress] = useState({ current: 0, total: 0, message: '' });
  const cacheDownloadAbortRef = useRef(false);

  // Helper function to get auth token
  const getAuthToken = () => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }
    return token;
  };

  // Helper function to get Tally data URL
  const getTallyDataUrl = () => {
    return `${getApiUrl('/api/tally/tallydata')}?ts=${Date.now()}`;
  };

  // Helper function to parse XML
  const parseXml = (xmlText) => {
    try {
      return parseXMLResponse(xmlText);
    } catch (err) {
      throw new Error(`Failed to parse XML response: ${err.message}`);
    }
  };

  const computeShowProfitPermission = useCallback(() => {
    try {
      const modules = getUserModules();
      return hasPermission('sales_dashboard', 'show_profit', modules);
    } catch (err) {
      console.warn('⚠️ Unable to evaluate show_profit permission:', err);
      return false;
    }
  }, []);

  const [canShowProfit, setCanShowProfit] = useState(() => computeShowProfitPermission());

  useEffect(() => {
    setCanShowProfit(computeShowProfitPermission());
  }, [computeShowProfitPermission]);

  useEffect(() => {
    const handleAccessUpdate = () => {
      setCanShowProfit(computeShowProfitPermission());
    };

    window.addEventListener('userAccessUpdated', handleAccessUpdate);
    window.addEventListener('companyChanged', handleAccessUpdate);

    return () => {
      window.removeEventListener('userAccessUpdated', handleAccessUpdate);
      window.removeEventListener('companyChanged', handleAccessUpdate);
    };
  }, [computeShowProfitPermission]);

  // Expose loading state to parent component
  useEffect(() => {
    if (onNavigationAttempt) {
      window.salesDashboardLoading = loading;
      window.salesDashboardShowWarning = () => {
        setShowNavigationWarning(true);
      };
    }
    return () => {
      if (!loading) {
        window.salesDashboardLoading = false;
      }
    };
  }, [loading, onNavigationAttempt]);

  // Get booksFrom date from company info (updated when company changes)
  useEffect(() => {
    const loadBooksFromDate = async () => {
      try {
        const companyInfo = getCompanyInfo();
        const booksFrom = await fetchBooksFromDate(companyInfo.guid);
        if (booksFrom) {
          setBooksFromDate(booksFrom);
        }
      } catch (err) {
        console.warn('Unable to get booksFrom date:', err);
      }
    };
    
    loadBooksFromDate();
    
    // Also reload when company changes
    const handleCompanyChange = () => {
      loadBooksFromDate();
    };
    
    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  // Close download dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target)) {
        setShowDownloadDropdown(false);
      }
    };

    if (showDownloadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadDropdown]);

  // Cleanup on component unmount - DO NOT abort cache download
  useEffect(() => {
    return () => {
      // Note: We intentionally DO NOT abort cache download on unmount
      // Cache download continues in background even when user switches tabs
      console.log('📋 Sales Dashboard unmounting - cache download continues in background');
    };
  }, []);

  // Helper functions
  const getCompanyInfo = () => {
    // Get all companies from sessionStorage
    const companies = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    console.log('📋 Available companies:', companies);
    
    // Get current company from sessionStorage
    const currentCompany = sessionStorage.getItem('selectedCompanyGuid') || '';
    console.log('🎯 Selected company GUID:', currentCompany);
    
    // Find the current company object
    const currentCompanyObj = companies.find(c => c.guid === currentCompany);
    console.log('🏢 Current company object:', currentCompanyObj);
    
    if (!currentCompanyObj) {
      const errorMsg = 'No company selected. Please select a company first.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }
    
    const { tallyloc_id, company, guid } = currentCompanyObj;
    
    const companyInfo = {
      tallyloc_id,
      company: company, // Company name as string
      guid
    };
    
    console.log('✅ Company info for API:', companyInfo);
    return companyInfo;
  };

  const formatDateForAPI = (dateString) => {
    // Convert YYYY-MM-DD to YYYYMMDD
    return dateString.replace(/-/g, '');
  };

  const parseDateFromAPI = (dateString) => {
    // Convert YYYYMMDD to YYYY-MM-DD
    return `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6, 8)}`;
  };

  const parseDateFromNewFormat = (dateString) => {
    // Parse dates from format like "1-Jun-25" to "2025-06-01"
    if (!dateString) return null;
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // If in YYYYMMDD format, use existing parser
    if (/^\d{8}$/.test(dateString)) {
      return parseDateFromAPI(dateString);
    }
    
    try {
      // Parse format like "1-Jun-25" or "15-Jul-25"
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
        if (monthIndex === -1) {
          console.warn('Unknown month in date:', dateString);
          return null;
        }
        const year = parseInt(parts[2], 10);
        // Assume years < 50 are 20XX, >= 50 are 19XX
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        
        const month = String(monthIndex + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        
        return `${fullYear}-${month}-${dayStr}`;
      }
    } catch (error) {
      console.warn('Error parsing date:', dateString, error);
    }
    
    return null;
  };

  // Helper function to fetch booksfrom date
  const fetchBooksFromDate = async (companyGuid) => {
    try {
      // First check sessionStorage
      const booksfromDirect = sessionStorage.getItem('booksfrom');
      if (booksfromDirect) {
        // Handle YYYYMMDD format
        if (/^\d{8}$/.test(booksfromDirect)) {
          return parseDateFromAPI(booksfromDirect);
        }
        // Handle other formats
        const parsed = parseDateFromNewFormat(booksfromDirect);
        if (parsed) return parsed;
      }

      // Check allConnections in sessionStorage
      const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      if (companyGuid && Array.isArray(connections)) {
        const company = connections.find(c => c.guid === companyGuid);
        if (company && company.booksfrom) {
          // Handle YYYYMMDD format
          if (/^\d{8}$/.test(company.booksfrom)) {
            return parseDateFromAPI(company.booksfrom);
          }
          // Handle other formats
          const parsed = parseDateFromNewFormat(company.booksfrom);
          if (parsed) return parsed;
        }
      }
    } catch (err) {
      console.warn('Error fetching booksfrom date:', err);
    }
    return null;
  };

  const getDefaultDateRange = useCallback(async (companyGuid = null) => {
    const now = new Date();
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    // Try to get booksfrom date
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to start of month
    
    if (companyGuid) {
      const booksFrom = await fetchBooksFromDate(companyGuid);
      if (booksFrom) {
        const booksFromDate = new Date(booksFrom);
        if (!isNaN(booksFromDate.getTime())) {
          startDate = booksFromDate;
        }
      }
    }
    
    return {
      start: formatDate(startDate),
      end: formatDate(now)
    };
  }, []);

  const initializeDashboard = useCallback(async (options = { triggerFetch: false }) => {
    try {
      // Abort any ongoing cache download when switching companies
      if (isDownloadingCache) {
        console.log('⚠️ Aborting previous cache download due to company change');
        cacheDownloadAbortRef.current = true;
        // Wait a bit for abort to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const companyInfo = getCompanyInfo();
      setNoCompanySelected(false);
      setError(null);

      // Check if sales cache exists
      let hasCachedSalesData = false;
      try {
        const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
        if (completeCache && completeCache.data && completeCache.data.vouchers && completeCache.data.vouchers.length > 0) {
          hasCachedSalesData = true;
          console.log('✅ Sales cache found');
        }
      } catch (err) {
        console.warn('Unable to check sales cache:', err);
      }

      // Set default dates using booksfrom date
      const defaults = await getDefaultDateRange(companyInfo.guid);
      console.log('📅 Setting default date range:', defaults);
      setFromDate(defaults.start);
      setToDate(defaults.end);
      setDateRange(defaults);
      
      // Also update booksFromDate state for calendar modal
      const booksFrom = await fetchBooksFromDate(companyInfo.guid);
      if (booksFrom) {
        setBooksFromDate(booksFrom);
      }
      setSales([]);
      setSelectedCustomer('all');
      setSelectedItem('all');
      setSelectedStockGroup('all');
      setSelectedRegion('all');
      setSelectedCountry('all');
      setSelectedPeriod(null);
      
      // Check if cache exists and start background download accordingly
      if (!hasCachedSalesData) {
        console.log('📭 No sales cache found - starting background download from books begin date');
        // Start background download for first time (complete data)
        startBackgroundCacheDownload(companyInfo, false);
      } else if (hasCachedSalesData) {
        // Auto-load data from cache when tab opens
        console.log('🚀 Loading data from cache and checking for updates in background...');
        console.log('📅 Auto-load will use dates:', defaults);
        // Use setTimeout to ensure dates are set in state before triggering auto-load
        setTimeout(() => {
          console.log('✅ Triggering auto-load with dates:', defaults);
          setShouldAutoLoad(true);
        }, 100);
        // Start background update to fetch only new records
        startBackgroundCacheDownload(companyInfo, true);
      }
    } catch (err) {
      console.warn('⚠️ Sales dashboard initialization error:', err);
      setNoCompanySelected(true);
      setError('Please select a company from the top navigation before loading sales data.');
    }
  }, [getDefaultDateRange, isDownloadingCache]);

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

  // Removed fetchSalesDataWithProgress - no longer needed since we use cache-only mode
  // and fetch the entire date range at once from complete cache

  // Update elapsed time while loading
  useEffect(() => {
    let interval = null;
    if (loading && loadingStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, loadingStartTime]);

  const fetchSalesData = async (startDate, endDate) => {
    const companyInfo = getCompanyInfo();
    
    // First, check for complete cached data - if exists, use it and don't call API
    try {
      const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
      if (completeCache && completeCache.data && completeCache.data.vouchers) {
        console.log(`📋 Using complete cached data (${completeCache.data.vouchers.length} total vouchers), filtering for date range ${startDate} to ${endDate}`);
        
        // Filter vouchers by date range
        const filteredVouchers = completeCache.data.vouchers.filter(voucher => {
          const voucherDate = voucher.cp_date || voucher.date || voucher.DATE || voucher.CP_DATE;
          if (!voucherDate) return false;
          
          // Parse date - handle different formats using existing helper function
          let dateStr = parseDateFromNewFormat(voucherDate);
          if (!dateStr && typeof voucherDate === 'string') {
            // Try parsing YYYYMMDD format
            if (/^\d{8}$/.test(voucherDate)) {
              dateStr = parseDateFromAPI(voucherDate);
            } else {
              // Try direct parsing
              dateStr = voucherDate;
            }
          }
          
          if (!dateStr) return false;
          
          // Ensure dateStr is in YYYY-MM-DD format for comparison
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return false;
          }
          
          return dateStr >= startDate && dateStr <= endDate;
        });
        
        console.log(`✅ Filtered ${filteredVouchers.length} vouchers from complete cache for date range ${startDate} to ${endDate}`);
        
        // Return filtered data from cache - don't proceed to API calls
        return {
          ...completeCache.data,
          vouchers: filteredVouchers
        };
      } else {
        console.log('📋 No complete cached data found, will check date-range cache');
      }
    } catch (error) {
      console.warn('⚠️ Error checking complete cache:', error);
      // Continue to check other cache if complete cache check fails
    }
    
    // Include salesperson formula in cache key so cache invalidates when formula changes
    const formulaHash = salespersonFormula ? btoa(salespersonFormula).substring(0, 10) : 'noformula';
    const baseKey = `${companyInfo.tallyloc_id}_${companyInfo.guid}_${requestTimestampRef.current}_${formulaHash}`;
    const cacheKey = `${baseKey}_${startDate}_${endDate}`;
    
    // Check for exact cache match
    try {
      const cachedData = await hybridCache.getSalesData(cacheKey); // Uses configured expiry
      if (cachedData) {
        console.log(`📋 Using exact cached data for ${startDate} to ${endDate}`);
        return cachedData;
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    
    // Check for overlapping cached date ranges
    try {
      const cachedRanges = await hybridCache.findCachedDateRanges(baseKey, startDate, endDate);
      
      if (cachedRanges.length > 0) {
        console.log(`🔍 Found ${cachedRanges.length} overlapping cached date range(s)`);
        
        // Calculate gaps (missing date ranges)
        const requestRange = { startDate, endDate };
        const { cached, gaps } = DateRangeUtils.splitDateRangeIntoGaps(requestRange, cachedRanges);
        
        if (gaps.length === 0) {
          // All data is cached, merge and return
          console.log(`✅ All data is cached, merging ${cached.length} cached range(s)`);
          return mergeCachedData(cached);
        }
        
        // Some data is missing, but we're not calling API - use only cached data
        console.log(`📊 Partial cache: ${cached.length} cached range(s), ${gaps.length} gap(s) missing (not fetching from API)`);
        console.log(`⚠️ Missing gaps: ${gaps.map(g => `${g.startDate} to ${g.endDate}`).join(', ')}`);
        
        // Return only cached data without fetching gaps
        const merged = mergeCachedData(cached);
        console.log(`✅ Returning ${merged.vouchers?.length || 0} vouchers from cached ranges only`);
        return merged;
      }
    } catch (error) {
      console.warn('Error checking for overlapping cache:', error);
    }
    
    // Check once more if complete cache exists (in case it was added while we were checking)
    const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
    if (completeCache && completeCache.data && completeCache.data.vouchers) {
      console.log(`📋 Complete cache found during final check, using it instead of API`);
      
      // Filter vouchers by date range
      const filteredVouchers = completeCache.data.vouchers.filter(voucher => {
        const voucherDate = voucher.cp_date || voucher.date || voucher.DATE || voucher.CP_DATE;
        if (!voucherDate) return false;
        
        let dateStr = parseDateFromNewFormat(voucherDate);
        if (!dateStr && typeof voucherDate === 'string') {
          if (/^\d{8}$/.test(voucherDate)) {
            dateStr = parseDateFromAPI(voucherDate);
          } else {
            dateStr = voucherDate;
          }
        }
        
        if (!dateStr) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return false;
        }
        
        return dateStr >= startDate && dateStr <= endDate;
      });
      
      return {
        ...completeCache.data,
        vouchers: filteredVouchers
      };
    }
    
    console.log(`⚠️ No cache found for ${startDate} to ${endDate}. Complete cache not available.`);
    console.log(`⚠️ Skipping API call as requested - please download complete data first from Cache Management.`);
    
    // Return empty data instead of calling API
    return { vouchers: [] };
  };

  // REMOVED: fetchSalesDataFromAPI - Sales dashboard now uses cache only
  // All data must be loaded from cache. Use Cache Management to download complete sales data.
  // const fetchSalesDataFromAPI = async (companyInfo, startDate, endDate) => {
  //   // This function has been removed - sales dashboard uses cache only
  //   // To get data, download complete sales data from Cache Management
  //   throw new Error('API calls are disabled. Please use cached data from Cache Management.');
  // };

  // Helper function to merge cached data from multiple date ranges
  const mergeCachedData = (ranges) => {
    if (ranges.length === 0) {
      return { vouchers: [] };
    }
    
    // Combine all vouchers
    const allVouchers = [];
    const voucherIds = new Set(); // To track duplicates
    
    for (const range of ranges) {
      if (range.data?.vouchers && Array.isArray(range.data.vouchers)) {
        for (const voucher of range.data.vouchers) {
          // Try to identify unique vouchers (use voucher number or ID if available)
          const voucherId = voucher.voucher_number || voucher.voucherNumber || voucher.id || 
                           `${voucher.cp_date || voucher.date}_${voucher.customer}_${voucher.amount}`;
          
          if (!voucherIds.has(voucherId)) {
            voucherIds.add(voucherId);
            allVouchers.push(voucher);
          }
        }
      }
    }
    
    // Return merged data structure
    return {
      vouchers: allVouchers,
      ...(ranges[0].data ? Object.keys(ranges[0].data).filter(k => k !== 'vouchers').reduce((acc, key) => {
        acc[key] = ranges[0].data[key];
        return acc;
      }, {}) : {})
    };
  };

  // Fetch company configuration for sales person formula
  useEffect(() => {
    const loadCompanyConfig = async () => {
      try {
        const companyInfo = getCompanyInfo();
        if (!companyInfo || !companyInfo.tallyloc_id || !companyInfo.guid) {
          setSalespersonFormula('');
          return;
        }

        try {
          const formula = await getCompanyConfigValue('salesdash_salesprsn', companyInfo.tallyloc_id, companyInfo.guid);
          setSalespersonFormula(formula || '');
          console.log('✅ Sales Dashboard - Loaded sales person formula from config:', formula);
        } catch (error) {
          console.error('Error loading company config for sales dashboard:', error);
          setSalespersonFormula('');
        }
      } catch (error) {
        // getCompanyInfo might throw if no company selected - that's okay
        setSalespersonFormula('');
      }
    };

    loadCompanyConfig();

    // Also reload when company changes
    const handleCompanyChange = () => {
      loadCompanyConfig();
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange);
    };
  }, []); // Run once on mount and when company changes via event

  // Track previous formula to detect changes
  const prevFormulaRef = useRef('');
  
  // Refresh data when salesperson formula changes (but not on initial load)
  useEffect(() => {
    // Only refresh if formula actually changed (not just initial load)
    if (salespersonFormula !== prevFormulaRef.current && prevFormulaRef.current !== '') {
      console.log('🔄 Salesperson formula changed. Please click Submit to refresh data with new formula.', {
        old: prevFormulaRef.current,
        new: salespersonFormula
      });
      // Note: Cache will be invalidated by requestTimestampRef update when user clicks Submit
      // Don't auto-fetch - user must click Submit button to refresh data
    }
    prevFormulaRef.current = salespersonFormula;
  }, [salespersonFormula]);

  // Set default date range on component mount
  useEffect(() => {
    initializeDashboard({ triggerFetch: false });

    const handleCompanyChange = () => {
      initializeDashboard({ triggerFetch: false });
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [initializeDashboard]);

  // Auto-update cache every 30 minutes in the background
  useEffect(() => {
    const autoUpdateInterval = setInterval(async () => {
      try {
        const companyInfo = getCompanyInfo();
        // Check if cache exists
        const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
        if (completeCache && completeCache.data && completeCache.data.vouchers && completeCache.data.vouchers.length > 0) {
          console.log('⏰ Auto-update: Checking for new sales data...');
          // Only start update if not already downloading
          if (!isDownloadingCache) {
            startBackgroundCacheDownload(companyInfo, true);
          }
        }
      } catch (err) {
        console.warn('⚠️ Auto-update check failed:', err);
      }
    }, 30 * 60 * 1000); // 30 minutes in milliseconds

    return () => clearInterval(autoUpdateInterval);
  }, [isDownloadingCache]);

  // Filter sales data based on selected filters (excluding issales filter)
  const filteredSales = useMemo(() => {
    console.log('🔍 Filtering sales data...', {
      totalSales: sales.length,
      dateRange,
      selectedCustomer,
      selectedItem,
      selectedLedgerGroup,
      selectedRegion,
      selectedCountry,
      selectedPeriod,
      selectedSalesperson,
      enabledSalespersonsSize: enabledSalespersons.size,
      salespersonsInitialized: salespersonsInitializedRef.current
    });
    
    let filtered = sales.filter((sale) => {
      const dateMatch =
        (!dateRange.start || sale.date >= dateRange.start) &&
        (!dateRange.end || sale.date <= dateRange.end);
      const customerMatch = selectedCustomer === 'all' || (sale.customer && String(sale.customer).trim().toLowerCase() === String(selectedCustomer).trim().toLowerCase());
      const itemMatch = selectedItem === 'all' || (sale.item && String(sale.item).trim().toLowerCase() === String(selectedItem).trim().toLowerCase());
      const stockGroupMatch = selectedStockGroup === 'all' || (sale.category && String(sale.category).trim().toLowerCase() === String(selectedStockGroup).trim().toLowerCase());
      const ledgerGroupMatch = selectedLedgerGroup === 'all' || (sale.ledgerGroup && String(sale.ledgerGroup).trim().toLowerCase() === String(selectedLedgerGroup).trim().toLowerCase());
      const regionMatch = selectedRegion === 'all' || (sale.region && String(sale.region).trim().toLowerCase() === String(selectedRegion).trim().toLowerCase());
      const countryMatch = selectedCountry === 'all' || (sale.country && String(sale.country).trim().toLowerCase() === String(selectedCountry).trim().toLowerCase());
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      // Filter by selected salesperson if one is selected
      const salespersonMatch = !selectedSalesperson || (sale.salesperson || 'Unassigned') === selectedSalesperson;
      
      // Apply generic filters from custom cards
      let genericFiltersMatch = true;
      if (genericFilters && Object.keys(genericFilters).length > 0) {
        for (const [filterKey, filterValue] of Object.entries(genericFilters)) {
          if (filterValue && filterValue !== 'all' && filterValue !== '') {
            // Extract cardId and fieldName from filterKey (format: "cardId_fieldName")
            const [cardId, ...fieldParts] = filterKey.split('_');
            const fieldName = fieldParts.join('_'); // Rejoin in case fieldName contains underscores
            
            // Find the card to get its groupBy field
            const card = customCards.find(c => c.id === cardId);
            if (card && card.groupBy === fieldName) {
              // Use getFieldValue helper to get the field value (case-insensitive)
              const saleFieldValue = sale[fieldName] || 
                                    sale[fieldName.toLowerCase()] ||
                                    sale[fieldName.toUpperCase()] ||
                                    (Object.keys(sale).find(k => k.toLowerCase() === fieldName.toLowerCase()) ? sale[Object.keys(sale).find(k => k.toLowerCase() === fieldName.toLowerCase())] : null);
              
              // Handle special cases
              if (fieldName === 'date' && card.dateGrouping) {
                const saleDate = sale.cp_date || sale.date;
                const date = new Date(saleDate);
                let groupKey = '';
                if (card.dateGrouping === 'day') {
                  groupKey = saleDate;
                } else if (card.dateGrouping === 'week') {
                  const weekStart = new Date(date);
                  weekStart.setDate(date.getDate() - date.getDay());
                  groupKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
                } else if (card.dateGrouping === 'month') {
                  groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                } else if (card.dateGrouping === 'year') {
                  groupKey = String(date.getFullYear());
                }
                if (groupKey !== filterValue) {
                  genericFiltersMatch = false;
                  break;
                }
              } else if (fieldName === 'profit_margin') {
                const amount = parseFloat(sale.amount || 0);
                const profit = parseFloat(sale.profit || 0);
                const margin = amount > 0 ? ((profit / amount) * 100).toFixed(0) : '0';
                if (`${margin}%` !== filterValue) {
                  genericFiltersMatch = false;
                  break;
                }
              } else if (fieldName === 'order_value') {
                const value = parseFloat(sale.amount || 0);
                let range = '';
                if (value < 1000) range = '< ₹1K';
                else if (value < 5000) range = '₹1K - ₹5K';
                else if (value < 10000) range = '₹5K - ₹10K';
                else if (value < 50000) range = '₹10K - ₹50K';
                else range = '> ₹50K';
                if (range !== filterValue) {
                  genericFiltersMatch = false;
                  break;
                }
              } else {
                // Generic field matching
                if (saleFieldValue !== filterValue) {
                  genericFiltersMatch = false;
                  break;
                }
              }
            }
          }
        }
      }
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && ledgerGroupMatch && regionMatch && countryMatch && periodMatch && salespersonMatch && genericFiltersMatch;
    });
    
    // Apply enabledSalespersons filter (from configure salespersons)
    // If size === 0 and initialization hasn't happened yet, show all (for initial load)
    // If size === 0 after initialization, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0) {
      filtered = filtered.filter((sale) => {
        const salespersonName = sale.salesperson || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonsInitializedRef.current) {
      // None selected after initialization - show nothing
      filtered = [];
    }
    // If size === 0 and not initialized yet, show all (filtered = filtered, no change)
    
    console.log('✅ Filtered sales result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      selectedSalesperson,
      enabledSalespersonsSize: enabledSalespersons.size,
      salespersonsInitialized: salespersonsInitializedRef.current,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedLedgerGroup, selectedRegion, selectedCountry, selectedPeriod, selectedSalesperson, enabledSalespersons, genericFilters, customCards]);

  // Filter sales data specifically for Total Orders (with issales filter)
  const filteredSalesForOrders = useMemo(() => {
    console.log('🔍 Filtering sales data for orders...', {
      totalSales: sales.length,
      dateRange,
      selectedCustomer,
      selectedItem,
      selectedPeriod,
      selectedSalesperson,
      enabledSalespersonsSize: enabledSalespersons.size,
      salespersonsInitialized: salespersonsInitializedRef.current
    });
    
    let filtered = sales.filter((sale) => {
      const dateMatch =
        (!dateRange.start || sale.date >= dateRange.start) &&
        (!dateRange.end || sale.date <= dateRange.end);
      const customerMatch = selectedCustomer === 'all' || (sale.customer && String(sale.customer).trim().toLowerCase() === String(selectedCustomer).trim().toLowerCase());
      const itemMatch = selectedItem === 'all' || (sale.item && String(sale.item).trim().toLowerCase() === String(selectedItem).trim().toLowerCase());
      const stockGroupMatch = selectedStockGroup === 'all' || (sale.category && String(sale.category).trim().toLowerCase() === String(selectedStockGroup).trim().toLowerCase());
      const ledgerGroupMatch = selectedLedgerGroup === 'all' || (sale.ledgerGroup && String(sale.ledgerGroup).trim().toLowerCase() === String(selectedLedgerGroup).trim().toLowerCase());
      const regionMatch = selectedRegion === 'all' || (sale.region && String(sale.region).trim().toLowerCase() === String(selectedRegion).trim().toLowerCase());
      const countryMatch = selectedCountry === 'all' || (sale.country && String(sale.country).trim().toLowerCase() === String(selectedCountry).trim().toLowerCase());
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      const isSalesMatch = sale.issales === true || sale.issales === 1 || sale.issales === '1' || sale.issales === 'Yes' || sale.issales === 'yes';
      // Filter by selected salesperson if one is selected
      const salespersonMatch = !selectedSalesperson || (sale.salesperson || 'Unassigned') === selectedSalesperson;
      
      if (!isSalesMatch) {
        console.log('❌ Filtered out for orders - not a sale:', { issales: sale.issales, sale });
      }
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && ledgerGroupMatch && regionMatch && countryMatch && periodMatch && isSalesMatch && salespersonMatch;
    });
    
    // Apply enabledSalespersons filter (from configure salespersons)
    // If size === 0 and initialization hasn't happened yet, show all (for initial load)
    // If size === 0 after initialization, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0) {
      filtered = filtered.filter((sale) => {
        const salespersonName = sale.salesperson || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonsInitializedRef.current) {
      // None selected after initialization - show nothing
      filtered = [];
    }
    // If size === 0 and not initialized yet, show all (filtered = filtered, no change)
    
    console.log('✅ Filtered sales for orders result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      selectedSalesperson,
      enabledSalespersonsSize: enabledSalespersons.size,
      salespersonsInitialized: salespersonsInitializedRef.current,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedLedgerGroup, selectedRegion, selectedCountry, selectedPeriod, selectedSalesperson, enabledSalespersons]);

  // NOTE: Sales dashboard now uses CACHE ONLY - no API calls
  // All data must be loaded from cache. Use Cache Management to download complete sales data.
  // After loading from cache, all chart data and raw data is derived from the 'sales' state
  // NO API calls are made - all data comes from cache
  const loadSales = async (startDate, endDate, { invalidateCache = false } = {}) => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    let companyInfo;
    try {
      companyInfo = getCompanyInfo();
      setNoCompanySelected(false);
    setError(null);
    } catch (err) {
      setNoCompanySelected(true);
      setError('Please select a company from the top navigation before loading sales data.');
      setShouldAutoLoad(false);
      return;
    }

    if (invalidateCache) {
      requestTimestampRef.current = Date.now();
      // Note: Cache invalidation happens via cacheKey change (requestTimestampRef)
    }

    setLoading(true);
    setError(null);
    setLoadingStartTime(Date.now());
    setElapsedTime(0);

    try {
      // Since we're using cache-only mode, we can fetch the entire date range at once
      // fetchSalesData will filter from the complete cache
      setProgress({ current: 0, total: 1, percentage: 0 });
      abortLoadingRef.current = false;
      
      // Fetch data for the entire date range from cache
      console.log('📥 Loading sales data from cache for date range:', startDate, 'to', endDate);
      const response = await fetchSalesData(startDate, endDate);
      console.log('📦 Response from fetchSalesData:', {
        hasResponse: !!response,
        voucherCount: response?.vouchers?.length || 0,
        sampleVoucher: response?.vouchers?.[0]
      });
      
      const allVouchers = [];
      if (response?.vouchers && Array.isArray(response.vouchers)) {
        allVouchers.push(...response.vouchers);
        console.log('✅ Loaded', allVouchers.length, 'vouchers from cache');
      } else {
        console.warn('⚠️ No vouchers found in response:', response);
      }
      
      setProgress({ current: 1, total: 1, percentage: 100 });
      
      // Debug: Log first voucher to see available fields
      if (allVouchers.length > 0) {
        const sampleVoucher = allVouchers[0];
        console.log('🔍 Sample voucher structure (all keys):', Object.keys(sampleVoucher));
        console.log('🔍 Sample voucher (full object):', sampleVoucher);
        
        // Check for narration-related fields
        console.log('🔍 Checking narration-related fields:');
        const narrationFields = ['CP_Temp7', 'cp_temp7', 'NARRATION', 'narration', 'Narration'];
        let foundNarration = false;
        narrationFields.forEach(field => {
          if (sampleVoucher.hasOwnProperty(field)) {
            console.log(`  ✅ Found ${field}:`, sampleVoucher[field]);
            foundNarration = true;
          }
        });
        
        // If no narration field found, log all fields to help debug
        if (!foundNarration) {
          console.warn('⚠️ No narration field found in voucher! All available fields:', Object.keys(sampleVoucher));
          console.warn('⚠️ Sample voucher values:', sampleVoucher);
          
          // Check for any field that might contain narration (case-insensitive search)
          Object.keys(sampleVoucher).forEach(key => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('narr') || lowerKey.includes('temp') || lowerKey.includes('note') || lowerKey.includes('desc')) {
              console.log(`  🔍 Potential narration field: ${key} =`, sampleVoucher[key]);
            }
          });
        }
        
        // Log all fields that might contain country
        console.log('🔍 Checking country-related fields:');
        Object.keys(sampleVoucher).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('country') || lowerKey.includes('nation') || lowerKey.includes('residence')) {
            console.log(`  - ${key}:`, sampleVoucher[key]);
          }
        });
        
        // Also check state field to see the pattern
        console.log('🔍 State field (for comparison):', sampleVoucher.state, sampleVoucher.STATE, sampleVoucher.statename, sampleVoucher.State);
        
        // Check for nested country fields
        if (sampleVoucher.address) {
          console.log('🔍 Address object:', sampleVoucher.address);
          if (typeof sampleVoucher.address === 'object') {
            Object.keys(sampleVoucher.address).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('country')) {
                console.log(`  - address.${key}:`, sampleVoucher.address[key]);
              }
            });
          }
        }
        if (sampleVoucher.customer) {
          console.log('🔍 Customer object:', sampleVoucher.customer);
          if (typeof sampleVoucher.customer === 'object') {
            Object.keys(sampleVoucher.customer).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('country')) {
                console.log(`  - customer.${key}:`, sampleVoucher.customer[key]);
              }
            });
          }
        }
        
        // Log a few sample vouchers to see if country varies
        console.log('🔍 Checking first 5 vouchers for country patterns:');
        allVouchers.slice(0, 5).forEach((v, idx) => {
          const countryFields = Object.keys(v).filter(k => k.toLowerCase().includes('country'));
          if (countryFields.length > 0) {
            console.log(`  Voucher ${idx + 1}:`, countryFields.map(f => `${f}=${v[f]}`).join(', '));
          }
        });
      }
      
      // Helper function to extract country from voucher with comprehensive field checking
      const extractCountry = (voucher) => {
        // First, check predefined common field names
        const predefinedFields = [
          voucher.country,
          voucher.COUNTRY,
          voucher.countryname,
          voucher.Country,
          voucher.COUNTRYOFRESIDENCE,
          voucher.CP_Country,
          voucher.cp_country,
          voucher.country_name,
          voucher.CountryName,
          // Check nested in address
          voucher.address?.country,
          voucher.address?.COUNTRY,
          voucher.address?.countryname,
          // Check nested in customer
          voucher.customer?.country,
          voucher.customer?.COUNTRY,
          voucher.customer?.countryname,
        ];
        
        // Find first non-empty, non-undefined, non-null value from predefined fields
        for (const field of predefinedFields) {
          if (field && String(field).trim() !== '' && String(field).trim().toLowerCase() !== 'unknown') {
            return String(field).trim();
          }
        }
        
        // If not found in predefined fields, dynamically search ALL fields in the voucher
        // This catches any field name that contains "country" (case-insensitive)
        for (const key in voucher) {
          if (voucher.hasOwnProperty(key)) {
            const lowerKey = key.toLowerCase();
            // Check if key contains "country" or "nation" or "residence"
            if ((lowerKey.includes('country') || lowerKey.includes('nation') || lowerKey.includes('residence')) 
                && !lowerKey.includes('unknown')) {
              const value = voucher[key];
              if (value && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'unknown') {
                console.log(`✅ Found country in field: ${key} = ${value}`);
                return String(value).trim();
              }
            }
          }
        }
        
        // Also check nested objects dynamically
        if (voucher.address && typeof voucher.address === 'object') {
          for (const key in voucher.address) {
            if (voucher.address.hasOwnProperty(key)) {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('country') || lowerKey.includes('nation') || lowerKey.includes('residence')) {
                const value = voucher.address[key];
                if (value && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'unknown') {
                  console.log(`✅ Found country in address.${key} = ${value}`);
                  return String(value).trim();
                }
              }
            }
          }
        }
        
        if (voucher.customer && typeof voucher.customer === 'object') {
          for (const key in voucher.customer) {
            if (voucher.customer.hasOwnProperty(key)) {
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('country') || lowerKey.includes('nation') || lowerKey.includes('residence')) {
                const value = voucher.customer[key];
                if (value && String(value).trim() !== '' && String(value).trim().toLowerCase() !== 'unknown') {
                  console.log(`✅ Found country in customer.${key} = ${value}`);
                  return String(value).trim();
                }
              }
            }
          }
        }
        
        return 'Unknown';
      };
      
      // Transform nested response structure (vouchers -> ledgers -> inventry) into flat sale records
      const transformedSales = [];
      
      // Filter vouchers to only include sales-related vouchers
      const salesVouchers = allVouchers.filter(voucher => {
        const vchtype = (voucher.vchtype || '').toLowerCase();
        const reservedname = (voucher.reservedname || '').toLowerCase();
        return vchtype.includes('sales') || reservedname === 'sales';
      });
      
      console.log('📊 Filtered sales vouchers:', {
        totalVouchers: allVouchers.length,
        salesVouchers: salesVouchers.length,
        nonSalesVouchers: allVouchers.length - salesVouchers.length
      });
      
      // Extract salesperson from voucher (if available) or use formula
      const extractSalesperson = (voucher) => {
        return voucher.salesprsn || voucher.SalesPrsn || voucher.SALESPRSN ||
               voucher.salesperson || voucher.SalesPerson || 
               voucher.salespersonname || voucher.SalesPersonName || 
               voucher.sales_person || voucher.SALES_PERSON || 
               voucher.sales_person_name || voucher.SALES_PERSON_NAME ||
               voucher.salespersonname || voucher.SALESPERSONNAME || 'Unassigned';
      };
      
      // Process each sales voucher
      salesVouchers.forEach((voucher, voucherIndex) => {
        const voucherSalesperson = extractSalesperson(voucher);
        // Try multiple date fields and formats
        const voucherDateRaw = voucher.cp_date || voucher.date || voucher.DATE || voucher.CP_DATE;
        let voucherDate = null;
        if (voucherDateRaw) {
          voucherDate = parseDateFromNewFormat(voucherDateRaw);
          if (!voucherDate && /^\d{8}$/.test(voucherDateRaw)) {
            voucherDate = parseDateFromAPI(voucherDateRaw);
          }
          if (!voucherDate) {
            voucherDate = voucherDateRaw; // Use as-is if parsing fails
          }
        }
        const voucherCountry = extractCountry(voucher);
        const voucherState = voucher.state || 'Unknown';
        
        // Log salesperson extraction for first voucher only
        if (voucherIndex === 0) {
          console.log('🔍 Salesperson extraction (first voucher):', {
            originalFields: {
              salesprsn: voucher.salesprsn,
              SalesPrsn: voucher.SalesPrsn,
              SALESPRSN: voucher.SALESPRSN,
              salesperson: voucher.salesperson,
              SalesPerson: voucher.SalesPerson,
              salespersonname: voucher.salespersonname,
              SalesPersonName: voucher.SalesPersonName,
              sales_person: voucher.sales_person,
              SALES_PERSON: voucher.SALES_PERSON,
              sales_person_name: voucher.sales_person_name,
              SALES_PERSON_NAME: voucher.SALES_PERSON_NAME,
              salespersonname: voucher.salespersonname,
              SALESPERSONNAME: voucher.SALESPERSONNAME
            },
            extractedValue: voucherSalesperson,
            allKeys: Object.keys(voucher).filter(k => {
              const lowerKey = k.toLowerCase();
              return lowerKey.includes('sales') || lowerKey.includes('person') || lowerKey.includes('prsn');
            })
          });
        }
        
        // Extract tax information from ledgers
        const parseAmount = (amountStr) => {
          if (!amountStr) return 0;
          const cleaned = String(amountStr).replace(/,/g, '').replace(/[()]/g, '');
          // Handle negative amounts in parentheses like "(-)0.30"
          const isNegative = cleaned.includes('(-)') || (cleaned.startsWith('-') && !cleaned.startsWith('(-)'));
          const numValue = parseFloat(cleaned.replace(/[()]/g, '')) || 0;
          return isNegative ? -Math.abs(numValue) : numValue;
        };
        
        let totalCgst = 0;
        let totalSgst = 0;
        let totalRoundoff = 0;
        let totalSalesAmount = 0;
        
        // Extract tax information from ledgers
        if (voucher.ledgers && Array.isArray(voucher.ledgers)) {
          voucher.ledgers.forEach(ledger => {
            const ledgerName = (ledger.ledger || '').toLowerCase();
            const ledgerAmt = parseAmount(ledger.amt);
            
            // Extract tax information from tax ledgers
            if (ledgerName.includes('cgst')) {
              totalCgst += Math.abs(ledgerAmt);
            } else if (ledgerName.includes('sgst')) {
              totalSgst += Math.abs(ledgerAmt);
            } else if (ledgerName.includes('round off') || ledgerName.includes('roundoff')) {
              totalRoundoff += ledgerAmt; // Can be negative
            }
          });
        }
        
        // Calculate total sales amount from inventory items
        if (voucher.inventry && Array.isArray(voucher.inventry)) {
          voucher.inventry.forEach(inventoryItem => {
            const itemAmount = parseAmount(inventoryItem.amt);
            totalSalesAmount += itemAmount;
          });
        }
        
        // Process inventory items directly from voucher.inventry
        if (voucher.inventry && Array.isArray(voucher.inventry) && voucher.inventry.length > 0) {
          voucher.inventry.forEach((inventoryItem) => {
            // Parse quantity
            const parseQuantity = (qtyStr) => {
              if (!qtyStr) return 0;
              const cleaned = String(qtyStr).replace(/,/g, '');
              return parseInt(cleaned, 10) || 0;
            };
            
            const itemAmount = parseAmount(inventoryItem.amt);
            // Calculate proportional taxes based on item amount vs total sales amount
            const taxRatio = totalSalesAmount > 0 ? itemAmount / totalSalesAmount : 0;
            const itemCgst = totalCgst * taxRatio;
            const itemSgst = totalSgst * taxRatio;
            const itemRoundoff = totalRoundoff * taxRatio;
            
            // Get ledger group from accalloc (account allocation) if available
            let ledgerGroup = 'Other';
            if (inventoryItem.accalloc && Array.isArray(inventoryItem.accalloc) && inventoryItem.accalloc.length > 0) {
              const accountAlloc = inventoryItem.accalloc[0]; // Usually first allocation
              ledgerGroup = accountAlloc.ledgergroupidentify || accountAlloc.group || accountAlloc.grouplist?.split('|')[0] || 'Other';
            }
            
            const saleRecord = {
              // Item-level fields
              category: inventoryItem.group || inventoryItem.grouplist?.split('|')[0] || 'Other',
              item: inventoryItem.item || 'Unknown',
              quantity: parseQuantity(inventoryItem.qty),
              amount: itemAmount,
              profit: parseAmount(inventoryItem.profit) || 0,
              
              // Voucher-level fields
              customer: voucher.party || 'Unknown',
              date: voucherDate,
              cp_date: voucherDate, // Use same date for cp_date
              vchno: voucher.vchno || '',
              masterid: voucher.mstid || voucher.masterid || '',
              region: voucherState,
              country: voucherCountry,
              salesperson: voucherSalesperson,
              
              // Ledger-level fields (from accalloc)
              ledgerGroup: ledgerGroup,
              
              // Tax information (proportionally distributed)
              cgst: itemCgst,
              sgst: itemSgst,
              roundoff: itemRoundoff,
              
              // Additional voucher fields
              alterid: voucher.alterid,
              partyid: voucher.partyid,
              gstno: voucher.gstno || '',
              pincode: voucher.pincode || '',
              reference: voucher.reference || '',
              vchtype: voucher.vchtype || '',
              
              // Additional inventory fields
              itemid: inventoryItem.itemid || '',
              uom: inventoryItem.uom || '',
              grosscost: parseAmount(inventoryItem.grosscost) || 0,
              grossexpense: parseAmount(inventoryItem.grossexpense) || 0,
              
              // Mark as sales
              issales: true,
              
              // Include all other fields from voucher for custom card creation
              ...Object.keys(voucher).reduce((acc, key) => {
                // Only add fields that aren't already mapped above
                const mappedKeys = ['mstid', 'alterid', 'vchno', 'date', 'party', 'partyid', 'state', 'country', 'amt', 'vchtype', 'reservedname', 'gstno', 'pincode', 'reference', 'ledgers', 'inventry', 'salesprsn', 'SalesPrsn', 'SALESPRSN', 'salesperson', 'SalesPerson', 'salespersonname', 'SalesPersonName', 'sales_person', 'SALES_PERSON', 'sales_person_name', 'SALES_PERSON_NAME', 'SALESPERSONNAME'];
                if (!mappedKeys.includes(key) && !key.toLowerCase().includes('sales') && !key.toLowerCase().includes('person') && !key.toLowerCase().includes('prsn')) {
                  acc[key] = voucher[key];
                }
                return acc;
              }, {})
            };
            
            transformedSales.push(saleRecord);
          });
        }
      });

      // Debug: Log country extraction statistics
      const countryStats = transformedSales.reduce((acc, sale) => {
        const country = sale.country || 'Unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {});
      console.log('🌍 Country extraction statistics:', countryStats);
      console.log('🌍 Total vouchers:', transformedSales.length);
      console.log('🌍 Unique countries found:', Object.keys(countryStats).length);
      console.log('🌍 Countries:', Object.keys(countryStats).sort());
      
      // Debug: Log salesperson extraction statistics
      const salespersonStats = transformedSales.reduce((acc, sale) => {
        const salesperson = sale.salesperson || 'Unassigned';
        acc[salesperson] = (acc[salesperson] || 0) + 1;
        return acc;
      }, {});
      const uniqueSalespersons = Object.keys(salespersonStats);
      const vouchersWithSalesperson = transformedSales.filter(s => s.salesperson && s.salesperson !== 'Unassigned').length;
      console.log('👤 Salesperson extraction statistics:', {
        totalVouchers: transformedSales.length,
        vouchersWithSalesperson: vouchersWithSalesperson,
        vouchersWithoutSalesperson: transformedSales.length - vouchersWithSalesperson,
        percentageWithSalesperson: ((vouchersWithSalesperson / transformedSales.length) * 100).toFixed(2) + '%',
        uniqueSalespersons: uniqueSalespersons.length,
        salespersonList: uniqueSalespersons.sort(),
        salespersonCounts: salespersonStats
      });

      console.log('💾 Setting sales state with', transformedSales.length, 'transformed sales records');
      setSales(transformedSales);
      console.log('✅ Sales data loaded successfully. Total records:', transformedSales.length);
      setDateRange({ start: startDate, end: endDate });
      setFromDate(startDate);
      setToDate(endDate);
      // Reset salespersons initialization when new data is loaded
      salespersonsInitializedRef.current = false;

      // Note: Dashboard state is not cached - only sales data is cached via hybridCache.setSalesData()
    } catch (error) {
      console.error('Error loading sales data:', error);
      if (error.message && error.message.includes('No company selected')) {
        setNoCompanySelected(true);
        setError('Please select a company from the top navigation before loading sales data.');
      } else {
        setError('Failed to load sales data. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStartTime(null);
      setElapsedTime(0);
      setProgress({ current: 0, total: 0, percentage: 0 });
      setShouldAutoLoad(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    loadSales(fromDate, toDate, { invalidateCache: true });
  };

  // Background cache download function
  const startBackgroundCacheDownload = async (companyInfo, isUpdate = false) => {
    if (isDownloadingCache || cacheDownloadAbortRef.current) return;

    setIsDownloadingCache(true);
    setCacheDownloadProgress({ current: 0, total: 0, message: isUpdate ? 'Checking for updates...' : 'Downloading cache...' });
    cacheDownloadAbortRef.current = false;

    try {
      console.log(`🔄 Starting background cache ${isUpdate ? 'update' : 'download'}...`);
      
      await syncSalesData(companyInfo, (progress) => {
        // Only update progress if not aborted
        if (!cacheDownloadAbortRef.current) {
          setCacheDownloadProgress(progress);
        }
      });

      // Check if download was aborted
      if (cacheDownloadAbortRef.current) {
        console.log('⚠️ Cache download was aborted');
        return;
      }

      console.log(`✅ Background cache ${isUpdate ? 'update' : 'download'} completed!`);
      
      // Auto-load data after successful cache download (only if it's first time download)
      if (!isUpdate) {
        setTimeout(() => {
          if (!cacheDownloadAbortRef.current) {
            console.log('🚀 Auto-loading sales data from newly downloaded cache...');
            setShouldAutoLoad(true);
          }
        }, 500);
      } else {
        // For updates, trigger auto-load to refresh with latest data
        setTimeout(() => {
          if (!cacheDownloadAbortRef.current) {
            console.log('🔄 Triggering auto-reload with updated data...');
            setShouldAutoLoad(true);
          }
        }, 500);
      }

    } catch (error) {
      console.error('❌ Background cache download failed:', error);
      // Silent failure - no error shown to user
    } finally {
      setIsDownloadingCache(false);
      setCacheDownloadProgress({ current: 0, total: 0, message: '' });
    }
  };

  // Calendar modal handlers
  const handleOpenCalendar = () => {
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    setShowCalendarModal(true);
  };

  const handleApplyDates = () => {
    setFromDate(tempFromDate);
    setToDate(tempToDate);
    setShowCalendarModal(false);
    // Directly submit the form
    loadSales(tempFromDate, tempToDate, { invalidateCache: true });
  };

  const handleCancelDates = () => {
    setShowCalendarModal(false);
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
    const totalOrders = new Set(filteredSalesForOrders.map((s) => s.masterid)).size;
    const totalQuantity = filteredSales.reduce((sum, sale) => sum + sale.quantity, 0);
    const uniqueCustomers = new Set(filteredSales.map((s) => s.customer)).size;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Profit-related metrics
    const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgProfitPerOrder = totalOrders > 0 ? totalProfit / totalOrders : 0;
    
    return { 
      totalRevenue, 
      totalOrders, 
      totalQuantity, 
      uniqueCustomers, 
      avgOrderValue,
      totalProfit,
      profitMargin,
      avgProfitPerOrder
    };
  }, [filteredSales, filteredSalesForOrders]);

  const { 
    totalRevenue, 
    totalOrders, 
    totalQuantity, 
    uniqueCustomers, 
    avgOrderValue,
    totalProfit,
    profitMargin,
    avgProfitPerOrder
  } = metrics;

  // Helper function for case-insensitive grouping
  // Groups by lowercase key but preserves the original case for display
  const groupByCaseInsensitive = (items, getKey, getValue) => {
    const grouped = new Map(); // Map<lowercaseKey, { originalKey: string, value: number }>
    
    items.forEach(item => {
      const key = getKey(item);
      if (!key) return;
      
      const normalizedKey = String(key).trim().toLowerCase();
      const originalKey = String(key).trim();
      
      if (!grouped.has(normalizedKey)) {
        grouped.set(normalizedKey, { originalKey, value: 0 });
      }
      
      const entry = grouped.get(normalizedKey);
      entry.value += getValue(item);
      // Keep the most common casing (or first encountered) as the original
      // For now, we'll use the first encountered casing
    });
    
    return grouped;
  };

  // Category chart data
  const categoryChartData = useMemo(() => {
    const grouped = groupByCaseInsensitive(
      filteredSales,
      (sale) => sale.category,
      (sale) => sale.amount || 0
    );
    const categoryData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, value }]) => [originalKey, value])
    );

    // Extended color palette for dynamic categories
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f43f5e', // Rose
      '#8b5a2b', // Brown
      '#6b7280', // Gray
      '#dc2626', // Red-600
      '#059669', // Green-600
      '#d97706', // Orange-600
      '#7c3aed', // Purple-600
      '#0891b2', // Sky-600
      '#ca8a04'  // Yellow-600
    ];

    return Object.entries(categoryData)
      .map(([label, value], index) => ({
        label,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Ledger Group chart data
  const ledgerGroupChartData = useMemo(() => {
    const grouped = groupByCaseInsensitive(
      filteredSales,
      (sale) => sale.ledgerGroup,
      (sale) => sale.amount || 0
    );
    const ledgerGroupData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, value }]) => [originalKey, value])
    );

    // Extended color palette for dynamic ledger groups
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f43f5e', // Rose
      '#8b5a2b', // Brown
      '#6b7280', // Gray
      '#dc2626', // Red-600
      '#059669', // Green-600
      '#d97706', // Orange-600
      '#7c3aed', // Purple-600
      '#0891b2', // Sky-600
      '#ca8a04'  // Yellow-600
    ];

    return Object.entries(ledgerGroupData)
      .map(([label, value], index) => ({
        label,
        value,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Region chart data
  const regionChartData = useMemo(() => {
    const grouped = groupByCaseInsensitive(
      filteredSales,
      (sale) => sale.region,
      (sale) => sale.amount || 0
    );
    const regionData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, value }]) => [originalKey, value])
    );

    // Extended color palette for regions
    const regionColors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
    ];

    return Object.entries(regionData)
      .map(([label, value], index) => ({
        label,
        value,
        color: regionColors[index % regionColors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Country chart data - uses existing sales data, NO API calls
  // Country data is extracted from the initial loadSales() response
  const countryChartData = useMemo(() => {
    const grouped = groupByCaseInsensitive(
      filteredSales,
      (sale) => sale.country || 'Unknown',
      (sale) => sale.amount || 0
    );
    const countryData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, value }]) => [originalKey || 'Unknown', value])
    );

    // Extended color palette for countries
    const countryColors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
    ];

    return Object.entries(countryData)
      .map(([label, value], index) => ({
        label: label || 'Unknown',
        value,
        color: countryColors[index % countryColors.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredSales]);

  // Salesperson totals data
  const salespersonTotals = useMemo(() => {
    if (!filteredSales || filteredSales.length === 0) {
      return [];
    }

    let filteredBySalesperson = filteredSales;

    // Filter by enabled salespersons
    // If size === 0 and initialization hasn't happened yet, show all (for initial load)
    // If size === 0 after initialization, none are selected (show nothing)
    // If size > 0, only show selected salespersons
    if (enabledSalespersons.size > 0) {
      filteredBySalesperson = filteredSales.filter((sale) => {
        const salespersonName = sale.salesperson || 'Unassigned';
        return enabledSalespersons.has(salespersonName);
      });
    } else if (enabledSalespersons.size === 0 && salespersonsInitializedRef.current) {
      // None selected after initialization - show nothing
      filteredBySalesperson = [];
    }
    // If size === 0 and not initialized yet, show all (filteredBySalesperson = filteredSales)

    const salespersonMap = new Map();
    filteredBySalesperson.forEach((sale) => {
      const salespersonName = sale.salesperson || 'Unassigned';
      const amount = sale.amount || 0;

      if (!salespersonMap.has(salespersonName)) {
        salespersonMap.set(salespersonName, { name: salespersonName, value: 0, billCount: 0 });
      }

      const entry = salespersonMap.get(salespersonName);
      entry.value += amount;
      entry.billCount += 1;
    });

    const result = Array.from(salespersonMap.values()).sort((a, b) => b.value - a.value);
    
    // Debug logging
    console.log('🔍 Salesperson Totals Debug:', {
      filteredSalesCount: filteredSales.length,
      filteredBySalespersonCount: filteredBySalesperson.length,
      enabledSalespersonsSize: enabledSalespersons.size,
      initialized: salespersonsInitializedRef.current,
      resultCount: result.length,
      sampleResult: result[0],
      allSalespersons: Array.from(new Set(filteredSales.map(s => s.salesperson || 'Unassigned')))
    });

    return result;
  }, [filteredSales, enabledSalespersons, sales.length]);

  // Initialize enabledSalespersons with all salespersons when sales are first loaded
  useEffect(() => {
    if (sales.length > 0 && !salespersonsInitializedRef.current) {
      const uniqueSalespersons = new Set();
      sales.forEach((sale) => {
        const salespersonName = sale.salesperson || 'Unassigned';
        uniqueSalespersons.add(salespersonName);
      });
      console.log('🔍 Initializing salespersons:', {
        uniqueSalespersons: Array.from(uniqueSalespersons),
        totalSales: sales.length,
        sampleSale: sales[0]
      });
      if (uniqueSalespersons.size > 0) {
        setEnabledSalespersons(uniqueSalespersons);
        salespersonsInitializedRef.current = true;
      } else {
        // Even if all are 'Unassigned', we should still enable it
        setEnabledSalespersons(new Set(['Unassigned']));
        salespersonsInitializedRef.current = true;
      }
    }
  }, [sales]);

  // Top customers data
  const topCustomersData = useMemo(() => {
    const grouped = groupByCaseInsensitive(
      filteredSales,
      (sale) => sale.customer,
      (sale) => sale.amount || 0
    );
    const customerData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, value }]) => [originalKey, value])
    );

    // Extended color palette for customers
    const customerColors = [
      '#8b5cf6', // Violet
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
    ];

    return Object.entries(customerData)
      .map(([label, value], index) => ({
        label,
        value,
        color: customerColors[index % customerColors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topCustomersN > 0 ? topCustomersN : undefined);
  }, [filteredSales, topCustomersN]);

  // Top items by revenue data
  const topItemsByRevenueData = useMemo(() => {
    const grouped = new Map(); // Map<lowercaseKey, { originalKey: string, revenue: number, quantity: number }>
    
    filteredSales.forEach(sale => {
      const item = sale.item;
      if (!item) return;
      
      const normalizedKey = String(item).trim().toLowerCase();
      const originalKey = String(item).trim();
      
      if (!grouped.has(normalizedKey)) {
        grouped.set(normalizedKey, { originalKey, revenue: 0, quantity: 0 });
      }
      
      const entry = grouped.get(normalizedKey);
      entry.revenue += sale.amount || 0;
      entry.quantity += sale.quantity || 0;
    });
    
    const itemData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, revenue, quantity }]) => [
        originalKey,
        { revenue, quantity }
      ])
    );

    // Extended color palette for items
    const itemColors = [
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#3b82f6', // Blue
    ];

    return Object.entries(itemData)
      .map(([label, data], index) => ({
        label,
        value: data.revenue,
        color: itemColors[index % itemColors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topItemsByRevenueN > 0 ? topItemsByRevenueN : undefined);
  }, [filteredSales, topItemsByRevenueN]);

  // Top items by quantity data
  const topItemsByQuantityData = useMemo(() => {
    const grouped = new Map(); // Map<lowercaseKey, { originalKey: string, revenue: number, quantity: number }>
    
    filteredSales.forEach(sale => {
      const item = sale.item;
      if (!item) return;
      
      const normalizedKey = String(item).trim().toLowerCase();
      const originalKey = String(item).trim();
      
      if (!grouped.has(normalizedKey)) {
        grouped.set(normalizedKey, { originalKey, revenue: 0, quantity: 0 });
      }
      
      const entry = grouped.get(normalizedKey);
      entry.revenue += sale.amount || 0;
      entry.quantity += sale.quantity || 0;
    });
    
    const itemData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, revenue, quantity }]) => [
        originalKey,
        { revenue, quantity }
      ])
    );

    // Extended color palette for quantity items
    const quantityColors = [
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#3b82f6', // Blue
      '#10b981', // Green
    ];

    return Object.entries(itemData)
      .map(([label, data], index) => ({
        label,
        value: data.quantity,
        color: quantityColors[index % quantityColors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topItemsByQuantityN > 0 ? topItemsByQuantityN : undefined);
  }, [filteredSales, topItemsByQuantityN]);

  // Period chart data (monthly) - based on cp_date from API
  const periodChartData = useMemo(() => {
    const periodData = filteredSales.reduce((acc, sale) => {
      // Use cp_date if available, otherwise fall back to date
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[yearMonth]) {
        acc[yearMonth] = 0;
      }
      acc[yearMonth] += sale.amount;
      
      return acc;
    }, {});

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Extended color palette for periods
    const periodColors = [
      '#06b6d4', // Cyan
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f43f5e', // Rose
    ];

    return Object.entries(periodData)
      .map(([label, value], index) => {
        const [year, month] = label.split('-');
        const formattedLabel = `${monthNames[parseInt(month) - 1]}-${year.slice(2)}`;
        return {
          label: formattedLabel,
          value,
          color: periodColors[index % periodColors.length],
          originalLabel: label,
        };
      })
      .sort((a, b) => {
        const [yearA, monthA] = a.originalLabel.split('-');
        const [yearB, monthB] = b.originalLabel.split('-');
        
        // Sort by year first, then by month
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return parseInt(monthA) - parseInt(monthB);
      });
  }, [filteredSales]);

  // Month-wise Revenue vs Profit chart data
  const revenueVsProfitChartData = useMemo(() => {
    const periodData = filteredSales.reduce((acc, sale) => {
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[yearMonth]) {
        acc[yearMonth] = { revenue: 0, profit: 0 };
      }
      acc[yearMonth].revenue += sale.amount;
      acc[yearMonth].profit += sale.profit || 0;
      
      return acc;
    }, {});

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const sortedEntries = Object.entries(periodData)
      .map(([label, data]) => {
        const [year, month] = label.split('-');
        const formattedLabel = `${monthNames[parseInt(month) - 1]}-${year.slice(2)}`;
        return {
          label: formattedLabel,
          originalLabel: label,
          revenue: data.revenue,
          profit: data.profit,
        };
      })
      .sort((a, b) => {
        const [yearA, monthA] = a.originalLabel.split('-');
        const [yearB, monthB] = b.originalLabel.split('-');
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return parseInt(monthA) - parseInt(monthB);
      });

    return sortedEntries;
  }, [filteredSales]);

  // Top 10 profitable items chart data
  const topProfitableItemsData = useMemo(() => {
    const grouped = new Map(); // Map<lowercaseKey, { originalKey: string, profit: number, revenue: number }>
    
    filteredSales.forEach(sale => {
      const item = sale.item;
      if (!item) return;
      
      const normalizedKey = String(item).trim().toLowerCase();
      const originalKey = String(item).trim();
      
      if (!grouped.has(normalizedKey)) {
        grouped.set(normalizedKey, { originalKey, profit: 0, revenue: 0 });
      }
      
      const entry = grouped.get(normalizedKey);
      entry.profit += sale.profit || 0;
      entry.revenue += sale.amount || 0;
    });
    
    const itemData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, profit, revenue }]) => [
        originalKey,
        { profit, revenue }
      ])
    );

    const profitColors = [
      '#10b981', // Green
      '#16a34a', // Green-600
      '#22c55e', // Green-500
      '#34d399', // Green-400
      '#4ade80', // Green-300
      '#86efac', // Green-200
      '#bbf7d0', // Green-100
      '#dcfce7', // Green-50
      '#f0fdf4', // Green-25
      '#ecfdf5'  // Mint
    ];

    return Object.entries(itemData)
      .map(([label, data], index) => ({
        label,
        value: data.profit,
        revenue: data.revenue,
        color: profitColors[index % profitColors.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredSales]);

  // Top 10 loss items chart data (items with negative profit)
  const topLossItemsData = useMemo(() => {
    const grouped = new Map(); // Map<lowercaseKey, { originalKey: string, profit: number, revenue: number }>
    
    filteredSales.forEach(sale => {
      const item = sale.item;
      if (!item) return;
      
      const normalizedKey = String(item).trim().toLowerCase();
      const originalKey = String(item).trim();
      
      if (!grouped.has(normalizedKey)) {
        grouped.set(normalizedKey, { originalKey, profit: 0, revenue: 0 });
      }
      
      const entry = grouped.get(normalizedKey);
      entry.profit += sale.profit || 0;
      entry.revenue += sale.amount || 0;
    });
    
    const itemData = Object.fromEntries(
      Array.from(grouped.entries()).map(([_, { originalKey, profit, revenue }]) => [
        originalKey,
        { profit, revenue }
      ])
    );

    const lossColors = [
      '#ef4444', // Red
      '#dc2626', // Red-600
      '#b91c1c', // Red-700
      '#991b1b', // Red-800
      '#f87171', // Red-400
      '#fca5a5', // Red-300
      '#fee2e2', // Red-100
      '#fecaca', // Red-200
      '#f87171', // Red-400
      '#dc2626'  // Red-600
    ];

    return Object.entries(itemData)
      .map(([label, data]) => ({
        label,
        value: data.profit,
        revenue: data.revenue,
        color: lossColors[0], // Will be assigned properly
      }))
      .filter(item => item.value < 0) // Only items with negative profit
      .sort((a, b) => a.value - b.value) // Sort by most negative first
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        color: lossColors[index % lossColors.length],
      }));
  }, [filteredSales]);

  // Month-wise profit chart data
  const monthWiseProfitChartData = useMemo(() => {
    const periodData = filteredSales.reduce((acc, sale) => {
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[yearMonth]) {
        acc[yearMonth] = 0;
      }
      acc[yearMonth] += sale.profit || 0;
      
      return acc;
    }, {});

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const profitColors = [
      '#06b6d4', // Cyan
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f43f5e', // Rose
    ];

    return Object.entries(periodData)
      .map(([label, value], index) => {
        const [year, month] = label.split('-');
        const formattedLabel = `${monthNames[parseInt(month) - 1]}-${year.slice(2)}`;
        return {
          label: formattedLabel,
          value,
          color: profitColors[index % profitColors.length],
          originalLabel: label,
        };
      })
      .sort((a, b) => {
        const [yearA, monthA] = a.originalLabel.split('-');
        const [yearB, monthB] = b.originalLabel.split('-');
        if (yearA !== yearB) {
          return parseInt(yearA) - parseInt(yearB);
        }
        return parseInt(monthA) - parseInt(monthB);
      });
  }, [filteredSales]);

  const hasActiveFilters =
    selectedCustomer !== 'all' ||
    selectedItem !== 'all' ||
    selectedStockGroup !== 'all' ||
    selectedLedgerGroup !== 'all' ||
    selectedRegion !== 'all' ||
    selectedCountry !== 'all' ||
    selectedPeriod !== null ||
    selectedSalesperson !== null ||
    (genericFilters && Object.keys(genericFilters).length > 0 && Object.values(genericFilters).some(v => v !== null && v !== 'all' && v !== ''));

  // Helper function to render filter badges for a specific card
  const renderCardFilterBadges = (cardType, cardId = null) => {
    const badges = [];
    
    // Map card types to their relevant filters
    const filterMap = {
      'customer': ['selectedCustomer'],
      'item': ['selectedItem'],
      'stockGroup': ['selectedStockGroup'],
      'region': ['selectedRegion'],
      'country': ['selectedCountry'],
      'period': ['selectedPeriod'],
      'salesperson': ['selectedSalesperson'],
      'ledgerGroup': ['selectedLedgerGroup'],
      'topCustomers': ['selectedCustomer'],
      'topItems': ['selectedItem'],
      'custom': cardId ? [`generic_${cardId}`] : []
    };
    
    const relevantFilters = filterMap[cardType] || [];
    
    // Add customer filter badge
    if (relevantFilters.includes('selectedCustomer') && selectedCustomer !== 'all') {
      badges.push(
        <div
          key="customer-filter"
          style={{
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>person</span>
          {isMobile ? 'Customer' : `Customer: ${selectedCustomer}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCustomer('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#1e40af',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#93c5fd';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add item filter badge
    if (relevantFilters.includes('selectedItem') && selectedItem !== 'all') {
      badges.push(
        <div
          key="item-filter"
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>inventory_2</span>
          {isMobile ? 'Item' : `Item: ${selectedItem}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#166534',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#86efac';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add stock group filter badge
    if (relevantFilters.includes('selectedStockGroup') && selectedStockGroup !== 'all') {
      badges.push(
        <div
          key="stockGroup-filter"
          style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>category</span>
          {isMobile ? 'Stock Group' : `Stock Group: ${selectedStockGroup}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStockGroup('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400e',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#fcd34d';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add region filter badge
    if (relevantFilters.includes('selectedRegion') && selectedRegion !== 'all') {
      badges.push(
        <div
          key="region-filter"
          style={{
            background: '#e0e7ff',
            border: '1px solid #a5b4fc',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#3730a3',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>location_on</span>
          {isMobile ? 'State' : `State: ${selectedRegion}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRegion('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#3730a3',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#a5b4fc';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add country filter badge
    if (relevantFilters.includes('selectedCountry') && selectedCountry !== 'all') {
      badges.push(
        <div
          key="country-filter"
          style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>public</span>
          {isMobile ? 'Country' : `Country: ${selectedCountry}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCountry('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#92400e',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#fcd34d';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add period filter badge
    if (relevantFilters.includes('selectedPeriod') && selectedPeriod !== null) {
      badges.push(
        <div
          key="period-filter"
          style={{
            background: '#fce7f3',
            border: '1px solid #f9a8d4',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#9d174d',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>calendar_month</span>
          {isMobile ? 'Period' : `Period: ${formatPeriodLabel(selectedPeriod)}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPeriod(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#9d174d',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f9a8d4';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add salesperson filter badge
    if (relevantFilters.includes('selectedSalesperson') && selectedSalesperson !== null) {
      badges.push(
        <div
          key="salesperson-filter"
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#c2410c',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>person_outline</span>
          {isMobile ? 'Salesperson' : `Salesperson: ${selectedSalesperson}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSalesperson(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#c2410c',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#fed7aa';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add ledger group filter badge
    if (relevantFilters.includes('selectedLedgerGroup') && selectedLedgerGroup !== 'all') {
      badges.push(
        <div
          key="ledgerGroup-filter"
          style={{
            background: '#f3e8ff',
            border: '1px solid #c084fc',
            borderRadius: '12px',
            padding: isMobile ? '2px 6px' : '3px 8px',
            fontSize: isMobile ? '10px' : '11px',
            color: '#6b21a8',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px'
          }}
        >
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>group</span>
          {isMobile ? 'Ledger Group' : `Ledger Group: ${selectedLedgerGroup}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLedgerGroup('all');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b21a8',
              cursor: 'pointer',
              padding: '1px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '2px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#c084fc';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'none';
            }}
          >
            <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
          </button>
        </div>
      );
    }
    
    // Add generic filters for custom cards
    if (cardId && genericFilters) {
      Object.entries(genericFilters).forEach(([filterKey, filterValue]) => {
        if (filterKey.startsWith(`${cardId}_`) && filterValue && filterValue !== 'all' && filterValue !== '') {
          const fieldName = filterKey.replace(`${cardId}_`, '');
          const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
          const card = customCards.find(c => c.id === cardId);
          
          badges.push(
            <div
              key={filterKey}
              style={{
                background: '#f0f9ff',
                border: '1px solid #7dd3fc',
                borderRadius: '12px',
                padding: isMobile ? '2px 6px' : '3px 8px',
                fontSize: isMobile ? '10px' : '11px',
                color: '#0c4a6e',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '8px'
              }}
            >
              <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>filter_alt</span>
              {isMobile ? fieldLabel : `${fieldLabel}: ${filterValue}`}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setGenericFilters(prev => {
                    const updated = { ...prev };
                    delete updated[filterKey];
                    try {
                      sessionStorage.setItem('customCardGenericFilters', JSON.stringify(updated));
                    } catch (e) {
                      console.warn('Failed to update generic filters:', e);
                    }
                    return updated;
                  });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0c4a6e',
                  cursor: 'pointer',
                  padding: '1px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '2px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#7dd3fc';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none';
                }}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>close</span>
              </button>
            </div>
          );
        }
      });
    }
    
    return badges.length > 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
        {badges}
      </div>
    ) : null;
  };

  const clearAllFilters = () => {
    // Only clear interactive filters - do NOT touch cache or date range
    console.log('🧹 Clearing interactive filters only (preserving cache and date range)...');
    
    setSelectedCustomer('all');
    setSelectedItem('all');
    setSelectedStockGroup('all');
    setSelectedLedgerGroup('all');
    setSelectedRegion('all');
    setSelectedCountry('all');
    setSelectedPeriod(null);
    setSelectedSalesperson(null);
    setGenericFilters({}); // Clear generic filters from custom cards
    
    // Clear from sessionStorage
    try {
      sessionStorage.removeItem('customCardGenericFilters');
    } catch (e) {
      console.warn('Failed to clear generic filters from sessionStorage:', e);
    }
    
    // Note: Cache and date range are preserved to avoid unnecessary API calls
  };

  const formatCurrency = (value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Custom Cards Helper Functions
  // Helper function to get field value with case-insensitive fallback
  const getFieldValue = useCallback((item, fieldName) => {
    if (!item || !fieldName) return null;
    // Try direct access first
    if (item[fieldName] !== undefined) return item[fieldName];
    // Try lowercase
    if (item[fieldName.toLowerCase()] !== undefined) return item[fieldName.toLowerCase()];
    // Try uppercase
    if (item[fieldName.toUpperCase()] !== undefined) return item[fieldName.toUpperCase()];
    // Try case-insensitive search
    const matchingKey = Object.keys(item).find(k => k.toLowerCase() === fieldName.toLowerCase());
    return matchingKey ? item[matchingKey] : null;
  }, []);

  const generateCustomCardData = useCallback((cardConfig, salesData) => {
    if (!salesData || salesData.length === 0) return [];
    if (!cardConfig || !cardConfig.groupBy || !cardConfig.valueField) {
      console.warn('Invalid card config:', cardConfig);
      return [];
    }

    // Apply filters from card config
    let filteredData = [...salesData];

    // Apply custom card filters (if specified)
    if (cardConfig.filters) {
      if (cardConfig.filters.customer && cardConfig.filters.customer !== 'all') {
        filteredData = filteredData.filter(s => s.customer && String(s.customer).trim().toLowerCase() === String(cardConfig.filters.customer).trim().toLowerCase());
      }
      if (cardConfig.filters.item && cardConfig.filters.item !== 'all') {
        filteredData = filteredData.filter(s => s.item && String(s.item).trim().toLowerCase() === String(cardConfig.filters.item).trim().toLowerCase());
      }
      if (cardConfig.filters.stockGroup && cardConfig.filters.stockGroup !== 'all') {
        filteredData = filteredData.filter(s => s.category && String(s.category).trim().toLowerCase() === String(cardConfig.filters.stockGroup).trim().toLowerCase());
      }
      if (cardConfig.filters.region && cardConfig.filters.region !== 'all') {
        filteredData = filteredData.filter(s => s.region && String(s.region).trim().toLowerCase() === String(cardConfig.filters.region).trim().toLowerCase());
      }
      if (cardConfig.filters.country && cardConfig.filters.country !== 'all') {
        filteredData = filteredData.filter(s => s.country && String(s.country).trim().toLowerCase() === String(cardConfig.filters.country).trim().toLowerCase());
      }
      if (cardConfig.filters.salesperson && cardConfig.filters.salesperson !== 'all') {
        filteredData = filteredData.filter(s => s.salesperson === cardConfig.filters.salesperson);
      }
      if (cardConfig.filters.period) {
        filteredData = filteredData.filter(s => {
          const saleDate = s.cp_date || s.date;
          const date = new Date(saleDate);
          const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return salePeriod === cardConfig.filters.period;
        });
      }
    }

    // Group data by selected field
    const grouped = {};
    filteredData.forEach(sale => {
      let groupKey = '';
      let originalKey = '';
      
      if (cardConfig.groupBy === 'date') {
        const saleDate = sale.cp_date || sale.date;
        const date = new Date(saleDate);
        if (cardConfig.dateGrouping === 'day') {
          groupKey = saleDate; // YYYY-MM-DD
        } else if (cardConfig.dateGrouping === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
        } else if (cardConfig.dateGrouping === 'month') {
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (cardConfig.dateGrouping === 'year') {
          groupKey = String(date.getFullYear());
        } else {
          groupKey = saleDate;
        }
        originalKey = groupKey;
      } else if (cardConfig.groupBy === 'profit_margin') {
        const amount = parseFloat(getFieldValue(sale, 'amount') || 0);
        const profit = parseFloat(getFieldValue(sale, 'profit') || 0);
        const margin = amount > 0 ? ((profit / amount) * 100).toFixed(0) : '0';
        groupKey = `${margin}%`;
        originalKey = groupKey;
      } else if (cardConfig.groupBy === 'order_value') {
        // Group by order value ranges
        const value = parseFloat(getFieldValue(sale, 'amount') || 0);
        if (value < 1000) groupKey = '< ₹1K';
        else if (value < 5000) groupKey = '₹1K - ₹5K';
        else if (value < 10000) groupKey = '₹5K - ₹10K';
        else if (value < 50000) groupKey = '₹10K - ₹50K';
        else groupKey = '> ₹50K';
        originalKey = groupKey;
      } else {
        // Generic field access - use helper function for case-insensitive search
        const fieldValue = getFieldValue(sale, cardConfig.groupBy);
        // Normalize to lowercase for grouping, but preserve original for display
        const normalizedValue = fieldValue ? String(fieldValue).trim() : 'Unknown';
        groupKey = normalizedValue.toLowerCase();
        originalKey = normalizedValue;
      }
      
      // Initialize group if needed
      if (!grouped[groupKey]) {
        grouped[groupKey] = { items: [], originalKey: originalKey };
      } else {
        // For case-insensitive fields, keep the most common casing (use first encountered)
        if (cardConfig.groupBy !== 'date' && cardConfig.groupBy !== 'profit_margin' && cardConfig.groupBy !== 'order_value') {
          if (grouped[groupKey].originalKey === 'Unknown' && originalKey !== 'Unknown') {
            grouped[groupKey].originalKey = originalKey;
          }
        }
      }
      grouped[groupKey].items.push(sale);
    });

    // Calculate aggregated values
    const result = Object.keys(grouped).map(key => {
      const groupData = grouped[key];
      const items = groupData.items || groupData; // Support both old and new format
      const displayKey = groupData.originalKey || key; // Use original key for display
      let value = 0;

      if (cardConfig.aggregation === 'sum') {
        // Handle special calculated fields
        if (cardConfig.valueField === 'tax_amount') {
          value = items.reduce((sum, item) => {
            const cgst = parseFloat(getFieldValue(item, 'cgst') || 0);
            const sgst = parseFloat(getFieldValue(item, 'sgst') || 0);
            return sum + cgst + sgst;
          }, 0);
        } else if (cardConfig.valueField === 'profit_margin') {
          const totalAmount = items.reduce((sum, item) => {
            const amount = parseFloat(getFieldValue(item, 'amount') || 0);
            return sum + amount;
          }, 0);
          const totalProfit = items.reduce((sum, item) => {
            const profit = parseFloat(getFieldValue(item, 'profit') || 0);
            return sum + profit;
          }, 0);
          value = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
        } else if (cardConfig.valueField === 'order_value') {
          value = items.reduce((sum, item) => {
            const amount = parseFloat(getFieldValue(item, 'amount') || 0);
            return sum + amount;
          }, 0);
        } else if (cardConfig.valueField === 'avg_order_value') {
          const uniqueOrders = new Set(items.map(item => getFieldValue(item, 'masterid')).filter(id => id)).size;
          const totalAmount = items.reduce((sum, item) => {
            const amount = parseFloat(getFieldValue(item, 'amount') || 0);
            return sum + amount;
          }, 0);
          value = uniqueOrders > 0 ? totalAmount / uniqueOrders : 0;
        } else if (cardConfig.valueField === 'profit_per_quantity') {
          const totalQuantity = items.reduce((sum, item) => {
            const quantity = parseFloat(getFieldValue(item, 'quantity') || 0);
            return sum + quantity;
          }, 0);
          const totalProfit = items.reduce((sum, item) => {
            const profit = parseFloat(getFieldValue(item, 'profit') || 0);
            return sum + profit;
          }, 0);
          value = totalQuantity > 0 ? totalProfit / totalQuantity : 0;
        } else {
          // Generic sum for any numeric field
          value = items.reduce((sum, item) => {
            const fieldValue = getFieldValue(item, cardConfig.valueField);
            return sum + (parseFloat(fieldValue) || 0);
          }, 0);
        }
      } else if (cardConfig.aggregation === 'count') {
        if (cardConfig.valueField === 'transactions') {
          value = items.length;
        } else if (cardConfig.valueField === 'unique_customers') {
          value = new Set(items.map(item => getFieldValue(item, 'customer')).filter(v => v)).size;
        } else if (cardConfig.valueField === 'unique_items') {
          value = new Set(items.map(item => getFieldValue(item, 'item')).filter(v => v)).size;
        } else if (cardConfig.valueField === 'unique_orders') {
          value = new Set(items.map(item => getFieldValue(item, 'masterid')).filter(v => v)).size;
        } else {
          value = items.length;
        }
      } else if (cardConfig.aggregation === 'average') {
        // Generic average for any numeric field
        const sum = items.reduce((sum, item) => {
          const fieldValue = getFieldValue(item, cardConfig.valueField);
          return sum + (parseFloat(fieldValue) || 0);
        }, 0);
        value = items.length > 0 ? sum / items.length : 0;
      } else if (cardConfig.aggregation === 'min') {
        // Minimum value for any numeric field
        let values = [];
        
        // Handle special calculated fields
        if (cardConfig.valueField === 'tax_amount') {
          values = items
            .map(item => {
              const cgst = parseFloat(getFieldValue(item, 'cgst') || 0);
              const sgst = parseFloat(getFieldValue(item, 'sgst') || 0);
              return cgst + sgst;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'profit_margin') {
          values = items
            .map(item => {
              const amount = parseFloat(getFieldValue(item, 'amount') || 0);
              const profit = parseFloat(getFieldValue(item, 'profit') || 0);
              return amount > 0 ? (profit / amount) * 100 : 0;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'order_value') {
          values = items
            .map(item => parseFloat(getFieldValue(item, 'amount') || 0))
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'avg_order_value') {
          // For min/max of avg_order_value, calculate per item (amount for that item)
          values = items
            .map(item => parseFloat(getFieldValue(item, 'amount') || 0))
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'profit_per_quantity') {
          values = items
            .map(item => {
              const quantity = parseFloat(getFieldValue(item, 'quantity') || 0);
              const profit = parseFloat(getFieldValue(item, 'profit') || 0);
              return quantity > 0 ? profit / quantity : 0;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'transactions' || 
                   cardConfig.valueField === 'unique_customers' || 
                   cardConfig.valueField === 'unique_items' || 
                   cardConfig.valueField === 'unique_orders') {
          // For count fields, min/max don't make much sense, but return the count
          value = items.length;
        } else {
          // Generic min for any numeric field
          values = items
            .map(item => {
              const fieldValue = getFieldValue(item, cardConfig.valueField);
              return typeof fieldValue === 'number' ? fieldValue : parseFloat(fieldValue);
            })
            .filter(v => !isNaN(v) && isFinite(v));
        }
        
        value = values.length > 0 ? Math.min(...values) : 0;
      } else if (cardConfig.aggregation === 'max') {
        // Maximum value for any numeric field
        let values = [];
        
        // Handle special calculated fields
        if (cardConfig.valueField === 'tax_amount') {
          values = items
            .map(item => {
              const cgst = parseFloat(getFieldValue(item, 'cgst') || 0);
              const sgst = parseFloat(getFieldValue(item, 'sgst') || 0);
              return cgst + sgst;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'profit_margin') {
          values = items
            .map(item => {
              const amount = parseFloat(getFieldValue(item, 'amount') || 0);
              const profit = parseFloat(getFieldValue(item, 'profit') || 0);
              return amount > 0 ? (profit / amount) * 100 : 0;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'order_value') {
          values = items
            .map(item => parseFloat(getFieldValue(item, 'amount') || 0))
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'avg_order_value') {
          // For min/max of avg_order_value, calculate per item (amount for that item)
          values = items
            .map(item => parseFloat(getFieldValue(item, 'amount') || 0))
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'profit_per_quantity') {
          values = items
            .map(item => {
              const quantity = parseFloat(getFieldValue(item, 'quantity') || 0);
              const profit = parseFloat(getFieldValue(item, 'profit') || 0);
              return quantity > 0 ? profit / quantity : 0;
            })
            .filter(v => !isNaN(v) && isFinite(v));
        } else if (cardConfig.valueField === 'transactions' || 
                   cardConfig.valueField === 'unique_customers' || 
                   cardConfig.valueField === 'unique_items' || 
                   cardConfig.valueField === 'unique_orders') {
          // For count fields, min/max don't make much sense, but return the count
          value = items.length;
        } else {
          // Generic max for any numeric field
          values = items
            .map(item => {
              const fieldValue = getFieldValue(item, cardConfig.valueField);
              return typeof fieldValue === 'number' ? fieldValue : parseFloat(fieldValue);
            })
            .filter(v => !isNaN(v) && isFinite(v));
        }
        
        value = values.length > 0 ? Math.max(...values) : 0;
      }

      return {
        label: displayKey, // Use original key for display (preserves casing)
        value: value
      };
    });

    // Sort by value descending
    result.sort((a, b) => b.value - a.value);

    // Extended color palette for custom cards (same as other charts)
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
      '#f97316', // Orange
      '#6366f1', // Indigo
      '#14b8a6', // Teal
      '#f43f5e', // Rose
      '#8b5a2b', // Brown
      '#6b7280', // Gray
      '#dc2626', // Red-600
      '#059669', // Green-600
      '#d97706', // Orange-600
      '#7c3aed', // Purple-600
      '#0891b2', // Sky-600
      '#ca8a04'  // Yellow-600
    ];

    // Apply Top N limit if specified
    const finalResult = cardConfig.topN && cardConfig.topN > 0 
      ? result.slice(0, cardConfig.topN)
      : result;

    // Add colors to each item
    return finalResult.map((item, index) => ({
      ...item,
      color: colors[index % colors.length]
    }));
  }, []);

  const handleCreateCustomCard = useCallback((cardConfig) => {
    if (editingCardId) {
      // Update existing card
      setCustomCards(prev => prev.map(card => 
        card.id === editingCardId 
          ? { ...card, ...cardConfig }
          : card
      ));
      // Also update the chartType state to match the updated card
      if (cardConfig.chartType) {
        setCustomCardChartTypes(prev => ({
          ...prev,
          [editingCardId]: cardConfig.chartType
        }));
      }
      setEditingCardId(null);
    } else {
      // Create new card
      const newCard = {
        id: Date.now().toString(),
        ...cardConfig
      };
      setCustomCards(prev => [...prev, newCard]);
      // Set the chartType state for the new card
      if (cardConfig.chartType) {
        setCustomCardChartTypes(prev => ({
          ...prev,
          [newCard.id]: cardConfig.chartType
        }));
      }
    }
    setShowCustomCardModal(false);
    
    // Scroll to the newly created/edited card after a short delay to ensure DOM is updated
    setTimeout(() => {
      if (customCardsSectionRef.current) {
        customCardsSectionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' 
        });
      } else {
        // Fallback: scroll to bottom of page if ref is not available
        window.scrollTo({ 
          top: document.documentElement.scrollHeight, 
          behavior: 'smooth' 
        });
      }
    }, 100);
  }, [editingCardId]);

  const handleEditCustomCard = useCallback((cardId) => {
    setEditingCardId(cardId);
    setShowCustomCardModal(true);
  }, []);

  const handleDeleteCustomCard = useCallback((cardId) => {
    setCustomCards(prev => prev.filter(card => card.id !== cardId));
  }, []);

  // Helper function for compact currency formatting (for salesperson chart)
  const formatCompactCurrency = (value) => {
    if (!value || value === 0) return '₹0.00';
    const absValue = Math.abs(value);
    let formatted = '';
    let unit = '';
    if (absValue >= 10000000) {
      formatted = '₹' + (absValue / 10000000).toFixed(2);
      unit = ' Crore';
    } else if (absValue >= 100000) {
      formatted = '₹' + (absValue / 100000).toFixed(2);
      unit = ' L';
    } else if (absValue >= 1000) {
      formatted = '₹' + (absValue / 1000).toFixed(2);
      unit = ' K';
    } else {
      formatted = '₹' + absValue.toFixed(2);
    }
    return formatted + unit;
  };

  // Color palette for salesperson treemap
  const salespersonColorPalette = [
    '#3182ce', '#e53e3e', '#38a169', '#d69e2e', '#805ad5',
    '#dd6b20', '#319795', '#c53030', '#2c5282', '#276749',
    '#744210', '#553c9a', '#7c2d12', '#234e52', '#742a2a',
    '#1a365d', '#22543d', '#78350f', '#5b21b6', '#702459',
    '#97266d', '#702459', '#553c9a', '#4c1d95', '#3c366b',
    '#2d3748', '#1a202c', '#2c5282', '#2c7a7b', '#2f855a',
    '#38a169', '#48bb78', '#68d391', '#9ae6b4', '#c6f6d5',
    '#f6e05e', '#fbd38d', '#fc8181', '#f687b3', '#b794f4',
    '#9f7aea', '#7c3aed', '#6b46c1', '#553c9a', '#4c1d95',
    '#44337a', '#322659', '#2d1b69', '#1a202c', '#1e3a8a',
    '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  ];

  // Get all unique salespersons from sales data
  const allSalespersons = useMemo(() => {
    if (!sales || sales.length === 0) return [];
    const uniqueSalespersons = new Set();
    sales.forEach((sale) => {
      const salespersonName = sale.salesperson || 'Unassigned';
      uniqueSalespersons.add(salespersonName);
    });
    return Array.from(uniqueSalespersons).sort();
  }, [sales]);

  // Determine if a salesperson is currently enabled/included
  const isSalespersonEnabled = (salespersonName) => {
    if (enabledSalespersons.size === 0) {
      return false; // None selected (all excluded)
    }
    return enabledSalespersons.has(salespersonName);
  };

  const formatElapsedTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours}h ${mins}m ${secs}s`;
    }
  };

  const formatPeriodLabel = (period) => {
    if (!period) return '';
    const [year, month] = period.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return period;
    return `${monthNames[monthIndex]} ${year}`;
  };

  const transactionColumns = useMemo(() => ([
    { key: 'date', label: 'Date' },
    { key: 'vchno', label: 'Voucher No' },
    { key: 'vchtype', label: 'Voucher Type' },
    { key: 'customer', label: 'Customer' },
    { key: 'item', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'region', label: 'State' },
    { key: 'country', label: 'Country' },
    { key: 'salesperson', label: 'Salesperson' },
    { key: 'quantity', label: 'Quantity', format: 'number' },
    { key: 'amount', label: 'Amount (₹)', format: 'currency' },
  ]), []);

  const buildTransactionRows = useCallback((salesList) => (
    salesList.map((sale) => {
      // Ensure vchtype is a string, not an object
      let vchtypeValue = '';
      if (sale.vchtype) {
        if (typeof sale.vchtype === 'string') {
          vchtypeValue = sale.vchtype;
        } else if (typeof sale.vchtype === 'object') {
          // If it's an object, try to extract a meaningful value or convert to string
          vchtypeValue = JSON.stringify(sale.vchtype);
        } else {
          vchtypeValue = String(sale.vchtype);
        }
      }
      
      return {
        date: sale.cp_date || sale.date,
        vchno: sale.vchno || '',
        vchtype: vchtypeValue,
        customer: sale.customer || '-',
        item: sale.item || '-',
        category: sale.category || '-',
        region: sale.region || '-',
        country: sale.country || 'Unknown',
        salesperson: sale.salesperson || 'Unassigned',
        quantity: Number.isFinite(sale.quantity) ? sale.quantity : parseFloat(sale.quantity) || 0,
        amount: sale.amount || 0,
        masterid: sale.masterid, // Include masterid for direct voucher details access
        masterId: sale.masterid, // Also include as masterId for compatibility
      };
    })
  ), []);

  // NOTE: This function ONLY filters existing sales data - NO API calls are made
  // All data is already available from the initial loadSales() call
  const openTransactionRawData = useCallback((title, predicate) => {
    // Filter the already-loaded sales data - no API call needed
    const filtered = filteredSales.filter(predicate);
    console.log('🔍 openTransactionRawData (using existing data, no API call):', {
      title,
      totalFilteredSales: filteredSales.length,
      filteredCount: filtered.length,
      sampleSale: filteredSales[0],
      sampleFiltered: filtered[0]
    });
    const rows = buildTransactionRows(filtered);
    setRawDataModal({
      open: true,
      title,
      columns: transactionColumns,
      rows,
      rowAction: null,
    });
    setRawDataSearch('');
    setRawDataPage(1);
  }, [buildTransactionRows, filteredSales, transactionColumns]);

  // NOTE: fetchBillDrilldown is no longer needed - we use existing sales data
  // DISABLED: API calls removed - sales dashboard uses cache only
  // Keeping for backward compatibility but it's not used anymore
  const fetchBillDrilldown_DEPRECATED = useCallback(async (ledgerName, billName, salesperson) => {
    // API calls disabled - sales dashboard uses cache only
    console.warn('⚠️ fetchBillDrilldown_DEPRECATED called but API calls are disabled. Use cached data instead.');
    setShowDrilldown(true);
    setDrilldownLoading(false);
    setDrilldownError('API calls are disabled. Sales dashboard uses cache only.');
    setSelectedBill({ ledgerName, billName, salesperson });
    return;
    
    /* DISABLED - API calls removed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setShowDrilldown(true);
    setDrilldownLoading(true);
    setDrilldownError(null);
    setSelectedBill({ ledgerName, billName, salesperson });

    try {
      const companyInfo = getCompanyInfo();
      if (!companyInfo || !companyInfo.company || !companyInfo.tallyloc_id || !companyInfo.guid) {
        throw new Error('Company information is missing. Please select a company first.');
      }
      
      const companyName = cleanAndEscapeForXML(companyInfo.company);
      const escapedLedgerName = escapeForXML(ledgerName);
      const escapedBillName = escapeForXML(billName);
      
      console.log('🔍 Fetching bill drilldown:', {
        ledgerName,
        billName,
        salesperson,
        companyName,
        tallyloc_id: companyInfo.tallyloc_id,
        guid: companyInfo.guid
      });

      let booksFromDate = '1-Apr-00';
      const dateMatch = companyInfo.company.match(/from\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})/i);
      if (dateMatch && dateMatch[1]) {
        booksFromDate = dateMatch[1];
      }

      const drilldownXML = `<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Data</TYPE>
		<ID>ODBC Report</ID>
	</HEADER>
	<BODY>
		<DESC>		
			<STATICVARIABLES>
				<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
			</STATICVARIABLES>	
            <TDL>
            <TDLMESSAGE>
            <COLLECTION NAME="TC Ledger Receivables" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <TYPE>Bills</TYPE>
                <CHILDOF>&quot;${escapedLedgerName}&quot;</CHILDOF>
                <NATIVEMETHOD>Name</NATIVEMETHOD>
                <FILTERS>TCBillNameFilt</FILTERS>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntries" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <COLLECTIONS>TCLR LedEntriesOB, TCLR LedEntriesVch</COLLECTIONS>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntriesOB" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <TYPE>Bills</TYPE>
                <CHILDOF>&quot;${escapedLedgerName}&quot;</CHILDOF>
                <NATIVEMETHOD>Parent, BillDate, Name</NATIVEMETHOD>
                <FILTERS>TCOBLines, TCBillNameFilt</FILTERS>
                <METHOD>VoucherTypeName : &quot;Opening Balance&quot;</METHOD>
                <METHOD>LedBillAmount  : $ClosingBalance</METHOD>
                <METHOD>Date   : $BillDate</METHOD>
                <METHOD>Object  : &quot;Ledger&quot;</METHOD>
                <METHOD>MasterID  : $MasterID:Ledger:$Parent</METHOD>
            </COLLECTION>
            <COLLECTION NAME="TCLR LedEntriesVch" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
                <SOURCECOLLECTION>TC Ledger Receivables</SOURCECOLLECTION>
                <WALK>LedgerEntries</WALK>
                <NATIVEMETHOD>MasterID, Date, VoucherTypeName, Narration</NATIVEMETHOD>
                <METHOD>Name : $$Owner:$Name</METHOD>
                <METHOD>Parent : $$Owner:$Parent</METHOD>
                <METHOD>Object : &quot;Voucher&quot;</METHOD>
                <METHOD>LedBillAmount : $$GetVchBillAmt:($$Owner:$Name):($$Owner:$Parent):No</METHOD>
            </COLLECTION>
            <SYSTEM TYPE="Formulae" NAME="TCBillsOfGroupName" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$$IsLedOfGrp:$Parent:##GroupName   </SYSTEM>
            <SYSTEM TYPE="Formulae" NAME="TCBillNameFilt" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$Name=&quot;${escapedBillName}&quot;   </SYSTEM>
            <SYSTEM TYPE="Formulae" NAME="TCOBLines" ISMODIFY="No" ISFIXED="No" ISINTERNAL="No">$BillDate &lt; $$Date:&quot;${booksFromDate}&quot;   
            </SYSTEM>
            </TDLMESSAGE>
            </TDL>
			<SQLREQUEST TYPE="Prepare" METHOD="SQLPrepare">
				select 
                    $MASTERID as MasterID,
                    $Name as BillName,
                    $$String:$Date:UniversalDate as Date,
                    $VoucherTypeName as VchType,
                    $Narration as Narration,
                    $LedBillAmount as Amount,
                    $ClosingBalance:Ledger:$Parent as 'Customer Balance'
				from TCLRLedEntries
			</SQLREQUEST>
		</DESC>
	</BODY>
</ENVELOPE>`;

      const token = getAuthToken();
      const apiUrl = getTallyDataUrl();
      console.log('🔍 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': companyInfo.tallyloc_id.toString(),
          'x-company': companyName,
          'x-guid': companyInfo.guid,
        },
        body: drilldownXML,
        signal: abortController.signal,
      });

      console.log('🔍 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const xmlText = await response.text();
      console.log('🔍 XML Response length:', xmlText.length);
      const parsed = parseXml(xmlText);
      console.log('🔍 Parsed data:', parsed);
      setDrilldownData(parsed);
    } catch (err) {
      console.error('🔍 fetchBillDrilldown error:', err);
      if (err.name !== 'AbortError') {
        const errorMessage = err.message || 'Failed to fetch bill details. Please check your connection and try again.';
        setDrilldownError(errorMessage);
      }
    } finally {
      setDrilldownLoading(false);
      abortControllerRef.current = null;
    }
    */ // End of disabled code
  }, []);

  // NOTE: fetchVoucherDetails is no longer needed - we use existing sales data
  // Keeping for backward compatibility but it's not used anymore
  const fetchVoucherDetails_DEPRECATED = useCallback(async (masterId) => {
    // API calls disabled - sales dashboard uses cache only
    console.warn('⚠️ fetchVoucherDetails_DEPRECATED called but API calls are disabled. Use cached data instead.');
    setShowVoucherDetails(true);
    setVoucherDetailsLoading(false);
    setVoucherDetailsError('API calls are disabled. Sales dashboard uses cache only.');
    return;
    
    /* DISABLED - API calls removed
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setShowVoucherDetails(true);
    setVoucherDetailsLoading(true);
    setVoucherDetailsError(null);

    try {
      const companyInfo = getCompanyInfo();
      if (!companyInfo || !companyInfo.company || !companyInfo.tallyloc_id || !companyInfo.guid) {
        throw new Error('Company information is missing. Please select a company first.');
      }
      
      const companyName = cleanAndEscapeForXML(companyInfo.company);
      const escapedMasterId = escapeForXML(masterId.toString());
      
      console.log('🔍 Fetching voucher details:', {
        masterId,
        companyName,
        tallyloc_id: companyInfo.tallyloc_id,
        guid: companyInfo.guid
      });

      const voucherXML = `<ENVELOPE>
	<HEADER>
		<VERSION>1</VERSION>
		<TALLYREQUEST>Export</TALLYREQUEST>
		<TYPE>Data</TYPE>
		<ID>CP_Vouchers</ID>
	</HEADER>
	<BODY>
		<DESC>
			<STATICVARIABLES>
				<EXPORTFLAG>YES</EXPORTFLAG>
				<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
				<SVCURRENTCOMPANY>${companyName}</SVCURRENTCOMPANY>
			</STATICVARIABLES>
			<TDL>
				<TDLMESSAGE>
					<REPORT NAME="CP_Vouchers">
						<FORMS>CP_Vouchers</FORMS>
						<KEEPXMLCASE>Yes</KEEPXMLCASE>
						<OBJECTS>VOUCHER : $$Sprintf:@@VchMasterId:${escapedMasterId}</OBJECTS>
					</REPORT>
					<FORM NAME="CP_Vouchers">
						<TOPPARTS>CP_Vouchers</TOPPARTS>
					</FORM>
					<PART NAME="CP_Vouchers">
						<TOPLINES>CP_Vouchers</TOPLINES>
						<SCROLLED>Vertical</SCROLLED>
					</PART>
					<LINE NAME="CP_Vouchers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"VOUCHERS"</XMLTAG>
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3, CP_Temp4, CP_Temp5, CP_Temp6, CP_Temp7</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$MASTERID</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as :$DATE</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as :$VOUCHERTYPENAME</LOCAL>
						<LOCAL>Field : CP_Temp4 : Set as :$VOUCHERNUMBER</LOCAL>
						<LOCAL>Field : CP_Temp5 : Set as : $$IfDr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp6 : Set as : $$IfCr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp7 : Set as : $NARRATION</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "MASTERID"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "DATE"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "VOUCHERTYPE"</LOCAL>
						<LOCAL>Field : CP_Temp4  : XMLTag : "VOUCHERNUMBER"</LOCAL>
						<LOCAL>Field : CP_Temp5  : XMLTag : "DEBITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp6  : XMLTag : "CREDITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp7  : XMLTag : "NARRATION"</LOCAL>
						<Explode>CP_Ledgers : Yes</Explode>
					</LINE>
					<PART NAME="CP_Ledgers" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<TOPLINES>CP_LedgerLine</TOPLINES>
						<SCROLLED>Vertical</SCROLLED>
					</PART>
					<LINE NAME="CP_LedgerLine" ISMODIFY="No" ISFIXED="No" ISINITIALIZE="No" ISOPTION="No" ISINTERNAL="No">
						<XMLTAG>"LEDGERS"</XMLTAG>
						<LEFTFIELDS>CP_LedgerTemp1, CP_LedgerTemp2, CP_LedgerTemp3</LEFTFIELDS>
						<LOCAL>Field : CP_LedgerTemp1 : Set as :$NAME</LOCAL>
						<LOCAL>Field : CP_LedgerTemp2 : Set as :$LEDGERAMOUNT</LOCAL>
						<LOCAL>Field : CP_LedgerTemp3 : Set as :$MASTERID</LOCAL>
						<LOCAL>Field : CP_LedgerTemp1 : XMLTag : "NAME"</LOCAL>
						<LOCAL>Field : CP_LedgerTemp2 : XMLTag : "AMOUNT"</LOCAL>
						<LOCAL>Field : CP_LedgerTemp3 : XMLTag : "MASTERID"</LOCAL>
					</LINE>
				</TDLMESSAGE>
			</TDL>
		</DESC>
	</BODY>
</ENVELOPE>`;

      const token = getAuthToken();
      const apiUrl = getTallyDataUrl();
      console.log('🔍 Voucher API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/xml',
          'x-tallyloc-id': companyInfo.tallyloc_id.toString(),
          'x-company': companyName,
          'x-guid': companyInfo.guid,
        },
        body: voucherXML,
        signal: abortController.signal,
      });

      console.log('🔍 Voucher Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 Voucher API Error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const xmlText = await response.text();
      console.log('🔍 Voucher XML Response length:', xmlText.length);
      const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        console.error('🔍 XML Parse Error:', parserError.textContent);
        throw new Error('Failed to parse XML response: ' + parserError.textContent);
      }

      const vouchers = xmlDoc.getElementsByTagName('VOUCHERS');
      if (!vouchers || vouchers.length === 0) {
        throw new Error('No voucher data found');
      }

      const groupSiblings = (vouchers) => {
        const result = [];
        for (let i = 0; i < vouchers.length; i++) {
          const voucher = vouchers[i];
          const masterId = voucher.getElementsByTagName('MASTERID')[0]?.textContent || '';
          const date = voucher.getElementsByTagName('DATE')[0]?.textContent || '';
          const voucherType = voucher.getElementsByTagName('VOUCHERTYPE')[0]?.textContent || '';
          const voucherNumber = voucher.getElementsByTagName('VOUCHERNUMBER')[0]?.textContent || '';
          const debitAmt = voucher.getElementsByTagName('DEBITAMT')[0]?.textContent || '';
          const creditAmt = voucher.getElementsByTagName('CREDITAMT')[0]?.textContent || '';

          const ledgers = [];
          const ledgerElements = voucher.getElementsByTagName('LEDGERS');
          for (let j = 0; j < ledgerElements.length; j++) {
            const ledger = ledgerElements[j];
            const name = ledger.getElementsByTagName('NAME')[0]?.textContent || '';
            const amount = ledger.getElementsByTagName('AMOUNT')[0]?.textContent || '';
            const ledgerMasterId = ledger.getElementsByTagName('MASTERID')[0]?.textContent || '';
            ledgers.push({ NAME: name, AMOUNT: amount, MASTERID: ledgerMasterId });
          }

          result.push({
            MASTERID: masterId,
            DATE: date,
            VOUCHERTYPE: voucherType,
            VOUCHERNUMBER: voucherNumber,
            DEBITAMT: debitAmt,
            CREDITAMT: creditAmt,
            LEDGERS: ledgers,
          });
        }
        return result;
      };

      const voucherObj = groupSiblings(vouchers);
      console.log('🔍 Voucher details parsed:', voucherObj);
      setVoucherDetailsData({ VOUCHERS: voucherObj });
    } catch (err) {
      console.error('🔍 fetchVoucherDetails error:', err);
      if (err.name !== 'AbortError') {
        const errorMessage = err.message || 'Failed to fetch voucher details. Please check your connection and try again.';
        setVoucherDetailsError(errorMessage);
      }
    } finally {
      setVoucherDetailsLoading(false);
      abortControllerRef.current = null;
    }
    */ // End of disabled code
  }, []);

  // Handle voucher row click - use existing sales data
  const handleVoucherRowClick = useCallback((masterId) => {
    if (!masterId) return;

    // Find the voucher in existing sales data by masterid
    const voucher = sales.find(s => s.masterid === masterId || String(s.masterid) === String(masterId));
    
    if (voucher) {
      // Find all items in this voucher (same masterid and vchno)
      const voucherItems = sales.filter(s => 
        (s.masterid === voucher.masterid || String(s.masterid) === String(voucher.masterid)) &&
        s.vchno === voucher.vchno
      );

      // Calculate total amount
      const totalAmount = voucherItems.reduce((sum, item) => sum + (item.amount || 0), 0);
      
      // Aggregate tax values from all items in the voucher
      const totalCGST = voucherItems.reduce((sum, item) => sum + (item.cgst || item.CGST || 0), 0);
      const totalSGST = voucherItems.reduce((sum, item) => sum + (item.sgst || item.SGST || 0), 0);
      const totalRoundOff = voucherItems.reduce((sum, item) => sum + (item.roundoff || item.ROUNDOFF || item.round_off || 0), 0);
      
      // If tax values are not available, calculate them
      // Assuming 18% GST (9% CGST + 9% SGST) on taxable amount if not provided
      const hasTaxData = totalCGST > 0 || totalSGST > 0;
      let cgstValue = totalCGST;
      let sgstValue = totalSGST;
      
      if (!hasTaxData && totalAmount > 0) {
        // Calculate CGST and SGST as 9% each of taxable amount (assuming 18% GST)
        const taxableAmount = totalAmount / 1.18; // Remove GST to get taxable amount
        cgstValue = taxableAmount * 0.09;
        sgstValue = taxableAmount * 0.09;
      }
      
      const roundOffValue = totalRoundOff;

      // Get narration from CP_Temp7 field (XML tag is "NARRATION" per line 1869)
      // Check NARRATION first since that's the XML tag, then fallback to CP_Temp7
      // The sales data has CP_Temp7 field from the transformation
      const narration = voucher.CP_Temp7 || voucher.cp_temp7 || voucher.NARRATION || voucher.narration || voucher.Narration || '';
      
      // Debug: Log narration extraction
      console.log('🔍 Extracting narration for voucher:', {
        masterid: voucher.masterid,
        vchno: voucher.vchno,
        CP_Temp7: voucher.CP_Temp7,
        cp_temp7: voucher.cp_temp7,
        NARRATION: voucher.NARRATION,
        narration: voucher.narration,
        extractedNarration: narration
      });

      // Transform to match VoucherDetailsModal format from Receivables Dashboard
      const voucherData = {
        VOUCHERS: {
          MASTERID: voucher.masterid,
          DATE: voucher.cp_date || voucher.date || '',
          VOUCHERTYPE: voucher.issales ? 'Sales' : 'Other',
          VOUCHERNUMBER: voucher.vchno || '',
          VCHNO: voucher.vchno || '',
          VCHTYPE: voucher.issales ? 'Sales' : 'Other',
          DEBITAMT: voucher.issales ? totalAmount : 0,
          CREDITAMT: voucher.issales ? 0 : totalAmount,
          NARRATION: narration || '', // Always include NARRATION field
          PARTICULARS: voucher.customer || '',
          // Format ledger entries to match expected structure
          ALLLEDGERENTRIES: [
            // Customer ledger entry (debit for sales) with bill allocation
            {
              LEDGERNAME: voucher.customer || 'Unknown',
              DEBITAMT: voucher.issales ? totalAmount : 0,
              CREDITAMT: 0,
              BILLALLOCATIONS: voucher.issales ? [{
                BILLNAME: voucher.vchno || '',
                DEBITAMT: totalAmount,
                CREDITAMT: 0
              }] : [],
              INVENTORYALLOCATIONS: []
            },
            // Sales ledger entry (credit for sales) with inventory allocations
            ...(voucher.issales ? [{
              LEDGERNAME: 'Sales',
              DEBITAMT: 0,
              CREDITAMT: totalAmount,
              BILLALLOCATIONS: [],
              INVENTORYALLOCATIONS: voucherItems.map(item => ({
                STOCKITEMNAME: item.item || 'Unknown',
                BILLEQTY: item.quantity || 0,
                ACTUALQTY: item.quantity || 0,
                RATE: item.quantity > 0 ? ((item.amount / item.quantity).toFixed(2)) : '0.00',
                DISCOUNT: '0',
                AMOUNT: item.amount || 0,
                VALUE: item.amount || 0
              })),
              // Add CGST, SGST, and ROUND OFF to the Sales ledger entry
              CGST: cgstValue,
              SGST: sgstValue,
              ROUNDOFF: roundOffValue
            }] : [])
          ]
        }
      };

      setVoucherDetailsData(voucherData);
      setShowVoucherDetails(true);
      setVoucherDetailsLoading(false);
      setVoucherDetailsError(null);
    } else {
      setVoucherDetailsError('Voucher not found in current data.');
      setShowVoucherDetails(true);
      setVoucherDetailsLoading(false);
    }
  }, [sales]);

  // Handle bill row click from raw data - go directly to voucher details modal
  const handleBillRowClick = useCallback((row) => {
    // Get masterid from the row to open voucher details directly
    const masterId = row.masterid || row.masterId;
    
    if (masterId) {
      // Directly open voucher details modal
      handleVoucherRowClick(masterId);
    } else {
      // Fallback: try to find by customer and voucher number
      const customer = row.customer || '';
      const voucherNo = row.vchno || row.voucherNo || '';
      
      if (customer && voucherNo) {
        // Find the first transaction matching customer and voucher number
        const transaction = sales.find(sale => 
          sale.customer === customer && sale.vchno === voucherNo
        );
        
        if (transaction && transaction.masterid) {
          handleVoucherRowClick(transaction.masterid);
        } else {
          setVoucherDetailsError('Voucher not found in current data.');
          setShowVoucherDetails(true);
          setVoucherDetailsLoading(false);
        }
      }
    }
  }, [sales, handleVoucherRowClick]);

  // Helper function to create SVG charts
  const createBarChart = (data, title, width = 600, height = 300) => {
    if (!data || data.length === 0) return '';
    
    // Filter out invalid items and ensure data has valid structure
    const validData = data.filter(d => d && d.value !== undefined && d.value !== null && d.label !== undefined && d.label !== null);
    if (validData.length === 0) return '';
    
    const maxValue = Math.max(...validData.map(d => d.value));
    if (maxValue === 0 || !isFinite(maxValue)) return '';
    
    const barWidth = (width - 100) / validData.length;
    const barHeight = height - 80;
    
    let svg = `<svg width="${width}" height="${height}" style="border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
      <text x="${width/2}" y="20" text-anchor="middle" style="font-size: 16px; font-weight: bold; fill: #1e293b;">${title}</text>`;
    
    validData.slice(0, 10).forEach((item, index) => {
      const x = 50 + index * barWidth;
      const barH = (item.value / maxValue) * barHeight;
      const y = height - 30 - barH;
      const label = item.label || 'Unknown';
      const displayLabel = label.length > 8 ? label.substring(0, 8) + '...' : label;
      
      svg += `
        <rect x="${x + 5}" y="${y}" width="${barWidth - 10}" height="${barH}" fill="${item.color || '#3b82f6'}" />
        <text x="${x + barWidth/2}" y="${height - 10}" text-anchor="middle" style="font-size: 10px; fill: #64748b;">${displayLabel}</text>
        <text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" style="font-size: 10px; fill: #1e293b; font-weight: bold;">${formatCurrency(item.value)}</text>
      `;
    });
    
    svg += '</svg>';
    return svg;
  };

  const createPieChart = (data, title, size = 300) => {
    if (!data || data.length === 0) return '';
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 3;
    
    let currentAngle = -90;
    let svg = `<svg width="${size}" height="${size}" style="border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
      <text x="${centerX}" y="20" text-anchor="middle" style="font-size: 16px; font-weight: bold; fill: #1e293b;">${title}</text>`;
    
    data.slice(0, 8).forEach((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const start = polarToCartesian(centerX, centerY, radius, endAngle);
      const end = polarToCartesian(centerX, centerY, radius, startAngle);
      const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
      
      svg += `<path d="M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z" fill="${item.color || '#3b82f6'}" />`;
      
      currentAngle = endAngle;
    });
    
    svg += '</svg>';
    return svg;
  };

  const polarToCartesian = (centerX, centerY, radius, angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: centerX + radius * Math.cos(radians),
      y: centerY + radius * Math.sin(radians)
    };
  };

  // Export functions
  const exportToPDF = () => {
    try {
      // Create a new window for PDF content
      const printWindow = window.open('', '_blank');
      const currentDate = new Date().toLocaleDateString('en-IN');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sales Analytics Dashboard - ${currentDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .header h1 { color: #3b82f6; margin: 0; }
            .header p { color: #666; margin: 5px 0; }
            .metrics { display: flex; justify-content: space-around; margin: 30px 0; flex-wrap: wrap; }
            .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; min-width: 150px; margin: 10px; }
            .metric-title { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #1e293b; }
            .filters { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .filter-item { display: inline-block; background: #e0e7ff; padding: 5px 10px; border-radius: 15px; margin: 5px; font-size: 12px; color: #3730a3; }
            .chart-section { margin: 30px 0; }
            .chart-title { font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 15px; }
            .chart-container { display: flex; justify-content: center; margin: 20px 0; }
            .chart-data { background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .chart-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
            .chart-row:last-child { border-bottom: none; }
            .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 12px; }
            @media print {
              body { margin: 0; }
              .metric-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Analytics Dashboard</h1>
            <p>Generated on: ${currentDate}</p>
            <p>Date Range: ${fromDate} to ${toDate}</p>
          </div>
          
          <div class="metrics">
            <div class="metric-card">
              <div class="metric-title">Total Revenue</div>
              <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Total Invoices</div>
              <div class="metric-value">${totalOrders}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Total Quantity</div>
              <div class="metric-value">${totalQuantity.toLocaleString()}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Unique Customers</div>
              <div class="metric-value">${uniqueCustomers}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Avg Invoice Value</div>
              <div class="metric-value">${formatCurrency(avgOrderValue)}</div>
            </div>
            ${canShowProfit ? `
            <div class="metric-card">
              <div class="metric-title">Total Profit</div>
              <div class="metric-value">${formatCurrency(totalProfit)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Profit Margin</div>
              <div class="metric-value">${profitMargin >= 0 ? '+' : ''}${profitMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Avg Profit per Order</div>
              <div class="metric-value">${formatCurrency(avgProfitPerOrder)}</div>
            </div>
            ` : ''}
          </div>
          
          ${hasActiveFilters ? `
          <div class="filters">
            <strong>Active Filters:</strong><br>
            ${selectedCustomer !== 'all' ? `<span class="filter-item">Customer: ${selectedCustomer}</span>` : ''}
            ${selectedItem !== 'all' ? `<span class="filter-item">Item: ${selectedItem}</span>` : ''}
            ${selectedStockGroup !== 'all' ? `<span class="filter-item">Stock Group: ${selectedStockGroup}</span>` : ''}
            ${selectedRegion !== 'all' ? `<span class="filter-item">State: ${selectedRegion}</span>` : ''}
            ${selectedCountry !== 'all' ? `<span class="filter-item">Country: ${selectedCountry}</span>` : ''}
            ${selectedPeriod ? `<span class="filter-item">Period: ${formatPeriodLabel(selectedPeriod)}</span>` : ''}
          </div>
          ` : ''}
          
          <div class="chart-section">
            <div class="chart-title">Sales by Stock Group</div>
            <div class="chart-container">
              ${createBarChart(categoryChartData, 'Sales by Stock Group')}
            </div>
            <div class="chart-data">
              ${categoryChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Sales by State</div>
            <div class="chart-container">
              ${createPieChart(regionChartData, 'Sales by State')}
            </div>
            <div class="chart-data">
              ${regionChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Sales by Country</div>
            <div class="chart-container">
              ${createPieChart(countryChartData, 'Sales by Country')}
            </div>
            <div class="chart-data">
              ${countryChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Customers by Revenue</div>
            <div class="chart-container">
              ${createBarChart(topCustomersData, 'Top Customers by Revenue')}
            </div>
            <div class="chart-data">
              ${topCustomersData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Items by Revenue</div>
            <div class="chart-container">
              ${createBarChart(topItemsByRevenueData, 'Top Items by Revenue')}
            </div>
            <div class="chart-data">
              ${topItemsByRevenueData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Items by Quantity</div>
            <div class="chart-container">
              ${createBarChart(topItemsByQuantityData, 'Top Items by Quantity', 600, 300, '')}
            </div>
            <div class="chart-data">
              ${topItemsByQuantityData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${item.value.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          ${periodChartData && periodChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Sales by Period</div>
            <div class="chart-container">
              ${createBarChart(periodChartData, 'Sales by Period')}
            </div>
            <div class="chart-data">
              ${periodChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${salespersonTotals && salespersonTotals.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Salesperson Totals</div>
            <div class="chart-container">
              ${createBarChart(salespersonTotals, 'Salesperson Totals')}
            </div>
            <div class="chart-data">
              ${salespersonTotals.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && revenueVsProfitChartData && revenueVsProfitChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Revenue vs Profit (Monthly)</div>
            <div class="chart-container">
              ${createBarChart(revenueVsProfitChartData.map(d => ({ label: d.label, value: d.revenue })), 'Revenue', 600, 300, '₹')}
              ${createBarChart(revenueVsProfitChartData.map(d => ({ label: d.label, value: Math.abs(d.profit) })), 'Profit', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${revenueVsProfitChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>Revenue: ${formatCurrency(item.revenue)} | Profit: ${formatCurrency(item.profit)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && monthWiseProfitChartData && monthWiseProfitChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Month-wise Profit</div>
            <div class="chart-container">
              ${createBarChart(monthWiseProfitChartData, 'Month-wise Profit', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${monthWiseProfitChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && topProfitableItemsData && topProfitableItemsData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Top 10 Profitable Items</div>
            <div class="chart-container">
              ${createBarChart(topProfitableItemsData, 'Top 10 Profitable Items', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${topProfitableItemsData.map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && topLossItemsData && topLossItemsData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Top 10 Loss Items</div>
            <div class="chart-container">
              ${createBarChart(topLossItemsData, 'Top 10 Loss Items', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${topLossItemsData.map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${customCards && customCards.length > 0 ? customCards.map(card => {
            const cardData = generateCustomCardData(card, filteredSales);
            if (!cardData || cardData.length === 0) return '';
            return `
            <div class="chart-section">
              <div class="chart-title">${card.title || 'Custom Card'}</div>
              <div class="chart-container">
                ${createBarChart(cardData, card.title || 'Custom Card')}
              </div>
              <div class="chart-data">
                ${cardData.slice(0, 20).map(item => `
                  <div class="chart-row">
                    <span>${item.label || 'Unknown'}</span>
                    <span>${typeof item.value === 'number' ? (item.value % 1 === 0 ? item.value.toLocaleString() : item.value.toFixed(2)) : item.value}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          }).join('') : ''}
          
          <div class="footer">
            <p>Report generated by DataLynk Sales Dashboard</p>
            <p>Total Records: ${filteredSales.length}</p>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const exportToExcel = () => {
    try {
      // Create workbook data
      const workbookData = {
        'Sales Summary': [
          ['Metric', 'Value'],
          ['Total Revenue', totalRevenue],
          ['Total Invoices', totalOrders],
          ['Total Quantity', totalQuantity],
          ['Unique Customers', uniqueCustomers],
          ['Average Invoice Value', avgOrderValue],
          ...(canShowProfit ? [
            ['Total Profit', totalProfit],
            ['Profit Margin (%)', profitMargin],
            ['Avg Profit per Order', avgProfitPerOrder]
          ] : []),
          ['Date Range', `${fromDate} to ${toDate}`],
          ['Total Records', filteredSales.length]
        ],
        'Stock Groups': [
          ['Stock Group', 'Revenue'],
          ...categoryChartData.map(item => [item.label, item.value])
        ],
        'States': [
          ['State', 'Revenue'],
          ...regionChartData.map(item => [item.label, item.value])
        ],
        'Countries': [
          ['Country', 'Revenue'],
          ...countryChartData.map(item => [item.label, item.value])
        ],
        'Top Customers': [
          ['Customer', 'Revenue'],
          ...topCustomersData.map(item => [item.label, item.value])
        ],
        'Top Items by Revenue': [
          ['Item', 'Revenue'],
          ...topItemsByRevenueData.map(item => [item.label, item.value])
        ],
        'Top Items by Quantity': [
          ['Item', 'Quantity'],
          ...topItemsByQuantityData.map(item => [item.label, item.value])
        ],
        ...(periodChartData.length > 0 ? {
          'Sales by Period': [
            ['Period', 'Revenue'],
            ...periodChartData.map(item => [item.label, item.value])
          ]
        } : {}),
        ...(salespersonTotals.length > 0 ? {
          'Salesperson Totals': [
            ['Salesperson', 'Revenue'],
            ...salespersonTotals.map(item => [item.label, item.value])
          ]
        } : {}),
        ...(canShowProfit && revenueVsProfitChartData && revenueVsProfitChartData.length > 0 ? {
          'Revenue vs Profit': [
            ['Period', 'Revenue', 'Profit'],
            ...revenueVsProfitChartData.map(item => [item.label, item.revenue, item.profit])
          ]
        } : {}),
        ...(canShowProfit && monthWiseProfitChartData && monthWiseProfitChartData.length > 0 ? {
          'Month-wise Profit': [
            ['Period', 'Profit'],
            ...monthWiseProfitChartData.map(item => [item.label, item.value])
          ]
        } : {}),
        ...(canShowProfit && topProfitableItemsData && topProfitableItemsData.length > 0 ? {
          'Top Profitable Items': [
            ['Item', 'Profit', 'Revenue'],
            ...topProfitableItemsData.map(item => [item.label, item.value, item.revenue])
          ]
        } : {}),
        ...(canShowProfit && topLossItemsData && topLossItemsData.length > 0 ? {
          'Top Loss Items': [
            ['Item', 'Loss', 'Revenue'],
            ...topLossItemsData.map(item => [item.label, item.value, item.revenue])
          ]
        } : {}),
        ...(customCards && customCards.length > 0 ? customCards.reduce((acc, card) => {
          const cardData = generateCustomCardData(card, filteredSales);
          if (cardData && cardData.length > 0) {
            acc[card.title || `Custom Card ${card.id}`] = [
              ['Label', 'Value'],
              ...cardData.map(item => [item.label || 'Unknown', typeof item.value === 'number' ? (item.value % 1 === 0 ? item.value : item.value.toFixed(2)) : item.value])
            ];
          }
          return acc;
        }, {}) : {})
      };

      // Convert to CSV format (simplified Excel export)
      let csvContent = '';
      Object.keys(workbookData).forEach(sheetName => {
        csvContent += `\n=== ${sheetName} ===\n`;
        workbookData[sheetName].forEach(row => {
          csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });
        csvContent += '\n';
      });

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `Sales_Dashboard_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Error exporting to Excel. Please try again.');
    }
  };

  const printDashboard = () => {
    try {
      // Create a new window for print content
      const printWindow = window.open('', '_blank');
      const currentDate = new Date().toLocaleDateString('en-IN');
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sales Analytics Dashboard - ${currentDate}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .header h1 { color: #3b82f6; margin: 0; }
            .header p { color: #666; margin: 5px 0; }
            .metrics { display: flex; justify-content: space-around; margin: 30px 0; flex-wrap: wrap; }
            .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; min-width: 150px; margin: 10px; }
            .metric-title { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #1e293b; }
            .filters { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .filter-item { display: inline-block; background: #e0e7ff; padding: 5px 10px; border-radius: 15px; margin: 5px; font-size: 12px; color: #3730a3; }
            .chart-section { margin: 30px 0; }
            .chart-title { font-size: 16px; font-weight: bold; color: #1e293b; margin-bottom: 15px; }
            .chart-container { display: flex; justify-content: center; margin: 20px 0; }
            .chart-data { background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .chart-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            .chart-row:last-child { border-bottom: none; }
            .footer { margin-top: 50px; text-align: center; color: #64748b; font-size: 12px; }
            @media print {
              body { margin: 0; }
              .metric-card { break-inside: avoid; }
              .chart-section { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Analytics Dashboard</h1>
            <p>Generated on: ${currentDate}</p>
            <p>Date Range: ${fromDate} to ${toDate}</p>
          </div>
          
          <div class="metrics">
            <div class="metric-card">
              <div class="metric-title">Total Revenue</div>
              <div class="metric-value">${formatCurrency(totalRevenue)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Total Invoices</div>
              <div class="metric-value">${totalOrders}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Total Quantity</div>
              <div class="metric-value">${totalQuantity.toLocaleString()}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Unique Customers</div>
              <div class="metric-value">${uniqueCustomers}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Avg Invoice Value</div>
              <div class="metric-value">${formatCurrency(avgOrderValue)}</div>
            </div>
            ${canShowProfit ? `
            <div class="metric-card">
              <div class="metric-title">Total Profit</div>
              <div class="metric-value">${formatCurrency(totalProfit)}</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Profit Margin</div>
              <div class="metric-value">${profitMargin >= 0 ? '+' : ''}${profitMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
            </div>
            <div class="metric-card">
              <div class="metric-title">Avg Profit per Order</div>
              <div class="metric-value">${formatCurrency(avgProfitPerOrder)}</div>
            </div>
            ` : ''}
          </div>
          
          ${hasActiveFilters ? `
          <div class="filters">
            <strong>Active Filters:</strong><br>
            ${selectedCustomer !== 'all' ? `<span class="filter-item">Customer: ${selectedCustomer}</span>` : ''}
            ${selectedItem !== 'all' ? `<span class="filter-item">Item: ${selectedItem}</span>` : ''}
            ${selectedStockGroup !== 'all' ? `<span class="filter-item">Stock Group: ${selectedStockGroup}</span>` : ''}
            ${selectedRegion !== 'all' ? `<span class="filter-item">State: ${selectedRegion}</span>` : ''}
            ${selectedCountry !== 'all' ? `<span class="filter-item">Country: ${selectedCountry}</span>` : ''}
            ${selectedPeriod ? `<span class="filter-item">Period: ${formatPeriodLabel(selectedPeriod)}</span>` : ''}
          </div>
          ` : ''}
          
          <div class="chart-section">
            <div class="chart-title">Sales by Stock Group</div>
            <div class="chart-container">
              ${createBarChart(categoryChartData, 'Sales by Stock Group')}
            </div>
            <div class="chart-data">
              ${categoryChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Sales by State</div>
            <div class="chart-container">
              ${createPieChart(regionChartData, 'Sales by State')}
            </div>
            <div class="chart-data">
              ${regionChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Sales by Country</div>
            <div class="chart-container">
              ${createPieChart(countryChartData, 'Sales by Country')}
            </div>
            <div class="chart-data">
              ${countryChartData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Customers by Revenue</div>
            <div class="chart-container">
              ${createBarChart(topCustomersData, 'Top Customers by Revenue')}
            </div>
            <div class="chart-data">
              ${topCustomersData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Items by Revenue</div>
            <div class="chart-container">
              ${createBarChart(topItemsByRevenueData, 'Top Items by Revenue')}
            </div>
            <div class="chart-data">
              ${topItemsByRevenueData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="chart-section">
            <div class="chart-title">Top Items by Quantity</div>
            <div class="chart-container">
              ${createBarChart(topItemsByQuantityData, 'Top Items by Quantity', 600, 300, '')}
            </div>
            <div class="chart-data">
              ${topItemsByQuantityData.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${item.value.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
          
          ${periodChartData && periodChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Sales by Period</div>
            <div class="chart-container">
              ${createBarChart(periodChartData, 'Sales by Period')}
            </div>
            <div class="chart-data">
              ${periodChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${salespersonTotals && salespersonTotals.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Salesperson Totals</div>
            <div class="chart-container">
              ${createBarChart(salespersonTotals, 'Salesperson Totals')}
            </div>
            <div class="chart-data">
              ${salespersonTotals.slice(0, 10).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && revenueVsProfitChartData && revenueVsProfitChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Revenue vs Profit (Monthly)</div>
            <div class="chart-container">
              ${createBarChart(revenueVsProfitChartData.map(d => ({ label: d.label, value: d.revenue })), 'Revenue', 600, 300, '₹')}
              ${createBarChart(revenueVsProfitChartData.map(d => ({ label: d.label, value: Math.abs(d.profit) })), 'Profit', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${revenueVsProfitChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>Revenue: ${formatCurrency(item.revenue)} | Profit: ${formatCurrency(item.profit)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && monthWiseProfitChartData && monthWiseProfitChartData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Month-wise Profit</div>
            <div class="chart-container">
              ${createBarChart(monthWiseProfitChartData, 'Month-wise Profit', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${monthWiseProfitChartData.slice(0, 12).map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && topProfitableItemsData && topProfitableItemsData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Top 10 Profitable Items</div>
            <div class="chart-container">
              ${createBarChart(topProfitableItemsData, 'Top 10 Profitable Items', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${topProfitableItemsData.map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${canShowProfit && topLossItemsData && topLossItemsData.length > 0 ? `
          <div class="chart-section">
            <div class="chart-title">Top 10 Loss Items</div>
            <div class="chart-container">
              ${createBarChart(topLossItemsData, 'Top 10 Loss Items', 600, 300, '₹')}
            </div>
            <div class="chart-data">
              ${topLossItemsData.map(item => `
                <div class="chart-row">
                  <span>${item.label}</span>
                  <span>${formatCurrency(item.value)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${customCards && customCards.length > 0 ? customCards.map(card => {
            const cardData = generateCustomCardData(card, filteredSales);
            if (!cardData || cardData.length === 0) return '';
            return `
            <div class="chart-section">
              <div class="chart-title">${card.title || 'Custom Card'}</div>
              <div class="chart-container">
                ${createBarChart(cardData, card.title || 'Custom Card')}
              </div>
              <div class="chart-data">
                ${cardData.slice(0, 20).map(item => `
                  <div class="chart-row">
                    <span>${item.label || 'Unknown'}</span>
                    <span>${typeof item.value === 'number' ? (item.value % 1 === 0 ? item.value.toLocaleString() : item.value.toFixed(2)) : item.value}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          }).join('') : ''}
          
          <div class="footer">
            <p>Report generated by DataLynk Sales Dashboard</p>
            <p>Total Records: ${filteredSales.length}</p>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      
    } catch (error) {
      console.error('Error printing dashboard:', error);
      alert('Error printing dashboard. Please try again.');
    }
  };

  loadSalesRef.current = loadSales;

  // Auto-load cached data when tab opens (if cache exists)
  useEffect(() => {
    if (shouldAutoLoad && fromDate && toDate) {
      // Always use cache when auto-loading - don't invalidate cache
      // This ensures the sales dashboard always uses cached data when opening the tab
      loadSalesRef.current?.(fromDate, toDate, { invalidateCache: false });
    }
  }, [shouldAutoLoad, fromDate, toDate]);

  const rawDataIconButtonStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#1e40af',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease, color 0.2s ease'
  };

  const handleRawDataButtonMouseEnter = (event) => {
    event.currentTarget.style.background = '#e0e7ff';
    event.currentTarget.style.color = '#1e3a8a';
  };

  const handleRawDataButtonMouseLeave = (event) => {
    event.currentTarget.style.background = 'transparent';
    event.currentTarget.style.color = '#1e40af';
  };

  // NOTE: This function ONLY uses existing sales data - NO API calls are made
  // All chart data and raw data comes from the initial loadSales() call
  const openRawData = useCallback((type, extra) => {
    let config = null;

    switch (type) {
      case 'stockGroup':
        config = {
          title: 'Sales by Stock Group',
          columns: [
            { key: 'stockGroup', label: 'Stock Group' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: categoryChartData.map((item) => ({
            stockGroup: item.label,
            revenue: item.value,
            categoryKey: item.label,
          })),
          rowAction: {
            icon: 'receipt_long',
            title: 'View transactions',
            onClick: (row) =>
              openRawData('stockGroupItemTransactions', row.categoryKey),
          },
        };
        break;
      case 'stockGroupItemTransactions':
        openTransactionRawData(
          `Raw Data - ${extra}`,
          (sale) => sale.category === extra
        );
        return;
      case 'ledgerGroup':
        config = {
          title: 'Sales by Ledger Group',
          columns: [
            { key: 'ledgerGroup', label: 'Ledger Group' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: ledgerGroupChartData.map((item) => ({
            ledgerGroup: item.label,
            revenue: item.value,
            ledgerGroupKey: item.label,
          })),
          rowAction: {
            icon: 'receipt_long',
            title: 'View transactions',
            onClick: (row) =>
              openRawData('ledgerGroupItemTransactions', row.ledgerGroupKey),
          },
        };
        break;
      case 'ledgerGroupItemTransactions':
        openTransactionRawData(
          `Raw Data - ${extra}`,
          (sale) => sale.ledgerGroup === extra
        );
        return;
      case 'region':
        config = {
          title: 'Sales by State',
          columns: [
            { key: 'region', label: 'State' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: regionChartData.map((item) => ({
            region: item.label,
            revenue: item.value,
            regionKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.region}`,
                (sale) => sale.region === row.regionKey
              ),
          },
        };
        break;
      case 'country':
        config = {
          title: 'Sales by Country',
          columns: [
            { key: 'country', label: 'Country' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: countryChartData.map((item) => ({
            country: item.label,
            revenue: item.value,
            countryKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) => {
              const countryToMatch = String(row.countryKey || 'Unknown').trim();
              console.log('🔍 Filtering by country:', countryToMatch);
              openTransactionRawData(
                `Raw Data - ${row.country}`,
                (sale) => {
                  const saleCountry = String(sale.country || 'Unknown').trim();
                  return saleCountry === countryToMatch;
                }
              );
            },
          },
        };
        break;
      case 'period':
        config = {
          title: 'Sales by Period (Month)',
          columns: [
            { key: 'period', label: 'Period' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: periodChartData.map((item) => ({
            period: item.label,
            revenue: item.value,
            periodKey: item.originalLabel || item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${formatPeriodLabel(row.periodKey)}`,
                (sale) => {
                  const saleDate = sale.cp_date || sale.date;
                  const date = new Date(saleDate);
                  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  return yearMonth === row.periodKey;
                }
              ),
          },
        };
        break;
      case 'topCustomers':
        config = {
          title: 'Top Customers by Revenue',
          columns: [
            { key: 'customer', label: 'Customer' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: topCustomersData.map((item) => ({
            customer: item.label,
            revenue: item.value,
            customerKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.customer}`,
                (sale) => sale.customer === row.customerKey
              ),
          },
        };
        break;
      case 'topItemsRevenue':
        config = {
          title: 'Top Items by Revenue',
          columns: [
            { key: 'item', label: 'Item' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: topItemsByRevenueData.map((item) => ({
            item: item.label,
            revenue: item.value,
            itemKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.item}`,
                (sale) => sale.item === row.itemKey
              ),
          },
        };
        break;
      case 'topItemsQuantity':
        config = {
          title: 'Top Items by Quantity',
          columns: [
            { key: 'item', label: 'Item' },
            { key: 'quantity', label: 'Quantity', format: 'number' },
          ],
          rows: topItemsByQuantityData.map((item) => ({
            item: item.label,
            quantity: item.value,
            itemKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.item}`,
                (sale) => sale.item === row.itemKey
              ),
          },
        };
        break;
      case 'revenueVsProfit':
        config = {
          title: 'Revenue vs Profit (Monthly)',
          columns: [
            { key: 'period', label: 'Period' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
            { key: 'profit', label: 'Profit (₹)', format: 'currency' },
          ],
          rows: revenueVsProfitChartData.map((item) => ({
            period: item.label,
            revenue: item.revenue,
            profit: item.profit,
            periodKey: item.originalLabel || item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${formatPeriodLabel(row.periodKey)}`,
                (sale) => {
                  const saleDate = sale.cp_date || sale.date;
                  const date = new Date(saleDate);
                  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  return yearMonth === row.periodKey;
                }
              ),
          },
        };
        break;
      case 'monthProfit':
        config = {
          title: 'Month-wise Profit',
          columns: [
            { key: 'period', label: 'Period' },
            { key: 'profit', label: 'Profit (₹)', format: 'currency' },
          ],
          rows: monthWiseProfitChartData.map((item) => ({
            period: item.label,
            profit: item.value,
            periodKey: item.originalLabel || item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${formatPeriodLabel(row.periodKey)}`,
                (sale) => {
                  const saleDate = sale.cp_date || sale.date;
                  const date = new Date(saleDate);
                  const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  return yearMonth === row.periodKey;
                }
              ),
          },
        };
        break;
      case 'topProfitable':
        config = {
          title: 'Top Profitable Items',
          columns: [
            { key: 'item', label: 'Item' },
            { key: 'profit', label: 'Profit (₹)', format: 'currency' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: topProfitableItemsData.map((item) => ({
            item: item.label,
            profit: item.value,
            revenue: item.revenue,
            itemKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.item}`,
                (sale) => sale.item === row.itemKey
              ),
          },
        };
        break;
      case 'topLoss':
        config = {
          title: 'Top Loss Items',
          columns: [
            { key: 'item', label: 'Item' },
            { key: 'profit', label: 'Loss (₹)', format: 'currency' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
          ],
          rows: topLossItemsData.map((item) => ({
            item: item.label,
            profit: item.value,
            revenue: item.revenue,
            itemKey: item.label,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.item}`,
                (sale) => sale.item === row.itemKey
              ),
          },
        };
        break;
      case 'salesperson':
        config = {
          title: 'Salesperson Totals',
          columns: [
            { key: 'salesperson', label: 'Salesperson' },
            { key: 'revenue', label: 'Revenue (₹)', format: 'currency' },
            { key: 'billCount', label: 'Orders Count', format: 'number' },
          ],
          rows: salespersonTotals.map((item) => ({
            salesperson: item.name,
            revenue: item.value,
            billCount: item.billCount,
            salespersonKey: item.name,
          })),
          rowAction: {
            icon: 'table_view',
            title: 'View raw data',
            onClick: (row) =>
              openTransactionRawData(
                `Raw Data - ${row.salesperson}`,
                (sale) => {
                  const saleSalesperson = sale.salesperson || 'Unassigned';
                  return saleSalesperson === row.salespersonKey;
                }
              ),
          },
        };
        break;
      default:
        break;
    }

    if (config) {
      setRawDataModal({ open: true, ...config });
      setRawDataSearch('');
      setRawDataPage(1);
    }
  }, [
    categoryChartData,
    ledgerGroupChartData,
    regionChartData,
    countryChartData,
    salespersonTotals,
    periodChartData,
    topCustomersData,
    topItemsByRevenueData,
    topItemsByQuantityData,
    revenueVsProfitChartData,
    monthWiseProfitChartData,
    topProfitableItemsData,
    topLossItemsData,
    openTransactionRawData
  ]);

  const closeRawData = useCallback(() => {
    setRawDataModal({ open: false, title: '', rows: [], columns: [] });
    setRawDataSearch('');
    setRawDataPage(1);
  }, []);

  const filteredRawRows = useMemo(() => {
    if (!rawDataModal.open) return [];
    const query = rawDataSearch.trim().toLowerCase();
    if (!query) return rawDataModal.rows;
    return rawDataModal.rows.filter((row) =>
      rawDataModal.columns.some((column) =>
        String(row[column.key] ?? '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [rawDataModal, rawDataSearch]);

  const totalRawPages = rawDataModal.open
    ? Math.max(1, Math.ceil(Math.max(filteredRawRows.length, 1) / RAW_DATA_PAGE_SIZE))
    : 1;

  useEffect(() => {
    if (!rawDataModal.open) return;
    if (rawDataPage > totalRawPages) {
      setRawDataPage(totalRawPages);
    }
  }, [rawDataModal.open, rawDataPage, totalRawPages]);

  const paginatedRawRows = useMemo(() => {
    if (!rawDataModal.open) return [];
    const start = (rawDataPage - 1) * RAW_DATA_PAGE_SIZE;
    return filteredRawRows.slice(start, start + RAW_DATA_PAGE_SIZE);
  }, [filteredRawRows, rawDataModal.open, rawDataPage, RAW_DATA_PAGE_SIZE]);

  const exportRawDataToCSV = useCallback(() => {
    if (!rawDataModal.open || rawDataModal.columns.length === 0) {
      return;
    }

    const rowsToExport = filteredRawRows;
    if (rowsToExport.length === 0) {
      alert('No data available to export.');
      return;
    }

    const header = rawDataModal.columns
      .map((column) => `"${column.label.replace(/"/g, '""')}"`)
      .join(',');

    const csvRows = rowsToExport.map((row) =>
      rawDataModal.columns
        .map((column) => {
          const value = row[column.key];
          const strValue = value === null || value === undefined ? '' : value;
          return `"${String(strValue).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [header, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = rawDataModal.title ? rawDataModal.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'raw_data';
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRawRows, rawDataModal]);

  const renderRawDataCell = (row, column) => {
    const value = row[column.key];
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    // Handle objects - convert to string representation
    if (typeof value === 'object' && !Array.isArray(value)) {
      // If it's an object, try to extract a meaningful string representation
      if (value.BILLNAME) {
        return value.BILLNAME;
      }
      // Otherwise, convert to JSON string (truncated if too long)
      const jsonStr = JSON.stringify(value);
      return jsonStr.length > 50 ? jsonStr.substring(0, 50) + '...' : jsonStr;
    }

    // Handle arrays - convert to string representation
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '-';
      }
      // If array contains objects, try to extract meaningful info
      if (value.length > 0 && typeof value[0] === 'object') {
        return `${value.length} item(s)`;
      }
      return value.join(', ');
    }

    if (column.format === 'currency') {
      const numericValue = typeof value === 'number' ? value : parseFloat(value);
      if (Number.isFinite(numericValue)) {
        return formatCurrency(numericValue);
      }
    }

    if (column.format === 'number') {
      const numericValue = typeof value === 'number' ? value : parseFloat(value);
      if (Number.isFinite(numericValue)) {
        return numericValue.toLocaleString('en-IN');
      }
    }

    return value;
  };

  const totalRawRows = filteredRawRows.length;
  const rawDataStart = totalRawRows === 0 ? 0 : (rawDataPage - 1) * RAW_DATA_PAGE_SIZE + 1;
  const rawDataEnd = totalRawRows === 0 ? 0 : Math.min(rawDataPage * RAW_DATA_PAGE_SIZE, totalRawRows);

  // Custom Treemap Cell component for Salesperson Chart (matching Receivables Dashboard)
  const CustomTreemapCell = ({
    depth,
    x,
    y,
    width,
    height,
    name,
    fill,
    value,
    selectedSalesperson,
  }) => {
    if (depth === 0) return null;

    const isSelected = !selectedSalesperson || selectedSalesperson === name;
    const textColor = isSelected ? '#0f172a' : '#475569';

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill,
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: isSelected ? 0.95 : 0.7,
            transition: 'opacity 0.2s',
          }}
        />
        {width > 70 && height > 46 && (
          <>
            <text
              x={x + 10}
              y={y + 24}
              fill={textColor}
              fontSize={14}
              fontWeight={600}
              style={{ pointerEvents: 'none' }}
            >
              {name}
            </text>
            <text
              x={x + 10}
              y={y + 44}
              fill={textColor}
              fontSize={12}
              style={{ pointerEvents: 'none' }}
            >
              {formatCompactCurrency(value)}
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes progressShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.6;
              transform: scale(1.1);
            }
          }
          @keyframes pulseRing {
            0% {
              transform: scale(0.8);
              opacity: 1;
            }
            100% {
              transform: scale(1.8);
              opacity: 0;
            }
          }
        `}
      </style>
     <div
       style={{
         background: 'transparent',
         minHeight: '100vh',
         padding: isMobile ? '12px' : '24px',
         paddingTop: isMobile ? '12px' : '40px',
         width: isMobile ? '100vw' : '80vw',
         margin: 0,
         display: 'block',
         overflowX: 'hidden',
       }}
     >
       <div
         style={{
           width: '100%',
           margin: '0 auto',
           maxWidth: '100%',
           background: 'white',
           borderRadius: '16px',
           boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
           overflow: 'visible',
           border: '1px solid #e2e8f0',
           position: 'relative',
         }}
       >
        {/* Header */}
        <form onSubmit={handleSubmit} style={{ width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
        <div style={{
            padding: isMobile ? '12px 16px' : '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          background: 'transparent',
          position: 'relative'
          }}>
            {/* Green Pulsating Dot Indicator */}
            {isDownloadingCache && (
              <div style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ position: 'relative', width: '12px', height: '12px' }}>
                  {/* Pulsating ring effect */}
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#10b981',
                    opacity: 0.4,
                    animation: 'pulseRing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}></div>
                  {/* Main dot */}
                  <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}></div>
                </div>
              </div>
            )}
            {/* Three-Column Layout: Title | Date Range (Centered) | Export Buttons */}
        {isMobile ? (
          <>
            {/* Mobile: Title Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              >
                <span className="material-icons" style={{ color: 'white', fontSize: '18px' }}>analytics</span>
              </div>
              <div style={{ flex: '1' }}>
                <h1 style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '18px',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  letterSpacing: '-0.02em'
                }}>
                  Sales Analytics Dashboard
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <p style={{
                    margin: 0,
                    color: '#64748b',
                    fontSize: '11px',
                    fontWeight: '500',
                    lineHeight: '1.4'
                  }}>
                    Comprehensive sales insights
                  </p>
                  {/* Records Available Badge - Inline */}
                  <div style={{
                    display: 'inline-flex',
                    background: '#f0f9ff',
                    color: '#0369a1',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    alignItems: 'center',
                    gap: '5px',
                    border: '1px solid #bae6fd',
                    whiteSpace: 'nowrap'
                  }}>
                    <span className="material-icons" style={{ fontSize: '14px' }}>bar_chart</span>
                    {filteredSales.length} records
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Buttons Section */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '8px', 
              width: '100%'
            }}>
              {/* Create Custom Card Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔒 Opening Custom Card Modal - using existing sales data only, no API calls should occur. Sales data count:', sales.length);
                  setShowCustomCardModal(true);
                }}
                disabled={sales.length === 0}
                style={{
                  background: sales.length === 0 
                    ? '#e5e7eb' 
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: sales.length === 0 ? '#9ca3af' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: sales.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: sales.length === 0 
                    ? 'none' 
                    : '0 2px 4px rgba(16, 185, 129, 0.2)',
                  whiteSpace: 'nowrap',
                  justifyContent: 'center',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  if (sales.length > 0) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sales.length > 0) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                  }
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>add_chart</span>
                <span>Create Custom Card</span>
              </button>

              {/* Calendar Button */}
              <button
                type="button"
                onClick={handleOpenCalendar}
                title={fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select date range'}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 3px 8px rgba(124, 58, 237, 0.3)',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)';
                  e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                  e.target.style.boxShadow = '0 3px 8px rgba(124, 58, 237, 0.3)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>calendar_month</span>
                <span>Select Date Range</span>
              </button>

              {/* Download Button */}
              <div style={{ position: 'relative', width: '100%' }} ref={downloadDropdownRef}>
                <button
                  type="button"
                  title="Download"
                  onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)';
                    e.target.style.boxShadow = '0 3px 10px rgba(5, 150, 105, 0.35)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                    e.target.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.25)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                  <span>Download</span>
                  <span className="material-icons" style={{ fontSize: '18px' }}>
                    {showDownloadDropdown ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                
                {/* Download Dropdown Menu - Mobile */}
                {showDownloadDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '48px',
                    left: '0',
                    right: '0',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    width: '100%',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0'
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        exportToPDF();
                        setShowDownloadDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#1e293b',
                        fontSize: '14px',
                        textAlign: 'left',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      <span className="material-icons" style={{ fontSize: '20px', color: '#dc2626' }}>picture_as_pdf</span>
                      <span>Export as PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        exportToExcel();
                        setShowDownloadDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: 'none',
                        borderTop: '1px solid #e2e8f0',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#1e293b',
                        fontSize: '14px',
                        textAlign: 'left',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                      onMouseLeave={(e) => e.target.style.background = 'white'}
                    >
                      <span className="material-icons" style={{ fontSize: '20px', color: '#16a34a' }}>table_chart</span>
                      <span>Export as Excel</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            width: '100%',
            position: 'relative',
            overflow: 'visible'
          }}>
            {/* Desktop: Icon + Title Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: '1 1 0',
              minWidth: '300px'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
              >
                <span className="material-icons" style={{ color: 'white', fontSize: '22px' }}>analytics</span>
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <h1 style={{
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1.2',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap'
                }}>
                  Sales Analytics Dashboard
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <p style={{
                    margin: 0,
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: '500',
                    lineHeight: '1.4'
                  }}>
                    Comprehensive sales insights
                  </p>
                  {/* Records Available Badge - Inline */}
                  <div style={{
                    display: 'inline-flex',
                    background: '#f0f9ff',
                    color: '#0369a1',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    alignItems: 'center',
                    gap: '5px',
                    border: '1px solid #bae6fd',
                    whiteSpace: 'nowrap'
                  }}>
                    <span className="material-icons" style={{ fontSize: '14px' }}>bar_chart</span>
                    {filteredSales.length} records
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop: Buttons */}
            {/* Create Custom Card Button - Desktop */}
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔒 Opening Custom Card Modal - using existing sales data only, no API calls should occur. Sales data count:', sales.length);
                    setShowCustomCardModal(true);
                  }}
                  disabled={sales.length === 0}
                  style={{
                    background: sales.length === 0 
                      ? '#e5e7eb' 
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: sales.length === 0 ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 20px',
                    cursor: sales.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: sales.length === 0 
                      ? 'none' 
                      : '0 2px 4px rgba(16, 185, 129, 0.2)',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (sales.length > 0) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (sales.length > 0) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '20px' }}>add_chart</span>
                  Create Custom Card
                </button>
              </div>

              {/* Center: Calendar Button - Desktop */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flex: '1 1 0',
                justifyContent: 'center',
                flexWrap: 'wrap',
                minWidth: '200px'
              }}>
                <button
                  type="button"
                  onClick={handleOpenCalendar}
                  title={fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select date range'}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '9px 18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 3px 8px rgba(124, 58, 237, 0.3)',
                    minWidth: '140px',
                    justifyContent: 'center',
                    height: '40px',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)';
                    e.target.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                    e.target.style.boxShadow = '0 3px 8px rgba(124, 58, 237, 0.3)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>calendar_month</span>
                  <span>
                    {fromDate && toDate ? 'Date Range' : 'Select Dates'}
                  </span>
                </button>
              </div>

              {/* Right: Download Dropdown - Desktop */}
              <div style={{
                display: 'flex', 
                gap: '6px', 
                alignItems: 'center',
                flex: '1 1 0',
                justifyContent: 'flex-end',
                minWidth: '150px',
                position: 'relative'
              }} ref={downloadDropdownRef}>
                <button
                  type="button"
                  title="Download"
                  onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                    height: '40px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)';
                    e.target.style.boxShadow = '0 3px 10px rgba(5, 150, 105, 0.35)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                    e.target.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.25)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                  <span>Download</span>
                  <span className="material-icons" style={{ fontSize: '18px' }}>
                    {showDownloadDropdown ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                
                {/* Download Dropdown Menu - Desktop */}
                {showDownloadDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '45px',
                    right: '0',
                    background: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    minWidth: '150px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0'
                  }}>
                <button
                  type="button"
                  onClick={() => {
                    exportToPDF();
                    setShowDownloadDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#1e293b',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'background 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px', color: '#dc2626' }}>picture_as_pdf</span>
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportToExcel();
                    setShowDownloadDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#1e293b',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'background 0.2s ease',
                    textAlign: 'left',
                    borderTop: '1px solid #e2e8f0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px', color: '#059669' }}>table_chart</span>
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    printDashboard();
                    setShowDownloadDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#1e293b',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'background 0.2s ease',
                    textAlign: 'left',
                    borderTop: '1px solid #e2e8f0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'white';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '18px', color: '#1e40af' }}>print</span>
                  <span>Print</span>
                </button>
              </div>
            )}
              </div>
          </div>
        )}
        </div>

        {/* Progress Bar - Removed: Sales dashboard uses cache-only mode, no server fetching notifications */}

        {/* Error Message */}
        {error && (
          <div style={{
            background: noCompanySelected ? '#fef3c7' : '#fef2f2',
            border: noCompanySelected ? '1px solid #f59e0b' : '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            margin: '16px 0',
            color: noCompanySelected ? '#92400e' : '#dc2626',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {noCompanySelected ? 'warning' : 'error'}
            </span>
            {error}
          </div>
        )}


        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div style={{ marginBottom: isMobile ? '12px' : '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              flexWrap: 'wrap'
            }}>
              <span style={{
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '600',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Active Filters:
              </span>
              
              {selectedCustomer !== 'all' && (
                <div style={{
                  background: '#dbeafe',
                  border: '1px solid #93c5fd',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>person</span>
                  {isMobile ? 'Customer' : 'Customer:'} {selectedCustomer}
                  <button
                    onClick={() => setSelectedCustomer('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e40af',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#93c5fd';
                      e.target.style.color = '#1e40af';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#1e40af';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedItem !== 'all' && (
                <div style={{
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>inventory_2</span>
                  {isMobile ? 'Item' : 'Item:'} {selectedItem}
                  <button
                    onClick={() => setSelectedItem('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#166534',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#86efac';
                      e.target.style.color = '#166534';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#166534';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedStockGroup !== 'all' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>category</span>
                  {isMobile ? 'Stock' : 'Stock Group:'} {selectedStockGroup}
                  <button
                    onClick={() => setSelectedStockGroup('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#92400e',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fcd34d';
                      e.target.style.color = '#92400e';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#92400e';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedLedgerGroup !== 'all' && (
                <div style={{
                  background: '#f3e8ff',
                  border: '1px solid #c4b5fd',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#6b21a8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>account_tree</span>
                  {isMobile ? 'Ledger' : 'Ledger Group:'} {selectedLedgerGroup}
                  <button
                    onClick={() => setSelectedLedgerGroup('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6b21a8',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#c4b5fd';
                      e.target.style.color = '#6b21a8';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#6b21a8';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedRegion !== 'all' && (
                <div style={{
                  background: '#e0e7ff',
                  border: '1px solid #a5b4fc',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#3730a3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>place</span>
                  {isMobile ? 'State' : 'State:'} {selectedRegion}
                  <button
                    onClick={() => setSelectedRegion('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3730a3',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#a5b4fc';
                      e.target.style.color = '#3730a3';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#3730a3';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}

              {selectedCountry !== 'all' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>public</span>
                  {isMobile ? 'Country' : 'Country:'} {selectedCountry}
                  <button
                    onClick={() => setSelectedCountry('all')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#92400e',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fcd34d';
                      e.target.style.color = '#92400e';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#92400e';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}

              {selectedPeriod && (
                <div style={{
                  background: '#fce7f3',
                  border: '1px solid #f9a8d4',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#9d174d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>calendar_month</span>
                  {isMobile ? 'Period' : 'Period:'} {formatPeriodLabel(selectedPeriod)}
                  <button
                    onClick={() => setSelectedPeriod(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9d174d',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f9a8d4';
                      e.target.style.color = '#9d174d';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#9d174d';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}

              {selectedSalesperson && (
                <div style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '16px',
                  padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#c2410c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>person_outline</span>
                  {isMobile ? 'Salesperson' : 'Salesperson:'} {selectedSalesperson}
                  <button
                    onClick={() => setSelectedSalesperson(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#c2410c',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fed7aa';
                      e.target.style.color = '#c2410c';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                      e.target.style.color = '#c2410c';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                  </button>
                </div>
              )}

              {/* Display generic filters from custom cards */}
              {genericFilters && Object.keys(genericFilters).length > 0 && Object.entries(genericFilters).map(([filterKey, filterValue]) => {
                if (!filterValue || filterValue === 'all' || filterValue === '') return null;
                
                // Extract cardId and fieldName from filterKey (format: "cardId_fieldName")
                const [cardId, ...fieldParts] = filterKey.split('_');
                const fieldName = fieldParts.join('_'); // Rejoin in case fieldName contains underscores
                
                // Find the card to get its title and groupBy field
                const card = customCards.find(c => c.id === cardId);
                if (!card) return null;
                
                // Format field name for display
                const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
                
                return (
                  <div
                    key={filterKey}
                    style={{
                      background: '#f0f9ff',
                      border: '1px solid #7dd3fc',
                      borderRadius: '16px',
                      padding: isMobile ? '3px 6px 3px 10px' : '4px 8px 4px 12px',
                      fontSize: isMobile ? '11px' : '12px',
                      color: '#0c4a6e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: isMobile ? '4px' : '6px'
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>filter_alt</span>
                    {isMobile ? `${card.title}: ${fieldLabel}` : `${card.title}: ${fieldLabel} = ${filterValue}`}
                    <button
                      onClick={() => {
                        setGenericFilters(prev => {
                          const updated = { ...prev };
                          delete updated[filterKey];
                          try {
                            sessionStorage.setItem('customCardGenericFilters', JSON.stringify(updated));
                          } catch (e) {
                            console.warn('Failed to update generic filters:', e);
                          }
                          return updated;
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0c4a6e',
                        cursor: 'pointer',
                        padding: '2px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#7dd3fc';
                        e.target.style.color = '#0c4a6e';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'none';
                        e.target.style.color = '#0c4a6e';
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div style={{ marginBottom: isMobile ? '12px' : '20px' }}>
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: isMobile ? '6px 12px' : '8px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? '6px' : '8px',
                  color: '#64748b',
                  fontSize: isMobile ? '12px' : '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f8fafc';
                  e.target.style.borderColor = '#e2e8f0';
                }}
              >
                <span className="material-icons" style={{ fontSize: isMobile ? '14px' : '16px' }}>clear</span>
                {isMobile ? 'Clear Filters' : 'Clear All Filters'}
              </button>
            </div>
          )}

        {/* Dashboard Content */}
        <div style={{ padding: isMobile ? '12px 16px' : '24px 28px 28px 28px' }}>
          {/* Date Range Display */}
          {fromDate && toDate && (
            <div style={{
              marginBottom: isMobile ? '16px' : '24px',
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '8px' : '12px',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              color: '#475569',
              flexWrap: 'wrap'
            }}>
              <span>
                {new Date(fromDate).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </span>
              <span style={{ color: '#94a3b8' }}>→</span>
              <span>
                {new Date(toDate).toLocaleDateString('en-IN', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                })}
              </span>
            </div>
          )}
          
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: isMobile ? '12px' : '20px',
            marginBottom: isMobile ? '16px' : '28px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: isMobile ? '12px' : '14px',
              padding: isMobile ? '16px' : '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Total Revenue
                </p>
                <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: isMobile ? '40px' : '52px',
                height: isMobile ? '40px' : '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#3b82f6' }}>account_balance_wallet</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: isMobile ? '12px' : '14px',
              padding: isMobile ? '16px' : '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Total Invoices
                </p>
                <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  {totalOrders}
                </p>
              </div>
              <div style={{
                width: isMobile ? '40px' : '52px',
                height: isMobile ? '40px' : '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#16a34a' }}>shopping_cart</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: isMobile ? '12px' : '14px',
              padding: isMobile ? '16px' : '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Unique Customers
                </p>
                <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  {uniqueCustomers}
                </p>
              </div>
              <div style={{
                width: isMobile ? '40px' : '52px',
                height: isMobile ? '40px' : '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#9333ea' }}>people</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: isMobile ? '12px' : '14px',
              padding: isMobile ? '16px' : '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
              cursor: 'default'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Avg Invoice Value
                </p>
                <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  ₹{avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: isMobile ? '40px' : '52px',
                height: isMobile ? '40px' : '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#16a34a' }}>trending_up</span>
              </div>
              </div>
            </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: isMobile ? '16px' : '28px'
          }}>
            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: isMobile ? '12px' : '14px',
                padding: isMobile ? '16px' : '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Total Profit
                  </p>
                  <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: totalProfit >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    ₹{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: isMobile ? '40px' : '52px',
                  height: isMobile ? '40px' : '52px',
                  borderRadius: '12px',
                  background: totalProfit >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: totalProfit >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {totalProfit >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>
            )}

            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: isMobile ? '12px' : '14px',
                padding: isMobile ? '16px' : '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Profit Margin
                  </p>
                  <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: profitMargin >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    {profitMargin >= 0 ? '+' : ''}{profitMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </p>
                </div>
                <div style={{
                  width: isMobile ? '40px' : '52px',
                  height: isMobile ? '40px' : '52px',
                  borderRadius: '12px',
                  background: profitMargin >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: profitMargin >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: profitMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    {profitMargin >= 0 ? 'percent' : 'remove'}
                  </span>
                </div>
              </div>
            )}

            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: isMobile ? '12px' : '14px',
                padding: isMobile ? '16px' : '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.3s ease',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Avg Profit per Order
                  </p>
                  <p style={{ margin: '0', fontSize: isMobile ? '20px' : '26px', fontWeight: '800', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    ₹{avgProfitPerOrder.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: isMobile ? '40px' : '52px',
                  height: isMobile ? '40px' : '52px',
                  borderRadius: '12px',
                  background: avgProfitPerOrder >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: avgProfitPerOrder >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626' }}>
                    {avgProfitPerOrder >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Charts Section */}
          {/* Row 1: Sales by Ledger Group and Salesperson Totals */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Ledger Group Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {ledgerGroupChartType === 'bar' && (
                <BarChart
                  data={ledgerGroupChartData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('ledgerGroup')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Sales by Ledger Group
                </h3>
                {renderCardFilterBadges('ledgerGroup')}
                </div>
                <select
                  value={ledgerGroupChartType}
                  onChange={(e) => setLedgerGroupChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                  onBarClick={(ledgerGroup) => {
                    console.log('🎯 Setting selectedLedgerGroup from BarChart click:', ledgerGroup);
                    setSelectedLedgerGroup(ledgerGroup);
                  }}
                  onBackClick={() => setSelectedLedgerGroup('all')}
                  showBackButton={selectedLedgerGroup !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) => openRawData('ledgerGroupItemTransactions', item.label),
                  }}
                />
                )}
                {ledgerGroupChartType === 'pie' && (
                  <PieChart
                    data={ledgerGroupChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('ledgerGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Ledger Group
                        </h3>
                        {renderCardFilterBadges('ledgerGroup')}
                      </div>
                      <select
                        value={ledgerGroupChartType}
                        onChange={(e) => setLedgerGroupChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onSliceClick={(ledgerGroup) => {
                      console.log('🎯 Setting selectedLedgerGroup from PieChart click:', ledgerGroup);
                      setSelectedLedgerGroup(ledgerGroup);
                    }}
                    onBackClick={() => setSelectedLedgerGroup('all')}
                    showBackButton={selectedLedgerGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('ledgerGroupItemTransactions', item.label),
                    }}
                  />
                )}
                {ledgerGroupChartType === 'treemap' && (
                  <TreeMap
                    data={ledgerGroupChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('ledgerGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Ledger Group
                        </h3>
                        {renderCardFilterBadges('ledgerGroup')}
                      </div>
                      <select
                        value={ledgerGroupChartType}
                        onChange={(e) => setLedgerGroupChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onBoxClick={(ledgerGroup) => setSelectedLedgerGroup(ledgerGroup)}
                    onBackClick={() => setSelectedLedgerGroup('all')}
                    showBackButton={selectedLedgerGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('ledgerGroupItemTransactions', item.label),
                    }}
                  />
                )}
                {ledgerGroupChartType === 'line' && (
                  <LineChart
                    data={ledgerGroupChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('ledgerGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Ledger Group
                        </h3>
                        {renderCardFilterBadges('ledgerGroup')}
                      </div>
                      <select
                        value={ledgerGroupChartType}
                        onChange={(e) => setLedgerGroupChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onPointClick={(ledgerGroup) => setSelectedLedgerGroup(ledgerGroup)}
                    onBackClick={() => setSelectedLedgerGroup('all')}
                    showBackButton={selectedLedgerGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('ledgerGroupItemTransactions', item.label),
                    }}
                  />
                )}
            </div>

            {/* Salesperson Totals */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => openRawData('salesperson')}
                      style={rawDataIconButtonStyle}
                      onMouseEnter={handleRawDataButtonMouseEnter}
                      onMouseLeave={handleRawDataButtonMouseLeave}
                      title="View raw data"
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                    </button>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      Salesperson Totals
                    </h3>
                    {renderCardFilterBadges('salesperson')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSalespersonConfig(!showSalespersonConfig)}
                    style={{
                      padding: '6px 12px',
                      background: showSalespersonConfig ? '#2c5aa0' : '#3182ce',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#2c5aa0';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = showSalespersonConfig ? '#2c5aa0' : '#3182ce';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>settings</span>
                    {showSalespersonConfig ? 'Hide Config' : 'Configure Salespersons'}
                  </button>
                </div>

                {/* Config Panel */}
                {showSalespersonConfig && (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                    border: '1px solid #e2e8f0',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #e2e8f0'
                    }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1a202c' }}>
                        Select Salespersons to Include
                      </h4>
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      marginBottom: '8px'
                    }}>
                      {/* Master checkbox */}
                      <label style={{
                        fontWeight: '600',
                        padding: '6px 0',
                        borderBottom: '1px solid #e5e7eb',
                        marginBottom: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={enabledSalespersons.size === allSalespersons.length && enabledSalespersons.size > 0}
                          onChange={() => {
                            if (enabledSalespersons.size === allSalespersons.length) {
                              setEnabledSalespersons(new Set());
                            } else {
                              setEnabledSalespersons(new Set(allSalespersons));
                            }
                          }}
                          style={{
                            marginRight: '8px',
                            cursor: 'pointer',
                            width: '16px',
                            height: '16px',
                            accentColor: '#3182ce'
                          }}
                        />
                        <span style={{ fontWeight: '600', fontSize: '12px' }}>
                          {enabledSalespersons.size === allSalespersons.length && enabledSalespersons.size > 0
                            ? 'All Selected'
                            : enabledSalespersons.size > 0
                            ? 'Some Selected'
                            : 'None Selected'}
                        </span>
                      </label>
                      {allSalespersons.map((salesperson) => {
                        const isEnabled = isSalespersonEnabled(salesperson);
                        return (
                          <label
                            key={salesperson}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              fontSize: '12px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f7fafc';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => {
                                const newEnabled = new Set(enabledSalespersons);
                                if (newEnabled.has(salesperson)) {
                                  newEnabled.delete(salesperson);
                                } else {
                                  newEnabled.add(salesperson);
                                }
                                setEnabledSalespersons(newEnabled);
                              }}
                              style={{
                                cursor: 'pointer',
                                width: '16px',
                                height: '16px',
                                accentColor: '#3182ce'
                              }}
                            />
                            <span style={{ color: '#2d3748', userSelect: 'none' }}>{salesperson}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{
                      paddingTop: '8px',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: '11px',
                      color: '#718096',
                      fontStyle: 'italic'
                    }}>
                      {allSalespersons.length === 0
                        ? 'No salespersons found'
                        : enabledSalespersons.size === 0
                        ? `0 of ${allSalespersons.length} salespersons selected (none included)`
                        : `${enabledSalespersons.size} of ${allSalespersons.length} salespersons selected`}
                    </div>
                  </div>
                )}

                {/* Salesperson Chart */}
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  {salespersonTotals.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#64748b',
                      fontSize: '14px'
                    }}>
                      {sales.length === 0
                        ? 'No sales data available'
                        : enabledSalespersons.size === 0
                        ? 'No salespersons selected'
                        : 'No data for selected salespersons'}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={salespersonTotals.map((item, index) => {
                          const name = item.name || 'Unknown';
                          const isDimmed = !!selectedSalesperson && selectedSalesperson !== name;
                          return {
                            name,
                            value: item.value || 0,
                            billCount: item.billCount || 0,
                            fill: isDimmed
                              ? 'rgba(148, 163, 184, 0.45)'
                              : salespersonColorPalette[index % salespersonColorPalette.length],
                          };
                        })}
                        dataKey="value"
                        stroke="#ffffff"
                        animationDuration={400}
                        isAnimationActive
                        content={
                          <CustomTreemapCell selectedSalesperson={selectedSalesperson} />
                        }
                        onClick={(node) => {
                          const name = node?.name;
                          if (!name) return;
                          const nextSelection = selectedSalesperson === name ? null : name;
                          setSelectedSalesperson(nextSelection);
                        }}
                      >
                        <RechartsTooltip
                          content={({ payload }) => {
                            if (!payload || payload.length === 0) {
                              return null;
                            }
                            const node = payload[0].payload || {};
                            return (
                              <div style={{
                                background: 'rgba(17, 24, 39, 0.92)',
                                padding: '8px 12px',
                                color: '#f8fafc',
                                borderRadius: '8px',
                                fontSize: '12px'
                              }}>
                                <div style={{ fontWeight: '600', marginBottom: '4px' }}>{node.name}</div>
                                <div style={{ marginBottom: '2px' }}>
                                  Total Sales: {formatCompactCurrency(node.value)}
                                </div>
                                <div>
                                  Orders Count: {node.billCount || 0}
                                </div>
                              </div>
                            );
                          }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Sales by State and Sales by Country */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Region Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {regionChartType === 'bar' && (
                <BarChart
                  data={regionChartData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('region')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Sales by State
                </h3>
                  {renderCardFilterBadges('region')}
                </div>
                <select
                  value={regionChartType}
                  onChange={(e) => setRegionChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                  onBarClick={(region) => setSelectedRegion(region)}
                  onBackClick={() => setSelectedRegion('all')}
                  showBackButton={selectedRegion !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.region && String(sale.region).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {regionChartType === 'pie' && (
                <PieChart
                  data={regionChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('region')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by State
                        </h3>
                        {renderCardFilterBadges('region')}
                      </div>
                      <select
                        value={regionChartType}
                        onChange={(e) => setRegionChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onSliceClick={(region) => setSelectedRegion(region)}
                  onBackClick={() => setSelectedRegion('all')}
                  showBackButton={selectedRegion !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.region && String(sale.region).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {regionChartType === 'treemap' && (
                <TreeMap
                  data={regionChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('region')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by State
                        </h3>
                        {renderCardFilterBadges('region')}
                      </div>
                      <select
                        value={regionChartType}
                        onChange={(e) => setRegionChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onBoxClick={(region) => setSelectedRegion(region)}
                  onBackClick={() => setSelectedRegion('all')}
                  showBackButton={selectedRegion !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.region && String(sale.region).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {regionChartType === 'line' && (
                <LineChart
                  data={regionChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('region')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by State
                        </h3>
                        {renderCardFilterBadges('region')}
                      </div>
                      <select
                        value={regionChartType}
                        onChange={(e) => setRegionChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onPointClick={(region) => setSelectedRegion(region)}
                  onBackClick={() => setSelectedRegion('all')}
                  showBackButton={selectedRegion !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.region && String(sale.region).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
            </div>

            {/* Country Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {countryChartType === 'bar' && (
                <BarChart
                  data={countryChartData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('country')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Sales by Country
                </h3>
                  {renderCardFilterBadges('country')}
                </div>
                <select
                  value={countryChartType}
                  onChange={(e) => setCountryChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                  onBarClick={(country) => setSelectedCountry(country)}
                  onBackClick={() => setSelectedCountry('all')}
                  showBackButton={selectedCountry !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => {
                          const saleCountry = String(sale.country || 'Unknown').trim();
                          const itemCountry = String(item.label || 'Unknown').trim();
                          return saleCountry === itemCountry;
                        }
                      ),
                  }}
                />
              )}
              {countryChartType === 'pie' && (
                <PieChart
                  data={countryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('country')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Country
                        </h3>
                        {renderCardFilterBadges('country')}
                      </div>
                      <select
                        value={countryChartType}
                        onChange={(e) => setCountryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onSliceClick={(country) => setSelectedCountry(country)}
                  onBackClick={() => setSelectedCountry('all')}
                  showBackButton={selectedCountry !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => {
                          const saleCountry = String(sale.country || 'Unknown').trim();
                          const itemCountry = String(item.label || 'Unknown').trim();
                          return saleCountry === itemCountry;
                        }
                      ),
                  }}
                />
              )}
              {countryChartType === 'treemap' && (
                <TreeMap
                  data={countryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('country')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Country
                        </h3>
                        {renderCardFilterBadges('country')}
                      </div>
                      <select
                        value={countryChartType}
                        onChange={(e) => setCountryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onBoxClick={(country) => setSelectedCountry(country)}
                  onBackClick={() => setSelectedCountry('all')}
                  showBackButton={selectedCountry !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => {
                          const saleCountry = String(sale.country || 'Unknown').trim();
                          const itemCountry = String(item.label || 'Unknown').trim();
                          return saleCountry === itemCountry;
                        }
                      ),
                  }}
                />
              )}
              {countryChartType === 'line' && (
                <LineChart
                  data={countryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('country')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Country
                        </h3>
                        {renderCardFilterBadges('country')}
                      </div>
                      <select
                        value={countryChartType}
                        onChange={(e) => setCountryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onPointClick={(country) => setSelectedCountry(country)}
                  onBackClick={() => setSelectedCountry('all')}
                  showBackButton={selectedCountry !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => {
                          const saleCountry = String(sale.country || 'Unknown').trim();
                          const itemCountry = String(item.label || 'Unknown').trim();
                          return saleCountry === itemCountry;
                        }
                      ),
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 3: Period Chart and Top Customers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Period Chart */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {periodChartType === 'bar' && (
                <BarChart
                  data={periodChartData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('period')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Period Chart
                </h3>
                  {renderCardFilterBadges('period')}
                </div>
                <select
                  value={periodChartType}
                  onChange={(e) => setPeriodChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                   onBarClick={(periodLabel) => {
                     const clickedPeriod = periodChartData.find(p => p.label === periodLabel);
                     if (clickedPeriod) {
                       setSelectedPeriod(clickedPeriod.originalLabel);
                     }
                   }}
                   onBackClick={() => {
                     setSelectedPeriod(null);
                   }}
                   showBackButton={selectedPeriod !== null}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                        (sale) => {
                          const saleDate = sale.cp_date || sale.date;
                          const date = new Date(saleDate);
                          const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                          return yearMonth === (item.originalLabel || item.label);
                        }
                      ),
                  }}
                />
              )}
              {periodChartType === 'pie' && (
                <PieChart
                  data={periodChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('period')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Period Chart
                        </h3>
                      </div>
                      <select
                        value={periodChartType}
                        onChange={(e) => setPeriodChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                   onSliceClick={(periodLabel) => {
                     const clickedPeriod = periodChartData.find(p => p.label === periodLabel);
                     if (clickedPeriod) {
                       setSelectedPeriod(clickedPeriod.originalLabel);
                     }
                   }}
                   onBackClick={() => {
                     setSelectedPeriod(null);
                   }}
                   showBackButton={selectedPeriod !== null}
                   rowAction={{
                     icon: 'table_view',
                     title: 'View raw data',
                     onClick: (item) =>
                       openTransactionRawData(
                         `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                         (sale) => {
                           const saleDate = sale.cp_date || sale.date;
                           const date = new Date(saleDate);
                           const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                           return yearMonth === (item.originalLabel || item.label);
                         }
                       ),
                   }}
                />
              )}
              {periodChartType === 'treemap' && (
                <TreeMap
                  data={periodChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('period')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Period Chart
                        </h3>
                      </div>
                      <select
                        value={periodChartType}
                        onChange={(e) => setPeriodChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                   onBoxClick={(periodLabel) => {
                     const clickedPeriod = periodChartData.find(p => p.label === periodLabel);
                     if (clickedPeriod) {
                       setSelectedPeriod(clickedPeriod.originalLabel);
                     }
                   }}
                   onBackClick={() => {
                     setSelectedPeriod(null);
                   }}
                   showBackButton={selectedPeriod !== null}
                   rowAction={{
                     icon: 'table_view',
                     title: 'View raw data',
                     onClick: (item) =>
                       openTransactionRawData(
                         `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                         (sale) => {
                           const saleDate = sale.cp_date || sale.date;
                           const date = new Date(saleDate);
                           const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                           return yearMonth === (item.originalLabel || item.label);
                         }
                       ),
                   }}
                />
              )}
              {periodChartType === 'line' && (
                <LineChart
                  data={periodChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('period')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Period Chart
                        </h3>
                      </div>
                      <select
                        value={periodChartType}
                        onChange={(e) => setPeriodChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                   onPointClick={(periodLabel) => {
                     const clickedPeriod = periodChartData.find(p => p.label === periodLabel);
                     if (clickedPeriod) {
                       setSelectedPeriod(clickedPeriod.originalLabel);
                     }
                   }}
                   onBackClick={() => {
                     setSelectedPeriod(null);
                   }}
                   showBackButton={selectedPeriod !== null}
                   rowAction={{
                     icon: 'table_view',
                     title: 'View raw data',
                     onClick: (item) =>
                       openTransactionRawData(
                         `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                         (sale) => {
                           const saleDate = sale.cp_date || sale.date;
                           const date = new Date(saleDate);
                           const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                           return yearMonth === (item.originalLabel || item.label);
                         }
                       ),
                   }}
                />
              )}
            </div>

            {/* Top Customers */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {topCustomersChartType === 'bar' && (
                <BarChart
                  data={topCustomersData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('topCustomers')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Top Customers Chart
                </h3>
                  {renderCardFilterBadges('topCustomers')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topCustomersN}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopCustomersN(value);
                      }
                    }}
                    min="0"
                    placeholder="N"
                    style={{
                      width: '60px',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#374151',
                      textAlign: 'center'
                    }}
                    title="Enter number of top items to display"
                  />
                <select
                  value={topCustomersChartType}
                  onChange={(e) => setTopCustomersChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
                </div>
              </div>
                  }
                  onBarClick={(customer) => setSelectedCustomer(customer)}
                  onBackClick={() => setSelectedCustomer('all')}
                  showBackButton={selectedCustomer !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.customer && String(sale.customer).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topCustomersChartType === 'pie' && (
                <PieChart
                  data={topCustomersData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topCustomers')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Customers Chart
                        </h3>
                        {renderCardFilterBadges('topCustomers')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topCustomersN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topCustomersChartType}
                        onChange={(e) => setTopCustomersChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onSliceClick={(customer) => setSelectedCustomer(customer)}
                  onBackClick={() => setSelectedCustomer('all')}
                  showBackButton={selectedCustomer !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.customer && String(sale.customer).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topCustomersChartType === 'treemap' && (
                <TreeMap
                  data={topCustomersData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topCustomers')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Customers Chart
                        </h3>
                        {renderCardFilterBadges('topCustomers')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topCustomersN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topCustomersChartType}
                        onChange={(e) => setTopCustomersChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onBoxClick={(customer) => setSelectedCustomer(customer)}
                  onBackClick={() => setSelectedCustomer('all')}
                  showBackButton={selectedCustomer !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.customer && String(sale.customer).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topCustomersChartType === 'line' && (
                <LineChart
                  data={topCustomersData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topCustomers')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Customers Chart
                        </h3>
                        {renderCardFilterBadges('topCustomers')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topCustomersN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topCustomersChartType}
                        onChange={(e) => setTopCustomersChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onPointClick={(customer) => setSelectedCustomer(customer)}
                  onBackClick={() => setSelectedCustomer('all')}
                  showBackButton={selectedCustomer !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.customer && String(sale.customer).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 4: Top Items by Revenue and Top Items by Quantity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {topItemsByRevenueChartType === 'bar' && (
                <BarChart
                  data={topItemsByRevenueData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('topItemsRevenue')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Top Items by Revenue Chart
                </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topItemsByRevenueN}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopItemsByRevenueN(value);
                      }
                    }}
                    min="0"
                    placeholder="N"
                    style={{
                      width: '60px',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#374151',
                      textAlign: 'center'
                    }}
                    title="Enter number of top items to display"
                  />
                <select
                  value={topItemsByRevenueChartType}
                  onChange={(e) => setTopItemsByRevenueChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
                </div>
              </div>
                  }
                  onBarClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByRevenueChartType === 'pie' && (
                <PieChart
                  data={topItemsByRevenueData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsRevenue')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Revenue Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByRevenueN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByRevenueChartType}
                        onChange={(e) => setTopItemsByRevenueChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onSliceClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByRevenueChartType === 'treemap' && (
                <TreeMap
                  data={topItemsByRevenueData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsRevenue')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Revenue Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByRevenueN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByRevenueChartType}
                        onChange={(e) => setTopItemsByRevenueChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onBoxClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByRevenueChartType === 'line' && (
                <LineChart
                  data={topItemsByRevenueData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsRevenue')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Revenue Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByRevenueN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByRevenueChartType}
                        onChange={(e) => setTopItemsByRevenueChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                    onPointClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
              overflow: 'hidden'
            }}>
              {topItemsByQuantityChartType === 'bar' && (
                <BarChart
                  data={topItemsByQuantityData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('topItemsQuantity')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  Top Items by Quantity Chart
                </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topItemsByQuantityN}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopItemsByQuantityN(value);
                      }
                    }}
                    min="0"
                    placeholder="N"
                    style={{
                      width: '60px',
                      padding: '6px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#374151',
                      textAlign: 'center'
                    }}
                    title="Enter number of top items to display"
                  />
                <select
                  value={topItemsByQuantityChartType}
                  onChange={(e) => setTopItemsByQuantityChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
                </div>
              </div>
                  }
                  valuePrefix=""
                  onBarClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByQuantityChartType === 'pie' && (
                <PieChart
                  data={topItemsByQuantityData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsQuantity')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Quantity Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByQuantityN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByQuantityChartType}
                        onChange={(e) => setTopItemsByQuantityChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                  valuePrefix=""
                  onSliceClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByQuantityChartType === 'treemap' && (
                <TreeMap
                  data={topItemsByQuantityData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsQuantity')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Quantity Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByQuantityN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByQuantityChartType}
                        onChange={(e) => setTopItemsByQuantityChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                  valuePrefix=""
                  onBoxClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topItemsByQuantityChartType === 'line' && (
                <LineChart
                  data={topItemsByQuantityData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topItemsQuantity')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top Items by Quantity Chart
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={topItemsByQuantityN}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          min="1"
                          placeholder="N"
                          style={{
                            width: '60px',
                            padding: '6px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151',
                            textAlign: 'center'
                          }}
                          title="Enter number of top items to display"
                        />
                      <select
                        value={topItemsByQuantityChartType}
                        onChange={(e) => setTopItemsByQuantityChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                      </div>
                    </div>
                  }
                  valuePrefix=""
                  onPointClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (entry) =>
                      openTransactionRawData(
                        `Raw Data - ${entry.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(entry.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 5: Revenue vs Profit (Monthly) and Month-wise Profit */}
          {canShowProfit && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: '24px',
              marginBottom: '24px'
            }}>
              {/* Revenue vs Profit Chart */}
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
                overflow: 'hidden'
              }}>
                {revenueVsProfitChartType === 'line' && (
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                    padding: '12px 16px',
                  border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    flex: 1
                  }}>
                    <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                      marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => openRawData('revenueVsProfit')}
                      style={rawDataIconButtonStyle}
                      onMouseEnter={handleRawDataButtonMouseEnter}
                      onMouseLeave={handleRawDataButtonMouseLeave}
                      title="View raw data"
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                    </button>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      Revenue vs Profit (Monthly)
                    </h3>
                    {renderCardFilterBadges('period')}
          </div>
                  <select
                    value={revenueVsProfitChartType}
                    onChange={(e) => setRevenueVsProfitChartType(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#374151'
                    }}
                  >
                    <option value="line">Line</option>
                    <option value="bar">Bar</option>
                  </select>
        </div>
                    <svg viewBox="0 0 600 300" style={{ width: '100%', height: 'auto', minHeight: '300px' }}>
                      {/* Grid lines */}
                      {[0, 1, 2, 3, 4].map((i) => {
                        const y = 40 + (i / 4) * 240;
                        return (
                          <line
                            key={i}
                            x1="40"
                            y1={y}
                            x2="560"
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                          />
                        );
                      })}
                      
                      {/* X-axis labels */}
                      {revenueVsProfitChartData.map((item, index) => {
                        const x = 40 + (index / Math.max(revenueVsProfitChartData.length - 1, 1)) * 520;
                        return (
                          <text
                            key={index}
                            x={x}
                            y={290}
                            textAnchor="middle"
                            style={{ fontSize: '10px', fill: '#6b7280' }}
                            transform={`rotate(-45 ${x} 290)`}
                          >
                            {item.label}
                          </text>
                        );
                      })}
                      
                      {/* Revenue line */}
                      {revenueVsProfitChartData.length > 0 && (() => {
                        const maxRevenue = Math.max(...revenueVsProfitChartData.map(d => d.revenue));
                        const maxProfit = Math.max(...revenueVsProfitChartData.map(d => Math.abs(d.profit)));
                        const maxValue = Math.max(maxRevenue, maxProfit, 1); // Ensure at least 1 to avoid division by zero
                        const minProfit = Math.min(...revenueVsProfitChartData.map(d => d.profit));
                        const minValue = Math.min(0, minProfit);
                        const range = Math.max(maxValue - minValue, 1); // Ensure at least 1 to avoid division by zero
                        const dataLength = Math.max(revenueVsProfitChartData.length - 1, 1);
                        
                        const revenuePoints = revenueVsProfitChartData.map((item, index) => {
                          const x = 40 + (index / dataLength) * 520;
                          const y = 40 + 240 - ((item.revenue - minValue) / range) * 240;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                        
                        const profitPoints = revenueVsProfitChartData.map((item, index) => {
                          const x = 40 + (index / dataLength) * 520;
                          const y = 40 + 240 - ((item.profit - minValue) / range) * 240;
                          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                        
                        return (
                          <>
                            <path
                              d={revenuePoints}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="2"
                            />
                            <path
                              d={profitPoints}
                              fill="none"
                              stroke={profitMargin >= 0 ? '#10b981' : '#ef4444'}
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                            {revenueVsProfitChartData.map((item, index) => {
                              const dataLength = Math.max(revenueVsProfitChartData.length - 1, 1);
                              const x = 40 + (index / dataLength) * 520;
                              const revenueY = 40 + 240 - ((item.revenue - minValue) / range) * 240;
                              const profitY = 40 + 240 - ((item.profit - minValue) / range) * 240;
                              return (
                                <g key={index}>
                                  <circle
                                    cx={x}
                                    cy={revenueY}
                                    r="4"
                                    fill="#3b82f6"
                                  />
                                  <circle
                                    cx={x}
                                    cy={profitY}
                                    r="4"
                                    fill={profitMargin >= 0 ? '#10b981' : '#ef4444'}
                                  />
                                </g>
                              );
                            })}
                          </>
                        );
                      })()}
                      
                      {/* Legend */}
                      <g transform="translate(20, 20)">
                        <line x1="0" y1="0" x2="20" y2="0" stroke="#3b82f6" strokeWidth="2" />
                        <text x="25" y="4" style={{ fontSize: '12px', fill: '#1e293b' }}>Revenue</text>
                        <line x1="0" y1="15" x2="20" y2="15" stroke={profitMargin >= 0 ? '#10b981' : '#ef4444'} strokeWidth="2" strokeDasharray="5,5" />
                        <text x="25" y="19" style={{ fontSize: '12px', fill: '#1e293b' }}>Profit</text>
                      </g>
                    </svg>
          </div>
                )}
                {revenueVsProfitChartType === 'bar' && (
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    flex: 1
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('revenueVsProfit')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Revenue vs Profit (Monthly)
                        </h3>
                        {renderCardFilterBadges('period')}
                      </div>
                      <select
                        value={revenueVsProfitChartType}
                        onChange={(e) => setRevenueVsProfitChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="line">Line</option>
                        <option value="bar">Bar</option>
                      </select>
        </div>
                    <svg viewBox="0 0 600 300" style={{ width: '100%', height: 'auto', minHeight: '300px' }}>
                      {revenueVsProfitChartData.map((item, index) => {
                        const maxRevenue = Math.max(...revenueVsProfitChartData.map(d => d.revenue));
                        const maxProfit = Math.max(...revenueVsProfitChartData.map(d => Math.abs(d.profit)));
                        const maxValue = Math.max(maxRevenue, maxProfit);
                        const barWidth = 480 / revenueVsProfitChartData.length;
                        const x = 60 + index * barWidth;
                        const revenueHeight = (item.revenue / maxValue) * 200;
                        const profitHeight = (Math.abs(item.profit) / maxValue) * 200;
                        
                        return (
                          <g key={index}>
                            <rect
                              x={x + 5}
                              y={240 - revenueHeight}
                              width={barWidth / 2 - 10}
                              height={revenueHeight}
                              fill="#3b82f6"
                              onClick={() =>
                                openTransactionRawData(
                                  `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                                  (sale) => {
                                    const saleDate = sale.cp_date || sale.date;
                                    const date = new Date(saleDate);
                                    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                    return yearMonth === (item.originalLabel || item.label);
                                  }
                                )
                              }
                              style={{ cursor: 'pointer' }}
                            />
                            <rect
                              x={x + barWidth / 2 + 5}
                              y={240 - profitHeight}
                              width={barWidth / 2 - 10}
                              height={profitHeight}
                              fill={item.profit >= 0 ? '#10b981' : '#ef4444'}
                              onClick={() =>
                                openTransactionRawData(
                                  `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                                  (sale) => {
                                    const saleDate = sale.cp_date || sale.date;
                                    const date = new Date(saleDate);
                                    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                    return yearMonth === (item.originalLabel || item.label);
                                  }
                                )
                              }
                              style={{ cursor: 'pointer' }}
                            />
                            <text
                              x={x + barWidth / 2}
                              y={280}
                              textAnchor="middle"
                              style={{ fontSize: '8px', fill: '#6b7280' }}
                              transform={`rotate(-45 ${x + barWidth / 2} 280)`}
                            >
                              {item.label}
                            </text>
                          </g>
                        );
                      })}
                      
                      {/* Legend */}
                      <g transform="translate(20, 20)">
                        <rect x="0" y="0" width="15" height="10" fill="#3b82f6" />
                        <text x="20" y="9" style={{ fontSize: '12px', fill: '#1e293b' }}>Revenue</text>
                        <rect x="0" y="15" width="15" height="10" fill="#10b981" />
                        <text x="20" y="24" style={{ fontSize: '12px', fill: '#1e293b' }}>Profit</text>
                      </g>
                    </svg>
                    <div style={{
                      marginTop: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {revenueVsProfitChartData.map((item) => (
                        <div
                          key={item.originalLabel}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            background: '#f8fafc'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: '#1e293b' }}>{item.label}</span>
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              Revenue: ₹{item.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Profit: ₹{item.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openRawData('revenueVsProfit', item.originalLabel)}
                            style={rawDataIconButtonStyle}
                            onMouseEnter={handleRawDataButtonMouseEnter}
                            onMouseLeave={handleRawDataButtonMouseLeave}
                            title={`View raw data for ${item.label}`}
                          >
                            <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Month-wise Profit Chart */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
                overflow: 'hidden'
              }}>
                {monthWiseProfitChartType === 'bar' && (
                   <BarChart
                     data={monthWiseProfitChartData}
                     customHeader={
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                         justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => openRawData('monthProfit')}
                      style={rawDataIconButtonStyle}
                      onMouseEnter={handleRawDataButtonMouseEnter}
                      onMouseLeave={handleRawDataButtonMouseLeave}
                      title="View raw data"
                    >
                      <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                    </button>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                      Month-wise Profit
                    </h3>
                    {renderCardFilterBadges('period')}
                  </div>
                  <select
                    value={monthWiseProfitChartType}
                    onChange={(e) => setMonthWiseProfitChartType(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      background: 'white',
                      color: '#374151'
                    }}
                  >
                    <option value="bar">Bar</option>
                    <option value="pie">Pie</option>
                    <option value="treemap">Tree Map</option>
                    <option value="line">Line</option>
                  </select>
                </div>
                     }
                     onBarClick={(periodLabel) => {
                       const clickedPeriod = monthWiseProfitChartData.find(p => p.label === periodLabel);
                       if (clickedPeriod) {
                         setSelectedPeriod(clickedPeriod.originalLabel);
                       }
                     }}
                     onBackClick={() => {
                       setSelectedPeriod(null);
                     }}
                     showBackButton={selectedPeriod !== null}
                     rowAction={{
                       icon: 'table_view',
                       title: 'View raw data',
                       onClick: (item) =>
                         openTransactionRawData(
                           `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                           (sale) => {
                             const saleDate = sale.cp_date || sale.date;
                             const date = new Date(saleDate);
                             const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                             return yearMonth === (item.originalLabel || item.label);
                           }
                         ),
                     }}
                   />
                 )}
                 {monthWiseProfitChartType === 'pie' && (
                   <PieChart
                     data={monthWiseProfitChartData}
                     customHeader={
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <button
                             type="button"
                             onClick={() => openRawData('monthProfit')}
                             style={rawDataIconButtonStyle}
                             onMouseEnter={handleRawDataButtonMouseEnter}
                             onMouseLeave={handleRawDataButtonMouseLeave}
                             title="View raw data"
                           >
                             <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                           </button>
                           <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                             Month-wise Profit
                           </h3>
                           {renderCardFilterBadges('period')}
                         </div>
                         <select
                           value={monthWiseProfitChartType}
                           onChange={(e) => setMonthWiseProfitChartType(e.target.value)}
                           style={{
                             padding: '6px 12px',
                             border: '1px solid #d1d5db',
                             borderRadius: '6px',
                             fontSize: '12px',
                             background: 'white',
                             color: '#374151'
                           }}
                         >
                           <option value="bar">Bar</option>
                           <option value="pie">Pie</option>
                           <option value="treemap">Tree Map</option>
                           <option value="line">Line</option>
                         </select>
                       </div>
                     }
                     onSliceClick={(periodLabel) => {
                       const clickedPeriod = monthWiseProfitChartData.find(p => p.label === periodLabel);
                       if (clickedPeriod) {
                         setSelectedPeriod(clickedPeriod.originalLabel);
                       }
                     }}
                     onBackClick={() => {
                       setSelectedPeriod(null);
                     }}
                     showBackButton={selectedPeriod !== null}
                     rowAction={{
                       icon: 'table_view',
                       title: 'View raw data',
                       onClick: (item) =>
                         openTransactionRawData(
                           `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                           (sale) => {
                             const saleDate = sale.cp_date || sale.date;
                             const date = new Date(saleDate);
                             const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                             return yearMonth === (item.originalLabel || item.label);
                           }
                         ),
                     }}
                   />
                 )}
                 {monthWiseProfitChartType === 'treemap' && (
                   <TreeMap
                     data={monthWiseProfitChartData}
                     customHeader={
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <button
                             type="button"
                             onClick={() => openRawData('monthProfit')}
                             style={rawDataIconButtonStyle}
                             onMouseEnter={handleRawDataButtonMouseEnter}
                             onMouseLeave={handleRawDataButtonMouseLeave}
                             title="View raw data"
                           >
                             <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                           </button>
                           <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                             Month-wise Profit
                           </h3>
                           {renderCardFilterBadges('period')}
                         </div>
                         <select
                           value={monthWiseProfitChartType}
                           onChange={(e) => setMonthWiseProfitChartType(e.target.value)}
                           style={{
                             padding: '6px 12px',
                             border: '1px solid #d1d5db',
                             borderRadius: '6px',
                             fontSize: '12px',
                             background: 'white',
                             color: '#374151'
                           }}
                         >
                           <option value="bar">Bar</option>
                           <option value="pie">Pie</option>
                           <option value="treemap">Tree Map</option>
                           <option value="line">Line</option>
                         </select>
                       </div>
                     }
                     onBoxClick={(periodLabel) => {
                       const clickedPeriod = monthWiseProfitChartData.find(p => p.label === periodLabel);
                       if (clickedPeriod) {
                         setSelectedPeriod(clickedPeriod.originalLabel);
                       }
                     }}
                     onBackClick={() => {
                       setSelectedPeriod(null);
                     }}
                     showBackButton={selectedPeriod !== null}
                     rowAction={{
                       icon: 'table_view',
                       title: 'View raw data',
                       onClick: (item) =>
                         openTransactionRawData(
                           `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                           (sale) => {
                             const saleDate = sale.cp_date || sale.date;
                             const date = new Date(saleDate);
                             const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                             return yearMonth === (item.originalLabel || item.label);
                           }
                         ),
                     }}
                   />
                 )}
                 {monthWiseProfitChartType === 'line' && (
                   <LineChart
                     data={monthWiseProfitChartData}
                     customHeader={
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <button
                             type="button"
                             onClick={() => openRawData('monthProfit')}
                             style={rawDataIconButtonStyle}
                             onMouseEnter={handleRawDataButtonMouseEnter}
                             onMouseLeave={handleRawDataButtonMouseLeave}
                             title="View raw data"
                           >
                             <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                           </button>
                           <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                             Month-wise Profit
                           </h3>
                           {renderCardFilterBadges('period')}
                         </div>
                         <select
                           value={monthWiseProfitChartType}
                           onChange={(e) => setMonthWiseProfitChartType(e.target.value)}
                           style={{
                             padding: '6px 12px',
                             border: '1px solid #d1d5db',
                             borderRadius: '6px',
                             fontSize: '12px',
                             background: 'white',
                             color: '#374151'
                           }}
                         >
                           <option value="bar">Bar</option>
                           <option value="pie">Pie</option>
                           <option value="treemap">Tree Map</option>
                           <option value="line">Line</option>
                         </select>
                       </div>
                     }
                     onPointClick={(periodLabel) => {
                       const clickedPeriod = monthWiseProfitChartData.find(p => p.label === periodLabel);
                       if (clickedPeriod) {
                         setSelectedPeriod(clickedPeriod.originalLabel);
                       }
                     }}
                     onBackClick={() => {
                       setSelectedPeriod(null);
                     }}
                     showBackButton={selectedPeriod !== null}
                     rowAction={{
                       icon: 'table_view',
                       title: 'View raw data',
                       onClick: (item) =>
                         openTransactionRawData(
                           `Raw Data - ${formatPeriodLabel(item.originalLabel || item.label)}`,
                           (sale) => {
                             const saleDate = sale.cp_date || sale.date;
                             const date = new Date(saleDate);
                             const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                             return yearMonth === (item.originalLabel || item.label);
                           }
                         ),
                     }}
                   />
                 )}
              </div>
            </div>
          )}

          {/* Row 6: Top 10 Profitable Items and Top 10 Loss Items */}
          {canShowProfit && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Top 10 Profitable Items */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px',
              overflow: 'hidden'
            }}>
              {topProfitableItemsChartType === 'bar' && (
                <BarChart
                  data={topProfitableItemsData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('topProfitable')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Top 10 Profitable Items
                  </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <select
                  value={topProfitableItemsChartType}
                  onChange={(e) => setTopProfitableItemsChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                  valuePrefix="₹"
                  onBarClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topProfitableItemsChartType === 'pie' && (
                <PieChart
                  data={topProfitableItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topProfitable')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Profitable Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topProfitableItemsChartType}
                        onChange={(e) => setTopProfitableItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                  onSliceClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topProfitableItemsChartType === 'treemap' && (
                <TreeMap
                  data={topProfitableItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topProfitable')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Profitable Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topProfitableItemsChartType}
                        onChange={(e) => setTopProfitableItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                  onBoxClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topProfitableItemsChartType === 'line' && (
                <LineChart
                  data={topProfitableItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topProfitable')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Profitable Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topProfitableItemsChartType}
                        onChange={(e) => setTopProfitableItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                  onPointClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
            </div>

            {/* Top 10 Loss Items */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px',
              overflow: 'hidden'
            }}>
              {topLossItemsChartType === 'bar' && (
                <BarChart
                  data={topLossItemsData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('topLoss')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Top 10 Loss Items
                  </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <select
                  value={topLossItemsChartType}
                  onChange={(e) => setTopLossItemsChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
              </div>
                  }
                  valuePrefix="₹"
                  onBarClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) =>
                      openTransactionRawData(
                        `Raw Data - ${item.label}`,
                        (sale) => sale.item && String(sale.item).trim().toLowerCase() === String(item.label).trim().toLowerCase()
                      ),
                  }}
                />
              )}
              {topLossItemsChartType === 'pie' && (
                <PieChart
                  data={topLossItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topLoss')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Loss Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topLossItemsChartType}
                        onChange={(e) => setTopLossItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onSliceClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
              {topLossItemsChartType === 'treemap' && (
                <TreeMap
                  data={topLossItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topLoss')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Loss Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topLossItemsChartType}
                        onChange={(e) => setTopLossItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onBoxClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
              {topLossItemsChartType === 'line' && (
                <LineChart
                  data={topLossItemsData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('topLoss')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Top 10 Loss Items
                        </h3>
                        {renderCardFilterBadges('topItems')}
                      </div>
                      <select
                        value={topLossItemsChartType}
                        onChange={(e) => setTopLossItemsChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onPointClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
            </div>
          </div>
          )}

          {/* Sales by Stock Group and Custom Cards - Moved to end */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Sales by Stock Group */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px',
              overflow: 'hidden'
            }}>
              {categoryChartType === 'bar' && (
                <BarChart
                  data={categoryChartData}
                  customHeader={
              <div style={{
                display: 'flex',
                alignItems: 'center',
                      justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openRawData('stockGroup')}
                    style={rawDataIconButtonStyle}
                    onMouseEnter={handleRawDataButtonMouseEnter}
                    onMouseLeave={handleRawDataButtonMouseLeave}
                    title="View raw data"
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                  </button>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                    Sales by Stock Group
                </h3>
                  {renderCardFilterBadges('stockGroup')}
        </div>
                <select
                  value={categoryChartType}
                  onChange={(e) => setCategoryChartType(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: 'white',
                    color: '#374151'
                  }}
                >
                  <option value="bar">Bar</option>
                  <option value="pie">Pie</option>
                  <option value="treemap">Tree Map</option>
                  <option value="line">Line</option>
                </select>
      </div>
                  }
                  onBarClick={(stockGroup) => setSelectedStockGroup(stockGroup)}
                  onBackClick={() => setSelectedStockGroup('all')}
                  showBackButton={selectedStockGroup !== 'all'}
                  rowAction={{
                    icon: 'table_view',
                    title: 'View raw data',
                    onClick: (item) => openRawData('stockGroupItemTransactions', item.label),
                  }}
                />
                )}
                {categoryChartType === 'pie' && (
                  <PieChart
                    data={categoryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('stockGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Stock Group
                        </h3>
                      </div>
                      <select
                        value={categoryChartType}
                        onChange={(e) => setCategoryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onSliceClick={(stockGroup) => setSelectedStockGroup(stockGroup)}
                    onBackClick={() => setSelectedStockGroup('all')}
                    showBackButton={selectedStockGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('stockGroupItemTransactions', item.label),
                    }}
                  />
                )}
                {categoryChartType === 'treemap' && (
                  <TreeMap
                    data={categoryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('stockGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Stock Group
                        </h3>
                      </div>
                      <select
                        value={categoryChartType}
                        onChange={(e) => setCategoryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onBoxClick={(stockGroup) => setSelectedStockGroup(stockGroup)}
                    onBackClick={() => setSelectedStockGroup('all')}
                    showBackButton={selectedStockGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('stockGroupItemTransactions', item.label),
                    }}
                  />
                )}
                {categoryChartType === 'line' && (
                  <LineChart
                    data={categoryChartData}
                  customHeader={
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openRawData('stockGroup')}
                          style={rawDataIconButtonStyle}
                          onMouseEnter={handleRawDataButtonMouseEnter}
                          onMouseLeave={handleRawDataButtonMouseLeave}
                          title="View raw data"
                        >
                          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
                        </button>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                          Sales by Stock Group
                        </h3>
                      </div>
                      <select
                        value={categoryChartType}
                        onChange={(e) => setCategoryChartType(e.target.value)}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          background: 'white',
                          color: '#374151'
                        }}
                      >
                        <option value="bar">Bar</option>
                        <option value="pie">Pie</option>
                        <option value="treemap">Tree Map</option>
                        <option value="line">Line</option>
                      </select>
                    </div>
                  }
                    onPointClick={(stockGroup) => setSelectedStockGroup(stockGroup)}
                    onBackClick={() => setSelectedStockGroup('all')}
                    showBackButton={selectedStockGroup !== 'all'}
                    rowAction={{
                      icon: 'table_view',
                      title: 'View raw data',
                      onClick: (item) => openRawData('stockGroupItemTransactions', item.label),
                    }}
                  />
                )}
    </div>

            {/* First Custom Card - Next to Sales by Stock Group */}
    {customCards.length > 0 && (
              <div ref={customCards.length === 1 ? customCardsSectionRef : null}>
                <CustomCard
                  key={customCards[0].id}
                  card={customCards[0]}
                  salesData={filteredSales}
                  generateCustomCardData={generateCustomCardData}
                  chartType={customCardChartTypes[customCards[0].id] || customCards[0].chartType || 'bar'}
                  onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [customCards[0].id]: newType }))}
                  onDelete={() => handleDeleteCustomCard(customCards[0].id)}
                  onEdit={handleEditCustomCard}
                  openTransactionRawData={openTransactionRawData}
                  setSelectedCustomer={setSelectedCustomer}
                  setSelectedItem={setSelectedItem}
                  setSelectedStockGroup={setSelectedStockGroup}
                  setSelectedRegion={setSelectedRegion}
                  setSelectedCountry={setSelectedCountry}
                  setSelectedPeriod={setSelectedPeriod}
                  setSelectedLedgerGroup={setSelectedLedgerGroup}
                  selectedCustomer={selectedCustomer}
                  selectedItem={selectedItem}
                  selectedStockGroup={selectedStockGroup}
                  selectedRegion={selectedRegion}
                  selectedCountry={selectedCountry}
                  selectedPeriod={selectedPeriod}
                  selectedLedgerGroup={selectedLedgerGroup}
                  genericFilters={genericFilters}
                  setGenericFilters={setGenericFilters}
                  renderCardFilterBadges={renderCardFilterBadges}
                  customCards={customCards}
                  isMobile={isMobile}
                  formatPeriodLabel={formatPeriodLabel}
                />
              </div>
            )}
          </div>

          {/* Additional Custom Cards - Continue in the same grid layout, filling positions sequentially */}
          {customCards.length > 1 && (
            <div 
              ref={customCards.length === 2 ? customCardsSectionRef : null}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '24px',
                marginBottom: '24px'
              }}>
              {customCards.slice(1).map((card, index) => (
                <div
                  key={card.id}
                  ref={index === customCards.slice(1).length - 1 ? customCardsSectionRef : null}
                >
                  <CustomCard
                    card={card}
                    salesData={filteredSales}
                    generateCustomCardData={generateCustomCardData}
                    chartType={customCardChartTypes[card.id] || card.chartType || 'bar'}
                    onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [card.id]: newType }))}
                    onDelete={() => handleDeleteCustomCard(card.id)}
                    onEdit={handleEditCustomCard}
                    openTransactionRawData={openTransactionRawData}
                    setSelectedCustomer={setSelectedCustomer}
                    setSelectedItem={setSelectedItem}
                    setSelectedStockGroup={setSelectedStockGroup}
                    setSelectedRegion={setSelectedRegion}
                    setSelectedCountry={setSelectedCountry}
                    setSelectedPeriod={setSelectedPeriod}
                    setSelectedLedgerGroup={setSelectedLedgerGroup}
                    selectedCustomer={selectedCustomer}
                    selectedItem={selectedItem}
                    selectedStockGroup={selectedStockGroup}
                    selectedRegion={selectedRegion}
                    selectedCountry={selectedCountry}
                    selectedPeriod={selectedPeriod}
                    selectedLedgerGroup={selectedLedgerGroup}
                    genericFilters={genericFilters}
                    setGenericFilters={setGenericFilters}
                    renderCardFilterBadges={renderCardFilterBadges}
                    customCards={customCards}
                    isMobile={isMobile}
                    formatPeriodLabel={formatPeriodLabel}
                  />
                </div>
              ))}
            </div>
          )}
          
        </div>
        </form>
      </div>
    </div>

    {rawDataModal.open && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          zIndex: 12000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
        onClick={closeRawData}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: 'min(1580px, 100%)',
            height: '80vh',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{rawDataModal.title}</h2>
              <div style={{ marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
                {totalRawRows} {totalRawRows === 1 ? 'record' : 'records'}
              </div>
            </div>
            <button
              type="button"
              onClick={closeRawData}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                borderRadius: '50%',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s ease, color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#1e293b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#64748b';
              }}
              title="Close"
            >
              <span className="material-icons" style={{ fontSize: '22px' }}>close</span>
            </button>
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div
              style={{
                flex: '1 1 260px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>search</span>
              <input
                value={rawDataSearch}
                onChange={(e) => {
                  setRawDataSearch(e.target.value);
                  setRawDataPage(1);
                }}
                placeholder="Search raw data..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '14px',
                  color: '#1e293b'
                }}
              />
              {rawDataSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRawDataSearch('');
                    setRawDataPage(1);
                  }}
                  style={{
                    border: 'none',
                    background: '#e2e8f0',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569',
                    transition: 'background 0.2s ease, color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#cbd5f5';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#475569';
                  }}
                  title="Clear search"
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={exportRawDataToCSV}
              style={{
                background: 'linear-gradient(135deg, #047857 0%, #065f46 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(4, 120, 87, 0.2)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(4, 120, 87, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(4, 120, 87, 0.2)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '18px' }}>file_download</span>
              Export CSV
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {paginatedRawRows.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                No data available for the current selection.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {rawDataModal.columns.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          padding: '12px 16px',
                          textAlign: column.format ? 'right' : 'left',
                          fontSize: '12px',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: 600,
                          position: 'sticky',
                          top: 0,
                          background: '#f8fafc'
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRawRows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      style={{ 
                        borderBottom: '1px solid #e2e8f0', 
                        transition: 'background 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleBillRowClick(row)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {rawDataModal.columns.map((column) => (
                        <td
                          key={column.key}
                          style={{
                            padding: '12px 16px',
                            fontSize: '14px',
                            color: '#1e293b',
                            textAlign: column.format ? 'right' : 'left',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {renderRawDataCell(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              {totalRawRows === 0
                ? 'Showing 0 results'
                : `Showing ${rawDataStart} - ${rawDataEnd} of ${totalRawRows}`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setRawDataPage((prev) => Math.max(1, prev - 1))}
                disabled={rawDataPage <= 1 || totalRawRows === 0}
                style={{
                  background: rawDataPage <= 1 || totalRawRows === 0 ? '#f1f5f9' : '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: rawDataPage <= 1 || totalRawRows === 0 ? 'not-allowed' : 'pointer',
                  color: '#1e293b',
                  fontSize: '13px'
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: '13px', color: '#1e293b' }}>
                Page {totalRawRows === 0 ? 0 : rawDataPage} / {totalRawRows === 0 ? 0 : totalRawPages}
              </span>
              <button
                type="button"
                onClick={() => setRawDataPage((prev) => Math.min(totalRawPages, prev + 1))}
                disabled={rawDataPage >= totalRawPages || totalRawRows === 0}
                style={{
                  background: rawDataPage >= totalRawPages || totalRawRows === 0 ? '#f1f5f9' : '#e2e8f0',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: rawDataPage >= totalRawPages || totalRawRows === 0 ? 'not-allowed' : 'pointer',
                  color: '#1e293b',
                  fontSize: '13px'
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* AI ChatBot */}
    {sales.length > 0 && (
      <ChatBot 
        salesData={sales} 
        metrics={metrics}
      />
    )}

    {/* Bill Drilldown Modal */}
    {showDrilldown && (
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 13000,
          pointerEvents: 'auto'
        }}
      >
        <BillDrilldownModal
          data={drilldownData}
          loading={drilldownLoading}
          error={drilldownError}
          selectedBill={selectedBill}
          showInfoCard={false}
          onClose={() => {
            setShowDrilldown(false);
            setDrilldownData(null);
            setDrilldownError(null);
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
            }
          }}
          onRowClick={handleVoucherRowClick}
        />
      </div>
    )}

    {/* Voucher Details Modal */}
    {showVoucherDetails && (
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 15000,
          pointerEvents: 'auto'
        }}
      >
        <VoucherDetailsModal
          voucherData={voucherDetailsData}
          loading={voucherDetailsLoading}
          error={voucherDetailsError}
          onClose={() => {
            setShowVoucherDetails(false);
            setVoucherDetailsData(null);
            setVoucherDetailsError(null);
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
            }
          }}
        />
      </div>
    )}

    {/* Navigation Warning Modal */}
    {showNavigationWarning && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '24px 28px',
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '32px', 
              color: '#fff',
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              warning
            </span>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '700',
              color: '#fff',
              letterSpacing: '-0.01em'
            }}>
              Data Loading in Progress
            </h3>
          </div>

          {/* Content */}
          <div style={{
            padding: '28px'
          }}>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#334155',
              fontWeight: '400'
            }}>
              Sales data is currently being fetched in chunks 
              ({progress.current} of {progress.total} completed, {progress.percentage}% done).
            </p>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#334155',
              fontWeight: '500'
            }}>
              If you navigate away now, the data loading will stop and you may lose progress.
            </p>

            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span className="material-icons" style={{ 
                fontSize: '20px', 
                color: '#f59e0b',
                marginTop: '1px'
              }}>
                info
              </span>
              <p style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#78350f',
                fontWeight: '500'
              }}>
                Recommended: Wait for the data loading to complete for best results.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowNavigationWarning(false);
                  setPendingNavigation(null);
                }}
                style={{
                  padding: '12px 24px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f8fafc';
                  e.target.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ffffff';
                  e.target.style.borderColor = '#e2e8f0';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>schedule</span>
                Wait & Continue
              </button>
              <button
                onClick={() => {
                  abortLoadingRef.current = true;
                  setLoading(false);
                  setLoadingStartTime(null);
                  setShowNavigationWarning(false);
                  if (pendingNavigation) {
                    pendingNavigation();
                  }
                  setPendingNavigation(null);
                }}
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                  e.target.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                  e.target.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>exit_to_app</span>
                Stop & Leave
              </button>
            </div>
          </div>

          {/* Pulse animation */}
          <style>{`
            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.6;
              }
            }
          `}</style>
        </div>
      </div>
    )}

    {/* Custom Card Modal */}
    {showCustomCardModal && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 16000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowCustomCardModal(false);
          }
        }}
      >
        <CustomCardModal
          salesData={sales}
          editingCard={editingCardId ? customCards.find(card => card.id === editingCardId) : null}
          onClose={() => {
            console.log('🔒 Custom Card Modal closed - no data fetching should occur');
            setShowCustomCardModal(false);
            setEditingCardId(null);
          }}
          onCreate={handleCreateCustomCard}
        />
      </div>
    )}

    {/* Calendar Modal */}
    {showCalendarModal && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 17000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCancelDates();
          }
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '24px',
            maxWidth: '400px',
            width: '100%'
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 6px 0'
            }}>
              Select Date Range
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0
            }}>
              Choose the start and end dates for your sales data
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '6px'
            }}>
              From Date
            </label>
            <input
              type="date"
              value={tempFromDate}
              min={booksFromDate}
              onChange={(e) => setTempFromDate(e.target.value)}
              style={{
                width: 'calc(100% - 4px)',
                maxWidth: '100%',
                padding: '8px 12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e293b',
                outline: 'none',
                transition: 'all 0.2s ease',
                fontWeight: '500',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#7c3aed';
                e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
            {booksFromDate && (
              <p style={{
                fontSize: '11px',
                color: '#64748b',
                marginTop: '4px',
                marginBottom: 0
              }}>
                Earliest available date: {booksFromDate}
              </p>
            )}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#475569',
              marginBottom: '6px'
            }}>
              To Date
            </label>
            <input
              type="date"
              value={tempToDate}
              onChange={(e) => setTempToDate(e.target.value)}
              style={{
                width: 'calc(100% - 4px)',
                maxWidth: '100%',
                padding: '8px 12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e293b',
                outline: 'none',
                transition: 'all 0.2s ease',
                fontWeight: '500',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#7c3aed';
                e.target.style.boxShadow = '0 0 0 3px rgba(124, 58, 237, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleCancelDates}
              style={{
                padding: '10px 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '10px',
                background: 'white',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f8fafc';
                e.target.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.borderColor = '#e2e8f0';
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyDates}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px rgba(124, 58, 237, 0.25)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)';
                e.target.style.boxShadow = '0 6px 10px rgba(124, 58, 237, 0.35)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                e.target.style.boxShadow = '0 4px 6px rgba(124, 58, 237, 0.25)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

// Custom Card Modal Component
const CustomCardModal = ({ salesData, onClose, onCreate, editingCard }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize form state from editingCard if provided, otherwise use defaults
  const [cardTitle, setCardTitle] = useState(editingCard?.title || '');
  const [selectedFields, setSelectedFields] = useState(() => {
    // Initialize from editingCard if available
    if (editingCard) {
      const fields = new Set();
      // Add groupBy field
      if (editingCard.groupBy === 'date') {
        fields.add('date');
      } else {
        fields.add(editingCard.groupBy);
      }
      // Add valueField
      if (editingCard.valueField) {
        fields.add(editingCard.valueField);
      }
      return fields;
    }
    return new Set();
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [topN, setTopN] = useState(editingCard?.topN ? String(editingCard.topN) : '');
  const [fieldAggregations, setFieldAggregations] = useState(() => {
    // Initialize from editingCard if available
    if (editingCard) {
      const aggs = {};
      if (editingCard.valueField) {
        aggs[editingCard.valueField] = editingCard.aggregation || 'sum';
      }
      return aggs;
    }
    return {};
  });
  const [dateGroupings, setDateGroupings] = useState(() => {
    // Initialize from editingCard if available
    if (editingCard && editingCard.groupBy === 'date' && editingCard.dateGrouping) {
      return {
        date: editingCard.dateGrouping
      };
    }
    return {};
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [fieldBeingConfigured, setFieldBeingConfigured] = useState(null);
  const [isDateSettingsModal, setIsDateSettingsModal] = useState(false);

  // AI mode state
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'ai'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Update form when editingCard changes
  useEffect(() => {
    if (editingCard) {
      setCardTitle(editingCard.title || '');
      const fields = new Set();
      // Add groupBy field
      if (editingCard.groupBy === 'date') {
        fields.add('date');
      } else {
        fields.add(editingCard.groupBy);
      }
      // Add valueField
      if (editingCard.valueField) {
        fields.add(editingCard.valueField);
      }
      setSelectedFields(fields);
      
      // Set aggregation for value field
      if (editingCard.valueField && editingCard.aggregation) {
        setFieldAggregations({
          [editingCard.valueField]: editingCard.aggregation
        });
      }
      
      // Set date grouping for date field
      if (editingCard.groupBy === 'date' && editingCard.dateGrouping) {
        setDateGroupings({
          date: editingCard.dateGrouping
        });
      }
      setTopN(editingCard.topN ? String(editingCard.topN) : '');
    } else {
      // Reset to defaults when not editing
      setCardTitle('');
      setSelectedFields(new Set());
      setTopN('');
    }
  }, [editingCard]);

  // Extract all available fields from sales data dynamically
  // NOTE: This only processes existing data in memory - NO API calls are made
  const allFields = useMemo(() => {
    // Use existing data only - do not trigger any data fetching
    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return [];
    }

    // Get all unique keys from the first sale object
    // Also check all records to ensure we get all possible field names
    const firstSale = salesData[0];
    const allKeysSet = new Set(Object.keys(firstSale));
    // Check additional records to catch any fields that might not be in the first record
    salesData.slice(0, Math.min(10, salesData.length)).forEach(sale => {
      Object.keys(sale).forEach(key => allKeysSet.add(key));
    });
    const allKeys = Array.from(allKeysSet);

    // Filter out non-groupable fields (dates, IDs, numeric-only fields, etc.) for groupBy
    // Keep fields that can be used for grouping (strings, categories, etc.)
    const nonGroupableFields = ['date', 'cp_date', 'vchno', 'masterid', 'issales'];
    
    // Also filter out fields that are primarily numeric (but allow them if they might have string values)
    const numericOnlyFields = ['amount', 'quantity', 'profit', 'cgst', 'sgst', 'roundoff', 'invvalue', 'billedqty', 'rate', 'addlexpense', 'invtrytotal', 'grosscost'];
    
    // Fields that should always be treated as categories, even if they're numeric (like pincode)
    const alwaysCategoryFields = ['pincode', 'pin', 'pincod', 'postalcode', 'postcode'];
    
    // Group By fields (X-axis) - can be any field except calculated/numeric-only values
    // Check all sales records to see which fields have string/categorical values
    const fieldTypes = {};
    salesData.slice(0, Math.min(100, salesData.length)).forEach(sale => {
      allKeys.forEach(key => {
        if (!fieldTypes[key]) {
          const value = sale[key];
          if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'string') {
              // Check if it's a numeric string
              const numValue = parseFloat(value);
              if (isNaN(numValue) || !isFinite(numValue)) {
                fieldTypes[key] = 'string'; // Non-numeric string - good for grouping
              } else {
                fieldTypes[key] = fieldTypes[key] || 'numeric'; // Could be numeric
              }
            } else if (typeof value === 'number') {
              fieldTypes[key] = 'numeric';
            } else {
              fieldTypes[key] = 'other';
            }
          }
        }
      });
    });

    // Combine all fields into a single list
    const fields = [];
    
    // Add date field (grouping will be configured via settings)
    fields.push(
      { value: 'date', label: 'Date', type: 'category' }
    );
    
    // Add category fields (for Axis)
    allKeys
      .filter(key => {
        const lowerKey = key.toLowerCase();
        if (nonGroupableFields.includes(lowerKey)) return false;
        const fieldType = fieldTypes[key];
        if (fieldType === 'string' || fieldType === 'other') return true;
        return !numericOnlyFields.includes(lowerKey);
      })
      .forEach(key => {
        fields.push({
          value: key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
          type: 'category'
        });
      });
    
    // Add value fields (for Values bucket)
    const numericFields = allKeys.filter(key => {
      const lowerKey = key.toLowerCase();
      if (nonGroupableFields.includes(lowerKey)) return false;
      // Exclude fields that should always be categories (like pincode)
      if (alwaysCategoryFields.includes(lowerKey)) return false;
      if (lowerKey === 'cp_temp7' || lowerKey === 'narration') return false;
      const value = firstSale[key];
      if (typeof value === 'number') return true;
      if (typeof value === 'string') {
        const numValue = parseFloat(value);
        return !isNaN(numValue) && isFinite(numValue) && value.trim() !== '';
      }
      return false;
    });
    
    numericFields.forEach(key => {
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
      fields.push({
        value: key,
        label: label,
        type: 'value',
        aggregation: 'sum' // Default aggregation
      });
    });
    
    // Add count fields
    fields.push(
      { value: 'transactions', label: 'Number of Transactions', type: 'value', aggregation: 'count' },
      { value: 'unique_customers', label: 'Number of Unique Customers', type: 'value', aggregation: 'count' },
      { value: 'unique_items', label: 'Number of Unique Items', type: 'value', aggregation: 'count' },
      { value: 'unique_orders', label: 'Number of Unique Orders', type: 'value', aggregation: 'count' }
    );
    
    // Deduplicate fields by value (case-insensitive)
    // If a field appears as both category and value, prefer category for alwaysCategoryFields, otherwise prefer value
    const fieldsMap = new Map();
    fields.forEach(field => {
      const key = field.value.toLowerCase();
      const existing = fieldsMap.get(key);
      if (!existing) {
        fieldsMap.set(key, field);
      } else {
        // If field is in alwaysCategoryFields, prefer category type
        if (alwaysCategoryFields.includes(key)) {
          if (field.type === 'category') {
            fieldsMap.set(key, field);
          }
          // Otherwise keep existing category
        } else {
          // For other fields, if new one is value type, replace (value fields are more versatile)
          if (field.type === 'value' && existing.type === 'category') {
            fieldsMap.set(key, field);
          }
        }
      }
    });
    
    // Convert back to array and sort
    const uniqueFields = Array.from(fieldsMap.values());
    return uniqueFields.sort((a, b) => a.label.localeCompare(b.label));
  }, [salesData]);
  
  // AI card generation function
  const generateCardWithAI = async (prompt) => {
    if (!prompt.trim()) {
      throw new Error('Please enter a prompt');
    }
    
    // Extract category and value fields for the LLM
    const categoryFields = allFields
      .filter(f => f.type === 'category')
      .map(f => ({ value: f.value, label: f.label }));
    
    const valueFields = allFields
      .filter(f => f.type === 'value')
      .map(f => ({ value: f.value, label: f.label, aggregation: f.aggregation }));
    
    // Build system prompt
    const systemPrompt = `You are an AI assistant that helps create data visualization configurations for a sales dashboard.

The sales data has already been transformed into flat records. Each record represents one inventory item from a sales voucher.

AVAILABLE FIELDS:

Category Fields (for groupBy - use to group/categorize data):
${categoryFields.map(f => `- ${f.value}: ${f.label}`).join('\n')}

Value Fields (for valueField - numeric data to aggregate):
${valueFields.map(f => `- ${f.value}: ${f.label}${f.aggregation ? ` (default: ${f.aggregation})` : ''}`).join('\n')}

CARD CONFIGURATION FORMAT:
You must return ONLY ONE valid JSON object with this exact structure.
- NO markdown code blocks (no \`\`\`json or \`\`\`)
- NO explanations before or after the JSON
- NO multiple objects
- ONLY the JSON object itself

Required structure:
{
  "title": "Card Title",
  "groupBy": "field_name",
  "dateGrouping": "month",
  "aggregation": "sum",
  "valueField": "amount",
  "chartType": "bar",
  "topN": 10
}

FIELD DESCRIPTIONS:
- title: A descriptive title for the card (string)
- groupBy: One of the category field values listed above (string, required)
- dateGrouping: ONLY if groupBy is "date", use "day", "week", "month", or "year" (string, optional)
- aggregation: "sum", "average", "count", "min", or "max" (string, required)
- valueField: One of the value field values listed above (string, required)
- chartType: "bar", "pie", "treemap", or "line" (string, required)
- topN: Limit to top N items (number, optional - only include if user specifically asks for "top X")

CHART TYPE SELECTION GUIDE:
- "bar": Best for comparing values across categories (most common)
- "pie": Best for showing proportions/percentages of a whole
- "line": Best for trends over time (especially with date grouping)
- "treemap": Best for hierarchical data with many categories

EXAMPLE MAPPINGS:
- "top 10 customers by revenue" → {"title":"Top 10 Customers by Revenue","groupBy":"customer","aggregation":"sum","valueField":"amount","chartType":"bar","topN":10}
- "sales by region" → {"title":"Sales by Region","groupBy":"region","aggregation":"sum","valueField":"amount","chartType":"bar"}
- "profit by item" → {"title":"Profit by Item","groupBy":"item","aggregation":"sum","valueField":"profit","chartType":"bar"}
- "monthly revenue trend" → {"title":"Monthly Revenue Trend","groupBy":"date","dateGrouping":"month","aggregation":"sum","valueField":"amount","chartType":"line"}
- "average order value by customer" → {"title":"Average Order Value by Customer","groupBy":"customer","aggregation":"average","valueField":"amount","chartType":"bar"}
- "item sales distribution" → {"title":"Item Sales Distribution","groupBy":"item","aggregation":"sum","valueField":"amount","chartType":"pie"}

IMPORTANT RULES:
1. Return ONLY the JSON object - no markdown code blocks, no explanations, no extra text
2. Use field values exactly as listed above (case-sensitive)
3. Always include: title, groupBy, aggregation, valueField, chartType
4. Only include dateGrouping if groupBy is "date"
5. Only include topN if the user explicitly asks for "top X" or "first N"
6. Choose aggregation wisely: "sum" for totals, "average" for means, "count" for counts
7. If the user's request is unclear, make reasonable assumptions based on common business needs`;

    try {
      const llmUrl = 'http://127.0.0.1:11434/api/chat';
      
      // Try to detect available model
      const modelsToTry = ['llama2', 'llama3', 'mistral', 'phi', 'gemma'];
      let requestBody = {
        model: modelsToTry[0],
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false,
        temperature: 0, // Make output more deterministic and reduce corruption
        format: 'json' // Request JSON format if supported by the model
      };

      console.log('🤖 Sending card generation request to LLM...');
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ LLM API error:', errorText);
        
        // Try to get available models and retry
        if (response.status === 404 || errorText.includes('model') || errorText.includes('not found')) {
          try {
            const modelsResponse = await fetch('http://127.0.0.1:11434/api/tags');
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              if (modelsData.models && modelsData.models.length > 0) {
                const firstModel = modelsData.models[0].name;
                console.log(`🔄 Retrying with model: ${firstModel}`);
                requestBody.model = firstModel;
                const retryResponse = await fetch(llmUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(requestBody)
                });
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  return parseAIResponse(retryData);
                }
              }
            }
          } catch (modelsError) {
            console.error('Failed to fetch models:', modelsError);
          }
        }
        
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return parseAIResponse(data);
    } catch (error) {
      console.error('AI generation error:', error);
      throw error;
    }
  };

  // Parse LLM response and extract cardConfig
  const parseAIResponse = (data) => {
    let responseText = '';
    
    // Extract response text from various possible formats
    if (data.message && data.message.content) {
      responseText = data.message.content;
    } else if (data.response) {
      responseText = data.response;
    } else if (typeof data === 'string') {
      responseText = data;
    } else {
      throw new Error('Unexpected LLM response format');
    }

    console.log('📥 LLM raw response:', responseText);

    // Try to extract JSON from response
    let jsonStr = responseText.trim();
    
    // Remove markdown code blocks (both ```json and ``` or just ```)
    jsonStr = jsonStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Clean up common issues
    jsonStr = jsonStr.trim();
    
    // Try to find the first complete JSON object with balanced braces
    // This handles cases where LLM returns multiple objects or corrupted data
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === '{') {
        if (braceCount === 0) {
          startIndex = i;
        }
        braceCount++;
      } else if (jsonStr[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          endIndex = i;
          break;
        }
      }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
      jsonStr = jsonStr.substring(startIndex, endIndex + 1);
    } else {
      // Fallback to original regex approach
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }
    
    // Remove any trailing commas before closing braces (common LLM error)
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    // Remove any line breaks within string values that might break JSON
    // This is a cautious approach - only fix obvious issues
    jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '" "');

    try {
      const cardConfig = JSON.parse(jsonStr);
      
      // Validate required fields
      if (!cardConfig.title || !cardConfig.groupBy || !cardConfig.aggregation || 
          !cardConfig.valueField || !cardConfig.chartType) {
        throw new Error('Invalid card configuration: missing required fields');
      }
      
      // Validate field values
      const validChartTypes = ['bar', 'pie', 'treemap', 'line'];
      if (!validChartTypes.includes(cardConfig.chartType)) {
        cardConfig.chartType = 'bar'; // Default to bar if invalid
      }
      
      const validAggregations = ['sum', 'average', 'count', 'min', 'max'];
      if (!validAggregations.includes(cardConfig.aggregation)) {
        cardConfig.aggregation = 'sum'; // Default to sum if invalid
      }
      
      // Validate dateGrouping if present
      if (cardConfig.dateGrouping) {
        const validDateGroupings = ['day', 'week', 'month', 'year'];
        if (!validDateGroupings.includes(cardConfig.dateGrouping)) {
          delete cardConfig.dateGrouping;
        }
      }
      
      // Validate topN if present
      if (cardConfig.topN !== undefined) {
        cardConfig.topN = parseInt(cardConfig.topN, 10);
        if (isNaN(cardConfig.topN) || cardConfig.topN <= 0) {
          delete cardConfig.topN;
        }
      }
      
      console.log('✅ Parsed card config:', cardConfig);
      return cardConfig;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.error('Attempted to parse:', jsonStr);
      console.error('Original response:', responseText);
      
      // Provide more helpful error message
      throw new Error('Failed to parse AI response. The LLM returned invalid JSON. Please try again with a simpler prompt.');
    }
  };

  // Handle AI generation
  const handleAIGenerate = async () => {
    setAiError(null);
    setAiLoading(true);
    
    try {
      const cardConfig = await generateCardWithAI(aiPrompt);
      
      // Auto-populate form fields with AI-generated config
      setCardTitle(cardConfig.title);
      
      // Set selected fields
      const fields = new Set();
      fields.add(cardConfig.groupBy === 'date' ? 'date' : cardConfig.groupBy);
      fields.add(cardConfig.valueField);
      setSelectedFields(fields);
      
      // Set aggregation
      setFieldAggregations({
        [cardConfig.valueField]: cardConfig.aggregation
      });
      
      // Set date grouping if applicable
      if (cardConfig.groupBy === 'date' && cardConfig.dateGrouping) {
        setDateGroupings({
          date: cardConfig.dateGrouping
        });
      }
      
      // Set topN if present
      if (cardConfig.topN) {
        setTopN(String(cardConfig.topN));
      }
      
      // Switch to manual tab for review
      setActiveTab('manual');
      setAiPrompt(''); // Clear prompt
      
      alert('✅ Card configuration generated! Review and adjust the settings below, then click "Create Card".');
    } catch (error) {
      console.error('AI generation failed:', error);
      setAiError(error.message || 'Failed to generate card configuration');
    } finally {
      setAiLoading(false);
    }
  };
  
  // Filter fields based on search term
  const filteredFields = useMemo(() => {
    if (!searchTerm.trim()) return allFields;
    const term = searchTerm.toLowerCase();
    return allFields.filter(field => 
      field.label.toLowerCase().includes(term) || 
      field.value.toLowerCase().includes(term)
    );
  }, [allFields, searchTerm]);
  
  // Get fields in each bucket
  const axisFields = useMemo(() => {
    return Array.from(selectedFields)
      .map(fieldValue => allFields.find(f => f.value === fieldValue))
      .filter(field => field && field.type === 'category');
  }, [selectedFields, allFields]);
  
  const valueFields = useMemo(() => {
    return Array.from(selectedFields)
      .map(fieldValue => allFields.find(f => f.value === fieldValue))
      .filter(field => field && field.type === 'value');
  }, [selectedFields, allFields]);
  
  // Handle field checkbox toggle
  const handleFieldToggle = (fieldValue) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldValue)) {
        newSet.delete(fieldValue);
        // Remove aggregation setting when field is deselected
        setFieldAggregations(prevAggs => {
          const newAggs = { ...prevAggs };
          delete newAggs[fieldValue];
          return newAggs;
        });
        // Remove date grouping setting when date field is deselected
        if (fieldValue === 'date') {
          setDateGroupings(prev => {
            const newGroupings = { ...prev };
            delete newGroupings[fieldValue];
            return newGroupings;
          });
        }
      } else {
        newSet.add(fieldValue);
        // Set default aggregation for value fields
        const field = allFields.find(f => f.value === fieldValue);
        if (field && field.type === 'value') {
          setFieldAggregations(prevAggs => ({
            ...prevAggs,
            [fieldValue]: field.aggregation || 'sum'
          }));
        }
        // Set default date grouping for date fields
        if (fieldValue === 'date') {
          setDateGroupings(prev => ({
            ...prev,
            [fieldValue]: 'month' // Default to monthly
          }));
        }
      }
      return newSet;
    });
  };
  
  // Handle settings icon click for value fields
  const handleSettingsClick = (field, e) => {
    e.stopPropagation();
    setFieldBeingConfigured(field);
    setIsDateSettingsModal(false);
    setSettingsModalOpen(true);
  };
  
  // Handle settings icon click for date fields
  const handleDateSettingsClick = (field, e) => {
    e.stopPropagation();
    setFieldBeingConfigured(field);
    setIsDateSettingsModal(true);
    setSettingsModalOpen(true);
  };
  
  // Handle aggregation change in settings modal
  const handleAggregationChange = (fieldValue, aggregation) => {
    setFieldAggregations(prev => ({
      ...prev,
      [fieldValue]: aggregation
    }));
  };
  
  // Handle date grouping change in settings modal
  const handleDateGroupingChange = (fieldValue, grouping) => {
    setDateGroupings(prev => ({
      ...prev,
      [fieldValue]: grouping
    }));
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }
    
    if (axisFields.length === 0) {
      alert('Please select at least one field for Axis (Categories)');
      return;
    }
    
    if (valueFields.length === 0) {
      alert('Please select at least one field for Values');
      return;
    }
    
    // Use the first selected field for each bucket
    const groupByField = axisFields[0];
    const valueField = valueFields[0];
    
    // Get aggregation from fieldAggregations state
    const aggregation = fieldAggregations[valueField.value] || valueField.aggregation || 'sum';
    let dateGrouping = 'month';
    
    // Map valueField to internal field names
    const mappedValueField = valueField.value;
    
    // Set date grouping based on groupBy and dateGroupings state
    const groupByValue = groupByField.value;
    if (groupByValue === 'date') {
      // Use configured date grouping from state, or default to month
      dateGrouping = dateGroupings[groupByValue] || 'month';
    }

    // Normalize date field value to 'date' for groupBy
    const normalizedGroupBy = (groupByValue === 'date' || groupByValue.startsWith('date_')) ? 'date' : groupByValue;
    
    const cardConfig = {
      title: cardTitle.trim(),
      groupBy: normalizedGroupBy,
      dateGrouping: (normalizedGroupBy === 'date') ? dateGrouping : undefined,
      aggregation,
      valueField: mappedValueField,
      chartType: editingCard?.chartType || 'bar', // Keep existing chart type or default to bar
      topN: topN ? parseInt(topN, 10) : undefined
    };

    onCreate(cardConfig);
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fafbfc'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: '600', 
          color: '#1e293b',
          letterSpacing: '-0.01em'
        }}>
          {editingCard ? 'Edit Custom Card' : 'Create Custom Card'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8',
            borderRadius: '6px',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            width: '28px',
            height: '28px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#64748b';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e2e8f0',
        background: '#fafbfc',
        padding: '0 24px'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'manual' ? '#7c3aed' : '#64748b',
            fontWeight: activeTab === 'manual' ? '600' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'manual' ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'manual') {
              e.currentTarget.style.color = '#475569';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'manual') {
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            color: activeTab === 'ai' ? '#7c3aed' : '#64748b',
            fontWeight: activeTab === 'ai' ? '600' : '500',
            fontSize: '14px',
            cursor: 'pointer',
            borderBottom: activeTab === 'ai' ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom: '-2px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'ai') {
              e.currentTarget.style.color = '#475569';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'ai') {
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          <span className="material-icons" style={{ fontSize: '16px' }}>auto_awesome</span>
          Generate with AI
        </button>
      </div>

      {/* AI Mode Content */}
      {activeTab === 'ai' && (
        <div style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          flex: 1
        }}>
          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            padding: '14px 16px',
            display: 'flex',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '20px', 
              color: '#3b82f6',
              marginTop: '1px'
            }}>
              info
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#1e40af',
              fontWeight: '500'
            }}>
              Describe the card you want to create. For example: "Top 10 customers by revenue", "Monthly sales trend", "Profit by region", etc.
            </p>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '6px',
              letterSpacing: '0.01em'
            }}>
              Describe your card <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Show me top 10 customers by revenue, or Create a monthly sales trend chart..."
              rows={4}
              style={{
                width: '100%',
                padding: '11px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.15s ease',
                background: '#ffffff',
                color: '#1e293b',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {aiError && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              gap: '10px'
            }}>
              <span className="material-icons" style={{ 
                fontSize: '20px', 
                color: '#ef4444',
                marginTop: '1px'
              }}>
                error
              </span>
              <p style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#991b1b',
                fontWeight: '500'
              }}>
                {aiError}
              </p>
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end',
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                minWidth: '80px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f8fafc';
                e.target.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#ffffff';
                e.target.style.borderColor = '#e2e8f0';
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '8px',
                background: (aiLoading || !aiPrompt.trim()) ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: (aiLoading || !aiPrompt.trim()) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: (aiLoading || !aiPrompt.trim()) ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                minWidth: '110px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!aiLoading && aiPrompt.trim()) {
                  e.target.style.background = 'linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%)';
                  e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (!aiLoading && aiPrompt.trim()) {
                  e.target.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)';
                  e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }
              }}
            >
              {aiLoading ? (
                <>
                  <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
                  Generating...
                </>
              ) : (
                <>
                  <span className="material-icons" style={{ fontSize: '16px' }}>auto_awesome</span>
                  Generate
                </>
              )}
            </button>
          </div>

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Manual Mode Content */}
      {activeTab === 'manual' && (
      <form onSubmit={handleSubmit} style={{ 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        flex: 1
      }}>
        {/* Card Title */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Card Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={cardTitle}
            onChange={(e) => setCardTitle(e.target.value)}
            placeholder="Enter card title..."
            required
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.15s ease',
              background: '#ffffff',
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Choose fields to add to report */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '8px',
            letterSpacing: '0.01em'
          }}>
            Choose fields to add to report:
          </label>
          {/* Search */}
          <div style={{ marginBottom: '12px', position: 'relative' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search"
              style={{
                width: '100%',
                padding: '10px 40px 10px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.15s ease',
                background: '#ffffff',
                color: '#1e293b',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
              }}
            />
            <span className="material-icons" style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}>search</span>
          </div>
          
          {/* Fields list with checkboxes */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {filteredFields.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                No fields found
              </div>
            ) : (
              filteredFields.map((field) => (
                <div
                  key={field.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => handleFieldToggle(field.value)}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: selectedFields.has(field.value) ? 'none' : '2px solid #cbd5e1',
                    borderRadius: '4px',
                    background: selectedFields.has(field.value) ? '#10b981' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    flexShrink: 0
                  }}>
                    {selectedFields.has(field.value) && (
                      <span className="material-icons" style={{ fontSize: '14px', color: 'white' }}>check</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: selectedFields.has(field.value) ? '600' : '400',
                    color: '#1e293b'
                  }}>
                    {field.label}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Field buckets */}
        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e2e8f0'
          }}>
            Selected fields will appear in the buckets below:
          </div>
          
          {/* Buckets Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '12px'
          }}>
            {/* Axis (Categories) */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569'
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>view_list</span>
                Axis (Categories)
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '8px',
                minHeight: '80px'
              }}>
                {axisFields.length > 0 && axisFields.map((field) => {
                  const isDateField = field.value === 'date';
                  const dateGrouping = isDateField ? (dateGroupings[field.value] || 'month') : null;
                  const groupingLabels = {
                    day: 'Daily',
                    week: 'Weekly',
                    month: 'Monthly',
                    year: 'Yearly'
                  };
                  
                  return (
                    <div
                      key={field.value}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#e0e7ff',
                        color: '#1e40af',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        margin: '4px',
                        gap: '6px'
                      }}
                    >
                      <span>
                        {field.label}
                        {isDateField && dateGrouping && ` (${groupingLabels[dateGrouping]})`}
                      </span>
                      {isDateField && (
                        <span 
                          className="material-icons" 
                          style={{ 
                            fontSize: '14px', 
                            cursor: 'pointer',
                            padding: '2px',
                            borderRadius: '2px',
                            transition: 'background 0.2s'
                          }}
                          onClick={(e) => handleDateSettingsClick(field, e)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#c7d2fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                          title="Configure date grouping"
                        >
                          settings
                        </span>
                      )}
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: '16px', 
                          marginLeft: '2px',
                          cursor: 'pointer',
                          padding: '2px',
                          borderRadius: '2px',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => handleFieldToggle(field.value)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#c7d2fe';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Remove field"
                      >
                        close
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Values */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              minHeight: '120px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569'
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>functions</span>
                Values
              </div>
              <div style={{
                background: '#ffffff',
                border: '1px dashed #cbd5e1',
                borderRadius: '6px',
                padding: '8px',
                minHeight: '80px'
              }}>
                {valueFields.length > 0 && valueFields.map((field) => {
                  const aggregation = fieldAggregations[field.value] || field.aggregation || 'sum';
                  const aggregationLabels = {
                    sum: 'Sum',
                    average: 'Average',
                    count: 'Count',
                    min: 'Min',
                    max: 'Max'
                  };
                  return (
                    <div
                      key={field.value}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#e0e7ff',
                        color: '#1e40af',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        margin: '4px',
                        gap: '6px'
                      }}
                    >
                      <span>{field.label} ({aggregationLabels[aggregation]})</span>
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: '14px', 
                          cursor: 'pointer',
                          padding: '2px',
                          borderRadius: '2px',
                          transition: 'background 0.2s'
                        }}
                        onClick={(e) => handleSettingsClick(field, e)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#c7d2fe';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Configure aggregation"
                      >
                        settings
                      </span>
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: '16px', 
                          marginLeft: '2px',
                          cursor: 'pointer',
                          padding: '2px',
                          borderRadius: '2px',
                          transition: 'background 0.2s'
                        }}
                        onClick={() => handleFieldToggle(field.value)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#c7d2fe';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Remove field"
                      >
                        close
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Top N */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Top N <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '400' }}>(Optional)</span>
          </label>
          <input
            type="number"
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
            placeholder="e.g., 10 (leave empty for all)"
            min="0"
            style={{
              width: '100%',
              padding: '11px 14px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.15s ease',
              background: '#ffffff',
              color: '#1e293b',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
          marginTop: '8px',
          paddingTop: '20px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minWidth: '80px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f8fafc';
              e.target.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#ffffff';
              e.target.style.borderColor = '#e2e8f0';
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              minWidth: '110px'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
              e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }}
          >
            {editingCard ? 'Update Card' : 'Create Card'}
          </button>
        </div>
      </form>
      )}
      
      {/* Settings Modal (Value Field or Date Field) */}
      {settingsModalOpen && fieldBeingConfigured && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
          onClick={() => setSettingsModalOpen(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e293b'
              }}>
                {isDateSettingsModal ? 'Date Field Settings' : 'Value Field Settings'}
              </h3>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  borderRadius: '6px',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '8px'
              }}>
                Field: <span style={{ fontWeight: '600' }}>{fieldBeingConfigured.label}</span>
              </div>
              <div style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '12px'
              }}>
                {isDateSettingsModal ? 'Choose date grouping:' : 'Choose aggregation type:'}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isDateSettingsModal ? (
                  // Date grouping options
                  ['day', 'week', 'month', 'year'].map((groupingType) => {
                    const currentGrouping = dateGroupings[fieldBeingConfigured.value] || 'month';
                    const isSelected = currentGrouping === groupingType;
                    const labels = {
                      day: 'Daily',
                      week: 'Weekly',
                      month: 'Monthly',
                      year: 'Yearly'
                    };
                    
                    return (
                      <div
                        key={groupingType}
                        onClick={() => {
                          handleDateGroupingChange(fieldBeingConfigured.value, groupingType);
                          setSettingsModalOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = '#ffffff';
                          }
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                          borderRadius: '50%',
                          background: isSelected ? '#3b82f6' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '12px',
                          flexShrink: 0
                        }}>
                          {isSelected && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'white'
                            }} />
                          )}
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: isSelected ? '600' : '400',
                          color: '#1e293b'
                        }}>
                          {labels[groupingType]}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  // Aggregation options
                  ['sum', 'average', 'count', 'min', 'max'].map((aggType) => {
                    const currentAgg = fieldAggregations[fieldBeingConfigured.value] || fieldBeingConfigured.aggregation || 'sum';
                    const isSelected = currentAgg === aggType;
                    const labels = {
                      sum: 'Sum',
                      average: 'Average',
                      count: 'Count',
                      min: 'Min',
                      max: 'Max'
                    };
                    
                    return (
                      <div
                        key={aggType}
                        onClick={() => {
                          handleAggregationChange(fieldBeingConfigured.value, aggType);
                          setSettingsModalOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.background = '#f8fafc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.background = '#ffffff';
                          }
                        }}
                      >
                        <div style={{
                          width: '18px',
                          height: '18px',
                          border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                          borderRadius: '50%',
                          background: isSelected ? '#3b82f6' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '12px',
                          flexShrink: 0
                        }}>
                          {isSelected && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'white'
                            }} />
                          )}
                        </div>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: isSelected ? '600' : '400',
                          color: '#1e293b'
                        }}>
                          {labels[aggType]}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Custom Card Component
const CustomCard = React.memo(({ 
  card, 
  salesData, 
  generateCustomCardData, 
  chartType, 
  onChartTypeChange, 
  onDelete,
  onEdit,
  openTransactionRawData,
  setSelectedCustomer,
  setSelectedItem,
  setSelectedStockGroup,
  setSelectedRegion,
  setSelectedCountry,
  setSelectedPeriod,
  setSelectedLedgerGroup,
  selectedCustomer,
  selectedItem,
  selectedStockGroup,
  selectedRegion,
  selectedCountry,
  selectedPeriod,
  selectedLedgerGroup,
  genericFilters,
  setGenericFilters,
  renderCardFilterBadges,
  customCards,
  isMobile,
  formatPeriodLabel
}) => {
  const cardData = useMemo(() => generateCustomCardData(card, salesData), [card, salesData, generateCustomCardData]);

  // Map groupBy field to filter setter and current filter value
  // Memoize filterHandler to recalculate when card.groupBy or filter states change
  const filterHandler = useMemo(() => {
    const groupBy = card.groupBy;
    const groupByLower = groupBy ? groupBy.toLowerCase() : '';
    
    console.log('🔄 Recalculating filterHandler for custom card:', {
      cardId: card.id,
      cardTitle: card.title,
      groupBy: card.groupBy,
      groupByLower,
      dateGrouping: card.dateGrouping
    });
    
    // Map groupBy to the appropriate filter setter and current value (case-insensitive)
    if (groupByLower === 'customer') {
      return {
        onClick: setSelectedCustomer,
        onBackClick: () => setSelectedCustomer('all'),
        showBackButton: selectedCustomer !== 'all',
        currentValue: selectedCustomer
      };
    } else if (groupByLower === 'item') {
      return {
        onClick: setSelectedItem,
        onBackClick: () => setSelectedItem('all'),
        showBackButton: selectedItem !== 'all',
        currentValue: selectedItem
      };
    } else if (groupByLower === 'category' || groupByLower === 'stockgroup' || groupByLower === 'stock_group') {
      return {
        onClick: setSelectedStockGroup,
        onBackClick: () => setSelectedStockGroup('all'),
        showBackButton: selectedStockGroup !== 'all',
        currentValue: selectedStockGroup
      };
    } else if (groupByLower === 'region') {
      return {
        onClick: setSelectedRegion,
        onBackClick: () => setSelectedRegion('all'),
        showBackButton: selectedRegion !== 'all',
        currentValue: selectedRegion
      };
    } else if (groupByLower === 'country') {
      return {
        onClick: setSelectedCountry,
        onBackClick: () => setSelectedCountry('all'),
        showBackButton: selectedCountry !== 'all',
        currentValue: selectedCountry
      };
    } else if (groupBy === 'date') {
      // Handle all date groupings (day, week, month, year)
      // For month grouping, use setSelectedPeriod (format: "YYYY-MM")
      // For other groupings, we'll need to convert the label to the appropriate format
      if (card.dateGrouping === 'month') {
        return {
          onClick: (label) => {
            // Label format: "YYYY-MM" (e.g., "2024-01")
            setSelectedPeriod(label);
          },
          onBackClick: () => setSelectedPeriod(null),
          showBackButton: selectedPeriod !== null,
          currentValue: selectedPeriod
        };
      } else if (card.dateGrouping === 'day') {
        // For day grouping, convert label (YYYY-MM-DD) to month format (YYYY-MM) for setSelectedPeriod
        return {
          onClick: (label) => {
            // Label format: "YYYY-MM-DD", convert to "YYYY-MM" for period filtering
            const monthLabel = label.substring(0, 7); // Extract "YYYY-MM" from "YYYY-MM-DD"
            setSelectedPeriod(monthLabel);
          },
          onBackClick: () => setSelectedPeriod(null),
          showBackButton: selectedPeriod !== null,
          currentValue: selectedPeriod
        };
      } else if (card.dateGrouping === 'week') {
        // For week grouping, extract year-month from week label
        return {
          onClick: (label) => {
            // Label format: "YYYY-WN", extract year and approximate month
            const yearMatch = label.match(/^(\d{4})/);
            if (yearMatch) {
              const year = yearMatch[1];
              // Use first month of the year as approximation (could be improved)
              setSelectedPeriod(`${year}-01`);
            }
          },
          onBackClick: () => setSelectedPeriod(null),
          showBackButton: selectedPeriod !== null,
          currentValue: selectedPeriod
        };
      } else if (card.dateGrouping === 'year') {
        // For year grouping, convert to month format
        return {
          onClick: (label) => {
            // Label format: "YYYY", convert to "YYYY-01" for period filtering
            setSelectedPeriod(`${label}-01`);
          },
          onBackClick: () => setSelectedPeriod(null),
          showBackButton: selectedPeriod !== null,
          currentValue: selectedPeriod
        };
      }
    } else if (groupByLower === 'ledgergroup' || groupByLower === 'ledger_group') {
      return {
        onClick: setSelectedLedgerGroup,
        onBackClick: () => setSelectedLedgerGroup('all'),
        showBackButton: selectedLedgerGroup !== 'all',
        currentValue: selectedLedgerGroup
      };
    }
    
    // For other groupBy fields, create a generic filter handler
    // This ensures cross-filtering always works, even for unmapped fields
    console.log('🔵 Creating generic filter handler for field:', groupBy);
    
    // Create a unique key for this card's filter
    const filterKey = `${card.id}_${groupBy}`;
    const currentFilter = genericFilters?.[filterKey] || null;
    
    return {
      onClick: (label) => {
        console.log('🔵 Generic filter click:', { field: groupBy, label, cardId: card.id, filterKey });
        if (setGenericFilters) {
          setGenericFilters(prev => {
            const updated = { ...prev };
            updated[filterKey] = label;
            // Persist to sessionStorage
            try {
              sessionStorage.setItem('customCardGenericFilters', JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to persist generic filters:', e);
            }
            return updated;
          });
        }
      },
      onBackClick: () => {
        console.log('🔵 Generic filter back click:', { field: groupBy, cardId: card.id, filterKey });
        if (setGenericFilters) {
          setGenericFilters(prev => {
            const updated = { ...prev };
            delete updated[filterKey];
            // Persist to sessionStorage
            try {
              sessionStorage.setItem('customCardGenericFilters', JSON.stringify(updated));
            } catch (e) {
              console.warn('Failed to persist generic filters:', e);
            }
            return updated;
          });
        }
      },
      showBackButton: currentFilter !== null && currentFilter !== 'all' && currentFilter !== '',
      currentValue: currentFilter
    };
  }, [
    card.id, // Include card.id to ensure recalculation when card is edited
    card.groupBy,
    card.dateGrouping,
    // Setter functions are stable, but we include them for clarity
    setSelectedCustomer,
    setSelectedItem,
    setSelectedStockGroup,
    setSelectedRegion,
    setSelectedCountry,
    setSelectedPeriod,
    setSelectedLedgerGroup,
    setGenericFilters,
    // Current filter values affect showBackButton and currentValue
    selectedCustomer,
    selectedItem,
    selectedStockGroup,
    selectedRegion,
    selectedCountry,
    selectedPeriod,
    selectedLedgerGroup,
    genericFilters // Include genericFilters to recalculate when they change
  ]);

  // Helper function for case-insensitive field access (local to CustomCard)
  const getFieldValueLocal = (item, fieldName) => {
    if (!item || !fieldName) return null;
    if (item[fieldName] !== undefined) return item[fieldName];
    if (item[fieldName.toLowerCase()] !== undefined) return item[fieldName.toLowerCase()];
    if (item[fieldName.toUpperCase()] !== undefined) return item[fieldName.toUpperCase()];
    const matchingKey = Object.keys(item).find(k => k.toLowerCase() === fieldName.toLowerCase());
    return matchingKey ? item[matchingKey] : null;
  };

  const getFilterFn = (itemLabel) => {
    return (sale) => {
      if (card.groupBy === 'date') {
        const saleDate = getFieldValueLocal(sale, 'cp_date') || getFieldValueLocal(sale, 'date');
        if (!saleDate) return false;
        const date = new Date(saleDate);
        if (isNaN(date.getTime())) return false;
        let groupKey = '';
        if (card.dateGrouping === 'day') {
          groupKey = saleDate;
        } else if (card.dateGrouping === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
        } else if (card.dateGrouping === 'month') {
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else if (card.dateGrouping === 'year') {
          groupKey = String(date.getFullYear());
        } else {
          groupKey = saleDate;
        }
        return groupKey === itemLabel;
      } else if (card.groupBy === 'profit_margin') {
        const amount = parseFloat(getFieldValueLocal(sale, 'amount') || 0);
        const profit = parseFloat(getFieldValueLocal(sale, 'profit') || 0);
        const margin = amount > 0 ? ((profit / amount) * 100).toFixed(0) : '0';
        return `${margin}%` === itemLabel;
      } else if (card.groupBy === 'order_value') {
        const value = parseFloat(getFieldValueLocal(sale, 'amount') || 0);
        let range = '';
        if (value < 1000) range = '< ₹1K';
        else if (value < 5000) range = '₹1K - ₹5K';
        else if (value < 10000) range = '₹5K - ₹10K';
        else if (value < 50000) range = '₹10K - ₹50K';
        else range = '> ₹50K';
        return range === itemLabel;
      } else {
        // Case-insensitive matching for string fields
        const fieldValue = getFieldValueLocal(sale, card.groupBy);
        if (!fieldValue || !itemLabel) return false;
        return String(fieldValue).trim().toLowerCase() === String(itemLabel).trim().toLowerCase();
      }
    };
  };

  const valuePrefix = card.valueField === 'amount' || card.valueField === 'profit' || card.valueField === 'tax_amount' || card.valueField === 'order_value' || card.valueField === 'avg_order_value' || card.valueField === 'avg_amount' || card.valueField === 'avg_profit' || card.valueField === 'profit_per_quantity' ? '₹' : '';

  // Raw data button style (matching other cards)
  const rawDataIconButtonStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#1e40af',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s ease, color 0.2s ease'
  };

  const handleRawDataButtonMouseEnter = (event) => {
    event.currentTarget.style.background = '#e0e7ff';
    event.currentTarget.style.color = '#1e3a8a';
  };

  const handleRawDataButtonMouseLeave = (event) => {
    event.currentTarget.style.background = 'transparent';
    event.currentTarget.style.color = '#1e40af';
  };

  // Custom header matching other cards layout
  const customHeader = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => openTransactionRawData(`Raw Data - ${card.title}`, () => true)}
          style={rawDataIconButtonStyle}
          onMouseEnter={handleRawDataButtonMouseEnter}
          onMouseLeave={handleRawDataButtonMouseLeave}
          title="View raw data"
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
        </button>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
          {card.title} (Custom Card)
        </h3>
        {renderCardFilterBadges('custom', card.id)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <select
          value={chartType}
          onChange={(e) => onChartTypeChange(e.target.value)}
          style={{
            padding: '6px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '12px',
            background: 'white',
            color: '#374151'
          }}
        >
          <option value="bar">Bar</option>
          <option value="pie">Pie</option>
          <option value="treemap">Tree Map</option>
          <option value="line">Line</option>
        </select>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(card.id)}
            style={{
              background: '#dbeafe',
              border: 'none',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#1e40af',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#dbeafe';
            }}
            title="Edit custom card"
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>edit</span>
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          style={{
            background: '#fee2e2',
            border: 'none',
            borderRadius: '6px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#dc2626',
            transition: 'all 0.2s',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fecaca';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fee2e2';
          }}
          title="Delete custom card"
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      maxHeight: '500px',
      minHeight: '500px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {cardData.length > 0 ? (
        <>
          {chartType === 'bar' && (
            <BarChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              onBarClick={(label) => {
                console.log('🔵 Custom card bar click:', { cardTitle: card.title, label, groupBy: card.groupBy, hasHandler: !!filterHandler });
                filterHandler?.onClick?.(label);
              }}
              onBackClick={() => {
                console.log('🔵 Custom card back click:', { cardTitle: card.title, groupBy: card.groupBy });
                filterHandler?.onBackClick?.();
              }}
              showBackButton={filterHandler?.showBackButton || false}
              rowAction={{
                icon: 'table_view',
                title: 'View raw data',
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getFilterFn(item.label))
              }}
            />
          )}
          {chartType === 'pie' && (
            <PieChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              onSliceClick={(label) => {
                console.log('🔵 Custom card pie click:', { cardTitle: card.title, label, groupBy: card.groupBy, hasHandler: !!filterHandler });
                filterHandler?.onClick?.(label);
              }}
              onBackClick={() => {
                console.log('🔵 Custom card back click:', { cardTitle: card.title, groupBy: card.groupBy });
                filterHandler?.onBackClick?.();
              }}
              showBackButton={filterHandler?.showBackButton || false}
              rowAction={{
                icon: 'table_view',
                title: 'View raw data',
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getFilterFn(item.label))
              }}
            />
          )}
          {chartType === 'treemap' && (
            <TreeMap
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              onBoxClick={(label) => {
                console.log('🔵 Custom card treemap click:', { cardTitle: card.title, label, groupBy: card.groupBy, hasHandler: !!filterHandler });
                filterHandler?.onClick?.(label);
              }}
              onBackClick={() => {
                console.log('🔵 Custom card back click:', { cardTitle: card.title, groupBy: card.groupBy });
                filterHandler?.onBackClick?.();
              }}
              showBackButton={filterHandler?.showBackButton || false}
              rowAction={{
                icon: 'table_view',
                title: 'View raw data',
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getFilterFn(item.label))
              }}
            />
          )}
          {chartType === 'line' && (
            <LineChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              onPointClick={(label) => {
                console.log('🔵 Custom card line click:', { cardTitle: card.title, label, groupBy: card.groupBy, hasHandler: !!filterHandler });
                filterHandler?.onClick?.(label);
              }}
              onBackClick={() => {
                console.log('🔵 Custom card back click:', { cardTitle: card.title, groupBy: card.groupBy });
                filterHandler?.onBackClick?.();
              }}
              showBackButton={filterHandler?.showBackButton || false}
              rowAction={{
                icon: 'table_view',
                title: 'View raw data',
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getFilterFn(item.label))
              }}
            />
          )}
        </>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          padding: '40px',
          textAlign: 'center',
          color: '#64748b',
          height: '500px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          No data available for this card configuration.
        </div>
      )}
    </div>
  );
});

export default SalesDashboard;