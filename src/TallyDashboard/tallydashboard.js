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
      
      // Always show modules marked as alwaysVisible (except main_menu)
      if (isAlwaysVisible(module.key)) {
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
          color: activeSidebar === module.id ? '#ff9800' : '#fff',
          background: activeSidebar === module.id ? 'rgba(255,152,0,0.08)' : 'transparent',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderRadius: '8px',
          fontWeight: activeSidebar === module.id ? 700 : 500,
          margin: '0 8px',
          border: activeSidebar === module.id ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
          cursor: 'pointer',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          position: 'relative',
          width: '100%',
          textAlign: 'left'
        }}
        title={module.label}
        onMouseEnter={e => {
          if (!sidebarOpen) {
            const rect = e.currentTarget.getBoundingClientRect();
            setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
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
        <span className="material-icons" style={{ fontSize: 22 }}>{module.icon}</span>
        {sidebarOpen && <span className="sidebar-link-label">{module.label}</span>}
      </button>
    );
  };

  // Render sidebar item with sub-modules and their permissions
  const renderSidebarItemWithSubModules = (module, userModules) => {
    const accessibleSubModules = module.subModules.filter(subModule => 
      hasSubModuleAccess(subModule.key, userModules)
    );
    
    return (
      <div key={module.key}>
        <button
          onClick={() => { 
            setActiveSidebar(module.id); 
          }}
          style={{
            color: activeSidebar === module.id ? '#ff9800' : '#fff',
            background: activeSidebar === module.id ? 'rgba(255,152,0,0.08)' : 'transparent',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderRadius: '8px',
            fontWeight: activeSidebar === module.id ? 700 : 500,
            margin: '0 8px',
            border: activeSidebar === module.id ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
            cursor: 'pointer',
            justifyContent: sidebarOpen ? 'flex-start' : 'center',
            position: 'relative',
            width: '100%',
            textAlign: 'left'
          }}
          title={module.label}
          onMouseEnter={e => {
            if (!sidebarOpen) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSidebarTooltip({ show: true, text: module.label, top: rect.top + window.scrollY });
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
          <span className="material-icons" style={{ fontSize: 22 }}>{module.icon}</span>
          {sidebarOpen && <span className="sidebar-link-label">{module.label}</span>}
        </button>
        
        {/* Sub-modules */}
        {accessibleSubModules.map(subModule => (
          <button
            key={subModule.key}
            onClick={() => { 
              setActiveSidebar(subModule.id); 
            }}
            style={{
              color: activeSidebar === subModule.id ? '#ff9800' : '#fff',
              background: activeSidebar === subModule.id ? 'rgba(255,152,0,0.08)' : 'transparent',
              padding: '8px 18px 8px 32px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: '8px',
              fontWeight: activeSidebar === subModule.id ? 700 : 500,
              margin: '0 8px 0 16px',
              border: activeSidebar === subModule.id ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              position: 'relative',
              fontSize: '14px',
              width: '100%',
              textAlign: 'left'
            }}
            title={subModule.label}
            onMouseEnter={e => {
              if (!sidebarOpen) {
                const rect = e.currentTarget.getBoundingClientRect();
                setSidebarTooltip({ show: true, text: subModule.label, top: rect.top + window.scrollY });
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
            <span className="material-icons" style={{ fontSize: 18 }}>{subModule.icon}</span>
            {sidebarOpen && <span className="sidebar-link-label">{subModule.label}</span>}
          </button>
        ))}
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
        `}
      </style>
      {/* Top Bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: 56,
        background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 100%)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 4001,
        boxShadow: '0 2px 8px 0 rgba(31,38,135,0.10)',
        padding: '0 24px',
        justifyContent: 'flex-end',
      }}>
        <img src={TallyLogo} alt="Tally Logo" style={{ height: 36, marginLeft: 0, marginRight: 18 }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: 1, marginRight: 32 }}>TallyCatalyst</span>
        
        {/* Company Selection Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginRight: 'auto', marginLeft: 20 }}>
          {/* Company Title */}
          <span style={{ 
            color: '#fff', 
            fontSize: '14px', 
            fontWeight: '500', 
            marginRight: '12px',
            whiteSpace: 'nowrap'
          }}>
            Company :
          </span>
          <div style={{
            position: 'relative',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            border: topBarCompanyDropdownOpen ? '2px solid rgba(255, 255, 255, 0.5)' : '2px solid rgba(255, 255, 255, 0.2)',
            transition: 'all 0.2s ease',
            minWidth: '450px',
            maxWidth: '600px'
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
                padding: '8px 16px',
                paddingRight: selectedCompanyGuid ? '40px' : '16px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#fff',
                outline: 'none',
                background: 'transparent',
                cursor: 'text',
                placeholder: 'rgba(255, 255, 255, 0.7)'
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

        {/* Control Panel Icon */}
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
            background: showControlPanel ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            border: showControlPanel ? '2px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            color: '#fff',
            marginLeft: '12px',
            marginRight: '12px',
            zIndex: 10,
            position: 'relative'
          }}
          title="Control Panel"
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = showControlPanel ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            e.target.style.borderColor = showControlPanel ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
          }}
        >
          <span className="material-icons" style={{ fontSize: '20px', pointerEvents: 'none' }}>
            admin_panel_settings
          </span>
        </button>

        {/* Global Refresh Icon - Separate from Company */}
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
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            color: '#fff',
            marginLeft: '12px',
            marginRight: '12px',
            zIndex: 10,
            position: 'relative'
          }}
          title="Refresh all data (ledgers & stock items)"
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            console.log('🖱️ Refresh button hover!');
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          <span className="material-icons" style={{ fontSize: '20px', pointerEvents: 'none' }}>
            refresh
          </span>
        </button>
        
        <div ref={profileDropdownRef} style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          <span className="material-icons profile-icon" style={{ cursor: 'pointer', color: '#fff' }} onClick={() => setProfileDropdownOpen((open) => !open)}>account_circle</span>
          <span className="profile-name" style={{ cursor: 'pointer', color: '#fff' }} onClick={() => setProfileDropdownOpen((open) => !open)}>{name || 'User'}</span>
          <button className="logout-btn" title="Logout" style={{ background: 'rgba(220, 38, 38, 0.1)', color: '#fff', border: '1px solid rgba(220, 38, 38, 0.2)', marginRight: 32, minWidth: 100 }} onClick={handleLogout}>
            <span className="material-icons" style={{ fontSize: 16 }}>logout</span>
            Logout
          </button>
          {profileDropdownOpen && (
            <div className="profile-dropdown" style={{ position: 'absolute', top: 48, right: 0, minWidth: 220, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', padding: 16, zIndex: 4000, textAlign: 'left' }}>
              <div className="profile-dropdown-name" style={{ marginBottom: 6, fontSize: 15, color: '#334155', fontWeight: 600 }}>{name || 'User'}</div>
              <div className="profile-dropdown-email" style={{ marginBottom: 12, fontSize: 14, color: '#64748b' }}>{email || ''}</div>
              <button className="change-password-btn" style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px 0 rgba(59,130,246,0.10)', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => navigate('/change-password')}>
                <span className="material-icons" style={{ fontSize: 16 }}>lock</span>
                Change Password
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`adminhome-sidebar sidebar-animated`}
        style={{
          height: 'calc(100vh - 56px)',
          position: 'fixed',
          top: 56,
          left: 0,
          background: '#1e3a8a',
          overflowY: 'auto',
          width: sidebarOpen ? 220 : 60,
          minWidth: sidebarOpen ? 220 : 60,
          maxWidth: sidebarOpen ? 220 : 60,
          transition: 'width 0.3s, min-width 0.3s, max-width 0.3s',
        }}
      >
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', margin: '24px 0' }}>
          <img src={TallyLogo} alt="Tally Logo" style={{ width: sidebarOpen ? 220 : 48, height: sidebarOpen ? 90 : 48, objectFit: 'contain', transition: 'width 0.3s, height 0.3s' }} />
        </div>
        {/* Sidebar items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 17, marginTop: 32 }}>
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
                      background: 'rgba(220, 38, 38, 0.1)',
                      textDecoration: 'none',
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: '8px',
                      fontWeight: 500,
                      margin: '0 8px 18px 8px',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      cursor: 'pointer',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      position: 'relative',
                      transition: 'all 0.2s',
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
                    <span className="material-icons" style={{ fontSize: 22 }}>close</span>
                    {sidebarOpen && <span className="sidebar-link-label">Close</span>}
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
                      background: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 'rgba(255,152,0,0.08)' : 'transparent',
                      textDecoration: 'none',
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: '8px',
                      fontWeight: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 700 : 500,
                      margin: '0 8px',
                      border: (controlPanelOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                      cursor: 'pointer',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      position: 'relative',
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
                    <span className="material-icons" style={{ fontSize: 22 }}>admin_panel_settings</span>
                    {sidebarOpen && <span className="sidebar-link-label">Control Panel</span>}
                    {sidebarOpen && <span className="material-icons" style={{ fontSize: 16, marginLeft: 'auto', transform: controlPanelOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>expand_more</span>}
                  </a>
                  
                  {/* Control Panel Sub-menu */}
                  {sidebarOpen && controlPanelOpen && (
                    <div style={{
                      marginLeft: '16px',
                      marginTop: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '8px 0',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
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
                          background: controlPanelView === 'tally-config' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                          textDecoration: 'none',
                          padding: '8px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          borderRadius: '6px',
                          fontWeight: controlPanelView === 'tally-config' ? 600 : 400,
                          margin: '0 8px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (controlPanelView !== 'tally-config') {
                            e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (controlPanelView !== 'tally-config') {
                            e.target.style.background = 'transparent';
                          } else {
                            e.target.style.background = 'rgba(255, 152, 0, 0.15)';
                          }
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: 18 }}>settings</span>
                        <span>Tally Connections</span>
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
                            background: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                            textDecoration: 'none',
                            padding: '8px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            borderRadius: '6px',
                            fontWeight: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) ? 600 : 400,
                            margin: '0 8px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) {
                              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!['modules', 'roles', 'create-access', 'share-access'].includes(controlPanelView)) {
                              e.target.style.background = 'transparent';
                            } else {
                              e.target.style.background = 'rgba(255, 152, 0, 0.15)';
                            }
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: 18 }}>security</span>
                          <span>Access Control</span>
                          <span className="material-icons" style={{ fontSize: 16, marginLeft: 'auto', transform: accessControlDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>expand_more</span>
                        </a>
                        
                        {/* Access Control Sub-menu */}
                        {accessControlDropdownOpen && (
                          <div style={{
                            marginLeft: '16px',
                            marginTop: '8px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            padding: '4px 0',
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
                                  background: controlPanelView === item.key ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                                  textDecoration: 'none',
                                  padding: '6px 12px 6px 32px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 12,
                                  borderRadius: '4px',
                                  fontWeight: controlPanelView === item.key ? 600 : 400,
                                  margin: '0 8px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  if (controlPanelView !== item.key) {
                                    e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (controlPanelView !== item.key) {
                                    e.target.style.background = 'transparent';
                                  } else {
                                    e.target.style.background = 'rgba(255, 152, 0, 0.15)';
                                  }
                                }}
                              >
                                <span className="material-icons" style={{ fontSize: 16 }}>{item.icon}</span>
                                <span>{item.label}</span>
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
          <div className="sidebar-tooltip" style={{ top: sidebarTooltip.top }}>
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
          left: (sidebarOpen ? 220 : 60) - 18,
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
          transition: 'left 0.3s',
        }}
      >
        <span className="material-icons" style={{ fontSize: 22, color: '#1e40af' }}>{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
      </button>

      {/* Main Content */}
      <main
        className="adminhome-main"
        style={{
          marginLeft: sidebarOpen ? 220 : 60,
          paddingTop: 56,
          padding: 20,
          transition: 'margin 0.3s',
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
            </>
          )}
        </div>
      </main>


    </div>
  );
}

export default TallyDashboard; 