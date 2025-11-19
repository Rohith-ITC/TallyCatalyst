import React, { useState, useEffect } from 'react';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

function LinkAccount() {
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [googleConfigStatus, setGoogleConfigStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('google_access_token');
    if (token) {
      setGoogleAccessToken(token);
    }
  }, []);

  // Load Google Identity Services
  const loadGoogleIdentityServices = () => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setTimeout(() => {
          if (window.google && window.google.accounts) {
            resolve();
          } else {
            reject(new Error('Google Identity Services failed to load'));
          }
        }, 100);
      };
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.body.appendChild(script);
    });
  };

  // Handle Google authentication
  const handleGoogleAuth = async () => {
    try {
      setIsLoading(true);
      setGoogleConfigStatus(null);

      if (!isGoogleDriveFullyConfigured().configured) {
        setGoogleConfigStatus({ 
          type: 'error', 
          message: 'Google API credentials are not configured. Please configure REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY in your environment variables.' 
        });
        setIsLoading(false);
        return;
      }

      // Load Google Identity Services if not already loaded
      await loadGoogleIdentityServices();

      // Initialize token client
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
        scope: GOOGLE_DRIVE_CONFIG.SCOPES,
        callback: (response) => {
          setIsLoading(false);
          if (response.error) {
            setGoogleConfigStatus({ 
              type: 'error', 
              message: response.error_description || response.error || 'Authentication failed' 
            });
            return;
          }
          if (response.access_token) {
            setGoogleAccessToken(response.access_token);
            localStorage.setItem('google_access_token', response.access_token);
            localStorage.setItem('google_access_token_timestamp', Date.now().toString());
            setGoogleConfigStatus({ 
              type: 'success', 
              message: 'Google account connected successfully!' 
            });
          }
        },
      });

      // Request token - use empty prompt for silent refresh if token exists
      const existingToken = localStorage.getItem('google_access_token');
      tokenClient.requestAccessToken({ prompt: existingToken ? '' : 'consent' });
    } catch (error) {
      setIsLoading(false);
      setGoogleConfigStatus({ 
        type: 'error', 
        message: error.message || 'Failed to initialize Google authentication' 
      });
    }
  };

  // Handle disconnect
  const handleDisconnect = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_timestamp');
    setGoogleAccessToken(null);
    setGoogleConfigStatus({ 
      type: 'info', 
      message: 'Google account disconnected successfully.' 
    });
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '900px',
      margin: '0 auto',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        padding: '40px',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span className="material-icons" style={{ fontSize: '32px', color: '#3b82f6' }}>
            link
          </span>
          Link Account
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#64748b',
          marginBottom: '32px',
        }}>
          Connect your external accounts to enable additional features and integrations.
        </p>

        {/* Google Account Section */}
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(66, 133, 244, 0.25)',
              }}>
                <span className="material-icons" style={{ fontSize: '28px', color: '#fff' }}>
                  account_circle
                </span>
              </div>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '4px',
                }}>
                  Google Account
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#64748b',
                }}>
                  Connect your Google account to enable document upload and Google Drive integration
                </p>
              </div>
            </div>
            {googleAccessToken && (
              <div style={{
                padding: '6px 12px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#16a34a',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  check_circle
                </span>
                Connected
              </div>
            )}
          </div>

          {!isGoogleDriveFullyConfigured().configured && (
            <div style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              <span className="material-icons" style={{ fontSize: '18px', verticalAlign: 'middle', marginRight: '8px' }}>
                warning
              </span>
              Google Drive API credentials need to be configured in environment variables.
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            {!googleAccessToken ? (
              <button
                onClick={handleGoogleAuth}
                disabled={isLoading || !isGoogleDriveFullyConfigured().configured}
                style={{
                  padding: '12px 24px',
                  background: isLoading || !isGoogleDriveFullyConfigured().configured
                    ? '#e5e7eb'
                    : 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
                  color: isLoading || !isGoogleDriveFullyConfigured().configured
                    ? '#9ca3af'
                    : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: isLoading || !isGoogleDriveFullyConfigured().configured
                    ? 'not-allowed'
                    : 'pointer',
                  boxShadow: isLoading || !isGoogleDriveFullyConfigured().configured
                    ? 'none'
                    : '0 4px 12px 0 rgba(66,133,244,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.3s ease',
                  minWidth: '180px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && isGoogleDriveFullyConfigured().configured) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(66,133,244,0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && isGoogleDriveFullyConfigured().configured) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(66,133,244,0.25)';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <span className="material-icons" style={{ fontSize: '20px', animation: 'spin 1s linear infinite' }}>
                      refresh
                    </span>
                    Connecting...
                  </>
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: '20px' }}>
                      login
                    </span>
                    Link with Google
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '15px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px 0 rgba(239,68,68,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.3s ease',
                  minWidth: '180px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(239,68,68,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(239,68,68,0.25)';
                }}
              >
                <span className="material-icons" style={{ fontSize: '20px' }}>
                  link_off
                </span>
                Disconnect
              </button>
            )}
          </div>

          {googleConfigStatus && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: googleConfigStatus.type === 'success' 
                ? '#f0fdf4' 
                : googleConfigStatus.type === 'error'
                ? '#fef2f2'
                : '#eff6ff',
              border: `1px solid ${
                googleConfigStatus.type === 'success' 
                  ? '#86efac' 
                  : googleConfigStatus.type === 'error'
                  ? '#fecaca'
                  : '#bfdbfe'
              }`,
              color: googleConfigStatus.type === 'success' 
                ? '#16a34a' 
                : googleConfigStatus.type === 'error'
                ? '#dc2626'
                : '#2563eb',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>
                {googleConfigStatus.type === 'success' 
                  ? 'check_circle' 
                  : googleConfigStatus.type === 'error'
                  ? 'error'
                  : 'info'}
              </span>
              {googleConfigStatus.message}
            </div>
          )}

          {googleAccessToken && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>
                info
              </span>
              Your Google account is connected. Token expires after 1 hour of inactivity.
            </div>
          )}
        </div>

        {/* Placeholder for future account types */}
        <div style={{
          padding: '24px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '14px',
          fontStyle: 'italic',
        }}>
          More account linking options coming soon...
        </div>
      </div>
    </div>
  );
}

export default LinkAccount;

