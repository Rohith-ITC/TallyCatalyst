import React from 'react';
import TallyLogo from '../DLrlogo.png';

/**
 * Mobile View Configuration Component for Admin Dashboard
 * Provides a hamburger menu for mobile devices with:
 * - Logo at the top
 * - Navigation items in the middle
 * - Profile and logout buttons at the bottom
 */
export const AdminMobileMenu = ({ 
  isOpen, 
  onClose, 
  sidebarItems,
  activeView,
  onViewChange,
  name,
  email,
  onProfileClick,
  onLogout,
  profileDropdownOpen,
  setProfileDropdownOpen,
  showGoogleConfigModal,
  setShowGoogleConfigModal,
  SubscriptionBadge,
  navigate
}) => {
  const [expandedItems, setExpandedItems] = React.useState({});
  
  const toggleExpand = (itemKey) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
  };
  
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.3s ease-out',
        }}
        onClick={onClose}
      />
      
      {/* Mobile Menu Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '280px',
          height: '100vh',
          background: 'linear-gradient(180deg, #1e3a8a 0%, #3b82f6 100%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.3)',
          animation: 'slideInLeft 0.3s ease-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10000,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span className="material-icons" style={{ color: '#fff', fontSize: '24px' }}>
            close
          </span>
        </button>

        {/* Logo Section - Top */}
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            flexShrink: 0,
          }}
        >
          <img 
            src={TallyLogo} 
            alt="Tally Logo" 
            style={{ 
              height: 40, 
              width: 'auto', 
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' 
            }} 
          />
          <span style={{ 
            color: '#fff', 
            fontWeight: 700, 
            fontSize: 20, 
            letterSpacing: 0.5, 
            textShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            DataLynkr
          </span>
        </div>

        {/* Navigation Tabs - Middle */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {sidebarItems.map((item) => {
            const isActive = activeView === item.key;
            const isExpanded = expandedItems[item.key];
            const hasSubItems = item.subItems && item.subItems.length > 0;
            
            return (
              <div key={item.key}>
                <button
                  onClick={() => {
                    if (hasSubItems) {
                      toggleExpand(item.key);
                    } else {
                      onViewChange(item.key);
                      onClose();
                    }
                  }}
                  style={{
                    background: isActive 
                      ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.25) 0%, rgba(255, 152, 0, 0.15) 100%)' 
                      : 'transparent',
                    color: isActive ? '#ff9800' : 'rgba(255, 255, 255, 0.95)',
                    border: isActive 
                      ? '1px solid rgba(255, 152, 0, 0.4)' 
                      : '1px solid transparent',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    borderRadius: '0',
                    fontWeight: isActive ? 700 : 600,
                    cursor: 'pointer',
                    fontSize: '15px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'left',
                    width: '100%',
                    borderLeft: isActive ? '5px solid #ff9800' : '5px solid transparent',
                    boxShadow: isActive 
                      ? 'inset 4px 0 12px rgba(255, 152, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)' 
                      : 'none',
                    position: 'relative',
                    margin: '2px 0',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = 'inset 0 0 20px rgba(255, 255, 255, 0.1), 0 2px 12px rgba(0, 0, 0, 0.15)';
                      e.currentTarget.style.borderLeft = '5px solid rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderLeft = '5px solid transparent';
                    }
                  }}
                >
                  {/* Active indicator glow */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      background: 'linear-gradient(180deg, #ff9800 0%, #ff6f00 100%)',
                      boxShadow: '0 0 12px rgba(255, 152, 0, 0.6)',
                    }} />
                  )}
                  
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: isActive 
                      ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.3) 0%, rgba(255, 152, 0, 0.2) 100%)' 
                      : 'rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.3s',
                    boxShadow: isActive 
                      ? '0 4px 12px rgba(255, 152, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                      : '0 2px 6px rgba(0, 0, 0, 0.2)',
                  }}>
                    <span 
                      className="material-icons" 
                      style={{ 
                        fontSize: 24, 
                        color: isActive ? '#ff9800' : 'rgba(255, 255, 255, 0.95)',
                        transition: 'all 0.3s',
                        filter: isActive ? 'drop-shadow(0 2px 4px rgba(255, 152, 0, 0.4))' : 'none',
                      }}
                    >
                      {item.icon}
                    </span>
                  </div>
                  
                  <span style={{ 
                    flex: 1, 
                    textAlign: 'left',
                    letterSpacing: '0.3px',
                    fontSize: '15px',
                    fontWeight: isActive ? 700 : 600,
                  }}>
                    {item.label}
                  </span>
                  
                  {hasSubItems && (
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: isExpanded 
                        ? 'rgba(255, 152, 0, 0.2)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s',
                    }}>
                      <span 
                        className="material-icons" 
                        style={{ 
                          fontSize: 20, 
                          color: isActive ? '#ff9800' : 'rgba(255, 255, 255, 0.8)',
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        expand_more
                      </span>
                    </div>
                  )}
                  
                  {isActive && !hasSubItems && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff9800 0%, #ff6f00 100%)',
                      boxShadow: '0 0 12px rgba(255, 152, 0, 0.8), 0 0 24px rgba(255, 152, 0, 0.4)',
                      animation: 'pulse 2s ease-in-out infinite',
                    }} />
                  )}
                </button>
                
                {/* Sub-items Dropdown */}
                {hasSubItems && isExpanded && (
                  <div style={{
                    background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.15) 100%)',
                    padding: '12px 0',
                    marginTop: '8px',
                    marginLeft: '20px',
                    marginRight: '12px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)',
                    overflow: 'hidden',
                  }}>
                    {item.subItems.map((subItem, index) => {
                      const isSubActive = activeView === subItem.key;
                      return (
                        <button
                          key={subItem.key}
                          onClick={() => {
                            onViewChange(subItem.key);
                            onClose();
                          }}
                          style={{
                            background: isSubActive 
                              ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.25) 0%, rgba(255, 152, 0, 0.15) 100%)' 
                              : 'transparent',
                            color: isSubActive ? '#ff9800' : 'rgba(255, 255, 255, 0.9)',
                            padding: '16px 20px 16px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            borderRadius: '8px',
                            fontWeight: isSubActive ? 700 : 500,
                            cursor: 'pointer',
                            fontSize: '14px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textAlign: 'left',
                            width: 'calc(100% - 16px)',
                            margin: '4px 8px',
                            borderLeft: isSubActive ? '4px solid #ff9800' : '4px solid transparent',
                            borderBottom: index < item.subItems.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                            position: 'relative',
                            boxShadow: isSubActive 
                              ? '0 2px 8px rgba(255, 152, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)' 
                              : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)';
                              e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
                              e.currentTarget.style.transform = 'translateX(6px) scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                              e.currentTarget.style.borderLeft = '4px solid rgba(255, 255, 255, 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSubActive) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                              e.currentTarget.style.transform = 'translateX(0) scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.borderLeft = '4px solid transparent';
                            }
                          }}
                        >
                          {/* Icon container */}
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isSubActive 
                              ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.3) 0%, rgba(255, 152, 0, 0.2) 100%)' 
                              : 'rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            transition: 'all 0.3s',
                            boxShadow: isSubActive 
                              ? '0 2px 8px rgba(255, 152, 0, 0.3)' 
                              : '0 1px 4px rgba(0, 0, 0, 0.2)',
                          }}>
                            <span 
                              className="material-icons" 
                              style={{ 
                                fontSize: 18, 
                                color: isSubActive ? '#ff9800' : 'rgba(255, 255, 255, 0.8)',
                                transition: 'all 0.3s',
                              }}
                            >
                              {subItem.icon}
                            </span>
                          </div>
                          
                          <span style={{ 
                            flex: 1, 
                            textAlign: 'left',
                            letterSpacing: '0.3px',
                            fontSize: '14px',
                          }}>
                            {subItem.label}
                          </span>
                          
                          {isSubActive && (
                            <div style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #ff9800 0%, #ff6f00 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 8px rgba(255, 152, 0, 0.5)',
                              flexShrink: 0,
                            }}>
                              <span 
                                className="material-icons" 
                                style={{ 
                                  fontSize: 14, 
                                  color: '#fff',
                                }}
                              >
                                check
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Profile and Logout Section - Bottom */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0,
            background: 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Subscription Badge */}
          {SubscriptionBadge && (
            <div style={{ marginBottom: '8px' }}>
              <SubscriptionBadge />
            </div>
          )}

          {/* Profile Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setProfileDropdownOpen(!profileDropdownOpen);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span className="material-icons" style={{ fontSize: 24 }}>
                account_circle
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{name || 'User'}</span>
                <span style={{ fontSize: '12px', opacity: 0.8 }}>{email || ''}</span>
              </div>
              <span className="material-icons" style={{ 
                fontSize: 20, 
                color: 'rgba(255, 255, 255, 0.8)', 
                transition: 'transform 0.3s ease', 
                transform: profileDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
              }}>
                expand_more
              </span>
            </button>

            {/* Profile Dropdown */}
            {profileDropdownOpen && (
              <div style={{ 
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '8px',
                background: '#fff', 
                borderRadius: 16, 
                boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.2), 0 0 0 1px rgba(0,0,0,0.05)', 
                padding: 20, 
                zIndex: 10000, 
                textAlign: 'left',
                animation: 'fadeIn 0.2s ease-out',
              }}>
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
                    navigate('/change-password');
                    onClose();
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
                  }} 
                  onClick={() => {
                    setShowGoogleConfigModal(true);
                    setProfileDropdownOpen(false);
                    onClose();
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 18 }}>account_circle</span>
                  Configure Google Account
                </button>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span className="material-icons" style={{ fontSize: 18 }}>
              logout
            </span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideInLeft {
            from { 
              transform: translateX(-100%);
            }
            to { 
              transform: translateX(0);
            }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
          }
        `}
      </style>
    </>
  );
};

/**
 * Hook to detect mobile view
 */
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

