// Centralized API utility with automatic logout on token expiration
import { getApiUrl } from '../config';
import { addCacheBuster } from './cacheSyncManager';
import { isExternalUser, clearAllCacheForExternalUser } from './cacheUtils';

// Global logout function
const handleLogout = async () => {
  console.error('🚨🚨🚨 LOGOUT TRIGGERED 🚨🚨🚨');
  console.error('🚨 Stack trace:');
  console.trace();
  
  const sessionBefore = {
    token: !!sessionStorage.getItem('token'),
    email: sessionStorage.getItem('email'),
    company: sessionStorage.getItem('company'),
    allKeys: Object.keys(sessionStorage)
  };
  
  console.error('🚨 SessionStorage BEFORE clear:', sessionBefore);
  
  // Clear cache for external users before clearing sessionStorage
  try {
    const accessType = sessionStorage.getItem('access_type') || '';
    if (accessType.toLowerCase() === 'external' || isExternalUser()) {
      console.log('🧹 Clearing cache for external user on logout...');
      await clearAllCacheForExternalUser();
    }
  } catch (error) {
    console.error('Error clearing cache on logout:', error);
    // Continue with logout even if cache clearing fails
  }
  
  console.error('🚨 Redirecting to:', process.env.REACT_APP_HOMEPAGE || '/');
  
  sessionStorage.clear();
  
  console.error('🚨 SessionStorage CLEARED');
  console.error('🚨 SessionStorage AFTER clear:', {
    allKeys: Object.keys(sessionStorage),
    size: Object.keys(sessionStorage).length
  });
  
  window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
};

// Enhanced fetch wrapper with token expiration handling
export const apiFetch = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem('token');
  
  // Debug: Log API call
  console.log('🌐 API Call:', {
    endpoint,
    method: options.method || 'GET',
    hasToken: !!token,
    timestamp: new Date().toISOString()
  });
  
  // Add authorization header if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const apiUrl = getApiUrl(endpoint);
  
  // Debug: Log full API URL in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🌐 API URL:', apiUrl);
  }
  
  try {
    const response = await fetch(apiUrl, {
      ...options,
      headers,
    });

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      // Debug: Check if token exists before logging out
      const currentToken = sessionStorage.getItem('token');
      const currentEmail = sessionStorage.getItem('email');
      
      console.error('🔴 API Auth Error:', {
        endpoint,
        status: response.status,
        hasToken: !!currentToken,
        hasEmail: !!currentEmail,
        sessionKeys: Object.keys(sessionStorage),
        timestamp: new Date().toISOString()
      });
      
      // Only logout if no token exists OR if this is an auth endpoint
      const isAuthEndpoint = endpoint.includes('/login') || endpoint.includes('/signup') || 
                           endpoint.includes('/auth') || endpoint.includes('/verify-token');
      
      if (!currentToken || !currentEmail) {
        console.error('🔴 Logout reason: No token/email in sessionStorage');
        handleLogout();
        return null;
      }
      
      if (isAuthEndpoint) {
        console.error('🔴 Logout reason: Auth endpoint failed');
        handleLogout();
        return null;
      }
      
      // For data APIs, throw error instead of logging out (allows refresh to work)
      console.warn('⚠️ API 401/403 but token exists - throwing error (no logout)');
      throw new Error(`API authentication error: ${response.status} ${response.statusText}`);
    }

    console.log('✅ API Success:', { endpoint, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ API Error:', {
      endpoint,
      error: error.message,
      hasAuthError: error.message?.includes('authentication')
    });
    throw error;
  }
};

// GET request helper
export const apiGet = async (endpoint) => {
  // Add cache buster to GET requests
  const cacheBustedEndpoint = addCacheBuster(endpoint);
  const response = await apiFetch(cacheBustedEndpoint, { method: 'GET' });
  if (!response) return null;
  return response.json();
};

// POST request helper
export const apiPost = async (endpoint, data) => {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response) return null;
  
  // Handle large JSON responses with better error handling
  try {
    const text = await response.text();
    
    // Check if response is ok after reading text (since we need to read it only once)
    if (!response.ok) {
      // Try to parse JSON error response
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        if (text) {
          const errorObj = JSON.parse(text);
          // Prefer error field, then message field, then use the full object
          if (errorObj.error) {
            errorMessage = errorObj.error;
          } else if (errorObj.message) {
            errorMessage = errorObj.message;
          } else {
            errorMessage = `${errorMessage}. ${text.substring(0, 500)}`;
          }
        }
      } catch (parseError) {
        // If JSON parsing fails, include the text in the error message
        errorMessage = `${errorMessage}. ${text ? text.substring(0, 500) : 'No response body'}`;
      }
      throw new Error(errorMessage);
    }
    
    if (!text) {
      throw new Error('Empty response from server');
    }
    
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text length:', text.length);
      console.error('Response preview (first 500 chars):', text.substring(0, 500));
      throw new Error(`Failed to parse JSON response: ${parseError.message}`);
    }
  } catch (error) {
    if (error.message.includes('parse') || error.message.includes('JSON')) {
      throw error;
    }
    throw new Error(`Failed to read response: ${error.message}`);
  }
};

// PUT request helper
export const apiPut = async (endpoint, data = null) => {
  const options = { method: 'PUT' };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const response = await apiFetch(endpoint, options);
  if (!response) return null;
  return response.json();
};

// DELETE request helper
export const apiDelete = async (endpoint) => {
  const response = await apiFetch(endpoint, { method: 'DELETE' });
  if (!response) return null;
  return response.json();
};
