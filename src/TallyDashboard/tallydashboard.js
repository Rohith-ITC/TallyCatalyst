import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config';
import TallyLogo from '../Tally1.png';
import '../AdminHomeResponsive.css';
import Ledgerbook from './Ledgerbook';
import PlaceOrder from './PlaceOrder';
import PlaceOrder_ECommerce from './PlaceOrder_ECommerce';
import SalesDashboard from './salesdashboard';
import ReceivablesDashboard from '../RecvDashboard';
import VoucherAuthorization from '../vchauth/vchauth';
import TallyConfig from '../admindashboard/tallyconfig';
import AccessControl from '../access-control/AccessControl';
import ModulesManagement from '../access-control/ModulesManagement';
import RolesManagement from '../access-control/RolesManagement';
import CreateAccess from '../admindashboard/CreateAccess';
import ShareAccess from '../TallyDashboard/ShareAccess';
import VendorForm from './VendorForm';
import VendorAuthorization from './VendorAuthorization';
import VendorManagement from './VendorManagement';
import LinkAccount from './LinkAccount';
import { 
  MODULE_SEQUENCE, 
  hasModuleAccess, 
  hasAnySubModuleAccess, 
  hasSubModuleAccess, 
  getUserModules,
  getDropdownFilterOptions,
  shouldUseDropdownFilter,
  isAlwaysVisible
} from '../config/SideBarConfigurations';
import { apiGet } from '../utils/apiUtils';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

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
  const [activeSidebar, setActiveSidebar] = useState('main');
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [controlPanelView, setControlPanelView] = useState(null); // 'tally-config', 'modules', 'roles', 'create-access', 'share-access'
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [accessControlDropdownOpen, setAccessControlDropdownOpen] = useState(false);
  const [previousView, setPreviousView] = useState(null); // Track previous view before opening control panel
  const desiredActiveSidebarRef = useRef(null);
  const initialPermissionsRequestedRef = useRef(false);

  const isModuleAccessibleById = useCallback((moduleId, userModules) => {
    if (!moduleId) return false;
    const module = MODULE_SEQUENCE.find(m => m.id === moduleId);
    if (module) {
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
        return hasSubModuleAccess(subModule.key, userModules);
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

  const resolveActiveSidebar = useCallback((userModules) => {
    if (!userModules || userModules.length === 0) {
      if (activeSidebar !== 'main') {
        setActiveSidebar('main');
      }
      desiredActiveSidebarRef.current = null;
      return;
    }

    if (activeSidebar === 'main') {
      const firstModuleId = getFirstAccessibleModuleId(userModules);
      if (firstModuleId && firstModuleId !== 'main') {
        setActiveSidebar(firstModuleId);
        desiredActiveSidebarRef.current = null;
        return;
      }
    }
 
    const desiredId = desiredActiveSidebarRef.current;
    if (desiredId && isModuleAccessibleById(desiredId, userModules)) {
      if (activeSidebar !== desiredId) {
        setActiveSidebar(desiredId);
      }
      desiredActiveSidebarRef.current = null;
      return;
    }

    if (isModuleAccessibleById(activeSidebar, userModules)) {
      desiredActiveSidebarRef.current = null;
      return;
    }

    const fallbackId = getFirstAccessibleModuleId(userModules) || 'main';
    if (activeSidebar !== fallbackId) {
      setActiveSidebar(fallbackId);
    }
    desiredActiveSidebarRef.current = null;
  }, [activeSidebar, getFirstAccessibleModuleId, isModuleAccessibleById]);
  
  // Auto-open control panel when control panel view is set
  useEffect(() => {
    if (controlPanelView && !showControlPanel) {
      setShowControlPanel(true);
      setControlPanelOpen(true);
      if (!previousView) {
        setPreviousView(activeSidebar);
      }
    }
  }, [controlPanelView]);
  
  // Auto-open Access Control dropdown when an Access Control view is active
  useEffect(() => {
    if (['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) {
      setAccessControlDropdownOpen(true);
    }
  }, [controlPanelView]);
  
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
  const [topBarCompanyDropdownOpen, setTopBarCompanyDropdownOpen] = useState(false);
  const [topBarCompanySearchTerm, setTopBarCompanySearchTerm] = useState('');
  const [filteredTopBarCompanies, setFilteredTopBarCompanies] = useState([]);
  const [isSelectingCompany, setIsSelectingCompany] = useState(false);
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Filter companies based on search term for top bar
  useEffect(() => {
    if (!topBarCompanySearchTerm.trim()) {
      setFilteredTopBarCompanies([]);
      return;
    }
    
    const timeoutId = setTimeout(() => {
      const searchLower = topBarCompanySearchTerm.toLowerCase();
      const exactMatches = [];
      const startsWithMatches = [];
      const containsMatches = [];
      
      for (let i = 0; i < allConnections.length; i++) {
        const connection = allConnections[i];
        const companyName = connection.company || '';
        const accessType = connection.access_type || '';
        const companyNameLower = companyName.toLowerCase();
        const accessTypeLower = accessType.toLowerCase();
        
        const nameMatch = companyNameLower.includes(searchLower);
        const accessMatch = accessTypeLower.includes(searchLower);
        
        if (nameMatch || accessMatch) {
          if (companyNameLower === searchLower || accessTypeLower === searchLower) {
            exactMatches.push(connection);
          } else if (companyNameLower.startsWith(searchLower) || accessTypeLower.startsWith(searchLower)) {
            startsWithMatches.push(connection);
          } else {
            containsMatches.push(connection);
          }
        }
      }
      
      const filtered = [...exactMatches, ...startsWithMatches, ...containsMatches];
      setFilteredTopBarCompanies(filtered);
    }, 150);
    
    return () => clearTimeout(timeoutId);
  }, [topBarCompanySearchTerm, allConnections]);

  // Show all companies when top bar dropdown opens
  useEffect(() => {
    if (topBarCompanyDropdownOpen && !topBarCompanySearchTerm.trim()) {
      if (allConnections.length < 100) {
        setFilteredTopBarCompanies(allConnections);
      } else {
        setFilteredTopBarCompanies([]);
      }
    }
  }, [topBarCompanyDropdownOpen, topBarCompanySearchTerm, allConnections]);

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

  // Update active sidebar when user access permissions are loaded
  useEffect(() => {
    const userModules = getUserModules();
    resolveActiveSidebar(userModules);
  }, [selectedCompanyGuid, resolveActiveSidebar]);

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
      setActiveSidebar('order');
    };

    window.addEventListener('navigateToPlaceOrder', handleNavigateToPlaceOrder);
    
    return () => {
      window.removeEventListener('navigateToPlaceOrder', handleNavigateToPlaceOrder);
    };
  }, []);

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
    setTopBarCompanyDropdownOpen(false);
    setTopBarCompanySearchTerm('');
    setIsSelectingCompany(false);
    
    // Show loading state
    setSidebarLoading(true);
    
    // Fetch user access permissions for the new company
    console.log('🚀 About to call fetchUserAccessPermissions for company:', companyConnection.company);
    await fetchUserAccessPermissions(companyConnection);
    console.log('✅ fetchUserAccessPermissions completed for company:', companyConnection.company);
    
    // Trigger refresh of child components by dispatching an event
    window.dispatchEvent(new CustomEvent('companyChanged', { detail: companyConnection }));
  };

  // Global refresh function for all pages
  const handleGlobalRefresh = async () => {
    console.log('🔄 Global refresh triggered - clearing all caches...');
    console.log('🔄 Refresh button clicked!');
    
    // Get current company info
    const currentCompany = allConnections.find(c => c.guid === selectedCompanyGuid);
    console.log('🔄 Current company:', currentCompany);
    if (!currentCompany) {
      console.log('⚠️ No company selected for refresh');
      return;
    }
    
    const { tallyloc_id, company: companyVal } = currentCompany;
    console.log('🔄 Clearing caches for:', { tallyloc_id, companyVal });
    
    // Clear all relevant caches
    const cacheKeys = [
      `ledgerlist_${tallyloc_id}_${companyVal}`,
      `ledgerlist-w-addrs_${tallyloc_id}_${companyVal}`,
      `stockitems_${tallyloc_id}_${companyVal}`,
      `reportlist_${tallyloc_id}_${companyVal}`
    ];
    
    cacheKeys.forEach(key => {
      sessionStorage.removeItem(key);
      console.log(`🗑️ Cleared cache: ${key}`);
    });
    
    // Refresh user connections so latest companies are available after cache clear
    try {
      console.log('🔄 Refreshing user connections...');
      const response = await apiGet(`/api/tally/user-connections?ts=${Date.now()}`);
      if (response) {
        let connections = [];
        if (Array.isArray(response)) {
          connections = response.filter(item => item?.status === 'Connected');
        } else if (response.createdByMe && response.sharedWithMe) {
          const created = Array.isArray(response.createdByMe)
            ? response.createdByMe.filter(row => row?.status === 'Connected').map(row => ({ ...row, type: 'Created By Me' }))
            : [];
          const shared = Array.isArray(response.sharedWithMe)
            ? response.sharedWithMe.filter(row => row?.status === 'Connected').map(row => ({ ...row, type: 'Shared With Me' }))
            : [];
          connections = [...created, ...shared];
        }

        sessionStorage.setItem('allConnections', JSON.stringify(connections));
        // Notify listeners that connection data has been refreshed
        window.dispatchEvent(new CustomEvent('connectionsUpdated', { detail: connections }));
        // Update local dropdown data immediately
        if (connections.length < 100) {
          setFilteredTopBarCompanies(connections);
        } else {
          setFilteredTopBarCompanies([]);
        }
        setConnectionsVersion((prev) => prev + 1);
        console.log(`✅ Refreshed user connections: ${connections.length} entries`);
      }
    } catch (error) {
      console.error('⚠️ Failed to refresh user connections during global refresh:', error);
    }
    
    // Dispatch custom event to notify all components to refresh
    console.log('🔄 Dispatching globalRefresh event...');
    window.dispatchEvent(new CustomEvent('globalRefresh'));
    
    console.log('✅ Global refresh completed - all components will reload data');
  };

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
  };

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
      
      // Debug: Check vendor_form specifically
      if (module.key === 'vendor_form') {
        console.log('🔍 Vendor Form module check:', {
          key: module.key,
          alwaysVisible: isAlwaysVisible(module.key),
          module: module
        });
      }
      
      // Always show modules marked as alwaysVisible (except main_menu)
      if (isAlwaysVisible(module.key)) {
        console.log('✅ Rendering always visible module:', module.key, module.label);
        return renderSidebarItem(module.key, module);
      }
      
      // For modules with sub-modules (like Ledger Book)
      if (module.hasSubModules) {
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
      
      // For regular modules (Place Order, E-Commerce)
      const hasAccess = hasModuleAccess(module.key, userModules);
      if (hasAccess) {
        return renderSidebarItem(module.key, module);
      }
      
      return null;
    }).filter(Boolean);
  };

  // Handler for closing control panel
  const handleCloseControlPanel = async () => {
    setShowControlPanel(false);
    setControlPanelOpen(false);
    if (previousView) {
      setActiveSidebar(previousView);
    }
    setPreviousView(null);
    setControlPanelView(null);
    
    // Fetch updated modules and permissions after closing control panel
    const tallylocId = sessionStorage.getItem('tallyloc_id');
    const guid = sessionStorage.getItem('guid');
    
    if (tallylocId && guid) {
      try {
        console.log('🔄 Fetching updated user access after closing control panel...');
        const companyConnection = {
          tallyloc_id: tallylocId,
          guid: guid,
          company: sessionStorage.getItem('company') || ''
        };
        await fetchUserAccessPermissions(companyConnection);
        console.log('✅ Updated user access permissions loaded');
      } catch (error) {
        console.error('❌ Error fetching updated user access:', error);
      }
    }
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
            setActiveSidebar(module.id); 
            // Close control panel when sidebar item is clicked
            if (showControlPanel) {
              handleCloseControlPanel();
            }
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
            setActiveSidebar(module.id); 
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
                    setActiveSidebar(subModule.id); 
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
      {/* Top Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 64,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 4001,
        boxShadow: '0 4px 20px 0 rgba(30, 58, 138, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
        padding: '0 16px',
        justifyContent: 'space-between',
        backdropFilter: 'blur(10px)',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <img src={TallyLogo} alt="Tally Logo" style={{ height: 40, width: 'auto', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
          <span style={{ 
            color: '#fff', 
            fontWeight: 700, 
            fontSize: 24, 
            letterSpacing: 0.5, 
            textShadow: '0 2px 8px rgba(0,0,0,0.15)',
            background: 'linear-gradient(180deg, #ffffff 0%, #e0e7ff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            whiteSpace: 'nowrap',
          }}>TallyCatalyst</span>
        </div>
        
        {/* Company Selection Dropdown */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          position: 'relative', 
          flex: '1 1 auto', 
          minWidth: 0, 
          marginLeft: '20px', 
          marginRight: '20px',
          maxWidth: '800px',
        }}>
          {/* Company Title */}
          <span style={{ 
            color: 'rgba(255, 255, 255, 0.95)', 
            fontSize: '13px', 
            fontWeight: '600', 
            marginRight: '12px',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            flexShrink: 0,
          }}>
            Company:
          </span>
          <div style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.18)',
            borderRadius: '10px',
            border: topBarCompanyDropdownOpen ? '2px solid rgba(255, 255, 255, 0.6)' : '2px solid rgba(255, 255, 255, 0.25)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: '400px',
            maxWidth: '100%',
            width: '100%',
            flex: '1 1 auto',
            boxShadow: topBarCompanyDropdownOpen ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <input
              value={selectedCompanyGuid ? (() => {
                const currentCompany = allConnections.find(c => c.guid === selectedCompanyGuid);
                return currentCompany ? `${currentCompany.company} [${currentCompany.access_type}]` : '';
              })() : topBarCompanySearchTerm}
              onChange={e => {
                const inputValue = e.target.value;
                setTopBarCompanySearchTerm(inputValue);
                setSelectedCompanyGuid('');
                setTopBarCompanyDropdownOpen(true);
                if (!inputValue.trim()) {
                  if (allConnections.length < 100) {
                    setFilteredTopBarCompanies(allConnections);
                  } else {
                    setFilteredTopBarCompanies([]);
                  }
                }
              }}
              onFocus={() => {
                console.log('🖱️ Company input focused - opening dropdown');
                setTopBarCompanyDropdownOpen(true);
                if (allConnections.length < 100) {
                  setFilteredTopBarCompanies(allConnections);
                }
              }}
              onBlur={() => {
                if (!isSelectingCompany) {
                  setTimeout(() => setTopBarCompanyDropdownOpen(false), 300);
                }
              }}
              style={{
                width: '100%',
                padding: '10px 18px',
                paddingRight: selectedCompanyGuid ? '40px' : '18px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#fff',
                outline: 'none',
                background: 'transparent',
                cursor: 'text',
                fontWeight: '500',
              }}
              placeholder="Select Company..."
            />
            
            {/* Dropdown Icon */}
            {!selectedCompanyGuid && (
              <span 
                className="material-icons" 
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '18px',
                  pointerEvents: 'none'
                }}
              >
                {topBarCompanyDropdownOpen ? 'expand_less' : 'expand_more'}
              </span>
            )}
            
            {/* Clear Button */}
            {selectedCompanyGuid && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCompanyGuid('');
                  setTopBarCompanySearchTerm('');
                  setTopBarCompanyDropdownOpen(false);
                  if (allConnections.length < 100) {
                    setFilteredTopBarCompanies(allConnections);
                  }
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '16px'
                }}
                title="Clear company"
              >
                ×
              </button>
            )}

            {/* Company Dropdown */}
            {topBarCompanyDropdownOpen && (
              <>
                {console.log('📋 Company dropdown opened, filtered companies:', filteredTopBarCompanies)}
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                zIndex: 9999,
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
              }}>
                {filteredTopBarCompanies.map((companyOption, index) => (
                  <div
                    key={companyOption.guid}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSelectingCompany(true);
                      console.log('🎯 Company option clicked:', companyOption);
                      handleTopBarCompanyChange(companyOption);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: index < filteredTopBarCompanies.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{
                      fontWeight: '600',
                      color: '#1e293b',
                      fontSize: '14px'
                    }}>
                      {companyOption.company}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginTop: '2px'
                    }}>
                      Access Type: {companyOption.access_type || 'N/A'}
                    </div>
                  </div>
                ))}
                
                {filteredTopBarCompanies.length > 0 && (
                  <div style={{
                    padding: '8px 16px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '12px',
                    fontStyle: 'italic',
                    borderTop: '1px solid #f1f5f9',
                    backgroundColor: '#f8fafc'
                  }}>
                    {filteredTopBarCompanies.length} company{filteredTopBarCompanies.length !== 1 ? 's' : ''} available
                  </div>
                )}
              </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side Actions Container */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          flexShrink: 0,
          paddingLeft: '16px',
          paddingRight: '20px',
        }}>
          {/* Icon Buttons Group */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            paddingRight: '16px',
            borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          }}>
            {/* Control Panel Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!showControlPanel) {
                  // Store current view before opening control panel
                  setPreviousView(activeSidebar);
                  setShowControlPanel(true);
                  setControlPanelOpen(true);
                  setControlPanelView('tally-config'); // Default to Tally Connections
                } else {
                  // Close control panel and return to previous view
                  handleCloseControlPanel();
                }
              }}
              style={{
                background: showControlPanel ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)',
                border: showControlPanel ? '2px solid rgba(255, 255, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: '#fff',
                zIndex: 10,
                position: 'relative',
                boxShadow: showControlPanel ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.1)',
                minWidth: '44px',
                height: '44px',
              }}
              title="Control Panel"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showControlPanel ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = showControlPanel ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = showControlPanel ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.1)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '22px', pointerEvents: 'none' }}>
                admin_panel_settings
              </span>
            </button>

            {/* Global Refresh Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Refresh button clicked!');
                handleGlobalRefresh();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ Refresh button mousedown!');
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                color: '#fff',
                zIndex: 10,
                position: 'relative',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                minWidth: '44px',
                height: '44px',
              }}
              title="Refresh all data (ledgers & stock items)"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-1px) rotate(180deg)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                console.log('🖱️ Refresh button hover!');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(0) rotate(0deg)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
              }}
            >
              <span className="material-icons" style={{ fontSize: '22px', pointerEvents: 'none' }}>
                refresh
              </span>
            </button>
          </div>
          
          {/* User Profile Section */}
          <div ref={profileDropdownRef} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            position: 'relative',
          }}>
            {/* Profile Dropdown */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: '10px',
                background: profileDropdownOpen ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                transition: 'all 0.3s ease',
                border: profileDropdownOpen ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent',
              }}
              onClick={() => setProfileDropdownOpen((open) => !open)}
              onMouseEnter={(e) => {
                if (!profileDropdownOpen) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!profileDropdownOpen) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <span 
                className="material-icons profile-icon" 
                style={{ 
                  color: '#fff', 
                  fontSize: '26px', 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' 
                }}
              >
                account_circle
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span 
                  className="profile-name" 
                  style={{ 
                    color: '#fff', 
                    fontWeight: 600, 
                    fontSize: '14px', 
                    textShadow: '0 1px 2px rgba(0,0,0,0.1)', 
                    whiteSpace: 'nowrap',
                    lineHeight: '1.2',
                  }}
                >
                  {name || 'User'}
                </span>
                <span 
                  style={{ 
                    color: 'rgba(255, 255, 255, 0.8)', 
                    fontSize: '12px', 
                    fontWeight: 400,
                    lineHeight: '1.2',
                  }}
                >
                  {email || ''}
                </span>
              </div>
              <span 
                className="material-icons" 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  fontSize: '20px', 
                  transition: 'transform 0.3s ease', 
                  transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  marginLeft: '4px',
                }}
              >
                expand_more
              </span>
            </div>
            
            {/* Logout Button */}
            <button 
              className="logout-btn" 
              title="Logout" 
              style={{ 
                background: 'rgba(220, 38, 38, 0.15)', 
                color: '#fff', 
                border: '1px solid rgba(220, 38, 38, 0.3)', 
                minWidth: '100px',
                height: '44px',
                padding: '10px 20px 10px 16px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.2)',
                whiteSpace: 'nowrap',
                marginRight: '0',
              }} 
              onClick={handleLogout}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.25)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.4)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.2)';
              }}
            >
              <span className="material-icons" style={{ fontSize: 18 }}>logout</span>
              <span>Logout</span>
            </button>
          {profileDropdownOpen && (
            <div className="profile-dropdown" style={{ 
              position: 'absolute', 
              top: 56, 
              right: 0, 
              minWidth: 260, 
              background: '#fff', 
              borderRadius: 16, 
              boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.2), 0 0 0 1px rgba(0,0,0,0.05)', 
              padding: 20, 
              zIndex: 4000, 
              textAlign: 'left',
              animation: 'fadeIn 0.2s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
                <span className="material-icons" style={{ fontSize: 32, color: '#3b82f6' }}>account_circle</span>
                <div>
                  <div className="profile-dropdown-name" style={{ fontSize: 16, color: '#1e293b', fontWeight: 700, marginBottom: 2 }}>{name || 'User'}</div>
                  <div className="profile-dropdown-email" style={{ fontSize: 13, color: '#64748b' }}>{email || ''}</div>
                </div>
              </div>
              <button 
                className="change-password-btn" 
                style={{ 
                  width: '100%',
                  padding: '12px 18px', 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 10, 
                  fontWeight: 600, 
                  fontSize: 14, 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 12px 0 rgba(59,130,246,0.25)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.3s ease',
                  marginBottom: isAdmin() ? 10 : 0,
                }} 
                onClick={() => navigate('/change-password')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(59,130,246,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.25)';
                }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>lock</span>
                Change Password
              </button>
              {isAdmin() && (
                <button 
                  className="google-config-btn" 
                  style={{ 
                    width: '100%',
                    padding: '12px 18px', 
                    background: 'linear-gradient(135deg, #4285f4 0%, #34a853 100%)', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: 10, 
                    fontWeight: 600, 
                    fontSize: 14, 
                    cursor: 'pointer', 
                    boxShadow: '0 4px 12px 0 rgba(66,133,244,0.25)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.3s ease',
                  }} 
                  onClick={() => {
                    setShowGoogleConfigModal(true);
                    setProfileDropdownOpen(false);
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
                  <span className="material-icons" style={{ fontSize: 18 }}>account_circle</span>
                  Configure Google Account
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

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
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    fontSize: 14,
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span className="material-icons" style={{ fontSize: 18 }}>info</span>
                    Google account is connected. Token expires after 1 hour of inactivity.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`adminhome-sidebar sidebar-animated`}
        style={{
          height: 'calc(100vh - 64px)',
          position: 'fixed',
          top: 64,
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
        }}
      >
        <div className="sidebar-logo" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%', 
          margin: '20px 0 32px 0',
          padding: sidebarOpen ? '0 20px' : '0',
        }}>
          <img 
            src={TallyLogo} 
            alt="Tally Logo" 
            style={{ 
              width: sidebarOpen ? 180 : 40, 
              height: sidebarOpen ? 72 : 40, 
              objectFit: 'contain', 
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 2px 8px rgba(255, 255, 255, 0.1))',
            }} 
          />
        </div>
        {/* Sidebar items */}
        <nav style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 8, 
          fontSize: 15, 
          marginTop: 8,
          padding: '0 12px',
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
              {!showControlPanel && renderSidebarItems()}
              
              {/* Control Panel Section - Show when control panel is open */}
              {showControlPanel && (
                <div style={{ position: 'relative' }}>
                  {/* Close Button */}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleCloseControlPanel();
                    }}
                    style={{
                      color: '#fff',
                      background: 'rgba(220, 38, 38, 0.15)',
                      textDecoration: 'none',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      borderRadius: '12px',
                      fontWeight: 500,
                      margin: '0 0 12px 0',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      cursor: 'pointer',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      position: 'relative',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      fontSize: '14px',
                      flexWrap: 'nowrap',
                    }}
                    title="Close Control Panel"
                    onMouseEnter={e => {
                      e.target.style.background = 'rgba(220, 38, 38, 0.2)';
                      e.target.style.borderColor = 'rgba(220, 38, 38, 0.4)';
                      if (!sidebarOpen) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setSidebarTooltip({ show: true, text: 'Close Control Panel', top: rect.top + window.scrollY });
                        if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
                        sidebarTooltipTimeout = setTimeout(() => {
                          setSidebarTooltip({ show: false, text: '', top: 0 });
                        }, 1500);
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(220, 38, 38, 0.1)';
                      e.target.style.borderColor = 'rgba(220, 38, 38, 0.2)';
                      if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
                      setSidebarTooltip({ show: false, text: '', top: 0 });
                    }}
                  >
                    <span 
                      className="material-icons" 
                      style={{ 
                        fontSize: 22,
                        color: 'rgba(255, 255, 255, 0.9)',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      close
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
                        Close
                      </span>
                    )}
                  </a>
                  
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (sidebarOpen) {
                        setControlPanelOpen(!controlPanelOpen);
                      }
                    }}
                    style={{
                      color: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? '#ff9800' : '#fff',
                      background: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) 
                        ? 'rgba(255, 152, 0, 0.08)' 
                        : 'transparent',
                      textDecoration: 'none',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 14,
                      borderRadius: '12px',
                      fontWeight: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 700 : 500,
                      margin: '0 0 8px 0',
                      border: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) 
                        ? '1px solid rgba(255, 255, 255, 0.2)' 
                        : '1px solid transparent',
                      cursor: 'pointer',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      position: 'relative',
                      fontSize: '14px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView))
                        ? '0 4px 12px rgba(255, 152, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                        : 'none',
                      flexWrap: 'nowrap',
                    }}
                    title="Control Panel"
                    onMouseEnter={e => {
                      if (!sidebarOpen) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setSidebarTooltip({ show: true, text: 'Control Panel', top: rect.top + window.scrollY });
                        if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
                        sidebarTooltipTimeout = setTimeout(() => {
                          setSidebarTooltip({ show: false, text: '', top: 0 });
                        }, 1500);
                      }
                    }}
                    onMouseLeave={() => {
                      if (sidebarTooltipTimeout) clearTimeout(sidebarTooltipTimeout);
                      setSidebarTooltip({ show: false, text: '', top: 0 });
                    }}
                  >
                    <span 
                      className="material-icons" 
                      style={{ 
                        fontSize: 22,
                        color: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) 
                          ? '#ff9800' 
                          : 'rgba(255, 255, 255, 0.9)',
                        transition: 'color 0.2s',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      admin_panel_settings
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
                        Control Panel
                      </span>
                    )}
                    {sidebarOpen && (
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: 16, 
                          marginLeft: 'auto', 
                          transform: controlPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          color: 'rgba(255, 255, 255, 0.7)',
                        }}
                      >
                        expand_more
                      </span>
                    )}
                  </a>
                  
                  {/* Control Panel Sub-menu */}
                  {sidebarOpen && controlPanelOpen && (
                    <div style={{
                      marginLeft: '12px',
                      marginTop: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      padding: '6px 0',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}>
                      {/* Tally Connections */}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setControlPanelView('tally-config');
                          // Keep sidebar open - don't close it on item selection
                          // Only close on mobile devices (width <= 900)
                          if (window.innerWidth <= 900) {
                            setSidebarOpen(false);
                          }
                        }}
                        style={{
                          color: controlPanelView === 'tally-config' ? '#ff9800' : '#fff',
                          background: controlPanelView === 'tally-config' 
                            ? 'rgba(255, 152, 0, 0.08)' 
                            : 'transparent',
                          textDecoration: 'none',
                          padding: '10px 14px 10px 36px',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          borderRadius: '10px',
                          fontWeight: controlPanelView === 'tally-config' ? 700 : 500,
                          margin: '0',
                          fontSize: '13px',
                          cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          border: controlPanelView === 'tally-config' 
                            ? '1px solid rgba(255, 255, 255, 0.2)' 
                            : '1px solid transparent',
                          flexWrap: 'nowrap',
                        }}
                        onMouseEnter={(e) => {
                          if (controlPanelView !== 'tally-config') {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.transform = 'translateX(4px)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (controlPanelView !== 'tally-config') {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.transform = 'translateX(0)';
                          } else {
                            e.currentTarget.style.background = 'rgba(255, 152, 0, 0.08)';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }
                        }}
                      >
                        <span 
                          className="material-icons" 
                          style={{ 
                            fontSize: 18,
                            color: controlPanelView === 'tally-config' ? '#ff9800' : 'rgba(255, 255, 255, 0.8)',
                            transition: 'color 0.2s',
                            flexShrink: 0,
                            marginTop: '2px',
                          }}
                        >
                          settings
                        </span>
                        <span style={{ 
                          fontSize: '13px', 
                          letterSpacing: '0.2px',
                          whiteSpace: 'normal',
                          wordWrap: 'break-word',
                          lineHeight: '1.4',
                          flex: 1,
                        }}>Tally Connections</span>
                      </a>
                      
                      {/* Access Control */}
                      <div style={{ position: 'relative' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setAccessControlDropdownOpen(!accessControlDropdownOpen);
                          }}
                          style={{
                            color: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? '#ff9800' : '#fff',
                            background: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) 
                              ? 'rgba(255, 152, 0, 0.08)' 
                              : 'transparent',
                            textDecoration: 'none',
                            padding: '10px 14px 10px 36px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            borderRadius: '10px',
                            fontWeight: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 700 : 500,
                            margin: '0',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView))
                              ? '1px solid rgba(255, 255, 255, 0.2)' 
                              : '1px solid transparent',
                            flexWrap: 'nowrap',
                          }}
                          onMouseEnter={(e) => {
                            if (!['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#fff';
                              e.currentTarget.style.transform = 'translateX(0)';
                            } else {
                              e.currentTarget.style.background = 'rgba(255, 152, 0, 0.08)';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          <span 
                            className="material-icons" 
                            style={{ 
                              fontSize: 18,
                              color: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) 
                                ? '#ff9800' 
                                : 'rgba(255, 255, 255, 0.8)',
                              transition: 'color 0.2s',
                              flexShrink: 0,
                              marginTop: '2px',
                            }}
                          >
                            security
                          </span>
                          <span style={{ 
                            fontSize: '13px', 
                            letterSpacing: '0.2px',
                            whiteSpace: 'normal',
                            wordWrap: 'break-word',
                            lineHeight: '1.4',
                            flex: 1,
                          }}>Access Control</span>
                          <span 
                            className="material-icons" 
                            style={{ 
                              fontSize: 16, 
                              marginLeft: 'auto', 
                              transform: accessControlDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                              transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              color: 'rgba(255, 255, 255, 0.7)',
                            }}
                          >
                            expand_more
                          </span>
                        </a>
                        
                        {/* Access Control Sub-menu */}
                        {accessControlDropdownOpen && (
                          <div style={{
                            marginLeft: '12px',
                            marginTop: '4px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            padding: '4px 0',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}>
                            {ACCESS_CONTROL_ITEMS.map(item => (
                              <a
                                key={item.key}
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setControlPanelView(item.key);
                                  // Keep Access Control dropdown open when an item is selected
                                  // Don't close it - let it stay open so user can see all options
                                  // Only close on mobile devices (width <= 900)
                                  if (window.innerWidth <= 900) {
                                    setAccessControlDropdownOpen(false);
                                    setSidebarOpen(false);
                                  }
                                  // On desktop, keep dropdown open
                                }}
                                style={{
                                  color: controlPanelView === item.key ? '#ff9800' : '#fff',
                                  background: controlPanelView === item.key 
                                    ? 'rgba(255, 152, 0, 0.08)' 
                                    : 'transparent',
                                  textDecoration: 'none',
                                  padding: '8px 12px 8px 48px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 12,
                                  borderRadius: '8px',
                                  fontWeight: controlPanelView === item.key ? 700 : 500,
                                  margin: '0',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  border: controlPanelView === item.key 
                                    ? '1px solid rgba(255, 255, 255, 0.2)' 
                                    : '1px solid transparent',
                                  flexWrap: 'nowrap',
                                }}
                                onMouseEnter={(e) => {
                                  if (controlPanelView !== item.key) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (controlPanelView !== item.key) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                  } else {
                                    e.currentTarget.style.background = 'rgba(255, 152, 0, 0.08)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                  }
                                }}
                              >
                                <span 
                                  className="material-icons" 
                                  style={{ 
                                    fontSize: 16,
                                    color: controlPanelView === item.key ? '#ff9800' : 'rgba(255, 255, 255, 0.75)',
                                    transition: 'color 0.2s',
                                    flexShrink: 0,
                                    marginTop: '2px',
                                  }}
                                >
                                  {item.icon}
                                </span>
                                <span style={{ 
                                  fontSize: '12px', 
                                  letterSpacing: '0.2px',
                                  whiteSpace: 'normal',
                                  wordWrap: 'break-word',
                                  lineHeight: '1.4',
                                  flex: 1,
                                }}>{item.label}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              top: sidebarTooltip.top,
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

      {/* Sidebar Toggle */}
      <button
        className="sidebar-toggle-btn-main"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          position: 'fixed',
          top: 72,
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

      {/* Main Content */}
      <main
        className="adminhome-main"
        style={{
          marginLeft: sidebarOpen ? 260 : 70,
          paddingTop: 64,
          padding: 20,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ marginTop: 50 }}>
          {showControlPanel ? (
            controlPanelView === 'tally-config' ? (
              <TallyConfig />
            ) : controlPanelView === 'modules' ? (
              <ModulesManagement />
            ) : controlPanelView === 'roles' ? (
              <RolesManagement />
            ) : controlPanelView === 'create-access' ? (
              <CreateAccess />
            ) : controlPanelView === 'share-access' ? (
              <ShareAccess />
            ) : null
          ) : (
            <>
          {activeSidebar === 'ledger' && <Ledgerbook />}
          {activeSidebar === 'ledgerwise' && <Ledgerbook />}
          {activeSidebar === 'billwise' && <Ledgerbook />}
          {activeSidebar === 'order' && <PlaceOrder />}
          {activeSidebar === 'ecommerce' && <PlaceOrder_ECommerce />}
          {activeSidebar === 'sales_dashboard' && (
            <div style={{ margin: '-20px', padding: '0' }}>
              <SalesDashboard />
            </div>
          )}
          {activeSidebar === 'receivables_dashboard' && (
            <div style={{ margin: '-20px', padding: '0' }}>
              <ReceivablesDashboard company={currentReceivablesCompany} />
            </div>
          )}
          {activeSidebar === 'voucher_authorization' && <VoucherAuthorization />}
          {activeSidebar === 'vendor_form' && <VendorForm key="vendor-form" />}
          {activeSidebar === 'vendor_authorization' && <VendorAuthorization />}
          {activeSidebar === 'vendor_management' && <VendorManagement />}
          {activeSidebar === 'link_account' && <LinkAccount />}
            </>
          )}
        </div>
      </main>


    </div>
  );
}

export default TallyDashboard; 