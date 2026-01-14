import React, { useState, useEffect } from 'react';
import { getGupshupConfig, fetchWhatsAppMessages, sendWhatsAppMessage, testGupshupConnection } from '../utils/gupshupUtils';
import { getCompanyConfigValue, clearCompanyConfigCache } from '../utils/companyConfigUtils';
import { apiPost } from '../utils/apiUtils';
import {
  getMetaWhatsAppConfig,
  fetchMetaWhatsAppMessages,
  sendMetaWhatsAppMessage,
  testMetaWhatsAppConnection,
  getFacebookLoginStatus,
  loginToFacebook,
  logoutFromFacebook,
  isFacebookSDKReady
} from '../utils/metaWhatsAppUtils';
import { META_WHATSAPP_CONFIG } from '../config';

function WhatsAppViewer() {
  // Configuration state
  const [apiKey, setApiKey] = useState('');
  const [appId, setAppId] = useState('');
  const [appName, setAppName] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configStatus, setConfigStatus] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Messages state
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Meta WhatsApp state
  const [metaAppId, setMetaAppId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('');
  const [metaPhoneNumber, setMetaPhoneNumber] = useState('');
  const [metaConfigLoading, setMetaConfigLoading] = useState(false);
  const [metaConfigSaving, setMetaConfigSaving] = useState(false);
  const [metaConfigStatus, setMetaConfigStatus] = useState(null);
  const [metaIsConfigured, setMetaIsConfigured] = useState(false);
  const [metaTestingConnection, setMetaTestingConnection] = useState(false);
  const [metaFacebookLoginStatus, setMetaFacebookLoginStatus] = useState(null);
  const [metaFacebookLoggingIn, setMetaFacebookLoggingIn] = useState(false);
  const [metaMessages, setMetaMessages] = useState([]);
  const [metaMessagesLoading, setMetaMessagesLoading] = useState(false);
  const [metaMessagesError, setMetaMessagesError] = useState(null);
  const [metaLastFetchTime, setMetaLastFetchTime] = useState(null);
  const [metaReplyingTo, setMetaReplyingTo] = useState(null);
  const [metaReplyText, setMetaReplyText] = useState('');
  const [metaSendingReply, setMetaSendingReply] = useState(false);

  // Get company info from session storage
  const tallylocId = sessionStorage.getItem('tallyloc_id');
  const coGuid = sessionStorage.getItem('selectedCompanyGuid') || sessionStorage.getItem('guid');

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
    loadMetaConfiguration();
    checkFacebookLoginStatus();
  }, [tallylocId, coGuid]);

  // Check Facebook SDK and login status
  useEffect(() => {
    const checkSDK = async () => {
      const ready = await isFacebookSDKReady();
      if (ready) {
        checkFacebookLoginStatus();
      }
    };
    checkSDK();
  }, []);

  // Load configuration from company configs
  const loadConfiguration = async () => {
    if (!tallylocId || !coGuid) {
      return;
    }

    setConfigLoading(true);
    try {
      const config = await getGupshupConfig(tallylocId, coGuid);
      if (config) {
        setApiKey(config.apiKey || '');
        setAppId(config.appId || '');
        setAppName(config.appName || '');
        setSourceNumber(config.sourceNumber || '');
        setIsConfigured(true);
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.error('Error loading Gupshup configuration:', error);
      setIsConfigured(false);
    } finally {
      setConfigLoading(false);
    }
  };

  // Save configuration
  const handleSaveConfig = async () => {
    if (!tallylocId || !coGuid) {
      setConfigStatus({ type: 'error', message: 'Please select a company first.' });
      return;
    }

    if (!apiKey || !appId || !appName) {
      setConfigStatus({ type: 'error', message: 'Please fill in API Key, App ID, and App Name.' });
      return;
    }

    setConfigSaving(true);
    setConfigStatus(null);

    try {
      const payload = {
        tallyloc_id: tallylocId,
        co_guid: coGuid,
        configurations: [
          {
            config_key: 'gupshup_api_key',
            permission_value: apiKey,
            is_enabled: true
          },
          {
            config_key: 'gupshup_app_id',
            permission_value: appId,
            is_enabled: true
          },
          {
            config_key: 'gupshup_app_name',
            permission_value: appName,
            is_enabled: true
          },
          {
            config_key: 'gupshup_source_number',
            permission_value: sourceNumber,
            is_enabled: true
          }
        ]
      };

      const response = await apiPost('/api/cmpconfig/save', payload);
      
      if (response && (response.status === 'success' || response.success)) {
        setConfigStatus({ type: 'success', message: 'Configuration saved successfully!' });
        setIsConfigured(true);
        // Clear config cache
        clearCompanyConfigCache(tallylocId, coGuid);
      } else {
        setConfigStatus({ type: 'error', message: response?.message || 'Failed to save configuration.' });
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      setConfigStatus({ type: 'error', message: error.message || 'An error occurred while saving configuration.' });
    } finally {
      setConfigSaving(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!apiKey || !appId || !appName) {
      setConfigStatus({ type: 'error', message: 'Please fill in API Key, App ID, and App Name first.' });
      return;
    }

    setTestingConnection(true);
    setConfigStatus(null);

    try {
      const result = await testGupshupConnection(apiKey, appId, appName);
      if (result.success) {
        setConfigStatus({ type: 'success', message: 'Connection test successful!' });
      } else {
        setConfigStatus({ 
          type: 'error', 
          message: result.error || 'Connection test failed. Please check your credentials.' 
        });
      }
    } catch (error) {
      setConfigStatus({ type: 'error', message: error.message || 'Connection test failed.' });
    } finally {
      setTestingConnection(false);
    }
  };

  // Fetch WhatsApp messages
  const fetchMessages = async () => {
    if (!tallylocId || !coGuid) {
      setMessagesError('Please select a company first.');
      return;
    }

    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const config = await getGupshupConfig(tallylocId, coGuid);
      if (!config) {
        setMessagesError('Gupshup is not configured for this company. Please configure your Gupshup credentials first.');
        setMessagesLoading(false);
        return;
      }

      const data = await fetchWhatsAppMessages(config.apiKey, config.appId, config.appName, { limit: 50 });
      
      // Parse messages from Gupshup response
      // Note: Gupshup API response structure may vary, adjust parsing as needed
      let parsedMessages = [];
      if (data && data.messages) {
        parsedMessages = data.messages;
      } else if (Array.isArray(data)) {
        parsedMessages = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        parsedMessages = data.data;
      }

      // Sort messages by timestamp (newest first)
      parsedMessages.sort((a, b) => {
        const timeA = a.timestamp || a.time || a.createdAt || 0;
        const timeB = b.timestamp || b.time || b.createdAt || 0;
        return timeB - timeA;
      });

      setMessages(parsedMessages);
      setLastFetchTime(new Date());
      setMessagesError(null);
    } catch (error) {
      console.error('Error fetching WhatsApp messages:', error);
      setMessagesError(error.message || 'An unexpected error occurred while fetching messages.');
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Send reply
  const handleSendReply = async (message) => {
    if (!replyText.trim()) {
      return;
    }

    if (!tallylocId || !coGuid) {
      setConfigStatus({ type: 'error', message: 'Please select a company first.' });
      return;
    }

    setSendingReply(true);

    try {
      const config = await getGupshupConfig(tallylocId, coGuid);
      if (!config) {
        setConfigStatus({ type: 'error', message: 'Gupshup is not configured. Please configure your credentials first.' });
        setSendingReply(false);
        return;
      }

      // Extract sender phone number from message
      const senderNumber = message.from || message.phoneNumber || message.sender || message.source;
      if (!senderNumber) {
        setConfigStatus({ type: 'error', message: 'Could not determine sender phone number.' });
        setSendingReply(false);
        return;
      }

      if (!config.sourceNumber) {
        setConfigStatus({ type: 'error', message: 'Source number is not configured. Please add it in the configuration section.' });
        setSendingReply(false);
        return;
      }

      await sendWhatsAppMessage(
        config.apiKey,
        config.appId,
        config.appName,
        config.sourceNumber,
        senderNumber,
        replyText.trim()
      );

      setConfigStatus({ type: 'success', message: 'Message sent successfully!' });
      setReplyText('');
      setReplyingTo(null);
      
      // Refresh messages after sending
      setTimeout(() => {
        fetchMessages();
      }, 1000);
    } catch (error) {
      console.error('Error sending reply:', error);
      setConfigStatus({ type: 'error', message: error.message || 'Failed to send message.' });
    } finally {
      setSendingReply(false);
    }
  };

  // Auto-fetch messages on mount if configured
  useEffect(() => {
    if (isConfigured && tallylocId && coGuid) {
      fetchMessages();
    }
    if (metaIsConfigured && tallylocId && coGuid) {
      fetchMetaMessages();
    }
  }, [isConfigured, metaIsConfigured, tallylocId, coGuid]);

  // Load Meta WhatsApp configuration from company configs
  const loadMetaConfiguration = async () => {
    if (!tallylocId || !coGuid) {
      return;
    }

    setMetaConfigLoading(true);
    try {
      const config = await getMetaWhatsAppConfig(tallylocId, coGuid);
      if (config) {
        setMetaAppId(config.appId || META_WHATSAPP_CONFIG.APP_ID || '');
        setMetaAccessToken(config.accessToken || '');
        setMetaPhoneNumberId(config.phoneNumberId || '');
        setMetaBusinessAccountId(config.businessAccountId || '');
        setMetaPhoneNumber(config.phoneNumber || '');
        setMetaIsConfigured(true);
      } else {
        setMetaIsConfigured(false);
        // Set default app ID from config if available
        if (META_WHATSAPP_CONFIG.APP_ID) {
          setMetaAppId(META_WHATSAPP_CONFIG.APP_ID);
        }
      }
    } catch (error) {
      console.error('Error loading Meta WhatsApp configuration:', error);
      setMetaIsConfigured(false);
    } finally {
      setMetaConfigLoading(false);
    }
  };

  // Check Facebook login status
  const checkFacebookLoginStatus = async () => {
    try {
      const status = await getFacebookLoginStatus();
      setMetaFacebookLoginStatus(status);
      if (status.status === 'connected' && status.authResponse && status.authResponse.accessToken) {
        setMetaAccessToken(status.authResponse.accessToken);
      }
    } catch (error) {
      console.error('Error checking Facebook login status:', error);
      setMetaFacebookLoginStatus({ status: 'unknown' });
    }
  };

  // Handle Facebook login
  const handleFacebookLogin = async () => {
    setMetaFacebookLoggingIn(true);
    setMetaConfigStatus(null);
    try {
      const response = await loginToFacebook(['email']);
      if (response.authResponse && response.authResponse.accessToken) {
        setMetaAccessToken(response.authResponse.accessToken);
        setMetaFacebookLoginStatus(response);
        setMetaConfigStatus({ type: 'success', message: 'Facebook login successful!' });
        await checkFacebookLoginStatus();
      }
    } catch (error) {
      console.error('Facebook login error:', error);
      setMetaConfigStatus({ type: 'error', message: error.message || 'Facebook login failed.' });
    } finally {
      setMetaFacebookLoggingIn(false);
    }
  };

  // Handle Facebook logout
  const handleFacebookLogout = async () => {
    try {
      await logoutFromFacebook();
      setMetaAccessToken('');
      setMetaFacebookLoginStatus({ status: 'not_authorized' });
      setMetaConfigStatus({ type: 'success', message: 'Logged out from Facebook.' });
    } catch (error) {
      console.error('Facebook logout error:', error);
    }
  };

  // Save Meta WhatsApp configuration
  const handleSaveMetaConfig = async () => {
    if (!tallylocId || !coGuid) {
      setMetaConfigStatus({ type: 'error', message: 'Please select a company first.' });
      return;
    }

    if (!metaAppId || !metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId) {
      setMetaConfigStatus({ type: 'error', message: 'Please fill in App ID, Access Token, Phone Number ID, and Business Account ID.' });
      return;
    }

    setMetaConfigSaving(true);
    setMetaConfigStatus(null);

    try {
      const payload = {
        tallyloc_id: tallylocId,
        co_guid: coGuid,
        configurations: [
          {
            config_key: 'meta_whatsapp_app_id',
            permission_value: metaAppId,
            is_enabled: true
          },
          {
            config_key: 'meta_whatsapp_access_token',
            permission_value: metaAccessToken,
            is_enabled: true
          },
          {
            config_key: 'meta_whatsapp_phone_number_id',
            permission_value: metaPhoneNumberId,
            is_enabled: true
          },
          {
            config_key: 'meta_whatsapp_business_account_id',
            permission_value: metaBusinessAccountId,
            is_enabled: true
          },
          {
            config_key: 'meta_whatsapp_phone_number',
            permission_value: metaPhoneNumber,
            is_enabled: true
          }
        ]
      };

      const response = await apiPost('/api/cmpconfig/save', payload);
      
      if (response && (response.status === 'success' || response.success)) {
        setMetaConfigStatus({ type: 'success', message: 'Configuration saved successfully!' });
        setMetaIsConfigured(true);
        // Clear config cache
        clearCompanyConfigCache(tallylocId, coGuid);
      } else {
        setMetaConfigStatus({ type: 'error', message: response?.message || 'Failed to save configuration.' });
      }
    } catch (error) {
      console.error('Error saving Meta WhatsApp configuration:', error);
      setMetaConfigStatus({ type: 'error', message: error.message || 'An error occurred while saving configuration.' });
    } finally {
      setMetaConfigSaving(false);
    }
  };

  // Test Meta WhatsApp connection
  const handleTestMetaConnection = async () => {
    if (!metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId) {
      setMetaConfigStatus({ type: 'error', message: 'Please fill in Access Token, Phone Number ID, and Business Account ID first.' });
      return;
    }

    setMetaTestingConnection(true);
    setMetaConfigStatus(null);

    try {
      const result = await testMetaWhatsAppConnection(metaAccessToken, metaPhoneNumberId, metaBusinessAccountId);
      if (result.success) {
        setMetaConfigStatus({ type: 'success', message: 'Connection test successful!' });
      } else {
        setMetaConfigStatus({ 
          type: 'error', 
          message: result.error || 'Connection test failed. Please check your credentials.' 
        });
      }
    } catch (error) {
      setMetaConfigStatus({ type: 'error', message: error.message || 'Connection test failed.' });
    } finally {
      setMetaTestingConnection(false);
    }
  };

  // Fetch Meta WhatsApp messages
  const fetchMetaMessages = async () => {
    if (!tallylocId || !coGuid) {
      setMetaMessagesError('Please select a company first.');
      return;
    }

    setMetaMessagesLoading(true);
    setMetaMessagesError(null);

    try {
      const config = await getMetaWhatsAppConfig(tallylocId, coGuid);
      if (!config) {
        setMetaMessagesError('Meta WhatsApp is not configured for this company. Please configure your Meta credentials first.');
        setMetaMessagesLoading(false);
        return;
      }

      const data = await fetchMetaWhatsAppMessages(config.accessToken, config.phoneNumberId, config.businessAccountId, { limit: 50 });
      
      // Parse messages from Meta WhatsApp response
      let parsedMessages = [];
      if (data && data.messages) {
        parsedMessages = data.messages;
      } else if (Array.isArray(data)) {
        parsedMessages = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        parsedMessages = data.data;
      }

      // Sort messages by timestamp (newest first)
      parsedMessages.sort((a, b) => {
        const timeA = a.timestamp || a.time || a.createdAt || 0;
        const timeB = b.timestamp || b.time || b.createdAt || 0;
        return timeB - timeA;
      });

      setMetaMessages(parsedMessages);
      setMetaLastFetchTime(new Date());
      setMetaMessagesError(null);
    } catch (error) {
      console.error('Error fetching Meta WhatsApp messages:', error);
      setMetaMessagesError(error.message || 'An unexpected error occurred while fetching messages.');
      setMetaMessages([]);
    } finally {
      setMetaMessagesLoading(false);
    }
  };

  // Send Meta WhatsApp reply
  const handleSendMetaReply = async (message) => {
    if (!metaReplyText.trim()) {
      return;
    }

    if (!tallylocId || !coGuid) {
      setMetaConfigStatus({ type: 'error', message: 'Please select a company first.' });
      return;
    }

    setMetaSendingReply(true);

    try {
      const config = await getMetaWhatsAppConfig(tallylocId, coGuid);
      if (!config) {
        setMetaConfigStatus({ type: 'error', message: 'Meta WhatsApp is not configured. Please configure your credentials first.' });
        setMetaSendingReply(false);
        return;
      }

      // Extract sender phone number from message
      const senderNumber = message.from || message.phoneNumber || message.sender || message.source || message.wa_id;
      if (!senderNumber) {
        setMetaConfigStatus({ type: 'error', message: 'Could not determine sender phone number.' });
        setMetaSendingReply(false);
        return;
      }

      await sendMetaWhatsAppMessage(
        config.accessToken,
        config.phoneNumberId,
        config.businessAccountId,
        senderNumber,
        metaReplyText.trim()
      );

      setMetaConfigStatus({ type: 'success', message: 'Message sent successfully!' });
      setMetaReplyText('');
      setMetaReplyingTo(null);
      
      // Refresh messages after sending
      setTimeout(() => {
        fetchMetaMessages();
      }, 1000);
    } catch (error) {
      console.error('Error sending Meta WhatsApp reply:', error);
      setMetaConfigStatus({ type: 'error', message: error.message || 'Failed to send message.' });
    } finally {
      setMetaSendingReply(false);
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return 'Unknown';
    // Remove country code prefix if present and format
    return phone.replace(/^\+?91/, '').replace(/(\d{5})(\d{5})/, '$1 $2');
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div style={{
      padding: '24px',
      maxWidth: '100%',
      minHeight: 'calc(100vh - 140px)',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span className="material-icons" style={{ fontSize: '28px', color: '#25D366' }}>
              chat
            </span>
            WhatsApp Messages
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            fontSize: '14px',
            color: '#64748b'
          }}>
            Configure Gupshup and manage WhatsApp messages
          </p>
        </div>
      </div>

      {/* Configuration Section */}
      <div style={{
        marginBottom: '32px',
        padding: '24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px', color: '#3b82f6' }}>
              settings
            </span>
            Gupshup Configuration
          </h3>
          {isConfigured && (
            <span style={{
              padding: '6px 12px',
              background: '#d1fae5',
              color: '#065f46',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              Configured
            </span>
          )}
        </div>

        {/* Status Message */}
        {configStatus && (
          <div style={{
            padding: '12px 16px',
            background: configStatus.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${configStatus.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '18px', 
              color: configStatus.type === 'error' ? '#dc2626' : '#16a34a',
              flexShrink: 0 
            }}>
              {configStatus.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: configStatus.type === 'error' ? '#991b1b' : '#166534',
              fontWeight: 500
            }}>
              {configStatus.message}
            </p>
          </div>
        )}

        {/* Configuration Form */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              API Key *
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter Gupshup API Key"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              App ID *
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Enter Gupshup App ID"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              App Name *
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter Gupshup App Name"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              Source Number
            </label>
            <input
              type="text"
              value={sourceNumber}
              onChange={(e) => setSourceNumber(e.target.value)}
              placeholder="Enter source phone number"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleSaveConfig}
            disabled={configSaving || configLoading}
            style={{
              padding: '10px 20px',
              background: (configSaving || configLoading) ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (configSaving || configLoading) ? 'not-allowed' : 'pointer',
              boxShadow: (configSaving || configLoading) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!configSaving && !configLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = (configSaving || configLoading) ? 'none' : '0 2px 8px rgba(59, 130, 246, 0.25)';
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {configSaving ? 'hourglass_empty' : 'save'}
            </span>
            {configSaving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testingConnection || !apiKey || !appId || !appName}
            style={{
              padding: '10px 20px',
              background: (testingConnection || !apiKey || !appId || !appName) ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (testingConnection || !apiKey || !appId || !appName) ? 'not-allowed' : 'pointer',
              boxShadow: (testingConnection || !apiKey || !appId || !appName) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!testingConnection && apiKey && appId && appName) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = (testingConnection || !apiKey || !appId || !appName) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.25)';
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {testingConnection ? 'hourglass_empty' : 'wifi_tethering'}
            </span>
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Meta WhatsApp Business API Section */}
      <div style={{
        marginBottom: '32px',
        padding: '24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '20px', color: '#1877F2' }}>
              facebook
            </span>
            Meta WhatsApp Business API
          </h3>
          {metaIsConfigured && (
            <span style={{
              padding: '6px 12px',
              background: '#d1fae5',
              color: '#065f46',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600
            }}>
              Configured
            </span>
          )}
        </div>

        {/* Status Message */}
        {metaConfigStatus && (
          <div style={{
            padding: '12px 16px',
            background: metaConfigStatus.type === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${metaConfigStatus.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ 
              fontSize: '18px', 
              color: metaConfigStatus.type === 'error' ? '#dc2626' : '#16a34a',
              flexShrink: 0 
            }}>
              {metaConfigStatus.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: metaConfigStatus.type === 'error' ? '#991b1b' : '#166534',
              fontWeight: 500
            }}>
              {metaConfigStatus.message}
            </p>
          </div>
        )}

        {/* Facebook Login Section */}
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              color: '#1e293b'
            }}>
              Facebook Authentication
            </h4>
            {metaFacebookLoginStatus && (
              <span style={{
                padding: '4px 12px',
                background: metaFacebookLoginStatus.status === 'connected' ? '#d1fae5' : '#fee2e2',
                color: metaFacebookLoginStatus.status === 'connected' ? '#065f46' : '#991b1b',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                {metaFacebookLoginStatus.status === 'connected' ? 'Connected' : 
                 metaFacebookLoginStatus.status === 'not_authorized' ? 'Not Authorized' : 'Unknown'}
              </span>
            )}
          </div>
          <p style={{
            margin: '0 0 16px 0',
            fontSize: '13px',
            color: '#64748b'
          }}>
            Login with Facebook to get your access token automatically, or enter it manually below.
          </p>
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {metaFacebookLoginStatus && metaFacebookLoginStatus.status === 'connected' ? (
              <button
                onClick={handleFacebookLogout}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  logout
                </span>
                Logout from Facebook
              </button>
            ) : (
              <button
                onClick={handleFacebookLogin}
                disabled={metaFacebookLoggingIn}
                style={{
                  padding: '10px 20px',
                  background: metaFacebookLoggingIn ? '#94a3b8' : 'linear-gradient(135deg, #1877F2 0%, #1565C0 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: metaFacebookLoggingIn ? 'not-allowed' : 'pointer',
                  boxShadow: metaFacebookLoggingIn ? 'none' : '0 2px 8px rgba(24, 119, 242, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span className="material-icons" style={{ fontSize: '18px' }}>
                  {metaFacebookLoggingIn ? 'hourglass_empty' : 'facebook'}
                </span>
                {metaFacebookLoggingIn ? 'Logging in...' : 'Login with Facebook'}
              </button>
            )}
          </div>
        </div>

        {/* Configuration Form */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              WhatsApp Business Phone Number
            </label>
            <input
              type="text"
              value={metaPhoneNumber}
              onChange={(e) => setMetaPhoneNumber(e.target.value)}
              placeholder="e.g., +1234567890"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              Meta App ID *
            </label>
            <input
              type="text"
              value={metaAppId}
              onChange={(e) => setMetaAppId(e.target.value)}
              placeholder="Enter Meta App ID"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              Access Token *
            </label>
            <input
              type="password"
              value={metaAccessToken}
              onChange={(e) => setMetaAccessToken(e.target.value)}
              placeholder="From Facebook login or manual entry"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              Phone Number ID *
            </label>
            <input
              type="text"
              value={metaPhoneNumberId}
              onChange={(e) => setMetaPhoneNumberId(e.target.value)}
              placeholder="Enter Phone Number ID"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              marginBottom: '6px'
            }}>
              Business Account ID *
            </label>
            <input
              type="text"
              value={metaBusinessAccountId}
              onChange={(e) => setMetaBusinessAccountId(e.target.value)}
              placeholder="Enter Business Account ID"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleSaveMetaConfig}
            disabled={metaConfigSaving || metaConfigLoading}
            style={{
              padding: '10px 20px',
              background: (metaConfigSaving || metaConfigLoading) ? '#94a3b8' : 'linear-gradient(135deg, #1877F2 0%, #1565C0 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (metaConfigSaving || metaConfigLoading) ? 'not-allowed' : 'pointer',
              boxShadow: (metaConfigSaving || metaConfigLoading) ? 'none' : '0 2px 8px rgba(24, 119, 242, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {metaConfigSaving ? 'hourglass_empty' : 'save'}
            </span>
            {metaConfigSaving ? 'Saving...' : 'Save Configuration'}
          </button>

          <button
            onClick={handleTestMetaConnection}
            disabled={metaTestingConnection || !metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId}
            style={{
              padding: '10px 20px',
              background: (metaTestingConnection || !metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId) ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (metaTestingConnection || !metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId) ? 'not-allowed' : 'pointer',
              boxShadow: (metaTestingConnection || !metaAccessToken || !metaPhoneNumberId || !metaBusinessAccountId) ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {metaTestingConnection ? 'hourglass_empty' : 'wifi_tethering'}
            </span>
            {metaTestingConnection ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Meta WhatsApp Messages Section */}
      <div style={{
        padding: '24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span className="material-icons" style={{ fontSize: '24px', color: '#25D366' }}>
                chat_bubble
              </span>
              Meta WhatsApp Messages
            </h3>
            {metaLastFetchTime && (
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#94a3b8'
              }}>
                Last fetched: {metaLastFetchTime.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchMetaMessages}
            disabled={metaMessagesLoading || !metaIsConfigured}
            style={{
              padding: '10px 20px',
              background: (metaMessagesLoading || !metaIsConfigured) ? '#94a3b8' : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (metaMessagesLoading || !metaIsConfigured) ? 'not-allowed' : 'pointer',
              boxShadow: (metaMessagesLoading || !metaIsConfigured) ? 'none' : '0 2px 8px rgba(37, 211, 102, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {metaMessagesLoading ? 'hourglass_empty' : 'refresh'}
            </span>
            {metaMessagesLoading ? 'Loading...' : 'Refresh Messages'}
          </button>
        </div>

        {/* Error Message */}
        {metaMessagesError && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#dc2626', flexShrink: 0 }}>
              error
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#991b1b',
              fontWeight: 500
            }}>
              {metaMessagesError}
            </p>
          </div>
        )}

        {/* Loading State */}
        {metaMessagesLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{
              fontSize: '40px',
              marginBottom: '12px',
              animation: 'spin 1s linear infinite'
            }}>
              hourglass_empty
            </span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
              Loading messages...
            </p>
          </div>
        )}

        {/* Messages List */}
        {!metaMessagesLoading && metaMessages.length > 0 && (
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff'
          }}>
            {metaMessages.map((message, index) => {
              const isReplying = metaReplyingTo === index;
              const messageText = message.text || message.message || message.content || message.body || 'No content';
              const senderNumber = message.from || message.phoneNumber || message.sender || message.source || message.wa_id || 'Unknown';
              const timestamp = message.timestamp || message.time || message.createdAt || message.date;

              return (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < metaMessages.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: '#fff'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px', color: '#25D366' }}>
                          person
                        </span>
                        <p style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#1e293b',
                          wordBreak: 'break-word'
                        }}>
                          {formatPhoneNumber(senderNumber)}
                        </p>
                      </div>
                      <p style={{
                        margin: '8px 0',
                        fontSize: '14px',
                        color: '#475569',
                        lineHeight: '1.6',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {messageText}
                      </p>
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '12px',
                        color: '#94a3b8'
                      }}>
                        {formatTimestamp(timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setMetaReplyingTo(isReplying ? null : index);
                        if (!isReplying) {
                          setMetaReplyText('');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        background: isReplying ? '#1877F2' : '#f1f5f9',
                        color: isReplying ? '#fff' : '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>
                        {isReplying ? 'close' : 'reply'}
                      </span>
                      {isReplying ? 'Cancel' : 'Reply'}
                    </button>
                  </div>

                  {/* Reply Section */}
                  {isReplying && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <textarea
                        value={metaReplyText}
                        onChange={(e) => setMetaReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#1e293b',
                          background: '#fff',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          marginBottom: '10px'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => {
                            setMetaReplyingTo(null);
                            setMetaReplyText('');
                          }}
                          disabled={metaSendingReply}
                          style={{
                            padding: '8px 16px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: metaSendingReply ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSendMetaReply(message)}
                          disabled={metaSendingReply || !metaReplyText.trim()}
                          style={{
                            padding: '8px 16px',
                            background: (metaSendingReply || !metaReplyText.trim()) ? '#94a3b8' : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: (metaSendingReply || !metaReplyText.trim()) ? 'not-allowed' : 'pointer',
                            boxShadow: (metaSendingReply || !metaReplyText.trim()) ? 'none' : '0 2px 6px rgba(37, 211, 102, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>
                            {metaSendingReply ? 'hourglass_empty' : 'send'}
                          </span>
                          {metaSendingReply ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!metaMessagesLoading && !metaMessagesError && metaMessages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: '#94a3b8',
            textAlign: 'center',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <span className="material-icons" style={{
              fontSize: '48px',
              marginBottom: '12px',
              color: '#cbd5e1'
            }}>
              chat_bubble_outline
            </span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
              No messages found
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', maxWidth: '300px' }}>
              {metaIsConfigured 
                ? 'Click "Refresh Messages" to load messages from Meta WhatsApp Business API'
                : 'Please configure Meta WhatsApp credentials first to view messages'}
            </p>
          </div>
        )}
      </div>

      {/* Messages Section */}
      <div style={{
        padding: '24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span className="material-icons" style={{ fontSize: '24px', color: '#25D366' }}>
                chat_bubble
              </span>
              Received Messages
            </h3>
            {lastFetchTime && (
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#94a3b8'
              }}>
                Last fetched: {lastFetchTime.toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={fetchMessages}
            disabled={messagesLoading || !isConfigured}
            style={{
              padding: '10px 20px',
              background: (messagesLoading || !isConfigured) ? '#94a3b8' : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: (messagesLoading || !isConfigured) ? 'not-allowed' : 'pointer',
              boxShadow: (messagesLoading || !isConfigured) ? 'none' : '0 2px 8px rgba(37, 211, 102, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!messagesLoading && isConfigured) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = (messagesLoading || !isConfigured) ? 'none' : '0 2px 8px rgba(37, 211, 102, 0.25)';
            }}
          >
            <span className="material-icons" style={{ fontSize: '18px' }}>
              {messagesLoading ? 'hourglass_empty' : 'refresh'}
            </span>
            {messagesLoading ? 'Loading...' : 'Refresh Messages'}
          </button>
        </div>

        {/* Error Message */}
        {messagesError && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#dc2626', flexShrink: 0 }}>
              error
            </span>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#991b1b',
              fontWeight: 500
            }}>
              {messagesError}
            </p>
          </div>
        )}

        {/* Loading State */}
        {messagesLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: '#64748b'
          }}>
            <span className="material-icons" style={{
              fontSize: '40px',
              marginBottom: '12px',
              animation: 'spin 1s linear infinite'
            }}>
              hourglass_empty
            </span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
              Loading messages...
            </p>
          </div>
        )}

        {/* Messages List */}
        {!messagesLoading && messages.length > 0 && (
          <div style={{
            maxHeight: '600px',
            overflowY: 'auto',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#fff'
          }}>
            {messages.map((message, index) => {
              const isReplying = replyingTo === index;
              const messageText = message.text || message.message || message.content || message.body || 'No content';
              const senderNumber = message.from || message.phoneNumber || message.sender || message.source || 'Unknown';
              const timestamp = message.timestamp || message.time || message.createdAt || message.date;

              return (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < messages.length - 1 ? '1px solid #f1f5f9' : 'none',
                    background: '#fff'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px'
                      }}>
                        <span className="material-icons" style={{ fontSize: '18px', color: '#25D366' }}>
                          person
                        </span>
                        <p style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 600,
                          color: '#1e293b',
                          wordBreak: 'break-word'
                        }}>
                          {formatPhoneNumber(senderNumber)}
                        </p>
                      </div>
                      <p style={{
                        margin: '8px 0',
                        fontSize: '14px',
                        color: '#475569',
                        lineHeight: '1.6',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {messageText}
                      </p>
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: '12px',
                        color: '#94a3b8'
                      }}>
                        {formatTimestamp(timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setReplyingTo(isReplying ? null : index);
                        if (!isReplying) {
                          setReplyText('');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        background: isReplying ? '#3b82f6' : '#f1f5f9',
                        color: isReplying ? '#fff' : '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        if (!isReplying) {
                          e.currentTarget.style.background = '#e2e8f0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isReplying) {
                          e.currentTarget.style.background = '#f1f5f9';
                        }
                      }}
                    >
                      <span className="material-icons" style={{ fontSize: '16px' }}>
                        {isReplying ? 'close' : 'reply'}
                      </span>
                      {isReplying ? 'Cancel' : 'Reply'}
                    </button>
                  </div>

                  {/* Reply Section */}
                  {isReplying && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '14px',
                          color: '#1e293b',
                          background: '#fff',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          marginBottom: '10px'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '8px'
                      }}>
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          disabled={sendingReply}
                          style={{
                            padding: '8px 16px',
                            background: '#f1f5f9',
                            color: '#475569',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: sendingReply ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSendReply(message)}
                          disabled={sendingReply || !replyText.trim()}
                          style={{
                            padding: '8px 16px',
                            background: (sendingReply || !replyText.trim()) ? '#94a3b8' : 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: (sendingReply || !replyText.trim()) ? 'not-allowed' : 'pointer',
                            boxShadow: (sendingReply || !replyText.trim()) ? 'none' : '0 2px 6px rgba(37, 211, 102, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span className="material-icons" style={{ fontSize: '16px' }}>
                            {sendingReply ? 'hourglass_empty' : 'send'}
                          </span>
                          {sendingReply ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            color: '#94a3b8',
            textAlign: 'center',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <span className="material-icons" style={{
              fontSize: '48px',
              marginBottom: '12px',
              color: '#cbd5e1'
            }}>
              chat_bubble_outline
            </span>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#64748b' }}>
              No messages found
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', maxWidth: '300px' }}>
              {isConfigured 
                ? 'Click "Refresh Messages" to load messages from Gupshup'
                : 'Please configure Gupshup credentials first to view messages'}
            </p>
          </div>
        )}
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default WhatsAppViewer;
