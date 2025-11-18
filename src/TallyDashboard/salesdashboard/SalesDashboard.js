import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { apiPost } from '../../utils/apiUtils';
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

const SalesDashboard = () => {
  const RAW_DATA_PAGE_SIZE = 20;

  const getInitialCachedState = () => {
    try {
      const connections = JSON.parse(sessionStorage.getItem('allConnections') || '[]');
      const selectedGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (!selectedGuid || !Array.isArray(connections)) return null;
      const company = connections.find(c => c.guid === selectedGuid);
      if (!company || !company.tallyloc_id || !company.guid) return null;
      const cacheKey = `sales-dashboard_${company.tallyloc_id}_${company.guid}`;
      const cached = sessionStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.warn('⚠️ Unable to read cached sales dashboard state:', err);
      return null;
    }
  };

  const initialCachedState = getInitialCachedState();

  // API data state
  const [sales, setSales] = useState(() => initialCachedState?.sales || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noCompanySelected, setNoCompanySelected] = useState(false);
  
  // Progress bar state
  const [progress, setProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loadingStartTime, setLoadingStartTime] = useState(null);

  // Form state
  const [fromDate, setFromDate] = useState(() => initialCachedState?.fromDate || '');
  const [toDate, setToDate] = useState(() => initialCachedState?.toDate || '');
  const [dateRange, setDateRange] = useState(() => ({ start: initialCachedState?.fromDate || '', end: initialCachedState?.toDate || '' }));
  const [selectedCustomer, setSelectedCustomer] = useState(() => initialCachedState?.filters?.customer ?? 'all');
  const [selectedItem, setSelectedItem] = useState(() => initialCachedState?.filters?.item ?? 'all');
  const [selectedStockGroup, setSelectedStockGroup] = useState(() => initialCachedState?.filters?.stockGroup ?? 'all');
  const [selectedRegion, setSelectedRegion] = useState(() => initialCachedState?.filters?.region ?? 'all');
  const [selectedCountry, setSelectedCountry] = useState(() => initialCachedState?.filters?.country ?? 'all');
  const [selectedPeriod, setSelectedPeriod] = useState(() => initialCachedState?.filters?.period ?? null); // Format: "YYYY-MM"
  const [categoryChartType, setCategoryChartType] = useState('bar');
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
  const requestTimestampRef = useRef(Date.now());

  // Cache for API responses
  const [apiCache, setApiCache] = useState(new Map());
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
  const [customCardChartTypes, setCustomCardChartTypes] = useState({});
  const customCardsSectionRef = useRef(null);

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

  const getDashboardCacheKey = (companyInfo) => {
    if (!companyInfo || !companyInfo.tallyloc_id || !companyInfo.guid) return null;
    return `sales-dashboard_${companyInfo.tallyloc_id}_${companyInfo.guid}`;
  };

  const applyCachedDashboardState = useCallback((cached) => {
    if (!cached) return;
    const from = cached.fromDate;
    const to = cached.toDate;
    if (from) {
      setFromDate(from);
    }
    if (to) {
      setToDate(to);
    }
    if (from && to) {
      setDateRange({ start: from, end: to });
    }
    if (Array.isArray(cached.sales)) {
      setSales(cached.sales);
    }

    const filters = cached.filters || {};
    setSelectedCustomer(filters.customer ?? 'all');
    setSelectedItem(filters.item ?? 'all');
    setSelectedStockGroup(filters.stockGroup ?? 'all');
    setSelectedRegion(filters.region ?? 'all');
    setSelectedCountry(filters.country ?? 'all');
    setSelectedPeriod(filters.period ?? null);
  }, [setFromDate, setToDate, setDateRange, setSales, setSelectedCustomer, setSelectedItem, setSelectedStockGroup, setSelectedRegion, setSelectedCountry, setSelectedPeriod]);

  const persistDashboardCache = (companyInfo, payload) => {
    const cacheKey = getDashboardCacheKey(companyInfo);
    if (!cacheKey) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('⚠️ Failed to persist sales dashboard cache:', err);
    }
  };

  const getDefaultDateRange = useCallback(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    return {
      start: formatDate(startOfMonth),
      end: formatDate(now)
    };
  }, []);

  const initializeDashboard = useCallback((options = { triggerFetch: true }) => {
    try {
      const companyInfo = getCompanyInfo();
      setNoCompanySelected(false);
      setError(null);

      const cacheKey = getDashboardCacheKey(companyInfo);
      if (cacheKey) {
        const cachedState = sessionStorage.getItem(cacheKey);
        if (cachedState) {
          try {
            const parsed = JSON.parse(cachedState);
            applyCachedDashboardState(parsed);
            setShouldAutoLoad(false);
            return;
          } catch (err) {
            console.warn('⚠️ Failed to parse cached sales dashboard state:', err);
          }
        }
      }

      const defaults = getDefaultDateRange();
      setFromDate(defaults.start);
      setToDate(defaults.end);
      setDateRange(defaults);
      setSales([]);
      setSelectedCustomer('all');
      setSelectedItem('all');
      setSelectedStockGroup('all');
      setSelectedRegion('all');
      setSelectedCountry('all');
      setSelectedPeriod(null);
      if (options.triggerFetch) {
        setShouldAutoLoad(true);
      }
    } catch (err) {
      console.warn('⚠️ Sales dashboard initialization error:', err);
      setNoCompanySelected(true);
      setError('Please select a company from the top navigation before loading sales data.');
    }
  }, [applyCachedDashboardState, getDefaultDateRange]);

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

  const fetchSalesDataWithProgress = async (startDate, endDate, currentIndex, totalChunks) => {
    console.log(`🔄 Fetching data chunk ${currentIndex}/${totalChunks}: ${startDate} to ${endDate}`);
    
    // Update progress before starting the API call
    setProgress(prev => {
      const newCurrent = currentIndex;
      const newPercentage = Math.round((newCurrent / totalChunks) * 100);
      return { current: newCurrent, total: totalChunks, percentage: newPercentage };
    });
    
    const result = await fetchSalesData(startDate, endDate);
    console.log(`✅ Completed chunk ${currentIndex}/${totalChunks}`);
    return result;
  };

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
    const cacheKey = `${companyInfo.tallyloc_id}_${companyInfo.guid}_${requestTimestampRef.current}_${startDate}_${endDate}`;
    
    // Check cache first
    if (apiCache.has(cacheKey)) {
      const cachedData = apiCache.get(cacheKey);
      const cacheDate = new Date(cachedData.timestamp);
      const now = new Date();
      const daysDiff = (now - cacheDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 5) {
        console.log(`📋 Using cached data for ${startDate} to ${endDate}`);
        return cachedData.data;
      } else {
        console.log(`⏰ Cache expired for ${startDate} to ${endDate}, fetching fresh data`);
      }
    } else {
      console.log(`🆕 No cache found for ${startDate} to ${endDate}, fetching fresh data`);
    }

    try {
      const payload = {
        tallyloc_id: companyInfo.tallyloc_id,
        company: companyInfo.company,
        guid: companyInfo.guid,
        fromdate: formatDateForAPI(startDate),
        todate: formatDateForAPI(endDate)
      };

      console.log('🚀 Making API call with payload:', payload);
      const data = await apiPost(`/api/reports/salesvoucherextract?ts=${Date.now()}`, payload);
      console.log('✅ API response:', data);
      
      // Cache the response
      setApiCache(prev => new Map(prev).set(cacheKey, {
        data: data,
        timestamp: new Date().toISOString()
      }));

      return data;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      throw error;
    }
  };

  // Set default date range on component mount
  useEffect(() => {
    initializeDashboard({ triggerFetch: true });

    const handleCompanyChange = () => {
      initializeDashboard({ triggerFetch: true });
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, [initializeDashboard]);

  // Filter sales data based on selected filters (excluding issales filter)
  const filteredSales = useMemo(() => {
    console.log('🔍 Filtering sales data...', {
      totalSales: sales.length,
      dateRange,
      selectedCustomer,
      selectedItem,
      selectedPeriod
    });
    
    const filtered = sales.filter((sale) => {
      const dateMatch =
        (!dateRange.start || sale.date >= dateRange.start) &&
        (!dateRange.end || sale.date <= dateRange.end);
      const customerMatch = selectedCustomer === 'all' || sale.customer === selectedCustomer;
      const itemMatch = selectedItem === 'all' || sale.item === selectedItem;
      const stockGroupMatch = selectedStockGroup === 'all' || sale.category === selectedStockGroup;
      const regionMatch = selectedRegion === 'all' || sale.region === selectedRegion;
      const countryMatch = selectedCountry === 'all' || sale.country === selectedCountry;
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && regionMatch && countryMatch && periodMatch;
    });
    
    console.log('✅ Filtered sales result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedRegion, selectedCountry, selectedPeriod]);

  // Filter sales data specifically for Total Orders (with issales filter)
  const filteredSalesForOrders = useMemo(() => {
    console.log('🔍 Filtering sales data for orders...', {
      totalSales: sales.length,
      dateRange,
      selectedCustomer,
      selectedItem,
      selectedPeriod
    });
    
    const filtered = sales.filter((sale) => {
      const dateMatch =
        (!dateRange.start || sale.date >= dateRange.start) &&
        (!dateRange.end || sale.date <= dateRange.end);
      const customerMatch = selectedCustomer === 'all' || sale.customer === selectedCustomer;
      const itemMatch = selectedItem === 'all' || sale.item === selectedItem;
      const stockGroupMatch = selectedStockGroup === 'all' || sale.category === selectedStockGroup;
      const regionMatch = selectedRegion === 'all' || sale.region === selectedRegion;
      const countryMatch = selectedCountry === 'all' || sale.country === selectedCountry;
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      const isSalesMatch = sale.issales === true || sale.issales === 1 || sale.issales === '1' || sale.issales === 'Yes' || sale.issales === 'yes';
      
      if (!isSalesMatch) {
        console.log('❌ Filtered out for orders - not a sale:', { issales: sale.issales, sale });
      }
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && regionMatch && countryMatch && periodMatch && isSalesMatch;
    });
    
    console.log('✅ Filtered sales for orders result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedRegion, selectedCountry, selectedPeriod]);

  // NOTE: This is the ONLY API call made for sales data
  // It fetches ALL data including country, region, customer, items, etc. in ONE call
  // After this call, all chart data and raw data is derived from the 'sales' state
  // NO additional API calls are made for country data or any other drilldowns
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
    setApiCache(new Map());
    }

    setLoading(true);
    setError(null);
    setLoadingStartTime(Date.now());
    setElapsedTime(0);

    try {
      const dateChunks = splitDateRange(startDate, endDate);
      setProgress({ current: 0, total: dateChunks.length, percentage: 0 });
      
      const responses = [];
      for (let i = 0; i < dateChunks.length; i++) {
        const chunk = dateChunks[i];
        const response = await fetchSalesDataWithProgress(chunk.start, chunk.end, i + 1, dateChunks.length);
        responses.push(response);
        
        if (i < dateChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const allVouchers = [];
      responses.forEach(response => {
        if (response?.vouchers && Array.isArray(response.vouchers)) {
          allVouchers.push(...response.vouchers);
        }
      });
      
      // Debug: Log first voucher to see available fields
      if (allVouchers.length > 0) {
        const sampleVoucher = allVouchers[0];
        console.log('🔍 Sample voucher structure (all keys):', Object.keys(sampleVoucher));
        console.log('🔍 Sample voucher (full object):', sampleVoucher);
        
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
      
      const transformedSales = allVouchers.map(voucher => ({
        category: voucher.sgrpofgrp || voucher.sgroup || 'Other',
        region: voucher.state || 'Unknown',
        country: extractCountry(voucher),
        salesperson: voucher.salesperson || voucher.SalesPerson || voucher.salespersonname || voucher.SalesPersonName || 'Unassigned',
        amount: parseFloat(voucher.amount) || 0,
        quantity: parseInt(voucher.billedqty) || 0,
        customer: voucher.customer || 'Unknown',
        item: voucher.stockitem || 'Unknown',
        date: parseDateFromAPI(voucher.date),
        cp_date: voucher.cp_date ? parseDateFromAPI(voucher.cp_date) : null,
        vchno: voucher.vchno,
        masterid: voucher.masterid,
        issales: voucher.issales,
        profit: parseFloat(voucher.profit) || 0,
        // Store tax information if available in original voucher
        cgst: parseFloat(voucher.cgst || voucher.CGST || 0),
        sgst: parseFloat(voucher.sgst || voucher.SGST || 0),
        roundoff: parseFloat(voucher.roundoff || voucher.ROUNDOFF || voucher.round_off || 0)
      }));

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

      setSales(transformedSales);
      setDateRange({ start: startDate, end: endDate });
      setFromDate(startDate);
      setToDate(endDate);
      // Reset salespersons initialization when new data is loaded
      salespersonsInitializedRef.current = false;

      persistDashboardCache(companyInfo, {
        fromDate: startDate,
        toDate: endDate,
        sales: transformedSales,
        filters: {
          customer: selectedCustomer,
          item: selectedItem,
          stockGroup: selectedStockGroup,
          region: selectedRegion,
          country: selectedCountry,
          period: selectedPeriod
        },
        timestamp: Date.now()
      });
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

  // Category chart data
  const categoryChartData = useMemo(() => {
    const categoryData = filteredSales.reduce((acc, sale) => {
      const category = sale.category;
      acc[category] = (acc[category] || 0) + sale.amount;
      return acc;
    }, {});

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

  // Region chart data
  const regionChartData = useMemo(() => {
    const regionData = filteredSales.reduce((acc, sale) => {
      const region = sale.region;
      acc[region] = (acc[region] || 0) + sale.amount;
      return acc;
    }, {});

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
    const countryData = filteredSales.reduce((acc, sale) => {
      const country = sale.country || 'Unknown';
      // Ensure country is a valid string
      const countryKey = String(country).trim() || 'Unknown';
      acc[countryKey] = (acc[countryKey] || 0) + sale.amount;
      return acc;
    }, {});

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
    const customerData = filteredSales.reduce((acc, sale) => {
      const customer = sale.customer;
      acc[customer] = (acc[customer] || 0) + sale.amount;
      return acc;
    }, {});

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
    const itemData = filteredSales.reduce((acc, sale) => {
      const item = sale.item;
      if (!acc[item]) {
        acc[item] = { revenue: 0, quantity: 0 };
      }
      acc[item].revenue += sale.amount;
      acc[item].quantity += sale.quantity;
      return acc;
    }, {});

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
    const itemData = filteredSales.reduce((acc, sale) => {
      const item = sale.item;
      if (!acc[item]) {
        acc[item] = { revenue: 0, quantity: 0 };
      }
      acc[item].revenue += sale.amount;
      acc[item].quantity += sale.quantity;
      return acc;
    }, {});

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
    const itemData = filteredSales.reduce((acc, sale) => {
      const item = sale.item;
      if (!acc[item]) {
        acc[item] = { profit: 0, revenue: 0 };
      }
      acc[item].profit += sale.profit || 0;
      acc[item].revenue += sale.amount;
      return acc;
    }, {});

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
    const itemData = filteredSales.reduce((acc, sale) => {
      const item = sale.item;
      if (!acc[item]) {
        acc[item] = { profit: 0, revenue: 0 };
      }
      acc[item].profit += sale.profit || 0;
      acc[item].revenue += sale.amount;
      return acc;
    }, {});

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
    selectedRegion !== 'all' ||
    selectedCountry !== 'all' ||
    selectedPeriod !== null;

  const clearAllFilters = () => {
    // Only clear interactive filters - do NOT touch cache or date range
    console.log('🧹 Clearing interactive filters only (preserving cache and date range)...');
    
    setSelectedCustomer('all');
    setSelectedItem('all');
    setSelectedStockGroup('all');
    setSelectedRegion('all');
    setSelectedCountry('all');
    setSelectedPeriod(null);
    
    // Note: Cache and date range are preserved to avoid unnecessary API calls
  };

  const formatCurrency = (value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Custom Cards Helper Functions
  const generateCustomCardData = useCallback((cardConfig, salesData) => {
    if (!salesData || salesData.length === 0) return [];

    // Apply filters from card config
    let filteredData = [...salesData];

    // Apply custom card filters (if specified)
    if (cardConfig.filters) {
      if (cardConfig.filters.customer && cardConfig.filters.customer !== 'all') {
        filteredData = filteredData.filter(s => s.customer === cardConfig.filters.customer);
      }
      if (cardConfig.filters.item && cardConfig.filters.item !== 'all') {
        filteredData = filteredData.filter(s => s.item === cardConfig.filters.item);
      }
      if (cardConfig.filters.stockGroup && cardConfig.filters.stockGroup !== 'all') {
        filteredData = filteredData.filter(s => s.category === cardConfig.filters.stockGroup);
      }
      if (cardConfig.filters.region && cardConfig.filters.region !== 'all') {
        filteredData = filteredData.filter(s => s.region === cardConfig.filters.region);
      }
      if (cardConfig.filters.country && cardConfig.filters.country !== 'all') {
        filteredData = filteredData.filter(s => s.country === cardConfig.filters.country);
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
      } else if (cardConfig.groupBy === 'profit_margin') {
        const margin = sale.amount > 0 ? ((sale.profit / sale.amount) * 100).toFixed(0) : '0';
        groupKey = `${margin}%`;
      } else if (cardConfig.groupBy === 'order_value') {
        // Group by order value ranges
        const value = sale.amount;
        if (value < 1000) groupKey = '< ₹1K';
        else if (value < 5000) groupKey = '₹1K - ₹5K';
        else if (value < 10000) groupKey = '₹5K - ₹10K';
        else if (value < 50000) groupKey = '₹10K - ₹50K';
        else groupKey = '> ₹50K';
      } else {
        groupKey = sale[cardConfig.groupBy] || 'Unknown';
      }

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(sale);
    });

    // Calculate aggregated values
    const result = Object.keys(grouped).map(key => {
      const items = grouped[key];
      let value = 0;

      if (cardConfig.aggregation === 'sum') {
        if (cardConfig.valueField === 'amount') {
          value = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        } else if (cardConfig.valueField === 'quantity') {
          value = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        } else if (cardConfig.valueField === 'profit') {
          value = items.reduce((sum, item) => sum + (item.profit || 0), 0);
        } else if (cardConfig.valueField === 'cgst') {
          value = items.reduce((sum, item) => sum + (item.cgst || 0), 0);
        } else if (cardConfig.valueField === 'sgst') {
          value = items.reduce((sum, item) => sum + (item.sgst || 0), 0);
        } else if (cardConfig.valueField === 'roundoff') {
          value = items.reduce((sum, item) => sum + (item.roundoff || 0), 0);
        } else if (cardConfig.valueField === 'tax_amount') {
          value = items.reduce((sum, item) => sum + ((item.cgst || 0) + (item.sgst || 0)), 0);
        } else if (cardConfig.valueField === 'profit_margin') {
          const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
          const totalProfit = items.reduce((sum, item) => sum + (item.profit || 0), 0);
          value = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
        } else if (cardConfig.valueField === 'order_value') {
          value = items.reduce((sum, item) => sum + (item.amount || 0), 0);
        } else if (cardConfig.valueField === 'avg_order_value') {
          const uniqueOrders = new Set(items.map(item => item.masterid)).size;
          const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
          value = uniqueOrders > 0 ? totalAmount / uniqueOrders : 0;
        } else if (cardConfig.valueField === 'profit_per_quantity') {
          const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          const totalProfit = items.reduce((sum, item) => sum + (item.profit || 0), 0);
          value = totalQuantity > 0 ? totalProfit / totalQuantity : 0;
        }
      } else if (cardConfig.aggregation === 'count') {
        if (cardConfig.valueField === 'transactions') {
          value = items.length;
        } else if (cardConfig.valueField === 'unique_customers') {
          value = new Set(items.map(item => item.customer)).size;
        } else if (cardConfig.valueField === 'unique_items') {
          value = new Set(items.map(item => item.item)).size;
        } else if (cardConfig.valueField === 'unique_orders') {
          value = new Set(items.map(item => item.masterid)).size;
        } else {
          value = items.length;
        }
      } else if (cardConfig.aggregation === 'average') {
        if (cardConfig.valueField === 'amount') {
          const sum = items.reduce((sum, item) => sum + (item.amount || 0), 0);
          value = items.length > 0 ? sum / items.length : 0;
        } else if (cardConfig.valueField === 'quantity') {
          const sum = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          value = items.length > 0 ? sum / items.length : 0;
        } else if (cardConfig.valueField === 'profit') {
          const sum = items.reduce((sum, item) => sum + (item.profit || 0), 0);
          value = items.length > 0 ? sum / items.length : 0;
        }
      }

      return {
        label: key,
        value: value
      };
    });

    // Sort by value descending
    result.sort((a, b) => b.value - a.value);

    // Apply Top N limit if specified
    if (cardConfig.topN && cardConfig.topN > 0) {
      return result.slice(0, cardConfig.topN);
    }

    return result;
  }, []);

  const handleCreateCustomCard = useCallback((cardConfig) => {
    const newCard = {
      id: Date.now().toString(),
      ...cardConfig
    };
    setCustomCards(prev => [...prev, newCard]);
    setShowCustomCardModal(false);
    
    // Scroll to custom cards section after a short delay to ensure DOM is updated
    setTimeout(() => {
      if (customCardsSectionRef.current) {
        customCardsSectionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
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
    { key: 'voucherNo', label: 'Voucher No' },
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
    salesList.map((sale) => ({
      date: sale.cp_date || sale.date,
      voucherNo: sale.vchno || '',
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
    }))
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
  // Keeping for backward compatibility but it's not used anymore
  const fetchBillDrilldown_DEPRECATED = useCallback(async (ledgerName, billName, salesperson) => {
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
  }, []);

  // NOTE: fetchVoucherDetails is no longer needed - we use existing sales data
  // Keeping for backward compatibility but it's not used anymore
  const fetchVoucherDetails_DEPRECATED = useCallback(async (masterId) => {
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
						<LEFTFIELDS>CP_Temp1, CP_Temp2, CP_Temp3, CP_Temp4, CP_Temp5, CP_Temp6</LEFTFIELDS>
						<LOCAL>Field : CP_Temp1 : Set as :$MASTERID</LOCAL>
						<LOCAL>Field : CP_Temp2 : Set as :$DATE</LOCAL>
						<LOCAL>Field : CP_Temp3 : Set as :$VOUCHERTYPENAME</LOCAL>
						<LOCAL>Field : CP_Temp4 : Set as :$VOUCHERNUMBER</LOCAL>
						<LOCAL>Field : CP_Temp5 : Set as : $$IfDr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp6 : Set as : $$IfCr:$$FNBillAllocTotal:@@AllocBillName</LOCAL>
						<LOCAL>Field : CP_Temp1  : XMLTag : "MASTERID"</LOCAL>
						<LOCAL>Field : CP_Temp2  : XMLTag : "DATE"</LOCAL>
						<LOCAL>Field : CP_Temp3  : XMLTag : "VOUCHERTYPE"</LOCAL>
						<LOCAL>Field : CP_Temp4  : XMLTag : "VOUCHERNUMBER"</LOCAL>
						<LOCAL>Field : CP_Temp5  : XMLTag : "DEBITAMT"</LOCAL>
						<LOCAL>Field : CP_Temp6  : XMLTag : "CREDITAMT"</LOCAL>
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
      const voucherNo = row.voucherNo || '';
      
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
              <div class="metric-title">Total Orders</div>
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
              <div class="metric-title">Avg Order Value</div>
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
            <p>Report generated by TallyCatalyst Sales Dashboard</p>
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
          ['Total Orders', totalOrders],
          ['Total Quantity', totalQuantity],
          ['Unique Customers', uniqueCustomers],
          ['Average Order Value', avgOrderValue],
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
              <div class="metric-title">Total Orders</div>
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
              <div class="metric-title">Avg Order Value</div>
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
            <p>Report generated by TallyCatalyst Sales Dashboard</p>
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

  useEffect(() => {
    if (shouldAutoLoad && fromDate && toDate) {
      loadSalesRef.current?.(fromDate, toDate, { invalidateCache: true });
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
        `}
      </style>
     <div
       style={{
         background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #f0f9ff 100%)',
         minHeight: '100vh',
         padding: '24px',
         paddingTop: '40px',
         width: '80vw',
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
            padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(to bottom, #ffffff 0%, #fafbfc 100%)',
          position: 'relative'
          }}>
            {/* Three-Column Layout: Title | Date Range (Centered) | Export Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center', 
          gap: '16px',
          flexWrap: 'wrap',
          width: '100%',
          position: 'relative'
        }}>
          {/* Left: Icon + Title Section */}
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
                {/* Create Custom Card Button - Inline */}
                {sales.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCustomCardModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
                      e.target.style.boxShadow = '0 3px 6px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                      e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '16px' }}>add</span>
                    Create card
                  </button>
                )}
              </div>
          </div>

          {/* Center: Date Range and Submit Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: '1 1 0',
            justifyContent: 'center',
            flexWrap: 'wrap',
            minWidth: '400px'
          }}>
            {/* Start Date - Compact */}
            <div style={{ position: 'relative', flex: '0 0 150px' }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '10px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
              }}
              >
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    color: '#1e293b',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}
                />
                <label style={{
                  position: 'absolute',
                  top: '-7px',
                  left: '10px',
                  background: 'white',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: '#64748b',
                  padding: '0 4px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1,
                  letterSpacing: '0.02em'
                }}>
                  Start
                </label>
              </div>
            </div>

            {/* End Date - Compact */}
            <div style={{ position: 'relative', flex: '0 0 150px' }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '10px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
              }}
              >
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    color: '#1e293b',
                    borderRadius: '8px',
                    fontWeight: '500'
                  }}
                />
                <label style={{
                  position: 'absolute',
                  top: '-7px',
                  left: '10px',
                  background: 'white',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: '#64748b',
                  padding: '0 4px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1,
                  letterSpacing: '0.02em'
                }}>
                  End
                </label>
              </div>
            </div>

            {/* Submit Button - Compact */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  border: 'none',
                  borderRadius: '10px',
                padding: '9px 18px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: loading ? 'none' : '0 3px 8px rgba(59, 130, 246, 0.3)',
                  minWidth: '100px',
                  justifyContent: 'center',
                opacity: loading ? 0.7 : 1,
                height: '40px',
                whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                    e.target.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
                    e.target.style.boxShadow = '0 3px 8px rgba(59, 130, 246, 0.3)';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                {loading ? (
                  <span className="material-icons" style={{ fontSize: '14px', animation: 'spin 1s linear infinite' }}>refresh</span>
                ) : (
                  <span className="material-icons" style={{ fontSize: '14px' }}>search</span>
                )}
                {loading ? 'Loading...' : 'Submit'}
              </button>
          </div>

          {/* Right: Export Buttons */}
          <div style={{
            display: 'flex', 
            gap: '6px', 
            alignItems: 'center',
            flex: '1 1 0',
            justifyContent: 'flex-end',
            minWidth: '200px'
          }}>
            <button
              type="button"
              title="Export to PDF"
              onClick={exportToPDF}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                height: '40px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
                e.target.style.boxShadow = '0 3px 10px rgba(220, 38, 38, 0.35)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
                e.target.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.25)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>picture_as_pdf</span>
              <span style={{ fontSize: '12px' }}>PDF</span>
            </button>
            <button
              type="button"
              title="Export to Excel"
              onClick={exportToExcel}
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#fff',
                fontSize: '12px',
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
              <span className="material-icons" style={{ fontSize: '16px' }}>table_chart</span>
              <span style={{ fontSize: '12px' }}>Excel</span>
            </button>
            <button
              type="button"
              title="Print Report"
              onClick={printDashboard}
              style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(30, 64, 175, 0.25)',
                height: '40px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)';
                e.target.style.boxShadow = '0 3px 10px rgba(30, 64, 175, 0.35)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)';
                e.target.style.boxShadow = '0 2px 6px rgba(30, 64, 175, 0.25)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
              <span style={{ fontSize: '12px' }}>Print</span>
            </button>
          </div>
          </div>
        </div>
        </div>

        {/* Progress Bar */}
        {loading && progress.total > 0 && (
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '14px',
              color: '#0369a1'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>cloud_download</span>
                <span style={{ fontWeight: '600' }}>Fetching data from Tally server...</span>
              </div>
              <span style={{ fontWeight: '600' }}>
                {elapsedTime > 0 ? formatElapsedTime(elapsedTime) : 'Starting...'}
              </span>
            </div>
            <div style={{
              width: '100%',
              background: '#e0f2fe',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '8px',
                background: 'linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)',
                borderRadius: '4px',
                width: `${progress.percentage}%`,
                transition: 'width 0.3s ease',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                  animation: 'progressShimmer 1.5s infinite'
                }} />
              </div>
            </div>
          </div>
        )}

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
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <span style={{
                fontSize: '12px',
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
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>person</span>
                  Customer: {selectedCustomer}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedItem !== 'all' && (
                <div style={{
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '16px',
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>inventory_2</span>
                  Item: {selectedItem}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedStockGroup !== 'all' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '16px',
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>category</span>
                  Stock Group: {selectedStockGroup}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}
              
              {selectedRegion !== 'all' && (
                <div style={{
                  background: '#e0e7ff',
                  border: '1px solid #a5b4fc',
                  borderRadius: '16px',
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#3730a3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>place</span>
                  State: {selectedRegion}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}

              {selectedCountry !== 'all' && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '16px',
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>public</span>
                  Country: {selectedCountry}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}

              {selectedPeriod && (
                <div style={{
                  background: '#fce7f3',
                  border: '1px solid #f9a8d4',
                  borderRadius: '16px',
                  padding: '4px 8px 4px 12px',
                  fontSize: '12px',
                  color: '#9d174d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>calendar_month</span>
                  Period: {formatPeriodLabel(selectedPeriod)}
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
                    <span className="material-icons" style={{ fontSize: '14px' }}>close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div style={{ marginBottom: '20px' }}>
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#64748b',
                  fontSize: '14px',
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
                <span className="material-icons" style={{ fontSize: '16px' }}>clear</span>
                Clear All Filters
              </button>
            </div>
          )}
        </form>

        {/* Dashboard Content */}
        <div style={{ padding: '24px 28px 28px 28px' }}>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '28px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '20px',
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
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Total Revenue
                </p>
                <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>account_balance_wallet</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '20px',
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
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Total Orders
                </p>
                <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  {totalOrders}
                </p>
              </div>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#16a34a' }}>shopping_cart</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '20px',
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
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Unique Customers
                </p>
                <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  {uniqueCustomers}
                </p>
              </div>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(147, 51, 234, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#9333ea' }}>people</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '20px',
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
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                  Avg Order Value
                </p>
                <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                  ₹{avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.15)'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#16a34a' }}>trending_up</span>
              </div>
              </div>
            </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '28px'
          }}>
            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
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
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Total Profit
                  </p>
                  <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: totalProfit >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    ₹{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: totalProfit >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: totalProfit >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    {totalProfit >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>
            )}

            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
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
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Profit Margin
                  </p>
                  <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: profitMargin >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    {profitMargin >= 0 ? '+' : ''}{profitMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </p>
                </div>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: profitMargin >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: profitMargin >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: profitMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    {profitMargin >= 0 ? 'percent' : 'remove'}
                  </span>
                </div>
              </div>
            )}

            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
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
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: '1.2' }}>
                    Avg Profit per Order
                  </p>
                  <p style={{ margin: '0', fontSize: '26px', fontWeight: '800', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626', lineHeight: '1.2', letterSpacing: '-0.01em' }}>
                    ₹{avgProfitPerOrder.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: avgProfitPerOrder >= 0 ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)' : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: avgProfitPerOrder >= 0 ? '0 2px 8px rgba(22, 163, 74, 0.15)' : '0 2px 8px rgba(220, 38, 38, 0.15)'
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626' }}>
                    {avgProfitPerOrder >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Charts Section */}
          {/* Row 1: Sales by Stock Group and Salesperson Totals */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Category Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Region Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
                        (sale) => sale.region === item.label
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
                        (sale) => sale.region === item.label
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
                        (sale) => sale.region === item.label
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
                        (sale) => sale.region === item.label
                      ),
                  }}
                />
              )}
            </div>

            {/* Country Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            {/* Period Chart */}
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
              height: '500px', // Fixed height for consistency
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
                        (sale) => sale.customer === item.label
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
                        (sale) => sale.customer === item.label
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
                        (sale) => sale.customer === item.label
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
                        (sale) => sale.customer === item.label
                      ),
                  }}
                />
              )}
            </div>
          </div>

          {/* Row 4: Top Items by Revenue and Top Items by Quantity */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === entry.label
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
                        (sale) => sale.item === entry.label
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
                        (sale) => sale.item === entry.label
                      ),
                  }}
                />
              )}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === entry.label
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
                        (sale) => sale.item === entry.label
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
                        (sale) => sale.item === entry.label
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
              gridTemplateColumns: '1fr 1fr',
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
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === item.label
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
                        (sale) => sale.item === item.label
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
        </div>
      </div>
    </div>

    {/* Custom Cards Section */}
    {customCards.length > 0 && (
      <div ref={customCardsSectionRef} style={{ padding: '24px', overflow: 'visible' }}>
        <h2 style={{ 
          margin: '0 0 20px 0', 
          fontSize: '20px', 
          fontWeight: '700', 
          color: '#1e293b' 
        }}>
          Custom Cards
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: '24px',
          overflow: 'visible'
        }}>
          {customCards.map(card => (
            <CustomCard
              key={card.id}
              card={card}
              salesData={filteredSales}
              generateCustomCardData={generateCustomCardData}
              chartType={customCardChartTypes[card.id] || card.chartType || 'bar'}
              onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [card.id]: newType }))}
              onDelete={() => handleDeleteCustomCard(card.id)}
              openTransactionRawData={openTransactionRawData}
            />
          ))}
        </div>
      </div>
    )}

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
          salesData={filteredSales}
          onClose={() => setShowCustomCardModal(false)}
          onCreate={handleCreateCustomCard}
        />
      </div>
    )}
    </>
  );
};

// Custom Card Modal Component
const CustomCardModal = ({ salesData, onClose, onCreate }) => {
  const [cardTitle, setCardTitle] = useState('');
  const [groupBy, setGroupBy] = useState('category');
  const [chartType, setChartType] = useState('bar');
  const [valueField, setValueField] = useState('quantity');
  const [topN, setTopN] = useState('');


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }

    // Determine aggregation and date grouping based on groupBy and valueField
    let aggregation = 'sum';
    let dateGrouping = 'month';
    
    if (valueField === 'transactions' || valueField === 'unique_customers' || valueField === 'unique_items' || valueField === 'unique_orders') {
      aggregation = 'count';
    } else if (valueField === 'avg_amount' || valueField === 'avg_quantity' || valueField === 'avg_profit') {
      aggregation = 'average';
    }
    
    // Map valueField to internal field names
    let mappedValueField = valueField;
    if (valueField === 'avg_amount') mappedValueField = 'amount';
    else if (valueField === 'avg_quantity') mappedValueField = 'quantity';
    else if (valueField === 'avg_profit') mappedValueField = 'profit';
    
    // Set date grouping based on groupBy
    if (groupBy === 'date') {
      dateGrouping = 'month'; // Default to month
    }

    const cardConfig = {
      title: cardTitle.trim(),
      groupBy,
      dateGrouping: groupBy === 'date' ? dateGrouping : undefined,
      aggregation,
      valueField: mappedValueField,
      chartType,
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
        maxWidth: '520px',
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
          Create Custom Card
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

      {/* Form Content */}
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

        {/* Group By */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Group By <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                paddingRight: '36px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                background: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                appearance: 'none',
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
            >
              <option value="category">Stock Group</option>
              <option value="region">Region</option>
              <option value="country">Country</option>
              <option value="salesperson">Salesperson</option>
              <option value="customer">Customer</option>
              <option value="item">Item</option>
              <option value="date">Date (Monthly)</option>
            </select>
            <span className="material-icons" style={{ 
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}>keyboard_arrow_down</span>
          </div>
        </div>

        {/* Show */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Show <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={valueField}
              onChange={(e) => setValueField(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                paddingRight: '36px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                background: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                appearance: 'none',
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
            >
              <option value="amount">Total Amount</option>
              <option value="quantity">Total Quantity</option>
              <option value="profit">Total Profit</option>
              <option value="transactions">Number of Transactions</option>
              <option value="unique_customers">Number of Customers</option>
              <option value="unique_items">Number of Items</option>
              <option value="avg_amount">Average Amount</option>
              <option value="avg_quantity">Average Quantity</option>
              <option value="avg_profit">Average Profit</option>
            </select>
            <span className="material-icons" style={{ 
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}>keyboard_arrow_down</span>
          </div>
        </div>

        {/* Chart Type */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '6px',
            letterSpacing: '0.01em'
          }}>
            Chart Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '11px 14px',
                paddingRight: '36px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                background: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                appearance: 'none',
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
            >
              <option value="bar">Bar</option>
              <option value="pie">Pie</option>
              <option value="treemap">Tree Map</option>
              <option value="line">Line</option>
            </select>
            <span className="material-icons" style={{ 
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px',
              color: '#94a3b8',
              pointerEvents: 'none'
            }}>keyboard_arrow_down</span>
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
            Create Card
          </button>
        </div>
      </form>
    </div>
  );
};

// Custom Card Component
const CustomCard = React.memo(({ card, salesData, generateCustomCardData, chartType, onChartTypeChange, onDelete, openTransactionRawData }) => {
  const cardData = useMemo(() => generateCustomCardData(card, salesData), [card, salesData, generateCustomCardData]);

  const getFilterFn = (itemLabel) => {
    return (sale) => {
      if (card.groupBy === 'date') {
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
        return groupKey === itemLabel;
      } else if (card.groupBy === 'profit_margin') {
        const margin = sale.amount > 0 ? ((sale.profit / sale.amount) * 100).toFixed(0) : '0';
        return `${margin}%` === itemLabel;
      } else if (card.groupBy === 'order_value') {
        const value = sale.amount;
        let range = '';
        if (value < 1000) range = '< ₹1K';
        else if (value < 5000) range = '₹1K - ₹5K';
        else if (value < 10000) range = '₹5K - ₹10K';
        else if (value < 50000) range = '₹10K - ₹50K';
        else range = '> ₹50K';
        return range === itemLabel;
      } else {
        return sale[card.groupBy] === itemLabel;
      }
    };
  };

  const valuePrefix = card.valueField === 'amount' || card.valueField === 'profit' || card.valueField === 'tax_amount' || card.valueField === 'order_value' || card.valueField === 'avg_order_value' || card.valueField === 'avg_amount' || card.valueField === 'avg_profit' || card.valueField === 'profit_per_quantity' ? '₹' : '';

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '600px',
        overflow: 'hidden'
      }}
    >
      {/* Chart Type Selector - Fixed Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexShrink: 0,
        gap: '12px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1e293b', flex: 1 }}>
          {card.title}
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <select
            value={chartType}
            onChange={(e) => onChartTypeChange(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              background: 'white',
              color: '#374151',
              cursor: 'pointer'
            }}
          >
            <option value="bar">Bar</option>
            <option value="pie">Pie</option>
            <option value="treemap">Tree Map</option>
            <option value="line">Line</option>
          </select>
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
              e.target.style.background = '#fecaca';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#fee2e2';
            }}
            title="Delete custom card"
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
          </button>
        </div>
      </div>

      {/* Chart Rendering - Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        maxHeight: '500px'
      }}>
        {cardData.length > 0 ? (
        <>
          {chartType === 'bar' && (
            <BarChart
              data={cardData}
              customHeader={null}
              valuePrefix={valuePrefix}
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
              customHeader={null}
              valuePrefix={valuePrefix}
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
              customHeader={null}
              valuePrefix={valuePrefix}
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
              customHeader={null}
              valuePrefix={valuePrefix}
              rowAction={{
                icon: 'table_view',
                title: 'View raw data',
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getFilterFn(item.label))
              }}
            />
          )}
        </>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            No data available for this card configuration.
          </div>
        )}
      </div>
    </div>
  );
});

export default SalesDashboard;