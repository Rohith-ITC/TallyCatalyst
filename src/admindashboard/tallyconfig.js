import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPut } from '../utils/apiUtils';
import { getValidGoogleTokenFromConfigs, refreshGoogleTokenAndUpdateBackend, saveGoogleTokenToConfigs } from '../utils/googleDriveUtils';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';
import { isExternalUser } from '../utils/cacheUtils';
import { useIsMobile } from './MobileViewConfig';

function TallyConfig() {
  const isMobile = useIsMobile();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    ip: '', 
    port: '', 
    connectionName: '', 
    accessType: 'Tally' // Default to Tally
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [tableError, setTableError] = useState('');
  const token = sessionStorage.getItem('token');
  const [connectionCompanies, setConnectionCompanies] = useState({});
  const [companiesLoading, setCompaniesLoading] = useState(false);
  
  // Company Config Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [configCompanies, setConfigCompanies] = useState([]);
  const [activeConfigTab, setActiveConfigTab] = useState(0);
  const [configurations, setConfigurations] = useState({}); // { companyGuid: { configs: [], loading, error } }
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  
  // Link Account Modal State
  const [showLinkAccountModal, setShowLinkAccountModal] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState(null);
  const [googleUserDisplayName, setGoogleUserDisplayName] = useState(null);
  const [googleConfigStatus, setGoogleConfigStatus] = useState(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Fetch all connections
  const fetchConnections = async () => {
    setLoading(true);
    setTableError('');
    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/connections/all?ts=${cacheBuster}`);
      if (data && data.success) {
      setConnections(data.data.connections || []);
      } else if (data) {
        throw new Error(data.message || 'Failed to fetch connections');
      }
    } catch (err) {
      setTableError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchConnectionCompanies();
    // eslint-disable-next-line
  }, []);

  // Load existing Google token and email when modal opens or configurations change
  useEffect(() => {
    if (showLinkAccountModal && configCompanies.length > 0) {
      const activeCompany = configCompanies[activeConfigTab];
      if (activeCompany && configurations[activeCompany.guid]) {
        const companyConfig = configurations[activeCompany.guid];
        if (companyConfig && companyConfig.configs) {
          const displayNameConfig = companyConfig.configs.find(c => c.config_key === 'google_display_name');
          const tokenConfig = companyConfig.configs.find(c => c.config_key === 'google_token');
          
          // Load from configurations first (if saved)
          if (displayNameConfig && displayNameConfig.permission_value) {
            setGoogleUserDisplayName(displayNameConfig.permission_value);
          }
          
          if (tokenConfig && tokenConfig.permission_value) {
            // Validate and refresh token if needed
            const validateAndRefreshToken = async () => {
              try {
                const tallylocId = selectedConnection?.tallyloc_id || selectedConnection?.id;
                const coGuid = activeCompany.guid;
                
                if (tallylocId && coGuid) {
                  // Get valid token (will auto-refresh if expired)
                  const validToken = await getValidGoogleTokenFromConfigs(tallylocId, coGuid);
                  
                  if (validToken) {
                    setGoogleAccessToken(validToken);
                    localStorage.setItem('google_access_token', validToken);
                    localStorage.setItem('google_access_token_timestamp', Date.now().toString());
                    
                    // Fetch display name if not already stored
                    if (!displayNameConfig?.permission_value) {
                      try {
                        const displayName = await fetchGoogleUserDisplayName(validToken);
                        setGoogleUserDisplayName(displayName);
                        // Update the config object in state so it displays in the input field
                        setConfigurations(prev => {
                          const updated = { ...prev };
                          if (updated[coGuid] && updated[coGuid].configs) {
                            updated[coGuid] = {
                              ...updated[coGuid],
                              configs: updated[coGuid].configs.map(c => 
                                c.config_key === 'google_display_name' 
                                  ? { ...c, permission_value: displayName }
                                  : c
                              )
                            };
                          }
                          return updated;
                        });
                      } catch (err) {
                        console.warn('Could not fetch display name:', err);
                      }
                    }
                  } else {
                    // Token couldn't be refreshed - clear it
                    setGoogleAccessToken(null);
                    localStorage.removeItem('google_access_token');
                  }
                } else {
                  // Fallback: use stored token as-is (legacy support)
                  setGoogleAccessToken(tokenConfig.permission_value);
                  localStorage.setItem('google_access_token', tokenConfig.permission_value);
                }
              } catch (error) {
                console.error('Error validating/refreshing token:', error);
                // Fallback to stored token
                setGoogleAccessToken(tokenConfig.permission_value);
              }
            };
            
            validateAndRefreshToken();
          } else {
            // Fallback to localStorage if not in configs (legacy support)
            const token = localStorage.getItem('google_access_token');
            if (token) {
              setGoogleAccessToken(token);
              // Try to fetch display name, but don't show errors if token is expired
              fetchGoogleUserDisplayName(token).then(displayName => {
                if (displayName) {
                  // Update the config object in state if we have company info
                  const activeCompany = configCompanies[activeConfigTab];
                  if (activeCompany) {
                    setConfigurations(prev => {
                      const updated = { ...prev };
                      if (updated[activeCompany.guid] && updated[activeCompany.guid].configs) {
                        updated[activeCompany.guid] = {
                          ...updated[activeCompany.guid],
                          configs: updated[activeCompany.guid].configs.map(c => 
                            c.config_key === 'google_display_name' 
                              ? { ...c, permission_value: displayName }
                              : c
                          )
                        };
                      }
                      return updated;
                    });
                  }
                }
              }).catch(() => {
                // Silently handle - token might be expired
              });
            }
          }
        }
      }
    }
  }, [showLinkAccountModal, configurations, configCompanies, activeConfigTab, selectedConnection]);

  const fetchConnectionCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/tally/user-connections?ts=${cacheBuster}`);
      let companyList = [];

      if (Array.isArray(data)) {
        companyList = data;
      } else if (data) {
        const created = Array.isArray(data.createdByMe) ? data.createdByMe : [];
        const shared = Array.isArray(data.sharedWithMe) ? data.sharedWithMe : [];
        companyList = [...created, ...shared];
      }

      const grouped = {};
      companyList
        .filter(item => (item?.status || '').toLowerCase() === 'connected')
        .forEach(item => {
          const key = item.conn_name || item.connectionName || item.connection_name || item.name || '';
          if (!key) return;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push({
            guid: item.guid || `${key}-${item.company}`,
            company: item.company,
            accessType: item.access_type || item.accessType || 'Unknown',
            status: item.status,
            tallyloc_id: item.tallyloc_id
          });
        });

      setConnectionCompanies(grouped);
    } catch (error) {
      console.error('Failed to fetch connection companies:', error);
      setConnectionCompanies({});
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  // Handle form input
  const handleInput = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError('');
    setFormSuccess('');
  };

  // Create new connection
  const handleCreate = async e => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      const cacheBuster = Date.now();
      const data = await apiPost(`/api/tally/check-connection?ts=${cacheBuster}`, {
          ip: form.ip,
          port: form.port,
          connectionName: form.connectionName,
          accessType: form.accessType,
      });
      if (data && data.success) {
      setFormSuccess(data.message || 'Tally connection successful and saved');
      setForm({ ip: '', port: '', connectionName: '', accessType: 'Tally' });
      await fetchConnections();
      await fetchConnectionCompanies();
      } else if (data) {
        throw new Error(data.message || 'Tally connection failed');
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle connection status
  const handleToggle = async (id, isActive) => {
    try {
      const cacheBuster = Date.now();
      await apiPut(`/api/tally/connections/${id}?ts=${cacheBuster}`, {
        isActive: isActive
      });
      await fetchConnections();
      await fetchConnectionCompanies();
    } catch (err) {
      setTableError('Failed to update connection status');
    }
  };

  // Open configurations modal
  const handleOpenConfig = (connection) => {
    const connectionKey = connection.connectionName || connection.name || connection.conn_name || connection.ip || '';
    const companies = connectionCompanies[connectionKey] || [];
    
    if (companies.length === 0) {
      setTableError('No companies available for this connection');
      return;
    }

    setSelectedConnection(connection);
    setConfigCompanies(companies);
    setActiveConfigTab(0);
    setConfigurations({});
    setShowConfigModal(true);
    
    // Fetch configurations for all companies
    companies.forEach((company, index) => {
      fetchCompanyConfig(company, connection, index === 0);
    });
  };

  // Fetch company configurations
  const fetchCompanyConfig = async (company, connection, setFirst = false) => {
    const tallyloc_id = company.tallyloc_id || connection.tallyloc_id;
    if (!company.guid || !tallyloc_id) {
      setConfigurations(prev => ({
        ...prev,
        [company.guid]: { configs: [], loading: false, error: 'Missing company or connection information' }
      }));
      return;
    }

    setConfigurations(prev => ({
      ...prev,
      [company.guid]: { ...prev[company.guid], loading: true, error: null }
    }));

    try {
      const cacheBuster = Date.now();
      const data = await apiGet(`/api/cmpconfig/list?tallyloc_id=${tallyloc_id}&co_guid=${company.guid}&ts=${cacheBuster}`);
      
      console.log('🔍 Company Config API Response:', data);
      console.log('🔍 Response type:', typeof data);
      console.log('🔍 Is array:', Array.isArray(data));
      console.log('🔍 Has success:', data?.success);
      console.log('🔍 Has data:', !!data?.data);
      console.log('🔍 Has configurations:', !!data?.configurations);
      console.log('🔍 Keys:', data ? Object.keys(data) : 'null');
      
      // Handle different response structures
      let configs = [];
      let responseTallylocId = tallyloc_id;
      let responseCoGuid = company.guid;
      let responseCoName = company.company;
      
      if (data) {
        // Case 1: { success: true, data: [...] } - This is the actual structure from the API
        if (data.success && Array.isArray(data.data)) {
          configs = data.data;
          // Extract metadata from first config or use defaults
          if (configs.length > 0 && configs[0].tallyloc_id) {
            responseTallylocId = configs[0].tallyloc_id;
          }
          if (configs.length > 0 && configs[0].co_guid) {
            responseCoGuid = configs[0].co_guid;
          }
          if (configs.length > 0 && configs[0].co_name) {
            responseCoName = configs[0].co_name;
          }
        }
        // Case 2: { success: true, data: { configurations: [...], tallyloc_id, co_guid, co_name } }
        else if (data.success && data.data && !Array.isArray(data.data)) {
          configs = data.data.configurations || data.data.configs || [];
          responseTallylocId = data.data.tallyloc_id || tallyloc_id;
          responseCoGuid = data.data.co_guid || company.guid;
          responseCoName = data.data.co_name || company.company;
        }
        // Case 3: { data: [...] } without success flag
        else if (Array.isArray(data.data)) {
          configs = data.data;
        }
        // Case 4: { configurations: [...], tallyloc_id, co_guid, co_name }
        else if (data.configurations || data.configs) {
          configs = data.configurations || data.configs || [];
          responseTallylocId = data.tallyloc_id || tallyloc_id;
          responseCoGuid = data.co_guid || company.guid;
          responseCoName = data.co_name || company.company;
        }
        // Case 5: Direct array of configurations
        else if (Array.isArray(data)) {
          configs = data;
        }
        // Case 6: Try to extract from any nested structure
        else {
          configs = data.configurations || data.configs || data.list || [];
          responseTallylocId = data.tallyloc_id || tallyloc_id;
          responseCoGuid = data.co_guid || company.guid;
          responseCoName = data.co_name || company.company;
        }
      }
      
      // Use all configurations (no filtering)
      console.log('🔍 Extracted configs:', configs);
      console.log('🔍 Configs count:', configs.length);
      
      setConfigurations(prev => ({
        ...prev,
        [company.guid]: {
          configs: configs,
          loading: false,
          error: null,
          tallyloc_id: responseTallylocId,
          co_guid: responseCoGuid,
          co_name: responseCoName
        }
      }));
    } catch (error) {
      console.error('Error fetching company config:', error);
      setConfigurations(prev => ({
        ...prev,
        [company.guid]: {
          configs: [],
          loading: false,
          error: error.message || 'Failed to load configurations'
        }
      }));
    }
  };

  // Update configuration
  const handleConfigChange = (companyGuid, configId, field, value) => {
    setConfigurations(prev => {
      const companyConfig = prev[companyGuid] || { configs: [] };
      const updatedConfigs = companyConfig.configs.map(config => {
        // Match by either config_id or id
        if ((config.config_id === configId) || (config.id === configId)) {
          const updatedConfig = { ...config, [field]: value };
          
          // If updating permission_value, also update config_value to keep them in sync
          // This ensures both fields are available when reading back
          if (field === 'permission_value') {
            updatedConfig.config_value = value;
          }
          // If updating config_value, also update permission_value to keep them in sync
          else if (field === 'config_value') {
            updatedConfig.permission_value = value;
          }
          
          return updatedConfig;
        }
        return config;
      });
      
      return {
        ...prev,
        [companyGuid]: {
          ...companyConfig,
          configs: updatedConfigs
        }
      };
    });
  };

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

  // Track failed token attempts to avoid repeated calls
  const failedTokenAttempts = useRef(new Set());

  // Fetch Google user display name
  const fetchGoogleUserDisplayName = async (token) => {
    if (!token) {
      return null;
    }

    // Skip if we've already tried this token and it failed
    if (failedTokenAttempts.current.has(token)) {
      return null;
    }

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userInfo = await response.json();
        const displayName = userInfo.name || userInfo.displayName || userInfo.email || '';
        if (displayName) {
          setGoogleUserDisplayName(displayName);
          // Remove from failed attempts if it succeeds
          failedTokenAttempts.current.delete(token);
        }
        return displayName;
      } else if (response.status === 401) {
        // Token expired or invalid - mark it as failed and don't retry
        failedTokenAttempts.current.add(token);
        // Clear the invalid token from state
        setGoogleAccessToken(null);
        // Silently return - don't log warnings for expected token expiration
        return null;
      } else {
        // For other errors, don't mark as permanently failed (might be temporary)
        return null;
      }
    } catch (error) {
      // Network errors - don't mark as permanently failed
      return null;
    }
  };

  // Update Link Account configurations with Google data
  const updateLinkAccountConfigs = async (displayName, token, userEmail = null) => {
    if (!selectedConnection || configCompanies.length === 0) return;
    
    const activeCompany = configCompanies[activeConfigTab];
    if (!activeCompany) return;

    const companyConfig = configurations[activeCompany.guid];
    if (!companyConfig) return;

    const isExternal = isExternalUser();
    if (isExternal) {
      userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
      if (!userEmail) {
        console.error('External user but no email provided');
        setGoogleConfigStatus({ 
          type: 'error', 
          message: 'User email not found. Cannot save configuration.' 
        });
        return;
      }
    }

    // For external users, use saveGoogleTokenToConfigs which handles per-user tokens
    if (isExternal && token) {
      try {
        await saveGoogleTokenToConfigs(
          companyConfig.tallyloc_id,
          companyConfig.co_guid,
          token,
          displayName,
          userEmail
        );
        
        // Refresh configurations
        await fetchCompanyConfig(activeCompany, selectedConnection, false);
        setGoogleConfigStatus({ 
          type: 'success', 
          message: 'Google account linked and saved successfully!' 
        });
        return;
      } catch (error) {
        console.error('Error saving Link Account configs:', error);
        setGoogleConfigStatus({ 
          type: 'error', 
          message: error.message || 'Failed to save configurations' 
        });
        return;
      }
    }

    // For non-external users, use existing company-wide logic
    if (!companyConfig.configs) return;

    // Find google_display_name and google_token configs
    // If displayName/token is explicitly provided (even if empty string), use it; otherwise keep existing value
    const updatedConfigs = companyConfig.configs.map(config => {
      if (config.config_key === 'google_display_name') {
        return { ...config, permission_value: displayName !== undefined ? displayName : (config.permission_value || '') };
      }
      if (config.config_key === 'google_token') {
        return { ...config, permission_value: token !== undefined ? token : (config.permission_value || '') };
      }
      return config;
    });

    // Update state
    setConfigurations(prev => ({
      ...prev,
      [activeCompany.guid]: {
        ...companyConfig,
        configs: updatedConfigs
      }
    }));

    // Auto-save the configurations
    try {
      const payload = {
        tallyloc_id: companyConfig.tallyloc_id,
        co_guid: companyConfig.co_guid,
        co_name: companyConfig.co_name,
        configurations: updatedConfigs.map(config => {
          // Get the value - prioritize permission_value, fallback to config_value
          const value = config.permission_value || config.config_value || '';
          
          return {
            config_id: config.config_id || config.id,
            is_enabled: config.is_enabled === true || config.is_enabled === 1,
            permission_value: value,
            config_value: value // Also send config_value to ensure backend compatibility
          };
        })
      };

      console.log('💾 Auto-saving Link Account configurations:', {
        tallyloc_id: payload.tallyloc_id,
        co_guid: payload.co_guid,
        googleToken: updatedConfigs.find(c => c.config_key === 'google_token')?.permission_value ? '***' + updatedConfigs.find(c => c.config_key === 'google_token')?.permission_value.substring(updatedConfigs.find(c => c.config_key === 'google_token')?.permission_value.length - 10) : 'not set',
        googleEmail: updatedConfigs.find(c => c.config_key === 'google_email')?.permission_value || 'not set'
      });

      const data = await apiPost('/api/cmpconfig/update', payload);
      if (data && data.success) {
        // Refresh configurations
        await fetchCompanyConfig(activeCompany, selectedConnection, false);
        setGoogleConfigStatus({ 
          type: 'success', 
          message: 'Google account linked and saved successfully!' 
        });
      }
    } catch (error) {
      console.error('Error saving Link Account configs:', error);
      setGoogleConfigStatus({ 
        type: 'error', 
        message: 'Failed to save configurations' 
      });
    }
  };

  // Handle Google authentication
  const handleGoogleAuth = async (forceConsent = false) => {
    try {
      setIsGoogleLoading(true);
      setGoogleConfigStatus(null);

      if (!isGoogleDriveFullyConfigured().configured) {
        setGoogleConfigStatus({ 
          type: 'error', 
          message: 'Google API credentials are not configured. Please configure REACT_APP_GOOGLE_CLIENT_ID and REACT_APP_GOOGLE_API_KEY in your environment variables.' 
        });
        setIsGoogleLoading(false);
        return;
      }

      // Load Google Identity Services if not already loaded
      await loadGoogleIdentityServices();

      // Initialize token client
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
        scope: GOOGLE_DRIVE_CONFIG.SCOPES,
        callback: async (response) => {
          setIsGoogleLoading(false);
          if (response.error) {
            let errorMessage = response.error_description || response.error || 'Authentication failed';
            
            // Provide helpful message for redirect_uri_mismatch
            if (response.error === 'redirect_uri_mismatch' || errorMessage.includes('redirect_uri_mismatch')) {
              const currentOrigin = window.location.origin;
              errorMessage = `Redirect URI mismatch. Please add "${currentOrigin}" to Authorized JavaScript origins and Authorized redirect URIs in your Google Cloud Console OAuth 2.0 Client settings.`;
            }
            
            setGoogleConfigStatus({ 
              type: 'error', 
              message: errorMessage
            });
            return;
          }
          if (response.access_token) {
            setGoogleAccessToken(response.access_token);
            localStorage.setItem('google_access_token', response.access_token);
            localStorage.setItem('google_access_token_timestamp', Date.now().toString());
            
            // Fetch user display name and email
            const displayName = await fetchGoogleUserDisplayName(response.access_token);
            setGoogleUserDisplayName(displayName);
            
            // For external users, verify Google account email matches logged-in user email
            const isExternal = isExternalUser();
            if (isExternal) {
              try {
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                  headers: { 'Authorization': `Bearer ${response.access_token}` }
                });
                if (userInfoResponse.ok) {
                  const userInfo = await userInfoResponse.json();
                  const googleEmail = userInfo.email;
                  const loggedInEmail = sessionStorage.getItem('email');
                  
                  if (googleEmail && loggedInEmail && googleEmail.toLowerCase() !== loggedInEmail.toLowerCase()) {
                    setGoogleConfigStatus({ 
                      type: 'error', 
                      message: `Email mismatch. Please sign in with your registered email: ${loggedInEmail}. You signed in with: ${googleEmail}` 
                    });
                    setIsGoogleLoading(false);
                    return;
                  }
                }
              } catch (err) {
                console.error('Error verifying email:', err);
                setGoogleConfigStatus({ 
                  type: 'error', 
                  message: 'Failed to verify Google account email' 
                });
                setIsGoogleLoading(false);
                return;
              }
            }
            
            // Get user email for external users
            const userEmail = isExternal ? sessionStorage.getItem('email') : null;
            
            // Update configurations
            await updateLinkAccountConfigs(displayName, response.access_token, userEmail);
            
            // Also update the config object in state immediately so it displays in the input field
            const activeCompany = configCompanies[activeConfigTab];
            if (activeCompany) {
              setConfigurations(prev => {
                const updated = { ...prev };
                if (updated[activeCompany.guid] && updated[activeCompany.guid].configs) {
                  updated[activeCompany.guid] = {
                    ...updated[activeCompany.guid],
                    configs: updated[activeCompany.guid].configs.map(c => 
                      c.config_key === 'google_display_name' 
                        ? { ...c, permission_value: displayName || '' }
                        : c.config_key === 'google_token'
                        ? { ...c, permission_value: response.access_token }
                        : c
                    )
                  };
                }
                return updated;
              });
            }
            
            // Set up automatic token refresh (refresh 5 minutes before expiration)
            // This will be handled by the useEffect below
            
            setGoogleConfigStatus({ 
              type: 'success', 
              message: 'Google account connected successfully!' 
            });
          }
        },
      });

      // Request token - force consent if switching accounts, otherwise use silent refresh if token exists
      const existingToken = localStorage.getItem('google_access_token');
      const promptValue = forceConsent ? 'consent' : (existingToken ? '' : 'consent');
      tokenClient.requestAccessToken({ prompt: promptValue });
    } catch (error) {
      setIsGoogleLoading(false);
      setGoogleConfigStatus({ 
        type: 'error', 
        message: error.message || 'Failed to initialize Google authentication' 
      });
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      // Revoke the token on Google's side if it exists
      const token = localStorage.getItem('google_access_token');
      if (token && window.google && window.google.accounts) {
        try {
          window.google.accounts.oauth2.revoke(token, () => {
            console.log('Token revoked successfully');
          });
        } catch (err) {
          console.log('Token revocation error (non-critical):', err);
        }
      }
    } catch (err) {
      console.log('Error during token revocation:', err);
    }

    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_timestamp');
    setGoogleAccessToken(null);
    setGoogleUserDisplayName(null);
    
    // Clear configurations - explicitly pass empty strings to clear the values
    await updateLinkAccountConfigs('', '');
    
    // Refresh configurations to update the UI
    if (selectedConnection && configCompanies.length > 0) {
      const activeCompany = configCompanies[activeConfigTab];
      if (activeCompany) {
        await fetchCompanyConfig(activeCompany, selectedConnection, false);
      }
    }
    
    setGoogleConfigStatus({ 
      type: 'info', 
      message: 'Google account disconnected successfully. You can now link a different account.' 
    });
  };

  // Handle switch account - disconnect and immediately re-authenticate
  const handleSwitchAccount = async () => {
    // First disconnect
    const token = localStorage.getItem('google_access_token');
    if (token && window.google && window.google.accounts) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {
          console.log('Token revoked for account switch');
        });
      } catch (err) {
        console.log('Token revocation error (non-critical):', err);
      }
    }

    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_access_token_timestamp');
    setGoogleAccessToken(null);
    setGoogleUserDisplayName(null);
    
    // Clear configurations - explicitly pass empty strings to clear the values
    await updateLinkAccountConfigs('', '');
    
    // Refresh configurations to update the UI
    if (selectedConnection && configCompanies.length > 0) {
      const activeCompany = configCompanies[activeConfigTab];
      if (activeCompany) {
        await fetchCompanyConfig(activeCompany, selectedConnection, false);
      }
    }
    
    // Small delay to ensure cleanup
    setTimeout(() => {
      // Then immediately trigger new authentication with forced consent
      handleGoogleAuth(true);
    }, 300);
  };

  // Save configurations for a company
  const handleSaveConfig = async (companyGuid) => {
    const companyConfig = configurations[companyGuid];
    if (!companyConfig || !companyConfig.configs || companyConfig.configs.length === 0) {
      return;
    }

    setConfigSaving(true);
    try {
      const payload = {
        tallyloc_id: companyConfig.tallyloc_id,
        co_guid: companyConfig.co_guid,
        co_name: companyConfig.co_name,
        configurations: companyConfig.configs.map(config => {
          // Get the value - prioritize permission_value, fallback to config_value
          const value = config.permission_value || config.config_value || '';
          
          return {
            config_id: config.config_id || config.id, // Map id to config_id for API
            is_enabled: config.is_enabled === true || config.is_enabled === 1, // Convert to boolean
            permission_value: value,
            config_value: value // Also send config_value to ensure backend compatibility
          };
        })
      };

      console.log('💾 Saving configurations:', {
        tallyloc_id: payload.tallyloc_id,
        co_guid: payload.co_guid,
        configsCount: payload.configurations.length,
        googleTokenConfig: payload.configurations.find(c => c.config_id === (companyConfig.configs.find(cc => cc.config_key === 'google_token')?.config_id || companyConfig.configs.find(cc => cc.config_key === 'google_token')?.id))
      });

      const data = await apiPost('/api/cmpconfig/update', payload);
      
      if (data && data.success) {
        // Refresh the configurations
        // Match by both guid and tallyloc_id to handle companies with same guid but different tallyloc_id
        const company = configCompanies.find(c => 
          c.guid === companyGuid && 
          c.tallyloc_id === companyConfig.tallyloc_id
        );
        if (company) {
          await fetchCompanyConfig(
            company,
            selectedConnection,
            false
          );
        }
        setFormSuccess(`Configurations saved successfully for ${companyConfig.co_name}`);
        
        // Close the modal and return to Tally Connections tab
        setShowConfigModal(false);
        setActiveConfigTab(0);
      } else {
        throw new Error(data?.message || 'Failed to save configurations');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setFormError(error.message || 'Failed to save configurations');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tallyconfig-desktop-table {
          overflow-x: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        .tallyconfig-desktop-table table {
          table-layout: fixed !important;
          width: 100% !important;
        }
        .tallyconfig-desktop-table th,
        .tallyconfig-desktop-table td {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        @media (max-width: 700px) {
          body, html, #root, .adminhome-container {
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          .tallyconfig-mobile-form {
            flex-direction: column !important;
            gap: 16px !important;
            align-items: stretch !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .tallyconfig-mobile-form > div {
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin-right: 0 !important;
            margin-bottom: 0 !important;
            box-sizing: border-box !important;
            display: block !important;
            flex: 1 1 100% !important;
          }
          .tallyconfig-mobile-form button {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            margin-right: 0 !important;
            margin-bottom: 0 !important;
            box-sizing: border-box !important;
            flex: 1 1 100% !important;
          }
          .tallyconfig-mobile-form input,
          .tallyconfig-mobile-form select {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
            padding: 14px 16px !important;
            box-sizing: border-box !important;
          }
          .tallyconfig-mobile-form label {
            margin-bottom: 8px !important;
            font-size: 14px !important;
          }
          .tallyconfig-mobile-table, .tallyconfig-mobile-stacked-table {
            padding: 16px !important;
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }
          .tallyconfig-mobile-table table, .tallyconfig-mobile-stacked-table table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 13px !important;
            table-layout: fixed !important;
          }
          .tallyconfig-mobile-table th, .tallyconfig-mobile-table td,
          .tallyconfig-mobile-stacked-table th, .tallyconfig-mobile-stacked-table td {
            padding: 6px 2px !important;
            font-size: 13px !important;
            word-break: break-word !important;
            max-width: 80px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .tallyconfig-mobile-stacked-table th {
            white-space: normal !important;
            word-break: break-word !important;
            line-height: 1.2 !important;
          }
          .tallyconfig-mobile-stacked-table td {
            max-width: 90px !important;
          }
        }
      `}</style>
      <div style={{ 
        margin: '0 auto', 
        padding: isMobile ? '12px' : 0, 
        paddingTop: isMobile ? '72px' : 0,
        width: isMobile ? '100%' : '90vw', 
        maxWidth: 1200, 
        boxSizing: 'border-box' 
      }}>
        {/* Header Section */}
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'space-between', 
          marginBottom: isMobile ? 20 : 32, 
          marginTop: isMobile ? 0 : 50,
          gap: isMobile ? 16 : 0
        }}>
          <div style={{ width: isMobile ? '100%' : 'auto' }}>
            <h2 style={{ 
              color: '#1e40af', 
              fontWeight: 700, 
              fontSize: isMobile ? 20 : 28, 
              margin: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: isMobile ? 8 : 12,
              flexWrap: 'wrap'
            }}>
              <span className="material-icons" style={{ fontSize: isMobile ? 24 : 32, color: '#1e40af' }}>settings</span>
              <span>Tally Access Settings</span>
            </h2>
            <div style={{ color: '#64748b', fontSize: isMobile ? 13 : 16, marginTop: 4 }}>Manage Tally Server Connection</div>
          </div>
          <div style={{ 
            background: '#f0f9ff', 
            color: '#0369a1', 
            padding: isMobile ? '8px 14px' : '8px 16px', 
            borderRadius: 20, 
            fontSize: isMobile ? 12 : 14, 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'center' : 'flex-start',
            marginTop: isMobile ? 4 : 0
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? 16 : 18 }}>account_tree</span>
            {connections.length} connections configured
          </div>
        </div>
        {/* Create Connection Form */}
        <div style={{ 
          background: '#fff', 
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: isMobile ? 16 : 32, 
          marginBottom: isMobile ? 20 : 24, 
          width: '100%', 
          margin: '0 auto', 
          boxSizing: 'border-box' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: isMobile ? 20 : 24,
            paddingBottom: isMobile ? 12 : 16,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? 20 : 24, color: '#3b82f6' }}>add_circle</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: isMobile ? 18 : 20 }}>Create New Connection</h3>
        </div>
          <form onSubmit={handleCreate} className="tallyconfig-mobile-form" style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 16 : 16, 
            alignItems: isMobile ? 'stretch' : 'flex-end', 
            width: '100%' 
          }}>
            <div style={{ 
              flex: isMobile ? '1 1 100%' : '0.6', 
              minWidth: isMobile ? '100%' : 200, 
              width: isMobile ? '100%' : 'auto',
              marginRight: isMobile ? 0 : 2
            }}>
              <label style={{ 
                fontWeight: 600, 
                color: '#1e293b', 
                marginBottom: 8, 
                display: 'block',
                fontSize: isMobile ? 14 : 16
              }}>Tally Access Type</label>
              <select 
                name="accessType" 
                value={form.accessType} 
                onChange={() => {}}
                disabled
                style={{ 
                  padding: isMobile ? '14px 16px' : '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '100%', 
                  fontSize: isMobile ? 16 : 16, 
                  background: '#f1f5f9', 
                  marginBottom: 0,
                  cursor: 'not-allowed',
                  opacity: 0.8,
                  boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              >
                <option value="Tally">Tally</option>
              </select>
            </div>
            <div style={{ 
              flex: isMobile ? '1 1 100%' : '0.6', 
              minWidth: isMobile ? '100%' : 180, 
              width: isMobile ? '100%' : 'auto',
              marginRight: isMobile ? 0 : 12
            }}>
              <label style={{ 
                fontWeight: 600, 
                color: '#1e293b', 
                marginBottom: 8, 
                display: 'block',
                fontSize: isMobile ? 14 : 16
              }}>Site ID</label>
              <input 
                name="connectionName" 
                value={form.connectionName} 
                onChange={handleInput} 
                required 
                style={{ 
                  padding: isMobile ? '14px 16px' : '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '100%', 
                  fontSize: isMobile ? 16 : 16, 
                  background: '#f8fafc', 
                  marginBottom: 0,
                  boxSizing: 'border-box'
                }} 
                placeholder="Myoffice" 
              />
            </div>
            <div style={{ 
              flex: isMobile ? '1 1 100%' : '0.8', 
              minWidth: isMobile ? '100%' : 300, 
              width: isMobile ? '100%' : 'auto',
              marginRight: isMobile ? 0 : 12
            }}>
              <label style={{ 
                fontWeight: 600, 
                color: form.accessType === 'TallyDex' ? '#94a3b8' : '#1e293b', 
                marginBottom: 8, 
                display: 'block',
                fontSize: isMobile ? 14 : 16
              }}>IP Address or Hostname</label>
              <input 
                name="ip" 
                value={form.ip} 
                onChange={handleInput} 
                required={form.accessType !== 'TallyDex'}
                disabled={form.accessType === 'TallyDex'}
                style={{ 
                  padding: isMobile ? '14px 16px' : '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '100%', 
                  fontSize: isMobile ? 16 : 16, 
                  background: form.accessType === 'TallyDex' ? '#f1f5f9' : '#f8fafc', 
                  marginBottom: 0,
                  opacity: form.accessType === 'TallyDex' ? 0.6 : 1,
                  cursor: form.accessType === 'TallyDex' ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
                }} 
                placeholder={form.accessType === 'TallyDex' ? 'Not required for TallyDex' : '192.168.1.100 or example.com'} 
              />
            </div>
            <div style={{ 
              flex: isMobile ? '1 1 100%' : '0.4', 
              minWidth: isMobile ? '100%' : 90, 
              width: isMobile ? '100%' : 'auto',
              marginRight: isMobile ? 0 : 12
            }}>
              <label style={{ 
                fontWeight: 600, 
                color: form.accessType === 'TallyDex' ? '#94a3b8' : '#1e293b', 
                marginBottom: 8, 
                display: 'block',
                fontSize: isMobile ? 14 : 16
              }}>Port</label>
              <input 
                name="port" 
                value={form.port} 
                onChange={handleInput} 
                required={false}
                disabled={form.accessType === 'TallyDex'}
                style={{ 
                  padding: isMobile ? '14px 16px' : '12px 14px', 
                  borderRadius: 8, 
                  border: '1.5px solid #cbd5e1', 
                  width: '100%', 
                  fontSize: isMobile ? 16 : 16, 
                  background: form.accessType === 'TallyDex' ? '#f1f5f9' : '#f8fafc', 
                  marginBottom: 0,
                  opacity: form.accessType === 'TallyDex' ? 0.6 : 1,
                  cursor: form.accessType === 'TallyDex' ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
                }} 
                placeholder={form.accessType === 'TallyDex' ? 'Not required' : '9009'} 
              />
            </div>
            <button 
              type="submit" 
              disabled={formLoading} 
              style={{ 
                padding: isMobile ? '16px 24px' : '14px 24px', 
                background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 8, 
                fontWeight: 700, 
                fontSize: isMobile ? 16 : 16, 
                minWidth: isMobile ? '100%' : 140, 
                width: isMobile ? '100%' : 'auto',
                cursor: 'pointer', 
                opacity: formLoading ? 0.7 : 1, 
                boxShadow: '0 2px 8px 0 rgba(59,130,246,0.20)', 
                whiteSpace: 'nowrap',
                transition: 'transform 0.2s, box-shadow 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: isMobile ? 48 : 'auto',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                if (!formLoading) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px 0 rgba(59,130,246,0.30)';
                }
              }}
              onMouseLeave={(e) => {
                if (!formLoading) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 8px 0 rgba(59,130,246,0.20)';
                }
              }}
              onTouchStart={(e) => {
                if (!formLoading) {
                  e.currentTarget.style.transform = 'scale(0.98)';
                  e.currentTarget.style.opacity = '0.9';
                }
              }}
              onTouchEnd={(e) => {
                if (!formLoading) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.opacity = '1';
                }
              }}
            >
              <span className="material-icons" style={{ fontSize: isMobile ? 20 : 18 }}>
                {formLoading ? 'sync' : 'add'}
              </span>
              {formLoading ? 'Creating...' : 'Create Connection'}
            </button>
          </form>
          {/* Form Messages */}
          {formError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca',
              borderRadius: 8, 
              padding: isMobile ? 14 : 16, 
              marginTop: isMobile ? 14 : 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#dc2626', fontSize: isMobile ? 18 : 20, flexShrink: 0 }}>error</span>
              <div style={{ color: '#dc2626', fontSize: isMobile ? 13 : 14, fontWeight: 500, lineHeight: 1.5 }}>{formError}</div>
            </div>
          )}
          {formSuccess && (
            <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0',
              borderRadius: 8, 
              padding: isMobile ? 14 : 16, 
              marginTop: isMobile ? 14 : 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#16a34a', fontSize: isMobile ? 18 : 20, flexShrink: 0 }}>check_circle</span>
              <div style={{ color: '#16a34a', fontSize: isMobile ? 13 : 14, fontWeight: 500, lineHeight: 1.5 }}>{formSuccess}</div>
            </div>
          )}
                       {(form.accessType === 'TallyDex' || form.accessType === 'Tally+TallyDex') && (
              <div style={{ 
              background: '#f0fdf4', 
              border: '1px solid #bbf7d0',
              borderRadius: 8, 
              padding: isMobile ? 14 : 16, 
              marginTop: isMobile ? 14 : 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#16a34a', fontSize: isMobile ? 18 : 20, flexShrink: 0 }}>info</span>
              <div style={{ color: '#16a34a', fontSize: isMobile ? 13 : 14, fontWeight: 500, lineHeight: 1.5 }}>
                <strong>Note:</strong> TallyDex data will be stored in MySQLDB
              </div>
              </div>
            )}
         </div>

        <div style={{ height: isMobile ? 20 : 32 }} />

        {/* Connections Table */}
        <div className="tallyconfig-mobile-table" style={{ 
          background: '#fff', 
          borderRadius: 16, 
          boxShadow: '0 4px 24px 0 rgba(31,38,135,0.08)', 
          padding: isMobile ? 16 : 32, 
          marginTop: 0, 
          width: '100%', 
          margin: '0 auto', 
          minHeight: isMobile ? 'auto' : 360, 
          boxSizing: 'border-box',
          overflowX: 'hidden',
          maxWidth: '100%'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            marginBottom: isMobile ? 16 : 24,
            paddingBottom: isMobile ? 12 : 16,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <span className="material-icons" style={{ fontSize: isMobile ? 20 : 24, color: '#3b82f6' }}>list_alt</span>
            <h3 style={{ color: '#1e293b', fontWeight: 700, margin: 0, fontSize: isMobile ? 18 : 20 }}>Tally Connections</h3>
          </div>
          
          {/* Loading State */}
          {loading && (
            <div style={{ 
              textAlign: 'center', 
              padding: isMobile ? 40 : 60, 
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: 12,
              margin: isMobile ? '12px 0' : '16px 0'
            }}>
              <span className="material-icons" style={{ fontSize: isMobile ? 40 : 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
              <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 500 }}>Loading connections...</div>
            </div>
          )}

          {/* Error State */}
          {tableError && (
            <div style={{ 
              background: '#fef2f2', 
              border: '1px solid #fecaca',
              borderRadius: 8, 
              padding: isMobile ? 14 : 20, 
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}>
              <span className="material-icons" style={{ color: '#dc2626', fontSize: isMobile ? 20 : 24, flexShrink: 0 }}>error</span>
              <div style={{ color: '#dc2626', fontSize: isMobile ? 13 : 14, fontWeight: 500, lineHeight: 1.5 }}>{tableError}</div>
            </div>
          )}

          {/* Empty State */}
          {!loading && connections.length === 0 && !tableError && (
            <div style={{ 
              textAlign: 'center', 
              padding: isMobile ? 40 : 60, 
              color: '#64748b',
              background: '#f8fafc',
              borderRadius: 12,
              margin: isMobile ? '12px 0' : '16px 0'
            }}>
              <span className="material-icons" style={{ fontSize: isMobile ? 48 : 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>account_tree</span>
              <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600, marginBottom: 8 }}>No connections found</div>
              <div style={{ fontSize: isMobile ? 13 : 14 }}>Create your first connection above to get started</div>
            </div>
          )}

          {!loading && connections.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="tallyconfig-desktop-table" style={{ display: !isMobile ? 'block' : 'none', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '12%'
                      }}>Site ID</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '28%'
                      }}>IP Address</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '8%'
                      }}>Port</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '12%'
                      }}>Access Type</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '20%'
                      }}>Status</th>
                      <th style={{ 
                        padding: '10px 12px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#1e293b',
                        fontSize: 14,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '2px solid #e2e8f0',
                        width: '20%'
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((connection, idx) => {
                      const connectionKey = connection.connectionName || connection.name || connection.conn_name || connection.ip || '';
                      const activeCompanies = connectionCompanies[connectionKey] || [];
                      return (
                        <tr 
                          key={connection.id} 
                          style={{ 
                            borderBottom: '1px solid #f1f5f9', 
                            height: 'auto',
                            minHeight: '60px',
                            background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                            transition: 'all 0.2s ease'
                          }}
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
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{connection.name}</td>
                          <td style={{ padding: '10px 12px', color: '#64748b', overflow: 'hidden', verticalAlign: 'top' }}>
                            <div style={{ fontFamily: 'monospace', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connection.ip}</div>
                            <div style={{
                              fontSize: 12,
                              color: '#475569',
                              display: 'flex',
                              alignItems: 'flex-start',
                              flexWrap: 'wrap',
                              gap: 6,
                              width: '100%',
                              maxWidth: '100%',
                              lineHeight: 1.5
                            }}
                              title={activeCompanies.length > 0 ? activeCompanies.map((company) => `${company.company}${company.accessType ? ` (${company.accessType})` : ''}`).join(', ') : (companiesLoading ? 'Checking companies…' : 'No active companies')}>
                              {companiesLoading ? (
                                <span style={{ color: '#94a3b8' }}>Checking companies…</span>
                              ) : activeCompanies.length > 0 ? (
                                <>
                                  {activeCompanies.map((company, idx) => (
                                    <React.Fragment key={company.guid}>
                                      {idx > 0 && <span style={{ color: '#cbd5f5', marginRight: 2 }}>•</span>}
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                        <span className="material-icons" style={{ fontSize: 12, color: '#3b82f6' }}>apartment</span>
                                        <span style={{ color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>{company.company}</span>
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>No active companies</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{connection.port}</td>
                          <td style={{ padding: '10px 12px', overflow: 'hidden', verticalAlign: 'top' }}>
                            <span style={{
                              padding: '3px 6px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: '#e0f2fe',
                              color: '#0c4a6e',
                              display: 'inline-block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%'
                            }}>{connection.accessType || 'Tally'}</span>
                          </td>
                          <td style={{ padding: '10px 12px', overflow: 'hidden', verticalAlign: 'top' }}>
                            <span style={{
                              padding: '3px 6px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: connection.status === 'active' ? '#dcfce7' : 
                                        connection.status === 'pending' ? '#fef3c7' :
                                        connection.status === 'rejected' ? '#fef2f2' : 
                                        connection.status === 'approved' ? '#dcfce7' : '#f1f5f9',
                              color: connection.status === 'active' ? '#166534' : 
                                     connection.status === 'pending' ? '#92400e' :
                                     connection.status === 'rejected' ? '#dc2626' : 
                                     connection.status === 'approved' ? '#166534' : '#64748b',
                              display: 'inline-block',
                              maxWidth: '100%',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }} title={connection.statusMessage || connection.status}>
                              {connection.statusMessage || connection.status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'top', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {(connection.status === 'active' || connection.status === 'approved' || connection.status === 'inactive') ? (
                                <>
                                  <button
                                    onClick={() => handleToggle(connection.id, !connection.isActive)}
                                    style={{
                                      borderRadius: '50%',
                                      border: 'none',
                                      fontSize: '32px',
                                      cursor: 'pointer',
                                      background: 'transparent',
                                      color: connection.isActive ? '#3b82f6' : '#64748b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s ease',
                                      width: 48,
                                      height: 48
                                    }}
                                    title={connection.isActive ? 'Deactivate' : 'Activate'}
                                    onMouseEnter={(e) => {
                                      e.target.style.transform = 'scale(1.1)';
                                      e.target.style.color = connection.isActive ? '#1e40af' : '#3b82f6';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.transform = 'scale(1)';
                                      e.target.style.color = connection.isActive ? '#3b82f6' : '#64748b';
                                    }}
                                  >
                                    <span className="material-icons">
                                      {connection.isActive ? 'toggle_on' : 'toggle_off'}
                                    </span>
                                  </button>
                                  {activeCompanies.length > 0 && (
                                    <button
                                      onClick={() => handleOpenConfig(connection)}
                                      style={{
                                        background: '#f0f9ff',
                                        border: '1px solid #0ea5e9',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        transition: 'all 0.2s',
                                        color: '#0369a1',
                                        fontSize: '13px',
                                        fontWeight: 600
                                      }}
                                      title="Configure company settings"
                                      onMouseEnter={(e) => {
                                        e.target.style.background = '#0ea5e9';
                                        e.target.style.color = '#fff';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.target.style.background = '#f0f9ff';
                                        e.target.style.color = '#0369a1';
                                      }}
                                    >
                                      <span className="material-icons" style={{ fontSize: '18px' }}>settings</span>
                                      Configurations
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span style={{
                                  color: '#94a3b8',
                                  fontSize: '14px',
                                  fontWeight: 500,
                                  display: 'inline-block',
                                  lineHeight: '48px',
                                  height: '48px'
                                }}>
                                  {connection.status === 'pending' ? 'Pending' : 
                                   connection.status === 'rejected' ? 'Rejected' : 'Inactive'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile Card View */}
              <div style={{ display: isMobile ? 'block' : 'none', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {connections.map((connection) => {
                    const connectionKey = connection.connectionName || connection.name || connection.conn_name || connection.ip || '';
                    const activeCompanies = connectionCompanies[connectionKey] || [];
                    const isActive = connection.isActive;
                    const status = connection.status || (isActive ? 'active' : 'inactive');
                    
                    return (
                      <div
                        key={connection.id}
                        style={{
                          background: '#fff',
                          borderRadius: 16,
                          boxShadow: '0 2px 12px 0 rgba(31,38,135,0.08)',
                          padding: 16,
                          border: '1px solid #f1f5f9',
                          transition: 'all 0.2s ease',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                        onTouchStart={(e) => {
                          e.currentTarget.style.transform = 'scale(0.99)';
                          e.currentTarget.style.boxShadow = '0 4px 16px 0 rgba(31,38,135,0.12)';
                        }}
                        onTouchEnd={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 12px 0 rgba(31,38,135,0.08)';
                        }}
                      >
                        {/* Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontWeight: 700, 
                              fontSize: 16, 
                              color: '#1e293b',
                              marginBottom: 6,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.3
                            }}>
                              {connection.name}
                            </div>
                            <div style={{ 
                              fontSize: 12, 
                              color: '#64748b',
                              fontFamily: 'monospace',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.4
                            }}>
                              {connection.ip}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            <span style={{
                              padding: '8px 12px',
                              borderRadius: '16px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: status === 'active' || status === 'approved' ? '#dcfce7' : 
                                        status === 'pending' ? '#fef3c7' :
                                        status === 'rejected' ? '#fef2f2' : '#f1f5f9',
                              color: status === 'active' || status === 'approved' ? '#166534' : 
                                     status === 'pending' ? '#92400e' :
                                     status === 'rejected' ? '#dc2626' : '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              whiteSpace: 'nowrap',
                              boxShadow: status === 'active' || status === 'approved' ? '0 1px 3px rgba(22, 101, 52, 0.2)' : 'none'
                            }}>
                              <span className="material-icons" style={{ fontSize: 16 }}>
                                {status === 'active' || status === 'approved' ? 'check_circle' : 
                                 status === 'rejected' ? 'cancel' : 'help_outline'}
                              </span>
                              <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {connection.statusMessage || status}
                              </span>
                            </span>
                            <button
                              onClick={() => handleToggle(connection.id, !connection.isActive)}
                              style={{
                                borderRadius: '50%',
                                border: 'none',
                                fontSize: '36px',
                                cursor: 'pointer',
                                background: 'transparent',
                                color: connection.isActive ? '#3b82f6' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                width: 44,
                                height: 44,
                                padding: 0,
                                minWidth: 44,
                                minHeight: 44
                              }}
                              title={connection.isActive ? 'Deactivate' : 'Activate'}
                              onTouchStart={(e) => {
                                e.currentTarget.style.transform = 'scale(0.85)';
                                e.currentTarget.style.opacity = '0.8';
                              }}
                              onTouchEnd={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.opacity = '1';
                              }}
                            >
                              <span className="material-icons" style={{ fontSize: 32 }}>
                                {connection.isActive ? 'toggle_on' : 'toggle_off'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Details Row */}
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          gap: 14,
                          padding: '14px 0',
                          borderTop: '1px solid #f1f5f9'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ flex: 1, minWidth: '120px' }}>
                              <div style={{ 
                                fontSize: 11, 
                                color: '#64748b', 
                                fontWeight: 600, 
                                marginBottom: 6, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span className="material-icons" style={{ fontSize: 14, color: '#94a3b8' }}>dns</span>
                                Port
                              </div>
                              <div style={{ 
                                fontSize: 14, 
                                color: '#475569',
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                padding: '6px 10px',
                                background: '#f8fafc',
                                borderRadius: 8,
                                display: 'inline-block',
                                border: '1px solid #e2e8f0'
                              }}>
                                {connection.port || 'N/A'}
                              </div>
                            </div>
                            <div style={{ flex: 1, minWidth: '120px' }}>
                              <div style={{ 
                                fontSize: 11, 
                                color: '#64748b', 
                                fontWeight: 600, 
                                marginBottom: 6, 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                <span className="material-icons" style={{ fontSize: 14, color: '#94a3b8' }}>category</span>
                                Access Type
                              </div>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '10px',
                                fontSize: '12px',
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                                color: '#0c4a6e',
                                display: 'inline-block',
                                border: '1px solid #7dd3fc',
                                boxShadow: '0 1px 3px rgba(14, 165, 233, 0.2)'
                              }}>
                                {connection.accessType || 'Tally'}
                              </span>
                            </div>
                          </div>

                          {/* Companies List */}
                          <div>
                            <div style={{ 
                              fontSize: 11, 
                              color: '#64748b', 
                              fontWeight: 600, 
                              marginBottom: 8, 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.5px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <span className="material-icons" style={{ fontSize: 14, color: '#94a3b8' }}>apartment</span>
                              Companies {activeCompanies.length > 0 && `(${activeCompanies.length})`}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: '#475569',
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 8,
                              minHeight: 24
                            }}>
                              {companiesLoading ? (
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 6,
                                  color: '#94a3b8',
                                  padding: '6px 12px',
                                  background: '#f8fafc',
                                  borderRadius: 8
                                }}>
                                  <span className="material-icons" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>sync</span>
                                  <span>Checking companies…</span>
                                </div>
                              ) : activeCompanies.length > 0 ? (
                                <>
                                  {activeCompanies.map((company, idx) => (
                                    <React.Fragment key={company.guid}>
                                      <span style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: 6,
                                        padding: '6px 12px',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                                        border: '1px solid #bae6fd',
                                        boxShadow: '0 1px 3px rgba(14, 165, 233, 0.15)',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box'
                                      }}>
                                        <span className="material-icons" style={{ fontSize: 14, color: '#3b82f6', flexShrink: 0 }}>apartment</span>
                                        <span style={{ 
                                          color: '#0f172a', 
                                          fontWeight: 600, 
                                          fontSize: 12,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '150px'
                                        }}>{company.company}</span>
                                      </span>
                                    </React.Fragment>
                                  ))}
                                </>
                              ) : (
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 6,
                                  color: '#94a3b8',
                                  padding: '8px 12px',
                                  background: '#f8fafc',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  fontStyle: 'italic'
                                }}>
                                  <span className="material-icons" style={{ fontSize: 16 }}>info</span>
                                  <span>No active companies</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {(connection.status === 'active' || connection.status === 'approved' || connection.status === 'inactive') && activeCompanies.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <button
                                onClick={() => handleOpenConfig(connection)}
                                style={{
                                  background: 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)',
                                  border: 'none',
                                  borderRadius: '12px',
                                  padding: '14px 18px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 8,
                                  transition: 'all 0.2s',
                                  color: '#fff',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  width: '100%',
                                  WebkitTapHighlightColor: 'transparent',
                                  boxShadow: '0 2px 8px rgba(242, 112, 32, 0.3)',
                                  minHeight: 48
                                }}
                                title="Configure company settings"
                                onTouchStart={(e) => {
                                  e.currentTarget.style.transform = 'scale(0.97)';
                                  e.currentTarget.style.opacity = '0.9';
                                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(242, 112, 32, 0.4)';
                                }}
                                onTouchEnd={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.opacity = '1';
                                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(242, 112, 32, 0.3)';
                                }}
                              >
                                <span className="material-icons" style={{ fontSize: '20px' }}>settings</span>
                                <span>Configure Company Settings</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Company Configurations Modal */}
      {showConfigModal && selectedConnection && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: 20
        }} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowConfigModal(false);
          }
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.15)',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '85vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: '0 20px'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(90deg, #1e40af 0%, #3b82f6 100%)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: 24, 
                  fontWeight: 700, 
                  color: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                }}>
                  <span className="material-icons" style={{ fontSize: 28 }}>tune</span>
                  Company Configurations
                </h3>
                <div style={{ 
                  fontSize: 14, 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <span className="material-icons" style={{ fontSize: 16 }}>cloud</span>
                  {selectedConnection.name || selectedConnection.connectionName || 'Connection'}
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  fontSize: 24,
                  color: '#fff',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  transition: 'all 0.2s',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.transform = 'rotate(90deg)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.transform = 'rotate(0deg)';
                }}
              >
                ×
              </button>
            </div>

            {/* Company Tabs */}
            {configCompanies.length > 1 && (
              <div style={{
                padding: '16px 28px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                overflowY: 'hidden',
                background: '#f8fafc',
                boxShadow: 'inset 0 -1px 0 #e2e8f0',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f8fafc'
              }}
              onScroll={(e) => {
                // Smooth scroll behavior
                e.currentTarget.style.scrollBehavior = 'smooth';
              }}
              >
                <style>
                  {`
                    /* Custom scrollbar for tabs */
                    div::-webkit-scrollbar {
                      height: 6px;
                    }
                    div::-webkit-scrollbar-track {
                      background: #f8fafc;
                      border-radius: 3px;
                    }
                    div::-webkit-scrollbar-thumb {
                      background: #cbd5e1;
                      border-radius: 3px;
                    }
                    div::-webkit-scrollbar-thumb:hover {
                      background: #94a3b8;
                    }
                  `}
                </style>
                {configCompanies.map((company, index) => {
                  const isActive = activeConfigTab === index;
                  return (
                    <button
                      key={company.guid}
                      onClick={() => setActiveConfigTab(index)}
                      title={company.company}
                      style={{
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: '10px',
                        background: isActive 
                          ? 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)' 
                          : '#fff',
                        color: isActive ? '#fff' : '#64748b',
                        fontSize: 14,
                        fontWeight: isActive ? 600 : 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.3s ease',
                        boxShadow: isActive 
                          ? '0 4px 12px rgba(242, 112, 32, 0.3)' 
                          : '0 1px 3px rgba(0, 0, 0, 0.1)',
                        border: isActive ? 'none' : '1px solid #e2e8f0',
                        position: 'relative',
                        overflow: 'visible',
                        minWidth: '120px',
                        maxWidth: '250px',
                        flexShrink: 0,
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = '#fff';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        }
                      }}
                    >
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                        display: 'block'
                      }}>
                        {company.company}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Configuration Content */}
            <div style={{
              padding: '28px',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              boxSizing: 'border-box',
              background: 'linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)'
            }}>
              {configCompanies.length > 0 && (() => {
                const activeCompany = configCompanies[activeConfigTab];
                const companyConfig = configurations[activeCompany?.guid] || {};

                if (companyConfig.loading) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <span className="material-icons" style={{ fontSize: 48, color: '#3b82f6', marginBottom: 16, display: 'block' }}>sync</span>
                      <div style={{ fontSize: 16, fontWeight: 500 }}>Loading configurations...</div>
                    </div>
                  );
                }

                if (companyConfig.error) {
                  return (
                    <div style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: 8,
                      padding: 20,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <span className="material-icons" style={{ color: '#dc2626', fontSize: 24 }}>error</span>
                      <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 500 }}>{companyConfig.error}</div>
                    </div>
                  );
                }

                if (!companyConfig.configs || companyConfig.configs.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <span className="material-icons" style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 16, display: 'block' }}>settings</span>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No configurations available</div>
                      <div style={{ fontSize: 14 }}>Configurations will appear here once they are set up</div>
                    </div>
                  );
                }

                // Group configurations by parent_name
                const groupedConfigs = {};
                companyConfig.configs.forEach(config => {
                  const parentName = config.parent_name || 'Other';
                  if (!groupedConfigs[parentName]) {
                    groupedConfigs[parentName] = {
                      parentName: parentName,
                      parentSortOrder: config.parent_sort_order || 999,
                      configs: []
                    };
                  }
                  groupedConfigs[parentName].configs.push(config);
                });

                // Sort configurations within each group by sort_order
                Object.keys(groupedConfigs).forEach(parentName => {
                  groupedConfigs[parentName].configs.sort((a, b) => {
                    const sortOrderA = a.sort_order || 999;
                    const sortOrderB = b.sort_order || 999;
                    return sortOrderA - sortOrderB;
                  });
                });

                // Convert to array and sort by parent_sort_order
                const sortedGroups = Object.values(groupedConfigs).sort((a, b) => {
                  return a.parentSortOrder - b.parentSortOrder;
                });

                return (
                  <div>
                    <div style={{ 
                      marginBottom: 28,
                      padding: '20px 24px',
                      background: 'linear-gradient(135deg, #1e40af15 0%, #3b82f615 100%)',
                      borderRadius: 12,
                      border: '1px solid #bfdbfe'
                    }}>
                      <div style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: '#1e293b',
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                      }}>
                        <span className="material-icons" style={{ fontSize: 24, color: '#1e40af' }}>business</span>
                        {activeCompany.company}
                      </div>
                      <div style={{
                        fontSize: 14,
                        color: '#64748b',
                        lineHeight: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <span className="material-icons" style={{ fontSize: 16 }}>info</span>
                        Configure settings for this company
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '28px',
                      padding: '8px 0'
                    }}>
                      {sortedGroups.map((group) => (
                        <div key={group.parentName} style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          background: '#fff',
                          borderRadius: 16,
                          padding: '20px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                          border: '1px solid #e2e8f0',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        >
                          {/* Parent Name Header */}
                          <div style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#1e293b',
                            marginBottom: 4,
                            paddingBottom: 12,
                            borderBottom: '2px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 10,
                              background: 'linear-gradient(135deg, #1e40af15 0%, #3b82f615 100%)',
                              padding: '8px 14px',
                              borderRadius: 10
                            }}>
                              <span className="material-icons" style={{ fontSize: 22, color: '#1e40af' }}>folder</span>
                              <span>{group.parentName}</span>
                            </div>
                            {/* Button for Link Account */}
                            {group.parentName === 'Link Account' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowLinkAccountModal(true);
                                  // Check for existing token
                                  const token = localStorage.getItem('google_access_token');
                                  if (token) {
                                    setGoogleAccessToken(token);
                                    // Fetch user display name if token exists
                                    fetchGoogleUserDisplayName(token);
                                  }
                                }}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: '#fff',
                                  background: 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)',
                                  border: 'none',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  transition: 'all 0.3s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  boxShadow: '0 2px 8px rgba(242, 112, 32, 0.3)'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.transform = 'translateY(-2px)';
                                  e.target.style.boxShadow = '0 4px 12px rgba(242, 112, 32, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.transform = 'translateY(0)';
                                  e.target.style.boxShadow = '0 2px 8px rgba(242, 112, 32, 0.3)';
                                }}
                              >
                                <span className="material-icons" style={{ fontSize: 18 }}>link</span>
                                Action
                              </button>
                            )}
                          </div>

                          {/* Configurations under this parent */}
                          {group.configs.map((config) => {
                        // Handle both boolean and number (0/1) for is_enabled
                        const isEnabled = config.is_enabled === true || config.is_enabled === 1;
                        // Check if this is a Link Account config (read-only)
                        const isLinkAccount = group.parentName === 'Link Account';
                        return (
                          <div
                            key={config.config_id || config.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '16px 18px',
                              background: isEnabled 
                                ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' 
                                : '#f8fafc',
                              border: `2px solid ${isEnabled ? '#0ea5e9' : '#e2e8f0'}`,
                              borderRadius: 12,
                              transition: 'all 0.3s ease',
                              boxSizing: 'border-box',
                              width: '100%',
                              userSelect: 'none',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                              if (isEnabled) {
                                e.currentTarget.style.borderColor = '#0284c7';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(14, 165, 233, 0.2)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = isEnabled ? '#0ea5e9' : '#e2e8f0';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 16 }}>
                              <div
                                onClick={() => {
                                  // Toggle is_enabled: convert to boolean, then toggle
                                  // Toggle is allowed for Link Account configs, only inputs are read-only
                                  const currentValue = config.is_enabled === true || config.is_enabled === 1;
                                  handleConfigChange(activeCompany.guid, config.config_id || config.id, 'is_enabled', !currentValue);
                                }}
                                style={{
                                  width: 24,
                                  height: 24,
                                  border: '2px solid #d1d5db',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: isEnabled 
                                    ? 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)' 
                                    : 'transparent',
                                  borderColor: isEnabled ? '#F27020' : '#d1d5db',
                                  transition: 'all 0.3s ease',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                  opacity: 1,
                                  boxShadow: isEnabled ? '0 2px 6px rgba(242, 112, 32, 0.3)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isEnabled) {
                                    e.target.style.borderColor = '#9ca3af';
                                    e.target.style.background = '#f3f4f6';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isEnabled) {
                                    e.target.style.borderColor = '#d1d5db';
                                    e.target.style.background = 'transparent';
                                  }
                                }}
                              >
                                {isEnabled && (
                                  <span className="material-icons" style={{
                                    fontSize: 14,
                                    color: '#fff',
                                    fontWeight: 'bold'
                                  }}>
                                    check
                                  </span>
                                )}
                              </div>
                              <div style={{
                                flex: 1,
                                minWidth: 0
                              }}>
                                <div style={{
                                  color: isEnabled ? '#1e40af' : '#374151',
                                  fontWeight: isEnabled ? 600 : 500,
                                  fontSize: 15,
                                  lineHeight: 1.5,
                                  marginBottom: (config.config_description || config.description) ? 6 : 0
                                }}>
                                  {config.display_name || config.config_name || config.name || `Config ${config.config_id || config.id}`}
                                </div>
                                {(config.config_description || config.description) && (
                                  <div style={{
                                    color: '#64748b',
                                    fontSize: 13,
                                    lineHeight: 1.4,
                                    fontWeight: 400
                                  }}>
                                    {config.config_description || config.description}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Permission Value Input - Only show when enabled and config_type is not null */}
                            {isEnabled && (config.config_type || config.permission_type || config.value_type) && (
                              <div style={{ marginLeft: '16px', minWidth: '220px', maxWidth: '300px' }}>
                                {(config.config_type === 'select' || config.permission_type === 'select' || config.value_type === 'select') ? (
                                  <select
                                    value={config.permission_value || config.config_value || config.value || ''}
                                    onChange={(e) => !isLinkAccount && handleConfigChange(activeCompany.guid, config.config_id || config.id, 'permission_value', e.target.value)}
                                    disabled={isLinkAccount}
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      border: `2px solid ${isLinkAccount ? '#e2e8f0' : '#d1d5db'}`,
                                      borderRadius: 8,
                                      fontSize: 13,
                                      outline: 'none',
                                      background: isLinkAccount ? '#f3f4f6' : '#fff',
                                      color: isLinkAccount ? '#6b7280' : '#374151',
                                      cursor: isLinkAccount ? 'not-allowed' : 'pointer',
                                      transition: 'all 0.2s',
                                      fontWeight: 500
                                    }}
                                    onFocus={(e) => !isLinkAccount && (e.target.style.borderColor = '#3b82f6')}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                  >
                                    <option value="">Select option</option>
                                    {(config.config_options || config.permission_options || config.options || []) && (config.config_options || config.permission_options || config.options || []).map((option, idx) => (
                                      <option key={idx} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={(config.config_type === 'number' || config.permission_type === 'number' || config.value_type === 'number') ? 'number' : 'text'}
                                    value={config.permission_value || config.config_value || config.value || ''}
                                    onChange={(e) => !isLinkAccount && handleConfigChange(activeCompany.guid, config.config_id || config.id, 'permission_value', e.target.value)}
                                    readOnly={isLinkAccount}
                                    placeholder={isLinkAccount 
                                      ? 'Will be displayed here' 
                                      : ((config.config_type === 'number' || config.permission_type === 'number' || config.value_type === 'number') ? 'Enter number' : 'Enter value')}
                                    style={{
                                      width: '100%',
                                      padding: '10px 12px',
                                      border: `2px solid ${isLinkAccount ? '#e2e8f0' : '#d1d5db'}`,
                                      borderRadius: 8,
                                      fontSize: 13,
                                      outline: 'none',
                                      background: isLinkAccount ? '#f3f4f6' : '#fff',
                                      color: isLinkAccount ? '#6b7280' : '#374151',
                                      cursor: isLinkAccount ? 'not-allowed' : 'text',
                                      transition: 'all 0.2s',
                                      fontWeight: 500
                                    }}
                                    onFocus={(e) => !isLinkAccount && (e.target.style.borderColor = '#3b82f6')}
                                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                        </div>
                      ))}
                    </div>

                    {/* Selection Summary */}
                    {companyConfig.configs.filter(c => c.is_enabled).length > 0 && (
                      <div style={{
                        marginTop: '24px',
                        padding: '16px 20px',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        border: '2px solid #0ea5e9',
                        borderRadius: '12px',
                        fontSize: '14px',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)'
                      }}>
                        <span className="material-icons" style={{ 
                          fontSize: '20px',
                          background: '#0ea5e9',
                          color: '#fff',
                          borderRadius: '50%',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          check_circle
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          <strong style={{ fontSize: '16px' }}>{companyConfig.configs.filter(c => c.is_enabled).length}</strong> configuration{companyConfig.configs.filter(c => c.is_enabled).length !== 1 ? 's' : ''} enabled
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '24px 28px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              background: 'linear-gradient(to bottom, #f8fafc 0%, #ffffff 100%)',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)'
            }}>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{
                  padding: '12px 24px',
                  border: '2px solid #d1d5db',
                  borderRadius: 10,
                  background: '#fff',
                  color: '#374151',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.borderColor = '#9ca3af';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#fff';
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <span className="material-icons" style={{ fontSize: 18 }}>close</span>
                Close
              </button>
              {configCompanies.length > 0 && configurations[configCompanies[activeConfigTab]?.guid]?.configs && (
                <button
                  onClick={() => handleSaveConfig(configCompanies[activeConfigTab].guid)}
                  disabled={configSaving}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: 10,
                    background: configSaving 
                      ? '#9ca3af' 
                      : 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: configSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: configSaving 
                      ? 'none' 
                      : '0 4px 12px rgba(242, 112, 32, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!configSaving) {
                      e.target.style.background = 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)';
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(242, 112, 32, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!configSaving) {
                      e.target.style.background = 'linear-gradient(135deg, #F27020 0%, #ea580c 100%)';
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(242, 112, 32, 0.3)';
                    }
                  }}
                >
                  {configSaving ? (
                    <>
                      <span className="material-icons" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-icons" style={{ fontSize: 18 }}>save</span>
                      Save Configurations
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Account Modal */}
      {showLinkAccountModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLinkAccountModal(false);
            }
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.15)',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '85vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: '0 20px',
              animation: 'slideUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-icons" style={{ fontSize: 24 }}>link</span>
                  Link Account
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                  Connect your external accounts to enable additional features
                </p>
              </div>
              <button
                onClick={() => setShowLinkAccountModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 28,
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f1f5f9';
                  e.target.style.color = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'none';
                  e.target.style.color = '#64748b';
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '40px',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0
            }}>
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
                      {isExternalUser() && (
                        <p style={{
                          fontSize: '13px',
                          color: '#dc2626',
                          marginTop: '8px',
                          padding: '8px 12px',
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>info</span>
                          You are configuring your personal Google account. Only you can access this account. Email must match: {sessionStorage.getItem('email') || 'your registered email'}
                        </p>
                      )}
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
                      {googleUserDisplayName ? `Connected as ${googleUserDisplayName}` : 'Connected'}
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

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {!googleAccessToken ? (
                    <button
                      onClick={() => handleGoogleAuth(false)}
                      disabled={isGoogleLoading || !isGoogleDriveFullyConfigured().configured}
                      style={{
                        padding: '12px 24px',
                        background: isGoogleLoading || !isGoogleDriveFullyConfigured().configured
                          ? '#e5e7eb'
                          : 'linear-gradient(135deg, #4285f4 0%, #1a73e8 100%)',
                        color: isGoogleLoading || !isGoogleDriveFullyConfigured().configured
                          ? '#9ca3af'
                          : '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '15px',
                        cursor: isGoogleLoading || !isGoogleDriveFullyConfigured().configured
                          ? 'not-allowed'
                          : 'pointer',
                        boxShadow: isGoogleLoading || !isGoogleDriveFullyConfigured().configured
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
                        if (!isGoogleLoading && isGoogleDriveFullyConfigured().configured) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(66,133,244,0.35)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGoogleLoading && isGoogleDriveFullyConfigured().configured) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(66,133,244,0.25)';
                        }
                      }}
                    >
                      {isGoogleLoading ? (
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
                    <>
                      <button
                        onClick={handleSwitchAccount}
                        disabled={isGoogleLoading}
                        style={{
                          padding: '12px 24px',
                          background: isGoogleLoading
                            ? '#e5e7eb'
                            : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: isGoogleLoading ? '#9ca3af' : '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          fontWeight: 600,
                          fontSize: '15px',
                          cursor: isGoogleLoading ? 'not-allowed' : 'pointer',
                          boxShadow: isGoogleLoading
                            ? 'none'
                            : '0 4px 12px 0 rgba(245,158,11,0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          transition: 'all 0.3s ease',
                          minWidth: '180px',
                        }}
                        onMouseEnter={(e) => {
                          if (!isGoogleLoading) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px 0 rgba(245,158,11,0.35)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isGoogleLoading) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(245,158,11,0.25)';
                          }
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: '20px' }}>
                          swap_horiz
                        </span>
                        Switch Account
                      </button>
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
                    </>
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
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#16a34a',
                  }}>
                    <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>
                      check_circle
                    </span>
                    Your Google account is connected. The connection will remain active until you unlink or switch accounts.
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
        </div>
      )}
    </>
  );
}

export default TallyConfig; 