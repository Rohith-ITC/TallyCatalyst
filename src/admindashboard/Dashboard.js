import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TallyLogo from '../DLlogo.png';
import '../AdminHomeResponsive.css';
import { Header } from '../config/SideBarConfigurations';
import { getApiUrl, GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';
import { apiGet } from '../utils/apiUtils';
import TallyConfig from './tallyconfig';
import CreateAccess from './CreateAccess';
import ModulesManagement from '../access-control/ModulesManagement';
import RolesManagement from '../access-control/RolesManagement';
import ShareAccess from '../TallyDashboard/ShareAccess';
import SubscriptionManagement from './SubscriptionManagement';
import SubscriptionBadge from './components/SubscriptionBadge';
import TrialReminderModal from './components/TrialReminderModal';
import BankDetailsManagementPage from './BankDetailsManagementPage';
import { AdminMobileMenu, useIsMobile } from './MobileViewConfig';
// Import subscription module components
import {
  SubscriptionPlansPage,
  CurrentSubscriptionPage,
  PurchaseSubscriptionPage,
  UpgradeDowngradePage,
  BillingHistoryPage,
  UsageDashboardPage,
  PaymentValidationPage,
  ApprovedPaymentsPage,
  RejectedPaymentsPage,
  UserSummaryPage,
  DiscountManagementPage,
  SlabManagementPage,
  PartnerManagementPage,
  EmployeeManagementPage,
  EmployeeDashboardPage,
  PartnerDashboardPage
} from '../subscription';

// Ensure Material Icons are properly loaded and styled
const materialIconsStyle = `
  @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
  .material-icons {
    font-family: 'Material Icons';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    -webkit-font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
  }
`;

// Table columns for user connections (with Type)
const CONNECTION_COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'conn_name', label: 'Site ID' },
  { key: 'access_type', label: 'Access Type' },
  { key: 'shared_email', label: 'Shared By/Owner' },
  { key: 'status', label: 'Status' },
];

