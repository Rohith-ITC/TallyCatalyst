// Utility functions for Gupshup WhatsApp API integration
import { getCompanyConfigValue } from './companyConfigUtils';
import { apiGet, apiPost } from './apiUtils';
import { API_CONFIG } from '../config';

/**
 * Get Gupshup configuration from company configs
 * @param {number} tallylocId - Tally location ID
 * @param {string} coGuid - Company GUID
 * @returns {Promise<Object|null>} - Configuration object with apiKey, appId, appName, sourceNumber
 */
export const getGupshupConfig = async (tallylocId, coGuid) => {
  if (!tallylocId || !coGuid) {
    return null;
  }

  try {
    const [apiKey, appId, appName, sourceNumber] = await Promise.all([
      getCompanyConfigValue('gupshup_api_key', tallylocId, coGuid),
      getCompanyConfigValue('gupshup_app_id', tallylocId, coGuid),
      getCompanyConfigValue('gupshup_app_name', tallylocId, coGuid),
      getCompanyConfigValue('gupshup_source_number', tallylocId, coGuid)
    ]);

    if (!apiKey || !appId || !appName) {
      return null;
    }

    return {
      apiKey,
      appId,
      appName,
      sourceNumber: sourceNumber || ''
    };
  } catch (error) {
    console.error('Error fetching Gupshup config:', error);
    return null;
  }
};

/**
 * Fetch WhatsApp messages from Gupshup API via backend proxy
 * @param {string} apiKey - Gupshup API Key
 * @param {string} appId - Gupshup App ID
 * @param {string} appName - Gupshup App Name
 * @param {Object} options - Optional parameters (limit, offset, etc.)
 * @returns {Promise<Object>} - Messages data
 */
export const fetchWhatsAppMessages = async (apiKey, appId, appName, options = {}) => {
  if (!apiKey || !appId || !appName) {
    throw new Error('Missing required Gupshup configuration');
  }

  try {
    const { limit = 50, offset = 0 } = options;
    
    // Call backend endpoint which will proxy to Gupshup API
    const payload = {
      apiKey,
      appId,
      appName,
      limit,
      offset
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.GUPSHUP_FETCH_MESSAGES, payload);
    
    if (!data) {
      throw new Error('No response from server');
    }

    // Handle error responses
    if (data.status === 'error' || data.error) {
      // Check for 404 or endpoint not found
      if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
        throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.');
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
    console.error('Error fetching WhatsApp messages:', error);
    
    // Check if it's a 404 error
    if (error.message && (error.message.includes('404') || error.message.includes('NOT_FOUND'))) {
      throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.');
    }
    
    throw error;
  }
};

/**
 * Send WhatsApp message via Gupshup API via backend proxy
 * @param {string} apiKey - Gupshup API Key
 * @param {string} appId - Gupshup App ID
 * @param {string} appName - Gupshup App Name
 * @param {string} sourceNumber - Source phone number
 * @param {string} destination - Destination phone number (with country code, no +)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} - Send response
 */
export const sendWhatsAppMessage = async (apiKey, appId, appName, sourceNumber, destination, message) => {
  if (!apiKey || !appId || !appName || !sourceNumber || !destination || !message) {
    throw new Error('Missing required parameters for sending message');
  }

  try {
    // Format destination number (remove + if present, ensure it starts with country code)
    const formattedDestination = destination.replace(/^\+/, '').replace(/\s/g, '');
    
    // Call backend endpoint which will proxy to Gupshup API
    const payload = {
      apiKey,
      appId,
      appName,
      sourceNumber,
      destination: formattedDestination,
      message
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.GUPSHUP_SEND_MESSAGE, payload);
    
    if (!data) {
      throw new Error('No response from server');
    }

    // Handle error responses
    if (data.status === 'error' || data.error) {
      // Check for 404 or endpoint not found
      if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
        throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.');
      }
      throw new Error(data.message || data.error?.message || data.error || 'Failed to send message');
    }

    return data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Check if it's a 404 error
    if (error.message && (error.message.includes('404') || error.message.includes('NOT_FOUND'))) {
      throw new Error('Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.');
    }
    
    throw error;
  }
};

/**
 * Test Gupshup connection via backend proxy
 * @param {string} apiKey - Gupshup API Key
 * @param {string} appId - Gupshup App ID
 * @param {string} appName - Gupshup App Name
 * @returns {Promise<{success: boolean, error?: string}>} - Result object with success status and optional error message
 */
export const testGupshupConnection = async (apiKey, appId, appName) => {
  try {
    // Call backend endpoint to test connection
    const payload = {
      apiKey,
      appId,
      appName
    };

    const data = await apiPost(API_CONFIG.ENDPOINTS.GUPSHUP_TEST_CONNECTION, payload);
    
    if (!data) {
      return { success: false, error: 'No response from server' };
    }

    // Check for 404 or endpoint not found
    if (data.error && (data.error.code === 'NOT_FOUND' || data.error.message?.includes('not found'))) {
      return { 
        success: false, 
        error: 'Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.' 
      };
    }

    // Check if test was successful
    if (data.status === 'success' || data.success === true) {
      return { success: true };
    }

    return { success: false, error: data.message || data.error?.message || 'Connection test failed' };
  } catch (error) {
    console.error('Gupshup connection test failed:', error);
    
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
        error: 'Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.' 
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
            error: 'Backend endpoint not implemented. Please contact your administrator to implement the Gupshup API endpoints.' 
          };
        }
      }
    } catch (parseError) {
      // Ignore parse errors
    }
    
    return { success: false, error: errorMessage || 'Connection test failed' };
  }
};
