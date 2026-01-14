// Utility functions for Meta WhatsApp Business API integration
import { getCompanyConfigValue } from './companyConfigUtils';
import { apiGet, apiPost } from './apiUtils';
import { API_CONFIG, META_WHATSAPP_CONFIG } from '../config';

/**
 * Check if Facebook SDK is loaded and initialized
 * @returns {Promise<boolean>} - True if SDK is ready
 */
export const isFacebookSDKReady = () => {
  return new Promise((resolve) => {
    if (window.FB) {
      resolve(true);
      return;
    }

    // Wait for SDK to load (max 10 seconds)
    let attempts = 0;
    const maxAttempts = 20;
    const checkInterval = setInterval(() => {
      attempts++;
      if (window.FB) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 500);
  });
};

/**
 * Get Facebook login status
 * @returns {Promise<Object>} - Login status response
 */
export const getFacebookLoginStatus = async () => {
  const isReady = await isFacebookSDKReady();
  if (!isReady) {
    throw new Error('Facebook SDK is not loaded. Please refresh the page.');
  }

  return new Promise((resolve, reject) => {
    window.FB.getLoginStatus((response) => {
      if (response.error) {
        reject(new Error(response.error.message || 'Failed to get login status'));
      } else {
        resolve(response);
      }
    });
  });
};

/**
 * Login to Facebook
 * @param {Array<string>} permissions - Permissions to request (default: ['email'])
 * @returns {Promise<Object>} - Login response with access token
 */
export const loginToFacebook = async (permissions = ['email']) => {
  const isReady = await isFacebookSDKReady();
  if (!isReady) {
    throw new Error('Facebook SDK is not loaded. Please refresh the page.');
  }

  return new Promise((resolve, reject) => {
    window.FB.login((response) => {
      if (response.error) {
        reject(new Error(response.error.message || 'Facebook login failed'));
      } else if (response.authResponse) {
        resolve(response);
      } else {
        reject(new Error('Facebook login was cancelled or failed'));
      }
    }, { scope: permissions.join(',') });
  });
};

/**
 * Logout from Facebook
 * @returns {Promise<void>}
 */
export const logoutFromFacebook = async () => {
  const isReady = await isFacebookSDKReady();
  if (!isReady) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.FB.logout(() => {
      resolve();
    });
  });
};

/**
 * Get Meta WhatsApp configuration from company configs
 * @param {number} tallylocId - Tally location ID
 * @param {string} coGuid - Company GUID
 * @returns {Promise<Object|null>} - Configuration object with appId, accessToken, phoneNumberId, businessAccountId, phoneNumber
 */
export const getMetaWhatsAppConfig = async (tallylocId, coGuid) => {
  if (!tallylocId || !coGuid) {
    return null;
  }

  try {
    const [appId, accessToken, phoneNumberId, businessAccountId, phoneNumber] = await Promise.all([
      getCompanyConfigValue('meta_whatsapp_app_id', tallylocId, coGuid),
      getCompanyConfigValue('meta_whatsapp_access_token', tallylocId, coGuid),
      getCompanyConfigValue('meta_whatsapp_phone_number_id', tallylocId, coGuid),
      getCompanyConfigValue('meta_whatsapp_business_account_id', tallylocId, coGuid),
      getCompanyConfigValue('meta_whatsapp_phone_number', tallylocId, coGuid)
    ]);

  // Use environment variable app ID as fallback
    const finalAppId = appId || META_WHATSAPP_CONFIG.APP_ID;

    if (!finalAppId || !accessToken || !phoneNumberId || !businessAccountId) {
      return null;
    }

    return {
      appId: finalAppId,
      accessToken,
      phoneNumberId,
      businessAccountId,
      phoneNumber: phoneNumber || ''
    };
  } catch (error) {
    console.error('Error fetching Meta WhatsApp config:', error);
    return null;
  }
};

/**
 * Fetch WhatsApp messages from Meta WhatsApp Business API via backend proxy
 * @param {string} accessToken - Meta access token
 * @param {string} phoneNumberId - Phone number ID
 * @param {string} businessAccountId - Business account ID
 * @param {Object} options - Optional parameters (limit, offset, etc.)
 * @returns {Promise<Object>} - Messages data
 */
