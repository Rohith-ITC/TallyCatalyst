import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { apiPost, apiGet, apiPut, apiDelete } from '../../utils/apiUtils';
import { API_CONFIG, getApiUrl } from '../../config';
import BarChart from './components/BarChart';
import PieChart from './components/PieChart';
import TreeMap from './components/TreeMap';
import LineChart from './components/LineChart';
import MultiAxisChart from './components/MultiAxisChart';
import GeoMapChart from './components/GeoMapChart';
import ChatBot from './components/ChatBot';
import { getUserModules, hasPermission } from '../../config/SideBarConfigurations';
import {
  ResponsiveContainer,
  Treemap,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from 'recharts';
import { Tooltip } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import BillDrilldownModal from '../../RecvDashboard/components/BillDrilldownModal';
import VoucherDetailsModal from '../components/VoucherDetailsModal';
import {
  escapeForXML,
  cleanAndEscapeForXML,
  parseXMLResponse,
} from '../../RecvDashboard/utils/helpers';
import { getCompanyConfigValue, clearCompanyConfigCache } from '../../utils/companyConfigUtils';
import { hybridCache, DateRangeUtils } from '../../utils/hybridCache';
import { syncSalesData, cacheSyncManager, checkInterruptedDownload, clearDownloadProgress } from '../../utils/cacheSyncManager';
import ResumeDownloadModal from '../components/ResumeDownloadModal';

const SalesDashboard = ({ onNavigationAttempt }) => {
  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setWindowWidth(width);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // API data state
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [noCompanySelected, setNoCompanySelected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
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
  const [regionMapSubType, setRegionMapSubType] = useState('choropleth');
  const [countryChartType, setCountryChartType] = useState('bar');
  const [countryMapSubType, setCountryMapSubType] = useState('choropleth');
  const [periodChartType, setPeriodChartType] = useState('bar');
  const [topCustomersChartType, setTopCustomersChartType] = useState('bar');
  const [topItemsByRevenueChartType, setTopItemsByRevenueChartType] = useState('bar');
  const [topItemsByQuantityChartType, setTopItemsByQuantityChartType] = useState('bar');
  const [topCustomersN, setTopCustomersN] = useState(10);
  const [topItemsByRevenueN, setTopItemsByRevenueN] = useState(10);
  const [topItemsByQuantityN, setTopItemsByQuantityN] = useState(10);
  const [topCustomersNInput, setTopCustomersNInput] = useState('10');
  const [topItemsByRevenueNInput, setTopItemsByRevenueNInput] = useState('10');
  const [topItemsByQuantityNInput, setTopItemsByQuantityNInput] = useState('10');
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
  const [rawDataPageSize, setRawDataPageSize] = useState(20);
  const [rawDataPageInput, setRawDataPageInput] = useState('1');
  const [rawDataPageSizeInput, setRawDataPageSizeInput] = useState('20');
  const [rawDataSortBy, setRawDataSortBy] = useState(null); // 'date', 'quantity', 'amount', or null
  const [rawDataSortOrder, setRawDataSortOrder] = useState('asc'); // 'asc' or 'desc'
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Column filter states
  const [columnFilters, setColumnFilters] = useState({});
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(null);
  
  // Bill drilldown modal state
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownError, setDrilldownError] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Voucher details modal state
  const [showVoucherDetails, setShowVoucherDetails] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState(null);

  // Custom cards state
  const [customCards, setCustomCards] = useState([]);
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [customCardChartTypes, setCustomCardChartTypes] = useState({});
  const customCardsSectionRef = useRef(null);

  // Calendar modal state
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedPeriodType, setSelectedPeriodType] = useState(null); // 'financial-year', 'quarter', 'month', 'today', 'yesterday', 'week', 'custom'
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [tempFromDateDisplay, setTempFromDateDisplay] = useState('');
  const [tempToDateDisplay, setTempToDateDisplay] = useState('');
  const [booksFromDate, setBooksFromDate] = useState('');
  const [showFromDatePicker, setShowFromDatePicker] = useState(false);
  const [showToDatePicker, setShowToDatePicker] = useState(false);
  const fromDatePickerRef = useRef(null);
  const toDatePickerRef = useRef(null);
  const fromDateButtonRef = useRef(null);
  const toDateButtonRef = useRef(null);

  // Download dropdown state
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const downloadDropdownRef = useRef(null);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Fullscreen card modal state
  const [fullscreenCard, setFullscreenCard] = useState(null); // { type: 'metric' | 'chart' | 'custom', title: string, cardId?: string }
  
  // Card visibility state - tracks which cards are visible/hidden
  const [cardVisibility, setCardVisibility] = useState(() => {
    try {
      const stored = localStorage.getItem('salesDashboardCardVisibility');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error loading card visibility from localStorage:', e);
    }
    // Default: all cards visible (return empty object, meaning all are visible by default)
    return {};
  });
  
  // Save card visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('salesDashboardCardVisibility', JSON.stringify(cardVisibility));
    } catch (e) {
      console.warn('Error saving card visibility to localStorage:', e);
    }
  }, [cardVisibility]);

  // Number format preference: 'indian' (lakhs-crores) or 'international' (millions-billions)
  const [numberFormat, setNumberFormat] = useState(() => {
    try {
      const stored = localStorage.getItem('salesDashboardNumberFormat');
      return stored || 'indian'; // Default to Indian format
    } catch (e) {
      return 'indian';
    }
  });

  // Save number format to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('salesDashboardNumberFormat', numberFormat);
    } catch (e) {
      console.warn('Error saving number format to localStorage:', e);
    }
  }, [numberFormat]);
  
  // Toggle card visibility
  const toggleCardVisibility = useCallback((cardTitle) => {
    setCardVisibility(prev => {
      const newVisibility = { ...prev };
      // If card is currently visible (not in object or true), hide it (set to false)
      // If card is hidden (false), show it (remove from object or set to true)
      if (newVisibility[cardTitle] === false) {
        delete newVisibility[cardTitle]; // Remove to show (default is visible)
      } else {
        newVisibility[cardTitle] = false; // Hide it
      }
      return newVisibility;
    });
  }, []);
  
  // Check if a card is visible (default is true if not in the object)
  const isCardVisible = useCallback((cardTitle) => {
    return cardVisibility[cardTitle] !== false;
  }, [cardVisibility]);

  // Fullscreen card modal functions
  const openFullscreenCard = useCallback((cardType, cardTitle, cardId = null) => {
    setFullscreenCard({ type: cardType, title: cardTitle, cardId });
  }, []);

  const closeFullscreenCard = useCallback(() => {
    setFullscreenCard(null);
  }, []);

  // Background cache download state
  const [isDownloadingCache, setIsDownloadingCache] = useState(false);
  const [cacheDownloadProgress, setCacheDownloadProgress] = useState({ current: 0, total: 0, message: '' });
  const [cacheDownloadStartTime, setCacheDownloadStartTime] = useState(null);
  const cacheDownloadStartTimeRef = useRef(null);
  const cacheDownloadAbortRef = useRef(false);
  const [hasCacheData, setHasCacheData] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [interruptedProgress, setInterruptedProgress] = useState(null);
  // Track dismissed interruptions to prevent showing modal again after user closes it
  const dismissedInterruptionsRef = useRef(new Set());

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

  // Subscribe to cacheSyncManager for real-time progress updates (like CacheManagement)
  useEffect(() => {
    let companyInfoRef = null;
    
    // Subscribe to shared sync progress from cacheSyncManager
    const unsubscribe = cacheSyncManager.subscribe((progress) => {
      try {
        // Get current company info
        if (!companyInfoRef) {
          try {
            companyInfoRef = getCompanyInfo();
          } catch (e) {
            // Company not selected yet
            return;
          }
        }
        
        // Only update if this progress is for the currently selected company
        const currentCompanyInfo = cacheSyncManager.getCompanyInfo();
        
        if (currentCompanyInfo && companyInfoRef && 
            currentCompanyInfo.guid === companyInfoRef.guid) {
          // Update progress in real-time
          setCacheDownloadProgress(progress);
          setIsDownloadingCache(cacheSyncManager.isSyncInProgress());
          // Set start time if not already set and we have progress
          if (progress.total > 0 && !cacheDownloadStartTimeRef.current) {
            const startTime = Date.now();
            setCacheDownloadStartTime(startTime);
            cacheDownloadStartTimeRef.current = startTime;
          }
          console.log('📊 Real-time progress update from cacheSyncManager:', progress);
        }
      } catch (error) {
        // Ignore errors when getting company info
        console.warn('Error in progress subscription:', error);
      }
    });

    // Also set up periodic check for progress when downloading (every 1 second)
    const progressInterval = setInterval(async () => {
      if (isDownloadingCache) {
        try {
          if (!companyInfoRef) {
            companyInfoRef = getCompanyInfo();
          }
          
          if (companyInfoRef) {
            const companyProgress = await cacheSyncManager.getCompanyProgress(companyInfoRef);
            if (companyProgress && companyProgress.total > 0) {
              setCacheDownloadProgress(companyProgress);
              setIsDownloadingCache(true);
              // Set start time if not already set and we have progress
              if (!cacheDownloadStartTimeRef.current) {
                const startTime = Date.now();
                setCacheDownloadStartTime(startTime);
                cacheDownloadStartTimeRef.current = startTime;
              }
              console.log('📊 Polled progress update:', companyProgress);
            }
          }
        } catch (error) {
          // Ignore errors - company might not be selected
        }
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(progressInterval);
    };
  }, [isDownloadingCache]);

  // Compute download status based on cache state
  const downloadStatus = useMemo(() => {
    // During download, button is disabled, but we still track status for UI display
    if (isInterrupted && !isDownloadingCache) {
      return 'interrupted';
    }
    if (hasCacheData) {
      return 'completed';
    }
    return 'none';
  }, [hasCacheData, isInterrupted, isDownloadingCache]);

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
        const booksFrom = await fetchBooksFromDate(companyInfo.guid, companyInfo.tallyloc_id);
        if (booksFrom) {
          // Ensure the date is in YYYY-MM-DD format for the date input
          const parsedDate = parseDateFromNewFormat(booksFrom);
          if (parsedDate) {
            setBooksFromDate(parsedDate);
          } else {
            // If parsing fails, try to use as-is if it's already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(booksFrom)) {
          setBooksFromDate(booksFrom);
            } else {
              console.warn('Unable to parse booksFrom date:', booksFrom);
            }
          }
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

  // Close calendar pickers when clicking outside (but not inside the calendar itself)
  // We use a more reliable approach by checking for MUI calendar elements
  useEffect(() => {
    if (!showFromDatePicker && !showToDatePicker) return;

    const handleClickOutside = (event) => {
      // Check if click is inside any MUI DatePicker calendar element
      // MUI renders calendars in portals, so we need to check the DOM directly
      const target = event.target;
      
      // Check for MUI calendar-related elements
      const isInsideCalendar = 
        target.closest('.MuiPickersPopper-root') ||
        target.closest('.MuiPickersCalendar-root') ||
        target.closest('.MuiDayCalendar-root') ||
        target.closest('.MuiPickersCalendarHeader-root') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="grid"]') ||
        target.closest('[role="gridcell"]') ||
        target.closest('.MuiPickersArrowSwitcher-root') ||
        target.closest('button[aria-label*="Previous"]') ||
        target.closest('button[aria-label*="Next"]') ||
        target.closest('button[aria-label*="calendar"]') ||
        (target.classList && (
          target.classList.contains('MuiIconButton-root') ||
          target.classList.contains('MuiPickersDay-root')
        ));
      
      // Check if click is on our calendar button
      const isCalendarButton = 
        fromDateButtonRef.current?.contains(target) ||
        toDateButtonRef.current?.contains(target);
      
      // Only close if click is truly outside
      if (showFromDatePicker && !isInsideCalendar && !isCalendarButton) {
        setShowFromDatePicker(false);
      }
      
      if (showToDatePicker && !isInsideCalendar && !isCalendarButton) {
        setShowToDatePicker(false);
      }
    };

    // Use a small delay to ensure MUI's event handlers run first
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [showFromDatePicker, showToDatePicker]);

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
    const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid') || '';
    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId') || '';
    console.log('🎯 Selected company identifiers:', { selectedCompanyGuid, selectedCompanyTallylocId });
    
    // Find the current company object
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    const currentCompanyObj = companies.find(c =>
      c.guid === selectedCompanyGuid &&
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
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

  // Load custom cards from backend
  const loadCustomCards = useCallback(async () => {
    try {
      // Check if company is selected before trying to get company info
      const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (!selectedCompanyGuid) {
        console.log('⚠️ No company selected, skipping custom cards load');
        return;
      }
      
      const companyInfo = getCompanyInfo();
      const { tallyloc_id, guid } = companyInfo;
      
      if (!tallyloc_id || !guid) {
        console.warn('⚠️ Missing company information, skipping custom cards load');
        return;
      }
      
      const endpoint = `${API_CONFIG.ENDPOINTS.CUSTOM_CARD_GET}?tallylocId=${tallyloc_id}&coGuid=${guid}&dashboardType=sales`;
      const response = await apiGet(endpoint);
      
      if (response && response.status === 'success' && response.data) {
        const cards = Array.isArray(response.data) ? response.data : [];
        // Filter only active cards and flatten cardConfig properties
        const activeCards = cards.filter(card => card.isActive !== 0).map(card => {
          // Flatten cardConfig properties to top level if they exist
          const flatCard = { ...card };
          
          // Parse cardConfig if it's a string
          let parsedCardConfig = card.cardConfig;
          if (typeof card.cardConfig === 'string') {
            try {
              parsedCardConfig = JSON.parse(card.cardConfig);
            } catch (e) {
              console.warn('Failed to parse cardConfig for card:', card.id, e);
              parsedCardConfig = {};
            }
          }
          
          // Flatten cardConfig properties to top level
          if (parsedCardConfig && typeof parsedCardConfig === 'object') {
            flatCard.enableStacking = parsedCardConfig.enableStacking;
            flatCard.segmentBy = parsedCardConfig.segmentBy;
            flatCard.multiAxisSeries = parsedCardConfig.multiAxisSeries;
            flatCard.dateGrouping = parsedCardConfig.dateGrouping || flatCard.dateGrouping;
            flatCard.mapSubType = parsedCardConfig.mapSubType || 'choropleth';
          }
          
          // Force date grouping to 'day' (daily) for all date-based cards
          // This ensures existing cards created with 'month' grouping are updated to 'day'
          if (flatCard.groupBy === 'date' || flatCard.groupBy === 'cp_date' || 
              (flatCard.groupBy && String(flatCard.groupBy).toLowerCase().includes('date'))) {
            flatCard.dateGrouping = 'day';
            console.log('📅 Overriding dateGrouping to "day" for card:', {
              cardId: flatCard.id,
              cardTitle: flatCard.title,
              oldDateGrouping: parsedCardConfig?.dateGrouping || flatCard.dateGrouping,
              newDateGrouping: 'day'
            });
          }
          
          // Parse filters if it's a string
          if (typeof flatCard.filters === 'string') {
            try {
              flatCard.filters = JSON.parse(flatCard.filters);
            } catch (e) {
              console.warn('Failed to parse filters for card:', flatCard.id, e);
              flatCard.filters = [];
            }
          }
          
          console.log('📦 Loaded card:', {
            id: flatCard.id,
            title: flatCard.title,
            chartType: flatCard.chartType,
            multiAxisSeries: flatCard.multiAxisSeries,
            hasMultiAxis: !!flatCard.multiAxisSeries,
            filters: flatCard.filters
          });
          
          return flatCard;
        });
        
        setCustomCards(activeCards);
        
        // Set chart types for loaded cards
        const chartTypes = {};
        activeCards.forEach(card => {
          if (card.chartType) {
            chartTypes[card.id] = card.chartType;
          }
        });
        setCustomCardChartTypes(chartTypes);
        
        console.log('✅ Loaded custom cards from backend:', activeCards.length, activeCards);
      } else {
        console.warn('⚠️ No custom cards found or invalid response:', response);
        setCustomCards([]);
      }
    } catch (error) {
      console.error('❌ Error loading custom cards:', error);
      // Don't set cards to empty array on error - keep existing cards if any
    }
  }, []);

  // Load custom cards on mount and when company changes
  useEffect(() => {
    const loadCards = async () => {
      try {
        // Check if company is selected
        const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
        if (!selectedCompanyGuid) {
          console.log('⚠️ No company selected, skipping custom cards load');
          return;
        }
        
        await loadCustomCards();
      } catch (error) {
        console.error('❌ Error in loadCards useEffect:', error);
      }
    };
    
    // Load cards on mount
    loadCards();
    
    // Reload cards when company changes
    const handleCompanyChange = () => {
      loadCards();
    };
    
    window.addEventListener('companyChanged', handleCompanyChange);
    
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChange);
    };
  }, [loadCustomCards]);

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
    
    // Convert to string if not already
    const dateStr = String(dateString).trim();
    
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // If in YYYYMMDD format, use existing parser
    if (/^\d{8}$/.test(dateStr)) {
      return parseDateFromAPI(dateStr);
    }
    
    try {
      // Parse format like "1-Jun-25" or "15-Jul-25" or "1-Jun-2025"
      // Handle both 2-digit and 4-digit years
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        if (isNaN(day)) {
          console.warn('Invalid day in date:', dateStr);
          return null;
        }
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
        if (monthIndex === -1) {
          console.warn('Unknown month in date:', dateStr);
          return null;
        }
        
        const yearStr = parts[2].trim();
        let fullYear;
        
        // Check if year is 4 digits
        if (yearStr.length === 4) {
          fullYear = parseInt(yearStr, 10);
        } else {
          // 2-digit year: assume years < 50 are 20XX, >= 50 are 19XX
          const year = parseInt(yearStr, 10);
          if (isNaN(year)) {
            console.warn('Invalid year in date:', dateStr);
            return null;
          }
          fullYear = year < 50 ? 2000 + year : 1900 + year;
          
          // Debug logging for date parsing
          if (yearStr === '25' || yearStr === '24') {
            console.log('📅 Date parsing:', {
              originalDate: dateStr,
              yearStr,
              parsedYear: year,
              fullYear,
              rule: year < 50 ? '2000 + year' : '1900 + year'
            });
          }
        }
        
        const month = String(monthIndex + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        
        return `${fullYear}-${month}-${dayStr}`;
      }
    } catch (error) {
      console.warn('Error parsing date:', dateStr, error);
    }
    
    return null;
  };

  // Helper function to fetch booksfrom date
  const fetchBooksFromDate = async (companyGuid, companyTallylocId = null) => {
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
        // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
        const company = connections.find(c =>
          c.guid === companyGuid &&
          (companyTallylocId ? String(c.tallyloc_id) === String(companyTallylocId) : true)
        );
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

  const getDefaultDateRange = useCallback(async (companyGuid = null, companyTallylocId = null) => {
    const now = new Date();
    const formatDate = (date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    
    // Try to get booksfrom date
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to start of month
    
    if (companyGuid) {
      const booksFrom = await fetchBooksFromDate(companyGuid, companyTallylocId);
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
      
      // Update cache state
      setHasCacheData(hasCachedSalesData);
      
      // Check for interrupted downloads
      let hasInterruptedDownload = false;
      try {
        const companyProgress = await cacheSyncManager.getCompanyProgress(companyInfo);
        if (companyProgress && companyProgress.total > 0 && companyProgress.current < companyProgress.total) {
          hasInterruptedDownload = true;
          console.log('⚠️ Interrupted download detected:', companyProgress);
        }
      } catch (err) {
        console.warn('Unable to check for interrupted downloads:', err);
      }
      setIsInterrupted(hasInterruptedDownload);

      // Set default dates using booksfrom date
      const defaults = await getDefaultDateRange(companyInfo.guid, companyInfo.tallyloc_id);
      console.log('📅 Setting default date range:', defaults);
      setFromDate(defaults.start);
      setToDate(defaults.end);
      setDateRange(defaults);
      
      // Also update booksFromDate state for calendar modal
      const booksFrom = await fetchBooksFromDate(companyInfo.guid, companyInfo.tallyloc_id);
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
      
      // Check if cache exists and load data accordingly (NO auto-update - user must click refresh)
      if (!hasCachedSalesData) {
        console.log('📭 No sales cache found - user must click refresh button to download data');
        // Do NOT auto-start download - user must explicitly click refresh button
        // This ensures user has control over when updates happen
      } else if (hasCachedSalesData) {
        // Auto-load data from cache when tab opens (NO automatic update)
        console.log('🚀 Loading data from cache...');
        console.log('📅 Auto-load will use dates:', defaults);
        // Use setTimeout to ensure dates are set in state before triggering auto-load
        setTimeout(() => {
          console.log('✅ Triggering auto-load with dates:', defaults);
          setShouldAutoLoad(true);
        }, 100);
        // Note: Automatic update completely disabled - user must click refresh button to update cache
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
          if (!voucherDate) {
            console.warn('⚠️ Voucher missing date:', voucher);
            return false;
          }
          
          // Parse date - handle different formats using existing helper function
          let dateStr = parseDateFromNewFormat(voucherDate);
          if (!dateStr && typeof voucherDate === 'string') {
            // Try parsing YYYYMMDD format
            if (/^\d{8}$/.test(voucherDate)) {
              dateStr = parseDateFromAPI(voucherDate);
            } else {
              // If still not parsed, try to use as-is if it's already in YYYY-MM-DD format
              if (/^\d{4}-\d{2}-\d{2}$/.test(voucherDate)) {
              dateStr = voucherDate;
              } else {
                console.warn('⚠️ Unable to parse voucher date:', voucherDate, 'from voucher:', voucher);
              }
            }
          }
          
          if (!dateStr) {
            console.warn('⚠️ No date string after parsing:', voucherDate);
            return false;
          }
          
          // Ensure dateStr is in YYYY-MM-DD format for comparison
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            console.warn('⚠️ Date not in YYYY-MM-DD format:', dateStr, 'from original:', voucherDate);
            return false;
          }
          
          const inRange = dateStr >= startDate && dateStr <= endDate;
          
          // Enhanced debugging for first few vouchers
          if (completeCache.data.vouchers.indexOf(voucher) < 10) {
            console.log('📅 Date parsing debug:', {
              originalVoucherDate: voucherDate,
              parsedDate: dateStr,
              startDate,
              endDate,
              inRange,
              comparison: `${dateStr} >= ${startDate} && ${dateStr} <= ${endDate}`
            });
          }
          
          return inRange;
        });
        
        // Log sample dates from first few vouchers to understand date formats
        const sampleDates = completeCache.data.vouchers.slice(0, 10).map(v => ({
          original: v.cp_date || v.date || v.DATE || v.CP_DATE,
          parsed: parseDateFromNewFormat(v.cp_date || v.date || v.DATE || v.CP_DATE)
        }));
        
        console.log(`✅ Filtered ${filteredVouchers.length} vouchers from complete cache for date range ${startDate} to ${endDate}`, {
          totalVouchers: completeCache.data.vouchers.length,
          filteredCount: filteredVouchers.length,
          startDate,
          endDate,
          sampleDates,
          sampleFilteredVoucher: filteredVouchers[0],
          sampleOriginalVoucher: completeCache.data.vouchers[0]
        });
        
        // If no vouchers match the date range, check if we should return all cached data
        // or return empty (current behavior - return empty to maintain date filtering)
        if (filteredVouchers.length === 0 && completeCache.data.vouchers.length > 0) {
          // Find the actual date range in cache
          const cacheDates = completeCache.data.vouchers
            .map(v => {
              const d = v.cp_date || v.date || v.DATE || v.CP_DATE;
              return d ? parseDateFromNewFormat(d) : null;
            })
            .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort();
          
          const cacheStartDate = cacheDates[0];
          const cacheEndDate = cacheDates[cacheDates.length - 1];
          
          console.warn(`⚠️ No vouchers found in cache for date range ${startDate} to ${endDate}. Cache contains data from ${cacheStartDate} to ${cacheEndDate}. Returning empty result.`);
        }
        
        // Return filtered data from cache with timestamp - don't proceed to API calls
        return {
          data: {
            ...completeCache.data,
            vouchers: filteredVouchers
          },
          cacheTimestamp: completeCache.metadata?.timestamp || null
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
          const merged = mergeCachedData(cached);
          return { data: merged, cacheTimestamp: null };
        }
        
        // Some data is missing, but we're not calling API - use only cached data
        console.log(`📊 Partial cache: ${cached.length} cached range(s), ${gaps.length} gap(s) missing (not fetching from API)`);
        console.log(`⚠️ Missing gaps: ${gaps.map(g => `${g.startDate} to ${g.endDate}`).join(', ')}`);
        
        // Return only cached data without fetching gaps
        const merged = mergeCachedData(cached);
        console.log(`✅ Returning ${merged.vouchers?.length || 0} vouchers from cached ranges only`);
        return { data: merged, cacheTimestamp: null };
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
        data: {
          ...completeCache.data,
          vouchers: filteredVouchers
        },
        cacheTimestamp: completeCache.metadata?.timestamp || null
      };
    }
    
    console.log(`⚠️ No cache found for ${startDate} to ${endDate}. Complete cache not available.`);
    console.log(`⚠️ Skipping API call as requested - please download complete data first from Cache Management.`);
    
    // Return empty data instead of calling API
    return { data: { vouchers: [] }, cacheTimestamp: null };
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

  // Check for interrupted downloads on mount and company change
  useEffect(() => {
    const checkForInterruptedDownload = async () => {
      try {
        const companyInfo = getCompanyInfo();
        if (!companyInfo) return;

        const interrupted = await checkInterruptedDownload(companyInfo);
        if (interrupted) {
          // Create a unique key for this interruption
          const interruptionKey = `${interrupted.companyGuid}_${interrupted.current}_${interrupted.total}`;
          
          // Only show modal if this specific interruption hasn't been dismissed
          if (!dismissedInterruptionsRef.current.has(interruptionKey)) {
            setInterruptedProgress(interrupted);
            setShowResumeModal(true);
          }
        }
      } catch (error) {
        console.warn('Error checking for interrupted download:', error);
      }
    };

    // Check after a short delay to ensure company info is loaded
    const timer = setTimeout(checkForInterruptedDownload, 1000);
    return () => clearTimeout(timer);
  }, []); // Run on mount

  // Also check when company changes
  useEffect(() => {
    const handleCompanyChange = async () => {
      try {
        const companyInfo = getCompanyInfo();
        if (!companyInfo) return;

        const interrupted = await checkInterruptedDownload(companyInfo);
        if (interrupted) {
          // Create a unique key for this interruption
          const interruptionKey = `${interrupted.companyGuid}_${interrupted.current}_${interrupted.total}`;
          
          // Only show modal if this specific interruption hasn't been dismissed
          if (!dismissedInterruptionsRef.current.has(interruptionKey)) {
            setInterruptedProgress(interrupted);
            setShowResumeModal(true);
          }
        } else {
          setShowResumeModal(false);
          setInterruptedProgress(null);
        }
      } catch (error) {
        console.warn('Error checking for interrupted download:', error);
      }
    };

    window.addEventListener('companyChanged', handleCompanyChange);
    return () => window.removeEventListener('companyChanged', handleCompanyChange);
  }, []);

  // Auto-update removed - user must click refresh button to update cache
  // useEffect(() => {
  //   const autoUpdateInterval = setInterval(async () => {
  //     try {
  //       const companyInfo = getCompanyInfo();
  //       // Check if cache exists
  //       const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
  //       if (completeCache && completeCache.data && completeCache.data.vouchers && completeCache.data.vouchers.length > 0) {
  //         console.log('⏰ Auto-update: Checking for new sales data...');
  //         // Only start update if not already downloading
  //         if (!isDownloadingCache) {
  //           startBackgroundCacheDownload(companyInfo, true);
  //         }
  //       }
  //     } catch (err) {
  //       console.warn('⚠️ Auto-update check failed:', err);
  //     }
  //   }, 30 * 60 * 1000); // 30 minutes in milliseconds

  //   return () => clearInterval(autoUpdateInterval);
  // }, [isDownloadingCache]);

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
      const saleYear = date.getFullYear();
      const saleMonth = date.getMonth() + 1; // 1-12
      
      // Handle period matching - support month format (YYYY-MM), quarter format (Q1-YYYY), and year format (YYYY)
      let periodMatch = true;
      if (selectedPeriod) {
        // Check if selectedPeriod is a quarter format (Q1-2024, Q2-2024, etc.)
        const quarterMatch = selectedPeriod.match(/^Q(\d)-(\d{4})$/);
        if (quarterMatch) {
          const selectedQuarter = parseInt(quarterMatch[1]);
          const selectedYear = parseInt(quarterMatch[2]);
          
          // Check if sale's month falls within the selected quarter
          const quarterMonths = {
            1: [1, 2, 3],   // Q1: Jan, Feb, Mar
            2: [4, 5, 6],   // Q2: Apr, May, Jun
            3: [7, 8, 9],   // Q3: Jul, Aug, Sep
            4: [10, 11, 12] // Q4: Oct, Nov, Dec
          };
          
          periodMatch = saleYear === selectedYear && 
                       quarterMonths[selectedQuarter]?.includes(saleMonth);
        } else if (/^\d{4}$/.test(selectedPeriod)) {
          // Year-only format (YYYY) - match all sales in that year
          periodMatch = saleYear === parseInt(selectedPeriod);
        } else {
          // Regular month format matching (YYYY-MM)
          periodMatch = salePeriod === selectedPeriod;
        }
      }
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
      console.log('📥 Date range format check:', {
        startDate,
        endDate,
        startDateType: typeof startDate,
        endDateType: typeof endDate,
        startDateMatch: /^\d{4}-\d{2}-\d{2}$/.test(startDate),
        endDateMatch: /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      });
      const response = await fetchSalesData(startDate, endDate);
      console.log('📦 Response from fetchSalesData:', {
        hasResponse: !!response,
        hasData: !!response?.data,
        voucherCount: response?.data?.vouchers?.length || 0,
        cacheTimestamp: response?.cacheTimestamp,
        sampleVoucher: response?.data?.vouchers?.[0],
        sampleVoucherDate: response?.data?.vouchers?.[0]?.cp_date || response?.data?.vouchers?.[0]?.date || response?.data?.vouchers?.[0]?.DATE || response?.data?.vouchers?.[0]?.CP_DATE
      });
      
      // Handle both old format (direct data) and new format (wrapped with data and cacheTimestamp)
      const responseData = response?.data || response;
      const cacheTimestamp = response?.cacheTimestamp;
      
      const allVouchers = [];
      if (responseData?.vouchers && Array.isArray(responseData.vouchers)) {
        allVouchers.push(...responseData.vouchers);
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
      
      // Filter vouchers to only include sales-related vouchers (support both old and new field names)
      // Only include vouchers where:
      // 1. reservedname = "Sales" or "Credit Note"
      // 2. isoptional = "No"
      // 3. iscancelled = "No"
      // 4. Must have at least one ledger entry with ispartyledger = "Yes"
      const salesVouchers = allVouchers.filter(voucher => {
        const reservedname = (voucher.reservedname || '').toLowerCase().trim();
        const isoptional = (voucher.isoptional || voucher.isOptional || '').toString().toLowerCase().trim();
        const iscancelled = (voucher.iscancelled || voucher.isCancelled || '').toString().toLowerCase().trim();
        
        // Check reservedname is "Sales" or "Credit Note"
        const reservednameMatch = reservedname === 'sales' || reservedname === 'credit note';
        
        // Check isoptional is "No"
        const isoptionalMatch = isoptional === 'no';
        
        // Check iscancelled is "No"
        const iscancelledMatch = iscancelled === 'no';
        
        // Check if voucher has at least one ledger entry with ispartyledger = "Yes"
        const ledgerEntries = voucher.ledgerentries || voucher.ledgers || [];
        const hasPartyLedger = Array.isArray(ledgerEntries) && ledgerEntries.some(ledger => {
          const ispartyledger = (ledger.ispartyledger || ledger.isPartyLedger || '').toString().toLowerCase().trim();
          return ispartyledger === 'yes';
        });
        
        return reservednameMatch && isoptionalMatch && iscancelledMatch && hasPartyLedger;
      });
      
      console.log('📊 Filtered sales vouchers:', {
        totalVouchers: allVouchers.length,
        salesVouchers: salesVouchers.length,
        nonSalesVouchers: allVouchers.length - salesVouchers.length,
        filterCriteria: {
          reservedname: 'Sales or Credit Note',
          isoptional: 'No',
          iscancelled: 'No',
          ispartyledger: 'Yes (in ledger entries)'
        }
      });
      
      // Extract salesperson from voucher (if available) or use formula
      const extractSalesperson = (voucher) => {
        // Helper to try pulling salesperson using the configured formula (if provided)
        // We don't evaluate the TDL formula here; instead we try to map the formula token
        // to a field on the voucher (best-effort fallback).
        const getFormulaFieldValue = () => {
          if (!salespersonFormula) return null;

          // Try to extract the last alphanumeric/underscore token from the formula
          // Example formulas we might see:
          //   $$VCHBILLITCSalesPerson       -> token: VCHBILLITCSalesPerson
          //   $MyCustomSalesPersonField     -> token: MyCustomSalesPersonField
          //   ##SomeVar                     -> token: SomeVar
          // We keep it simple and just pick the last "word" token.
          const tokenMatch = salespersonFormula.match(/([A-Za-z0-9_]+)$/);
          const token = tokenMatch ? tokenMatch[1] : null;
          if (!token) return null;

          // Try direct, lower, upper and case-insensitive key match on the voucher
          const possibleKeys = [
            token,
            token.toLowerCase(),
            token.toUpperCase()
          ];

          // Also try matching by case-insensitive search across voucher keys
          const voucherKeys = Object.keys(voucher || {});
          const matchingKey = voucherKeys.find(k => k.toLowerCase() === token.toLowerCase());

          const keyToUse = matchingKey || possibleKeys.find(k => voucher && voucher[k] !== undefined);
          if (!keyToUse) return null;

          const val = voucher[keyToUse];
          if (val === undefined || val === null || val === '') return null;
          return String(val).trim();
        };

        const formulaSalesperson = getFormulaFieldValue();

        return formulaSalesperson ||
               voucher.salesprsn || voucher.SalesPrsn || voucher.SALESPRSN ||
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
        
        // Extract tax information from ledgers (support both old and new field names)
        // Also extract ledger group from ledger entries where ispartyledger = "Yes"
        const ledgerEntries = voucher.ledgerentries || voucher.ledgers || [];
        let voucherLedgerGroup = 'Other'; // Default ledger group for the voucher
        if (Array.isArray(ledgerEntries)) {
          ledgerEntries.forEach(ledger => {
            const ledgerName = (ledger.ledgername || ledger.ledger || '').toLowerCase();
            const ledgerAmt = parseAmount(ledger.amount || ledger.amt);
            
            // Extract ledger group from ledger entries where ispartyledger = "Yes"
            const ispartyledger = (ledger.ispartyledger || ledger.isPartyLedger || '').toString().toLowerCase().trim();
            if (ispartyledger === 'yes' && ledger.group) {
              voucherLedgerGroup = ledger.group;
            }
            
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
        
        // Calculate total sales amount from inventory items (support both old and new field names)
        const inventoryEntries = voucher.allinventoryentries || voucher.inventry || [];
        if (Array.isArray(inventoryEntries)) {
          inventoryEntries.forEach(inventoryItem => {
            const itemAmount = parseAmount(inventoryItem.amount || inventoryItem.amt);
            totalSalesAmount += itemAmount;
          });
        }
        
        // Process inventory items directly from voucher (support both old and new field names)
        const inventoryItems = voucher.allinventoryentries || voucher.inventry || [];
        if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
          inventoryItems.forEach((inventoryItem) => {
            // Parse quantity
            const parseQuantity = (qtyStr) => {
              if (!qtyStr) return 0;
              const cleaned = String(qtyStr).replace(/,/g, '');
              return parseInt(cleaned, 10) || 0;
            };
            
            const itemAmount = parseAmount(inventoryItem.amount || inventoryItem.amt);
            // Calculate proportional taxes based on item amount vs total sales amount
            const taxRatio = totalSalesAmount > 0 ? itemAmount / totalSalesAmount : 0;
            const itemCgst = totalCgst * taxRatio;
            const itemSgst = totalSgst * taxRatio;
            const itemRoundoff = totalRoundoff * taxRatio;
            
            // Get ledger group from ledger entries where ispartyledger = "Yes" (preferred)
            // Fallback to accalloc (account allocation) if ledger group not found in ledger entries
            let ledgerGroup = voucherLedgerGroup; // Use the ledger group extracted from ledger entries
            if (ledgerGroup === 'Other' && inventoryItem.accalloc && Array.isArray(inventoryItem.accalloc) && inventoryItem.accalloc.length > 0) {
              const accountAlloc = inventoryItem.accalloc[0]; // Usually first allocation
              ledgerGroup = accountAlloc.ledgergroupidentify || accountAlloc.group || accountAlloc.grouplist?.split('|')[0] || 'Other';
            }
            
            // Support both old and new field names for category/stock group
            const stockGroup = inventoryItem.stockitemgroup || inventoryItem.group || inventoryItem.stockitemgrouplist?.split('|')[0] || inventoryItem.grouplist?.split('|')[0] || 'Other';
            const stockCategory = inventoryItem.stockitemcategory || inventoryItem.stockitemcategorylist?.split('|')[0] || stockGroup;
            
            const saleRecord = {
              // Item-level fields (support both old and new field names)
              category: stockCategory,
              item: inventoryItem.stockitemname || inventoryItem.item || 'Unknown',
              quantity: parseQuantity(inventoryItem.billedqty || inventoryItem.qty || inventoryItem.actualqty),
              amount: itemAmount,
              profit: parseAmount(inventoryItem.profit) || 0,
              
              // Voucher-level fields (support both old and new field names)
              customer: voucher.partyledgername || voucher.party || 'Unknown',
              date: voucherDate,
              cp_date: voucherDate, // Use same date for cp_date
              vchno: voucher.vouchernumber || voucher.vchno || '',
              masterid: voucher.masterid || voucher.mstid || '',
              region: voucherState,
              country: voucherCountry,
              salesperson: voucherSalesperson,
              
              // Ledger-level fields (from accalloc)
              ledgerGroup: ledgerGroup,
              
              // Tax information (proportionally distributed)
              cgst: itemCgst,
              sgst: itemSgst,
              roundoff: itemRoundoff,
              
              // Additional voucher fields (support both old and new field names)
              alterid: voucher.alterid,
              partyid: voucher.partyledgernameid || voucher.partyid,
              gstno: voucher.partygstin || voucher.gstno || '',
              pincode: voucher.pincode || '',
              reference: voucher.reference || '',
              vchtype: voucher.vouchertypename || voucher.vchtype || '',
              
              // Additional inventory fields (support both old and new field names)
              itemid: inventoryItem.stockitemnameid || inventoryItem.itemid || '',
              uom: inventoryItem.uom || '',
              grosscost: parseAmount(inventoryItem.grosscost) || 0,
              grossexpense: parseAmount(inventoryItem.grossexpense) || 0,
              
              // Mark as sales
              issales: true,
              
              // Include all other fields from voucher for custom card creation
              ...Object.keys(voucher).reduce((acc, key) => {
                // Only add fields that aren't already mapped above (support both old and new field names)
                const mappedKeys = ['mstid', 'masterid', 'alterid', 'vchno', 'vouchernumber', 'date', 'party', 'partyledgername', 'partyid', 'partyledgernameid', 'state', 'country', 'amt', 'amount', 'vchtype', 'vouchertypename', 'reservedname', 'gstno', 'partygstin', 'pincode', 'reference', 'ledgers', 'ledgerentries', 'inventry', 'allinventoryentries', 'salesprsn', 'SalesPrsn', 'SALESPRSN', 'salesperson', 'SalesPerson', 'salespersonname', 'SalesPersonName', 'sales_person', 'SALES_PERSON', 'sales_person_name', 'SALES_PERSON_NAME', 'SALESPERSONNAME'];
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
      
      // Use cache timestamp if available, otherwise use current time
      if (cacheTimestamp) {
        console.log('📅 Using cache timestamp:', new Date(cacheTimestamp));
        setLastUpdated(new Date(cacheTimestamp));
      } else {
        console.log('📅 No cache timestamp found, using current time');
        setLastUpdated(new Date());
      }
      
      console.log('✅ Sales data loaded successfully. Total records:', transformedSales.length);
      setDateRange({ start: startDate, end: endDate });
      setFromDate(startDate);
      setToDate(endDate);
      // Reset salespersons initialization when new data is loaded
      salespersonsInitializedRef.current = false;
      
      // Update cache state if data was loaded from cache
      if (!invalidateCache) {
        try {
          const companyInfo = getCompanyInfo();
          const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
          if (completeCache && completeCache.data && completeCache.data.vouchers && completeCache.data.vouchers.length > 0) {
            setHasCacheData(true);
            setIsInterrupted(false);
          }
        } catch (err) {
          console.warn('Unable to update cache state after loading:', err);
        }
      }

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

  const handleRefresh = async () => {
    if (!fromDate || !toDate) {
      console.warn('Cannot refresh: date range not set');
      return;
    }

    try {
      // Get company info for cache update
      const companyInfo = getCompanyInfo();
      
      // Check if cache download is already in progress
      if (isDownloadingCache) {
        console.log('⚠️ Cache update already in progress, please wait...');
        return;
      }
      
      // Determine if this is a new download, interrupted download, or update
      let isUpdate = hasCacheData;
      if (isInterrupted) {
        console.log('🔄 Resuming interrupted download...');
        isUpdate = true; // Resume is treated as update
      } else if (!hasCacheData) {
        console.log('📥 Starting new download...');
        isUpdate = false;
      } else {
        console.log('🔄 Refresh button clicked - starting cache update...');
        isUpdate = true;
      }
      
      // Update cache from server (runs in background and auto-reloads data after completion)
      // The startBackgroundCacheDownload function will:
      // 1. Sync cache data from server
      // 2. Automatically reload sales data after cache update completes
      startBackgroundCacheDownload(companyInfo, isUpdate);
    } catch (error) {
      console.error('❌ Error during refresh:', error);
      // If we can't get company info or start cache update, fallback to reloading from existing cache
      if (fromDate && toDate) {
        loadSales(fromDate, toDate, { invalidateCache: false });
      }
    }
  };

  // Resume modal handlers
  const handleResumeContinue = async () => {
    setShowResumeModal(false);
    const companyInfo = getCompanyInfo();
    if (companyInfo) {
      // Continue from where it left off - progress is already saved, sync will resume automatically
      await startBackgroundCacheDownload(companyInfo, false);
    }
  };

  const handleResumeStartFresh = async () => {
    setShowResumeModal(false);
    const companyInfo = getCompanyInfo();
    if (companyInfo) {
      // Clear progress and start fresh
      await clearDownloadProgress(companyInfo);
      // Pass startFresh flag to ensure we don't resume from saved progress
      await startBackgroundCacheDownload(companyInfo, false, true);
    }
    setInterruptedProgress(null);
  };

  // Background cache download function
  const startBackgroundCacheDownload = async (companyInfo, isUpdate = false, startFresh = false) => {
    if (isDownloadingCache || cacheDownloadAbortRef.current) return;

    setIsDownloadingCache(true);
    const startTime = Date.now();
    setCacheDownloadStartTime(startTime); // Track start time for ETA calculation
    cacheDownloadStartTimeRef.current = startTime; // Also store in ref for use in callbacks
    setCacheDownloadProgress({ current: 0, total: 0, message: isUpdate ? 'Checking for updates...' : 'Downloading cache...' });
    cacheDownloadAbortRef.current = false;

    try {
      console.log(`🔄 Starting background cache ${isUpdate ? 'update' : 'download'}...${startFresh ? ' (starting fresh)' : ''}`);
      
      await syncSalesData(companyInfo, (progress) => {
        // Only update progress if not aborted
        if (!cacheDownloadAbortRef.current) {
          // Force immediate state update for real-time progress
          console.log('📊 Progress update:', progress);
          setCacheDownloadProgress(progress);
        }
      }, startFresh);

      // Check if download was aborted
      if (cacheDownloadAbortRef.current) {
        console.log('⚠️ Cache download was aborted');
        return;
      }

      console.log(`✅ Background cache ${isUpdate ? 'update' : 'download'} completed!`);
      
      // Update cache state after successful download
      try {
        const companyInfo = getCompanyInfo();
        const completeCache = await hybridCache.getCompleteSalesData(companyInfo);
        if (completeCache && completeCache.data && completeCache.data.vouchers && completeCache.data.vouchers.length > 0) {
          setHasCacheData(true);
          setIsInterrupted(false);
        }
      } catch (err) {
        console.warn('Unable to update cache state after download:', err);
      }
      
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
      setCacheDownloadStartTime(null); // Clear start time when done
      cacheDownloadStartTimeRef.current = null; // Also clear ref
    }
  };

  // Helper function to format date for input display (YYYY-MM-DD to DD-MMM-YY)
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Try parsing with parseDateFromNewFormat if it's already in DD-MMM-YY format
        const parsed = parseDateFromNewFormat(dateStr);
        if (parsed) {
          const dateObj = new Date(parsed);
          if (!isNaN(dateObj.getTime())) {
            const day = String(dateObj.getDate());
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = monthNames[dateObj.getMonth()];
            const year = String(dateObj.getFullYear()).slice(-2);
            return `${day}-${month}-${year}`;
          }
        }
        return dateStr; // Return as-is if can't parse
      }
      const day = String(date.getDate());
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = String(date.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Helper function to convert YYYY-MM-DD string to Date object
  const stringToDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Helper function to convert Date object to YYYY-MM-DD string
  const dateToString = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Period calculation functions
  const getFinancialYearStartToDate = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)
    
    // Financial year starts April 1st
    let financialYearStart;
    if (currentMonth >= 3) { // April (3) to December (11)
      financialYearStart = new Date(currentYear, 3, 1); // April 1st of current year
    } else { // January (0) to March (2)
      financialYearStart = new Date(currentYear - 1, 3, 1); // April 1st of previous year
    }
    
    return {
      start: dateToString(financialYearStart),
      end: dateToString(today)
    };
  };

  const getQuarterStartToDate = () => {
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-indexed
    const currentYear = today.getFullYear();
    
    // Determine quarter start month
    let quarterStartMonth;
    if (currentMonth >= 0 && currentMonth <= 2) { // Q1: Jan-Mar
      quarterStartMonth = 0; // January
    } else if (currentMonth >= 3 && currentMonth <= 5) { // Q2: Apr-Jun
      quarterStartMonth = 3; // April
    } else if (currentMonth >= 6 && currentMonth <= 8) { // Q3: Jul-Sep
      quarterStartMonth = 6; // July
    } else { // Q4: Oct-Dec
      quarterStartMonth = 9; // October
    }
    
    const quarterStart = new Date(currentYear, quarterStartMonth, 1);
    return {
      start: dateToString(quarterStart),
      end: dateToString(today)
    };
  };

  const getMonthStartToDate = () => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      start: dateToString(monthStart),
      end: dateToString(today)
    };
  };

  const getToday = () => {
    const today = new Date();
    const todayStr = dateToString(today);
    return {
      start: todayStr,
      end: todayStr
    };
  };

  const getYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = dateToString(yesterday);
    return {
      start: yesterdayStr,
      end: yesterdayStr
    };
  };

  const getWeekStartToDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0 days, Sunday = 6 days
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToSubtract);
    return {
      start: dateToString(weekStart),
      end: dateToString(today)
    };
  };

  const handlePeriodSelection = (periodType) => {
    setSelectedPeriodType(periodType);
    
    if (periodType === 'custom') {
      // Keep existing dates for custom period
      setTempFromDate(fromDate);
      setTempToDate(toDate);
      setTempFromDateDisplay(formatDateForInput(fromDate));
      setTempToDateDisplay(formatDateForInput(toDate));
    } else {
      let periodDates;
      switch (periodType) {
        case 'financial-year':
          periodDates = getFinancialYearStartToDate();
          break;
        case 'quarter':
          periodDates = getQuarterStartToDate();
          break;
        case 'month':
          periodDates = getMonthStartToDate();
          break;
        case 'today':
          periodDates = getToday();
          break;
        case 'yesterday':
          periodDates = getYesterday();
          break;
        case 'week':
          periodDates = getWeekStartToDate();
          break;
        default:
          return;
      }
      
      setTempFromDate(periodDates.start);
      setTempToDate(periodDates.end);
      setTempFromDateDisplay(formatDateForInput(periodDates.start));
      setTempToDateDisplay(formatDateForInput(periodDates.end));
    }
  };

  // Calendar modal handlers
  const handleOpenCalendar = () => {
    setSelectedPeriodType(null); // Reset period selection
    setTempFromDate(fromDate);
    setTempToDate(toDate);
    // Format dates for display in input fields
    setTempFromDateDisplay(formatDateForInput(fromDate));
    setTempToDateDisplay(formatDateForInput(toDate));
    setShowCalendarModal(true);
    setShowFromDatePicker(false);
    setShowToDatePicker(false);
  };

  // Handle date selection from calendar picker
  const handleFromDateChange = (date) => {
    if (date && !isNaN(date.getTime())) {
      const dateStr = dateToString(date);
      setTempFromDate(dateStr);
      setTempFromDateDisplay(formatDateForInput(dateStr));
      setShowFromDatePicker(false);
    }
  };

  const handleToDateChange = (date) => {
    if (date && !isNaN(date.getTime())) {
      const dateStr = dateToString(date);
      setTempToDate(dateStr);
      setTempToDateDisplay(formatDateForInput(dateStr));
      setShowToDatePicker(false);
    }
  };

  const handleApplyDates = () => {
    let parsedFromDate, parsedToDate;
    
    // If a period type is selected (not custom), use the calculated dates
    if (selectedPeriodType && selectedPeriodType !== 'custom') {
      let periodDates;
      switch (selectedPeriodType) {
        case 'financial-year':
          periodDates = getFinancialYearStartToDate();
          break;
        case 'quarter':
          periodDates = getQuarterStartToDate();
          break;
        case 'month':
          periodDates = getMonthStartToDate();
          break;
        case 'today':
          periodDates = getToday();
          break;
        case 'yesterday':
          periodDates = getYesterday();
          break;
        case 'week':
          periodDates = getWeekStartToDate();
          break;
        default:
          // Fallback to parsing display format
          parsedFromDate = parseDateFromNewFormat(tempFromDateDisplay) || tempFromDateDisplay;
          parsedToDate = parseDateFromNewFormat(tempToDateDisplay) || tempToDateDisplay;
      }
      
      if (periodDates) {
        parsedFromDate = periodDates.start;
        parsedToDate = periodDates.end;
      }
    } else {
      // Parse the display format back to YYYY-MM-DD for custom period
      parsedFromDate = parseDateFromNewFormat(tempFromDateDisplay) || tempFromDateDisplay;
      parsedToDate = parseDateFromNewFormat(tempToDateDisplay) || tempToDateDisplay;
    }
    
    // Validate that dates are in YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedFromDate)) {
      alert('Invalid From Date format. Please use format like "1-Apr-25" or "15-Jan-24"');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedToDate)) {
      alert('Invalid To Date format. Please use format like "1-Apr-25" or "15-Jan-24"');
      return;
    }
    
    setFromDate(parsedFromDate);
    setToDate(parsedToDate);
    setTempFromDate(parsedFromDate);
    setTempToDate(parsedToDate);
    setShowCalendarModal(false);
    setSelectedPeriodType(null);
    // Directly submit the form
    loadSales(parsedFromDate, parsedToDate, { invalidateCache: true });
  };

  const handleCancelDates = () => {
    setShowCalendarModal(false);
    setSelectedPeriodType(null);
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

  // Helper function to get date from sale
  const getSaleDate = (sale) => {
    const dateStr = sale.cp_date || sale.date;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Helper function to format date as YYYY-MM-DD for grouping
  const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate daily trend data for Total Revenue
  const revenueTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSales.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const current = dailyData.get(dateKey) || 0;
      dailyData.set(dateKey, current + (sale.amount || 0));
    });
    
    // Convert to array and sort by date
    const sortedData = Array.from(dailyData.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Ensure we have at least a few data points for visualization
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSales]);

  // Calculate daily trend data for Total Invoices
  const invoiceTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSalesForOrders.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const orderSet = dailyData.get(dateKey) || new Set();
      orderSet.add(sale.masterid);
      dailyData.set(dateKey, orderSet);
    });
    
    // Convert to array and sort by date
    const sortedData = Array.from(dailyData.entries())
      .map(([date, orderSet]) => ({ date, value: orderSet.size }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSalesForOrders]);

  // Calculate daily trend data for Unique Customers (cumulative unique customers per day)
  const customerTrendData = useMemo(() => {
    const dailyData = new Map();
    const seenCustomers = new Set();
    
    // Sort sales by date first
    const sortedSales = [...filteredSales].sort((a, b) => {
      const dateA = getSaleDate(a);
      const dateB = getSaleDate(b);
      if (!dateA || !dateB) return 0;
      return dateA - dateB;
    });
    
    sortedSales.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date || !sale.customer) return;
      
      const dateKey = formatDateKey(date);
      if (!seenCustomers.has(sale.customer)) {
        seenCustomers.add(sale.customer);
        const current = dailyData.get(dateKey) || 0;
        dailyData.set(dateKey, current + 1);
      }
    });
    
    // Convert to cumulative counts
    let cumulative = 0;
    const sortedData = Array.from(dailyData.entries())
      .map(([date, newCustomers]) => {
        cumulative += newCustomers;
        return { date, value: cumulative };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSales]);

  // Calculate daily trend data for Avg Invoice Value
  const avgInvoiceTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSalesForOrders.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const existing = dailyData.get(dateKey) || { total: 0, count: 0 };
      existing.total += (sale.amount || 0);
      existing.count += 1;
      dailyData.set(dateKey, existing);
    });
    
    // Convert to array with averages
    const sortedData = Array.from(dailyData.entries())
      .map(([date, { total, count }]) => ({ 
        date, 
        value: count > 0 ? total / count : 0 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSalesForOrders]);

  // Calculate daily trend data for Total Profit
  const profitTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSales.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const current = dailyData.get(dateKey) || 0;
      dailyData.set(dateKey, current + (sale.profit || 0));
    });
    
    const sortedData = Array.from(dailyData.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSales]);

  // Calculate daily trend data for Profit Margin
  const profitMarginTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSales.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const existing = dailyData.get(dateKey) || { revenue: 0, profit: 0 };
      existing.revenue += (sale.amount || 0);
      existing.profit += (sale.profit || 0);
      dailyData.set(dateKey, existing);
    });
    
    // Convert to array with profit margins
    const sortedData = Array.from(dailyData.entries())
      .map(([date, { revenue, profit }]) => ({ 
        date, 
        value: revenue > 0 ? (profit / revenue) * 100 : 0 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSales]);

  // Calculate daily trend data for Avg Profit per Order
  const avgProfitTrendData = useMemo(() => {
    const dailyData = new Map();
    
    filteredSalesForOrders.forEach(sale => {
      const date = getSaleDate(sale);
      if (!date) return;
      
      const dateKey = formatDateKey(date);
      const existing = dailyData.get(dateKey) || { totalProfit: 0, count: 0 };
      existing.totalProfit += (sale.profit || 0);
      existing.count += 1;
      dailyData.set(dateKey, existing);
    });
    
    // Convert to array with averages
    const sortedData = Array.from(dailyData.entries())
      .map(([date, { totalProfit, count }]) => ({ 
        date, 
        value: count > 0 ? totalProfit / count : 0 
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    if (sortedData.length === 0) {
      return [{ date: new Date().toISOString().split('T')[0], value: 0 }];
    }
    
    return sortedData;
  }, [filteredSalesForOrders]);

  // Function to get all card titles organized by sections
  const getCardTitlesBySection = useCallback(() => {
    const keyMetrics = [];
    const charts = [];
    const customCardsList = [];
    
    // Key Metrics (always shown)
    keyMetrics.push('Total Revenue');
    keyMetrics.push('Total Invoices');
    keyMetrics.push('Unique Customers');
    keyMetrics.push('Avg Invoice Value');
    
    // Profit-related metrics (conditional)
    if (canShowProfit) {
      keyMetrics.push('Total Profit');
      keyMetrics.push('Profit Margin');
      keyMetrics.push('Avg Profit per Order');
    }
    
    // Charts
    charts.push('Sales by Ledger Group');
    charts.push('Salesperson Totals');
    charts.push('Sales by Stock Group');
    charts.push('Sales by State');
    charts.push('Sales by Country');
    charts.push('Sales by Period');
    charts.push('Top Customers Chart');
    charts.push('Top Items by Revenue Chart');
    charts.push('Top Items by Quantity Chart');
    
    // Profit-related charts (conditional)
    if (canShowProfit) {
      charts.push('Revenue vs Profit');
      charts.push('Top Profitable Items');
      charts.push('Top Loss Items');
      charts.push('Month-wise Profit');
    }
    
    // Custom cards
    customCards.forEach(card => {
      if (card.title) {
        customCardsList.push(card.title);
      }
    });
    
    return {
      keyMetrics,
      charts,
      customCards: customCardsList
    };
  }, [canShowProfit, customCards]);

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
    (dateRange.start !== '' && dateRange.end !== '' && dateRange.start === dateRange.end) ||
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
      'month': ['selectedPeriod'],
      'year': ['selectedPeriod'],
      'quarter': ['selectedPeriod'],
      'week': ['selectedPeriod'],
      'salesperson': ['selectedSalesperson'],
      'ledgerGroup': ['selectedLedgerGroup'],
      'topCustomers': ['selectedCustomer'],
      'topItems': ['selectedItem'],
      'custom': cardId ? [
        'selectedCustomer', 
        'selectedItem', 
        'selectedStockGroup', 
        'selectedRegion', 
        'selectedCountry', 
        'selectedPeriod', 
        'selectedLedgerGroup', 
        `generic_${cardId}`
      ] : []
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
    
    // Add period filter badge (for date, month, year, quarter, week filters)
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
    
    // Add single-day date filter badge (when dateRange.start === dateRange.end)
    if (dateRange.start !== '' && dateRange.end !== '' && dateRange.start === dateRange.end) {
      badges.push(
        <div
          key="date-filter"
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
          <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>event</span>
          {isMobile ? 'Date' : `Date: ${formatDateForDisplay(dateRange.start)}`}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDateRange({ start: '', end: '' });
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
    
    // For custom cards, show ALL active global filters (not just ones matching groupBy)
    if (cardType === 'custom' && cardId) {
      const card = customCards.find(c => c.id === cardId);
      if (card) {
        const groupBy = card.groupBy;
        const groupByLower = groupBy ? groupBy.toLowerCase() : '';
        
        // Show ALL active global filters on custom cards
        // Customer filter
        if (selectedCustomer !== 'all') {
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
        
        // Item filter
        if (selectedItem !== 'all') {
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
        
        // Stock Group filter
        if (selectedStockGroup !== 'all') {
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
        
        // Region filter
        if (selectedRegion !== 'all') {
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
        
        // Country filter
        if (selectedCountry !== 'all') {
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
        
        // Period filter (for date grouping, month, year, quarter, week)
        if ((groupBy === 'date' || groupByLower === 'month' || groupByLower === 'year' || groupByLower === 'quarter' || groupByLower === 'week') && selectedPeriod !== null) {
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
              {isMobile ? 'Period' : `Period: ${formatPeriodLabel(selectedPeriod) || 'All'}`}
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
        
        // Ledger Group filter
        if (selectedLedgerGroup !== 'all') {
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
        
        // Single-day date filter (when dateRange.start === dateRange.end)
        if (dateRange.start !== '' && dateRange.end !== '' && dateRange.start === dateRange.end) {
          badges.push(
            <div
              key="date-filter"
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
              <span className="material-icons" style={{ fontSize: isMobile ? '10px' : '12px' }}>event</span>
              {isMobile ? 'Date' : `Date: ${formatDateForDisplay(dateRange.start)}`}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDateRange({ start: '', end: '' });
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
      }
      
      // Add generic filters for custom cards (for non-standard groupBy fields)
      if (genericFilters) {
      Object.entries(genericFilters).forEach(([filterKey, filterValue]) => {
        if (filterKey.startsWith(`${cardId}_`) && filterValue && filterValue !== 'all' && filterValue !== '') {
          const fieldName = filterKey.replace(`${cardId}_`, '');
          const fieldLabel = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
          
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

  // Format number based on selected format (for non-currency values)
  const formatNumber = (value, options = {}) => {
    const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
    const defaultOptions = { minimumFractionDigits: 0, maximumFractionDigits: 2 };
    return value.toLocaleString(locale, { ...defaultOptions, ...options });
  };

  const formatCurrency = (value) => {
    const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
    return `₹${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper functions for chart components
  const formatChartValue = useCallback((value, prefix = '₹') => {
    const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
    return `${prefix}${value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [numberFormat]);

  const formatChartCompactValue = useCallback((value, prefix = '₹') => {
    if (!value || value === 0) return `${prefix}0.00`;
    const absValue = Math.abs(value);
    let formatted = '';
    let unit = '';
    
    if (numberFormat === 'indian') {
      // Indian numbering: Lakhs and Crores
      if (absValue >= 10000000) {
        formatted = `${prefix}${(absValue / 10000000).toFixed(1)}Cr`;
      } else if (absValue >= 100000) {
        formatted = `${prefix}${(absValue / 100000).toFixed(1)}L`;
      } else if (absValue >= 1000) {
        formatted = `${prefix}${(absValue / 1000).toFixed(1)}K`;
      } else {
        const locale = 'en-IN';
        formatted = `${prefix}${absValue.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
    } else {
      // International numbering: Millions and Billions
      if (absValue >= 1000000000) {
        formatted = `${prefix}${(absValue / 1000000000).toFixed(1)}B`;
      } else if (absValue >= 1000000) {
        formatted = `${prefix}${(absValue / 1000000).toFixed(1)}M`;
      } else if (absValue >= 1000) {
        formatted = `${prefix}${(absValue / 1000).toFixed(1)}K`;
      } else {
        const locale = 'en-US';
        formatted = `${prefix}${absValue.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
    }
    
    return formatted;
  }, [numberFormat]);

  // Custom Cards Helper Functions
  // Helper function to get field value with case-insensitive fallback
  const getFieldValue = useCallback((item, fieldName) => {
    if (!item || !fieldName) return null;
    
    // Handle derived fields that are computed from the date
    if (fieldName === 'month' || fieldName === 'year' || fieldName === 'quarter' || fieldName === 'week') {
      const dateValue = item.date || item.Date || item.DATE || 
                       (Object.keys(item).find(k => k.toLowerCase() === 'date') ? 
                        item[Object.keys(item).find(k => k.toLowerCase() === 'date')] : null);
      
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          if (fieldName === 'month') {
            const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthAbbr[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
          } else if (fieldName === 'year') {
            return String(date.getFullYear());
          } else if (fieldName === 'quarter') {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            return `Q${quarter} ${date.getFullYear()}`;
          } else if (fieldName === 'week') {
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            return `Week ${weekNum}, ${date.getFullYear()}`;
          }
        }
      }
      return null;
    }
    
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
    
    // Force dateGrouping to 'day' (daily) for all date-based cards
    // This ensures that even if a card has 'month' stored, it will use daily grouping
    // Create a normalized config to avoid mutating the original
    const isDateField = cardConfig.groupBy === 'date' || cardConfig.groupBy === 'cp_date' || 
                        (cardConfig.groupBy && String(cardConfig.groupBy).toLowerCase().includes('date'));
    
    if (isDateField && cardConfig.dateGrouping !== 'day') {
      console.log('📅 Forcing dateGrouping to "day" in generateCustomCardData:', {
        cardId: cardConfig.id,
        cardTitle: cardConfig.title,
        oldDateGrouping: cardConfig.dateGrouping,
        groupBy: cardConfig.groupBy
      });
      // Create a new config object with dateGrouping forced to 'day'
      cardConfig = { ...cardConfig, dateGrouping: 'day' };
    }

    // Apply filters from card config
    let filteredData = [...salesData];
    const initialCount = filteredData.length;

    // Apply custom card filters (if specified)
    // Filters can be either:
    // 1. An array of filter objects: [{ filterField: 'customer', filterValues: ['Customer1', 'Customer2'] }, ...]
    // 2. A single filter object with individual properties: { customer: 'Customer1', item: 'Item1', ... }
    if (cardConfig.filters) {
      console.log('🔍 Applying custom card filters:', {
        filters: cardConfig.filters,
        filtersType: Array.isArray(cardConfig.filters) ? 'array' : typeof cardConfig.filters,
        initialDataCount: initialCount
      });
      // Handle array of filters (new format from CustomCardModal)
      if (Array.isArray(cardConfig.filters) && cardConfig.filters.length > 0) {
        cardConfig.filters.forEach((filter, filterIndex) => {
          if (filter.filterField && filter.filterValues && filter.filterValues.length > 0) {
            const filterFieldName = filter.filterField;
            const filterValuesSet = new Set(filter.filterValues.map(v => String(v).trim().toLowerCase()));
            const beforeCount = filteredData.length;
            filteredData = filteredData.filter(s => {
              // Use case-insensitive field access
              const fieldValue = getFieldValue(s, filterFieldName);
              if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
                return false;
              }
              const normalizedValue = String(fieldValue).trim().toLowerCase();
              return filterValuesSet.has(normalizedValue);
            });
            console.log(`✅ Applied filter ${filterIndex + 1}: ${filterFieldName} = [${filter.filterValues.join(', ')}]`, {
              beforeCount,
              afterCount: filteredData.length,
              filteredOut: beforeCount - filteredData.length
            });
          } else {
            console.warn(`⚠️ Filter ${filterIndex + 1} is invalid:`, filter);
          }
        });
      } 
      // Handle legacy single filter object format (for backward compatibility)
      else if (typeof cardConfig.filters === 'object' && !Array.isArray(cardConfig.filters)) {
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
        // Handle generic filter field and values (legacy format)
      if (cardConfig.filters.filterField && cardConfig.filters.filterValues && cardConfig.filters.filterValues.length > 0) {
        const filterFieldName = cardConfig.filters.filterField;
        const filterValuesSet = new Set(cardConfig.filters.filterValues.map(v => String(v).trim().toLowerCase()));
        filteredData = filteredData.filter(s => {
          // Use case-insensitive field access
          const fieldValue = getFieldValue(s, filterFieldName);
          if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
            return false;
          }
          const normalizedValue = String(fieldValue).trim().toLowerCase();
          return filterValuesSet.has(normalizedValue);
        });
        }
      }
    }

    console.log('📊 Custom card data filtering complete:', {
      initialCount,
      finalCount: filteredData.length,
      filteredOut: initialCount - filteredData.length,
      cardTitle: cardConfig.title
    });

    // Group data by selected field
    const grouped = {};
    filteredData.forEach(sale => {
      let groupKey = '';
      let originalKey = '';
      
      if (cardConfig.groupBy === 'date') {
        // Use getFieldValue helper for consistent case-insensitive field access
        // Try cp_date first (most common), then date
        const saleDate = getFieldValue(sale, 'cp_date') || getFieldValue(sale, 'date');
        
        // Log first few sales to debug date parsing (only for first 3 to avoid spam)
        const saleIndex = filteredData.indexOf(sale);
        if (saleIndex < 3) {
          console.log('📅 Date parsing debug:', {
            saleIndex,
            saleDate,
            saleDateType: typeof saleDate,
            saleKeys: Object.keys(sale).filter(k => k.toLowerCase().includes('date')),
            directAccess: {
              cp_date: sale.cp_date,
              date: sale.date,
              Date: sale.Date,
              DATE: sale.DATE,
              CP_DATE: sale.CP_DATE
            },
            getFieldValueResult: {
              cp_date: getFieldValue(sale, 'cp_date'),
              date: getFieldValue(sale, 'date')
            }
          });
        }
        
        // Normalize date to YYYY-MM-DD format first
        let normalizedDate = null;
        if (saleDate) {
          // Convert to string and trim
          const dateStr = String(saleDate).trim();
          
          // Try to parse date from various formats (in order of likelihood)
          // 1. Try parseDateFromNewFormat (handles DD-MMM-YY format)
          const parsed = parseDateFromNewFormat(dateStr);
          if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            normalizedDate = parsed;
          } 
          // 2. Try parseDateFromAPI (handles YYYYMMDD format)
          else if (/^\d{8}$/.test(dateStr)) {
            const apiParsed = parseDateFromAPI(dateStr);
            if (apiParsed && /^\d{4}-\d{2}-\d{2}$/.test(apiParsed)) {
              normalizedDate = apiParsed;
            }
          }
          // 3. Check if already in YYYY-MM-DD format
          else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            normalizedDate = dateStr;
          }
          // 4. Try direct Date parsing as last resort
          else {
            const directDate = new Date(dateStr);
            if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 1900 && directDate.getFullYear() < 2100) {
              const year = directDate.getFullYear();
              const month = String(directDate.getMonth() + 1).padStart(2, '0');
              const day = String(directDate.getDate()).padStart(2, '0');
              normalizedDate = `${year}-${month}-${day}`;
            }
          }
          
          // Log parsing failures for first few items
          if (saleIndex < 3 && !normalizedDate) {
            console.warn('⚠️ Failed to parse date:', {
              original: saleDate,
              dateStr,
              parsed,
              triedDirectDate: new Date(dateStr).toString()
            });
          }
        }
        
        // Check if we have a valid normalized date
        if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          // Invalid date - use 'Unknown'
          // Log why it's going to Unknown
          if (filteredData.indexOf(sale) < 3) {
            console.warn('⚠️ Date going to Unknown:', {
              saleDate,
              normalizedDate,
              reason: !saleDate ? 'No date field found' : 
                      !normalizedDate ? 'Could not normalize date' : 
                      'Date format validation failed'
            });
          }
          groupKey = 'Unknown';
          originalKey = 'Unknown';
        } else {
          const date = new Date(normalizedDate);
          
          // Double-check date is valid
          if (isNaN(date.getTime())) {
            groupKey = 'Unknown';
            originalKey = 'Unknown';
          } else {
        if (cardConfig.dateGrouping === 'day') {
              // Use normalized YYYY-MM-DD format for grouping
              groupKey = normalizedDate;
              // Format for display: DD-MMM-YY
              originalKey = formatDateForDisplay(normalizedDate);
        } else if (cardConfig.dateGrouping === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
              originalKey = groupKey;
        } else if (cardConfig.dateGrouping === 'month') {
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              originalKey = groupKey;
        } else if (cardConfig.dateGrouping === 'year') {
          groupKey = String(date.getFullYear());
              originalKey = groupKey;
        } else {
              // Default to day grouping
              groupKey = normalizedDate;
              originalKey = formatDateForDisplay(normalizedDate);
        }
          }
        }
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
      } else if (cardConfig.groupBy === 'month') {
        // Group by month (derived from date field)
        const saleDate = getFieldValue(sale, 'date');
        if (saleDate) {
          const date = new Date(saleDate);
          if (!isNaN(date.getTime())) {
            const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            groupKey = `${monthAbbr[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
            originalKey = groupKey;
          } else {
            groupKey = 'Unknown';
            originalKey = 'Unknown';
          }
        } else {
          groupKey = 'Unknown';
          originalKey = 'Unknown';
        }
      } else if (cardConfig.groupBy === 'year') {
        // Group by year (derived from date field)
        const saleDate = getFieldValue(sale, 'date');
        if (saleDate) {
          const date = new Date(saleDate);
          if (!isNaN(date.getTime())) {
            groupKey = String(date.getFullYear());
            originalKey = groupKey;
          } else {
            groupKey = 'Unknown';
            originalKey = 'Unknown';
          }
        } else {
          groupKey = 'Unknown';
          originalKey = 'Unknown';
        }
      } else if (cardConfig.groupBy === 'quarter') {
        // Group by quarter (derived from date field)
        const saleDate = getFieldValue(sale, 'date');
        if (saleDate) {
          const date = new Date(saleDate);
          if (!isNaN(date.getTime())) {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            groupKey = `Q${quarter} ${date.getFullYear()}`;
            originalKey = groupKey;
          } else {
            groupKey = 'Unknown';
            originalKey = 'Unknown';
          }
        } else {
          groupKey = 'Unknown';
          originalKey = 'Unknown';
        }
      } else if (cardConfig.groupBy === 'week') {
        // Group by week (derived from date field)
        const saleDate = getFieldValue(sale, 'date');
        if (saleDate) {
          const date = new Date(saleDate);
          if (!isNaN(date.getTime())) {
            // Get ISO week number
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            groupKey = `Week ${weekNum}, ${date.getFullYear()}`;
            originalKey = groupKey;
          } else {
            groupKey = 'Unknown';
            originalKey = 'Unknown';
          }
        } else {
          groupKey = 'Unknown';
          originalKey = 'Unknown';
        }
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
        grouped[groupKey] = { 
          items: [], 
          originalKey: originalKey,
          // Initialize segments if stacking is enabled
          segments: cardConfig.enableStacking && cardConfig.segmentBy ? {} : null
        };
      } else {
        // For case-insensitive fields, keep the most common casing (use first encountered)
        if (cardConfig.groupBy !== 'date' && cardConfig.groupBy !== 'profit_margin' && cardConfig.groupBy !== 'order_value') {
          if (grouped[groupKey].originalKey === 'Unknown' && originalKey !== 'Unknown') {
            grouped[groupKey].originalKey = originalKey;
          }
        }
      }
      
      // If stacking is enabled, also group by segment
      if (cardConfig.enableStacking && cardConfig.segmentBy && grouped[groupKey].segments) {
        const segmentValue = getFieldValue(sale, cardConfig.segmentBy);
        const segmentKey = segmentValue ? String(segmentValue).trim() : 'Unknown';
        const normalizedSegmentKey = segmentKey.toLowerCase();
        
        if (!grouped[groupKey].segments[normalizedSegmentKey]) {
          grouped[groupKey].segments[normalizedSegmentKey] = {
            items: [],
            originalKey: segmentKey
          };
        }
        grouped[groupKey].segments[normalizedSegmentKey].items.push(sale);
      }
      
      grouped[groupKey].items.push(sale);
    });

    // Log grouping statistics for debugging
    if (cardConfig.groupBy === 'date') {
      const unknownCount = grouped['Unknown']?.items?.length || 0;
      const validDateCount = Object.keys(grouped).filter(k => k !== 'Unknown').reduce((sum, k) => sum + (grouped[k]?.items?.length || 0), 0);
      console.log('📅 Date Grouping Statistics:', {
        totalSales: filteredData.length,
        unknownCount,
        validDateCount,
        unknownPercentage: ((unknownCount / filteredData.length) * 100).toFixed(2) + '%',
        sampleGroupKeys: Object.keys(grouped).slice(0, 10),
        sampleUnknownItems: unknownCount > 0 ? grouped['Unknown'].items.slice(0, 2).map(s => ({
          hasCpDate: !!s.cp_date,
          hasDate: !!s.date,
          cpDateValue: s.cp_date,
          dateValue: s.date,
          allKeys: Object.keys(s).filter(k => k.toLowerCase().includes('date'))
        })) : []
      });
    }

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

      // Calculate segments if stacking is enabled
      let segments = null;
      if (cardConfig.enableStacking && groupData.segments) {
        const segmentColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
        segments = Object.keys(groupData.segments).map((segKey, idx) => {
          const segmentData = groupData.segments[segKey];
          const segmentItems = segmentData.items;
          let segmentValue = 0;
          
          if (cardConfig.aggregation === 'sum') {
            // Handle special calculated fields
            if (cardConfig.valueField === 'tax_amount') {
              segmentValue = segmentItems.reduce((sum, item) => {
                const cgst = parseFloat(getFieldValue(item, 'cgst') || 0);
                const sgst = parseFloat(getFieldValue(item, 'sgst') || 0);
                return sum + cgst + sgst;
              }, 0);
            } else if (cardConfig.valueField === 'profit_margin') {
              const totalAmount = segmentItems.reduce((sum, item) => sum + parseFloat(getFieldValue(item, 'amount') || 0), 0);
              const totalProfit = segmentItems.reduce((sum, item) => sum + parseFloat(getFieldValue(item, 'profit') || 0), 0);
              segmentValue = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
            } else {
              segmentValue = segmentItems.reduce((sum, item) => {
                return sum + parseFloat(getFieldValue(item, cardConfig.valueField) || 0);
              }, 0);
            }
          } else if (cardConfig.aggregation === 'count') {
            segmentValue = segmentItems.length;
          } else if (cardConfig.aggregation === 'avg') {
            const sum = segmentItems.reduce((s, item) => {
              return s + parseFloat(getFieldValue(item, cardConfig.valueField) || 0);
            }, 0);
            segmentValue = segmentItems.length > 0 ? sum / segmentItems.length : 0;
          }
          
          return {
            label: segmentData.originalKey,
            value: segmentValue,
            color: segmentColors[idx % segmentColors.length]
          };
        });
        
        // Sort segments by value descending
        segments.sort((a, b) => b.value - a.value);
      }
      
      return {
        label: displayKey, // Use original key for display (preserves casing)
        value: segments ? segments.reduce((sum, s) => sum + s.value, 0) : value,
        segments: segments, // Add segments array
        sortKey: key // Store the groupKey for sorting (especially useful for dates in YYYY-MM-DD format)
      };
    });

    // Sort results - chronologically for dates, by value for others
    if (cardConfig.groupBy === 'date') {
      // Sort dates chronologically (oldest first)
      result.sort((a, b) => {
        // Handle 'Unknown' - put it at the end
        if (a.sortKey === 'Unknown') return 1;
        if (b.sortKey === 'Unknown') return -1;
        
        // Use sortKey (groupKey) which is in standardized format for proper sorting
        if (cardConfig.dateGrouping === 'day') {
          // sortKey is in YYYY-MM-DD format - can use string comparison
          return a.sortKey.localeCompare(b.sortKey);
        } else if (cardConfig.dateGrouping === 'month') {
          // Format: YYYY-MM - can use string comparison
          return a.sortKey.localeCompare(b.sortKey);
        } else if (cardConfig.dateGrouping === 'year') {
          // Format: YYYY - compare as numbers
          return parseInt(a.sortKey) - parseInt(b.sortKey);
        } else if (cardConfig.dateGrouping === 'week') {
          // Format: YYYY-WN - can use string comparison
          return a.sortKey.localeCompare(b.sortKey);
        } else {
          // Default: try to parse as date
          const dateA = new Date(a.sortKey);
          const dateB = new Date(b.sortKey);
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            return dateA.getTime() - dateB.getTime();
          }
          return a.sortKey.localeCompare(b.sortKey);
        }
      });
    } else {
      // Sort by value (descending) for non-date fields
    result.sort((a, b) => b.value - a.value);
    }

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

    // Add colors to each item (only for non-stacked bars)
    return finalResult.map((item, index) => ({
      ...item,
      color: item.segments ? colors[0] : colors[index % colors.length] // Use first color if stacked
    }));
  }, []);

  const handleCreateCustomCard = useCallback(async (cardConfig) => {
    try {
      // Check if company is selected
      const selectedCompanyGuid = sessionStorage.getItem('selectedCompanyGuid');
      if (!selectedCompanyGuid) {
        alert('Please select a company first.');
        return;
      }
      
      const companyInfo = getCompanyInfo();
      const { tallyloc_id, guid } = companyInfo;
      
      if (!tallyloc_id || !guid) {
        alert('Missing company information. Please select a company first.');
        return;
      }
      
      if (editingCardId) {
        // Update existing card
        let cardToUpdate = customCards.find(c => c.id === editingCardId);
        
        // If card not found, try flexible ID matching (handle string/number/format variations)
        if (!cardToUpdate) {
          console.warn('⚠️ Card not found with exact ID match, trying flexible matching...', {
            editingCardId,
            editingIdType: typeof editingCardId,
            availableCardIds: customCards.map(c => ({ id: c.id, idType: typeof c.id })),
            customCardsCount: customCards.length
          });
          
          // Try matching by ID as string or number (handle ID format variations like "78_1765774966063")
          const editingIdStr = String(editingCardId);
          const editingIdNum = editingIdStr.includes('_') 
            ? parseInt(editingIdStr.split('_')[0]) 
            : (typeof editingCardId === 'number' ? editingCardId : parseInt(editingCardId));
          
          cardToUpdate = customCards.find(c => {
            const cardIdStr = String(c.id);
            const cardIdNum = cardIdStr.includes('_')
              ? parseInt(cardIdStr.split('_')[0])
              : (typeof c.id === 'number' ? c.id : parseInt(c.id));
            
            // Try multiple matching strategies
            return c.id === editingCardId ||                    // Exact match
                   cardIdStr === editingIdStr ||                // String match
                   (cardIdNum === editingIdNum && !isNaN(editingIdNum) && !isNaN(cardIdNum)) || // Numeric match
                   cardIdStr.startsWith(editingIdStr) ||        // Starts with match
                   editingIdStr.startsWith(cardIdStr);          // Reverse starts with match
          });
          
          if (cardToUpdate) {
            console.log('✅ Found card using flexible ID matching:', {
              editingCardId,
              foundCardId: cardToUpdate.id,
              matchType: 'flexible'
            });
          }
        }
        
        // If still not found, try to fetch the card directly from API
        if (!cardToUpdate) {
          console.warn('⚠️ Card not found in local array, attempting to fetch from API...', editingCardId);
          try {
            const endpoint = `${API_CONFIG.ENDPOINTS.CUSTOM_CARD_GET}?tallylocId=${tallyloc_id}&coGuid=${guid}&dashboardType=sales`;
            const response = await apiGet(endpoint);
            
            if (response && response.status === 'success' && response.data) {
              const cards = Array.isArray(response.data) ? response.data : [];
              const allCards = cards.filter(card => card.isActive !== 0);
              
              // Try to find the card in the fresh API response
              cardToUpdate = allCards.find(c => {
                const cardIdStr = String(c.id);
                const editingIdStr = String(editingCardId);
                return c.id === editingCardId || 
                       cardIdStr === editingIdStr ||
                       (cardIdStr.includes('_') && editingIdStr.includes('_') && 
                        cardIdStr.split('_')[0] === editingIdStr.split('_')[0]);
              });
              
              if (cardToUpdate) {
                console.log('✅ Found card from API:', cardToUpdate.id);
                // Flatten the card like in loadCustomCards
                let parsedCardConfig = cardToUpdate.cardConfig;
                if (typeof parsedCardConfig === 'string') {
                  try {
                    parsedCardConfig = JSON.parse(parsedCardConfig);
                  } catch (e) {
                    parsedCardConfig = {};
                  }
                }
                if (parsedCardConfig && typeof parsedCardConfig === 'object') {
                  cardToUpdate = { ...cardToUpdate, ...parsedCardConfig };
                }
              }
            }
          } catch (apiError) {
            console.error('❌ Error fetching card from API:', apiError);
          }
        }
        
        // Final check - if still not found, show error
        if (!cardToUpdate) {
          console.error('❌ Card not found for update after all attempts:', {
            editingCardId,
            editingIdType: typeof editingCardId,
            availableCardIds: customCards.map(c => ({ id: c.id, idType: typeof c.id })),
            customCardsCount: customCards.length
          });
          alert(`Card with ID ${editingCardId} not found. The card may have been deleted or the page needs to be refreshed.`);
          setEditingCardId(null); // Clear editing state
          setShowCustomCardModal(false); // Close modal
          return;
        }
        
        console.log('🔧 Updating card:', {
          cardId: editingCardId,
          cardConfig,
          cardToUpdate
        });
        
        const updatePayload = {
          title: cardConfig.title,
          chartType: cardConfig.chartType,
          groupBy: cardConfig.groupBy,
          valueField: cardConfig.valueField,
          aggregation: cardConfig.aggregation,
          topN: cardConfig.topN || null,
          filters: cardConfig.filters || [],
          cardConfig: {
            enableStacking: cardConfig.enableStacking,
            segmentBy: cardConfig.segmentBy,
            multiAxisSeries: cardConfig.multiAxisSeries,
            dateGrouping: cardConfig.dateGrouping,
            mapSubType: cardConfig.mapSubType,
            ...(cardConfig.cardConfig || {})
          },
          sortOrder: cardConfig.sortOrder || cardToUpdate.sortOrder || 0,
          isActive: 1
        };
        
        const endpoint = API_CONFIG.ENDPOINTS.CUSTOM_CARD_UPDATE(editingCardId);
        const response = await apiPut(endpoint, updatePayload);
        
        if (response && response.status === 'success') {
          // Flatten response data (same as during load)
          const updatedCard = { ...cardToUpdate, ...cardConfig, ...response.data };
          
          // Parse and flatten cardConfig from response if it exists
          let parsedCardConfig = updatedCard.cardConfig;
          if (typeof updatedCard.cardConfig === 'string') {
            try {
              parsedCardConfig = JSON.parse(updatedCard.cardConfig);
            } catch (e) {
              console.warn('Failed to parse cardConfig after update:', e);
              parsedCardConfig = {};
            }
          }
          
          if (parsedCardConfig && typeof parsedCardConfig === 'object') {
            updatedCard.enableStacking = parsedCardConfig.enableStacking;
            updatedCard.segmentBy = parsedCardConfig.segmentBy;
            updatedCard.multiAxisSeries = parsedCardConfig.multiAxisSeries;
            updatedCard.dateGrouping = parsedCardConfig.dateGrouping || updatedCard.dateGrouping;
            updatedCard.mapSubType = parsedCardConfig.mapSubType || 'choropleth';
          }
          
          // Force date grouping to 'day' (daily) for all date-based cards
          if (updatedCard.groupBy === 'date' || updatedCard.groupBy === 'cp_date' || 
              (updatedCard.groupBy && String(updatedCard.groupBy).toLowerCase().includes('date'))) {
            updatedCard.dateGrouping = 'day';
          }
          
          // Parse filters if it's a string
          if (typeof updatedCard.filters === 'string') {
            try {
              updatedCard.filters = JSON.parse(updatedCard.filters);
            } catch (e) {
              console.warn('Failed to parse filters after update:', e);
              updatedCard.filters = [];
            }
          }
          
          // Update local state
          setCustomCards(prev => prev.map(card => 
            card.id === editingCardId ? updatedCard : card
          ));
          
          // Update chartType state
          if (cardConfig.chartType) {
            setCustomCardChartTypes(prev => ({
              ...prev,
              [editingCardId]: cardConfig.chartType
            }));
          }
          
          console.log('✅ Custom card updated successfully:', updatedCard);
        } else {
          console.error('❌ Failed to update custom card:', response);
          alert('Failed to update custom card. Please try again.');
          return;
        }
        
        setEditingCardId(null);
      } else {
        // Create new card
        const createPayload = {
          tallylocId: tallyloc_id,
          coGuid: guid,
          dashboardType: 'sales',
          title: cardConfig.title,
          chartType: cardConfig.chartType,
          groupBy: cardConfig.groupBy,
          valueField: cardConfig.valueField,
          aggregation: cardConfig.aggregation,
          topN: cardConfig.topN || null,
          filters: cardConfig.filters || [],
          cardConfig: {
            enableStacking: cardConfig.enableStacking,
            segmentBy: cardConfig.segmentBy,
            multiAxisSeries: cardConfig.multiAxisSeries,
            dateGrouping: cardConfig.dateGrouping,
            mapSubType: cardConfig.mapSubType,
            ...(cardConfig.cardConfig || {})
          },
          sortOrder: cardConfig.sortOrder || 0
        };
        
        const response = await apiPost(API_CONFIG.ENDPOINTS.CUSTOM_CARD_CREATE, createPayload);
        
        if (response && response.status === 'success' && response.data) {
          const newCard = response.data;
          
          // Flatten cardConfig properties to top level (same as during load)
          let parsedCardConfig = newCard.cardConfig;
          if (typeof newCard.cardConfig === 'string') {
            try {
              parsedCardConfig = JSON.parse(newCard.cardConfig);
            } catch (e) {
              console.warn('Failed to parse cardConfig for new card:', e);
              parsedCardConfig = {};
            }
          }
          
          if (parsedCardConfig && typeof parsedCardConfig === 'object') {
            newCard.enableStacking = parsedCardConfig.enableStacking;
            newCard.segmentBy = parsedCardConfig.segmentBy;
            newCard.multiAxisSeries = parsedCardConfig.multiAxisSeries;
            newCard.dateGrouping = parsedCardConfig.dateGrouping || newCard.dateGrouping;
            newCard.mapSubType = parsedCardConfig.mapSubType || 'choropleth';
          }
          
          // Force date grouping to 'day' (daily) for all date-based cards
          if (newCard.groupBy === 'date' || newCard.groupBy === 'cp_date' || 
              (newCard.groupBy && String(newCard.groupBy).toLowerCase().includes('date'))) {
            newCard.dateGrouping = 'day';
          }
          
          // Parse filters if it's a string
          if (typeof newCard.filters === 'string') {
            try {
              newCard.filters = JSON.parse(newCard.filters);
            } catch (e) {
              console.warn('Failed to parse filters for new card:', e);
              newCard.filters = [];
            }
          }
          
          // Add to local state
          setCustomCards(prev => [...prev, newCard]);
          
          // Set chartType state for the new card
          if (newCard.chartType) {
            setCustomCardChartTypes(prev => ({
              ...prev,
              [newCard.id]: newCard.chartType
            }));
          }
          
          console.log('✅ Custom card created successfully:', newCard);
        } else {
          console.error('❌ Failed to create custom card:', response);
          alert('Failed to create custom card. Please try again.');
          return;
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
    } catch (error) {
      console.error('❌ Error saving custom card:', error);
      alert('Error saving custom card: ' + (error.message || 'Unknown error'));
    }
  }, [editingCardId, customCards]);

  const handleEditCustomCard = useCallback((cardId) => {
    setEditingCardId(cardId);
    setShowCustomCardModal(true);
  }, []);

  const handleDeleteCustomCard = useCallback(async (cardId) => {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.CUSTOM_CARD_DELETE(cardId);
      const response = await apiDelete(endpoint);
      
      if (response && (response.status === 'success' || response.status === 'error')) {
        // Remove from local state regardless of response (optimistic update)
        setCustomCards(prev => prev.filter(card => card.id !== cardId));
        
        // Remove chartType state
        setCustomCardChartTypes(prev => {
          const updated = { ...prev };
          delete updated[cardId];
          return updated;
        });
        
        console.log('✅ Custom card deleted successfully');
      } else {
        console.error('❌ Failed to delete custom card:', response);
        // Still remove from local state for better UX
        setCustomCards(prev => prev.filter(card => card.id !== cardId));
        setCustomCardChartTypes(prev => {
          const updated = { ...prev };
          delete updated[cardId];
          return updated;
        });
      }
    } catch (error) {
      console.error('❌ Error deleting custom card:', error);
      // Still remove from local state for better UX
      setCustomCards(prev => prev.filter(card => card.id !== cardId));
      setCustomCardChartTypes(prev => {
        const updated = { ...prev };
        delete updated[cardId];
        return updated;
      });
    }
  }, []);

  // Helper function for compact currency formatting (for salesperson chart)
  const formatCompactCurrency = (value) => {
    if (!value || value === 0) return '₹0.00';
    const absValue = Math.abs(value);
    let formatted = '';
    let unit = '';
    
    if (numberFormat === 'indian') {
      // Indian numbering: Lakhs and Crores
      if (absValue >= 10000000) {
        formatted = '₹' + (absValue / 10000000).toFixed(2);
        unit = ' Cr';
      } else if (absValue >= 100000) {
        formatted = '₹' + (absValue / 100000).toFixed(2);
        unit = ' L';
      } else if (absValue >= 1000) {
        formatted = '₹' + (absValue / 1000).toFixed(2);
        unit = ' K';
      } else {
        formatted = '₹' + absValue.toFixed(2);
      }
    } else {
      // International numbering: Millions and Billions
      if (absValue >= 1000000000) {
        formatted = '₹' + (absValue / 1000000000).toFixed(2);
        unit = ' B';
      } else if (absValue >= 1000000) {
        formatted = '₹' + (absValue / 1000000).toFixed(2);
        unit = ' M';
      } else if (absValue >= 1000) {
        formatted = '₹' + (absValue / 1000).toFixed(2);
        unit = ' K';
      } else {
        formatted = '₹' + absValue.toFixed(2);
      }
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

    // Handle quarter format (Q1-2024, Q2-2024, etc.)
    const quarterMatch = period.match(/^Q(\d)-(\d{4})$/);
    if (quarterMatch) {
      const quarter = quarterMatch[1];
      const year = quarterMatch[2];
      return `Q${quarter} ${year}`;
    }

    // Handle year-only format (YYYY)
    if (/^\d{4}$/.test(period)) {
      return period;
    }

    // Handle regular month format (YYYY-MM)
    const [year, month] = period.split('-');
    const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return period;
    return `${monthAbbr[monthIndex]}-${String(year).slice(-2)}`;
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
    // filteredSales already has all dashboard filters applied (date range, customer, item, region, country, period, salesperson, etc.)
    // The predicate adds additional filtering for the specific chart entry clicked (e.g., specific customer, item, etc.)
    const filtered = filteredSales.filter(predicate);
    console.log('🔍 openTransactionRawData (using existing data, no API call):', {
      title,
      totalFilteredSales: filteredSales.length,
      filteredCount: filtered.length,
      dashboardFilters: {
        dateRange,
        selectedCustomer,
        selectedItem,
        selectedStockGroup,
        selectedLedgerGroup,
        selectedRegion,
        selectedCountry,
        selectedPeriod,
        selectedSalesperson,
        enabledSalespersonsSize: enabledSalespersons.size
      },
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
  }, [buildTransactionRows, filteredSales, transactionColumns, dateRange, selectedCustomer, selectedItem, selectedStockGroup, selectedLedgerGroup, selectedRegion, selectedCountry, selectedPeriod, selectedSalesperson, enabledSalespersons]);

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

  // Handle voucher row click - use new component which fetches from API
  const handleVoucherRowClick = useCallback((masterId) => {
    if (!masterId) return;
    setSelectedMasterId(masterId);
    setShowVoucherDetails(true);
  }, []);

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
              <div class="metric-value">${formatNumber(totalQuantity)}</div>
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
              <div class="metric-value">${profitMargin >= 0 ? '+' : ''}${formatNumber(profitMargin, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
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
                  <span>${formatNumber(item.value)}</span>
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
                    <span>${typeof item.value === 'number' ? (item.value % 1 === 0 ? formatNumber(item.value) : formatNumber(item.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : item.value}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          }).join('') : ''}
          
          <div class="footer">
            <p>Report generated by DataLynkr Sales Dashboard</p>
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
              <div class="metric-value">${formatNumber(totalQuantity)}</div>
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
              <div class="metric-value">${profitMargin >= 0 ? '+' : ''}${formatNumber(profitMargin, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</div>
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
                  <span>${formatNumber(item.value)}</span>
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
                    <span>${typeof item.value === 'number' ? (item.value % 1 === 0 ? formatNumber(item.value) : formatNumber(item.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : item.value}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          }).join('') : ''}
          
          <div class="footer">
            <p>Report generated by DataLynkr Sales Dashboard</p>
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
  // IMPORTANT: All chart data sources (categoryChartData, ledgerGroupChartData, etc.) are computed from filteredSales,
  // which already has all dashboard filters applied (date range, customer, item, region, country, period, salesperson, etc.)
  // Therefore, raw data opened from chart entries automatically respects all dashboard filters
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

  // Utility functions for column filtering
  const getColumnFilterType = useCallback((column, rows) => {
    const key = column.key.toLowerCase();
    
    // Date columns
    if (key.includes('date') || key === 'duedate' || key === 'referencedate') {
      return 'date';
    }
    
    // Numeric columns
    if (key.includes('amount') || key.includes('balance') || key.includes('qty') || 
        key.includes('quantity') || key.includes('days') || key.includes('overdue') ||
        key === 'closingbalance' || key === 'daysoverdue' || column.format) {
      return 'numeric';
    }

    // Force item columns to dropdown (per request)
    if (key.includes('item')) {
      return 'dropdown';
    }
    
    // Get unique values for the column
    const uniqueValues = new Set();
    rows.forEach(row => {
      const value = row[column.key];
      if (value !== null && value !== undefined && value !== '') {
        uniqueValues.add(String(value));
      }
    });
    
    // If less than 50 unique values, use dropdown
    if (uniqueValues.size > 0 && uniqueValues.size < 50) {
      return 'dropdown';
    }
    
    // Default to text search
    return 'text';
  }, []);

  const getUniqueColumnValues = useCallback((column, rows) => {
    const uniqueValues = new Set();
    rows.forEach(row => {
      const value = row[column.key];
      if (value !== null && value !== undefined && value !== '') {
        uniqueValues.add(String(value));
      }
    });
    return Array.from(uniqueValues).sort();
  }, []);

  const evaluateNumericFilter = useCallback((value, filterValue) => {
    if (!filterValue || filterValue.trim() === '') return true;
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return false;
    
    // Split by comma for multiple conditions (AND logic)
    const conditions = filterValue.split(',').map(c => c.trim());
    
    return conditions.every(condition => {
      // Match operators: >, <, >=, <=, =
      const match = condition.match(/^([><]=?|=)\s*(-?\d+\.?\d*)$/);
      if (!match) return true; // Invalid format, ignore
      
      const operator = match[1];
      const filterNum = parseFloat(match[2]);
      
      switch (operator) {
        case '>': return numValue > filterNum;
        case '<': return numValue < filterNum;
        case '>=': return numValue >= filterNum;
        case '<=': return numValue <= filterNum;
        case '=': return numValue === filterNum;
        default: return true;
      }
    });
  }, []);

  const evaluateDateFilter = useCallback((value, filterValue) => {
    if (!filterValue || !filterValue.from) return true;
    
    try {
      // Parse the row value date
      const rowDate = parseDateFromNewFormat(String(value));
      if (!rowDate) return false;
      const rowDateObj = new Date(rowDate);

      // Parse the 'from' date text; if not a valid date yet, ignore the filter
      const fromParsed = parseDateFromNewFormat(filterValue.from);
      if (!fromParsed) return true;
      const fromDate = new Date(fromParsed);
      
      // If 'to' is provided AND valid, treat as range; otherwise treat as single-day match
      if (filterValue.to) {
        const toParsed = parseDateFromNewFormat(filterValue.to);
        if (!toParsed) {
          // Invalid 'to' while typing - just check equality with from date
          return rowDateObj.toDateString() === fromDate.toDateString();
        }
        const toDate = new Date(toParsed);
        return rowDateObj >= fromDate && rowDateObj <= toDate;
      }

      // Single date match
      return rowDateObj.toDateString() === fromDate.toDateString();
    } catch (error) {
      return false;
    }
  }, [parseDateFromNewFormat]);

  const applyColumnFilters = useCallback((rows) => {
    if (Object.keys(columnFilters).length === 0) return rows;
    
    return rows.filter(row => {
      return Object.entries(columnFilters).every(([columnKey, filterValue]) => {
        const column = rawDataModal.columns.find(col => col.key === columnKey);
        if (!column) return true;
        
        const cellValue = row[columnKey];
        const filterType = getColumnFilterType(column, rawDataModal.rows);
        
        switch (filterType) {
          case 'dropdown':
            if (!filterValue || filterValue.length === 0) return true;
            return filterValue.includes(String(cellValue ?? ''));
            
          case 'text':
            if (!filterValue || filterValue.trim() === '') return true;
            return String(cellValue ?? '').toLowerCase().includes(filterValue.toLowerCase());
            
          case 'numeric':
            return evaluateNumericFilter(cellValue, filterValue);
            
          case 'date':
            // Date filters removed per request
            return true;
            
          default:
            return true;
        }
      });
    });
  }, [columnFilters, rawDataModal.columns, rawDataModal.rows, getColumnFilterType, evaluateNumericFilter, evaluateDateFilter]);

  const filteredRawRows = useMemo(() => {
    if (!rawDataModal.open) return [];
    
    let filtered = rawDataModal.rows;
    
    // Apply column filters first
    filtered = applyColumnFilters(filtered);
    
    // Then apply global search
    const query = rawDataSearch.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((row) =>
        rawDataModal.columns.some((column) =>
          String(row[column.key] ?? '')
            .toLowerCase()
            .includes(query)
        )
      );
    }
    
    // Apply sorting if sortBy is set
    if (rawDataSortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a[rawDataSortBy];
        let bValue = b[rawDataSortBy];
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = rawDataSortBy === 'date' ? '' : 0;
        if (bValue === null || bValue === undefined) bValue = rawDataSortBy === 'date' ? '' : 0;
        
        if (rawDataSortBy === 'date') {
          // Sort dates - parse various date formats
          const parseDate = (dateStr) => {
            if (!dateStr) return new Date(0);
            
            // Format: YYYYMMDD
            if (typeof dateStr === 'string' && dateStr.length === 8 && /^\d+$/.test(dateStr)) {
              const year = dateStr.substring(0, 4);
              const month = dateStr.substring(4, 6);
              const day = dateStr.substring(6, 8);
              return new Date(`${year}-${month}-${day}`);
            }
            
            // Format: DD-MMM-YY
            if (typeof dateStr === 'string' && dateStr.includes('-')) {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                const day = parts[0];
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
                if (monthIndex !== -1) {
                  let year = parts[2];
                  if (year.length === 2) {
                    const yearNum = parseInt(year, 10);
                    year = yearNum < 50 ? `20${year}` : `19${year}`;
                  }
                  return new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`);
                }
              }
            }
            
            // Try Date constructor
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? new Date(0) : date;
          };
          
          const aDate = parseDate(aValue);
          const bDate = parseDate(bValue);
          return rawDataSortOrder === 'asc' ? aDate - bDate : bDate - aDate;
        } else if (rawDataSortBy === 'quantity' || rawDataSortBy === 'amount') {
          // Sort numeric values
          const aNum = typeof aValue === 'number' ? aValue : parseFloat(aValue) || 0;
          const bNum = typeof bValue === 'number' ? bValue : parseFloat(bValue) || 0;
          return rawDataSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Fallback: string comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (rawDataSortOrder === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
        }
      });
    }
    
    return filtered;
  }, [rawDataModal, rawDataSearch, applyColumnFilters, rawDataSortBy, rawDataSortOrder]);

  const totalRawPages = rawDataModal.open
    ? Math.max(1, Math.ceil(Math.max(filteredRawRows.length, 1) / rawDataPageSize))
    : 1;

  // Close dropdowns on outside click
  useEffect(() => {
    if (!filterDropdownOpen && !showSortDropdown) return;
    const handleClickOutside = (e) => {
      if (filterDropdownOpen && !e.target.closest('[data-filter-dropdown]')) {
        setFilterDropdownOpen(null);
      }
      if (showSortDropdown && !e.target.closest('[data-sort-dropdown]')) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [filterDropdownOpen, showSortDropdown]);

  // Reset filters when modal closes
  useEffect(() => {
    if (!rawDataModal.open) {
      setColumnFilters({});
      setFilterDropdownOpen(null);
      setDateDrafts({});
      setRawDataPage(1);
      setRawDataPageInput('1');
      setRawDataSortBy(null);
      setRawDataSortOrder('asc');
      setShowSortDropdown(false);
    }
  }, [rawDataModal.open]);

  useEffect(() => {
    if (!rawDataModal.open) return;
    if (rawDataPage > totalRawPages) {
      setRawDataPage(totalRawPages);
    }
  }, [rawDataModal.open, rawDataPage, totalRawPages, rawDataPageSize]);

  // Reset to page 1 when page size changes
  useEffect(() => {
    if (!rawDataModal.open) return;
    setRawDataPage(1);
    setRawDataPageInput('1');
  }, [rawDataModal.open, rawDataPageSize]);

  // Sync input values when actual values change
  useEffect(() => {
    if (rawDataModal.open) {
      setRawDataPageInput(String(rawDataPage));
      setRawDataPageSizeInput(String(rawDataPageSize));
    }
  }, [rawDataModal.open, rawDataPage, rawDataPageSize]);

  // Sync top N input values when actual values change
  useEffect(() => {
    setTopCustomersNInput(String(topCustomersN));
  }, [topCustomersN]);

  useEffect(() => {
    setTopItemsByRevenueNInput(String(topItemsByRevenueN));
  }, [topItemsByRevenueN]);

  useEffect(() => {
    setTopItemsByQuantityNInput(String(topItemsByQuantityN));
  }, [topItemsByQuantityN]);

  const paginatedRawRows = useMemo(() => {
    if (!rawDataModal.open) return [];
    const start = (rawDataPage - 1) * rawDataPageSize;
    return filteredRawRows.slice(start, start + rawDataPageSize);
  }, [filteredRawRows, rawDataModal.open, rawDataPage, rawDataPageSize]);

  // Draft values for date inputs (avoid applying until Enter/blur with valid date)
  const [dateDrafts, setDateDrafts] = useState({});

  // Clear individual column filter
  const clearColumnFilter = useCallback((columnKey) => {
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[columnKey];
      return newFilters;
    });
    setDateDrafts(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
    setRawDataPage(1);
  }, []);

  // Clear all column filters
  const clearAllColumnFilters = useCallback(() => {
    setColumnFilters({});
    setRawDataPage(1);
  }, []);

  // Render column filter based on type
  const renderColumnFilter = useCallback((column) => {
    const filterType = getColumnFilterType(column, rawDataModal.rows);
    const filterValue = columnFilters[column.key];
    const columnKey = column.key;
    
    const commonInputStyle = {
      width: '100%',
      padding: '6px 8px',
      fontSize: '13px',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
    };

    switch (filterType) {
      case 'dropdown': {
        const uniqueValues = getUniqueColumnValues(column, rawDataModal.rows);
        const selectedValues = filterValue || [];
        const isOpen = filterDropdownOpen === columnKey;
        
        return (
          <div style={{ position: 'relative', width: '100%' }}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setFilterDropdownOpen(isOpen ? null : columnKey);
              }}
              style={{
                ...commonInputStyle,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff',
                borderColor: isOpen ? '#3b82f6' : '#e2e8f0',
                boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
              }}
            >
              <span style={{ color: selectedValues.length === 0 ? '#94a3b8' : '#1e293b', fontSize: '13px' }}>
                {selectedValues.length === 0 ? 'All' : `${selectedValues.length} selected`}
              </span>
              <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            
            {isOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  minWidth: '100%',
                  marginTop: '4px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  zIndex: 3000,
                  boxSizing: 'border-box'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {uniqueValues.map((value) => {
                  const isSelected = selectedValues.includes(value);
                  return (
                    <div
                      key={value}
                      onClick={() => {
                        setColumnFilters(prev => {
                          const current = prev[columnKey] || [];
                          const newValues = isSelected
                            ? current.filter(v => v !== value)
                            : [...current, value];
                          return newValues.length === 0
                            ? { ...prev, [columnKey]: undefined }
                            : { ...prev, [columnKey]: newValues };
                        });
                        setRawDataPage(1);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: '#1e293b' }}>{value}</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {selectedValues.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearColumnFilter(columnKey);
                }}
                style={{
                  position: 'absolute',
                  right: '28px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b'
                }}
                title="Clear filter"
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
        );
      }
      
      case 'text': {
        return (
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              value={filterValue || ''}
              onChange={(e) => {
                const value = e.target.value;
                setColumnFilters(prev => ({
                  ...prev,
                  [columnKey]: value || undefined
                }));
                setRawDataPage(1);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter..."
              style={{
                ...commonInputStyle,
                paddingRight: filterValue ? '30px' : '8px'
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
            {filterValue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearColumnFilter(columnKey);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b'
                }}
                title="Clear filter"
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
        );
      }
      
      case 'numeric': {
        return (
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              value={filterValue || ''}
              onChange={(e) => {
                const value = e.target.value;
                setColumnFilters(prev => ({
                  ...prev,
                  [columnKey]: value || undefined
                }));
                setRawDataPage(1);
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter (e.g., >1000, <5000)"
              style={{
                ...commonInputStyle,
                paddingRight: filterValue ? '30px' : '8px'
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
            {filterValue && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearColumnFilter(columnKey);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b'
                }}
                title="Clear filter"
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}
          </div>
        );
      }
      
      case 'date': {
        // Date filters removed per request
        return null;
      }
      
      default:
        return null;
    }
  }, [columnFilters, filterDropdownOpen, getColumnFilterType, getUniqueColumnValues, rawDataModal.rows, clearColumnFilter]);

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

  // Format date to DD-MMM-YY format (e.g., 15-Apr-25)
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '-';
    
    let dateObj = null;
    
    // Try to parse various date formats
    if (typeof dateStr === 'string') {
      // Format: YYYYMMDD
      if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        dateObj = new Date(`${year}-${month}-${day}`);
      }
      // Format: YYYY-MM-DD
      else if (dateStr.includes('-') && dateStr.length >= 10) {
        dateObj = new Date(dateStr);
      }
      // Format: D-Mon-YY or D-Mon-YYYY
      else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const day = parts[0];
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = monthNames.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
          if (monthIndex !== -1) {
            let year = parts[2];
            if (year.length === 2) {
              const yearNum = parseInt(year, 10);
              year = yearNum < 50 ? `20${year}` : `19${year}`;
            }
            dateObj = new Date(`${year}-${String(monthIndex + 1).padStart(2, '0')}-${day.padStart(2, '0')}`);
          }
        }
      }
    }
    
    // If we couldn't parse it, try Date constructor directly
    if (!dateObj || isNaN(dateObj.getTime())) {
      dateObj = new Date(dateStr);
    }
    
    // If still invalid, return original string
    if (isNaN(dateObj.getTime())) {
      return dateStr;
    }
    
    // Format to DD-MMM-YY
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[dateObj.getMonth()];
    const year = String(dateObj.getFullYear()).slice(-2);
    
    return `${day}-${month}-${year}`;
  };

  // Format date range in format: "1 Apr 2025 → 31 Dec 2025"
  const formatDateRangeForHeader = (fromDateStr, toDateStr) => {
    if (!fromDateStr || !toDateStr) return '';
    
    const formatDate = (dateStr) => {
      let dateObj = null;
      
      // Try to parse various date formats
      if (typeof dateStr === 'string') {
        // Format: YYYYMMDD
        if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          dateObj = new Date(`${year}-${month}-${day}`);
        }
        // Format: YYYY-MM-DD
        else if (dateStr.includes('-') && dateStr.length >= 10) {
          dateObj = new Date(dateStr);
        }
      }
      
      // If we couldn't parse it, try Date constructor directly
      if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date(dateStr);
      }
      
      // If still invalid, return original string
      if (isNaN(dateObj.getTime())) {
        return dateStr;
      }
      
      // Format to "D MMM YYYY" (e.g., "1 Apr 2025")
      const day = dateObj.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[dateObj.getMonth()];
      const year = dateObj.getFullYear();
      
      return `${day} ${month} ${year}`;
    };
    
    return `${formatDate(fromDateStr)} → ${formatDate(toDateStr)}`;
  };

  const renderRawDataCell = (row, column) => {
    const value = row[column.key];
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    // Handle date columns
    if (column.key === 'date' || column.key === 'cp_date' || column.key === 'DATE' || column.key === 'CP_DATE') {
      return formatDateForDisplay(value);
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
        const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
        return numericValue.toLocaleString(locale);
      }
    }

    return value;
  };

  const totalRawRows = filteredRawRows.length;
  const rawDataStart = totalRawRows === 0 ? 0 : (rawDataPage - 1) * rawDataPageSize + 1;
  const rawDataEnd = totalRawRows === 0 ? 0 : Math.min(rawDataPage * rawDataPageSize, totalRawRows);

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
          @keyframes indeterminateProgress {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(400%);
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
        {/* Header */}
        <form onSubmit={handleSubmit} style={{ width: '100%', overflow: 'visible', position: 'relative', boxSizing: 'border-box' }}>
        <div style={{
            padding: isMobile ? '16px 20px' : '10px 20px',
          borderBottom: 'none',
          background: '#1e3a8a',
          borderRadius: '16px',
          position: 'relative',
          marginBottom: isMobile ? '16px' : '28px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 24px rgba(37, 99, 235, 0.15)'
          }}>
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
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <span className="material-icons" style={{ color: 'white', fontSize: '24px' }}>bar_chart</span>
              </div>
              <div style={{ flex: '1' }}>
                <h1 style={{
                  margin: 0,
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: '700',
                  lineHeight: '1.2',
                  letterSpacing: '-0.01em'
                }}>
                  Sales Analytics Dashboard
                </h1>
              </div>
            </div>

            {/* Mobile: Buttons Section */}
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '10px', 
              width: '100%',
              boxSizing: 'border-box'
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
                    : '#22c55e',
                  color: sales.length === 0 ? '#9ca3af' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  cursor: sales.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  whiteSpace: 'nowrap',
                  justifyContent: 'center',
                  width: '100%',
                  height: '32px',
                  boxShadow: sales.length === 0 ? 'none' : '0 2px 4px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(34, 197, 94, 0.1)'
                }}
                onMouseEnter={(e) => {
                  if (sales.length > 0) {
                    e.currentTarget.style.background = '#16a34a';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(34, 197, 94, 0.25), 0 8px 12px rgba(34, 197, 94, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sales.length > 0) {
                    e.currentTarget.style.background = '#22c55e';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(34, 197, 94, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>add_chart</span>
                <span>Create Custom Card</span>
              </button>

              {/* Calendar Button */}
              <button
                type="button"
                onClick={handleOpenCalendar}
                title={fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select date range'}
                style={{
                  background: '#7c3aed',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  height: '32px',
                  boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2), 0 4px 8px rgba(124, 58, 237, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#6d28d9';
                  e.target.style.boxShadow = '0 4px 6px rgba(124, 58, 237, 0.25), 0 8px 12px rgba(124, 58, 237, 0.15)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#7c3aed';
                  e.target.style.boxShadow = '0 2px 4px rgba(124, 58, 237, 0.2), 0 4px 8px rgba(124, 58, 237, 0.1)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>calendar_today</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fromDate && toDate ? formatDateRangeForHeader(fromDate, toDate) : 'Date Range'}</span>
              </button>

              {/* Last Updated & Refresh - Mobile */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  flex: '1 1 0',
                  padding: '6px 10px',
                  background: 'white',
                  borderRadius: '8px',
                  minWidth: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 4px 8px rgba(0, 0, 0, 0.03)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  height: '32px'
                }}>
                {/* Progress Bar Background */}
                {isDownloadingCache && (() => {
                  const current = cacheDownloadProgress.current || 0;
                  const total = cacheDownloadProgress.total || 0;
                  const hasTotal = total > 0;
                  const progressPercentage = hasTotal && total > 0
                    ? Math.max(0, Math.min(100, Math.round((current / total) * 100)))
                    : 0;
                  const displayProgress = hasTotal 
                    ? (progressPercentage === 0 ? 5 : Math.max(progressPercentage, 1))
                    : 0;
                  
                  return (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: hasTotal ? `${displayProgress}%` : '30%',
                      background: hasTotal 
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      transition: hasTotal ? 'width 0.3s ease' : 'none',
                      animation: !hasTotal ? 'indeterminateProgress 1.5s ease-in-out infinite' : 'none',
                      zIndex: 0
                    }} />
                  );
                })()}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flex: '1 1 0',
                  minWidth: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <span className="material-icons" style={{ fontSize: '14px', color: isDownloadingCache ? '#10b981' : '#9ca3af', flexShrink: 0 }}>schedule</span>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                    flex: '1 1 0',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}>
                    <span style={{
                      fontSize: '11px',
                      color: isDownloadingCache ? '#059669' : '#374151',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isDownloadingCache ? '600' : '400',
                      lineHeight: '1.2'
                    }}>
                      {isDownloadingCache ? (
                        (() => {
                          const current = cacheDownloadProgress.current || 0;
                          const total = cacheDownloadProgress.total || 0;
                          const hasTotal = total > 0;
                          const progressPercentage = hasTotal && total > 0
                            ? Math.max(0, Math.min(100, Math.round((current / total) * 100)))
                            : 0;
                          
                          // Calculate ETA
                          const startTime = cacheDownloadStartTime || cacheDownloadStartTimeRef.current;
                          let eta = null;
                          if (hasTotal && startTime && current > 0 && current < total) {
                            const elapsed = Date.now() - startTime;
                            const elapsedSeconds = elapsed / 1000;
                            const rate = current / elapsedSeconds;
                            if (rate > 0 && isFinite(rate)) {
                              const remaining = total - current;
                              const remainingSeconds = remaining / rate;
                              if (isFinite(remainingSeconds) && remainingSeconds > 0) {
                                if (remainingSeconds < 60) {
                                  eta = `${Math.round(remainingSeconds)}s`;
                                } else if (remainingSeconds < 3600) {
                                  const minutes = Math.floor(remainingSeconds / 60);
                                  const seconds = Math.round(remainingSeconds % 60);
                                  eta = `${minutes}m ${seconds}s`;
                                } else {
                                  const hours = Math.floor(remainingSeconds / 3600);
                                  const minutes = Math.round((remainingSeconds % 3600) / 60);
                                  eta = `${hours}h ${minutes}m`;
                                }
                              }
                            }
                          }
                          
                          return hasTotal 
                            ? `Downloading: ${progressPercentage}%${eta ? ` • ETA: ${eta}` : ''}`
                            : 'Downloading...';
                        })()
                      ) : (
                        lastUpdated ? `Updated: ${lastUpdated.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No data loaded'
                      )}
                    </span>
                    {isDownloadingCache && (() => {
                      const current = cacheDownloadProgress.current || 0;
                      const total = cacheDownloadProgress.total || 0;
                      const hasTotal = total > 0;
                      if (hasTotal) {
                        return (
                          <span style={{
                            fontSize: '9px',
                            color: '#059669',
                            opacity: 0.8
                          }}>
                            {current} / {total} chunks
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading || !fromDate || !toDate || isDownloadingCache}
                  style={{
                    background: loading || !fromDate || !toDate || isDownloadingCache
                      ? '#e5e7eb'
                      : '#3b82f6',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '11px 16px',
                    cursor: loading || !fromDate || !toDate || isDownloadingCache ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: loading || !fromDate || !toDate || isDownloadingCache ? '#9ca3af' : '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    zIndex: 1,
                    boxShadow: (loading || !fromDate || !toDate || isDownloadingCache) ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2), 0 4px 8px rgba(59, 130, 246, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && fromDate && toDate && !isDownloadingCache) {
                      e.target.style.background = '#2563eb';
                      e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.25), 0 8px 12px rgba(59, 130, 246, 0.15)';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && fromDate && toDate && !isDownloadingCache) {
                      e.target.style.background = '#3b82f6';
                      e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2), 0 4px 8px rgba(59, 130, 246, 0.1)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <span className="material-icons" style={{
                    fontSize: '18px',
                    animation: (loading || isDownloadingCache) ? 'spin 1s linear infinite' : 'none'
                  }}>
                    refresh
                  </span>
                  <span>Refresh</span>
                </button>
                </div>
              </div>

              {/* Download Button and Settings */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <div style={{ position: 'relative', flex: '1' }} ref={downloadDropdownRef}>
                  <button
                    type="button"
                    title="Export"
                    onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '11px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      width: '100%',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2), 0 4px 8px rgba(16, 185, 129, 0.1)'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#059669';
                      e.target.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.25), 0 8px 12px rgba(16, 185, 129, 0.15)';
                      e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#10b981';
                      e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2), 0 4px 8px rgba(16, 185, 129, 0.1)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>download</span>
                    <span>Export</span>
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
                
                {/* Settings Icon Button */}
                <button
                  type="button"
                  title="Settings"
                  onClick={() => {
                    setShowSettingsModal(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 6px rgba(99, 102, 241, 0.25)',
                    flexShrink: 0,
                    width: '44px',
                    height: '44px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                    e.target.style.boxShadow = '0 3px 10px rgba(99, 102, 241, 0.35)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                    e.target.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.25)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '20px' }}>settings</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: windowWidth <= 1100 ? 'column' : 'row',
            alignItems: windowWidth <= 1100 ? 'stretch' : 'center',
            gap: windowWidth <= 1100 ? '12px' : '10px',
            flexWrap: windowWidth <= 1100 ? 'wrap' : 'nowrap',
            width: '100%',
            position: 'relative',
            overflow: 'visible'
          }}>
            {/* Desktop: Icon + Title Section */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flex: windowWidth <= 1100 ? '0 0 auto' : '0 1 auto',
              minWidth: windowWidth <= 1100 ? '100%' : '180px',
              maxWidth: windowWidth <= 1100 ? '100%' : '400px',
              overflow: 'hidden',
              width: windowWidth <= 1100 ? '100%' : 'auto'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <span className="material-icons" style={{ color: 'white', fontSize: '20px' }}>bar_chart</span>
              </div>
              <div style={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
                <h1 style={{
                  margin: 0,
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '700',
                  lineHeight: '1.2',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  Sales Analytics Dashboard
                </h1>
              </div>
            </div>

            {/* Desktop: Buttons */}
            {/* Create Custom Card Button - Desktop */}
            <div style={{ 
              flex: windowWidth <= 1100 ? '0 0 auto' : '0 1 auto', 
              display: 'flex', 
              alignItems: 'center', 
              flexShrink: windowWidth <= 1100 ? 0 : 1, 
              gap: '8px',
              width: windowWidth <= 1100 ? '100%' : 'auto',
              flexWrap: windowWidth <= 900 ? 'wrap' : 'nowrap'
            }}>
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
                      : '#22c55e',
                    color: sales.length === 0 ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    cursor: sales.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    whiteSpace: 'nowrap',
                    height: '32px',
                    boxShadow: sales.length === 0 ? 'none' : '0 2px 4px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(34, 197, 94, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (sales.length > 0) {
                      e.currentTarget.style.background = '#16a34a';
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(34, 197, 94, 0.25), 0 8px 12px rgba(34, 197, 94, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (sales.length > 0) {
                      e.currentTarget.style.background = '#22c55e';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(34, 197, 94, 0.1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>add_chart</span>
                  <span>Create Custom Card</span>
                </button>

              {/* Calendar Button - Desktop */}
                <button
                  type="button"
                  onClick={handleOpenCalendar}
                  title={fromDate && toDate ? `${fromDate} to ${toDate}` : 'Select date range'}
                  style={{
                    background: '#7c3aed',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    justifyContent: 'center',
                    height: '32px',
                    whiteSpace: 'nowrap',
                    minWidth: '140px',
                    maxWidth: isMobile ? '100%' : '220px',
                    boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2), 0 4px 8px rgba(124, 58, 237, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#6d28d9';
                    e.target.style.boxShadow = '0 4px 6px rgba(124, 58, 237, 0.25), 0 8px 12px rgba(124, 58, 237, 0.15)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#7c3aed';
                    e.target.style.boxShadow = '0 2px 4px rgba(124, 58, 237, 0.2), 0 4px 8px rgba(124, 58, 237, 0.1)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>calendar_today</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fromDate && toDate ? formatDateRangeForHeader(fromDate, toDate) : 'Date Range'}</span>
                </button>
              </div>

              {/* Last Updated & Refresh - Desktop */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'white',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 4px 8px rgba(0, 0, 0, 0.03)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  height: '32px',
                  minWidth: '200px',
                  maxWidth: isMobile ? '100%' : '320px'
                }}>
                {/* Progress Bar Background */}
                {isDownloadingCache && (() => {
                  const current = cacheDownloadProgress.current || 0;
                  const total = cacheDownloadProgress.total || 0;
                  const hasTotal = total > 0;
                  const progressPercentage = hasTotal && total > 0
                    ? Math.max(0, Math.min(100, Math.round((current / total) * 100)))
                    : 0;
                  const displayProgress = hasTotal 
                    ? (progressPercentage === 0 ? 5 : Math.max(progressPercentage, 1))
                    : 0;
                  
                  return (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: hasTotal ? `${displayProgress}%` : '30%',
                      background: hasTotal 
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                      transition: hasTotal ? 'width 0.3s ease' : 'none',
                      animation: !hasTotal ? 'indeterminateProgress 1.5s ease-in-out infinite' : 'none',
                      zIndex: 0
                    }} />
                  );
                })()}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  position: 'relative',
                  zIndex: 1
                }}>
                  <span className="material-icons" style={{ fontSize: '14px', color: isDownloadingCache ? '#10b981' : '#9ca3af' }}>schedule</span>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px',
                    minWidth: 0
                  }}>
                    <span style={{
                      fontSize: '11px',
                      color: isDownloadingCache ? '#059669' : '#374151',
                      whiteSpace: 'nowrap',
                      fontWeight: isDownloadingCache ? '600' : '400',
                      lineHeight: '1.2'
                    }}>
                      {isDownloadingCache ? (
                        (() => {
                          const current = cacheDownloadProgress.current || 0;
                          const total = cacheDownloadProgress.total || 0;
                          const hasTotal = total > 0;
                          const progressPercentage = hasTotal && total > 0
                            ? Math.max(0, Math.min(100, Math.round((current / total) * 100)))
                            : 0;
                          
                          // Calculate ETA
                          const startTime = cacheDownloadStartTime || cacheDownloadStartTimeRef.current;
                          let eta = null;
                          if (hasTotal && startTime && current > 0 && current < total) {
                            const elapsed = Date.now() - startTime;
                            const elapsedSeconds = elapsed / 1000;
                            const rate = current / elapsedSeconds;
                            if (rate > 0 && isFinite(rate)) {
                              const remaining = total - current;
                              const remainingSeconds = remaining / rate;
                              if (isFinite(remainingSeconds) && remainingSeconds > 0) {
                                if (remainingSeconds < 60) {
                                  eta = `${Math.round(remainingSeconds)}s`;
                                } else if (remainingSeconds < 3600) {
                                  const minutes = Math.floor(remainingSeconds / 60);
                                  const seconds = Math.round(remainingSeconds % 60);
                                  eta = `${minutes}m ${seconds}s`;
                                } else {
                                  const hours = Math.floor(remainingSeconds / 3600);
                                  const minutes = Math.round((remainingSeconds % 3600) / 60);
                                  eta = `${hours}h ${minutes}m`;
                                }
                              }
                            }
                          }
                          
                          return hasTotal 
                            ? `Downloading: ${progressPercentage}%${eta ? ` • ETA: ${eta}` : ''}`
                            : 'Downloading...';
                        })()
                      ) : (
                        lastUpdated ? `Updated: ${lastUpdated.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No data loaded'
                      )}
                    </span>
                    {isDownloadingCache && (() => {
                      const current = cacheDownloadProgress.current || 0;
                      const total = cacheDownloadProgress.total || 0;
                      const hasTotal = total > 0;
                      if (hasTotal) {
                        return (
                          <span style={{
                            fontSize: '9px',
                            color: '#059669',
                            opacity: 0.8,
                            whiteSpace: 'nowrap',
                            lineHeight: '1.1',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            minWidth: 0,
                            display: 'block'
                          }}>
                            {current} / {total} chunks
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading || !fromDate || !toDate || isDownloadingCache}
                  style={{
                    background: loading || !fromDate || !toDate || isDownloadingCache
                      ? '#e5e7eb'
                      : '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: loading || !fromDate || !toDate || isDownloadingCache ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: loading || !fromDate || !toDate || isDownloadingCache ? '#9ca3af' : '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    zIndex: 1,
                    height: '32px',
                    boxShadow: (loading || !fromDate || !toDate || isDownloadingCache) ? 'none' : '0 2px 4px rgba(59, 130, 246, 0.2), 0 4px 8px rgba(59, 130, 246, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && fromDate && toDate && !isDownloadingCache) {
                      e.target.style.background = '#2563eb';
                      e.target.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.25), 0 8px 12px rgba(59, 130, 246, 0.15)';
                      e.target.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && fromDate && toDate && !isDownloadingCache) {
                      e.target.style.background = '#3b82f6';
                      e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2), 0 4px 8px rgba(59, 130, 246, 0.1)';
                      e.target.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <span className="material-icons" style={{
                    fontSize: '16px',
                    animation: (loading || isDownloadingCache) ? 'spin 1s linear infinite' : 'none'
                  }}>
                    refresh
                  </span>
                  <span>Refresh</span>
                </button>
                </div>
              </div>

              {/* Right: Download Dropdown - Desktop */}
              <div style={{
                display: 'flex', 
                gap: '6px', 
                alignItems: 'center',
                flex: '0 0 auto',
                justifyContent: 'flex-end',
                minWidth: '100px',
                position: 'relative',
                flexShrink: 0
              }} ref={downloadDropdownRef}>
                <button
                  type="button"
                  title="Export"
                  onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    height: '32px',
                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2), 0 4px 8px rgba(16, 185, 129, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#059669';
                    e.target.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.25), 0 8px 12px rgba(16, 185, 129, 0.15)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#10b981';
                    e.target.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2), 0 4px 8px rgba(16, 185, 129, 0.1)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
                  <span>Export</span>
                  <span className="material-icons" style={{ fontSize: '16px' }}>
                    {showDownloadDropdown ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                
                {/* Settings Icon Button - Desktop */}
                <button
                  type="button"
                  title="Settings"
                  onClick={() => {
                    setShowSettingsModal(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '600',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(99, 102, 241, 0.2), 0 4px 8px rgba(99, 102, 241, 0.1)',
                    flexShrink: 0,
                    width: '32px',
                    height: '32px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                    e.target.style.boxShadow = '0 4px 6px rgba(99, 102, 241, 0.25), 0 8px 12px rgba(99, 102, 241, 0.15)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                    e.target.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.2), 0 4px 8px rgba(99, 102, 241, 0.1)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: '16px' }}>settings</span>
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

              {(dateRange.start !== '' && dateRange.end !== '' && dateRange.start === dateRange.end) && (
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
                  <span className="material-icons" style={{ fontSize: isMobile ? '12px' : '14px' }}>event</span>
                  {isMobile ? 'Date' : 'Date:'} {formatDateForDisplay(dateRange.start)}
                  <button
                    onClick={() => setDateRange({ start: '', end: '' })}
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
          {/* KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(7, minmax(0, 1fr))',
            gap: isMobile ? '12px' : '16px',
            marginBottom: isMobile ? '16px' : '28px'
          }}>
            {isCardVisible('Total Revenue') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#revenueGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Total Revenue')}
                    style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '9px' : '10px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    TOTAL REVENUE
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                    {formatCurrency(totalRevenue)}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#3b82f6' }}>account_balance_wallet</span>
                  </div>
                </div>
              </div>
            )}

            {isCardVisible('Total Invoices') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={invoiceTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="invoiceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#invoiceGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: isMobile ? '9px' : '10px', fontWeight: '600', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: '1.2' }}>
                    TOTAL INVOICES
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                    {totalOrders}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#16a34a' }}>shopping_cart</span>
                  </div>
                </div>
              </div>
            )}

            {isCardVisible('Unique Customers') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={customerTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="customerGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#customerGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Unique Customers')}
                    style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '9px' : '10px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    UNIQUE CUSTOMERS
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                    {uniqueCustomers}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: '#e9d5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#7c3aed' }}>people</span>
                  </div>
                </div>
              </div>
            )}

            {isCardVisible('Avg Invoice Value') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '0'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={avgInvoiceTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="avgInvoiceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#avgInvoiceGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Avg Invoice Value')}
                    style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '9px' : '10px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    AVG INVOICE VALUE
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                    {formatCurrency(avgOrderValue)}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#16a34a' }}>trending_up</span>
                  </div>
                </div>
              </div>
            )}

            {canShowProfit && isCardVisible('Total Profit') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '0'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '50%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#profitGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Total Profit')}
                    style={{ 
                      margin: '0 0 6px 0', 
                      fontSize: isMobile ? '9px' : '10px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    TOTAL PROFIT
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '16px' : '20px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
                    {formatCurrency(totalProfit)}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '32px' : '36px',
                    height: isMobile ? '32px' : '36px',
                    borderRadius: '6px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '8px',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '16px' : '18px', color: '#16a34a' }}>trending_up</span>
                  </div>
                </div>
              </div>
            )}

            {canShowProfit && isCardVisible('Profit Margin') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '0'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={profitMarginTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitMarginGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#ec4899" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#profitMarginGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Profit Margin')}
                    style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: isMobile ? '11px' : '12px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.3',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    PROFIT MARGIN
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                    {profitMargin >= 0 ? '+' : ''}{formatNumber(profitMargin, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '40px' : '48px',
                    height: isMobile ? '40px' : '48px',
                    borderRadius: '8px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 'auto',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#16a34a' }}>percent</span>
                  </div>
                </div>
              </div>
            )}

            {canShowProfit && isCardVisible('Avg Profit per Order') && (
              <div style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '16px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: '0'
              }}>
                {/* Background Area Chart */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60%',
                  opacity: 0.5,
                  pointerEvents: 'none'
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={avgProfitTrendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="avgProfitGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="url(#avgProfitGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <p 
                    onClick={() => openFullscreenCard('metric', 'Avg Profit per Order')}
                    style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: isMobile ? '11px' : '12px', 
                      fontWeight: '600', 
                      color: '#374151', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em', 
                      lineHeight: '1.3',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#1e293b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#374151'}
                    title="Click to open in fullscreen"
                  >
                    AVG PROFIT PER ORDER
                  </p>
                  <p style={{ margin: '0 0 auto 0', fontSize: isMobile ? '22px' : '28px', fontWeight: '700', color: '#16a34a', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                    {formatCurrency(avgProfitPerOrder)}
                  </p>
                  
                  {/* Icon in bottom right */}
                  <div style={{
                    width: isMobile ? '40px' : '48px',
                    height: isMobile ? '40px' : '48px',
                    borderRadius: '8px',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 'auto',
                    alignSelf: 'flex-end'
                  }}>
                    <span className="material-icons" style={{ fontSize: isMobile ? '20px' : '24px', color: '#16a34a' }}>trending_up</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Charts Section - All charts in a continuous grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px'
          }}>
            {/* Ledger Group Chart */}
            {isCardVisible('Sales by Ledger Group') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Sales by Ledger Group')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
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
                    formatValue={formatChartValue}
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
                    formatValue={formatChartValue}
                    formatCompactValue={formatChartCompactValue}
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
            )}

            {/* Salesperson Totals */}
            {isCardVisible('Salesperson Totals') && (
              <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: isMobile ? '400px' : '550px',
              minHeight: isMobile ? '350px' : '500px',
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
                    <h3 
                      onClick={() => openFullscreenCard('chart', 'Salesperson Totals')}
                      style={{ 
                        margin: 0, 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        color: '#1e293b',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                      title="Click to open in fullscreen"
                    >
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
            )}

            {/* Region Chart */}
            {isCardVisible('Sales by State') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Sales by State')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
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
                  <option value="geoMap">Geographic Map</option>
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
                  formatValue={formatChartValue}
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
                        <option value="geoMap">Geographic Map</option>
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
                        <option value="geoMap">Geographic Map</option>
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
                        <option value="geoMap">Geographic Map</option>
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
              {regionChartType === 'geoMap' && (
                <GeoMapChart
                  data={regionChartData.map(item => ({
                    name: item.label,
                    value: item.value
                  }))}
                  mapType="state"
                  chartSubType={regionMapSubType}
                  isMobile={isMobile}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={regionMapSubType}
                          onChange={(e) => setRegionMapSubType(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151'
                          }}
                        >
                          <option value="choropleth">Choropleth Map</option>
                        </select>
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
                          <option value="geoMap">Geographic Map</option>
                        </select>
                      </div>
                    </div>
                  }
                  onRegionClick={(region) => setSelectedRegion(region)}
                  onBackClick={() => setSelectedRegion('all')}
                  showBackButton={selectedRegion !== 'all'}
                />
              )}
              </div>
            )}

            {/* Country Chart */}
            {isCardVisible('Sales by Country') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Sales by Country')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
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
                  <option value="geoMap">Geographic Map</option>
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
                  formatValue={formatChartValue}
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
                        <option value="geoMap">Geographic Map</option>
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
                        <option value="geoMap">Geographic Map</option>
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
                        <option value="geoMap">Geographic Map</option>
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
              {countryChartType === 'geoMap' && (
                <GeoMapChart
                  data={countryChartData.map(item => ({
                    name: item.label,
                    value: item.value
                  }))}
                  mapType="country"
                  chartSubType={countryMapSubType}
                  isMobile={isMobile}
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={countryMapSubType}
                          onChange={(e) => setCountryMapSubType(e.target.value)}
                          style={{
                            padding: '6px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '12px',
                            background: 'white',
                            color: '#374151'
                          }}
                        >
                          <option value="choropleth">Choropleth Map</option>
                        </select>
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
                          <option value="geoMap">Geographic Map</option>
                        </select>
                      </div>
                    </div>
                  }
                  onRegionClick={(country) => setSelectedCountry(country)}
                  onBackClick={() => setSelectedCountry('all')}
                  showBackButton={selectedCountry !== 'all'}
                />
              )}
              </div>
            )}

            {/* Period Chart */}
            {isCardVisible('Sales by Period') && (
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
                  formatValue={formatChartValue}
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
                  formatValue={formatChartValue}
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
            )}

            {/* Top Customers */}
            {isCardVisible('Top Customers Chart') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Top Customers Chart')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
                  Top Customers Chart
                </h3>
                  {renderCardFilterBadges('topCustomers')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topCustomersNInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setTopCustomersNInput(inputValue);
                      if (inputValue === '') return;
                      const value = parseInt(inputValue, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopCustomersN(value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (isNaN(value) || value < 0) {
                        setTopCustomersN(10);
                        setTopCustomersNInput('10');
                      } else {
                        setTopCustomersN(value);
                        setTopCustomersNInput(String(value));
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
                  formatValue={formatChartValue}
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
                          value={topCustomersNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopCustomersNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopCustomersN(10);
                              setTopCustomersNInput('10');
                            } else {
                              setTopCustomersN(value);
                              setTopCustomersNInput(String(value));
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
                          value={topCustomersNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopCustomersNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopCustomersN(10);
                              setTopCustomersNInput('10');
                            } else {
                              setTopCustomersN(value);
                              setTopCustomersNInput(String(value));
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
                          value={topCustomersNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopCustomersNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopCustomersN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopCustomersN(10);
                              setTopCustomersNInput('10');
                            } else {
                              setTopCustomersN(value);
                              setTopCustomersNInput(String(value));
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
            )}

            {isCardVisible('Top Items by Revenue Chart') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Top Items by Revenue Chart')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
                  Top Items by Revenue Chart
                </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topItemsByRevenueNInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setTopItemsByRevenueNInput(inputValue);
                      if (inputValue === '') return;
                      const value = parseInt(inputValue, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopItemsByRevenueN(value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (isNaN(value) || value < 0) {
                        setTopItemsByRevenueN(10);
                        setTopItemsByRevenueNInput('10');
                      } else {
                        setTopItemsByRevenueN(value);
                        setTopItemsByRevenueNInput(String(value));
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
                  formatValue={formatChartValue}
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
                          value={topItemsByRevenueNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByRevenueNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByRevenueN(10);
                              setTopItemsByRevenueNInput('10');
                            } else {
                              setTopItemsByRevenueN(value);
                              setTopItemsByRevenueNInput(String(value));
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
                          value={topItemsByRevenueNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByRevenueNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByRevenueN(10);
                              setTopItemsByRevenueNInput('10');
                            } else {
                              setTopItemsByRevenueN(value);
                              setTopItemsByRevenueNInput(String(value));
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
                          value={topItemsByRevenueNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByRevenueNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByRevenueN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByRevenueN(10);
                              setTopItemsByRevenueNInput('10');
                            } else {
                              setTopItemsByRevenueN(value);
                              setTopItemsByRevenueNInput(String(value));
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
            )}
            {isCardVisible('Top Items by Quantity Chart') && (
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
                  formatValue={formatChartValue}
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
                <h3 
                  onClick={() => openFullscreenCard('chart', 'Top Items by Quantity Chart')}
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#1e293b',
                    cursor: 'pointer',
                    transition: 'color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                  title="Click to open in fullscreen"
                >
                  Top Items by Quantity Chart
                </h3>
                  {renderCardFilterBadges('topItems')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    value={topItemsByQuantityNInput}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      setTopItemsByQuantityNInput(inputValue);
                      if (inputValue === '') return;
                      const value = parseInt(inputValue, 10);
                      if (!isNaN(value) && value >= 0) {
                        setTopItemsByQuantityN(value);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (isNaN(value) || value < 0) {
                        setTopItemsByQuantityN(10);
                        setTopItemsByQuantityNInput('10');
                      } else {
                        setTopItemsByQuantityN(value);
                        setTopItemsByQuantityNInput(String(value));
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
                  formatValue={formatChartValue}
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
                          value={topItemsByQuantityNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByQuantityNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByQuantityN(10);
                              setTopItemsByQuantityNInput('10');
                            } else {
                              setTopItemsByQuantityN(value);
                              setTopItemsByQuantityNInput(String(value));
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
                          value={topItemsByQuantityNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByQuantityNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByQuantityN(10);
                              setTopItemsByQuantityNInput('10');
                            } else {
                              setTopItemsByQuantityN(value);
                              setTopItemsByQuantityNInput(String(value));
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
                          value={topItemsByQuantityNInput}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            setTopItemsByQuantityNInput(inputValue);
                            if (inputValue === '') return;
                            const value = parseInt(inputValue, 10);
                            if (value > 0) {
                              setTopItemsByQuantityN(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = parseInt(e.target.value, 10);
                            if (isNaN(value) || value < 1) {
                              setTopItemsByQuantityN(10);
                              setTopItemsByQuantityNInput('10');
                            } else {
                              setTopItemsByQuantityN(value);
                              setTopItemsByQuantityNInput(String(value));
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
            )}
          </div>

          {/* Profit-related Charts Section */}
          {canShowProfit && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: isMobile ? '16px' : '24px',
              marginBottom: isMobile ? '16px' : '24px'
            }}>
              {/* Revenue vs Profit Chart */}
              {isCardVisible('Revenue vs Profit') && (
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  height: '500px',
                  overflowY: 'auto',
                  overflowX: 'hidden'
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
                    <h3 
                      onClick={() => openFullscreenCard('chart', 'Revenue vs Profit')}
                      style={{ 
                        margin: 0, 
                        fontSize: '16px', 
                        fontWeight: '600', 
                        color: '#1e293b',
                        cursor: 'pointer',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                      title="Click to open in fullscreen"
                    >
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
                              Revenue: {formatCurrency(item.revenue)} | Profit: {formatCurrency(item.profit)}
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
              )}

              {/* Month-wise Profit Chart */}
              {isCardVisible('Month-wise Profit') && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '500px',
                  overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                {monthWiseProfitChartType === 'bar' && (
                   <BarChart
                     data={monthWiseProfitChartData}
                     formatValue={formatChartValue}
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
                     formatValue={formatChartValue}
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
                           <h3 
                             onClick={() => openFullscreenCard('chart', 'Month-wise Profit')}
                             style={{ 
                               margin: 0, 
                               fontSize: '16px', 
                               fontWeight: '600', 
                               color: '#1e293b',
                               cursor: 'pointer',
                               transition: 'color 0.2s ease'
                             }}
                             onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                             onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                             title="Click to open in fullscreen"
                           >
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
                           <h3 
                             onClick={() => openFullscreenCard('chart', 'Month-wise Profit')}
                             style={{ 
                               margin: 0, 
                               fontSize: '16px', 
                               fontWeight: '600', 
                               color: '#1e293b',
                               cursor: 'pointer',
                               transition: 'color 0.2s ease'
                             }}
                             onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                             onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                             title="Click to open in fullscreen"
                           >
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
                     formatValue={formatChartValue}
                     formatCompactValue={formatChartCompactValue}
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
                           <h3 
                             onClick={() => openFullscreenCard('chart', 'Month-wise Profit')}
                             style={{ 
                               margin: 0, 
                               fontSize: '16px', 
                               fontWeight: '600', 
                               color: '#1e293b',
                               cursor: 'pointer',
                               transition: 'color 0.2s ease'
                             }}
                             onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                             onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                             title="Click to open in fullscreen"
                           >
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
              )}

            {/* Top 10 Profitable Items */}
            {isCardVisible('Top Profitable Items') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
                overflow: 'hidden'
              }}>
              {topProfitableItemsChartType === 'bar' && (
                <BarChart
                  data={topProfitableItemsData}
                  formatValue={formatChartValue}
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
                  <h3 
                    onClick={() => openFullscreenCard('chart', 'Top Profitable Items')}
                    style={{ 
                      margin: 0, 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                    title="Click to open in fullscreen"
                  >
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
                  formatValue={formatChartValue}
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
            )}

            {/* Top 10 Loss Items */}
            {isCardVisible('Top Loss Items') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
                overflow: 'hidden'
              }}>
              {topLossItemsChartType === 'bar' && (
                <BarChart
                  data={topLossItemsData}
                  formatValue={formatChartValue}
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
                  <h3 
                    onClick={() => openFullscreenCard('chart', 'Top Loss Items')}
                    style={{ 
                      margin: 0, 
                      fontSize: '16px', 
                      fontWeight: '600', 
                      color: '#1e293b',
                      cursor: 'pointer',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
                    title="Click to open in fullscreen"
                  >
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
                  formatValue={formatChartValue}
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
                  formatValue={formatChartValue}
                  formatCompactValue={formatChartCompactValue}
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
            )}
          </div>
          )}

          {/* Sales by Stock Group (Position 13) and First Custom Card (Position 14) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0
          }}>
            {/* Sales by Stock Group - Position 13 */}
            {isCardVisible('Sales by Stock Group') && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
                overflow: 'hidden',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0
              }}>
              {categoryChartType === 'bar' && (
                <BarChart
                  data={categoryChartData}
                  formatValue={formatChartValue}
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
                    formatValue={formatChartValue}
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
                    formatValue={formatChartValue}
                    formatCompactValue={formatChartCompactValue}
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
            )}

            {/* First Custom Card - Position 14 */}
            {customCards.filter(card => isCardVisible(card.title)).length > 0 && (() => {
              const visibleCards = customCards.filter(card => isCardVisible(card.title));
              return (
                <div 
                  ref={visibleCards.length === 1 ? customCardsSectionRef : null}
                  style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}
                >
                  <CustomCard
                    key={visibleCards[0].id}
                    card={visibleCards[0]}
                    salesData={filteredSales}
                    generateCustomCardData={generateCustomCardData}
                    chartType={customCardChartTypes[visibleCards[0].id] || visibleCards[0].chartType || 'bar'}
                    onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [visibleCards[0].id]: newType }))}
                    onDelete={() => handleDeleteCustomCard(visibleCards[0].id)}
                    onEdit={handleEditCustomCard}
                    openTransactionRawData={openTransactionRawData}
                    openFullscreenCard={openFullscreenCard}
                    setSelectedCustomer={setSelectedCustomer}
                    setSelectedItem={setSelectedItem}
                    setSelectedStockGroup={setSelectedStockGroup}
                    setSelectedRegion={setSelectedRegion}
                    setSelectedCountry={setSelectedCountry}
                    setSelectedPeriod={setSelectedPeriod}
                    setSelectedLedgerGroup={setSelectedLedgerGroup}
                    setDateRange={setDateRange}
                    selectedCustomer={selectedCustomer}
                    selectedItem={selectedItem}
                    selectedStockGroup={selectedStockGroup}
                    selectedRegion={selectedRegion}
                    selectedCountry={selectedCountry}
                    selectedPeriod={selectedPeriod}
                    selectedLedgerGroup={selectedLedgerGroup}
                    dateRange={dateRange}
                    genericFilters={genericFilters}
                    setGenericFilters={setGenericFilters}
                    renderCardFilterBadges={renderCardFilterBadges}
                    customCards={customCards}
                    isMobile={isMobile}
                    formatPeriodLabel={formatPeriodLabel}
                    parseDateFromNewFormat={parseDateFromNewFormat}
                    parseDateFromAPI={parseDateFromAPI}
                    formatDateForDisplay={formatDateForDisplay}
                    formatChartValue={formatChartValue}
                    formatChartCompactValue={formatChartCompactValue}
                  />
                </div>
              );
            })()}
          </div>

          {/* Additional Custom Cards - Starting from Position 15, continuing sequentially */}
          {customCards.filter(card => isCardVisible(card.title)).length > 1 && (() => {
            // Process remaining custom cards (starting from index 1) in pairs for 2-column grid layout
            const visibleCards = customCards.filter(card => isCardVisible(card.title));
            const remainingCards = visibleCards.slice(1);
            const cardRows = [];
            for (let i = 0; i < remainingCards.length; i += 2) {
              const rowCards = remainingCards.slice(i, i + 2);
              cardRows.push(rowCards);
            }
            
            return cardRows.map((rowCards, rowIndex) => {
              const isLastRow = rowIndex === cardRows.length - 1;
              const shouldAttachRef = (rowIndex === 0 && remainingCards.length === 1) || 
                                     (rowIndex === 0 && remainingCards.length === 2) ||
                                     (isLastRow && rowCards.length === 1);
              
              return (
                <div
                  key={`custom-cards-row-${rowIndex}`}
                  ref={shouldAttachRef ? customCardsSectionRef : null}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: isMobile ? '16px' : '24px',
                    marginBottom: isMobile ? '16px' : '24px',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0
                  }}
                >
                  {rowCards.map((card, cardIndex) => (
                    <div key={card.id} style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                      <CustomCard
                        card={card}
                        salesData={filteredSales}
                        generateCustomCardData={generateCustomCardData}
                        chartType={customCardChartTypes[card.id] || card.chartType || 'bar'}
                        onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [card.id]: newType }))}
                        onDelete={() => handleDeleteCustomCard(card.id)}
                        onEdit={handleEditCustomCard}
                        openTransactionRawData={openTransactionRawData}
                        openFullscreenCard={openFullscreenCard}
                        setSelectedCustomer={setSelectedCustomer}
                        setSelectedItem={setSelectedItem}
                        setSelectedStockGroup={setSelectedStockGroup}
                        setSelectedRegion={setSelectedRegion}
                        setSelectedCountry={setSelectedCountry}
                        setSelectedPeriod={setSelectedPeriod}
                        setSelectedLedgerGroup={setSelectedLedgerGroup}
                        setDateRange={setDateRange}
                        selectedCustomer={selectedCustomer}
                        selectedItem={selectedItem}
                        selectedStockGroup={selectedStockGroup}
                        selectedRegion={selectedRegion}
                        selectedCountry={selectedCountry}
                        selectedPeriod={selectedPeriod}
                        selectedLedgerGroup={selectedLedgerGroup}
                        dateRange={dateRange}
                        genericFilters={genericFilters}
                        setGenericFilters={setGenericFilters}
                        renderCardFilterBadges={renderCardFilterBadges}
                        customCards={customCards}
                        isMobile={isMobile}
                        formatPeriodLabel={formatPeriodLabel}
                        parseDateFromNewFormat={parseDateFromNewFormat}
                        parseDateFromAPI={parseDateFromAPI}
                        formatDateForDisplay={formatDateForDisplay}
                        formatChartValue={formatChartValue}
                        formatChartCompactValue={formatChartCompactValue}
                      />
                    </div>
                  ))}
                </div>
              );
            });
          })()}
          
        </div>
        </form>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
              {salespersonFormula ? (
                <div style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                  Salesperson formula: <span style={{ fontWeight: 600, color: '#1e293b' }}>{salespersonFormula}</span>
                </div>
              ) : null}
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
            {Object.keys(columnFilters).length > 0 && (
              <button
                type="button"
                onClick={clearAllColumnFilters}
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
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.2)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.2)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>filter_alt_off</span>
                Clear All Filters ({Object.keys(columnFilters).length})
              </button>
            )}
            <div style={{ position: 'relative' }} data-sort-dropdown>
              <button
                type="button"
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                style={{
                  background: rawDataSortBy ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
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
                  boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(99, 102, 241, 0.2)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>sort</span>
                Sort{rawDataSortBy ? `: ${rawDataSortBy === 'date' ? 'Date' : rawDataSortBy === 'quantity' ? 'Quantity' : 'Amount'} (${rawDataSortOrder === 'asc' ? '↑' : '↓'})` : ''}
              </button>
              {showSortDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    minWidth: '200px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: '#f8fafc',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#374151'
                  }}>
                    Sort By
                  </div>
                  {['date', 'quantity', 'amount'].map((sortKey) => {
                    const labels = { date: 'Date', quantity: 'Quantity', amount: 'Amount' };
                    const isActive = rawDataSortBy === sortKey;
                    return (
                      <div
                        key={sortKey}
                        onClick={() => {
                          if (isActive) {
                            // Toggle sort order if same column clicked
                            setRawDataSortOrder(rawDataSortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            // Set new sort column and default to ascending
                            setRawDataSortBy(sortKey);
                            setRawDataSortOrder('asc');
                          }
                          setRawDataPage(1);
                          setRawDataPageInput('1');
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: isActive ? '#eff6ff' : 'transparent',
                          borderBottom: sortKey !== 'amount' ? '1px solid #f1f5f9' : 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <span style={{ fontSize: 14, color: '#1e293b', fontWeight: isActive ? 600 : 400 }}>
                          {labels[sortKey]}
                        </span>
                        {isActive && (
                          <span className="material-icons" style={{ fontSize: 18, color: '#3b82f6' }}>
                            {rawDataSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {rawDataSortBy && (
                    <div
                      onClick={() => {
                        setRawDataSortBy(null);
                        setRawDataSortOrder('asc');
                        setRawDataPage(1);
                        setRawDataPageInput('1');
                      }}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderTop: '1px solid #e2e8f0',
                        backgroundColor: '#fee2e2',
                        fontSize: 14,
                        color: '#b91c1c',
                        fontWeight: 600,
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fecaca';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#fee2e2';
                      }}
                    >
                      Clear Sort
                    </div>
                  )}
                </div>
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
                  {/* Column Labels Row */}
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {rawDataModal.columns.map((column) => (
                      <th
                        key={column.key}
                        style={{
                          padding: '8px 16px 4px 16px',
                          textAlign: column.format ? 'right' : 'left',
                          fontSize: '11px',
                          color: '#64748b',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: 600,
                          position: 'sticky',
                          top: 0,
                          background: '#f8fafc',
                          zIndex: 2,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                  {/* Filter Inputs Row */}
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    {rawDataModal.columns.map((column) => (
                      <th
                        key={`filter-${column.key}`}
                        style={{
                          padding: '4px 16px 8px 16px',
                          textAlign: 'left',
                          position: 'sticky',
                          top: '32px',
                          background: '#f8fafc',
                          zIndex: 2
                        }}
                      >
                        {renderColumnFilter(column)}
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
              <span style={{ fontSize: '13px', color: '#64748b' }}>Show</span>
              <input
                type="number"
                value={rawDataPageSizeInput}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setRawDataPageSizeInput(inputValue);
                  if (inputValue === '') return;
                  const value = parseInt(inputValue, 10);
                  if (!isNaN(value) && value > 0) {
                    setRawDataPageSize(value);
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (isNaN(value) || value < 1) {
                    setRawDataPageSize(20);
                    setRawDataPageSizeInput('20');
                  } else {
                    setRawDataPageSize(value);
                    setRawDataPageSizeInput(String(value));
                  }
                }}
                min="1"
                placeholder="20"
                style={{
                  width: '60px',
                  padding: '6px 8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '12px',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '13px', color: '#64748b' }}>entries per page</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const newPage = Math.max(1, rawDataPage - 1);
                  setRawDataPage(newPage);
                  setRawDataPageInput(String(newPage));
                }}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#1e293b' }}>
                <span>Page</span>
                <input
                  type="number"
                  value={totalRawRows === 0 ? 0 : rawDataPageInput}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    setRawDataPageInput(inputValue);
                    if (inputValue === '') return;
                    const value = parseInt(inputValue, 10);
                    if (!isNaN(value) && value >= 1 && value <= totalRawPages) {
                      setRawDataPage(value);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (isNaN(value) || value < 1) {
                      setRawDataPage(1);
                      setRawDataPageInput('1');
                    } else if (value > totalRawPages) {
                      setRawDataPage(totalRawPages);
                      setRawDataPageInput(String(totalRawPages));
                    } else {
                      setRawDataPage(value);
                      setRawDataPageInput(String(value));
                    }
                  }}
                  min="1"
                  max={totalRawPages}
                  disabled={totalRawRows === 0}
                  style={{
                    width: '40px',
                    padding: '4px 6px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '13px',
                    textAlign: 'center',
                    color: '#1e293b',
                    background: totalRawRows === 0 ? '#f1f5f9' : 'white'
                  }}
                />
                <span>/ {totalRawRows === 0 ? 0 : totalRawPages}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newPage = Math.min(totalRawPages, rawDataPage + 1);
                  setRawDataPage(newPage);
                  setRawDataPageInput(String(newPage));
                }}
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
      <VoucherDetailsModal
        masterId={selectedMasterId}
        headerActions={salespersonFormula ? (
          <div style={{ fontSize: '12px', color: '#ffffff', whiteSpace: 'nowrap', opacity: 0.95 }}>
            Salesperson formula: <span style={{ fontWeight: 600, color: '#ffffff' }}>{salespersonFormula}</span>
          </div>
        ) : null}
        onClose={() => {
          setShowVoucherDetails(false);
          setSelectedMasterId(null);
        }}
      />
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
          // Don't close modal if clicking on calendar popover
          const isCalendarClick = e.target.closest('.MuiPickersPopper-root') ||
                                   e.target.closest('.MuiPickersCalendar-root') ||
                                   e.target.closest('[role="dialog"]');
          
          if (e.target === e.currentTarget && !isCalendarClick) {
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
              Select Period
            </h2>
            <p style={{
              fontSize: '13px',
              color: '#64748b',
              margin: 0
            }}>
              Choose a period or select custom dates
            </p>
          </div>

          {/* Period Selection Options */}
          {!selectedPeriodType && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginBottom: '16px'
              }}>
                {[
                  { type: 'financial-year', label: 'Financial Yr Start till Date', icon: 'account_balance' },
                  { type: 'quarter', label: 'Qtr Start till Date', icon: 'view_module' },
                  { type: 'month', label: 'Month Start till Date', icon: 'calendar_view_month' },
                  { type: 'today', label: 'Today', icon: 'today' },
                  { type: 'yesterday', label: 'Yesterday', icon: 'history' },
                  { type: 'week', label: 'For the week', icon: 'date_range' },
                  { type: 'custom', label: 'Custom period', icon: 'edit_calendar', colSpan: 2 }
                ].map((period) => (
                  <button
                    key={period.type}
                    type="button"
                    onClick={() => handlePeriodSelection(period.type)}
                    style={{
                      gridColumn: period.colSpan === 2 ? 'span 2' : 'auto',
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      background: 'white',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: 'center',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f8fafc';
                      e.target.style.borderColor = '#7c3aed';
                      e.target.style.color = '#7c3aed';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'white';
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.color = '#475569';
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>{period.icon}</span>
                    <span>{period.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}


          {/* Show selected period dates preview when a period is selected (not custom) */}
          {selectedPeriodType && selectedPeriodType !== 'custom' && (
            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '2px solid #e2e8f0'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#7c3aed' }}>info</span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569'
                }}>
                  Selected Period: {
                    selectedPeriodType === 'financial-year' ? 'Financial Yr Start till Date' :
                    selectedPeriodType === 'quarter' ? 'Qtr Start till Date' :
                    selectedPeriodType === 'month' ? 'Month Start till Date' :
                    selectedPeriodType === 'today' ? 'Today' :
                    selectedPeriodType === 'yesterday' ? 'Yesterday' :
                    selectedPeriodType === 'week' ? 'For the week' : ''
                  }
                </span>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
                color: '#64748b'
              }}>
                <div><strong>From:</strong> {tempFromDateDisplay || formatDateForInput(tempFromDate)}</div>
                <div><strong>To:</strong> {tempToDateDisplay || formatDateForInput(tempToDate)}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriodType(null);
                  setTempFromDate(fromDate);
                  setTempToDate(toDate);
                  setTempFromDateDisplay(formatDateForInput(fromDate));
                  setTempToDateDisplay(formatDateForInput(toDate));
                }}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e2e8f0';
                }}
              >
                Change Period
              </button>
            </div>
          )}

          {/* Custom Date Picker - Show only when Custom period is selected */}
          {selectedPeriodType === 'custom' && (
            <>
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
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={tempFromDateDisplay}
                    placeholder="1-Apr-25"
                    onChange={(e) => {
                      setTempFromDateDisplay(e.target.value);
                      // Try to parse and update internal format on the fly
                      const parsed = parseDateFromNewFormat(e.target.value);
                      if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
                        setTempFromDate(parsed);
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and format on blur
                      const value = e.target.value.trim();
                      if (value) {
                        const parsed = parseDateFromNewFormat(value);
                        if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
                          setTempFromDate(parsed);
                          setTempFromDateDisplay(formatDateForInput(parsed));
                        } else {
                          // Invalid format, try to keep what user typed but show error
                          e.target.style.borderColor = '#ef4444';
                        }
                      }
                      e.target.style.boxShadow = 'none';
                    }}
                    style={{
                      width: 'calc(100% - 44px)',
                      maxWidth: '100%',
                      padding: '8px 12px',
                      paddingRight: '44px',
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
                  />
                  <button
                    ref={fromDateButtonRef}
                    type="button"
                    onClick={() => setShowFromDatePicker(!showFromDatePicker)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7c3aed',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3e8ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Open calendar"
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>calendar_month</span>
                  </button>
                  <div 
                    ref={fromDatePickerRef}
                    style={{ position: 'absolute', top: '100%', right: '4px', zIndex: 18000 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        value={stringToDate(tempFromDate)}
                        onChange={handleFromDateChange}
                        minDate={booksFromDate ? stringToDate(booksFromDate) : undefined}
                        open={showFromDatePicker}
                        onClose={() => setShowFromDatePicker(false)}
                        closeOnSelect={false}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { 
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              width: '1px',
                              height: '1px',
                              opacity: 0,
                              pointerEvents: 'none'
                            }
                          },
                          popper: {
                            anchorEl: fromDateButtonRef.current,
                            placement: 'bottom-end',
                            style: { zIndex: 18000 },
                            onClick: (e) => e.stopPropagation()
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                </div>
                {booksFromDate && (
                  <p style={{
                    fontSize: '11px',
                    color: '#64748b',
                    marginTop: '4px',
                    marginBottom: 0
                  }}>
                    Earliest available date: {formatDateForInput(booksFromDate)}
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
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={tempToDateDisplay}
                    placeholder="15-Jan-24"
                    onChange={(e) => {
                      setTempToDateDisplay(e.target.value);
                      // Try to parse and update internal format on the fly
                      const parsed = parseDateFromNewFormat(e.target.value);
                      if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
                        setTempToDate(parsed);
                      }
                    }}
                    onBlur={(e) => {
                      // Validate and format on blur
                      const value = e.target.value.trim();
                      if (value) {
                        const parsed = parseDateFromNewFormat(value);
                        if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
                          setTempToDate(parsed);
                          setTempToDateDisplay(formatDateForInput(parsed));
                        } else {
                          // Invalid format, try to keep what user typed but show error
                          e.target.style.borderColor = '#ef4444';
                        }
                      }
                      e.target.style.boxShadow = 'none';
                    }}
                    style={{
                      width: 'calc(100% - 44px)',
                      maxWidth: '100%',
                      padding: '8px 12px',
                      paddingRight: '44px',
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
                  />
                  <button
                    ref={toDateButtonRef}
                    type="button"
                    onClick={() => setShowToDatePicker(!showToDatePicker)}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7c3aed',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3e8ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    title="Open calendar"
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>calendar_month</span>
                  </button>
                  <div 
                    ref={toDatePickerRef}
                    style={{ position: 'absolute', top: '100%', right: '4px', zIndex: 18000 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        value={stringToDate(tempToDate)}
                        onChange={handleToDateChange}
                        minDate={tempFromDate ? stringToDate(tempFromDate) : (booksFromDate ? stringToDate(booksFromDate) : undefined)}
                        open={showToDatePicker}
                        onClose={() => setShowToDatePicker(false)}
                        closeOnSelect={false}
                        slotProps={{
                          textField: {
                            size: 'small',
                            sx: { 
                              position: 'absolute',
                              top: 0,
                              right: 0,
                              width: '1px',
                              height: '1px',
                              opacity: 0,
                              pointerEvents: 'none'
                            }
                          },
                          popper: {
                            anchorEl: toDateButtonRef.current,
                            placement: 'bottom-end',
                            style: { zIndex: 18000 },
                            onClick: (e) => e.stopPropagation()
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                </div>
              </div>
            </>
          )}

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

    {/* Resume Download Modal */}
    <ResumeDownloadModal
      isOpen={showResumeModal}
      onContinue={handleResumeContinue}
      onStartFresh={handleResumeStartFresh}
      onClose={() => {
        // Mark this interruption as dismissed so it won't show again
        if (interruptedProgress) {
          const interruptionKey = `${interruptedProgress.companyGuid}_${interruptedProgress.current}_${interruptedProgress.total}`;
          dismissedInterruptionsRef.current.add(interruptionKey);
        }
        setShowResumeModal(false);
      }}
      progress={interruptedProgress || { current: 0, total: 0 }}
      companyName={interruptedProgress?.companyName || 'this company'}
    />

    {/* Settings Modal - Card Titles */}
    {showSettingsModal && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 18000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowSettingsModal(false);
          }
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '24px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#1e293b',
                margin: '0 0 4px 0'
              }}>
                Dashboard Settings
              </h2>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                margin: 0
              }}>
                
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f1f5f9';
              }}
              title="Close"
            >
              <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '8px',
            marginRight: '-8px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {(() => {
                const sections = getCardTitlesBySection();
                
                // Key Metrics Section
                if (sections.keyMetrics.length > 0) {
                  return (
                    <>
                      <div>
                        <h3 style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: '#1e293b',
                          margin: '0 0 10px 0',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px', color: '#3b82f6' }}>analytics</span>
                          Key Metrics
                        </h3>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '8px'
                        }}>
                          {sections.keyMetrics.map((title, index) => {
                            const isVisible = isCardVisible(title);
                            return (
                              <div
                                key={`metric-${index}`}
                                style={{
                                  padding: '8px 10px',
                                  background: '#f8fafc',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'all 0.2s ease',
                                  opacity: isVisible ? 1 : 0.6,
                                  cursor: 'pointer'
                                }}
                                onClick={() => toggleCardVisibility(title)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f1f5f9';
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#f8fafc';
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={() => {}}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    cursor: 'pointer',
                                    accentColor: '#3b82f6',
                                    flexShrink: 0,
                                    pointerEvents: 'none'
                                  }}
                                />
                                <span style={{
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  color: '#1e293b',
                                  flex: 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Charts Section */}
                      {sections.charts.length > 0 && (
                        <div>
                          <h3 style={{
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#1e293b',
                            margin: '0 0 10px 0',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span className="material-icons" style={{ fontSize: '16px', color: '#10b981' }}>bar_chart</span>
                            Charts
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px'
                          }}>
                            {sections.charts.map((title, index) => {
                              const isVisible = isCardVisible(title);
                              return (
                                <div
                                  key={`chart-${index}`}
                                  style={{
                                    padding: '8px 10px',
                                    background: '#f8fafc',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    opacity: isVisible ? 1 : 0.6,
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => toggleCardVisibility(title)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f8fafc';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() => {}}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      cursor: 'pointer',
                                      accentColor: '#10b981',
                                      flexShrink: 0,
                                      pointerEvents: 'none'
                                    }}
                                  />
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#1e293b',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {title}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Custom Cards Section */}
                      {sections.customCards.length > 0 && (
                        <div>
                          <h3 style={{
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#1e293b',
                            margin: '0 0 10px 0',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <span className="material-icons" style={{ fontSize: '16px', color: '#9333ea' }}>dashboard_customize</span>
                            Custom Cards
                          </h3>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px'
                          }}>
                            {sections.customCards.map((title, index) => {
                              const isVisible = isCardVisible(title);
                              return (
                                <div
                                  key={`custom-${index}`}
                                  style={{
                                    padding: '8px 10px',
                                    background: '#f8fafc',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    opacity: isVisible ? 1 : 0.6,
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => toggleCardVisibility(title)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f8fafc';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={() => {}}
                                    style={{
                                      width: '16px',
                                      height: '16px',
                                      cursor: 'pointer',
                                      accentColor: '#9333ea',
                                      flexShrink: 0,
                                      pointerEvents: 'none'
                                    }}
                                  />
                                  <span style={{
                                    fontSize: '13px',
                                    fontWeight: '500',
                                    color: '#1e293b',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {title}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                }
                return null;
              })()}
              
              {/* Number Format Section */}
              <div style={{
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <h3 style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: '0 0 12px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span className="material-icons" style={{ fontSize: '16px', color: '#8b5cf6' }}>numbers</span>
                  Number Format
                </h3>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setNumberFormat('indian')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        Lakhs & Crores (Indian)
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>
                        Example: 1,00,000 (1 Lakh), 1,00,00,000 (1 Crore)
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="numberFormat"
                      checked={numberFormat === 'indian'}
                      onChange={() => setNumberFormat('indian')}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#8b5cf6',
                        flexShrink: 0
                      }}
                    />
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: '#fff',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setNumberFormat('international')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#1e293b'
                      }}>
                        Millions & Billions (International)
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: '#64748b'
                      }}>
                        Example: 100,000 (100K), 1,000,000 (1M)
                      </span>
                    </div>
                    <input
                      type="radio"
                      name="numberFormat"
                      checked={numberFormat === 'international'}
                      onChange={() => setNumberFormat('international')}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#8b5cf6',
                        flexShrink: 0
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px rgba(99, 102, 241, 0.25)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)';
                e.target.style.boxShadow = '0 6px 10px rgba(99, 102, 241, 0.35)';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
                e.target.style.boxShadow = '0 4px 6px rgba(99, 102, 241, 0.25)';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Fullscreen Card Modal */}
    {fullscreenCard && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: 'auto',
          width: 'auto',
          background: '#ffffff',
          zIndex: 13000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            background: '#f8fafc'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            {fullscreenCard.title}
          </h2>
          <button
            type="button"
            onClick={closeFullscreenCard}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              borderRadius: '50%',
              padding: '8px',
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
            title="Close fullscreen"
          >
            <span className="material-icons" style={{ fontSize: '28px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            padding: '24px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          {fullscreenCard.type === 'metric' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100%'
            }}>
              {fullscreenCard.title === 'Total Revenue' && isCardVisible('Total Revenue') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(22, 163, 74, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: '#16a34a' }}>
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>
              )}
              {fullscreenCard.title === 'Total Invoices' && isCardVisible('Total Invoices') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(236, 72, 153, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: '#ec4899' }}>
                    {totalOrders.toLocaleString()}
                  </p>
                </div>
              )}
              {fullscreenCard.title === 'Unique Customers' && isCardVisible('Unique Customers') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(147, 51, 234, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: '#9333ea' }}>
                    {uniqueCustomers}
                  </p>
                </div>
              )}
              {fullscreenCard.title === 'Avg Invoice Value' && isCardVisible('Avg Invoice Value') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(217, 119, 6, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: '#d97706' }}>
                    {formatCurrency(avgOrderValue)}
                  </p>
                </div>
              )}
              {canShowProfit && fullscreenCard.title === 'Total Profit' && isCardVisible('Total Profit') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: totalProfit >= 0 ? '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(220, 38, 38, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: totalProfit >= 0 ? '#2563eb' : '#dc2626' }}>
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
              )}
              {canShowProfit && fullscreenCard.title === 'Profit Margin' && isCardVisible('Profit Margin') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: profitMargin >= 0 ? '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(234, 88, 12, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(220, 38, 38, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: profitMargin >= 0 ? '#ea580c' : '#dc2626' }}>
                    {profitMargin >= 0 ? '+' : ''}{formatNumber(profitMargin, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </p>
                </div>
              )}
              {canShowProfit && fullscreenCard.title === 'Avg Profit per Order' && isCardVisible('Avg Profit per Order') && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '18px',
                  padding: '60px',
                  border: '1px solid #e2e8f0',
                  boxShadow: avgProfitPerOrder >= 0 ? '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(8, 145, 178, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(220, 38, 38, 0.08)',
                  textAlign: 'center',
                  minWidth: '400px'
                }}>
                  <p style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                    {fullscreenCard.title}
                  </p>
                  <p style={{ margin: '0', fontSize: '64px', fontWeight: '700', color: avgProfitPerOrder >= 0 ? '#0891b2' : '#dc2626' }}>
                    {formatCurrency(avgProfitPerOrder)}
                  </p>
                </div>
              )}
            </div>
          )}

          {fullscreenCard.type === 'chart' && (
            <div style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Render the appropriate chart based on title */}
              {fullscreenCard.title === 'Top Customers Chart' && isCardVisible('Top Customers Chart') && (
                <>
                  {topCustomersChartType === 'bar' && (
                    <BarChart
                      data={topCustomersData}
                      formatValue={formatChartValue}
                      customHeader={null}
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
                      formatValue={formatChartValue}
                      customHeader={null}
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
                      customHeader={null}
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
                      formatValue={formatChartValue}
                      formatCompactValue={formatChartCompactValue}
                      customHeader={null}
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
                </>
              )}
              {/* Note: For other chart cards, you would add similar blocks. 
                  For brevity, I'm showing the pattern with Top Customers Chart.
                  The same pattern can be applied to all other chart cards. */}
            </div>
          )}

          {fullscreenCard.type === 'custom' && fullscreenCard.cardId && (
            <div style={{ flex: 1, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {(() => {
                const card = customCards.find(c => c.id === fullscreenCard.cardId);
                if (!card) return null;
                return (
                  <CustomCard
                    key={card.id}
                    card={card}
                    salesData={filteredSales}
                    generateCustomCardData={generateCustomCardData}
                    chartType={customCardChartTypes[card.id] || card.chartType || 'bar'}
                    onChartTypeChange={(newType) => setCustomCardChartTypes(prev => ({ ...prev, [card.id]: newType }))}
                    onDelete={() => handleDeleteCustomCard(card.id)}
                    onEdit={handleEditCustomCard}
                    openTransactionRawData={openTransactionRawData}
                    openFullscreenCard={openFullscreenCard}
                    setSelectedCustomer={setSelectedCustomer}
                    setSelectedItem={setSelectedItem}
                    setSelectedStockGroup={setSelectedStockGroup}
                    setSelectedRegion={setSelectedRegion}
                    setSelectedCountry={setSelectedCountry}
                    setSelectedPeriod={setSelectedPeriod}
                    setSelectedLedgerGroup={setSelectedLedgerGroup}
                    setDateRange={setDateRange}
                    selectedCustomer={selectedCustomer}
                    selectedItem={selectedItem}
                    selectedStockGroup={selectedStockGroup}
                    selectedRegion={selectedRegion}
                    selectedCountry={selectedCountry}
                    selectedPeriod={selectedPeriod}
                    selectedLedgerGroup={selectedLedgerGroup}
                    dateRange={dateRange}
                    genericFilters={genericFilters}
                    setGenericFilters={setGenericFilters}
                    renderCardFilterBadges={renderCardFilterBadges}
                    customCards={customCards}
                    isMobile={isMobile}
                    formatPeriodLabel={formatPeriodLabel}
                    parseDateFromNewFormat={parseDateFromNewFormat}
                    parseDateFromAPI={parseDateFromAPI}
                    formatDateForDisplay={formatDateForDisplay}
                    formatChartValue={formatChartValue}
                    formatChartCompactValue={formatChartCompactValue}
                  />
                );
              })()}
            </div>
          )}
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
  const [chartType, setChartType] = useState(editingCard?.chartType || 'bar');
  const [mapSubType, setMapSubType] = useState(editingCard?.mapSubType || 'choropleth');
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
    // Initialize from editingCard if available, but default to 'day' for new cards
    if (editingCard && editingCard.groupBy === 'date' && editingCard.dateGrouping) {
      return {
        date: editingCard.dateGrouping
      };
    }
    // Default to empty - will be set to 'day' when date field is selected
    return {};
  });
  // Multiple filters support - array of { field: string, values: Set<string> }
  const [filters, setFilters] = useState(() => {
    // Initialize from editingCard if available
    if (editingCard && editingCard.filters && editingCard.filters.length > 0) {
      return editingCard.filters.map(f => ({
        field: f.filterField,
        values: new Set(f.filterValues || [])
      }));
    }
    return [];
  });
  // Current filter being configured
  const [currentFilterField, setCurrentFilterField] = useState('');
  const [currentFilterValues, setCurrentFilterValues] = useState(new Set());
  const [filterValuesSearchTerm, setFilterValuesSearchTerm] = useState('');
  const [filterFieldSearchTerm, setFilterFieldSearchTerm] = useState('');
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [fieldBeingConfigured, setFieldBeingConfigured] = useState(null);
  const [isDateSettingsModal, setIsDateSettingsModal] = useState(false);

  // AI mode state
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'ai'
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  
  // Stacking state
  const [enableStacking, setEnableStacking] = useState(editingCard?.enableStacking || false);
  const [segmentBy, setSegmentBy] = useState(editingCard?.segmentBy || '');
  // Multi-axis series state
  const [multiAxisSeries, setMultiAxisSeries] = useState(editingCard?.multiAxisSeries || []);

  // Update form when editingCard changes
  useEffect(() => {
    if (editingCard) {
      setCardTitle(editingCard.title || '');
      setChartType(editingCard.chartType || 'bar');
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
      
      // Set filters
      if (editingCard.filters && Array.isArray(editingCard.filters) && editingCard.filters.length > 0) {
        setFilters(editingCard.filters.map(f => ({
          field: f.filterField,
          values: new Set(f.filterValues || [])
        })));
      } else {
        setFilters([]);
      }
      
      // Set stacking options
      setEnableStacking(editingCard.enableStacking || false);
      setSegmentBy(editingCard.segmentBy || '');
      // Set multi-axis series
      setMultiAxisSeries(editingCard.multiAxisSeries || []);
    } else {
      // Reset to defaults when not editing
      setCardTitle('');
      setChartType('bar');
      setMapSubType('choropleth');
      setSelectedFields(new Set());
      setTopN('');
      setFilters([]);
      setCurrentFilterField('');
      setCurrentFilterValues(new Set());
      setFilterValuesSearchTerm('');
      setFilterFieldSearchTerm('');
      setEnableStacking(false);
      setSegmentBy('');
      setMultiAxisSeries([]);
    }
  }, [editingCard]);

  // Auto-set mapSubType to 'scatter' for pincode maps
  useEffect(() => {
    if (chartType === 'geoMap') {
      const selectedGroupBy = Array.from(selectedFields).find(f => 
        f.toLowerCase().includes('pincode')
      ) || (selectedFields.size > 0 ? Array.from(selectedFields)[0] : '');
      
      if (selectedGroupBy && selectedGroupBy.toLowerCase().includes('pincode')) {
        // Auto-set to scatter for pincode maps if not already set
        if (mapSubType !== 'scatter') {
          setMapSubType('scatter');
        }
      } else if (selectedGroupBy && (selectedGroupBy.toLowerCase().includes('state') || 
                                     selectedGroupBy.toLowerCase().includes('region') || 
                                     selectedGroupBy.toLowerCase().includes('country'))) {
        // Auto-set to choropleth for state/country maps if not already set
        if (mapSubType !== 'choropleth') {
          setMapSubType('choropleth');
        }
      }
    }
  }, [selectedFields, chartType, mapSubType]);

  // Field name to user-friendly label mapping (based on new API field names)
  const fieldLabelMap = {
    // Customer/Party fields
    'partyledgername': 'Party Ledger Name',
    'customer': 'Customer',
    'party': 'Party',
    'partyledgernameid': 'Party Ledger Name ID',
    'partyid': 'Party ID',
    'partygstin': 'Party GSTIN',
    
    // Item/Inventory fields
    'stockitemname': 'Stock Item Name',
    'item': 'Item',
    'stockitemnameid': 'Stock Item Name ID',
    'itemid': 'Item ID',
    'stockitemcategory': 'Stock Item Category',
    'stockitemgroup': 'Stock Item Group',
    'category': 'Category',
    'uom': 'Unit of Measure',
    
    // Location fields
    'region': 'State/Region',
    'state': 'State',
    'country': 'Country',
    'consigneestatename': 'Consignee State',
    'consigneecountryname': 'Consignee Country',
    'pincode': 'PIN Code',
    'address': 'Address',
    'basicbuyeraddress': 'Buyer Address',
    
    // Ledger fields
    'ledgername': 'Ledger Name',
    'ledgerGroup': 'Ledger Group',
    'group': 'Group',
    'groupofgroup': 'Group of Group',
    
    // Salesperson fields
    'salesperson': 'Salesperson',
    'salespersonname': 'Salesperson Name',
    
    // Date fields
    'date': 'Date',
    'cp_date': 'CP Date',
    'month': 'Month',
    'year': 'Year',
    'quarter': 'Quarter',
    'week': 'Week',
    
    // Amount/Value fields
    'amount': 'Amount',
    'quantity': 'Quantity',
    'billedqty': 'Billed Quantity',
    'actualqty': 'Actual Quantity',
    'qty': 'Quantity',
    'profit': 'Profit',
    'cgst': 'CGST',
    'sgst': 'SGST',
    'roundoff': 'Round Off',
    'rate': 'Rate',
    'grosscost': 'Gross Cost',
    'grossexpense': 'Gross Expense',
    'invvalue': 'Inventory Value',
    'invtrytotal': 'Inventory Total',
    'addlexpense': 'Additional Expense',
    
    // Voucher fields
    'vouchernumber': 'Voucher Number',
    'vchno': 'Voucher No.',
    'vouchertypename': 'Voucher Type Name',
    'vchtype': 'Voucher Type',
    'reservedname': 'Reserved Name',
    'masterid': 'Master ID',
    'alterid': 'Alter ID',
    'reference': 'Reference',
    
    // Other fields
    'issales': 'Is Sales',
    'narration': 'Narration'
  };

  // Helper function to get user-friendly label for a field
  const getFieldLabel = (fieldName) => {
    const lowerKey = fieldName.toLowerCase();
    // Check exact match first
    if (fieldLabelMap[lowerKey]) {
      return fieldLabelMap[lowerKey];
    }
    // Check partial matches (e.g., 'stockitemcategory' contains 'category')
    for (const [key, label] of Object.entries(fieldLabelMap)) {
      if (lowerKey.includes(key) || key.includes(lowerKey)) {
        return label;
      }
    }
    // Fallback to formatted field name
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1').trim();
  };

  // Extract all available fields from sales data dynamically
  // NOTE: This only processes existing data in memory - NO API calls are made
  const allFields = useMemo(() => {
    // Use existing data only - do not trigger any data fetching
    if (!salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return [];
    }

    // Get ALL unique keys from ALL records to ensure we capture every field
    const allKeysSet = new Set();
    // Check ALL records to get every possible field name
    salesData.forEach(sale => {
      Object.keys(sale).forEach(key => allKeysSet.add(key));
    });
    const allKeys = Array.from(allKeysSet);

    // Determine field types by checking all records
    const fieldTypes = {};
    salesData.forEach(sale => {
      allKeys.forEach(key => {
        if (!fieldTypes[key]) {
          const value = sale[key];
          if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'string') {
              // Check if it's a numeric string
              const numValue = parseFloat(value);
              if (isNaN(numValue) || !isFinite(numValue)) {
                fieldTypes[key] = 'string'; // Non-numeric string
              } else {
                fieldTypes[key] = 'numeric'; // Numeric string
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

    // Include ALL fields from the sales response
    // Use a Map to ensure no duplicates (case-insensitive)
    const fieldsMap = new Map();
    
    // Define fields that should ALWAYS be categories (even if they contain numbers)
    const forceCategoryFields = [
      // Date fields - ALWAYS categories, never values
      'date', 'cp_date', 'cpdate', 'cp date', 'transaction_date', 'transactiondate',
      'voucher_date', 'voucherdate', 'bill_date', 'billdate', 'invoice_date', 'invoicedate',
      // Location fields
      'pincode', 'pin_code', 'pin', 'zipcode', 'zip',
      // Voucher/ID fields
      'vouchernumber', 'vchno', 'voucher_number', 'voucher_no',
      'masterid', 'master_id', 'alterid', 'alter_id',
      'partyledgernameid', 'partyid', 'party_id', 'stockitemnameid', 'itemid', 'item_id',
      'partygstin', 'gstin', 'gst_no', 'pan', 'pan_no',
      // Contact fields
      'phone', 'mobile', 'telephone', 'contact',
      // Reference fields
      'reference', 'ref_no', 'invoice_no', 'bill_no',
      // Address fields
      'address', 'basicbuyeraddress', 'buyer_address',
      // Other category fields
      'reservedname', 'vchtype', 'vouchertypename', 'voucher_type',
      'issales', 'is_sales'
    ];
    
    // Special handling: Consolidate date fields (cp_date, date, etc.) into a single "date" field
    // First, identify all date field variations in the data
    const dateFieldVariations = ['cp_date', 'cpdate', 'date', 'transaction_date', 'transactiondate', 
                                  'voucher_date', 'voucherdate', 'bill_date', 'billdate'];
    const foundDateFields = [];
    
    // First pass: identify all date fields (be specific to avoid false matches)
    allKeys.forEach(key => {
      const lowerKey = key.toLowerCase();
      // Check if this is a date field variation - be specific
      // Match exact date field names or fields ending with _date (but not updated_date, created_date, etc.)
      const isDateField = dateFieldVariations.some(dv => lowerKey === dv) || 
                          (lowerKey === 'date' || lowerKey === 'cp_date' || 
                           (lowerKey.endsWith('_date') && !lowerKey.includes('updated') && 
                            !lowerKey.includes('created') && !lowerKey.includes('modified') &&
                            !lowerKey.includes('deleted')));
      if (isDateField) {
        foundDateFields.push({ original: key, lower: lowerKey });
      }
    });
    
    // Log found date fields for debugging
    if (foundDateFields.length > 0) {
      console.log('🔍 Found date field variations in data:', foundDateFields.map(f => f.original));
    }
    
    // If we found any date fields, add a single consolidated "date" field as category
    // IMPORTANT: Use lowercase 'date' as the key to ensure case-insensitive matching works
    if (foundDateFields.length > 0) {
      // Add the consolidated date field with lowercase key
      fieldsMap.set('date', {
        value: 'date',
        label: 'Date',
        type: 'category'
      });
      console.log('📅 Consolidated date fields:', foundDateFields.map(f => f.original), '→ "date" (category)');
    }
    
    // Process each field from the sales data
    allKeys.forEach(key => {
      const lowerKey = key.toLowerCase();
      
      // Skip if we've already added this field (case-insensitive check)
      // This includes the consolidated "date" field we just added
      if (fieldsMap.has(lowerKey)) {
        return;
      }
      
      // Check if this is a date field variation - if so, skip it (we already added consolidated "date")
      // This catches any date field variations that weren't caught in the first pass
      const isDateField = dateFieldVariations.some(dv => lowerKey === dv) || 
                          (lowerKey === 'date' || lowerKey === 'cp_date' || 
                           (lowerKey.endsWith('_date') && !lowerKey.includes('updated') && 
                            !lowerKey.includes('created') && !lowerKey.includes('modified')));
      if (isDateField) {
        // Double-check: if we already have "date" in the map, definitely skip
        if (fieldsMap.has('date')) {
          return; // Skip - we already have the consolidated "date" field
        }
      }
      
      // Check if field should be forced to category
      const shouldBeCategory = forceCategoryFields.some(cat => 
        lowerKey === cat || lowerKey.includes(cat) || cat.includes(lowerKey)
      );
      
      // Determine if field is numeric based on type analysis (but respect forced categories)
      const isNumeric = !shouldBeCategory && fieldTypes[key] === 'numeric';
      
      // Determine default aggregation for numeric fields
      let defaultAggregation = 'sum';
      if (isNumeric) {
        // Rate, price, margin fields should default to average
        if (lowerKey.includes('rate') || lowerKey.includes('price') || 
            lowerKey.includes('margin') || lowerKey.includes('percent')) {
          defaultAggregation = 'average';
        }
      }
      
      // Create field entry - include ALL fields regardless of type
      const field = {
        value: key,
        label: getFieldLabel(key),
        type: isNumeric ? 'value' : 'category',
        ...(isNumeric && { aggregation: defaultAggregation }) // Add default aggregation for numeric fields
      };
      
      fieldsMap.set(lowerKey, field);
    });
    
    // Add derived/computed fields (these are calculated, not from response)
    const derivedFields = [
      // Count fields
      { value: 'transactions', label: 'Number of Transactions', type: 'value', aggregation: 'count' },
      { value: 'unique_customers', label: 'Number of Unique Customers', type: 'value', aggregation: 'count' },
      { value: 'unique_items', label: 'Number of Unique Items', type: 'value', aggregation: 'count' },
      { value: 'unique_orders', label: 'Number of Unique Orders', type: 'value', aggregation: 'count' },
      // Date-derived fields
      { value: 'month', label: 'Month', type: 'category' },
      { value: 'year', label: 'Year', type: 'category' },
      { value: 'quarter', label: 'Quarter', type: 'category' },
      { value: 'week', label: 'Week', type: 'category' }
    ];
    
    derivedFields.forEach(field => {
      const lowerKey = field.value.toLowerCase();
      if (!fieldsMap.has(lowerKey)) {
        fieldsMap.set(lowerKey, field);
      }
    });
    
    // Convert back to array and remove duplicates by label (case-insensitive)
    // This ensures we don't have multiple fields with the same label (e.g., "Date" appearing twice)
    const uniqueFields = Array.from(fieldsMap.values());
    const seenLabels = new Map(); // Use Map to store both label and field for easier replacement
    
    uniqueFields.forEach(field => {
      const labelLower = field.label.toLowerCase();
      
      // For "Date" specifically, prioritize the consolidated one (value === 'date')
      if (labelLower === 'date') {
        if (!seenLabels.has('date')) {
          // First "Date" field - add it
          seenLabels.set('date', field);
        } else {
          // Already have a "Date" field - replace if this is the consolidated one
          const existing = seenLabels.get('date');
          if (field.value === 'date' && existing.value !== 'date') {
            // Replace with consolidated "date" field
            seenLabels.set('date', field);
          }
          // Otherwise keep the existing one (which should be the consolidated one)
        }
      } else {
        // For other fields, only add if we haven't seen this label before
        if (!seenLabels.has(labelLower)) {
          seenLabels.set(labelLower, field);
        }
      }
    });
    
    const deduplicatedFields = Array.from(seenLabels.values());
    const sortedFields = deduplicatedFields.sort((a, b) => a.label.localeCompare(b.label));
    
    // Log date fields specifically to debug
    const dateFields = sortedFields.filter(f => f.label.toLowerCase() === 'date');
    if (dateFields.length > 1) {
      console.warn('⚠️ Multiple "Date" fields found after deduplication:', dateFields.map(f => ({ value: f.value, type: f.type })));
      // Force remove duplicates - keep only the one with value "date"
      const dateFieldIndex = sortedFields.findIndex(f => f.label.toLowerCase() === 'date' && f.value === 'date');
      if (dateFieldIndex >= 0) {
        // Remove all other "Date" fields
        for (let i = sortedFields.length - 1; i >= 0; i--) {
          if (sortedFields[i].label.toLowerCase() === 'date' && i !== dateFieldIndex) {
            sortedFields.splice(i, 1);
          }
        }
      }
    }
    
    console.log('📊 Available fields in Custom Card Modal:', {
      totalFields: sortedFields.length,
      categoryFields: sortedFields.filter(f => f.type === 'category').length,
      valueFields: sortedFields.filter(f => f.type === 'value').length,
      dateFieldsCount: dateFields.length,
      sampleFields: sortedFields.slice(0, 10).map(f => `${f.label} (${f.type})`)
    });
    
    return sortedFields;
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
      
      // Set chart type
      if (cardConfig.chartType) {
        setChartType(cardConfig.chartType);
      }
      
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
      
      // Set filters if present
      if (cardConfig.filters) {
        if (Array.isArray(cardConfig.filters)) {
          // Multiple filters
          setFilters(cardConfig.filters.map(f => ({
            field: f.filterField,
            values: new Set(f.filterValues || [])
          })));
        } else if (cardConfig.filters.filterField) {
          // Single filter (legacy format)
          setFilters([{
            field: cardConfig.filters.filterField,
            values: new Set(cardConfig.filters.filterValues || [])
          }]);
        }
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

  // Detect if current card configuration supports map visualization
  const supportsMapVisualization = useMemo(() => {
    // Derive groupBy from the first axis field
    const groupByField = axisFields[0];
    const groupByLower = groupByField?.value?.toLowerCase() || '';
    
    return {
      isMapEligible: groupByLower.includes('pincode') || 
                     groupByLower.includes('region') || 
                     groupByLower.includes('state') || 
                     groupByLower.includes('country'),
      mapType: groupByLower.includes('pincode') ? 'pincode' :
               groupByLower.includes('state') || groupByLower.includes('region') ? 'state' :
               groupByLower.includes('country') ? 'country' : null
    };
  }, [axisFields]);

  // Get unique values for the current filter field being configured
  const currentFilterFieldValues = useMemo(() => {
    if (!currentFilterField || !salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return [];
    }
    
    const valuesSet = new Set();
    salesData.forEach(sale => {
      // Use case-insensitive field access
      const fieldValue = sale[currentFilterField] || 
                        sale[currentFilterField.toLowerCase()] ||
                        sale[currentFilterField.toUpperCase()] ||
                        (Object.keys(sale).find(k => k.toLowerCase() === currentFilterField.toLowerCase()) 
                          ? sale[Object.keys(sale).find(k => k.toLowerCase() === currentFilterField.toLowerCase())] 
                          : null);
      
      if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
        const stringValue = String(fieldValue).trim();
        if (stringValue) {
          valuesSet.add(stringValue);
        }
      }
    });
    
    // Sort values for better UX
    return Array.from(valuesSet).sort((a, b) => {
      // Try to sort numerically if both are numbers
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      // Otherwise sort alphabetically
      return a.localeCompare(b);
    });
  }, [currentFilterField, salesData]);

  // Filter values based on search term
  const filteredFilterFieldValues = useMemo(() => {
    if (!filterValuesSearchTerm.trim()) {
      return currentFilterFieldValues;
    }
    const searchLower = filterValuesSearchTerm.toLowerCase().trim();
    return currentFilterFieldValues.filter(value => 
      value.toLowerCase().includes(searchLower)
    );
  }, [currentFilterFieldValues, filterValuesSearchTerm]);

  // Get fields that are not already used in filters
  const availableFilterFields = useMemo(() => {
    const usedFields = new Set(filters.map(f => f.field));
    return allFields.filter(field => !usedFields.has(field.value));
  }, [allFields, filters]);

  // Filter available filter fields based on search term
  const filteredAvailableFilterFields = useMemo(() => {
    if (!filterFieldSearchTerm.trim()) {
      return availableFilterFields;
    }
    const searchLower = filterFieldSearchTerm.toLowerCase().trim();
    return availableFilterFields.filter(field => 
      field.label.toLowerCase().includes(searchLower) ||
      field.value.toLowerCase().includes(searchLower)
    );
  }, [availableFilterFields, filterFieldSearchTerm]);
  
  // Handle field checkbox toggle - Only allow one field per bucket (axis or values)
  const handleFieldToggle = (fieldValue) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      const field = allFields.find(f => f.value === fieldValue);
      
      if (newSet.has(fieldValue)) {
        // Removing field
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
        // Adding field - check if bucket already has a field
        if (field) {
          if (field.type === 'category') {
            // Axis bucket - remove any existing category field
            const existingCategoryFields = Array.from(prev)
              .map(fv => allFields.find(f => f.value === fv))
              .filter(f => f && f.type === 'category')
              .map(f => f.value);
            
            existingCategoryFields.forEach(existingField => {
              newSet.delete(existingField);
              // Remove date grouping if removing date field
              if (existingField === 'date') {
                setDateGroupings(prev => {
                  const newGroupings = { ...prev };
                  delete newGroupings[existingField];
                  return newGroupings;
                });
              }
            });
            
            // Auto-set date grouping to 'day' when date field is selected
            if (fieldValue === 'date') {
              setDateGroupings(prev => ({
                ...prev,
                [fieldValue]: 'day' // Always default to daily
              }));
            }
          } else if (field.type === 'value') {
            // Values bucket - remove any existing value field
            const existingValueFields = Array.from(prev)
              .map(fv => allFields.find(f => f.value === fv))
              .filter(f => f && f.type === 'value')
              .map(f => f.value);
            
            existingValueFields.forEach(existingField => {
              newSet.delete(existingField);
              // Remove aggregation setting when removing value field
              setFieldAggregations(prevAggs => {
                const newAggs = { ...prevAggs };
                delete newAggs[existingField];
                return newAggs;
              });
            });
          }
        }
        
        // Add the new field
        newSet.add(fieldValue);
        
        // Auto-set date grouping to 'day' (daily) when date field is selected
        if (fieldValue === 'date') {
          setDateGroupings(prev => ({
            ...prev,
            [fieldValue]: 'day' // Always default to daily
          }));
        }
        
        // Set default aggregation for value fields
        if (field && field.type === 'value') {
          setFieldAggregations(prevAggs => ({
            ...prevAggs,
            [fieldValue]: field.aggregation || 'sum'
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

  // Handle adding a new filter
  const handleAddFilter = () => {
    if (!currentFilterField) {
      alert('Please select a filter field first');
      return;
    }
    if (currentFilterValues.size === 0) {
      alert('Please select at least one filter value');
      return;
    }
    
    // Add the filter to the filters array
    setFilters(prev => [...prev, {
      field: currentFilterField,
      values: new Set(currentFilterValues)
    }]);
    
    // Reset current filter configuration
    setCurrentFilterField('');
    setCurrentFilterValues(new Set());
    setFilterValuesSearchTerm('');
    setFilterFieldSearchTerm('');
  };

  // Handle removing a filter
  const handleRemoveFilter = (index) => {
    setFilters(prev => prev.filter((_, i) => i !== index));
  };

  // Handle filter field selection for new filter
  const handleFilterFieldChange = (fieldValue) => {
    // If clicking the same field, deselect it
    if (currentFilterField === fieldValue) {
      setCurrentFilterField('');
      setCurrentFilterValues(new Set());
      setFilterValuesSearchTerm('');
    } else {
    setCurrentFilterField(fieldValue);
    setCurrentFilterValues(new Set()); // Clear selected values when field changes
      setFilterValuesSearchTerm(''); // Clear search term when field changes
    }
  };

  // Handle filter value toggle for current filter being configured
  const handleFilterValueToggle = (value) => {
    setCurrentFilterValues(prev => {
      const newSet = new Set(prev);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return newSet;
    });
  };

  // Get unique values for a specific filter field
  const getFilterFieldValues = (fieldName) => {
    if (!fieldName || !salesData || !Array.isArray(salesData) || salesData.length === 0) {
      return [];
    }
    
    const valuesSet = new Set();
    salesData.forEach(sale => {
      // Use case-insensitive field access
      const fieldValue = sale[fieldName] || 
                        sale[fieldName.toLowerCase()] ||
                        sale[fieldName.toUpperCase()] ||
                        (Object.keys(sale).find(k => k.toLowerCase() === fieldName.toLowerCase()) 
                          ? sale[Object.keys(sale).find(k => k.toLowerCase() === fieldName.toLowerCase())] 
                          : null);
      
      if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
        const stringValue = String(fieldValue).trim();
        if (stringValue) {
          valuesSet.add(stringValue);
        }
      }
    });
    
    // Sort values for better UX
    return Array.from(valuesSet).sort((a, b) => {
      // Try to sort numerically if both are numbers
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      // Otherwise sort alphabetically
      return a.localeCompare(b);
    });
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cardTitle.trim()) {
      alert('Please enter a card title');
      return;
    }
    
    // For multiAxis charts, validate differently
    if (chartType === 'multiAxis') {
      if (!multiAxisSeries || multiAxisSeries.length === 0) {
        alert('Please add at least one series for Multi-Axis chart');
        return;
      }
      
      // Validate that each series has required fields
      const invalidSeries = multiAxisSeries.find(s => !s.field || !s.label);
      if (invalidSeries) {
        alert('Each series must have a field and label selected');
        return;
      }
      
      // For multiAxis, we need a groupBy field from the first axis field, or use a dummy
      // Actually, multiAxis uses the groupBy from the card config
      if (axisFields.length === 0) {
        alert('Please select at least one field for Axis (Categories) for the Multi-Axis chart');
        return;
      }
    } else {
      // Standard validation for non-multiAxis charts
      if (axisFields.length === 0) {
        alert('Please select at least one field for Axis (Categories)');
        return;
      }
      
      if (valueFields.length === 0) {
        alert('Please select at least one field for Values');
        return;
      }
    }
    
    // Use the first selected field for each bucket
    const groupByField = axisFields[0];
    
    // For multiAxis, we use a placeholder value field (it's not used since series define their own fields)
    let valueField, aggregation, mappedValueField;
    
    if (chartType === 'multiAxis') {
      // Use first series field as placeholder
      const firstSeries = multiAxisSeries[0];
      mappedValueField = firstSeries.field;
      aggregation = firstSeries.aggregation || 'sum';
    } else {
      valueField = valueFields[0];
      aggregation = fieldAggregations[valueField.value] || valueField.aggregation || 'sum';
      mappedValueField = valueField.value;
    }

    // Normalize date field value to 'date' for groupBy
    const groupByValue = groupByField.value;
    const normalizedGroupBy = (groupByValue === 'date' || groupByValue.startsWith('date_')) ? 'date' : groupByValue;
    
    // Set date grouping - always default to 'day' (daily) for date fields
    let dateGrouping = 'day'; // Default to daily grouping
    if (normalizedGroupBy === 'date') {
      // Use configured date grouping from state if available, otherwise default to 'day'
      // Check both the normalized 'date' key and the original field value key
      dateGrouping = dateGroupings['date'] || dateGroupings[groupByValue] || 'day';
      
      // Log for debugging
      console.log('📅 Date grouping configuration:', {
        groupByValue,
        normalizedGroupBy,
        dateGroupingsState: dateGroupings,
        selectedDateGrouping: dateGrouping
      });
    }
    
    // Build filters array from filters state
    const filtersArray = filters.length > 0 ? filters.map(f => ({
      filterField: f.field,
      filterValues: Array.from(f.values)
    })) : undefined;
    
    const cardConfig = {
      title: cardTitle.trim(),
      groupBy: normalizedGroupBy,
      // Always set dateGrouping to 'day' for date fields (no configuration needed)
      dateGrouping: (normalizedGroupBy === 'date') ? 'day' : undefined,
      aggregation,
      valueField: mappedValueField,
      chartType: chartType, // Use chart type from state
      topN: topN ? parseInt(topN, 10) : undefined,
      filters: filtersArray,
      enableStacking: enableStacking,
      segmentBy: enableStacking && segmentBy ? segmentBy : undefined,
      multiAxisSeries: chartType === 'multiAxis' ? multiAxisSeries : undefined,
      mapSubType: chartType === 'geoMap' ? mapSubType : undefined
    };
    
    // Log card config for debugging
    if (normalizedGroupBy === 'date') {
      console.log('📅 Card config with date field:', {
        groupBy: cardConfig.groupBy,
        dateGrouping: cardConfig.dateGrouping,
        expected: 'day'
      });
    }

    onCreate(cardConfig);
  };

  // Multi-axis series helpers
  const handleAddSeries = () => {
    // Get first numeric/value field as default
    const numericFields = allFields.filter(f => f.type === 'value');
    const defaultField = numericFields[0]?.value || '';
    const newSeries = {
      id: `series-${Date.now()}`,
      field: defaultField,
      aggregation: 'sum',
      type: 'bar',
      axis: 'left',
      label: ''
    };
    setMultiAxisSeries(prev => [...prev, newSeries]);
  };

  const handleSeriesChange = (id, key, value) => {
    setMultiAxisSeries(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s));
  };

  const handleSeriesRemove = (id) => {
    setMultiAxisSeries(prev => prev.filter(s => s.id !== id));
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
        {/* Generate with AI tab button (commented out for now) */}
        {/* <button
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
        </button> */}
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
            Default Chart Type
          </label>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value)}
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
              cursor: 'pointer'
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
            <option value="bar">Bar Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="treemap">Tree Map</option>
            <option value="line">Line Chart</option>
            <option value="multiAxis">Multi Axis (Bar/Line)</option>
            {supportsMapVisualization.isMapEligible && (
              <option value="geoMap">Geographic Map</option>
            )}
          </select>
          <p style={{
            margin: '6px 0 0 0',
            fontSize: '12px',
            color: '#64748b',
            fontStyle: 'italic'
          }}>
            You can change this later using the dropdown in the card header
          </p>
        </div>

        {/* Choose fields to add to report - Hide for Multi-Axis */}
        {chartType !== 'multiAxis' && (
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
              (() => {
                // Group date-related fields together on the same row
                const dateFields = ['date', 'month', 'year', 'quarter'];
                const dateFieldsToShow = filteredFields.filter(field => 
                  dateFields.includes(field.value.toLowerCase())
                );
                const otherFields = filteredFields.filter(field => 
                  !dateFields.includes(field.value.toLowerCase())
                );
                
                return (
                  <>
                    {/* Date/Month/Year/Quarter fields on the same row */}
                    {dateFieldsToShow.length > 0 && (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0',
                        padding: '8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}>
                        {dateFieldsToShow.map((field, index) => (
                          <div
                            key={field.value}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flex: '1 1 auto',
                              minWidth: 'fit-content'
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
                              color: '#1e293b',
                              marginRight: index < dateFieldsToShow.length - 1 ? '20px' : '0'
                            }}>
                              {field.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Other fields displayed normally */}
                    {otherFields.map((field) => (
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
                    ))}
                  </>
                );
              })()
            )}
          </div>
        </div>
        )}

        {/* Field buckets - Hide for Multi-Axis */}
        {chartType !== 'multiAxis' && (
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
                  // Always use 'day' (daily) for date fields - no configuration needed
                  const dateGrouping = isDateField ? 'day' : null;
                  
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
        )}

        {/* Multi-Axis Series (only for multiAxis chart type) */}
        {chartType === 'multiAxis' && (
          <div>
            {/* Axis (Category) Field Selection for Multi-Axis */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '8px',
                letterSpacing: '0.01em'
              }}>
                Category Field (X-Axis):
              </label>
              <select
                value={axisFields.length > 0 ? axisFields[0].value : ''}
                onChange={(e) => {
                  const newValue = e.target.value;
                  if (newValue) {
                    // For multi-axis, we only keep one axis field - replace the current one
                    const newFields = new Set();
                    // Keep all value fields (not used in multi-axis but keep for consistency)
                    valueFields.forEach(vf => newFields.add(vf.value));
                    // Set the new axis field
                    newFields.add(newValue);
                    setSelectedFields(newFields);
                  }
                }}
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
                  cursor: 'pointer'
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
                <option value="">Select category field...</option>
                {allFields.filter(f => f.type === 'category').map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
              <p style={{
                margin: '6px 0 0 0',
                fontSize: '12px',
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                This field will be used as the X-axis for all series
              </p>
            </div>

            <div style={{
              fontSize: '13px',
              fontWeight: '500',
              color: '#475569',
              marginBottom: '8px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="material-icons" style={{ fontSize: '18px', color: '#7c3aed' }}>show_chart</span>
              Data Series (Y-Axis):
            </div>

            {multiAxisSeries.length === 0 && (
              <div style={{
                padding: '16px',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                color: '#475569',
                fontSize: '13px',
                marginBottom: '12px',
                background: '#f8fafc'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '6px', color: '#1e293b' }}>
                  Add data series to visualize
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  • Add 2+ numeric series (e.g., Amount, Profit, Quantity)
                  <br />
                  • Mix bar and line chart types
                  <br />
                  • Map each series to left or right Y-axis
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {multiAxisSeries.map((series) => (
                <div
                  key={series.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    background: '#ffffff',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Field (Numeric)</label>
                    <select
                      value={series.field}
                      onChange={(e) => handleSeriesChange(series.id, 'field', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {allFields.filter(f => f.type === 'value').map((field) => (
                        <option key={field.value} value={field.value}>{field.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Aggregation</label>
                    <select
                      value={series.aggregation}
                      onChange={(e) => handleSeriesChange(series.id, 'aggregation', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="avg">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Series Type</label>
                    <select
                      value={series.type}
                      onChange={(e) => handleSeriesChange(series.id, 'type', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Y Axis</label>
                    <select
                      value={series.axis}
                      onChange={(e) => handleSeriesChange(series.id, 'axis', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Display Name</label>
                    <input
                      type="text"
                      value={series.label || ''}
                      onChange={(e) => handleSeriesChange(series.id, 'label', e.target.value)}
                      placeholder="Optional override"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleSeriesRemove(series.id)}
                      style={{
                        border: '1px solid #fecdd3',
                        background: '#fff1f2',
                        color: '#be123c',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={handleAddSeries}
                style={{
                  border: '1px dashed #cbd5e1',
                  background: '#f8fafc',
                  color: '#0ea5e9',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                Add Series
              </button>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>filter_list</span>
              Filters <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '400' }}>(Optional)</span>
            </div>
          </div>

          {/* Add New Filter Section - Moved before Filters Bucket */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '500',
              color: '#64748b',
              marginBottom: '10px'
            }}>
              Add Filter:
            </div>
          
          {/* Filter Field Search & Selection */}
          <div style={{ marginBottom: '12px' }}>
            {/* Search Input */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <input
                type="text"
                value={filterFieldSearchTerm}
                onChange={(e) => setFilterFieldSearchTerm(e.target.value)}
                placeholder="Search field to filter..."
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

            {/* Fields List with Radio/Single Selection */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {filteredAvailableFilterFields.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  {filterFieldSearchTerm ? 'No fields match your search' : 'No fields available'}
                </div>
              ) : (
                filteredAvailableFilterFields.map((field) => (
                  <div
                    key={field.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      background: currentFilterField === field.value ? '#eff6ff' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (currentFilterField !== field.value) {
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentFilterField !== field.value) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    onClick={() => handleFilterFieldChange(field.value)}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: currentFilterField === field.value ? 'none' : '2px solid #cbd5e1',
                      borderRadius: '50%',
                      background: currentFilterField === field.value ? '#3b82f6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      flexShrink: 0
                    }}>
                      {currentFilterField === field.value && (
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: 'white'
                        }}></div>
                      )}
                    </div>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: currentFilterField === field.value ? '600' : '400',
                      color: currentFilterField === field.value ? '#1e40af' : '#1e293b'
                    }}>
                      {field.label}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Search input for filter values */}
          {currentFilterField && currentFilterFieldValues.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search values..."
                value={filterValuesSearchTerm}
                onChange={(e) => setFilterValuesSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
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
          )}

          {/* Filter Values Checkboxes */}
            {currentFilterField && filteredFilterFieldValues.length > 0 && (
            <div style={{
                background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '200px',
                overflowY: 'auto',
                marginBottom: '12px'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#64748b',
                marginBottom: '8px'
              }}>
                Select values to include:
                {filterValuesSearchTerm && (
                  <span style={{ fontWeight: '400', color: '#94a3b8' }}>
                    {' '}({filteredFilterFieldValues.length} of {currentFilterFieldValues.length})
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                  {filteredFilterFieldValues.map((value) => (
                  <div
                    key={value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '6px 8px',
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
                      onClick={() => handleFilterValueToggle(value)}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                        border: currentFilterValues.has(value) ? 'none' : '2px solid #cbd5e1',
                      borderRadius: '4px',
                        background: currentFilterValues.has(value) ? '#10b981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: '10px',
                      flexShrink: 0
                    }}>
                        {currentFilterValues.has(value) && (
                        <span className="material-icons" style={{ fontSize: '14px', color: 'white' }}>check</span>
                      )}
                    </div>
                    <span style={{
                      fontSize: '13px',
                        fontWeight: currentFilterValues.has(value) ? '600' : '400',
                      color: '#1e293b'
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
                {currentFilterValues.size > 0 && (
                <div style={{
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                    <span>{currentFilterValues.size} value(s) selected</span>
                  <button
                    type="button"
                      onClick={() => setCurrentFilterValues(new Set())}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#fef2f2';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'transparent';
                    }}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
          
            {currentFilterField && filteredFilterFieldValues.length === 0 && currentFilterFieldValues.length > 0 && (
            <div style={{
                background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              color: '#94a3b8',
                fontSize: '13px',
                marginBottom: '12px'
            }}>
              No values match your search.
            </div>
          )}
          
            {currentFilterField && currentFilterFieldValues.length === 0 && (
            <div style={{
                background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              color: '#94a3b8',
                fontSize: '13px',
                marginBottom: '12px'
            }}>
              No values available for this field.
            </div>
          )}

            {currentFilterField && currentFilterValues.size > 0 && (
              <button
                type="button"
                onClick={handleAddFilter}
                style={{
                  width: '100%',
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                color: '#ffffff',
                  fontSize: '14px',
                fontWeight: '600',
                  cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                }}
                onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                }}
              >
                Add Filter
              </button>
            )}
          </div>

          {/* Filters Bucket - Only show when there is at least one filter */}
          {filters.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            minHeight: '120px'
          }}>
            <div style={{
              background: '#ffffff',
              border: '1px dashed #cbd5e1',
              borderRadius: '6px',
              padding: '8px',
              minHeight: '80px'
            }}>
              {filters.map((filter, index) => {
                const field = allFields.find(f => f.value === filter.field);
                const fieldLabel = field ? field.label : filter.field;
                const valuesArray = Array.from(filter.values);
                return (
                  <div
                    key={index}
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      background: '#fef3c7',
                      border: '1px solid #fbbf24',
                      color: '#92400e',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      margin: '4px',
                      gap: '6px',
                      maxWidth: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                      <span style={{ fontWeight: '600' }}>{fieldLabel}:</span>
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: '16px',
                          cursor: 'pointer',
                          padding: '2px',
                          borderRadius: '2px',
                          transition: 'background 0.2s',
                          marginLeft: 'auto'
                        }}
                        onClick={() => handleRemoveFilter(index)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fde68a';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Remove filter"
                      >
                        close
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '11px', 
                      color: '#78350f',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px',
                      maxWidth: '100%'
                    }}>
                      {valuesArray.length > 0 ? (
                        valuesArray.slice(0, 3).map((val, i) => (
                          <span key={i} style={{
                            background: '#fef3c7',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            border: '1px solid #fbbf24'
                          }}>
                            {val}
                          </span>
                        ))
                      ) : null}
                      {valuesArray.length > 3 && (
                        <span style={{ color: '#78350f', fontStyle: 'italic' }}>
                          +{valuesArray.length - 3} more
                        </span>
                      )}
                      {valuesArray.length === 0 && (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No values selected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
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

        {/* Stacked Bar Options - Hide for Multi-Axis */}
        {chartType !== 'multiAxis' && (
        <div>
          <div style={{
            fontSize: '13px',
            fontWeight: '500',
            color: '#475569',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#64748b' }}>stacked_bar_chart</span>
            Stacked Bar Options <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '400' }}>(Optional)</span>
          </div>
          
          {/* Enable Stacking Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: '12px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.borderColor = '#e2e8f0';
          }}
          >
            <input
              type="checkbox"
              checked={enableStacking}
              onChange={(e) => {
                setEnableStacking(e.target.checked);
                if (!e.target.checked) {
                  setSegmentBy(''); // Clear segment field when unchecked
                }
              }}
              style={{
                width: '18px',
                height: '18px',
                cursor: 'pointer',
                accentColor: '#10b981',
                flexShrink: 0
              }}
            />
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#1e293b'
              }}>
                Enable Stacked Bars
              </div>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                marginTop: '2px'
              }}>
                Stack bars by an additional dimension (works with Bar Chart type)
              </div>
            </div>
          </label>
          
          {/* Segment By Field */}
          {enableStacking && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#475569',
                marginBottom: '6px',
                letterSpacing: '0.01em'
              }}>
                Segment By (Stack By) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={segmentBy}
                onChange={(e) => setSegmentBy(e.target.value)}
                required={enableStacking}
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
                  cursor: 'pointer'
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
                <option value="">Select segment field...</option>
                {allFields
                  .filter(field => field.type === 'category')
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map(field => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))
                }
              </select>
              <p style={{
                margin: '6px 0 0 0',
                fontSize: '12px',
                color: '#64748b',
                fontStyle: 'italic'
              }}>
                Each bar will be divided into segments based on this field
              </p>
            </div>
          )}
        </div>
        )}

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
                    const currentGrouping = dateGroupings[fieldBeingConfigured.value] || 'day';
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
  openFullscreenCard,
  setSelectedCustomer,
  setSelectedItem,
  setSelectedStockGroup,
  setSelectedRegion,
  setSelectedCountry,
  setSelectedPeriod,
  setSelectedLedgerGroup,
  setDateRange,
  selectedCustomer,
  selectedItem,
  selectedStockGroup,
  selectedRegion,
  selectedCountry,
  selectedPeriod,
  selectedLedgerGroup,
  dateRange,
  genericFilters,
  setGenericFilters,
  renderCardFilterBadges,
  customCards,
  isMobile,
  formatPeriodLabel,
  parseDateFromNewFormat,
  parseDateFromAPI,
  formatDateForDisplay,
  formatChartValue,
  formatChartCompactValue
}) => {
  const cardData = useMemo(() => generateCustomCardData(card, salesData), [card, salesData, generateCustomCardData]);

  // Multi-axis data builder using existing generateCustomCardData for each series
  const multiAxisData = useMemo(() => {
    console.log('🎯 MultiAxisData calculation:', {
      cardId: card.id,
      cardTitle: card.title,
      chartType,
      hasMultiAxisSeries: !!card.multiAxisSeries,
      multiAxisSeriesLength: card.multiAxisSeries?.length,
      multiAxisSeriesData: card.multiAxisSeries
    });
    
    if (chartType !== 'multiAxis' || !Array.isArray(card.multiAxisSeries) || card.multiAxisSeries.length === 0) {
      console.log('❌ MultiAxisData: Returning null due to condition failure');
      return null;
    }

    console.log('✅ MultiAxisData: Building data for', card.multiAxisSeries.length, 'series');

    // Build per-series maps using existing aggregation pipeline
    const seriesMaps = card.multiAxisSeries.map((series, idx) => {
      const tempCard = {
        ...card,
        valueField: series.field,
        aggregation: series.aggregation || 'sum',
        chartType: 'bar',
        topN: undefined // We'll apply topN after merging
      };
      const data = generateCustomCardData(tempCard, salesData) || [];
      const map = new Map();
      data.forEach(d => map.set(d.label, d.value));
      return {
        def: series,
        map,
        color: series.color || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'][idx % 7]
      };
    });

    // Union of all labels
    const labelSet = new Set();
    seriesMaps.forEach(({ map }) => {
      map.forEach((_, label) => labelSet.add(label));
    });
    const labels = Array.from(labelSet);

    // Compute total per label for sorting and topN
    const totals = labels.map(label => seriesMaps.reduce((sum, { map }) => sum + (map.get(label) || 0), 0));
    const sorted = labels.map((label, idx) => ({ label, total: totals[idx] })).sort((a, b) => b.total - a.total);
    const categories = card.topN && card.topN > 0 ? sorted.slice(0, card.topN).map(x => x.label) : sorted.map(x => x.label);

    const series = seriesMaps.map(({ def, map, color }) => ({
      name: def.label || def.field || 'Series',
      type: def.type || 'bar',
      axis: def.axis || 'left',
      color,
      data: categories.map(label => map.get(label) || 0)
    }));

    const result = { categories, series };
    console.log('✅ MultiAxisData: Final result:', result);
    return result;
  }, [card, salesData, generateCustomCardData, chartType]);

  // Prepare data for geographic map visualization
  const geoMapData = useMemo(() => {
    if (chartType !== 'geoMap' || !cardData || cardData.length === 0) {
      return null;
    }
    
    return cardData.map(item => ({
      name: item.name || item.label, // Region/pincode/country name
      value: item.value,              // Aggregated value
      percentage: item.percentage
    }));
  }, [chartType, cardData]);

  // Detect if current card supports map visualization based on its groupBy field
  const supportsMapVisualization = useMemo(() => {
    const groupByLower = card.groupBy?.toLowerCase() || '';
    
    return {
      isMapEligible: groupByLower.includes('pincode') || 
                     groupByLower.includes('region') || 
                     groupByLower.includes('state') || 
                     groupByLower.includes('country'),
      mapType: groupByLower.includes('pincode') ? 'pincode' :
               groupByLower.includes('state') || groupByLower.includes('region') ? 'state' :
               groupByLower.includes('country') ? 'country' : null
    };
  }, [card.groupBy]);

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
        // For day grouping, parse label (DD-MMM-YY format) back to YYYY-MM-DD and set dateRange for that specific day
        return {
          onClick: (label) => {
            // Label format is "DD-MMM-YY" (e.g., "04-Apr-25") from formatDateForDisplay
            // Parse it back to YYYY-MM-DD format for date range filtering
            let parsedDate = null;
            
            // Try to parse the label using parseDateFromNewFormat
            parsedDate = parseDateFromNewFormat(label);
            if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
              // Successfully parsed to YYYY-MM-DD, set dateRange for that specific day
              // Set both start and end to the same date for single day filter
              setDateRange({ start: parsedDate, end: parsedDate });
              // Clear period filter when setting specific date range
              setSelectedPeriod(null);
              
              console.log('📅 Date click - setting date range filter for specific day:', {
                originalLabel: label,
                parsedDate,
                dateRange: { start: parsedDate, end: parsedDate }
              });
            } else {
              // Fallback: try to parse as Date object
              const dateObj = new Date(label);
              if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                parsedDate = `${year}-${month}-${day}`;
                setDateRange({ start: parsedDate, end: parsedDate });
                setSelectedPeriod(null);
                
                console.log('📅 Date click - setting date range filter (fallback):', {
                  originalLabel: label,
                  parsedDate,
                  dateRange: { start: parsedDate, end: parsedDate }
                });
              } else {
                console.warn('⚠️ Could not parse date label for date range filter:', label);
                return; // Don't set date range if we can't parse the date
              }
            }
          },
          onBackClick: () => {
            // Reset date range to empty when clearing filter
            setDateRange({ start: '', end: '' });
          },
          showBackButton: dateRange.start !== '' && dateRange.end !== '' && dateRange.start === dateRange.end,
          currentValue: dateRange.start === dateRange.end && dateRange.start !== '' ? dateRange.start : null
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
        // For year grouping, set year filter (format: "YYYY")
        return {
          onClick: (label) => {
            // Label format: "YYYY", use as-is for year filtering
            setSelectedPeriod(label);
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
    } else if (groupByLower === 'month') {
      // Handle month grouping (format: "Jan-25")
      return {
        onClick: (label) => {
          // Convert "Jan-25" format to "YYYY-MM" format for period filtering
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          const parts = label.split('-');
          if (parts.length === 2) {
            const monthAbbr = parts[0];
            const yearShort = parts[1];
            const monthNum = monthMap[monthAbbr];
            if (monthNum) {
              const fullYear = yearShort.length === 2 ? `20${yearShort}` : yearShort;
              setSelectedPeriod(`${fullYear}-${monthNum}`);
            }
          }
        },
        onBackClick: () => setSelectedPeriod(null),
        showBackButton: selectedPeriod !== null,
        currentValue: selectedPeriod
      };
    } else if (groupByLower === 'year') {
      // Handle year grouping - use year as-is (format: "YYYY")
      return {
        onClick: (label) => {
          // Label format: "YYYY", use as-is for year filtering
          setSelectedPeriod(label);
        },
        onBackClick: () => setSelectedPeriod(null),
        showBackButton: selectedPeriod !== null,
        currentValue: selectedPeriod
      };
    } else if (groupByLower === 'quarter') {
      // Handle quarter grouping - store as quarter format (Q1-2024, Q2-2024, etc.)
      return {
        onClick: (label) => {
          const match = label.match(/Q(\d)\s+(\d{4})/);
          if (match) {
            const quarter = parseInt(match[1]);
            const year = match[2];
            // Store as quarter format so filtering can match all 3 months
            setSelectedPeriod(`Q${quarter}-${year}`);
          }
        },
        onBackClick: () => setSelectedPeriod(null),
        showBackButton: selectedPeriod !== null,
        currentValue: selectedPeriod
      };
    } else if (groupByLower === 'week') {
      // Handle week grouping - convert to approximate month
      return {
        onClick: (label) => {
          const match = label.match(/Week\s+(\d+),\s+(\d{4})/);
          if (match) {
            const weekNum = parseInt(match[1]);
            const year = match[2];
            const approxMonth = Math.min(12, Math.ceil(weekNum / 4.33));
            const monthStr = String(approxMonth).padStart(2, '0');
            setSelectedPeriod(`${year}-${monthStr}`);
          }
        },
        onBackClick: () => setSelectedPeriod(null),
        showBackButton: selectedPeriod !== null,
        currentValue: selectedPeriod
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
    
    // Handle derived fields that are computed from the date
    if (fieldName === 'month' || fieldName === 'year' || fieldName === 'quarter' || fieldName === 'week') {
      const dateValue = item.date || item.Date || item.DATE || 
                       (Object.keys(item).find(k => k.toLowerCase() === 'date') ? 
                        item[Object.keys(item).find(k => k.toLowerCase() === 'date')] : null);
      
      if (dateValue) {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          if (fieldName === 'month') {
            const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthAbbr[date.getMonth()]}-${String(date.getFullYear()).slice(-2)}`;
          } else if (fieldName === 'year') {
            return String(date.getFullYear());
          } else if (fieldName === 'quarter') {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            return `Q${quarter} ${date.getFullYear()}`;
          } else if (fieldName === 'week') {
            const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
            const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
            const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            return `Week ${weekNum}, ${date.getFullYear()}`;
          }
        }
      }
      return null;
    }
    
    if (item[fieldName] !== undefined) return item[fieldName];
    if (item[fieldName.toLowerCase()] !== undefined) return item[fieldName.toLowerCase()];
    if (item[fieldName.toUpperCase()] !== undefined) return item[fieldName.toUpperCase()];
    const matchingKey = Object.keys(item).find(k => k.toLowerCase() === fieldName.toLowerCase());
    return matchingKey ? item[matchingKey] : null;
  };

  // Helper function to check if a sale matches the card's filters
  const matchesCardFilters = (sale) => {
    if (!card.filters || (Array.isArray(card.filters) && card.filters.length === 0)) {
      return true; // No filters, so all sales match
    }

    // Handle array of filters (new format)
    if (Array.isArray(card.filters)) {
      return card.filters.every(filter => {
        if (!filter.filterField || !filter.filterValues || filter.filterValues.length === 0) {
          return true; // Invalid filter, skip it
        }
        const filterFieldName = filter.filterField;
        const filterValuesSet = new Set(filter.filterValues.map(v => String(v).trim().toLowerCase()));
        const fieldValue = getFieldValueLocal(sale, filterFieldName);
        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          return false;
        }
        const normalizedValue = String(fieldValue).trim().toLowerCase();
        return filterValuesSet.has(normalizedValue);
      });
    }

    // Handle legacy single filter object format
    if (typeof card.filters === 'object' && !Array.isArray(card.filters)) {
      if (card.filters.customer && card.filters.customer !== 'all') {
        if (!sale.customer || String(sale.customer).trim().toLowerCase() !== String(card.filters.customer).trim().toLowerCase()) {
          return false;
        }
      }
      if (card.filters.item && card.filters.item !== 'all') {
        if (!sale.item || String(sale.item).trim().toLowerCase() !== String(card.filters.item).trim().toLowerCase()) {
          return false;
        }
      }
      if (card.filters.stockGroup && card.filters.stockGroup !== 'all') {
        if (!sale.category || String(sale.category).trim().toLowerCase() !== String(card.filters.stockGroup).trim().toLowerCase()) {
          return false;
        }
      }
      if (card.filters.region && card.filters.region !== 'all') {
        if (!sale.region || String(sale.region).trim().toLowerCase() !== String(card.filters.region).trim().toLowerCase()) {
          return false;
        }
      }
      if (card.filters.country && card.filters.country !== 'all') {
        if (!sale.country || String(sale.country).trim().toLowerCase() !== String(card.filters.country).trim().toLowerCase()) {
          return false;
        }
      }
      if (card.filters.salesperson && card.filters.salesperson !== 'all') {
        if (sale.salesperson !== card.filters.salesperson) {
          return false;
        }
      }
      if (card.filters.period) {
        const saleDate = sale.cp_date || sale.date;
        const date = new Date(saleDate);
        const salePeriod = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (salePeriod !== card.filters.period) {
          return false;
        }
      }
      if (card.filters.filterField && card.filters.filterValues && card.filters.filterValues.length > 0) {
        const filterFieldName = card.filters.filterField;
        const filterValuesSet = new Set(card.filters.filterValues.map(v => String(v).trim().toLowerCase()));
        const fieldValue = getFieldValueLocal(sale, filterFieldName);
        if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
          return false;
        }
        const normalizedValue = String(fieldValue).trim().toLowerCase();
        if (!filterValuesSet.has(normalizedValue)) {
          return false;
        }
      }
    }

    return true;
  };

  const getFilterFn = (itemLabel) => {
    return (sale) => {
      // First check if sale matches card filters
      if (!matchesCardFilters(sale)) {
        return false;
      }

      // Then check if sale matches the chart entry filter
      if (card.groupBy === 'date') {
        // Handle "Unknown" case - match sales with invalid/missing dates
        if (itemLabel === 'Unknown') {
          const saleDate = getFieldValueLocal(sale, 'cp_date') || getFieldValueLocal(sale, 'date');
          if (!saleDate) return true; // Missing date matches Unknown
          
          // Try to normalize and parse the date
          let normalizedDate = saleDate;
          const parsed = parseDateFromNewFormat(saleDate) || parseDateFromAPI(saleDate);
          if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            normalizedDate = parsed;
          } else if (typeof saleDate === 'string' && saleDate.length === 8 && /^\d+$/.test(saleDate)) {
            normalizedDate = `${saleDate.substring(0, 4)}-${saleDate.substring(4, 6)}-${saleDate.substring(6, 8)}`;
          } else if (typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
            normalizedDate = saleDate;
          } else {
            const directDate = new Date(saleDate);
            if (!isNaN(directDate.getTime())) {
              const year = directDate.getFullYear();
              const month = String(directDate.getMonth() + 1).padStart(2, '0');
              const day = String(directDate.getDate()).padStart(2, '0');
              normalizedDate = `${year}-${month}-${day}`;
            }
          }
          
          // If date is invalid or can't be normalized, it matches Unknown
          if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
            return true;
          }
          const date = new Date(normalizedDate);
          if (isNaN(date.getTime())) {
            return true; // Invalid date matches Unknown
          }
          return false; // Valid date doesn't match Unknown
        }
        
        // For valid date labels, normalize the sale date and compare
        const saleDate = getFieldValueLocal(sale, 'cp_date') || getFieldValueLocal(sale, 'date');
        if (!saleDate) return false;
        
        // Normalize date to YYYY-MM-DD format (same as grouping logic)
        let normalizedDate = saleDate;
        const parsed = parseDateFromNewFormat(saleDate) || parseDateFromAPI(saleDate);
        if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
          normalizedDate = parsed;
        } else if (typeof saleDate === 'string' && saleDate.length === 8 && /^\d+$/.test(saleDate)) {
          normalizedDate = `${saleDate.substring(0, 4)}-${saleDate.substring(4, 6)}-${saleDate.substring(6, 8)}`;
        } else if (typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saleDate)) {
          normalizedDate = saleDate;
        } else {
          const directDate = new Date(saleDate);
          if (!isNaN(directDate.getTime())) {
            const year = directDate.getFullYear();
            const month = String(directDate.getMonth() + 1).padStart(2, '0');
            const day = String(directDate.getDate()).padStart(2, '0');
            normalizedDate = `${year}-${month}-${day}`;
          }
        }
        
        if (!normalizedDate || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          return false; // Invalid date doesn't match any valid date label
        }
        
        const date = new Date(normalizedDate);
        if (isNaN(date.getTime())) {
          return false;
        }
        
        let groupKey = '';
        if (card.dateGrouping === 'day') {
          // Use normalized YYYY-MM-DD format for comparison
          groupKey = normalizedDate;
          // But itemLabel is in DD-MMM-YY format, so we need to convert it back
          const parsedLabel = parseDateFromNewFormat(itemLabel);
          if (parsedLabel && /^\d{4}-\d{2}-\d{2}$/.test(parsedLabel)) {
            return parsedLabel === groupKey;
          }
          // Fallback: try direct comparison
          return groupKey === itemLabel || formatDateForDisplay(groupKey) === itemLabel;
        } else if (card.dateGrouping === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          groupKey = `${weekStart.getFullYear()}-W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
          return groupKey === itemLabel;
        } else if (card.dateGrouping === 'month') {
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          return groupKey === itemLabel;
        } else if (card.dateGrouping === 'year') {
          groupKey = String(date.getFullYear());
          return groupKey === itemLabel;
        } else {
          // Default to day grouping
          groupKey = normalizedDate;
          const parsedLabel = parseDateFromNewFormat(itemLabel);
          if (parsedLabel && /^\d{4}-\d{2}-\d{2}$/.test(parsedLabel)) {
            return parsedLabel === groupKey;
        }
          return groupKey === itemLabel || formatDateForDisplay(groupKey) === itemLabel;
        }
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
      } else if (card.groupBy === 'month' || card.groupBy === 'year' || card.groupBy === 'quarter' || card.groupBy === 'week') {
        // Handle derived date fields
        const computedValue = getFieldValueLocal(sale, card.groupBy);
        if (!computedValue || !itemLabel) return false;
        return String(computedValue).trim().toLowerCase() === String(itemLabel).trim().toLowerCase();
      } else {
        // Case-insensitive matching for string fields
        const fieldValue = getFieldValueLocal(sale, card.groupBy);
        if (!fieldValue || !itemLabel) return false;
        return String(fieldValue).trim().toLowerCase() === String(itemLabel).trim().toLowerCase();
      }
    };
  };

  // Combined filter function for raw data (applies card filters + chart entry filter)
  const getCombinedFilterFn = (itemLabel) => {
    const chartEntryFilter = getFilterFn(itemLabel);
    return (sale) => {
      return matchesCardFilters(sale) && chartEntryFilter(sale);
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
          onClick={() => openTransactionRawData(`Raw Data - ${card.title}`, (sale) => matchesCardFilters(sale))}
          style={rawDataIconButtonStyle}
          onMouseEnter={handleRawDataButtonMouseEnter}
          onMouseLeave={handleRawDataButtonMouseLeave}
          title="View raw data"
        >
          <span className="material-icons" style={{ fontSize: '18px' }}>table_view</span>
        </button>
        <h3 
          onClick={() => openFullscreenCard('custom', card.title, card.id)}
          style={{ 
            margin: 0, 
            fontSize: '16px', 
            fontWeight: '600', 
            color: '#1e293b',
            cursor: 'pointer',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#1e293b'}
          title="Click to open in fullscreen"
        >
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
          <option value="multiAxis">Multi Axis</option>
          {supportsMapVisualization.isMapEligible && (
            <option value="geoMap">Geographic Map</option>
          )}
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

  // Determine if we should show the card
  const shouldShowCard = chartType === 'multiAxis' 
    ? (multiAxisData && multiAxisData.series && multiAxisData.series.length > 0)
    : (cardData.length > 0);

  console.log('🎯 CustomCard Render Decision:', {
    cardId: card.id,
    cardTitle: card.title,
    chartType,
    shouldShowCard,
    cardDataLength: cardData.length,
    hasMultiAxisData: !!multiAxisData,
    multiAxisSeriesCount: multiAxisData?.series?.length
  });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      maxHeight: '500px',
      minHeight: '500px',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0
    }}>
      {shouldShowCard ? (
        <>
          {chartType === 'bar' && (
            <BarChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              formatValue={formatChartValue}
              stacked={card.enableStacking || false}
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
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getCombinedFilterFn(item.label))
              }}
            />
          )}
          {(() => {
            console.log('🎨 Render check for multiAxis:', {
              chartType,
              isMultiAxis: chartType === 'multiAxis',
              hasMultiAxisData: !!multiAxisData,
              multiAxisData
            });
            return null;
          })()}
          {chartType === 'multiAxis' && multiAxisData && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                flexShrink: 0
              }}>
                {customHeader}
              </div>
              <div style={{ 
                flex: 1, 
                minHeight: 0, 
                padding: isMobile ? '8px' : '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <MultiAxisChart
                    categories={multiAxisData.categories}
                    series={multiAxisData.series}
                    isMobile={isMobile}
                    height={isMobile ? 340 : 450}
                    onCategoryClick={(category) => {
                      console.log('🔵 Custom card multi-axis click:', { cardTitle: card.title, category, groupBy: card.groupBy, hasHandler: !!filterHandler });
                      filterHandler?.onClick?.(category);
                    }}
                    onBackClick={() => {
                      console.log('🔵 Custom card multi-axis back click:', { cardTitle: card.title, groupBy: card.groupBy });
                      filterHandler?.onBackClick?.();
                    }}
                    showBackButton={filterHandler?.showBackButton || false}
                    formatValue={formatChartValue}
                    formatCompactValue={formatChartCompactValue}
                  />
                </div>
              </div>
            </div>
          )}
          {chartType === 'geoMap' && geoMapData && (
            <div style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '12px 16px',
                flexShrink: 0
              }}>
                {customHeader}
              </div>
              <div style={{ 
                flex: 1, 
                minHeight: 0, 
                padding: isMobile ? '8px' : '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}>
                <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                  <GeoMapChart
                    mapType={supportsMapVisualization.mapType}
                    chartSubType={card.mapSubType || 'choropleth'}
                    data={geoMapData}
                    height={isMobile ? 340 : 450}
                    isMobile={isMobile}
                    onRegionClick={(regionName) => {
                      console.log('🗺️ Custom card map click:', { cardTitle: card.title, regionName, groupBy: card.groupBy, hasHandler: !!filterHandler });
                      filterHandler?.onClick?.(regionName);
                    }}
                    onBackClick={() => {
                      console.log('🗺️ Custom card map back click:', { cardTitle: card.title, groupBy: card.groupBy });
                      filterHandler?.onBackClick?.();
                    }}
                    showBackButton={filterHandler?.showBackButton || false}
                  />
                </div>
              </div>
            </div>
          )}
          {chartType === 'pie' && (
            <PieChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              formatValue={formatChartValue}
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
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getCombinedFilterFn(item.label))
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
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getCombinedFilterFn(item.label))
              }}
            />
          )}
          {chartType === 'line' && (
            <LineChart
              data={cardData}
              customHeader={customHeader}
              valuePrefix={valuePrefix}
              formatValue={formatChartValue}
              formatCompactValue={formatChartCompactValue}
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
                onClick: (item) => openTransactionRawData(`Raw Data - ${card.title} - ${item.label}`, getCombinedFilterFn(item.label))
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
          height: '500px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {customHeader && (
            <div style={{ 
              padding: '16px 20px'
            }}>
              {customHeader}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SalesDashboard;