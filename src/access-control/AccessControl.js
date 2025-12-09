import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TallyLogo from '../DLrlogo.png';
import '../AdminHomeResponsive.css';
import ModulesManagement from './ModulesManagement';
import RolesManagement from './RolesManagement';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

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

const SIDEBAR_ITEMS = [
  { key: 'modules', label: 'Modules Management', icon: 'apps' },
  { key: 'roles', label: 'Roles Management', icon: 'group' },
];

function AccessControl() {
  const name = sessionStorage.getItem('name');
  const email = sessionStorage.getItem('email');
  const token = sessionStorage.getItem('token');
  const [searchParams] = useSearchParams();
  const [selectedView, setSelectedView] = useState(searchParams.get('view') || 'modules');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const profileRef = useRef();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef();
  const [showGoogleConfigModal, setShowGoogleConfigModal] = useState(false);
  const [googleConfigStatus, setGoogleConfigStatus] = useState(null);
  const [googleAccessToken, setGoogleAccessToken] = useState(localStorage.getItem('google_access_token') || null);
  const [sidebarTooltip, setSidebarTooltip] = useState({ show: false, text: '', top: 0 });
  let sidebarTooltipTimeout = null;

  // Check if user is admin
  const isAdmin = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role === 'admin';
    } catch {
      return false;
    }
  };

  // Handle URL parameter changes
  useEffect(() => {
    const view = searchParams.get('view');
    if (view && ['modules', 'roles', 'users', 'permissions'].includes(view)) {
      setSelectedView(view);
    }
  }, [searchParams]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle profile dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle sidebar tooltip
  const handleSidebarItemHover = (item, event) => {
    if (!sidebarOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      setSidebarTooltip({
        show: true,
        text: item.label,
        top: rect.top + window.scrollY
      });
    }
  };

  const handleSidebarItemLeave = () => {
    if (sidebarTooltipTimeout) {
      clearTimeout(sidebarTooltipTimeout);
    }
    sidebarTooltipTimeout = setTimeout(() => {
      setSidebarTooltip({ show: false, text: '', top: 0 });
    }, 100);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  const renderContent = () => {
    switch (selectedView) {
      case 'modules':
        return <ModulesManagement />;
      case 'roles':
        return <RolesManagement />;
      default:
        return <ModulesManagement />;
    }
  };

  return (
    <>
      <style>{materialIconsStyle}</style>
      <style>{`
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
      <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
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
          padding: '0 28px',
          justifyContent: 'flex-end',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            }}>DataLynkr</span>
          </div>
          <div ref={profileDropdownRef} style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto', position: 'relative' }}>
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 10, 
                cursor: 'pointer',
                padding: '6px 12px',
                borderRadius: '10px',
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
              <span className="material-icons profile-icon" style={{ color: '#fff', fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>account_circle</span>
              <span className="profile-name" style={{ color: '#fff', fontWeight: 600, fontSize: '15px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{name || 'User'}</span>
              <span className="material-icons" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '20px', transition: 'transform 0.3s ease', transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
            </div>
            <button 
              className="logout-btn" 
              title="Logout" 
              style={{ 
                background: 'rgba(220, 38, 38, 0.15)', 
                color: '#fff', 
                border: '1px solid rgba(220, 38, 38, 0.3)', 
                marginRight: 0, 
                minWidth: 110,
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
              Logout
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
              onClick={() => navigate('/admin-dashboard')}
              style={{
                color: '#fff',
                background: 'transparent',
                textDecoration: 'none',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '8px',
                fontWeight: 500,
                margin: '0 8px',
                border: '1px solid transparent',
                cursor: 'pointer',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                position: 'relative',
              }}
              title="Home"
              onMouseEnter={e => {
                if (!sidebarOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSidebarTooltip({ show: true, text: 'Home', top: rect.top + window.scrollY });
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
              onClick={() => navigate('/admin-dashboard')}
              style={{
                color: '#fff',
                background: 'transparent',
                textDecoration: 'none',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '8px',
                fontWeight: 500,
                margin: '0 8px',
                border: '1px solid transparent',
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
            
            <a
              href="#"
              onClick={() => navigate('/admin-dashboard')}
              style={{
                color: '#fff',
                background: 'transparent',
                textDecoration: 'none',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                borderRadius: '8px',
                fontWeight: 500,
                margin: '0 8px',
                border: '1px solid transparent',
                cursor: 'pointer',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                position: 'relative',
              }}
              title="Create Access"
              onMouseEnter={e => {
                if (!sidebarOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setSidebarTooltip({ show: true, text: 'Create Access', top: rect.top + window.scrollY });
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
              <span className="material-icons" style={{ fontSize: 22 }}>person_add</span>
              {sidebarOpen && <span className="sidebar-link-label">Create Access</span>}
            </a>

            {/* Access Control Dropdown */}
            <div style={{ position: 'relative' }}>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  color: '#ff9800',
                  background: 'rgba(255,152,0,0.08)',
                  textDecoration: 'none',
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: '8px',
                  fontWeight: 700,
                  margin: '0 8px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
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
              {sidebarOpen && (
                <div style={{
                  marginLeft: '16px',
                  marginTop: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '8px 0',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  {SIDEBAR_ITEMS.map(item => (
                    <a
                      key={item.key}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedView(item.key);
                        navigate(`/access-control?view=${item.key}`, { replace: true });
                      }}
                      style={{
                        color: selectedView === item.key ? '#ff9800' : '#fff',
                        background: selectedView === item.key ? 'rgba(255,152,0,0.1)' : 'transparent',
                        textDecoration: 'none',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        borderRadius: '6px',
                        fontWeight: selectedView === item.key ? 600 : 400,
                        margin: '0 8px',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedView !== item.key) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedView !== item.key) {
                          e.target.style.background = 'transparent';
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
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'fixed',
            top: '80px',
            left: sidebarOpen ? '200px' : '40px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #e2e8f0',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'left 0.3s',
            boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
          }}
        >
          <span className="material-icons" style={{ fontSize: 18, color: '#64748b' }}>
            {sidebarOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>

        {/* Main Content */}
        <main
          className="adminhome-main"
          style={{
            marginLeft: sidebarOpen ? '220px' : '60px',
            transition: 'margin-left 0.3s',
            padding: '20px',
            minHeight: 'calc(100vh - 64px)',
            marginTop: '64px',
          }}
        >
          {renderContent()}
        </main>

        {/* Sidebar Tooltip */}
        {sidebarTooltip.show && !sidebarOpen && (
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: sidebarTooltip.top,
              background: '#1e40af',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.15)',
            }}
          >
            {sidebarTooltip.text}
          </div>
        )}
      </div>
    </>
  );
}

export default AccessControl;