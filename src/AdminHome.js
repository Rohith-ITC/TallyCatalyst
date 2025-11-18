import React, { useState, useEffect } from 'react';
import TallyLogo from './DLlogo.png';
import tallyConfig from './tallyConfig.json';
import { getApiUrl, API_CONFIG } from './config';
import './AdminHomeResponsive.css';

function AdminHome({ onLogout, onShowTallyConfig }) {
  const [showTallyConfig, setShowTallyConfig] = useState(false);
  const [ipAddress, setIpAddress] = useState('');
  const [portNumber, setPortNumber] = useState('');
  const [savedConfig, setSavedConfig] = useState(tallyConfig);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sidebar width
  const sidebarWidth = sidebarOpen ? 220 : 60;

  // Load saved configuration from localStorage or fallback to tallyConfig.json
  useEffect(() => {
    const storedConfig = localStorage.getItem('tallyConfig');
    if (storedConfig) {
      setSavedConfig(JSON.parse(storedConfig));
    } else {
      setSavedConfig(tallyConfig);
    }
  }, []);

  // Update input fields when savedConfig changes
  useEffect(() => {
    setIpAddress(savedConfig.ipAddress || '');
    setPortNumber(savedConfig.portNumber || '');
  }, [savedConfig]);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const handleTallyConfig = () => {
    setShowTallyConfig(true);
    if (onShowTallyConfig) onShowTallyConfig(true);
  };

  const handleBack = () => {
    setShowTallyConfig(false);
    if (onShowTallyConfig) onShowTallyConfig(false);
    setErrors({});
    setShowSuccess(false);
  };

  const validateForm = () => {
    const newErrors = {};
    
    // IP Address/Hostname validation
    if (!ipAddress.trim()) {
      newErrors.ipAddress = 'IP Address or Hostname is required';
    } else {
      const hostname = ipAddress.trim();
      
      // Check for localhost
      if (hostname === 'localhost') {
        // localhost is valid
      }
      // Check for IP address format
      else if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(hostname)) {
        // Valid IP address format
      }
      // Check for domain name format
      else if (/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(hostname)) {
        // Valid domain name format
      }
      else {
        newErrors.ipAddress = 'Please enter a valid IP address, localhost, or domain name';
      }
    }
    
    // Port Number validation
    if (!portNumber.trim()) {
      newErrors.portNumber = 'Port Number is required';
    } else if (!/^\d+$/.test(portNumber)) {
      newErrors.portNumber = 'Port must be a number';
    } else if (parseInt(portNumber) < 1 || parseInt(portNumber) > 65535) {
      newErrors.portNumber = 'Port must be between 1 and 65535';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const payload = {
        ip: ipAddress.trim(),
        port: portNumber.trim()
      };

      const apiUrl = getApiUrl(API_CONFIG.ENDPOINTS.TALLY_CHECK_CONNECTION);
      
      // Debug logging
      console.log('🔍 API Debug Info:');
      console.log('URL:', apiUrl);
      console.log('Payload:', payload);
      console.log('Config:', API_CONFIG);
      
      // Fallback URL for development if proxy doesn't work
      const fallbackUrl = process.env.NODE_ENV === 'development' && !apiUrl.startsWith('http') 
        ? `http://v63094.12105.tallyprimecloud.in:3001${API_CONFIG.ENDPOINTS.TALLY_CHECK_CONNECTION}`
        : apiUrl;

              const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 Response Status:', response.status);
      console.log('📡 Response Headers:', response.headers);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📡 Response Data:', data);

      if (data.status === 'success' || data.success) {
        // Save configuration to JSON file (in a real app, this would be handled by the backend)
        const newConfig = {
          ipAddress: ipAddress.trim(),
          portNumber: portNumber.trim()
        };
        
        // Update the saved config state
        setSavedConfig(newConfig);
        // Persist to localStorage
        localStorage.setItem('tallyConfig', JSON.stringify(newConfig));
        
        // Show success message
        setShowSuccess(true);
        
        // Hide success message and close config after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
          setShowTallyConfig(false);
          if (onShowTallyConfig) onShowTallyConfig(false);
        }, 3000);
      } else {
        // Handle API error
        const errorMessage = data.message || 'Unable to connect to Tally server';
        console.error('❌ API Error Response:', data);
        alert('Connection failed: ' + errorMessage);
      }
    } catch (error) {
      console.error('❌ API Error:', error);
      console.error('❌ Error Details:', {
        message: error.message,
        stack: error.stack,
        config: API_CONFIG
      });
      alert('Connection failed: Unable to reach the server. Please check if the backend is running on ' + API_CONFIG.BASE_URL);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setIpAddress('');
    setPortNumber('');
    setErrors({});
  };

  const handleInputChange = (field, value) => {
    if (field === 'ipAddress') {
      setIpAddress(value);
    } else if (field === 'portNumber') {
      setPortNumber(value);
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="adminhome-container" style={{ minHeight: '100vh', display: 'flex', background: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)' }}>
      <style>{`
        .sidebar-animated {
          width: ${sidebarWidth}px;
          min-width: ${sidebarWidth}px;
          max-width: ${sidebarWidth}px;
          transition: width 0.3s, min-width 0.3s, max-width 0.3s;
          overflow-x: hidden;
          z-index: 100;
        }
        .sidebar-toggle-btn {
          position: absolute;
          top: 18px;
          right: -20px;
          z-index: 2000;
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px 0 rgba(31,38,135,0.08);
          cursor: pointer;
          transition: right 0.3s;
        }
        .sidebar-logo {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: ${sidebarOpen ? 'center' : 'center'};
          margin-bottom: 40px;
          transition: all 0.3s;
        }
        .sidebar-logo img {
          width: ${sidebarOpen ? 120 : 40}px;
          height: ${sidebarOpen ? 120 : 40}px;
          object-fit: contain;
          margin: 0 auto;
          transition: width 0.3s, height 0.3s;
        }
        .sidebar-menu-label {
          display: ${sidebarOpen ? 'block' : 'none'};
          font-size: 13px;
          color: #cbd5e1;
          margin: 0 0 12px 24px;
          letter-spacing: 1px;
        }
        .sidebar-link-label {
          display: ${sidebarOpen ? 'inline' : 'none'};
          transition: display 0.3s;
        }
      `}</style>
      {/* Sidebar */}
      <aside className={`adminhome-sidebar sidebar-animated`}>
        <div className="sidebar-logo">
          <img src={TallyLogo} alt="Tally Logo" />
        </div>
        <div className="sidebar-menu-label">MENU</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 18, fontSize: 17 }}>
          <a
            href="#"
            onClick={() => setShowTallyConfig(false)}
            style={{
              color: !showTallyConfig ? '#ff9800' : '#fff',
              background: !showTallyConfig ? 'rgba(255,152,0,0.08)' : 'transparent',
              textDecoration: 'none',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: '8px',
              fontWeight: !showTallyConfig ? 700 : 500,
              margin: '0 8px',
              transition: 'all 0.2s ease',
              border: !showTallyConfig ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}
          >
            <span className="material-icons" style={{ fontSize: 22 }}>dashboard</span>
            <span className="sidebar-link-label">Dashboard</span>
          </a>
          <a
            href="#"
            onClick={() => setShowTallyConfig(true)}
            style={{
              color: showTallyConfig ? '#ff9800' : '#fff',
              background: showTallyConfig ? 'rgba(255,152,0,0.08)' : 'transparent',
              textDecoration: 'none',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              borderRadius: '8px',
              fontWeight: showTallyConfig ? 700 : 500,
              margin: '0 8px',
              transition: 'all 0.2s ease',
              border: showTallyConfig ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
              cursor: 'pointer',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}
          >
            <span className="material-icons" style={{ fontSize: 22 }}>settings</span>
            <span className="sidebar-link-label">Tally Configuration</span>
          </a>
        </nav>
        {/* Sidebar Toggle Button */}
        <button
          className="sidebar-toggle-btn"
          style={{ right: -20 }}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <span className="material-icons" style={{ fontSize: 22, color: '#1e40af' }}>{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
        </button>
      </aside>
      {/* Main Content */}
      <main className="adminhome-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, minWidth: 0, marginLeft: 0, transition: 'margin 0.3s' }}>
        {showTallyConfig ? (
          <div className="tally-config-card">
            {/* Success Message */}
            {showSuccess && (
              <div style={{
                position: 'absolute',
                top: '-60px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#10b981',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>check_circle</span>
                Configuration saved successfully!
              </div>
            )}

            <button
              onClick={handleBack}
              style={{
                position: 'absolute',
                top: 20,
                right: 20,
                background: 'rgba(100, 116, 139, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '20px',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(100, 116, 139, 0.2)';
                e.target.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(100, 116, 139, 0.1)';
                e.target.style.color = '#64748b';
              }}
            >
              ×
            </button>

            <div style={{ marginBottom: '40px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)',
              }}>
                <span className="material-icons" style={{ fontSize: '28px', color: '#fff' }}>settings</span>
              </div>
              <h2 style={{ 
                color: '#1e293b', 
                fontWeight: '700', 
                marginBottom: '8px',
                fontSize: '28px',
              }}>
                Tally Configuration
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '14px',
                margin: '0',
                lineHeight: '1.5',
              }}>
                Configure your Tally server connection settings
              </p>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#334155', 
                fontWeight: '600', 
                textAlign: 'left', 
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#3b82f6' }}>router</span>
                IP Address or Hostname
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                placeholder="localhost, 192.168.1.100, or example.com"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: errors.ipAddress ? '2px solid #ef4444' : '2px solid #e2e8f0',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.ipAddress ? '#ef4444' : '#3b82f6';
                  e.target.style.backgroundColor = '#fff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.ipAddress ? '#ef4444' : '#e2e8f0';
                  e.target.style.backgroundColor = '#f8fafc';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {errors.ipAddress && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>error</span>
                  {errors.ipAddress}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '40px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                color: '#334155', 
                fontWeight: '600', 
                textAlign: 'left', 
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px', color: '#3b82f6' }}>settings_ethernet</span>
                Port Number
              </label>
              <input
                type="text"
                value={portNumber}
                onChange={(e) => handleInputChange('portNumber', e.target.value)}
                placeholder="9000"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: errors.portNumber ? '2px solid #ef4444' : '2px solid #e2e8f0',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#f8fafc',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.portNumber ? '#ef4444' : '#3b82f6';
                  e.target.style.backgroundColor = '#fff';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.portNumber ? '#ef4444' : '#e2e8f0';
                  e.target.style.backgroundColor = '#f8fafc';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {errors.portNumber && (
                <div style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginTop: '6px',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <span className="material-icons" style={{ fontSize: '14px' }}>error</span>
                  {errors.portNumber}
                </div>
              )}
            </div>

            <div className="tally-config-btn-group">
              <button
                onClick={handleClear}
                disabled={isLoading}
                style={{
                  padding: '14px 28px',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#e2e8f0';
                    e.target.style.borderColor = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#f1f5f9';
                    e.target.style.borderColor = '#e2e8f0';
                  }
                }}
              >
                <span className="material-icons" style={{ fontSize: '16px' }}>clear</span>
                Clear
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading}
                style={{
                  padding: '14px 28px',
                  background: isLoading ? '#94a3b8' : '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: isLoading ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#2563eb';
                    e.target.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.target.style.background = '#3b82f6';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '16px' }}>save</span>
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              margin: '0 auto 24px',
            }}>
              <div className="tally-logo" style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', borderRadius: '50%', border: '2px dashed #cbd5e1' }}>
                <span className="material-icons" style={{ fontSize: '48px', color: '#94a3b8' }}>dashboard</span>
              </div>
            </div>
            <h3 style={{
              color: '#334155',
              fontWeight: '600',
              marginBottom: '8px',
              fontSize: '20px',
            }}>
              Welcome, {sessionStorage.getItem('name') || 'Admin'}!
            </h3>
            <p style={{
              color: '#64748b',
              fontSize: '14px',
              margin: '0',
              lineHeight: '1.5',
            }}>
              This is your admin dashboard. More features coming soon...
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminHome; 