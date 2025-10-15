import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TallyLogo from '../Tally1.png';
import '../AdminHomeResponsive.css';
import { getApiUrl } from '../config';
import { apiGet } from '../utils/apiUtils';
import TallyConfig from './tallyconfig';
import CreateAccess from './CreateAccess';
import ModulesManagement from '../access-control/ModulesManagement';
import RolesManagement from '../access-control/RolesManagement';
import ShareAccess from '../TallyDashboard/ShareAccess';

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
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const profileRef = useRef();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef();
  const [sidebarTooltip, setSidebarTooltip] = useState({ show: false, text: '', top: 0 });
  const [accessControlDropdownOpen, setAccessControlDropdownOpen] = useState(false);
  let sidebarTooltipTimeout = null;

  // Access Control dropdown items
  const ACCESS_CONTROL_ITEMS = [
    { key: 'modules', label: 'Modules Management', icon: 'apps' },
    { key: 'roles', label: 'Roles Management', icon: 'group' },
    { key: 'create-access', label: 'User Management', icon: 'person_add' },
    { key: 'share-access', label: 'Share Access', icon: 'share' },
  ];

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
    // Store the selected company's guid as the primary identifier
    sessionStorage.setItem('selectedCompanyGuid', row.guid || '');
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

  const handleLogout = () => {
    sessionStorage.clear();
    window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
  };

  const handleDashboard = () => {
    setView('dashboard');
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };
  const handleTallyConfig = () => {
    setView('tally-config');
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };

  const handleCreateAccess = () => {
    setView('create-access');
    if (window.innerWidth <= 900) setSidebarOpen(false);
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
      <style>{materialIconsStyle}</style>
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
        <div ref={profileDropdownRef} style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 'auto', position: 'relative' }}>
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
        <div className="sidebar-menu-label"></div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 17 }}>
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
          <a
            href="#"
            onClick={handleTallyConfig}
            style={{
              color: view === 'tally-config' ? '#ff9800' : '#fff',
              background: view === 'tally-config' ? 'rgba(255,152,0,0.08)' : 'transparent',
              textDecoration: 'none',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: '8px',
              fontWeight: view === 'tally-config' ? 700 : 500,
              margin: '0 8px',
              border: view === 'tally-config' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              position: 'relative',
            }}
            title="Tally Configuration"
            onMouseEnter={e => {
              if (!sidebarOpen) {
                const rect = e.currentTarget.getBoundingClientRect();
                setSidebarTooltip({ show: true, text: 'Tally Configuration', top: rect.top + window.scrollY });
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
            <span className="material-icons" style={{ fontSize: 22 }}>settings</span>
            {sidebarOpen && <span className="sidebar-link-label">Tally Configuration</span>}
          </a>
          {/* Access Control Dropdown */}
          <div style={{ position: 'relative' }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (sidebarOpen) {
                  setAccessControlDropdownOpen(!accessControlDropdownOpen);
                } else {
                  navigate('/access-control');
                }
              }}
              style={{
                color: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(view)) ? '#ff9800' : '#fff',
                background: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(view)) ? 'rgba(255,152,0,0.08)' : 'transparent',
                textDecoration: 'none',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '8px',
                fontWeight: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(view)) ? 700 : 500,
                margin: '0 8px',
                border: (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(view)) ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                cursor: 'pointer',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                position: 'relative',
              }}
              title="Access Control"
              onMouseEnter={e => {
                if (!sidebarOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSidebarTooltip({ show: true, text: 'Access Control', top: rect.top + window.scrollY });
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
              <span className="material-icons" style={{ fontSize: 22 }}>security</span>
              {sidebarOpen && <span className="sidebar-link-label">Access Control</span>}
              {sidebarOpen && <span className="material-icons" style={{ fontSize: 16, marginLeft: 'auto' }}>expand_more</span>}
            </a>
            
            {/* Dropdown Menu */}
            {sidebarOpen && (accessControlDropdownOpen || ['modules', 'roles', 'create-access', 'share-access'].includes(view)) && (
              <div style={{
                marginLeft: '16px',
                marginTop: '8px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '8px 0',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {ACCESS_CONTROL_ITEMS.map(item => (
                  <a
                    key={item.key}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setView(item.key);
                      setAccessControlDropdownOpen(false);
                    }}
                    style={{
                      color: view === item.key ? '#ff9800' : '#fff',
                      background: view === item.key ? 'rgba(255, 152, 0, 0.15)' : 'transparent',
                      textDecoration: 'none',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: '6px',
                      fontWeight: view === item.key ? 600 : 400,
                      margin: '0 8px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (view !== item.key) {
                        e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (view !== item.key) {
                        e.target.style.background = 'transparent';
                      } else {
                        e.target.style.background = 'rgba(255, 152, 0, 0.15)';
                      }
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 18 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </nav>
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

      {/* Tooltip */}
      {sidebarTooltip.show && !sidebarOpen && (
        <div className="sidebar-tooltip" style={{ top: sidebarTooltip.top }}>
          {sidebarTooltip.text}
        </div>
      )}

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
        ) : null}
      </main>


    </div>
  );
}

export default AdminDashboard;
