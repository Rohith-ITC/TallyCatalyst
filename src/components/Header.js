import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Logo Section Component
 */
const LogoSection = ({ logo, brandText }) => {
  if (brandText) {
    // Admin dashboard style with logo + text
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img 
          src={logo.src} 
          alt={logo.alt || 'Logo'} 
          style={{ 
            height: logo.height || 50, 
            width: logo.width || 'auto', 
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' 
          }} 
        />
        <span style={{ 
          color: '#fff', 
          fontWeight: 700, 
          fontSize: 24, 
          letterSpacing: 0.5, 
          textShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {brandText}
        </span>
      </div>
    );
  }
  
  // Tally dashboard style - logo only
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: logo.width || '50px',
    }}>
      <img
        src={logo.src}
        alt={logo.alt || 'Logo'}
        style={{
          width: logo.width || '50px',
          height: logo.height || 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
          display: 'block',
        }}
      />
    </div>
  );
};

/**
 * Company Selector Component
 */
const CompanySelector = ({ 
  allConnections, 
  selectedCompanyGuid, 
  onCompanyChange,
  setSelectedCompanyGuid 
}) => {
  const [topBarCompanyDropdownOpen, setTopBarCompanyDropdownOpen] = useState(false);
  const [topBarCompanySearchTerm, setTopBarCompanySearchTerm] = useState('');
  const [filteredTopBarCompanies, setFilteredTopBarCompanies] = useState([]);
  const [isSelectingCompany, setIsSelectingCompany] = useState(false);

  // Filter companies based on search term
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

  // Show all companies when dropdown opens
  useEffect(() => {
    if (topBarCompanyDropdownOpen && !topBarCompanySearchTerm.trim()) {
      if (allConnections.length < 100) {
        setFilteredTopBarCompanies(allConnections);
      } else {
        setFilteredTopBarCompanies([]);
      }
    }
  }, [topBarCompanyDropdownOpen, topBarCompanySearchTerm, allConnections]);

  const currentCompany = useMemo(() => {
    if (!selectedCompanyGuid) return null;
    const selectedCompanyTallylocId = sessionStorage.getItem('selectedCompanyTallylocId');
    // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
    return allConnections.find(c => 
      c.guid === selectedCompanyGuid && 
      (selectedCompanyTallylocId ? String(c.tallyloc_id) === String(selectedCompanyTallylocId) : true)
    );
  }, [allConnections, selectedCompanyGuid]);

  const handleCompanySelect = (companyOption) => {
    setIsSelectingCompany(true);
    if (onCompanyChange) {
      onCompanyChange(companyOption);
    }
    setTopBarCompanyDropdownOpen(false);
    setTopBarCompanySearchTerm('');
    setIsSelectingCompany(false);
  };

  const handleClearCompany = () => {
    setSelectedCompanyGuid('');
    setTopBarCompanySearchTerm('');
    setTopBarCompanyDropdownOpen(false);
    if (allConnections.length < 100) {
      setFilteredTopBarCompanies(allConnections);
    }
  };

  return (
    <div style={{
      flex: '1 1 auto',
      minWidth: 0,
      maxWidth: '400px',
      position: 'relative',
    }}>
      <div style={{
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: 600,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        Company
      </div>
      <div style={{
        position: 'relative',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        border: topBarCompanyDropdownOpen ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.12)',
        transition: 'all 0.2s ease',
      }}>
        <input
          value={selectedCompanyGuid ? (currentCompany ? currentCompany.company : '') : topBarCompanySearchTerm}
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
            padding: '8px 32px 8px 12px',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#fff',
            outline: 'none',
            background: 'transparent',
            cursor: 'text',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxSizing: 'border-box',
          }}
          placeholder="Select Company..."
          title={selectedCompanyGuid && currentCompany ? `${currentCompany.company} [${currentCompany.access_type}]` : ''}
        />

        {!selectedCompanyGuid && (
          <span
            className="material-icons"
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '18px',
              pointerEvents: 'none'
            }}
          >
            {topBarCompanyDropdownOpen ? 'expand_less' : 'expand_more'}
          </span>
        )}

        {selectedCompanyGuid && (
          <button
            type="button"
            onClick={handleClearCompany}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: '50%',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '16px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear company"
          >
            ×
          </button>
        )}

        {topBarCompanyDropdownOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            maxHeight: '280px',
            overflowY: 'auto',
            zIndex: 9999,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
          }}>
            {filteredTopBarCompanies.map((companyOption, index) => (
              <div
                key={`${companyOption.tallyloc_id || 'na'}-${companyOption.guid || 'na'}-${index}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCompanySelect(companyOption);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                style={{
                  padding: '10px 12px',
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
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {companyOption.company}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '2px'
                }}>
                  {companyOption.access_type || 'N/A'}
                </div>
              </div>
            ))}

            {filteredTopBarCompanies.length > 0 && (
              <div style={{
                padding: '6px 12px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '11px',
                fontStyle: 'italic',
                borderTop: '1px solid #f1f5f9',
                backgroundColor: '#f8fafc'
              }}>
                {filteredTopBarCompanies.length} company{filteredTopBarCompanies.length !== 1 ? 's' : ''} available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Control Buttons Component (Control Panel & Refresh)
 */
const ControlButtons = ({ onControlPanelClick, onRefreshClick }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onControlPanelClick) onControlPanelClick();
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s ease',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 500,
        }}
        title="Control Panel"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
        }}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>admin_panel_settings</span>
        <span>Control Panel</span>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onRefreshClick) onRefreshClick();
        }}
        style={{
          background: 'rgba(255, 255, 255, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.2s ease',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 500,
        }}
        title="Refresh"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
        }}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>refresh</span>
        <span>Refresh</span>
      </button>
    </div>
  );
};

/**
 * Profile Dropdown Component
 */
const ProfileDropdown = ({ 
  profileRef,
  name, 
  email, 
  profileDropdownOpen, 
  setProfileDropdownOpen,
  navigate,
  onGoogleConfigClick,
  isAdmin 
}) => {
  const isTallyDashboard = navigate && typeof navigate === 'function';
  const profileIconSize = isTallyDashboard ? '24px' : '28px';
  const profileNameSize = isTallyDashboard ? '13px' : '15px';
  const showEmail = isTallyDashboard;

  return (
    <div ref={profileRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isTallyDashboard ? 8 : 10,
          cursor: 'pointer',
          padding: '6px 12px',
          borderRadius: isTallyDashboard ? '8px' : '10px',
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
        <span className="material-icons profile-icon" style={{ color: '#fff', fontSize: profileIconSize, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>account_circle</span>
        {isTallyDashboard ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
            <div className="profile-name" style={{ color: '#fff', fontWeight: 600, fontSize: profileNameSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px', textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{name || 'User'}</div>
            {showEmail && <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{email || ''}</div>}
          </div>
        ) : (
          <span className="profile-name" style={{ color: '#fff', fontWeight: 600, fontSize: profileNameSize, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{name || 'User'}</span>
        )}
        <span className="material-icons" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '20px', transition: 'transform 0.3s ease', transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
      </div>
      {profileDropdownOpen && (
        <div className="profile-dropdown" style={{
          position: 'absolute',
          top: isTallyDashboard ? 'calc(100% + 8px)' : '56px',
          right: 0,
          minWidth: isTallyDashboard ? 280 : 260,
          background: '#fff',
          borderRadius: isTallyDashboard ? 12 : 16,
          boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          padding: 20,
          zIndex: 4000,
          textAlign: 'left',
          animation: 'fadeIn 0.2s ease-out',
        }}
          onClick={(e) => e.stopPropagation()}
        >
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
                      marginBottom: (isAdmin && (typeof isAdmin === 'function' ? isAdmin() : isAdmin)) ? 10 : 0,
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
          {isAdmin && (typeof isAdmin === 'function' ? isAdmin() : isAdmin) && (
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
                if (onGoogleConfigClick) {
                  onGoogleConfigClick();
                  setProfileDropdownOpen(false);
                }
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
  );
};

/**
 * Logout Button Component
 */
const LogoutButton = ({ onLogout, isTallyDashboard = false }) => {
  const buttonStyle = isTallyDashboard ? {
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
    gap: 6,
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.2)',
  } : {
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
  };

  return (
    <button
      className="logout-btn"
      title="Logout"
      style={buttonStyle}
      onClick={onLogout}
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
  );
};

/**
 * Common Header Component for Admin and Tally Dashboards
 * 
 * @param {Object} props
 * @param {string} props.type - 'tally' | 'admin'
 * @param {boolean} props.isMobile - Whether the view is mobile
 * @param {number} props.zIndex - Z-index for the header (default: 1000)
 * @param {Object} props.logo - Logo config { src, alt, width, height }
 * @param {string} props.brandText - Brand text for admin dashboard
 * @param {boolean} props.showCompanySelector - Show company selector (TallyDashboard only)
 * @param {Object} props.companySelectorProps - { allConnections, selectedCompanyGuid, onCompanyChange, setSelectedCompanyGuid }
 * @param {boolean} props.showControlButtons - Show control buttons (TallyDashboard only)
 * @param {Object} props.controlButtonProps - { onControlPanelClick, onRefreshClick }
 * @param {boolean} props.showSubscriptionBadge - Show subscription badge (AdminDashboard only)
 * @param {React.ReactNode} props.subscriptionBadge - SubscriptionBadge component
 * @param {Object} props.profileProps - { name, email, profileDropdownOpen, setProfileDropdownOpen, navigate, onGoogleConfigClick, isAdmin, profileRef }
 * @param {Function} props.onLogout - Logout handler
 */
function Header({
  type = 'tally',
  isMobile = false,
  zIndex = 1000,
  logo = { src: '', alt: 'Logo' },
  brandText = null,
  showCompanySelector = false,
  companySelectorProps = {},
  showControlButtons = false,
  controlButtonProps = {},
  showSubscriptionBadge = false,
  subscriptionBadge = null,
  profileProps = {},
  onLogout = () => {}
}) {
  if (isMobile) {
    return null; // Header is hidden on mobile
  }

  const isTallyDashboard = type === 'tally';

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '70px',
        background: '#1e3a8a',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        zIndex: zIndex,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '20px',
      }}
    >
      {/* Left Section - Logo */}
      <LogoSection logo={logo} brandText={brandText} />

      {/* Center Section - Company Selector (TallyDashboard only) */}
      {showCompanySelector && isTallyDashboard && (
        <CompanySelector
          allConnections={companySelectorProps.allConnections || []}
          selectedCompanyGuid={companySelectorProps.selectedCompanyGuid}
          onCompanyChange={companySelectorProps.onCompanyChange}
          setSelectedCompanyGuid={companySelectorProps.setSelectedCompanyGuid}
        />
      )}

      {/* Spacer - Always push right section to the end */}
      <div style={{ flex: '1 1 auto' }} />

      {/* Right Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto' }}>
        {/* Control Buttons (TallyDashboard only) */}
        {showControlButtons && isTallyDashboard && (
          <ControlButtons
            onControlPanelClick={controlButtonProps.onControlPanelClick}
            onRefreshClick={controlButtonProps.onRefreshClick}
          />
        )}

        {/* Subscription Badge (AdminDashboard only) */}
        {showSubscriptionBadge && !isTallyDashboard && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {subscriptionBadge}
          </div>
        )}

        {/* Profile Dropdown */}
        <ProfileDropdown
          profileRef={profileProps.profileRef}
          name={profileProps.name}
          email={profileProps.email}
          profileDropdownOpen={profileProps.profileDropdownOpen}
          setProfileDropdownOpen={profileProps.setProfileDropdownOpen}
          navigate={profileProps.navigate}
          onGoogleConfigClick={profileProps.onGoogleConfigClick}
          isAdmin={profileProps.isAdmin}
        />

        {/* Logout Button */}
        <LogoutButton onLogout={onLogout} isTallyDashboard={isTallyDashboard} />
      </div>
    </header>
  );
}

export default Header;
