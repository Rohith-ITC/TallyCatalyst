import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config';
import TallyLogo from '../DLrlogo.png';
import '../AdminHomeResponsive.css';
import Header from '../components/Header';
import Ledgerbook from './Ledgerbook';
import PlaceOrder from './PlaceOrder';
import PlaceOrder_ECommerce from './PlaceOrder_ECommerce';
import SalesDashboard from './salesdashboard';
import ReceivablesDashboard from '../RecvDashboard';
import VoucherAuthorization from './vchauth';
import ReceiptListScreenWrapper from './ReceiptListScreenWrapper';
import CompanyOrdersScreenWrapper from './CompanyOrdersScreenWrapper';
import AccessControl from '../access-control/AccessControl';
import MasterForm from './MasterForm';
import MasterAuthorization from './MasterAuthorization';
import MasterList from './MasterList';
import CacheManagement from './CacheManagement';
import SalesOrderReport from './SalesOrderReport';
import PaymentVoucherReport from './PaymentVoucherReport';
import VendorExpenses from './VendorExpenses';
import {
  MODULE_SEQUENCE,
  hasModuleAccess,
  hasAnySubModuleAccess,
  hasAnyAccessibleSubModule,
  hasSubModuleAccess,
  hasRequiredModuleAccess,
  getUserModules,
  getDropdownFilterOptions,
  shouldUseDropdownFilter,
  isAlwaysVisible,
  shouldUseRightSideDropdown
} from '../config/SideBarConfigurations';
import { apiGet } from '../utils/apiUtils';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';
import { MobileMenu, useIsMobile } from './MobileViewConfig';
import { syncCustomers, syncItems } from '../utils/cacheSyncManager';
import { isExternalUser, clearAllCacheForExternalUser } from '../utils/cacheUtils';

