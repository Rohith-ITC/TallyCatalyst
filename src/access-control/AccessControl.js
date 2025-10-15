import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TallyLogo from '../Tally1.png';
import '../AdminHomeResponsive.css';
import ModulesManagement from './ModulesManagement';
import RolesManagement from './RolesManagement';

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
  const [sidebarTooltip, setSidebarTooltip] = useState({ show: false, text: '', top: 0 });
  let sidebarTooltipTimeout = null;

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
      <div style={{ width: '100%', minHeight: '100vh', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
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
            top: '72px',
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
            minHeight: 'calc(100vh - 56px)',
            marginTop: '56px',
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