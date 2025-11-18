import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { apiPost } from '../../utils/apiUtils';
import BarChart from './components/BarChart';
import PieChart from './components/PieChart';
import TreeMap from './components/TreeMap';
import LineChart from './components/LineChart';
import ChatBot from './components/ChatBot';
import { getUserModules, hasPermission } from '../../config/SideBarConfigurations';

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
  const [selectedPeriod, setSelectedPeriod] = useState(() => initialCachedState?.filters?.period ?? null); // Format: "YYYY-MM"
  const [categoryChartType, setCategoryChartType] = useState('bar');
  const [regionChartType, setRegionChartType] = useState('bar');
  const [periodChartType, setPeriodChartType] = useState('bar');
  const [topCustomersChartType, setTopCustomersChartType] = useState('bar');
  const [topItemsByRevenueChartType, setTopItemsByRevenueChartType] = useState('bar');
  const [topItemsByQuantityChartType, setTopItemsByQuantityChartType] = useState('bar');
  const [revenueVsProfitChartType, setRevenueVsProfitChartType] = useState('bar');
  const [topProfitableItemsChartType, setTopProfitableItemsChartType] = useState('bar');
  const [topLossItemsChartType, setTopLossItemsChartType] = useState('bar');
  const [monthWiseProfitChartType, setMonthWiseProfitChartType] = useState('line');
  const requestTimestampRef = useRef(Date.now());

  // Cache for API responses
  const [apiCache, setApiCache] = useState(new Map());
  const [shouldAutoLoad, setShouldAutoLoad] = useState(false);
  const loadSalesRef = useRef(null);
  const [rawDataModal, setRawDataModal] = useState({ open: false, title: '', rows: [], columns: [] });
  const [rawDataSearch, setRawDataSearch] = useState('');
  const [rawDataPage, setRawDataPage] = useState(1);

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
    setSelectedPeriod(filters.period ?? null);
  }, [setFromDate, setToDate, setDateRange, setSales, setSelectedCustomer, setSelectedItem, setSelectedStockGroup, setSelectedRegion, setSelectedPeriod]);

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
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && regionMatch && periodMatch;
    });
    
    console.log('✅ Filtered sales result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedRegion, selectedPeriod]);

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
      const saleDate = sale.cp_date || sale.date;
      const date = new Date(saleDate);
      const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const periodMatch = !selectedPeriod || salePeriod === selectedPeriod;
      const isSalesMatch = sale.issales === true || sale.issales === 1 || sale.issales === '1' || sale.issales === 'Yes' || sale.issales === 'yes';
      
      if (!isSalesMatch) {
        console.log('❌ Filtered out for orders - not a sale:', { issales: sale.issales, sale });
      }
      
      return dateMatch && customerMatch && itemMatch && stockGroupMatch && regionMatch && periodMatch && isSalesMatch;
    });
    
    console.log('✅ Filtered sales for orders result:', {
      originalCount: sales.length,
      filteredCount: filtered.length,
      sampleRecord: filtered[0]
    });
    
    return filtered;
  }, [sales, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedRegion, selectedPeriod]);

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
      
      const transformedSales = allVouchers.map(voucher => ({
        category: voucher.sgrpofgrp || voucher.sgroup || 'Other',
        region: voucher.state || 'Unknown',
        amount: parseFloat(voucher.amount) || 0,
        quantity: parseInt(voucher.billedqty) || 0,
        customer: voucher.customer || 'Unknown',
        item: voucher.stockitem || 'Unknown',
        date: parseDateFromAPI(voucher.date),
        cp_date: voucher.cp_date ? parseDateFromAPI(voucher.cp_date) : null,
        vchno: voucher.vchno,
        masterid: voucher.masterid,
        issales: voucher.issales,
        profit: parseFloat(voucher.profit) || 0
      }));

      setSales(transformedSales);
      setDateRange({ start: startDate, end: endDate });
      setFromDate(startDate);
      setToDate(endDate);

      persistDashboardCache(companyInfo, {
        fromDate: startDate,
        toDate: endDate,
        sales: transformedSales,
        filters: {
          customer: selectedCustomer,
          item: selectedItem,
          stockGroup: selectedStockGroup,
          region: selectedRegion,
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
      .slice(0, 10);
  }, [filteredSales]);

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
      .slice(0, 10);
  }, [filteredSales]);

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
      .slice(0, 10);
  }, [filteredSales]);

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
    selectedPeriod !== null;

  const clearAllFilters = () => {
    // Only clear interactive filters - do NOT touch cache or date range
    console.log('🧹 Clearing interactive filters only (preserving cache and date range)...');
    
    setSelectedCustomer('all');
    setSelectedItem('all');
    setSelectedStockGroup('all');
    setSelectedRegion('all');
    setSelectedPeriod(null);
    
    // Note: Cache and date range are preserved to avoid unnecessary API calls
  };

  const formatCurrency = (value) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    { key: 'region', label: 'Region' },
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
      quantity: Number.isFinite(sale.quantity) ? sale.quantity : parseFloat(sale.quantity) || 0,
      amount: sale.amount || 0,
    }))
  ), []);

  const openTransactionRawData = useCallback((title, predicate) => {
    const rows = buildTransactionRows(filteredSales.filter(predicate));
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

  // Helper function to create SVG charts
  const createBarChart = (data, title, width = 600, height = 300) => {
    if (!data || data.length === 0) return '';
    
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = (width - 100) / data.length;
    const barHeight = height - 80;
    
    let svg = `<svg width="${width}" height="${height}" style="border: 1px solid #e2e8f0; border-radius: 8px; background: white;">
      <text x="${width/2}" y="20" text-anchor="middle" style="font-size: 16px; font-weight: bold; fill: #1e293b;">${title}</text>`;
    
    data.slice(0, 10).forEach((item, index) => {
      const x = 50 + index * barWidth;
      const barH = (item.value / maxValue) * barHeight;
      const y = height - 30 - barH;
      
      svg += `
        <rect x="${x + 5}" y="${y}" width="${barWidth - 10}" height="${barH}" fill="${item.color || '#3b82f6'}" />
        <text x="${x + barWidth/2}" y="${height - 10}" text-anchor="middle" style="font-size: 10px; fill: #64748b;">${item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label}</text>
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
          </div>
          
          ${hasActiveFilters ? `
          <div class="filters">
            <strong>Active Filters:</strong><br>
            ${selectedCustomer !== 'all' ? `<span class="filter-item">Customer: ${selectedCustomer}</span>` : ''}
            ${selectedItem !== 'all' ? `<span class="filter-item">Item: ${selectedItem}</span>` : ''}
            ${selectedStockGroup !== 'all' ? `<span class="filter-item">Stock Group: ${selectedStockGroup}</span>` : ''}
            ${selectedRegion !== 'all' ? `<span class="filter-item">Region: ${selectedRegion}</span>` : ''}
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
            <div class="chart-title">Sales by Region</div>
            <div class="chart-container">
              ${createPieChart(regionChartData, 'Sales by Region')}
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
          ['Total Orders', totalOrders],
          ['Total Quantity', totalQuantity],
          ['Unique Customers', uniqueCustomers],
          ['Average Order Value', avgOrderValue],
          ['Date Range', `${fromDate} to ${toDate}`],
          ['Total Records', filteredSales.length]
        ],
        'Stock Groups': [
          ['Stock Group', 'Revenue'],
          ...categoryChartData.map(item => [item.label, item.value])
        ],
        'Regions': [
          ['Region', 'Revenue'],
          ...regionChartData.map(item => [item.label, item.value])
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
        ]
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
          </div>
          
          ${hasActiveFilters ? `
          <div class="filters">
            <strong>Active Filters:</strong><br>
            ${selectedCustomer !== 'all' ? `<span class="filter-item">Customer: ${selectedCustomer}</span>` : ''}
            ${selectedItem !== 'all' ? `<span class="filter-item">Item: ${selectedItem}</span>` : ''}
            ${selectedStockGroup !== 'all' ? `<span class="filter-item">Stock Group: ${selectedStockGroup}</span>` : ''}
            ${selectedRegion !== 'all' ? `<span class="filter-item">Region: ${selectedRegion}</span>` : ''}
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
            <div class="chart-title">Sales by Region</div>
            <div class="chart-container">
              ${createPieChart(regionChartData, 'Sales by Region')}
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
          title: 'Sales by Region',
          columns: [
            { key: 'region', label: 'Region' },
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
         background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)',
         minHeight: '100vh',
         padding: 0,
         paddingTop: '40px',
         width: '80vw', // Use 100% of available space (after sidebar)
         margin: 0,
         display: 'block',
         overflowX: 'hidden',
       }}
     >
       <div
         style={{
           width: '100%', // Use full available width
           margin: 0,
           background: 'white',
           borderRadius: '12px',
           boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
           overflow: 'visible',
           border: '1px solid #e5e7eb',
           position: 'relative',
         }}
       >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #f3f4f6',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
            }}>
              <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>analytics</span>
            </div>
            <div>
              <h1 style={{
                margin: 0,
                color: '#1e293b',
                fontSize: '24px',
                fontWeight: '700',
                lineHeight: '1.2'
              }}>
                Sales Analytics Dashboard
              </h1>
              <p style={{
                margin: '4px 0 0 0',
                color: '#64748b',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Comprehensive sales insights and performance metrics
              </p>
            </div>
          </div>
          <div style={{
            background: '#f0f9ff',
            color: '#0369a1',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #bae6fd'
          }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>bar_chart</span>
            {filteredSales.length} records available
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
          {/* Single Line: Start Date, End Date, Submit Button */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '250px 250px 160px',
            gap: '20px',
            alignItems: 'end',
            minHeight: '60px',
            position: 'relative',
            marginBottom: '20px'
          }}>
            {/* Start Date */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    color: '#1e293b',
                    borderRadius: '10px'
                  }}
                />
                <label style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '12px',
                  background: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  Start Date
                </label>
              </div>
            </div>

            {/* End Date */}
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                background: 'white',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    color: '#1e293b',
                    borderRadius: '10px'
                  }}
                />
                <label style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '12px',
                  background: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#64748b',
                  padding: '0 6px',
                  transition: 'all 0.2s ease',
                  pointerEvents: 'none',
                  zIndex: 1
                }}>
                  End Date
                </label>
              </div>
            </div>



            {/* Submit Button */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-start'
            }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 20px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                  minWidth: '120px',
                  justifyContent: 'center',
                  opacity: loading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)';
                  }
                }}
              >
                {loading ? (
                  <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
                ) : (
                  <span className="material-icons" style={{ fontSize: '16px' }}>search</span>
                )}
                {loading ? 'Loading...' : 'Submit'}
              </button>
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
                  Region: {selectedRegion}
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

        {/* Export Buttons */}
        <div style={{ 
          background: '#f8fafc', 
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                title="Export to PDF"
                onClick={exportToPDF}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                }}
                onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)'}
                onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>picture_as_pdf</span>
                PDF
              </button>
              <button
                title="Export to Excel"
                onClick={exportToExcel}
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
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)'
                }}
                onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #047857 0%, #065f46 100%)'}
                onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)'}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>table_chart</span>
                Excel
              </button>
              <button
                title="Print Report"
                onClick={printDashboard}
                style={{
                  background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(30, 64, 175, 0.2)'
                }}
                onMouseEnter={(e) => e.target.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)'}
                onMouseLeave={(e) => e.target.style.background = 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)'}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div style={{ padding: '24px' }}>
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Revenue
                </p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  ₹{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#3b82f6' }}>attach_money</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Orders
                </p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  {totalOrders}
                </p>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#16a34a' }}>shopping_cart</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Unique Customers
                </p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  {uniqueCustomers}
                </p>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#e9d5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#9333ea' }}>people</span>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Avg Order Value
                </p>
                <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                  ₹{avgOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: '24px', color: '#16a34a' }}>trending_up</span>
              </div>
              </div>
            </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {canShowProfit && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Profit
                  </p>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: totalProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                    ₹{totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: totalProfit >= 0 ? '#dcfce7' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Profit Margin
                  </p>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: profitMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    {profitMargin >= 0 ? '+' : ''}{profitMargin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: profitMargin >= 0 ? '#dcfce7' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Avg Profit per Order
                  </p>
                  <p style={{ margin: '0', fontSize: '24px', fontWeight: '700', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626' }}>
                    ₹{avgProfitPerOrder.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: avgProfitPerOrder >= 0 ? '#dcfce7' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span className="material-icons" style={{ fontSize: '24px', color: avgProfitPerOrder >= 0 ? '#16a34a' : '#dc2626' }}>
                    account_balance_wallet
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Charts Section */}
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
                {categoryChartType === 'bar' && (
                <BarChart
                  data={categoryChartData}
                  title="Sales by Stock Group"
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
                    title="Sales by Stock Group"
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
                    title="Sales by Stock Group"
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
                    title="Sales by Stock Group"
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

            {/* Region Chart */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '500px', // Fixed height for consistency
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
                    Sales by Region
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
              {regionChartType === 'bar' && (
                <BarChart
                  data={regionChartData}
                  title="Sales by Region"
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
                  title="Sales by Region"
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
                  title="Sales by Region"
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
                  title="Sales by Region"
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
          </div>

          {/* Period Chart and Top Customers */}
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {periodChartType === 'bar' && (
                <BarChart
                  data={periodChartData}
                  title="Sales by Period (Month)"
                   onBarClick={(periodLabel) => {
                     // Find the original label from the clicked period
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
                  title="Sales by Period (Month)"
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
                  title="Sales by Period (Month)"
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
                  title="Sales by Period (Month)"
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {topCustomersChartType === 'bar' && (
                <BarChart
                  data={topCustomersData}
                  title="Top 10 Customers by Revenue"
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
                  title="Top 10 Customers by Revenue"
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
                  title="Top 10 Customers by Revenue"
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
                  title="Top 10 Customers by Revenue"
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

          {/* Bottom Charts */}
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {topItemsByRevenueChartType === 'bar' && (
                <BarChart
                  data={topItemsByRevenueData}
                  title="Top 10 Items by Revenue"
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
                  title="Top 10 Items by Revenue"
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
                  title="Top 10 Items by Revenue"
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
                  title="Top 10 Items by Revenue"
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {topItemsByQuantityChartType === 'bar' && (
                <BarChart
                  data={topItemsByQuantityData}
                  title="Top 10 Items by Quantity Sold"
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
                  title="Top 10 Items by Quantity Sold"
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
                  title="Top 10 Items by Quantity Sold"
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
                  title="Top 10 Items by Quantity Sold"
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

          {/* Profit Analysis Charts Section */}
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
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1
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
                {revenueVsProfitChartType === 'line' && (
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    flex: 1
                  }}>
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
                      <g transform="translate(450, 20)">
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
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    flex: 1
                  }}>
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
                      <g transform="translate(450, 20)">
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
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1
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
                {monthWiseProfitChartType === 'bar' && (
                   <BarChart
                     data={monthWiseProfitChartData}
                     title="Month-wise Profit"
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
                     title="Month-wise Profit"
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
                     title="Month-wise Profit"
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
                     title="Month-wise Profit"
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

          {/* Top 10 Profitable Items and Top 10 Loss Items */}
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {topProfitableItemsChartType === 'bar' && (
                <BarChart
                  data={topProfitableItemsData}
                  title="Top Profitable Items"
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
                  title="Top 10 Profitable Items"
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
                  title="Top 10 Profitable Items"
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
                  title="Top 10 Profitable Items"
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
              overflowY: 'auto',
              overflowX: 'hidden'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1
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
              {topLossItemsChartType === 'bar' && (
                <BarChart
                  data={topLossItemsData}
                  title="Top Loss Items"
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
                  title="Top 10 Loss Items"
                  onSliceClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
              {topLossItemsChartType === 'treemap' && (
                <TreeMap
                  data={topLossItemsData}
                  title="Top 10 Loss Items"
                  onBoxClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
              {topLossItemsChartType === 'line' && (
                <LineChart
                  data={topLossItemsData}
                  title="Top 10 Loss Items"
                  onPointClick={(item) => setSelectedItem(item)}
                  onBackClick={() => setSelectedItem('all')}
                  showBackButton={selectedItem !== 'all'}
                />
              )}
            </div>
          </div>
        </div>
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
                      style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s ease' }}
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
    </>
  );
};

export default SalesDashboard;