function TallyDashboard() {
  console.log('🎯 TallyDashboard component loading...');

  // Check authentication immediately
  console.log('🎯 TallyDashboard auth check:', {
    token: !!sessionStorage.getItem('token'),
    email: sessionStorage.getItem('email'),
    name: sessionStorage.getItem('name')
  });

  // Read cached values from sessionStorage
  const tallyloc_id = sessionStorage.getItem('tallyloc_id');
  const company = sessionStorage.getItem('company');
  const guid = sessionStorage.getItem('guid');
  const status = sessionStorage.getItem('status');
  const access_type = sessionStorage.getItem('access_type');
  const name = sessionStorage.getItem('name');
  const email = sessionStorage.getItem('email');

  console.log('🎯 TallyDashboard sessionStorage data:', {
    tallyloc_id,
    company,
    guid,
    status,
    access_type,
    name,
    email
  });

  console.log('🎯 All sessionStorage keys:', Object.keys(sessionStorage));
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef();
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [googleConfigStatus, setGoogleConfigStatus] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(localStorage.getItem('google_access_token') || null);

  // Mobile menu state
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Window width state for responsive header
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Sidebar refs for responsive scrolling
  const sidebarRef = useRef(null);
  const sidebarContentRef = useRef(null);
  const [needsScrolling, setNeedsScrolling] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if user is admin
  const isAdmin = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role === 'admin';
    } catch {
      return false;
    }
  };
  // Sidebar tooltip state and timeout
  const [sidebarTooltip, setSidebarTooltip] = useState({ show: false, text: '', top: 0 });
  let sidebarTooltipTimeout = null;
  // Track active sidebar item - will be set based on user permissions
  // Restore from sessionStorage if available, otherwise default to 'main'
  const [activeSidebar, setActiveSidebar] = useState(() => {
    const saved = sessionStorage.getItem('activeSidebar');
    return saved || 'main';
  });
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // Check if sidebar needs scrolling based on content height
  useEffect(() => {
    const checkScrollNeeded = () => {
      if (!sidebarRef.current || !sidebarContentRef.current || isMobile) {
        setNeedsScrolling(false);
        return;
      }

      // Ensure sidebar content is rendered
      const sidebarItems = sidebarContentRef.current?.children;
      if (!sidebarItems || sidebarItems.length === 0) {
        // Content not ready yet, disable scrolling for now
        setNeedsScrolling(false);
        return;
      }

      // Get the sidebar container height (viewport height minus header)
      const sidebarContainerHeight = sidebarRef.current.clientHeight;

      // Get the total scroll height of all content inside sidebar
      // Note: scrollHeight is accurate even when overflow is hidden
      const sidebarScrollHeight = sidebarRef.current.scrollHeight;

      // Check if content exceeds container height
      // Enable scrolling if content height is >= container height
      // Use >= to be more permissive and ensure the last item is always accessible
      const needsScroll = sidebarScrollHeight >= sidebarContainerHeight;

      setNeedsScrolling(needsScroll);

      // Debug logging
      console.log('📏 Sidebar scroll check:', {
        containerHeight: sidebarContainerHeight,
        scrollHeight: sidebarScrollHeight,
        needsScroll,
        difference: sidebarScrollHeight - sidebarContainerHeight,
        ratio: sidebarContainerHeight > 0 ? (sidebarScrollHeight / sidebarContainerHeight * 100).toFixed(1) + '%' : 'N/A'
      });
    };

    // Check immediately
    checkScrollNeeded();

    // Check after delays to ensure DOM is fully rendered and sidebar animation completes
    const timeoutId = setTimeout(checkScrollNeeded, 100);
    const timeoutId2 = setTimeout(checkScrollNeeded, 300);
    const timeoutId3 = setTimeout(checkScrollNeeded, 500);
    // Check after sidebar transition completes (300ms transition + buffer)
    const timeoutId4 = setTimeout(checkScrollNeeded, 400);
    const timeoutId5 = setTimeout(checkScrollNeeded, 600);

    // Check on window resize
    window.addEventListener('resize', checkScrollNeeded);

    // Check when sidebar content changes
    const observer = new MutationObserver(() => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        setTimeout(checkScrollNeeded, 50);
      });
    });

    if (sidebarRef.current) {
      observer.observe(sidebarRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      clearTimeout(timeoutId4);
      clearTimeout(timeoutId5);
      window.removeEventListener('resize', checkScrollNeeded);
      observer.disconnect();
    };
  }, [sidebarOpen, sidebarLoading, isMobile, activeSidebar]);

  const [pendingSidebarNavigation, setPendingSidebarNavigation] = useState(null);
  const [accessControlDropdownOpen, setAccessControlDropdownOpen] = useState(false);
  const [masterManagementDropdownOpen, setMasterManagementDropdownOpen] = useState(false);
  const masterManagementDropdownRef = useRef(null);
  const [masterDropdownPosition, setMasterDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const masterButtonRef = useRef(null);
  const masterDropdownCloseTimeoutRef = useRef(null);
  const [reportsDropdownOpen, setReportsDropdownOpen] = useState(false);
  const reportsDropdownRef = useRef(null);
  const [reportsDropdownPosition, setReportsDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const reportsButtonRef = useRef(null);
  const reportsDropdownCloseTimeoutRef = useRef(null);
  const accessControlButtonRef = useRef(null);
  const [accessControlDropdownPosition, setAccessControlDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const desiredActiveSidebarRef = useRef(null);
  const initialPermissionsRequestedRef = useRef(false);

  const isModuleAccessibleById = useCallback((moduleId, userModules) => {
    if (!moduleId) return false;
    const module = MODULE_SEQUENCE.find(m => m.id === moduleId);
    if (module) {
      // Special handling for cache_management - always allow access
      // The CacheManagement component itself handles the access check and shows error if needed
      if (module.key === 'cache_management') {
        return true;
      }
      if (module.key === 'main_menu' || isAlwaysVisible(module.key)) {
        return true;
      }
      if (module.hasSubModules) {
        return hasAnySubModuleAccess(module.key, userModules);
      }
      return hasModuleAccess(module.key, userModules);
    }

    for (const parent of MODULE_SEQUENCE) {
      if (!parent.hasSubModules) continue;
      const subModule = parent.subModules?.find(sub => sub.id === moduleId);
      if (subModule) {
        // If parent is alwaysVisible, allow access to all submodules
        if (isAlwaysVisible(parent.key)) {
          return true;
        }
        // Otherwise check submodule access using required modules logic
        return hasRequiredModuleAccess(subModule, userModules);
      }
    }
    return false;
  }, []);

  const getFirstAccessibleModuleId = useCallback((userModules) => {
    if (!userModules || userModules.length === 0) {
      return 'main';
    }
    for (const module of MODULE_SEQUENCE) {
      if (module.key === 'main_menu') continue;
      if (module.hasSubModules) {
        if (hasAnySubModuleAccess(module.key, userModules)) {
          return module.id;
        }
      } else if (isAlwaysVisible(module.key) || hasModuleAccess(module.key, userModules)) {
        return module.id;
      }
    }
    return 'main';
  }, []);

  // Wrapper for setActiveSidebar that also persists to sessionStorage
  const setActiveSidebarWithPersistence = useCallback((newSidebar) => {
    setActiveSidebar(newSidebar);
    sessionStorage.setItem('activeSidebar', newSidebar);
  }, []);

  // Also update the state setter directly to use persistence
  // This ensures all calls to setActiveSidebar persist
  useEffect(() => {
    // Save to sessionStorage whenever activeSidebar changes
    if (activeSidebar) {
      sessionStorage.setItem('activeSidebar', activeSidebar);
    }
  }, [activeSidebar]);

  // Replace setActiveSidebar with the persistent version
  // We'll use setActiveSidebarWithPersistence everywhere

  const resolveActiveSidebar = useCallback((userModules) => {
    if (!userModules || userModules.length === 0) {
      if (activeSidebar !== 'main') {
        setActiveSidebarWithPersistence('main');
      }
      desiredActiveSidebarRef.current = null;
      return;
    }

    // Check if current activeSidebar is valid and accessible
    // If it is, keep it (don't auto-switch to first module)
    if (activeSidebar !== 'main' && isModuleAccessibleById(activeSidebar, userModules)) {
      desiredActiveSidebarRef.current = null;
      return;
    }

    // Only auto-switch if we're on 'main' and there's no saved valid sidebar
    if (activeSidebar === 'main') {
      // Check if there's a saved sidebar that's still accessible
      const savedSidebar = sessionStorage.getItem('activeSidebar');
      if (savedSidebar && savedSidebar !== 'main' && isModuleAccessibleById(savedSidebar, userModules)) {
        setActiveSidebarWithPersistence(savedSidebar);
        desiredActiveSidebarRef.current = null;
        return;
      }

      // Otherwise, use first accessible module
      const firstModuleId = getFirstAccessibleModuleId(userModules);
      if (firstModuleId && firstModuleId !== 'main') {
        setActiveSidebarWithPersistence(firstModuleId);
        desiredActiveSidebarRef.current = null;
        return;
      }
    }

    const desiredId = desiredActiveSidebarRef.current;
    if (desiredId && isModuleAccessibleById(desiredId, userModules)) {
      if (activeSidebar !== desiredId) {
        setActiveSidebarWithPersistence(desiredId);
      }
      desiredActiveSidebarRef.current = null;
      return;
    }

    const fallbackId = getFirstAccessibleModuleId(userModules) || 'main';
    if (activeSidebar !== fallbackId) {
      setActiveSidebarWithPersistence(fallbackId);
    }
    desiredActiveSidebarRef.current = null;
  }, [activeSidebar, getFirstAccessibleModuleId, isModuleAccessibleById, setActiveSidebarWithPersistence]);


  // Update access control dropdown position when it opens
  useEffect(() => {
    const updateAccessControlDropdownPosition = () => {
      if (accessControlDropdownOpen && accessControlButtonRef.current) {
        const rect = accessControlButtonRef.current.getBoundingClientRect();
        setAccessControlDropdownPosition({
          top: rect.top,
          left: rect.left + rect.width,
          width: rect.width
        });
      }
    };

    if (accessControlDropdownOpen) {
      updateAccessControlDropdownPosition();
      const handleResize = () => updateAccessControlDropdownPosition();
      const handleScroll = () => updateAccessControlDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [accessControlDropdownOpen]);

  // Close access control dropdown when sidebar closes
  useEffect(() => {
    if (!sidebarOpen) {
      setAccessControlDropdownOpen(false);
    }
  }, [sidebarOpen]);

  // Access Control dropdown items
  const ACCESS_CONTROL_ITEMS = [
    { key: 'modules', label: 'Modules Management', icon: 'apps' },
    { key: 'roles', label: 'Roles Management', icon: 'group' },
    { key: 'create-access', label: 'User Management', icon: 'person_add' },
    { key: 'share-access', label: 'Share Access', icon: 'share' },
  ];

  // Get dropdown filter options for the current active module
  const getCurrentDropdownOptions = () => {
    const userModules = getUserModules();
    const currentModule = MODULE_SEQUENCE.find(m => m.id === activeSidebar);
    if (currentModule && shouldUseDropdownFilter(currentModule.key)) {
      return getDropdownFilterOptions(currentModule.key, userModules);
    }
    return [];
  };

  // Company selection state for top bar
  const [selectedCompanyGuid, setSelectedCompanyGuid] = useState(sessionStorage.getItem('selectedCompanyGuid') || '');
  const [connectionsVersion, setConnectionsVersion] = useState(0);

  useEffect(() => {
    if (!selectedCompanyGuid) {
      const storedGuid = sessionStorage.getItem('selectedCompanyGuid') || sessionStorage.getItem('guid');
      if (storedGuid) {
        setSelectedCompanyGuid(storedGuid);
      }
    }
  }, [selectedCompanyGuid]);

  // Get all companies from sessionStorage
  const allConnections = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('allConnections') || '[]');
    } catch (e) {
      return [];
    }
  }, [connectionsVersion]);

  const currentReceivablesCompany = useMemo(() => {
    if (!selectedCompanyGuid) {
      return null;
    }
    return allConnections.find((connection) => connection.guid === selectedCompanyGuid) || null;
  }, [allConnections, selectedCompanyGuid]);

  useEffect(() => {
    const handleConnectionsUpdated = () => {
      console.log('🔄 connectionsUpdated event received in TallyDashboard');
      setConnectionsVersion((prev) => prev + 1);
    };

    window.addEventListener('connectionsUpdated', handleConnectionsUpdated);
    return () => window.removeEventListener('connectionsUpdated', handleConnectionsUpdated);
  }, []);


  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 900 && sidebarOpen) setSidebarOpen(false);
      if (window.innerWidth > 900 && !sidebarOpen) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Close master management dropdown when sidebar closes
  useEffect(() => {
    if (!sidebarOpen) {
      setMasterManagementDropdownOpen(false);
    }
  }, [sidebarOpen]);

  // Debug: Log activeSidebar changes
  useEffect(() => {
    console.log('📌 activeSidebar changed to:', activeSidebar);
  }, [activeSidebar]);

  const accessControlDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (masterManagementDropdownRef.current && !masterManagementDropdownRef.current.contains(event.target)) {
        setMasterManagementDropdownOpen(false);
      }
      if (accessControlDropdownRef.current && !accessControlDropdownRef.current.contains(event.target) &&
        accessControlButtonRef.current && !accessControlButtonRef.current.contains(event.target)) {
        setAccessControlDropdownOpen(false);
      }
      if (reportsDropdownRef.current && !reportsDropdownRef.current.contains(event.target) &&
        reportsButtonRef.current && !reportsButtonRef.current.contains(event.target)) {
        setReportsDropdownOpen(false);
      }
    }
    if (profileDropdownOpen || masterManagementDropdownOpen || accessControlDropdownOpen || reportsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen, masterManagementDropdownOpen, accessControlDropdownOpen, reportsDropdownOpen]);


  // Set default active sidebar based on user permissions and fetch permissions if needed
  useEffect(() => {
    // Always fetch permissions when company changes, regardless of cached data
    const currentCompany = allConnections.find(c => c.guid === selectedCompanyGuid);
    if (currentCompany) {
      console.log('🔐 Company changed, fetching fresh permissions for:', currentCompany.company);
      fetchUserAccessPermissions(currentCompany);
      initialPermissionsRequestedRef.current = true;
    }
  }, [allConnections, selectedCompanyGuid]); // Include dependencies

  useEffect(() => {
    if (initialPermissionsRequestedRef.current) {
      return;
    }
    if (!selectedCompanyGuid) {
      return;
    }
    const modules = getUserModules();
    if (Array.isArray(modules) && modules.length > 0) {
      initialPermissionsRequestedRef.current = true;
      resolveActiveSidebar(modules);
      return;
    }

    const connectionFromList = allConnections.find(c => c.guid === selectedCompanyGuid);
    if (connectionFromList) {
      initialPermissionsRequestedRef.current = true;
      console.log('🔐 Initial permissions missing, requesting using connection list entry');
      setSidebarLoading(true);
      fetchUserAccessPermissions(connectionFromList);
      return;
    }

    const storedTallyloc = sessionStorage.getItem('tallyloc_id');
    const storedCompany = sessionStorage.getItem('company');
    const storedGuid = sessionStorage.getItem('guid');
    if (storedTallyloc && storedCompany && storedGuid) {
      initialPermissionsRequestedRef.current = true;
      console.log('🔐 Initial permissions missing, requesting using stored session values');
      setSidebarLoading(true);
      fetchUserAccessPermissions({
        tallyloc_id: storedTallyloc,
        company: storedCompany,
        guid: storedGuid,
        conn_name: sessionStorage.getItem('conn_name') || '',
        shared_email: sessionStorage.getItem('shared_email') || '',
        status: sessionStorage.getItem('status') || '',
        access_type: sessionStorage.getItem('access_type') || ''
      });
    }
  }, [selectedCompanyGuid, allConnections, resolveActiveSidebar]);

  // Reusable function to download customers and items in the background
  const downloadCustomersAndItems = React.useCallback(async (companyConnection) => {
    if (!companyConnection || !companyConnection.guid) {
      console.warn('⚠️ Cannot download: invalid company connection');
      return;
    }

    try {
      console.log('🔄 Starting automatic background download of customers and items for:', companyConnection.company);

      // Set downloading state in sessionStorage for CacheManagement to read
      const progressKey = `download_progress_${companyConnection.guid}`;
      sessionStorage.setItem(progressKey, JSON.stringify({
        customers: { status: 'downloading', progress: 0 },
        items: { status: 'downloading', progress: 0 }
      }));

      // Dispatch event to notify CacheManagement
      window.dispatchEvent(new CustomEvent('ledgerDownloadStarted', { detail: { company: companyConnection } }));

      // Download customers
      try {
        console.log('🔄 Starting customers download...');
        const customersResult = await syncCustomers(companyConnection);
        console.log('✅ Customers downloaded:', customersResult);

        // Update progress
        const currentProgress = JSON.parse(sessionStorage.getItem(progressKey) || '{}');
        currentProgress.customers = { status: 'completed', progress: 100, count: customersResult.count };
        sessionStorage.setItem(progressKey, JSON.stringify(currentProgress));
        window.dispatchEvent(new CustomEvent('ledgerDownloadProgress', {
          detail: { company: companyConnection, type: 'customers', status: 'completed', count: customersResult.count }
        }));

        // Trigger cache stats reload in CacheManagement
        window.dispatchEvent(new CustomEvent('ledgerCacheUpdated', { detail: { type: 'customers', company: companyConnection } }));
      } catch (error) {
        console.error('❌ Failed to download customers:', error);
        const currentProgress = JSON.parse(sessionStorage.getItem(progressKey) || '{}');
        currentProgress.customers = { status: 'error', progress: 0, error: error.message };
        sessionStorage.setItem(progressKey, JSON.stringify(currentProgress));
        window.dispatchEvent(new CustomEvent('ledgerDownloadProgress', {
          detail: { company: companyConnection, type: 'customers', status: 'error', error: error.message }
        }));
      }

      // Download items
      try {
        console.log('🔄 Starting items download...');
        const itemsResult = await syncItems(companyConnection);
        console.log('✅ Items downloaded:', itemsResult);

        // Update progress
        const currentProgress = JSON.parse(sessionStorage.getItem(progressKey) || '{}');
        currentProgress.items = { status: 'completed', progress: 100, count: itemsResult.count };
        sessionStorage.setItem(progressKey, JSON.stringify(currentProgress));
        window.dispatchEvent(new CustomEvent('ledgerDownloadProgress', {
          detail: { company: companyConnection, type: 'items', status: 'completed', count: itemsResult.count }
        }));

        // Trigger cache stats reload in CacheManagement
        window.dispatchEvent(new CustomEvent('ledgerCacheUpdated', { detail: { type: 'items', company: companyConnection } }));
      } catch (error) {
        console.error('❌ Failed to download items:', error);
        const currentProgress = JSON.parse(sessionStorage.getItem(progressKey) || '{}');
        currentProgress.items = { status: 'error', progress: 0, error: error.message };
        sessionStorage.setItem(progressKey, JSON.stringify(currentProgress));
        window.dispatchEvent(new CustomEvent('ledgerDownloadProgress', {
          detail: { company: companyConnection, type: 'items', status: 'error', error: error.message }
        }));
      }
    } catch (error) {
      console.error('❌ Error in background download:', error);
    }
  }, []);

  // Update active sidebar when user access permissions are loaded
  useEffect(() => {
    const userModules = getUserModules();
    resolveActiveSidebar(userModules);
  }, [selectedCompanyGuid, resolveActiveSidebar]);

  // Auto-download customers and items when company is selected (initial load or change)
  useEffect(() => {
    if (!selectedCompanyGuid) {
      return;
    }

    // Find the company connection
    const companyConnection = allConnections.find(c => c.guid === selectedCompanyGuid);
    if (!companyConnection) {
      // Try to construct from sessionStorage if not in allConnections yet
      const storedTallyloc = sessionStorage.getItem('tallyloc_id');
      const storedCompany = sessionStorage.getItem('company');
      const storedGuid = sessionStorage.getItem('guid');
      if (storedGuid === selectedCompanyGuid && storedTallyloc && storedCompany) {
        const companyFromStorage = {
          tallyloc_id: storedTallyloc,
          company: storedCompany,
          guid: storedGuid,
          conn_name: sessionStorage.getItem('conn_name') || '',
          shared_email: sessionStorage.getItem('shared_email') || '',
          status: sessionStorage.getItem('status') || '',
          access_type: sessionStorage.getItem('access_type') || ''
        };
        console.log('🔄 Auto-downloading customers and items for company from sessionStorage:', companyFromStorage.company);
        downloadCustomersAndItems(companyFromStorage);
      }
      return;
    }

    // Check if download is already in progress for this company
    const progressKey = `download_progress_${companyConnection.guid}`;
    const existingProgress = sessionStorage.getItem(progressKey);
    if (existingProgress) {
      try {
        const progress = JSON.parse(existingProgress);
        // If both are already completed or downloading, don't start again
        if ((progress.customers?.status === 'completed' || progress.customers?.status === 'downloading') &&
          (progress.items?.status === 'completed' || progress.items?.status === 'downloading')) {
          console.log('🔄 Download already in progress or completed for:', companyConnection.company);
          return;
        }
      } catch (e) {
        // If we can't parse, proceed with download
      }
    }

    console.log('🔄 Auto-downloading customers and items for company:', companyConnection.company);
    downloadCustomersAndItems(companyConnection);
  }, [selectedCompanyGuid, allConnections, downloadCustomersAndItems]);

  // Also listen for companyChanged event to trigger download
  useEffect(() => {
    const handleCompanyChanged = (event) => {
      const companyConnection = event.detail;
      if (companyConnection && companyConnection.guid) {
        console.log('🔄 companyChanged event received, triggering download for:', companyConnection.company);
        // Small delay to ensure sessionStorage is updated
        setTimeout(() => {
          downloadCustomersAndItems(companyConnection);
        }, 500);
      }
    };

    window.addEventListener('companyChanged', handleCompanyChanged);
    return () => {
      window.removeEventListener('companyChanged', handleCompanyChanged);
    };
  }, [downloadCustomersAndItems]);

  // Update active sidebar when user access permissions change (company change)
  useEffect(() => {
    const handleUserAccessUpdate = () => {
      const userModules = getUserModules();
      resolveActiveSidebar(userModules);
    };

    // Listen for user access updates
    window.addEventListener('userAccessUpdated', handleUserAccessUpdate);

    return () => {
      window.removeEventListener('userAccessUpdated', handleUserAccessUpdate);
    };
  }, [resolveActiveSidebar]);

  // Listen for navigation to Place Order from E-commerce
  useEffect(() => {
    const handleNavigateToPlaceOrder = (event) => {
      console.log('🛒 Navigate to Place Order event received:', event.detail);
      setActiveSidebarWithPersistence('order');
    };

    window.addEventListener('navigateToPlaceOrder', handleNavigateToPlaceOrder);

    return () => {
      window.removeEventListener('navigateToPlaceOrder', handleNavigateToPlaceOrder);
    };
  }, [setActiveSidebarWithPersistence]);

  // Fetch user access permissions for a company
  const fetchUserAccessPermissions = async (companyConnection) => {
    try {
      // Add cache-busting parameter to ensure fresh API call
      const timestamp = Date.now();
      const apiUrl = getApiUrl(`/api/access-control/user-access?tallylocId=${companyConnection.tallyloc_id}&co_guid=${companyConnection.guid}&_t=${timestamp}`);
      console.log('🔐 API URL:', apiUrl);
      console.log('🔐 Fetching user access permissions for tallyloc_id:', companyConnection.tallyloc_id, 'co_guid:', companyConnection.guid, 'timestamp:', timestamp);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 API Response status:', response.status);

      if (response.ok) {
        const accessData = await response.json();
        console.log('✅ User access permissions loaded for company:', companyConnection.company, 'data:', accessData);

        // Store access permissions in sessionStorage - overwrite existing
        sessionStorage.setItem('userAccessPermissions', JSON.stringify(accessData));
        console.log('💾 Stored user access permissions in session storage');

        // Update sidebar with new permissions
        const userModules = accessData.data?.modules || [];
        resolveActiveSidebar(userModules);

        // Clear loading state
        setSidebarLoading(false);

        // Dispatch event with access data for components that need it
        window.dispatchEvent(new CustomEvent('userAccessUpdated', { detail: accessData }));

        return accessData;
      } else {
        console.error('❌ Failed to fetch user access permissions:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        setSidebarLoading(false);
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching user access permissions:', error);
      setSidebarLoading(false);
      return null;
    }
  };

  // Handle company change in top bar
  const handleTopBarCompanyChange = async (companyConnection) => {
    console.log('🚀 handleTopBarCompanyChange function called!');
    console.log('🏢 Company changed in top bar:', companyConnection);
    console.log('🔍 Current selectedCompanyGuid before change:', selectedCompanyGuid);
    console.log('🔍 New company guid:', companyConnection.guid);
    const previousActiveSidebarId = activeSidebar;
    desiredActiveSidebarRef.current = previousActiveSidebarId;

    // Update sessionStorage with new company data
    sessionStorage.setItem('tallyloc_id', companyConnection.tallyloc_id || '');
    sessionStorage.setItem('conn_name', companyConnection.conn_name || '');
    sessionStorage.setItem('company', companyConnection.company || '');
    sessionStorage.setItem('guid', companyConnection.guid || '');
    sessionStorage.setItem('shared_email', companyConnection.shared_email || '');
    sessionStorage.setItem('status', companyConnection.status || '');
    sessionStorage.setItem('access_type', companyConnection.access_type || '');
    sessionStorage.setItem('selectedCompanyGuid', companyConnection.guid || '');

    // Update local state
    setSelectedCompanyGuid(companyConnection.guid);

    // Show loading state
    setSidebarLoading(true);

    // Fetch user access permissions for the new company
    console.log('🚀 About to call fetchUserAccessPermissions for company:', companyConnection.company);
    await fetchUserAccessPermissions(companyConnection);
    console.log('✅ fetchUserAccessPermissions completed for company:', companyConnection.company);

    // Trigger refresh of child components by dispatching an event
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: companyConnection }));

    // Automatically download customers and items in the background
    downloadCustomersAndItems(companyConnection);
  };

  // Global refresh function for all pages
  const handleGlobalRefresh = async () => {
    console.log('🔄 Refresh button clicked! Reloading window...');
    // Reload the window to refresh all data
    window.location.reload();
  };

  const handleLogout = async () => {
    // Clear cache for external users before clearing sessionStorage
    try {
      const accessType = sessionStorage.getItem('access_type') || '';
      if (accessType.toLowerCase() === 'external' || isExternalUser()) {
        console.log('🧹 Clearing cache for external user on logout...');
        await clearAllCacheForExternalUser();
      }
    } catch (error) {
      console.error('Error clearing cache on logout:', error);
      // Continue with logout even if cache clearing fails
    }

    sessionStorage.clear();
    window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
  };

  // Safe navigation function that checks for ongoing data loading
  const handleSafeNavigation = useCallback((newSidebarId) => {
    // Check if sales dashboard is currently loading data
    if (window.salesDashboardLoading && activeSidebar === 'sales_dashboard') {
      console.log('⚠️ Navigation blocked - Sales dashboard is loading data');
      const navigationCallback = () => {
        setActiveSidebarWithPersistence(newSidebarId);
        setPendingSidebarNavigation(null);
      };
      setPendingSidebarNavigation(() => navigationCallback);
      if (window.salesDashboardShowWarning) {
        window.salesDashboardShowWarning(navigationCallback);
      }
      return false;
    }

    // Safe to navigate
    setActiveSidebarWithPersistence(newSidebarId);
    return true;
  }, [activeSidebar, setActiveSidebarWithPersistence]);

  // Execute pending navigation when user confirms
  useEffect(() => {
    if (pendingSidebarNavigation && !window.salesDashboardLoading) {
      pendingSidebarNavigation();
      setPendingSidebarNavigation(null);
    }
  }, [pendingSidebarNavigation]);

  // Prepare sidebar items for mobile menu
  const getMobileSidebarItems = useCallback(() => {
    const userModules = getUserModules();
    return MODULE_SEQUENCE
      .filter(module => {
        if (module.key === 'main_menu') return false;
        // Special handling for cache_management - always show it, let component handle access denial
        if (module.key === 'cache_management') return true;
        if (module.hasSubModules) {
          return isAlwaysVisible(module.key) || hasAnySubModuleAccess(module.key, userModules);
        }
        return isAlwaysVisible(module.key) || hasModuleAccess(module.key, userModules);
      })
      .map(module => {
        if (module.hasSubModules && !module.useDropdownFilter) {
          const accessibleSubModules = (module.subModules || []).filter(sub =>
            isAlwaysVisible(module.key) || hasSubModuleAccess(sub.key, userModules)
          );
          return {
            key: module.id,
            label: module.label,
            icon: module.icon,
            hasSubModules: accessibleSubModules.length > 0,
            subModules: accessibleSubModules.map(sub => ({
              key: sub.id,
              label: sub.label,
              icon: sub.icon,
            })),
          };
        }
        return {
          key: module.id,
          label: module.label,
          icon: module.icon,
        };
      });
  }, []);

  // Enhanced sidebar rendering
  const renderSidebarItems = () => {
    const userModules = getUserModules();

    // Debug: Log user modules to see what permissions are available
    console.log('🔍 User modules for sidebar:', userModules);
    console.log('🔍 Module names:', userModules.map(m => m.module_name));

    return MODULE_SEQUENCE.map(module => {
      // Skip main_menu (Main Menu) - it's removed from sidebar
      if (module.key === 'main_menu') {
        return null;
      }

      // Debug: Check master_form specifically
      if (module.key === 'master_form') {
        console.log('🔍 Master Form module check:', {
          key: module.key,
          alwaysVisible: isAlwaysVisible(module.key),
          module: module
        });
      }

      // For modules with sub-modules (like Ledger Book or Master Management)
      if (module.hasSubModules) {
        // Debug: Log Reports module specifically
        if (module.key === 'reports') {
          console.log('🔍 Reports module found:', {
            key: module.key,
            hasSubModules: module.hasSubModules,
            useRightSideDropdown: shouldUseRightSideDropdown(module.key),
            isAlwaysVisible: isAlwaysVisible(module.key),
            hasAnySubModuleAccess: hasAnySubModuleAccess(module.key, userModules)
          });
        }
        // Check if this module should use right-side dropdown (Master Management or Reports)
        if (shouldUseRightSideDropdown(module.key)) {
          // For reports, check if any submodule is accessible using required modules logic
          if (module.key === 'reports') {
            if (hasAnyAccessibleSubModule(module.key, userModules)) {
              console.log('✅ Rendering reports with dropdown:', module.key);
              return renderReportsWithDropdown(module, userModules);
            } else {
              console.log('❌ Reports module not showing - no accessible submodules');
              return null;
            }
          }
          // For master management, show if user has access to master_creation OR master_authorization
          if (module.key === 'master_management') {
            const hasMasterCreation = hasModuleAccess('master_creation', userModules);
            const hasMasterAuthorization = hasModuleAccess('master_authorization', userModules);
            if (hasMasterCreation || hasMasterAuthorization) {
              console.log('✅ Rendering master management with dropdown:', module.key);
              return renderMasterManagementWithDropdown(module, userModules);
            } else {
              console.log('❌ Master management not showing - no access to master_creation or master_authorization');
              return null;
            }
          }
          return null;
        }
        const hasAccess = hasAnySubModuleAccess(module.key, userModules);
        if (hasAccess) {
          // Check if this module should use dropdown filter instead of sub-menu
          if (module.useDropdownFilter) {
            return renderSidebarItem(module.key, module);
          } else {
            return renderSidebarItemWithSubModules(module, userModules);
          }
        }
        // If no sub-modules have access, don't show the main module
        return null;
      }

      // Always show modules marked as alwaysVisible (except main_menu and modules with submodules)
      if (isAlwaysVisible(module.key)) {
        console.log('✅ Rendering always visible module:', module.key, module.label);
        return renderSidebarItem(module.key, module);
      }

      // Special handling for cache_management - check access permissions
      if (module.key === 'cache_management') {
        // Check cache access asynchronously - we'll show it if user has access
        // The CacheManagement component itself will handle the access check and show error if needed
        // For now, we'll show it to all users and let the component handle access denial
        // This is because access check is async and we don't want to block sidebar rendering
        return renderSidebarItem(module.key, module);
      }

      // For regular modules (Place Order, E-Commerce)
      const hasAccess = hasModuleAccess(module.key, userModules);
      if (hasAccess) {
        return renderSidebarItem(module.key, module);
      }

      return null;
    }).filter(Boolean);
  };


  // Render regular sidebar item
  const renderSidebarItem = (moduleKey, module) => {
    const isActive = activeSidebar === module.id;
    return (
      <button
        key={moduleKey}
        onClick={() => {
          if (moduleKey === 'main_menu') {
            navigate('/admin-dashboard');
          } else {
            handleSafeNavigation(module.id);
          }
        }}
        style={{
          color: isActive ? '#ff9800' : '#fff',
          background: isActive
            ? 'rgba(255, 152, 0, 0.08)'
            : 'transparent',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          borderRadius: '12px',
          fontWeight: isActive ? 700 : 500,
          margin: '0',
          border: isActive
            ? '1px solid rgba(255, 255, 255, 0.2)'
            : '1px solid transparent',
          cursor: 'pointer',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          position: 'relative',
          width: '100%',
          textAlign: 'left',
          fontSize: '14px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          flexWrap: 'nowrap',
          boxShadow: isActive
            ? '0 4px 12px rgba(255, 152, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : 'none',
        }}
        title={module.label}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'translateX(4px)';
          }
          if (!sidebarOpen) {
            const rect = e.currentTarget.getBoundingClientRect();
            setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
            if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
            sidebarTooltipTimeout = setTimeout(() => {
              setSidebarTooltip({ show: false, text: '', top: 0 });
            }, 1500);
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
            e.currentTarget.style.transform = 'translateX(0)';
          }
          if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
          setSidebarTooltip({ show: false, text: '', top: 0 });
        }}
      >
        <span
          className="material-icons"
          style={{
            fontSize: 22,
            color: isActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
            transition: 'color 0.2s',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          {module.icon}
        </span>
        {sidebarOpen && (
          <span
            className="sidebar-link-label"
            style={{
              fontSize: '14px',
              letterSpacing: '0.3px',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              lineHeight: '1.4',
              flex: 1,
            }}
          >
            {module.label}
          </span>
        )}
        {isActive && sidebarOpen && (
          <div style={{
            position: 'absolute',
            right: 12,
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#ff9800',
            boxShadow: '0 0 8px rgba(255, 152, 0, 0.6)',
          }} />
        )}
      </button>
    );
  };

  // Update master dropdown position when it opens
  useEffect(() => {
    const updateMasterDropdownPosition = () => {
      if (masterManagementDropdownOpen && masterButtonRef.current) {
        const rect = masterButtonRef.current.getBoundingClientRect();
        const dropdownWidth = 220; // minWidth from dropdown style
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Estimate dropdown height (each item is ~50px + padding)
        const itemCount = masterManagementDropdownRef.current?.querySelectorAll('button').length || 2;
        const estimatedDropdownHeight = (itemCount * 50) + 16; // 16px for padding

        // Calculate initial top position
        let topPosition = rect.top;

        // Check if dropdown would overflow bottom of viewport
        if (topPosition + estimatedDropdownHeight > viewportHeight) {
          // Move dropdown up so it fits within viewport
          topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
        }

        // Check if dropdown would overflow to the right
        const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
        let leftPosition;

        if (wouldOverflowRight) {
          // Position to the left of button
          leftPosition = Math.max(8, rect.left - dropdownWidth - 8);
        } else {
          // Position to the right of button
          leftPosition = rect.left + rect.width + 8;
        }

        setMasterDropdownPosition({
          top: topPosition,
          left: leftPosition,
          width: rect.width
        });
      }
    };

    if (masterManagementDropdownOpen) {
      updateMasterDropdownPosition();
      const handleResize = () => updateMasterDropdownPosition();
      const handleScroll = () => updateMasterDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [masterManagementDropdownOpen]);

  // Render master management with right-side dropdown
  const renderMasterManagementWithDropdown = (module, userModules) => {
    // Filter submodules based on access
    const accessibleSubModules = module.subModules.filter(subModule =>
      isAlwaysVisible(subModule.key) || hasSubModuleAccess(subModule.key, userModules)
    );

    // Don't render if no submodules are accessible
    if (accessibleSubModules.length === 0) {
      return null;
    }
    const isParentActive = activeSidebar === module.id || accessibleSubModules.some(sub => sub.id === activeSidebar);

    const updateButtonPosition = () => {
      if (masterButtonRef.current) {
        const rect = masterButtonRef.current.getBoundingClientRect();
        const dropdownWidth = 220;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate dropdown height based on actual item count
        const itemCount = accessibleSubModules.length;
        const estimatedDropdownHeight = (itemCount * 50) + 16; // 50px per item + 16px padding

        // Calculate initial top position
        let topPosition = rect.top;

        // Check if dropdown would overflow bottom of viewport
        if (topPosition + estimatedDropdownHeight > viewportHeight) {
          // Move dropdown up so it fits within viewport
          topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
        }

        // Check if dropdown would overflow to the right
        const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
        let leftPosition;

        if (wouldOverflowRight) {
          // Position to the left of button
          leftPosition = Math.max(8, rect.left - dropdownWidth - 8);
        } else {
          // Position to the right of button
          leftPosition = rect.left + rect.width + 8;
        }

        setMasterDropdownPosition({
          top: topPosition,
          left: leftPosition,
          width: rect.width
        });
      }
    };

    return (
      <div key={module.key} style={{ marginBottom: 4, position: 'relative' }} ref={masterManagementDropdownRef}>
        <button
          ref={masterButtonRef}
          style={{
            color: isParentActive ? '#ff9800' : '#fff',
            background: isParentActive
              ? 'rgba(255, 152, 0, 0.08)'
              : 'transparent',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            borderRadius: '12px',
            fontWeight: isParentActive ? 700 : 500,
            margin: '0',
            border: isParentActive
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid transparent',
            cursor: 'pointer',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            position: 'relative',
            width: '100%',
            textAlign: 'left',
            fontSize: '14px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexWrap: 'nowrap',
            boxShadow: isParentActive
              ? '0 4px 12px rgba(255, 152, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : 'none',
          }}
          title={module.label}
          onMouseEnter={e => {
            if (sidebarOpen) {
              setMasterManagementDropdownOpen(true);
              // Update position when dropdown opens
              setTimeout(() => {
                if (masterButtonRef.current) {
                  const rect = masterButtonRef.current.getBoundingClientRect();
                  const dropdownWidth = 220;
                  const viewportWidth = window.innerWidth;
                  const viewportHeight = window.innerHeight;
                  const itemCount = accessibleSubModules.length;
                  const estimatedDropdownHeight = (itemCount * 50) + 16;
                  let topPosition = rect.top;
                  if (topPosition + estimatedDropdownHeight > viewportHeight) {
                    topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
                  }
                  const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
                  let leftPosition = wouldOverflowRight
                    ? Math.max(8, rect.left - dropdownWidth - 8)
                    : rect.left + rect.width + 8;
                  setMasterDropdownPosition({ top: topPosition, left: leftPosition, width: rect.width });
                }
              }, 0);
            }
            if (!isParentActive) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateX(4px)';
            }
            if (!sidebarOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
              if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
              sidebarTooltipTimeout = setTimeout(() => {
                setSidebarTooltip({ show: false, text: '', top: 0 });
              }, 1500);
            }
          }}
          onMouseLeave={e => {
            // Don't close dropdown here - let the dropdown's onMouseLeave handle it
            if (!isParentActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
              e.currentTarget.style.transform = 'translateX(0)';
            }
            if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
            setSidebarTooltip({ show: false, text: '', top: 0 });
          }}
        >
          <span
            className="material-icons"
            style={{
              fontSize: 22,
              color: isParentActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
              transition: 'color 0.2s',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {module.icon}
          </span>
          {sidebarOpen && (
            <>
              <span
                className="sidebar-link-label"
                style={{
                  fontSize: '14px',
                  letterSpacing: '0.3px',
                  whiteSpace: 'normal',
                  wordWrap: 'break-word',
                  lineHeight: '1.4',
                  flex: 1,
                }}
              >
                {module.label}
              </span>
              <span
                className="material-icons"
                style={{
                  fontSize: 18,
                  color: isParentActive ? '#ff9800' : 'rgba(255, 255, 255, 0.7)',
                  flexShrink: 0,
                }}
              >
                arrow_drop_down
              </span>
            </>
          )}
        </button>

        {/* Right-side dropdown menu */}
        {sidebarOpen && masterManagementDropdownOpen && accessibleSubModules.length > 0 && (
          <div
            ref={masterManagementDropdownRef}
            style={{
              position: 'fixed',
              top: `${masterDropdownPosition.top}px`,
              left: `${masterDropdownPosition.left}px`,
              backgroundColor: '#1e3a8a',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '8px 0',
              minWidth: '220px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
            onMouseEnter={() => {
              // Clear any pending close timeout
              if (masterDropdownCloseTimeoutRef.current) {
                clearTimeout(masterDropdownCloseTimeoutRef.current);
                masterDropdownCloseTimeoutRef.current = null;
              }
              setMasterManagementDropdownOpen(true);
              if (masterButtonRef.current) {
                const rect = masterButtonRef.current.getBoundingClientRect();
                const dropdownWidth = 220;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Calculate dropdown height based on actual item count
                const itemCount = accessibleSubModules.length;
                const estimatedDropdownHeight = (itemCount * 50) + 16; // 50px per item + 16px padding

                // Calculate initial top position
                let topPosition = rect.top;

                // Check if dropdown would overflow bottom of viewport
                if (topPosition + estimatedDropdownHeight > viewportHeight) {
                  // Move dropdown up so it fits within viewport
                  topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
                }

                // Check if dropdown would overflow to the right
                const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
                let leftPosition;

                if (wouldOverflowRight) {
                  // Position to the left of button
                  leftPosition = Math.max(8, rect.left - dropdownWidth - 8);
                } else {
                  // Position to the right of button
                  leftPosition = rect.left + rect.width + 8;
                }

                setMasterDropdownPosition({
                  top: topPosition,
                  left: leftPosition,
                  width: rect.width
                });
              }
            }}
            onMouseLeave={() => {
              // Close immediately when mouse leaves dropdown
              if (masterDropdownCloseTimeoutRef.current) {
                clearTimeout(masterDropdownCloseTimeoutRef.current);
                masterDropdownCloseTimeoutRef.current = null;
              }
              setMasterManagementDropdownOpen(false);
            }}
          >
            {accessibleSubModules.map(subModule => {
              const isSubActive = activeSidebar === subModule.id;
              return (
                <button
                  key={subModule.key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Master dropdown item clicked:', subModule.key, subModule.id);
                    handleSafeNavigation(subModule.id);
                    setMasterManagementDropdownOpen(false);
                  }}
                  style={{
                    color: isSubActive ? '#ff9800' : '#fff',
                    background: isSubActive
                      ? 'rgba(255, 152, 0, 0.15)'
                      : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: isSubActive ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 20,
                      color: isSubActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
                      flexShrink: 0,
                    }}
                  >
                    {subModule.icon}
                  </span>
                  <span>{subModule.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReportsWithDropdown = (module, userModules) => {
    // Filter submodules based on required modules or submodule access
    const accessibleSubModules = module.subModules.filter(subModule =>
      isAlwaysVisible(subModule.key) || hasRequiredModuleAccess(subModule, userModules)
    );

    // Don't render if no submodules are accessible
    if (accessibleSubModules.length === 0) {
      return null;
    }

    const isParentActive = activeSidebar === module.id || accessibleSubModules.some(sub => sub.id === activeSidebar);

    const updateButtonPosition = () => {
      if (reportsButtonRef.current) {
        const rect = reportsButtonRef.current.getBoundingClientRect();
        const dropdownWidth = 220;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate dropdown height based on actual item count
        const itemCount = accessibleSubModules.length;
        const estimatedDropdownHeight = (itemCount * 50) + 16; // 50px per item + 16px padding

        // Calculate initial top position
        let topPosition = rect.top;

        // Check if dropdown would overflow bottom of viewport
        if (topPosition + estimatedDropdownHeight > viewportHeight) {
          // Move dropdown up so it fits within viewport
          topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
        }

        // Check if dropdown would overflow to the right
        const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
        let leftPosition;

        if (wouldOverflowRight) {
          // Position to the left of button
          leftPosition = Math.max(8, rect.left - dropdownWidth - 8);
        } else {
          // Position to the right of button
          leftPosition = rect.left + rect.width + 8;
        }

        setReportsDropdownPosition({
          top: topPosition,
          left: leftPosition,
          width: rect.width
        });
      }
    };

    return (
      <div key={module.key} style={{ marginBottom: 4, position: 'relative' }}>
        <button
          ref={reportsButtonRef}
          style={{
            color: isParentActive ? '#ff9800' : '#fff',
            background: isParentActive
              ? 'rgba(255, 152, 0, 0.08)'
              : 'transparent',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            borderRadius: '12px',
            fontWeight: isParentActive ? 700 : 500,
            margin: '0',
            border: isParentActive
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid transparent',
            cursor: 'pointer',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            position: 'relative',
            width: '100%',
            textAlign: 'left',
            fontSize: '14px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexWrap: 'nowrap',
            boxShadow: isParentActive
              ? '0 4px 12px rgba(255, 152, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : 'none',
          }}
          title={module.label}
          onMouseEnter={e => {
            if (sidebarOpen) {
              setReportsDropdownOpen(true);
              setTimeout(updateButtonPosition, 0);
            }
            if (!isParentActive) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateX(4px)';
            }
            if (!sidebarOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
              if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
              sidebarTooltipTimeout = setTimeout(() => {
                setSidebarTooltip({ show: false, text: '', top: 0 });
              }, 1500);
            }
          }}
          onMouseLeave={e => {
            // Don't close dropdown here - let the dropdown's onMouseLeave handle it
            if (!isParentActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
              e.currentTarget.style.transform = 'translateX(0)';
            }
            if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
            setSidebarTooltip({ show: false, text: '', top: 0 });
          }}
        >
          <span
            className="material-icons"
            style={{
              fontSize: 22,
              color: isParentActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
              transition: 'color 0.2s',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {module.icon}
          </span>
          {sidebarOpen && (
            <>
              <span
                className="sidebar-link-label"
                style={{
                  fontSize: '14px',
                  letterSpacing: '0.3px',
                  whiteSpace: 'normal',
                  wordWrap: 'break-word',
                  lineHeight: '1.4',
                  flex: 1,
                }}
              >
                {module.label}
              </span>
              <span
                className="material-icons"
                style={{
                  fontSize: 18,
                  color: isParentActive ? '#ff9800' : 'rgba(255, 255, 255, 0.7)',
                  flexShrink: 0,
                }}
              >
                arrow_drop_down
              </span>
            </>
          )}
        </button>

        {/* Right-side dropdown menu */}
        {sidebarOpen && reportsDropdownOpen && accessibleSubModules.length > 0 && (
          <div
            ref={reportsDropdownRef}
            style={{
              position: 'fixed',
              top: `${reportsDropdownPosition.top}px`,
              left: `${reportsDropdownPosition.left}px`,
              backgroundColor: '#1e3a8a',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '8px 0',
              minWidth: '220px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
            onMouseEnter={() => {
              // Clear any pending close timeout
              if (reportsDropdownCloseTimeoutRef.current) {
                clearTimeout(reportsDropdownCloseTimeoutRef.current);
                reportsDropdownCloseTimeoutRef.current = null;
              }
              setReportsDropdownOpen(true);
              if (reportsButtonRef.current) {
                const rect = reportsButtonRef.current.getBoundingClientRect();
                const dropdownWidth = 220;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Calculate dropdown height based on actual item count
                const itemCount = accessibleSubModules.length;
                const estimatedDropdownHeight = (itemCount * 50) + 16; // 50px per item + 16px padding

                // Calculate initial top position
                let topPosition = rect.top;

                // Check if dropdown would overflow bottom of viewport
                if (topPosition + estimatedDropdownHeight > viewportHeight) {
                  // Move dropdown up so it fits within viewport
                  topPosition = Math.max(64, viewportHeight - estimatedDropdownHeight - 8);
                }

                // Check if dropdown would overflow to the right
                const wouldOverflowRight = (rect.left + rect.width + dropdownWidth + 8) > viewportWidth;
                let leftPosition;

                if (wouldOverflowRight) {
                  // Position to the left of button
                  leftPosition = Math.max(8, rect.left - dropdownWidth - 8);
                } else {
                  // Position to the right of button
                  leftPosition = rect.left + rect.width + 8;
                }

                setReportsDropdownPosition({
                  top: topPosition,
                  left: leftPosition,
                  width: rect.width
                });
              }
            }}
            onMouseLeave={() => {
              // Close immediately when mouse leaves dropdown
              if (reportsDropdownCloseTimeoutRef.current) {
                clearTimeout(reportsDropdownCloseTimeoutRef.current);
                reportsDropdownCloseTimeoutRef.current = null;
              }
              setReportsDropdownOpen(false);
            }}
          >
            {accessibleSubModules.map(subModule => {
              const isSubActive = activeSidebar === subModule.id;
              return (
                <button
                  key={subModule.key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Reports dropdown item clicked:', subModule.key, subModule.id);
                    handleSafeNavigation(subModule.id);
                    setReportsDropdownOpen(false);
                  }}
                  style={{
                    color: isSubActive ? '#ff9800' : '#fff',
                    background: isSubActive
                      ? 'rgba(255, 152, 0, 0.15)'
                      : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: isSubActive ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 20,
                      color: isSubActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
                      flexShrink: 0,
                    }}
                  >
                    {subModule.icon}
                  </span>
                  <span>{subModule.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render sidebar item with sub-modules and their permissions
  const renderSidebarItemWithSubModules = (module, userModules) => {
    const accessibleSubModules = module.subModules.filter(subModule =>
      hasSubModuleAccess(subModule.key, userModules)
    );
    const isParentActive = activeSidebar === module.id || accessibleSubModules.some(sub => sub.id === activeSidebar);

    return (
      <div key={module.key} style={{ marginBottom: 4 }}>
        <button
          onClick={() => {
            setActiveSidebarWithPersistence(module.id);
          }}
          style={{
            color: isParentActive ? '#ff9800' : '#fff',
            background: isParentActive
              ? 'rgba(255, 152, 0, 0.08)'
              : 'transparent',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            borderRadius: '12px',
            fontWeight: isParentActive ? 700 : 500,
            margin: '0',
            border: isParentActive
              ? '1px solid rgba(255, 255, 255, 0.2)'
              : '1px solid transparent',
            cursor: 'pointer',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            position: 'relative',
            width: '100%',
            textAlign: 'left',
            fontSize: '14px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexWrap: 'nowrap',
            boxShadow: isParentActive
              ? '0 4px 12px rgba(255, 152, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : 'none',
          }}
          title={module.label}
          onMouseEnter={e => {
            if (!isParentActive) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateX(4px)';
            }
            if (!sidebarOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
              if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
              sidebarTooltipTimeout = setTimeout(() => {
                setSidebarTooltip({ show: false, text: '', top: 0 });
              }, 1500);
            }
          }}
          onMouseLeave={e => {
            if (!isParentActive) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
              e.currentTarget.style.transform = 'translateX(0)';
            }
            if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
            setSidebarTooltip({ show: false, text: '', top: 0 });
            // Close dropdown after a short delay (allows time to move to dropdown)
            if (masterDropdownCloseTimeoutRef.current) {
              clearTimeout(masterDropdownCloseTimeoutRef.current);
            }
            masterDropdownCloseTimeoutRef.current = setTimeout(() => {
              setMasterManagementDropdownOpen(false);
            }, 200);
          }}
        >
          <span
            className="material-icons"
            style={{
              fontSize: 22,
              color: isParentActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
              transition: 'color 0.2s',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {module.icon}
          </span>
          {sidebarOpen && (
            <span
              className="sidebar-link-label"
              style={{
                fontSize: '14px',
                letterSpacing: '0.3px',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                lineHeight: '1.4',
                flex: 1,
              }}
            >
              {module.label}
            </span>
          )}
        </button>

        {/* Sub-modules */}
        {sidebarOpen && accessibleSubModules.length > 0 && (
          <div style={{
            marginLeft: '12px',
            marginTop: '4px',
            paddingLeft: '12px',
            borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {accessibleSubModules.map(subModule => {
              const isSubActive = activeSidebar === subModule.id;
              return (
                <button
                  key={subModule.key}
                  onClick={() => {
                    handleSafeNavigation(subModule.id);
                  }}
                  style={{
                    color: isSubActive ? '#ff9800' : '#fff',
                    background: isSubActive
                      ? 'rgba(255, 152, 0, 0.08)'
                      : 'transparent',
                    padding: '10px 14px 10px 36px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    borderRadius: '10px',
                    fontWeight: isSubActive ? 700 : 500,
                    margin: '0',
                    border: isSubActive
                      ? '1px solid rgba(255, 255, 255, 0.2)'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    fontSize: '13px',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    flexWrap: 'nowrap',
                  }}
                  title={subModule.label}
                  onMouseEnter={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSubActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <span
                    className="material-icons"
                    style={{
                      fontSize: 18,
                      color: isSubActive ? '#ff9800' : 'rgba(255, 255, 255, 0.8)',
                      transition: 'color 0.2s',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {subModule.icon}
                  </span>
                  <span
                    className="sidebar-link-label"
                    style={{
                      fontSize: '13px',
                      letterSpacing: '0.2px',
                      whiteSpace: 'normal',
                      wordWrap: 'break-word',
                      lineHeight: '1.4',
                      flex: 1,
                    }}
                  >
                    {subModule.label}
                  </span>
                  {isSubActive && (
                    <div style={{
                      position: 'absolute',
                      right: 10,
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: '#ff9800',
                      boxShadow: '0 0 6px rgba(255, 152, 0, 0.6)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { 
              opacity: 0;
              transform: translateY(-8px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      {/* Hamburger Menu Button - Mobile Only */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            zIndex: 10000,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: '#1e3a8a' }}>
            menu
          </span>
        </button>
      )}

      {/* Mobile Menu */}
      {isMobile && (
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          sidebarItems={getMobileSidebarItems()}
          activeSidebar={activeSidebar}
          onSidebarClick={handleSafeNavigation}
          name={name}
          email={email}
          companyName={company}
          onProfileClick={() => setProfileDropdownOpen(true)}
          onLogout={handleLogout}
          onNavigate={navigate}
        />
      )}


      {/* Google Account Configuration Modal */}
      {showGoogleConfigModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 5000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowGoogleConfigModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 28,
              maxWidth: 500,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-icons" style={{ fontSize: 28, color: '#4285f4' }}>account_circle</span>
                Google Account Configuration
              </h2>
              <button
                onClick={() => setShowGoogleConfigModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b7280',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <span className="material-icons" style={{ fontSize: 24 }}>close</span>
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{
                padding: 16,
                borderRadius: 12,
                background: isGoogleDriveFullyConfigured().configured ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${isGoogleDriveFullyConfigured().configured ? '#86efac' : '#fecaca'}`,
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="material-icons" style={{
                    fontSize: 20,
                    color: isGoogleDriveFullyConfigured().configured ? '#16a34a' : '#dc2626'
                  }}>
                    {isGoogleDriveFullyConfigured().configured ? 'check_circle' : 'error'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>
                    Configuration Status
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#64748b', marginLeft: 30 }}>
                  {isGoogleDriveFullyConfigured().configured
                    ? 'Google Drive API is configured and ready to use.'
                    : 'Google Drive API credentials need to be configured in environment variables.'}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>
                  Account Authentication
                </h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                  Connect your Google account to enable document upload and Google Drive integration features.
                </p>
                <button
                  onClick={async () => {
                    try {
                      if (!isGoogleDriveFullyConfigured().configured) {
                        alert('Google API credentials are not configured. Please configure REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY in your environment variables.');
                        return;
                      }

                      // Load Google Identity Services if not already loaded
                      if (!window.google || !window.google.accounts) {
                        const script = document.createElement('script');
                        script.src = 'https://accounts.google.com/gsi/client';
                        script.async = true;
                        script.defer = true;
                        document.body.appendChild(script);

                        await new Promise((resolve) => {
                          script.onload = resolve;
                        });
                      }

                      // Initialize token client
                      const tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
                        scope: GOOGLE_DRIVE_CONFIG.SCOPES,
                        callback: (response) => {
                          if (response.error) {
                            setGoogleConfigStatus({ type: 'error', message: response.error_description || 'Authentication failed' });
                            return;
                          }
                          if (response.access_token) {
                            setGoogleAccessToken(response.access_token);
                            setGoogleConfigStatus({ type: 'success', message: 'Google account connected successfully!' });
                            localStorage.setItem('google_access_token', response.access_token);
                          }
                        },
                      });

                      tokenClient.requestAccessToken({ prompt: 'consent' });
                    } catch (error) {
                      setGoogleConfigStatus({ type: 'error', message: error.message || 'Failed to initialize Google authentication' });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: googleAccessToken ? 'linear-gradient(135deg, #34a853 0%, #28a745 100%)' : 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px 0 rgba(66,133,244,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(66,133,244,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(66,133,244,0.25)';
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20 }}>
                    {googleAccessToken ? 'check_circle' : 'login'}
                  </span>
                  {googleAccessToken ? 'Re-authenticate Google Account' : 'Connect Google Account'}
                </button>

                {googleConfigStatus && (
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    background: googleConfigStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${googleConfigStatus.type === 'success' ? '#86efac' : '#fecaca'}`,
                    color: googleConfigStatus.type === 'success' ? '#16a34a' : '#dc2626',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span className="material-icons" style={{ fontSize: 18 }}>
                      {googleConfigStatus.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {googleConfigStatus.message}
                  </div>
                )}

                {googleAccessToken && (
                  <div style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 8,
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    fontSize: 14,
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span className="material-icons" style={{ fontSize: 18 }}>check_circle</span>
                    Google account is connected. The connection will remain active until you unlink or switch accounts.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Top Header */}
      <Header
        type="tally"
        isMobile={isMobile}
        zIndex={1000}
        logo={{
          src: TallyLogo,
          alt: 'DataLynkr Logo',
          width: '50px',
          height: 'auto'
        }}
        showCompanySelector={true}
        companySelectorProps={{
          allConnections: allConnections,
          selectedCompanyGuid: selectedCompanyGuid,
          onCompanyChange: handleTopBarCompanyChange,
          setSelectedCompanyGuid: setSelectedCompanyGuid
        }}
        showControlButtons={true}
        controlButtonProps={{
          onControlPanelClick: () => navigate('/admin-dashboard?view=dashboard'),
          onRefreshClick: handleGlobalRefresh
        }}
        profileProps={{
          profileRef: profileDropdownRef,
          name: name,
          email: email,
          profileDropdownOpen: profileDropdownOpen,
          setProfileDropdownOpen: setProfileDropdownOpen,
          navigate: navigate,
          onGoogleConfigClick: () => setShowGoogleConfigModal(true),
          isAdmin: isAdmin
        }}
        onLogout={handleLogout}
      />

      {/* Sidebar - Hidden in Mobile */}
      {!isMobile && (
        <aside
          ref={sidebarRef}
          className={`adminhome-sidebar sidebar-animated`}
          style={{
            height: 'calc(100dvh - 70px)',
            position: 'fixed',
            top: '70px',
            left: 0,
            background: '#1e3a8a',
            overflowY: 'auto',
            overflowX: 'hidden',
            width: sidebarOpen ? 260 : 70,
            minWidth: sidebarOpen ? 260 : 70,
            maxWidth: sidebarOpen ? 260 : 70,
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '4px 0 24px rgba(0, 0, 0, 0.3), 2px 0 8px rgba(0, 0, 0, 0.2)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            paddingBottom: '20px',
          }}
        >
          {/* Sidebar items */}
          <nav
            ref={sidebarContentRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 15,
              marginTop: 16,
              padding: '0 12px 12px 12px',
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
            }}>
            {sidebarLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                color: '#fff',
                fontSize: '14px'
              }}>
                <span className="material-icons" style={{
                  fontSize: '20px',
                  marginRight: '8px',
                  animation: 'spin 1s linear infinite'
                }}>
                  refresh
                </span>
                Updating permissions...
              </div>
            ) : (
              <>
                {renderSidebarItems()}
              </>
            )}
          </nav>

          {/* Tooltip */}
          {sidebarTooltip.show && !sidebarOpen && (
            <div
              className="sidebar-tooltip"
              style={{
                position: 'fixed',
                left: 70,
                top: sidebarTooltip.top + 70,
                background: '#1e3a8a',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                zIndex: 10000,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                pointerEvents: 'none',
                animation: 'fadeIn 0.2s ease-out',
                backdropFilter: 'blur(10px)',
              }}
            >
              {sidebarTooltip.text}
            </div>
          )}
        </aside>
      )}

      {/* Sidebar Toggle - Hidden in Mobile */}
      {!isMobile && (
        <button
          className="sidebar-toggle-btn-main"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            position: 'fixed',
            top: '86px',
            left: (sidebarOpen ? 260 : 70) - 18,
            zIndex: 5000,
            background: '#fff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px 0 rgba(31,38,135,0.08)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(31,38,135,0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(31,38,135,0.08)';
          }}
        >
          <span className="material-icons" style={{ fontSize: 22, color: '#1e40af' }}>{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
        </button>
      )}

      {/* Main Content */}
      <main
        className="adminhome-main"
        style={{
          marginLeft: isMobile ? 0 : (sidebarOpen ? 260 : 70),
          marginTop: isMobile ? 0 : '70px',
          paddingTop: isMobile ? 0 : 20,
          padding: isMobile ? 12 : 20,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div>
          <>
            {activeSidebar === 'ledger' && <Ledgerbook />}
            {activeSidebar === 'ledgerwise' && <Ledgerbook />}
            {activeSidebar === 'billwise' && <Ledgerbook />}
            {activeSidebar === 'order' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <PlaceOrder />
              </div>
            )}
            {activeSidebar === 'ecommerce' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <PlaceOrder_ECommerce />
              </div>
            )}
            {activeSidebar === 'sales_dashboard' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <SalesDashboard onNavigationAttempt={true} />
              </div>
            )}
            {activeSidebar === 'receivables_dashboard' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <ReceivablesDashboard company={currentReceivablesCompany} />
              </div>
            )}
            {activeSidebar === 'vendor_expenses' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <VendorExpenses />
              </div>
            )}
            {activeSidebar === 'receipt_find_party' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <ReceiptListScreenWrapper />
              </div>
            )}
            {activeSidebar === 'company_orders' && (
              <div style={{ margin: '-20px', padding: '0' }}>
                <CompanyOrdersScreenWrapper />
              </div>
            )}
            {activeSidebar === 'voucher_authorization' && <VoucherAuthorization />}
            {activeSidebar === 'sales_order_report' && <SalesOrderReport />}
            {activeSidebar === 'payment_voucher_report' && <PaymentVoucherReport />}
            {activeSidebar === 'cache_management' && <CacheManagement />}
            {activeSidebar === 'master_form' && <MasterForm key="master-form" />}
            {activeSidebar === 'master_authorization' && <MasterAuthorization />}
            {activeSidebar === 'master_list' && <MasterList />}
          </>
        </div>
      </main>


    </div>
  );
}

export default TallyDashboard; 