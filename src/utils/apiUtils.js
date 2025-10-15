// Centralized API utility with automatic logout on token expiration
import { getApiUrl } from '../config';
import { addCacheBuster } from './cacheUtils';

// Global logout function
const handleLogout = () => {
  console.log('🚨 LOGOUT TRIGGERED! Stack trace:');
  console.trace();
  console.log('🚨 Current sessionStorage before clearing:', {
    token: !!sessionStorage.getItem('token'),
    email: sessionStorage.getItem('email'),
    company: sessionStorage.getItem('company')
  });
  sessionStorage.clear();
  window.location.href = process.env.REACT_APP_HOMEPAGE || '/';
};

// Enhanced fetch wrapper with token expiration handling
export const apiFetch = async (endpoint, options = {}) => {
  const token = sessionStorage.getItem('token');
  
  // Add authorization header if token exists
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(getApiUrl(endpoint), {
      ...options,
      headers,
    });

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      console.log('Token expired or invalid. Logging out...');
      handleLogout();
      return null;
    }

    return response;
  } catch (error) {
    console.error('API request failed:', error);
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
  return response.json();
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