export const fetchMetaWhatsAppMessages = async (accessToken, phoneNumberId, businessAccountId, options = {}) => {
  if (!accessToken || !phoneNumberId || !businessAccountId) {
    throw new Error('Missing required Meta WhatsApp configuration');
  }

  try {
    const { limit = 50, offset = 0 } = options;
    
    // Call backend endpoint which will proxy to Meta WhatsApp Business API
    const payload = {
      accessToken,
      phoneNumberId,
      businessAccountId,
      limit,
      offset
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.META_WHATSAPP_FETCH_MESSAGES, payload);
    
    if (!data) {
      throw new Error('No response from server');
    }

    // Handle error responses
    if (data.status === 'error' || data.error) {
      // Check for 404 or endpoint not found
      if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
        throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.');
      }
      throw new Error(data.message || data.error?.message || data.error || 'Failed to fetch messages');
    }

    // Normalize response structure
    // Backend should return { messages: [...] } or { data: { messages: [...] } }
    let messages = [];
    if (data.messages && Array.isArray(data.messages)) {
      messages = data.messages;
    } else if (data.data && data.data.messages && Array.isArray(data.data.messages)) {
      messages = data.data.messages;
    } else if (Array.isArray(data)) {
      messages = data;
    } else if (data.data && Array.isArray(data.data)) {
      messages = data.data;
    }
    
    return { messages };
  } catch (error) {
    console.error('Error fetching Meta WhatsApp messages:', error);
    
    // Check if it's a 404 error
    if (error.message && (error.message.includes('404') || error.message.includes('NOT_FOUND'))) {
      throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.');
    }
    
    throw error;
  }
};

/**
 * Send WhatsApp message via Meta WhatsApp Business API via backend proxy
 * @param {string} accessToken - Meta access token
 * @param {string} phoneNumberId - Phone number ID
 * @param {string} businessAccountId - Business account ID
 * @param {string} destination - Destination phone number (with country code, no +)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} - Send response
 */
export const sendMetaWhatsAppMessage = async (accessToken, phoneNumberId, businessAccountId, destination, message) => {
  if (!accessToken || !phoneNumberId || !businessAccountId || !destination || !message) {
    throw new Error('Missing required parameters for sending message');
  }

  try {
    // Format destination number (remove + if present, ensure it starts with country code)
    const formattedDestination = destination.replace(/^\+/, '').replace(/\s/g, '');
    
    // Call backend endpoint which will proxy to Meta WhatsApp Business API
    const payload = {
      accessToken,
      phoneNumberId,
      businessAccountId,
      destination: formattedDestination,
      message
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.META_WHATSAPP_SEND_MESSAGE, payload);
    
    if (!data) {
      throw new Error('No response from server');
    }

    // Handle error responses
    if (data.status === 'error' || data.error) {
      // Check for 404 or endpoint not found
      if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
        throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.');
      }
      throw new Error(data.message || data.error?.message || data.error || 'Failed to send message');
    }

    return data;
  } catch (error) {
    console.error('Error sending Meta WhatsApp message:', error);
    
    // Check if it's a 404 error
    if (error.message && (error.message.includes('404') || error.message.includes('NOT_FOUND'))) {
      throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.');
    }
    
    throw error;
  }
};

/**
 * Test Meta WhatsApp connection via backend proxy
 * @param {string} accessToken - Meta access token
 * @param {string} phoneNumberId - Phone number ID
 * @param {string} businessAccountId - Business account ID
 * @returns {Promise<{success: boolean, error?: string}>} - Result object with success status and optional error message
 */
export const testMetaWhatsAppConnection = async (accessToken, phoneNumberId, businessAccountId) => {
  try {
    // Call backend endpoint to test connection
    const payload = {
      accessToken,
      phoneNumberId,
      businessAccountId
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.META_WHATSAPP_TEST_CONNECTION, payload);
    
    if (!data) {
      return { success: false, error: 'No response from server' };
    }

    // Check for 404 or endpoint not found
    if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
      return { 
        success: false, 
        error: 'Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.' 
      };
    }

    // Check if test was successful
    if (data.status === 'success' || data.success === true) {
      return { success: true };
    }

    return { success: false, error: data.message || data.error?.message || 'Connection test failed' };
  } catch (error) {
    console.error('Meta WhatsApp connection test failed:', error);
    
    // Parse error message to check for 404 or NOT_FOUND
    const errorMessage = error.message || '';
    const errorString = errorMessage.toLowerCase();
    
    // Check if it's a 404 error or NOT_FOUND
    if (errorString.includes('404') || 
        errorString.includes('not_found') || 
        errorString.includes('not found') ||
        errorString.includes('endpoint not found')) {
      return { 
        success: false, 
        error: 'Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.' 
      };
    }
    
    // Try to parse JSON from error message if it contains JSON
    try {
      const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const errorJson = JSON.parse(jsonMatch[0]);
        if (errorJson.error && (errorJson.error.code === 'NOT_FOUND' || errorJson.error.message?.includes('not found'))) {
          return { 
            success: false, 
            error: 'Backend endpoint not implemented. Please contact your administrator to implement the Meta WhatsApp API endpoints.' 
          };
        }
      }
    } catch (parseError) {
      // Ignore parse errors
    }
    
    return { success: false, error: errorMessage || 'Connection test failed' };
  }
};