function AdminDashboard() {
  const name = sessionStorage.getItem('name');
  const email = sessionStorage.getItem('email');
  const token = sessionStorage.getItem('token');
  // Normalize userType on initial load
  const getNormalizedUserType = () => {
    return (sessionStorage.getItem('user_type') || 'customer').trim().toLowerCase();
  };
  
  const [userType, setUserType] = useState(getNormalizedUserType());
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(searchParams.get('view') || 'dashboard');
  
  // Update userType from sessionStorage on mount and when it changes
  useEffect(() => {
    const storedUserType = getNormalizedUserType();
    setUserType(storedUserType);
    console.log('AdminDashboard - user_type from sessionStorage:', storedUserType);
    console.log('AdminDashboard - canAccessAdminSubscription check:', storedUserType === 'superadmin');
    console.log('AdminDashboard - userType state:', userType);
  }, []);
  
  // Role-based access control helper functions
  const canAccessUserSubscription = () => {
    // User subscription pages accessible to superadmin and customer
    const normalizedType = (userType || '').trim().toLowerCase();
    return normalizedType === 'superadmin' || normalizedType === 'customer';
  };
  
  const canAccessAdminSubscription = () => {
    // Admin subscription pages only accessible to superadmin
    const normalizedType = (userType || '').trim().toLowerCase();
    const hasAccess = normalizedType === 'superadmin';
    console.log('canAccessAdminSubscription called:', { 
      userType, 
      normalizedType, 
      hasAccess,
      sessionStorageValue: sessionStorage.getItem('user_type')
    });
    return hasAccess;
  };
  
  const canAccessEmployeePortal = () => {
    // Employee portal accessible to superadmin and employee
    const normalizedType = (userType || '').trim().toLowerCase();
    return normalizedType === 'superadmin' || normalizedType === 'employee';
  };
  
  const canAccessPartnerPortal = () => {
    // Partner portal accessible to superadmin and partner
    const normalizedType = (userType || '').trim().toLowerCase();
    return normalizedType === 'superadmin' || normalizedType === 'partner';
  };
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const profileRef = useRef();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef();
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [googleConfigStatus, setGoogleConfigStatus] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(localStorage.getItem('google_access_token') || null);
  const [sidebarTooltip, setSidebarTooltip] = useState({ show: false, text: '', top: 0 });
  const [controlPanelDropdownOpen, setControlPanelDropdownOpen] = useState(false);
  const [controlPanelDropdownPosition, setControlPanelDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const controlPanelButtonRef = useRef(null);
  const controlPanelDropdownRef = useRef(null);
  const [profileDropdownPosition, setProfileDropdownPosition] = useState({ top: 0, left: 0 });
  const [subscriptionDropdownOpen, setSubscriptionDropdownOpen] = useState(false);
  const [subscriptionDropdownPosition, setSubscriptionDropdownPosition] = useState({ top: 0, left: 0 });
  const subscriptionButtonRef = useRef(null);
  const [subscriptionAdminDropdownOpen, setSubscriptionAdminDropdownOpen] = useState(false);
  const [subscriptionAdminDropdownPosition, setSubscriptionAdminDropdownPosition] = useState({ top: 0, left: 0 });
  const subscriptionAdminButtonRef = useRef(null);
  let sidebarTooltipTimeout = null;
  
  // Mobile menu state
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Access Control dropdown items
  const ACCESS_CONTROL_ITEMS = [
    { key: 'modules', label: 'Modules Management', icon: 'apps' },
    { key: 'roles', label: 'Roles Management', icon: 'group' },
    { key: 'create-access', label: 'User Management', icon: 'person_add' },
    { key: 'share-access', label: 'Share Access', icon: 'share' },
    { key: 'subscription', label: 'Subscription', icon: 'subscriptions' },
  ];

  // Handle URL parameter changes
  useEffect(() => {
    const viewParam = searchParams.get('view');
    // List of all valid views including subscription module views
    const validViews = [
      'dashboard', 'tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription',
      // User subscription views
      'subscription_plans', 'current_subscription', 'billing_history',
      // Admin subscription views  
      'payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 
      'slab_management', 'partner_management', 'employee_management', 'bank_details',
      // Employee/Partner portals
      'employee_dashboard', 'partner_dashboard'
    ];
    if (viewParam && validViews.includes(viewParam)) {
      setView(viewParam);
    }
  }, [searchParams]);

  // Update URL when view changes
  const handleViewChange = (newView) => {
    setView(newView);
    setSearchParams({ view: newView });
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };

  // State for user connections (single table)
  const [allConnections, setAllConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState('');

  // Global search state
  const [search, setSearch] = useState("");

  // Filtered connections based on search
  const filteredConnections = allConnections.filter(row =>
    CONNECTION_COLUMNS.some(col =>
      String(row[col.key] || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  );

  // Add a handler for clicking a connected company
  const handleCompanyClick = async (row) => {
    console.log('🔍 Company clicked:', row);
    if (row.status !== 'Connected') {
      console.log('⚠️ Company not connected, skipping navigation');
      return;
    }
    
    console.log('🔍 Current auth state:', {
      token: !!sessionStorage.getItem('token'),
      email: !!sessionStorage.getItem('email'),
      name: !!sessionStorage.getItem('name')
    });
    
    // Store company data in sessionStorage
    sessionStorage.setItem('tallyloc_id', row.tallyloc_id || '');
    sessionStorage.setItem('conn_name', row.conn_name || '');
    sessionStorage.setItem('company', row.company || '');
    sessionStorage.setItem('guid', row.guid || '');
    sessionStorage.setItem('shared_email', row.shared_email || '');
    sessionStorage.setItem('status', row.status || '');
    sessionStorage.setItem('access_type', row.access_type || '');
    // Store new fields
    sessionStorage.setItem('address', row.address || '');
    sessionStorage.setItem('pincode', row.pincode || '');
    sessionStorage.setItem('statename', row.statename || '');
    sessionStorage.setItem('countryname', row.countryname || '');
    // Don't overwrite authentication email - use a different key for company email
    sessionStorage.setItem('company_email', row.email || '');
    sessionStorage.setItem('phonenumber', row.phonenumber || '');
    sessionStorage.setItem('mobilenumbers', row.mobilenumbers || '');
    sessionStorage.setItem('gstinno', row.gstinno || '');
    sessionStorage.setItem('startingfrom', row.startingfrom || '');
    sessionStorage.setItem('booksfrom', row.booksfrom || '');
    sessionStorage.setItem('createdAt', row.createdAt || '');
    // Store the selected company's guid and tallyloc_id as identifiers
    sessionStorage.setItem('selectedCompanyGuid', row.guid || '');
    sessionStorage.setItem('selectedCompanyTallylocId', row.tallyloc_id || '');
    // Store all connected companies for dropdown in Ledgerbook
    const connected = allConnections.filter(c => c.status === 'Connected');
    sessionStorage.setItem('allConnections', JSON.stringify(connected));
    
    // Fetch user access permissions for this company - COMMENTED OUT
    // await fetchUserAccessPermissions(row.tallyloc_id);
    
    console.log('🚀 Navigating to /tally-dashboard');
    navigate('/tally-dashboard');
  };

  // Fetch user access permissions for a specific company - COMMENTED OUT
  // const fetchUserAccessPermissions = async (tallylocId) => {
  //   if (!tallylocId) {
  //     console.error('❌ No tallyloc_id provided for access permissions');
  //     return;
  //   }

  //   const cacheKey = `user_access_${tallylocId}`;
  //   console.log('🔑 Fetching user access permissions for tallyloc_id:', tallylocId);

  //   try {
  //     // Check cache first
  //     const cached = sessionStorage.getItem(cacheKey);
  //     if (cached) {
  //       console.log('📋 Using cached user access permissions');
  //       try {
  //         const cachedData = JSON.parse(cached);
  //         console.log('📋 Cached permissions:', cachedData);
  //         return cachedData;
  //       } catch (parseError) {
  //         console.warn('⚠️ Failed to parse cached permissions, fetching fresh data');
  //       }
  //     }

  //     // Fetch fresh data from API
  //     const cacheBuster = Date.now();
  //     console.log('📡 Fetching user access from API...');
  //     const response = await apiGet(`/api/access-control/user-access?tallylocId=${tallylocId}&ts=${cacheBuster}`);
      
  //     console.log('📡 User access response:', response);

  //     if (response && response.success && response.data) {
  //       // Cache the response
  //       sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
  //       console.log('✅ User access permissions cached successfully');
        
  //       // Log access summary for debugging
  //       console.log('🔐 Access Summary:', {
  //         isOwner: response.data.access_summary?.is_owner,
  //         totalModules: response.data.access_summary?.total_modules,
  //         totalRoles: response.data.access_summary?.total_roles,
  //         totalPermissions: response.data.access_summary?.total_permissions,
  //         userType: response.data.user?.user_type,
  //         modules: response.data.modules?.length || 0,
  //         roles: response.data.roles?.length || 0
  //       });

  //       return response.data;
  //     } else {
  //       console.error('❌ Invalid user access response:', response);
  //       return null;
  //     }
  //   } catch (error) {
  //     console.error('❌ Error fetching user access permissions:', error);
  //     return null;
  //   }
  // };

  // Refetch handler for refresh button
  const fetchConnections = async () => {
    setConnectionsLoading(true);
    setConnectionsError('');
    const cacheBuster = Date.now();
    
    try {
      const data = await apiGet(`/api/tally/user-connections?ts=${cacheBuster}`);
      if (data) {
        // Handle new API structure - data is now a single array
        let connections = [];
        if (Array.isArray(data)) {
          connections = data;
        } else if (data.createdByMe && data.sharedWithMe) {
          // Fallback for old API structure
          const created = Array.isArray(data.createdByMe) ? data.createdByMe.map(row => ({ ...row, type: 'Created By Me' })) : [];
          const shared = Array.isArray(data.sharedWithMe) ? data.sharedWithMe.map(row => ({ ...row, type: 'Shared With Me' })) : [];
          connections = [...created, ...shared];
        }
        
        setAllConnections(connections);
        
        // Update session storage with all connections
        sessionStorage.setItem('allConnections', JSON.stringify(connections));
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('connectionsUpdated'));
        
        // DISABLED: Automatic cache sync is now disabled - users must manually trigger downloads
        // Trigger auto-sync for eligible companies (Internal/Full Access)
        // if (connections && connections.length > 0) {
        //   try {
        //     // Import dynamically to avoid circular dependencies
        //     const { cacheSyncManager } = await import('../utils/cacheSyncManager');
        //     const eligibleCompanies = connections.filter(c => 
        //       c.status === 'Connected' && 
        //       (c.access_type === 'Internal' || c.access_type === 'Full Access')
        //     );
        //     
        //     if (eligibleCompanies.length > 0) {
        //       console.log(`🚀 Triggering auto-sync for ${eligibleCompanies.length} companies`);
        //       cacheSyncManager.startAutoSyncForCompanies(eligibleCompanies);
        //     }
        //   } catch (syncError) {
        //     console.error('Error starting auto-sync:', syncError);
        //     // Don't block UI if sync fails to start
        //   }
        // }
      }
    } catch (err) {
      setConnectionsError('Failed to load connections');
    } finally {
      setConnectionsLoading(false);
    }
  };

  // Fetch user connections when dashboard is shown
  useEffect(() => {
    if (view !== 'dashboard') return;
    fetchConnections();
  }, [view, token]);

  const sidebarWidth = sidebarOpen ? 220 : 60;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 900 && sidebarOpen) setSidebarOpen(false);
      if (window.innerWidth > 900 && !sidebarOpen) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Prepare sidebar items for mobile menu
  const mobileSidebarItems = [
    {
      key: 'dashboard',
      label: 'Home',
      icon: 'home',
    },
    {
      key: 'control-panel',
      label: 'Control Panel',
      icon: 'admin_panel_settings',
      subItems: [
        { key: 'tally-config', label: 'Tally Connections', icon: 'settings' },
        ...ACCESS_CONTROL_ITEMS,
      ],
    },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
      if (controlPanelDropdownRef.current && !controlPanelDropdownRef.current.contains(event.target)) {
        setControlPanelDropdownOpen(false);
      }
    }
    if (profileDropdownOpen || controlPanelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen, controlPanelDropdownOpen]);

  // Update control panel dropdown position when it opens
  useEffect(() => {
    const updateControlPanelDropdownPosition = () => {
      if (controlPanelDropdownOpen && controlPanelButtonRef.current) {
        const rect = controlPanelButtonRef.current.getBoundingClientRect();
        setControlPanelDropdownPosition({
          top: rect.top,
          left: rect.left + rect.width,
          width: rect.width
        });
      }
    };
    
    if (controlPanelDropdownOpen) {
      updateControlPanelDropdownPosition();
      const handleResize = () => updateControlPanelDropdownPosition();
      const handleScroll = () => updateControlPanelDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [controlPanelDropdownOpen]);

  // Update profile dropdown position when it opens
  useEffect(() => {
    const updateProfileDropdownPosition = () => {
      if (profileDropdownOpen && profileDropdownRef.current) {
        const rect = profileDropdownRef.current.getBoundingClientRect();
        setProfileDropdownPosition({
          top: Math.max(8, rect.top - 180),
          left: rect.left + rect.width + 8
        });
      }
    };
    
    if (profileDropdownOpen) {
      updateProfileDropdownPosition();
      const handleResize = () => updateProfileDropdownPosition();
      const handleScroll = () => updateProfileDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [profileDropdownOpen, sidebarOpen]);

  // Close control panel dropdown when sidebar closes
  useEffect(() => {
    if (!sidebarOpen) {
      setControlPanelDropdownOpen(false);
    }
  }, [sidebarOpen]);

  // Auto-open Control Panel dropdown when any of its child views are active
  useEffect(() => {
    if (['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) {
      setControlPanelDropdownOpen(true);
    }
  }, [view]);

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
  };

  const handleDashboard = () => {
    handleViewChange('dashboard');
  };
  const handleTallyConfig = () => {
    handleViewChange('tally-config');
  };

  const handleCreateAccess = () => {
    handleViewChange('create-access');
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
      <style>{materialIconsStyle}</style>
      
      {/* Hamburger Menu Button - Mobile Only */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(true)}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 10000,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f8fafc';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fff';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span className="material-icons" style={{ fontSize: 24, color: '#1e293b' }}>
            menu
          </span>
        </button>
      )}

      {/* Mobile Menu */}
      {isMobile && (
        <AdminMobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          sidebarItems={mobileSidebarItems}
          activeView={view}
          onViewChange={handleViewChange}
          name={name}
          email={email}
          onProfileClick={() => setProfileDropdownOpen(true)}
          onLogout={handleLogout}
          profileDropdownOpen={profileDropdownOpen}
          setProfileDropdownOpen={setProfileDropdownOpen}
          showGoogleConfigModal={showGoogleConfigModal}
          setShowGoogleConfigModal={setShowGoogleConfigModal}
          SubscriptionBadge={SubscriptionBadge}
          navigate={navigate}
        />
      )}

      {/* Top Bar removed - header components moved to sidebar */}

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

      {/* Sidebar - Hidden in Mobile */}
      {!isMobile && (
      <aside
        className={`adminhome-sidebar sidebar-animated`}
        style={{
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          background: '#1e3a8a',
          overflowY: 'auto',
          width: sidebarOpen ? 220 : 60,
          minWidth: sidebarOpen ? 220 : 60,
          maxWidth: sidebarOpen ? 220 : 60,
          transition: 'width 0.3s, min-width 0.3s, max-width 0.3s',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo Section */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 12px',
          position: 'relative',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={TallyLogo}
              alt="DataLynk Logo"
              style={{
                width: sidebarOpen ? '140px' : '70px',
                height: sidebarOpen ? '140px' : '70px',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                transition: 'width 0.3s ease',
                objectFit: 'contain',
              }}
            />
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 18, 
          fontSize: 17,
          padding: '0 12px 12px 12px',
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}>
          <a
            href="#"
            onClick={handleDashboard}
            style={{
              color: view === 'dashboard' ? '#ff9800' : '#fff',
              background: view === 'dashboard' ? 'rgba(255,152,0,0.08)' : 'transparent',
              textDecoration: 'none',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: '8px',
              fontWeight: view === 'dashboard' ? 700 : 500,
              margin: '0 8px',
              border: view === 'dashboard' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              position: 'relative',
            }}
            title="Home"
            onMouseEnter={e => {
              if (!sidebarOpen) {
                const rect = e.currentTarget.getBoundingClientRect();
                setSidebarTooltip({ show: true, text: 'Dashboard', top: rect.top + window.scrollY });
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
            <span className="material-icons" style={{ fontSize: 22 }}>home</span>
            {sidebarOpen && <span className="sidebar-link-label">Home</span>}
          </a>
          
          {/* Control Panel */}
          <div style={{ position: 'relative' }} ref={controlPanelDropdownRef}>
            <a
              ref={controlPanelButtonRef}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setControlPanelDropdownOpen(!controlPanelDropdownOpen);
              }}
              style={{
                color: (controlPanelDropdownOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) ? '#ff9800' : '#fff',
                background: (controlPanelDropdownOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) ? 'rgba(255,152,0,0.08)' : 'transparent',
                textDecoration: 'none',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '8px',
                fontWeight: (controlPanelDropdownOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) ? 700 : 500,
                margin: '0 8px',
                border: (controlPanelDropdownOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                position: 'relative',
              }}
              title="Control Panel"
              onMouseEnter={e => {
                if (sidebarOpen) {
                  setControlPanelDropdownOpen(true);
                }
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
              {sidebarOpen && (
                <>
                  <span className="sidebar-link-label">Control Panel</span>
                  <span className="material-icons" style={{ 
                    fontSize: 18, 
                    marginLeft: 'auto',
                    color: (controlPanelDropdownOpen || ['tally-config', 'modules', 'roles', 'create-access', 'share-access', 'subscription'].includes(view)) ? '#ff9800' : 'rgba(255, 255, 255, 0.7)',
                    transition: 'transform 0.2s',
                    transform: controlPanelDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>arrow_drop_down</span>
                </>
              )}
            </a>
            
            {/* Right-side dropdown menu */}
            {sidebarOpen && controlPanelDropdownOpen && (
              <div style={{
                position: 'fixed',
                top: `${controlPanelDropdownPosition.top}px`,
                left: `${controlPanelDropdownPosition.left + 8}px`,
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
                setControlPanelDropdownOpen(true);
                if (controlPanelButtonRef.current) {
                  const rect = controlPanelButtonRef.current.getBoundingClientRect();
                  setControlPanelDropdownPosition({
                    top: rect.top,
                    left: rect.left + rect.width,
                    width: rect.width
                  });
                }
              }}
              onMouseLeave={() => setControlPanelDropdownOpen(false)}
              >
                {/* Tally Connections */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTallyConfig();
                    setControlPanelDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'tally-config' ? '#ff9800' : '#fff',
                    background: view === 'tally-config' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'tally-config' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => {
                    if (view !== 'tally-config') {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (view !== 'tally-config') {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>settings</span>
                  <span>Tally Connections</span>
                </button>
                
                {/* Access Control Items */}
                {ACCESS_CONTROL_ITEMS.map(item => (
                  <button
                    key={item.key}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleViewChange(item.key);
                      setControlPanelDropdownOpen(false);
                    }}
                    style={{
                      color: view === item.key ? '#ff9800' : '#fff',
                      background: view === item.key ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: '8px',
                      fontWeight: view === item.key ? 700 : 500,
                      margin: '0 8px',
                      border: 'none',
                      cursor: 'pointer',
                      justifyContent: 'flex-start',
                      fontSize: '14px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      if (view !== item.key) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (view !== item.key) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subscription Menu with Dropdown - Only show for superadmin and admin */}
          {canAccessUserSubscription() && (
            <div style={{ position: 'relative' }} ref={subscriptionButtonRef}>
              <a
                ref={subscriptionButtonRef}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setSubscriptionDropdownOpen(!subscriptionDropdownOpen);
                }}
                style={{
                  color: (subscriptionDropdownOpen || ['subscription_plans', 'current_subscription', 'billing_history'].includes(view)) ? '#ff9800' : '#fff',
                  background: (subscriptionDropdownOpen || ['subscription_plans', 'current_subscription', 'billing_history'].includes(view)) ? 'rgba(255,152,0,0.08)' : 'transparent',
                  textDecoration: 'none',
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: '8px',
                  fontWeight: (subscriptionDropdownOpen || ['subscription_plans', 'current_subscription', 'billing_history'].includes(view)) ? 700 : 500,
                  margin: '0 8px',
                  border: (subscriptionDropdownOpen || ['subscription_plans', 'current_subscription', 'billing_history'].includes(view)) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  position: 'relative',
                }}
                title="Subscription"
                onMouseEnter={e => {
                  if (sidebarOpen) {
                    setSubscriptionDropdownOpen(true);
                    if (subscriptionButtonRef.current) {
                      const rect = subscriptionButtonRef.current.getBoundingClientRect();
                      setSubscriptionDropdownPosition({
                        top: rect.top,
                        left: rect.left + rect.width,
                        width: rect.width
                      });
                    }
                  }
                  if (!sidebarOpen) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setSidebarTooltip({ show: true, text: 'Subscription', top: rect.top + window.scrollY });
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
                <span className="material-icons" style={{ fontSize: 22 }}>subscriptions</span>
                {sidebarOpen && (
                  <>
                    <span className="sidebar-link-label">Subscription</span>
                    <span className="material-icons" style={{ 
                      fontSize: 18, 
                      marginLeft: 'auto',
                      color: (subscriptionDropdownOpen || ['subscription_plans', 'current_subscription', 'billing_history'].includes(view)) ? '#ff9800' : 'rgba(255, 255, 255, 0.7)',
                      transition: 'transform 0.2s',
                      transform: subscriptionDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>arrow_drop_down</span>
                  </>
                )}
              </a>
            
            {/* Subscription Dropdown Menu */}
            {sidebarOpen && subscriptionDropdownOpen && canAccessUserSubscription() && (
              <div style={{
                position: 'fixed',
                top: `${subscriptionDropdownPosition.top}px`,
                left: `${subscriptionDropdownPosition.left + 8}px`,
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
                setSubscriptionDropdownOpen(true);
                if (subscriptionButtonRef.current) {
                  const rect = subscriptionButtonRef.current.getBoundingClientRect();
                  setSubscriptionDropdownPosition({
                    top: rect.top,
                    left: rect.left + rect.width,
                    width: rect.width
                  });
                }
              }}
              onMouseLeave={() => setSubscriptionDropdownOpen(false)}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('current_subscription');
                    setSubscriptionDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'current_subscription' ? '#ff9800' : '#fff',
                    background: view === 'current_subscription' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'current_subscription' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>account_circle</span>
                  <span>My Subscription</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('billing_history');
                    setSubscriptionDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'billing_history' ? '#ff9800' : '#fff',
                    background: view === 'billing_history' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'billing_history' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>receipt</span>
                  <span>Billing History</span>
                </button>
              </div>
            )}
            </div>
          )}

          {/* Subscription Admin Menu with Dropdown - Only show for superadmin */}
          {(() => {
            const hasAccess = canAccessAdminSubscription();
            if (!hasAccess) {
              console.log('Subscription Admin menu NOT rendered. userType:', userType, 'sessionStorage:', sessionStorage.getItem('user_type'));
            } else {
              console.log('Subscription Admin menu WILL be rendered. userType:', userType);
            }
            return hasAccess;
          })() && (
            <div style={{ position: 'relative' }} ref={subscriptionAdminButtonRef}>
              <a
                ref={subscriptionAdminButtonRef}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setSubscriptionAdminDropdownOpen(!subscriptionAdminDropdownOpen);
                }}
                style={{
                  color: (subscriptionAdminDropdownOpen || ['payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? '#ff9800' : '#fff',
                  background: (subscriptionAdminDropdownOpen || ['payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? 'rgba(255,152,0,0.08)' : 'transparent',
                  textDecoration: 'none',
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: '8px',
                  fontWeight: (subscriptionAdminDropdownOpen || ['payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? 700 : 500,
                  margin: '0 8px',
                  border: (subscriptionAdminDropdownOpen || ['payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                  cursor: 'pointer',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  position: 'relative',
                }}
                title="Subscription Admin"
                onMouseEnter={e => {
                  if (sidebarOpen) {
                    setSubscriptionAdminDropdownOpen(true);
                    if (subscriptionAdminButtonRef.current) {
                      const rect = subscriptionAdminButtonRef.current.getBoundingClientRect();
                      setSubscriptionAdminDropdownPosition({
                        top: rect.top,
                        left: rect.left + rect.width,
                        width: rect.width
                      });
                    }
                  }
                  if (!sidebarOpen) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setSidebarTooltip({ show: true, text: 'Subscription Admin', top: rect.top + window.scrollY });
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
                {sidebarOpen && (
                  <>
                    <span className="sidebar-link-label">Subscription Admin</span>
                    <span className="material-icons" style={{ 
                      fontSize: 18, 
                      marginLeft: 'auto',
                      color: (subscriptionAdminDropdownOpen || ['payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? '#ff9800' : 'rgba(255, 255, 255, 0.7)',
                      transition: 'transform 0.2s',
                      transform: subscriptionAdminDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}>arrow_drop_down</span>
                  </>
                )}
              </a>
              
              {/* Subscription Admin Dropdown Menu */}
              {sidebarOpen && subscriptionAdminDropdownOpen && (
              <div style={{
                position: 'fixed',
                top: `${subscriptionAdminDropdownPosition.top}px`,
                left: `${subscriptionAdminDropdownPosition.left + 8}px`,
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
                setSubscriptionAdminDropdownOpen(true);
                if (subscriptionAdminButtonRef.current) {
                  const rect = subscriptionAdminButtonRef.current.getBoundingClientRect();
                  setSubscriptionAdminDropdownPosition({
                    top: rect.top,
                    left: rect.left + rect.width,
                    width: rect.width
                  });
                }
              }}
              onMouseLeave={() => setSubscriptionAdminDropdownOpen(false)}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('payment_validation');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'payment_validation' ? '#ff9800' : '#fff',
                    background: view === 'payment_validation' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'payment_validation' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>verified</span>
                  <span>Payment Validation</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('approved_payments');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'approved_payments' ? '#ff9800' : '#fff',
                    background: view === 'approved_payments' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'approved_payments' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>check_circle</span>
                  <span>Approved Payments</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('rejected_payments');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'rejected_payments' ? '#ff9800' : '#fff',
                    background: view === 'rejected_payments' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'rejected_payments' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>cancel</span>
                  <span>Rejected Payments</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('user_summary');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'user_summary' ? '#ff9800' : '#fff',
                    background: view === 'user_summary' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'user_summary' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>people</span>
                  <span>User Summary</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('slab_management');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'slab_management' ? '#ff9800' : '#fff',
                    background: view === 'slab_management' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'slab_management' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>layers</span>
                  <span>Slab Management</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('partner_management');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'partner_management' ? '#ff9800' : '#fff',
                    background: view === 'partner_management' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'partner_management' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>handshake</span>
                  <span>Partner Management</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('employee_management');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'employee_management' ? '#ff9800' : '#fff',
                    background: view === 'employee_management' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'employee_management' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>work</span>
                  <span>Employee Management</span>
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewChange('bank_details');
                    setSubscriptionAdminDropdownOpen(false);
                  }}
                  style={{
                    color: view === 'bank_details' ? '#ff9800' : '#fff',
                    background: view === 'bank_details' ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: '8px',
                    fontWeight: view === 'bank_details' ? 700 : 500,
                    margin: '0 8px',
                    border: 'none',
                    cursor: 'pointer',
                    justifyContent: 'flex-start',
                    fontSize: '14px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 20, flexShrink: 0 }}>account_balance</span>
                  <span>Bank Details</span>
                </button>
              </div>
            )}
          </div>
          )}

        </nav>

        {/* Subscription Badge Section */}
        {sidebarOpen && (
          <div style={{
            padding: '0 12px 12px 12px',
            flexShrink: 0,
          }}>
            <SubscriptionBadge />
          </div>
        )}

        {/* User Profile Section */}
        {sidebarOpen && (
          <div style={{
            padding: '0 12px 12px 12px',
            flexShrink: 0,
            position: 'relative',
          }}>
            <div
              ref={profileDropdownRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                background: profileDropdownOpen ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                transition: 'all 0.3s ease',
              }}
              onClick={() => setProfileDropdownOpen((open) => !open)}
              onMouseEnter={(e) => {
                if (!profileDropdownOpen) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!profileDropdownOpen) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span className="material-icons" style={{ color: '#fff', fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>account_circle</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{name || 'User'}</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{email || ''}</div>
              </div>
              <span className="material-icons" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 20, transition: 'transform 0.3s ease', transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
            </div>
            {profileDropdownOpen && profileDropdownRef.current && (
              <div style={{
                position: 'fixed',
                top: `${profileDropdownPosition.top}px`,
                left: `${profileDropdownPosition.left}px`,
                minWidth: 280,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                padding: 20,
                zIndex: 4000,
                textAlign: 'left',
                animation: 'fadeIn 0.2s ease-out',
              }}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={() => {
                  if (profileDropdownRef.current) {
                    const rect = profileDropdownRef.current.getBoundingClientRect();
                    setProfileDropdownPosition({
                      top: Math.max(8, rect.top - 180),
                      left: rect.left + rect.width + 8
                    });
                  }
                }}
                onMouseLeave={() => setProfileDropdownOpen(false)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
                  <span className="material-icons" style={{ fontSize: 32, color: '#3b82f6' }}>account_circle</span>
                  <div>
                    <div style={{ fontSize: 16, color: '#1e293b', fontWeight: 700, marginBottom: 2 }}>{name || 'User'}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{email || ''}</div>
                  </div>
                </div>
                <button
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
                    marginBottom: 10,
                  }}
                  onClick={() => {
                    if (navigate) navigate('/change-password');
                  }}
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
                <button
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
                    marginBottom: 10,
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
              </div>
            )}
          </div>
        )}

        {/* Logout Button */}
        {sidebarOpen && (
          <div style={{
            padding: '0 12px 12px 12px',
            flexShrink: 0,
          }}>
            <button
              style={{
                width: '100%',
                background: 'rgba(220, 38, 38, 0.15)',
                color: '#fff',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.2)',
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
          top: 12,
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
      )}

      {/* Tooltip */}
      {!isMobile && sidebarTooltip.show && !sidebarOpen && (
        <div className="sidebar-tooltip" style={{ top: sidebarTooltip.top }}>
          {sidebarTooltip.text}
        </div>
      )}

      {/* Main Content */}
      <main
        className="adminhome-main"
        style={{
          marginLeft: isMobile ? 0 : (sidebarOpen ? 220 : 60),
          paddingTop: isMobile ? 0 : 20,
          padding: isMobile ? 12 : 20,
          transition: 'margin 0.3s',
        }}
      >
        {view === 'dashboard' ? (
          <div style={{ marginTop: 50 }}>
            {/* Header Section */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
              <div>
                <h2 style={{ color: '#1e40af', fontWeight: 700, fontSize: 28, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-icons" style={{ fontSize: 32, color: '#1e40af' }}>account_tree</span>
                  List of Connections
                </h2>
                <div style={{ color: '#64748b', fontSize: 16, marginTop: 4 }}>Access Tally Data</div>
              </div>
              <div style={{ 
                background: '#f0f9ff', 
                color: '#0369a1', 
                padding: '8px 16px', 
                borderRadius: 20, 
                fontSize: 14, 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span className="material-icons" style={{ fontSize: 18 }}>bar_chart</span>
                {filteredConnections.length} connections available
              </div>
            </div>

            {/* Search and Controls */}
            <div style={{ 
              background: '#fff', 
              borderRadius: 16, 
              boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
              padding: 24, 
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <span className="material-icons" style={{ color: '#64748b', fontSize: 20 }}>search</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                  placeholder="Search connections..."
                style={{
                    padding: '12px 16px',
                  borderRadius: 8,
                    border: '1.5px solid #e2e8f0',
                  fontSize: 16,
                    width: '100%',
                    maxWidth: 400,
                  outline: 'none',
                    background: '#f8fafc',
                    transition: 'border-color 0.2s',
                }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              </div>
              <button
                onClick={fetchConnections}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                  border: 'none',
                  borderRadius: 8,
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)',
                }}
                title="Refresh connections"
                disabled={connectionsLoading}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
                }}
              >
                <span
                  className="material-icons"
                  style={{
                    fontSize: 24,
                    color: '#fff',
                    animation: connectionsLoading ? 'spin 1s linear infinite' : 'none',
                  }}
                >refresh</span>
              </button>
            </div>

            {/* Error State */}
            
            {connectionsError && (
              <div style={{ 
                background: '#fef2f2', 
                border: '1px solid #fecaca',
                borderRadius: 16, 
                padding: 24, 
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <span className="material-icons" style={{ color: '#dc2626', fontSize: 24 }}>error</span>
                <div style={{ color: '#dc2626', fontSize: 16 }}>{connectionsError}</div>
              </div>
            )}

              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
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
              `}</style>
            {/* Connections Table */}
            {window.innerWidth > 700 ? (
              <div style={{ 
                background: '#fff', 
                borderRadius: 16, 
                boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
                padding: 0, 
                marginBottom: 32,
                overflow: 'hidden'
              }}>
                {filteredConnections.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#64748b', 
                    padding: 60,
                    background: '#f8fafc'
                  }}>
                    <span className="material-icons" style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>account_tree</span>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No connections found</div>
                    <div style={{ fontSize: 14 }}>Try adjusting your search criteria or create a new connection</div>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
                  <thead>
                      <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
                      {CONNECTION_COLUMNS.map(col => (
                          <th key={col.key} style={{ 
                            padding: '15px 18px', 
                            color: '#1e293b', 
                            fontWeight: 700, 
                            textAlign: 'left',
                            fontSize: 14,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            borderBottom: '2px solid #e2e8f0'
                          }}>
                            {col.label}
                          </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                      {connectionsLoading ? (
                        <tr>
                          <td colSpan={CONNECTION_COLUMNS.length} style={{ 
                            padding: '40px 20px', 
                            textAlign: 'center', 
                            color: '#64748b',
                            background: '#f8fafc'
                          }}>
                            <span className="material-icons" style={{ 
                              fontSize: 24, 
                              color: '#3b82f6', 
                              marginRight: 8,
                              animation: 'spin 1s linear infinite'
                            }}>sync</span>
                            Loading...
                          </td>
                        </tr>
                      ) : (
                        filteredConnections.map((row, idx) => (
                      <tr
                        key={row.tallyloc_id + '-' + row.guid + '-' + idx}
                        style={{
                          background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                            cursor: row.status === 'Connected' ? 'pointer' : 'default',
                            transition: 'all 0.2s ease',
                            borderBottom: '1px solid #f1f5f9'
                        }}
                        onClick={row.status === 'Connected' ? () => handleCompanyClick(row) : undefined}
                          title={row.status === 'Connected' ? 'Click to open Tally Dashboard' : undefined}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f0f9ff';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.10)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = idx % 2 === 0 ? '#fff' : '#f8fafc';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = 'none';
                          }}
                      >
                        {CONNECTION_COLUMNS.map(col => {
                            let cellStyle = { 
                              padding: '15px 18px', 
                              textAlign: 'left',
                              borderBottom: '1px solid #f1f5f9'
                            };
                            
                          if (row.status === 'Connected') {
                              cellStyle.fontWeight = 600;
                              cellStyle.color = '#1e293b';
                          } else if (row.status === 'Offline') {
                            cellStyle.fontWeight = 400;
                              cellStyle.color = '#94a3b8';
                          } else {
                              cellStyle.color = '#64748b';
                          }
                            
                          return (
                            <td key={col.key} style={cellStyle}>
                              {col.key === 'status' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                      padding: '6px 12px',
                                      borderRadius: '18px',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      background: row.status === 'Connected' ? '#dcfce7' : 
                                                row.status === 'Offline' ? '#fef2f2' : '#f1f5f9',
                                      color: row.status === 'Connected' ? '#166534' : 
                                           row.status === 'Offline' ? '#dc2626' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5
                                    }}>
                                  <span className="material-icons" style={{
                                        fontSize: 16,
                                        color: row.status === 'Connected' ? '#22c55e' :
                                              row.status === 'Offline' ? '#ef4444' : '#64748b',
                                        display: 'inline-block',
                                    verticalAlign: 'middle',
                                        lineHeight: 1
                                      }}>
                                        {row.status === 'Connected' ? 'check_circle' : 
                                         row.status === 'Offline' ? 'cancel' : 'help_outline'}
                                      </span>
                                      {row[col.key]}
                                    </span>
                                  </div>
                                ) : col.key === 'company' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                      width: 40,
                                      height: 40,
                                      borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: 16
                                    }}>
                                      {row.company ? row.company.charAt(0).toUpperCase() : 'C'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{row[col.key]}</div>
                                    </div>
                                  </div>
                                ) : col.key === 'access_type' ? (
                                  <span style={{
                                    padding: '4px 12px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    background: '#e0f2fe',
                                    color: '#0c4a6e'
                                  }}>
                                    {row[col.key]}
                                  </span>
                                ) : (
                                  <div style={{ color: row.status === 'Offline' ? '#94a3b8' : '#64748b' }}>
                                    {row[col.key]}
                                  </div>
                                )}
                            </td>
                          );
                        })}
                      </tr>
                        ))
                      )}
                  </tbody>
                </table>
                )}
              </div>
            ) : (
              /* Mobile Card View */
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 16,
                maxWidth: 600, 
                margin: '0 auto'
              }}>
                  {filteredConnections.length === 0 ? (
                  <div style={{ 
                    background: '#fff', 
                    borderRadius: 16, 
                    boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
                    padding: 40, 
                    textAlign: 'center' 
                  }}>
                    <span className="material-icons" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>account_tree</span>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#64748b' }}>No connections found</div>
                    <div style={{ fontSize: 14, color: '#94a3b8' }}>Try adjusting your search criteria</div>
                  </div>
                  ) : filteredConnections.map((row, idx) => {
                    const isConnected = row.status === 'Connected';
                    const isOffline = row.status === 'Offline';
                    return (
                      <div
                        key={row.tallyloc_id + '-' + row.guid + '-' + idx}
                        style={{
                        background: '#fff',
                        borderRadius: 16,
                        boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)',
                        padding: 20,
                        cursor: isConnected ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        border: isConnected ? '2px solid transparent' : '2px solid #f1f5f9',
                        opacity: isOffline ? 0.7 : 1
                        }}
                        onClick={isConnected ? () => {
                          console.log('🔥 CLICK EVENT TRIGGERED!');
                          handleCompanyClick(row);
                        } : undefined}
                      title={isConnected ? 'Tap to open Tally Dashboard' : undefined}
                      onMouseEnter={(e) => {
                        if (isConnected) {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 8px 32px 0 rgba(59,130,246,0.15)';
                          e.target.style.borderColor = '#3b82f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isConnected) {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 4px 24px 0 rgba(31,38,135,0.08)';
                          e.target.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      {/* Header with Company Info */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 18
                          }}>
                            {row.company ? row.company.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <div style={{ 
                              fontWeight: 700, 
                              fontSize: 16, 
                              color: isOffline ? '#94a3b8' : '#1e293b',
                              marginBottom: 2
                            }}>
                          {row.company}
                            </div>
                            <div style={{ 
                              fontSize: 12, 
                              color: '#64748b',
                              fontWeight: 500
                            }}>
                              Site ID: {row.conn_name}
                            </div>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <span style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: isConnected ? '#dcfce7' : 
                                    isOffline ? '#fef2f2' : '#f1f5f9',
                          color: isConnected ? '#166534' : 
                               isOffline ? '#dc2626' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <span className="material-icons" style={{
                            fontSize: 16,
                            color: isConnected ? '#22c55e' : isOffline ? '#ef4444' : '#64748b'
                          }}>
                              {isConnected ? 'check_circle' : isOffline ? 'cancel' : 'help_outline'}
                            </span>
                          {row.status}
                        </span>
                      </div>

                      {/* Details */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1fr 1fr', 
                        gap: 12,
                        padding: '16px 0',
                        borderTop: '1px solid #f1f5f9'
                      }}>
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>ACCESS TYPE</div>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: '#e0f2fe',
                            color: '#0c4a6e'
                          }}>
                            {row.access_type}
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>SHARED BY</div>
                          <div style={{ 
                            fontSize: 13, 
                            color: isOffline ? '#94a3b8' : '#64748b',
                            fontWeight: 500
                          }}>
                            {row.shared_email}
                          </div>
                        </div>
                      </div>

                      {/* Action Hint */}
                      {isConnected && (
                        <div style={{
                          background: '#f0f9ff',
                          borderRadius: 8,
                          padding: '8px 12px',
                          marginTop: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: '#0369a1'
                        }}>
                          <span className="material-icons" style={{ fontSize: 16 }}>touch_app</span>
                          Tap to access Tally Dashboard
                        </div>
                      )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : view === 'tally-config' ? (
          <TallyConfig />
        ) : view === 'create-access' ? (
          <CreateAccess />
        ) : view === 'modules' ? (
          <ModulesManagement />
        ) : view === 'roles' ? (
          <RolesManagement />
        ) : view === 'share-access' ? (
          <ShareAccess />
        ) : view === 'subscription' ? (
          <SubscriptionManagement />
        ) : view === 'subscription_plans' && canAccessUserSubscription() ? (
          <SubscriptionPlansPage />
        ) : view === 'current_subscription' && canAccessUserSubscription() ? (
          <CurrentSubscriptionPage />
        ) : view === 'billing_history' && canAccessUserSubscription() ? (
          <BillingHistoryPage />
        ) : view === 'payment_validation' && canAccessAdminSubscription() ? (
          <PaymentValidationPage />
        ) : view === 'approved_payments' && canAccessAdminSubscription() ? (
          <ApprovedPaymentsPage />
        ) : view === 'rejected_payments' && canAccessAdminSubscription() ? (
          <RejectedPaymentsPage />
        ) : view === 'user_summary' && canAccessAdminSubscription() ? (
          <UserSummaryPage />
        ) : view === 'slab_management' && canAccessAdminSubscription() ? (
          <SlabManagementPage />
        ) : view === 'partner_management' && canAccessAdminSubscription() ? (
          <PartnerManagementPage />
        ) : view === 'employee_management' && canAccessAdminSubscription() ? (
          <EmployeeManagementPage />
        ) : view === 'bank_details' && canAccessAdminSubscription() ? (
          <BankDetailsManagementPage />
        ) : (['subscription_plans', 'current_subscription', 'billing_history', 'payment_validation', 'approved_payments', 'rejected_payments', 'user_summary', 'slab_management', 'partner_management', 'employee_management', 'bank_details'].includes(view)) ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2 style={{ color: '#dc3545', marginBottom: '16px' }}>Access Denied</h2>
            <p style={{ color: '#666' }}>You don't have permission to access this page.</p>
          </div>
        ) : null}
      </main>

      {/* Trial Reminder Modal */}
      <TrialReminderModal />

    </div>
  );
}

export default AdminDashboard;
