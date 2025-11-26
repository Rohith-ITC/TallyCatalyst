// Google Drive utility functions for image display
import { apiGet, apiPost } from './apiUtils';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';

// Cache for Google tokens to avoid repeated API calls
const tokenCache = new Map(); // key: `${tallyloc_id}_${co_guid}`, value: { token, timestamp }

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

// Refresh Google token silently
const refreshGoogleToken = async () => {
  return new Promise((resolve, reject) => {
    if (!isGoogleDriveFullyConfigured().configured) {
      reject(new Error('Google API credentials not configured'));
      return;
    }

    loadGoogleIdentityServices().then(() => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CONFIG.CLIENT_ID,
        scope: GOOGLE_DRIVE_CONFIG.SCOPES,
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        },
      });

      // Request token silently (no prompt)
      tokenClient.requestAccessToken({ prompt: '' });
    }).catch(reject);
  });
};

// Get Google token from backend configs
export const getGoogleTokenFromConfigs = async (tallylocId, coGuid) => {
  console.log('🔑 getGoogleTokenFromConfigs called:', { tallylocId, coGuid });
  
  if (!tallylocId || !coGuid) {
    console.log('❌ Missing tallylocId or coGuid');
    return null;
  }

  const cacheKey = `${tallylocId}_${coGuid}`;
  const cached = tokenCache.get(cacheKey);
  
  // Return cached token if available and not too old (cache for 5 minutes)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log('✅ Using cached token');
    return cached.token;
  }

  try {
    const cacheBuster = Date.now();
    console.log('📡 Fetching configs from API...');
    const data = await apiGet(`/api/cmpconfig/list?tallyloc_id=${tallylocId}&co_guid=${coGuid}&ts=${cacheBuster}`);
    
    if (!data) {
      console.log('❌ No data returned from API');
      return null;
    }

    console.log('📥 Config API response received:', { 
      hasSuccess: !!data.success, 
      hasData: !!data.data,
      isArray: Array.isArray(data.data)
    });

    // Handle different response structures
    let configs = [];
    if (data.success && Array.isArray(data.data)) {
      configs = data.data;
    } else if (data.success && data.data && !Array.isArray(data.data)) {
      configs = data.data.configurations || data.data.configs || [];
    } else if (Array.isArray(data.data)) {
      configs = data.data;
    } else if (data.configurations || data.configs) {
      configs = data.configurations || data.configs || [];
    } else if (Array.isArray(data)) {
      configs = data;
    } else {
      configs = data.configurations || data.configs || data.list || [];
    }

    console.log('📋 Found configs:', configs.length);

    // Find google_token config
    const tokenConfig = configs.find(c => c.config_key === 'google_token');
    const token = tokenConfig?.permission_value || tokenConfig?.config_value || null;

    if (token) {
      console.log('✅ Google token found in configs');
      // Cache the token
      tokenCache.set(cacheKey, { token, timestamp: Date.now() });
      return token;
    }

    console.log('⚠️ No google_token config found');
    return null;
  } catch (error) {
    console.error('❌ Error fetching Google token from configs:', error);
    return null;
  }
};

// Extract file ID from Google Drive URL or return as-is if already a file ID
const extractFileId = (imagePath) => {
  if (!imagePath) return null;

  console.log('🔍 extractFileId: Input:', imagePath?.substring(0, 100));

  // If it's already a file ID (alphanumeric, typically 25-33 chars, but can be shorter)
  // Google Drive file IDs are usually 25-33 characters but can vary
  if (/^[a-zA-Z0-9_-]{15,}$/.test(imagePath.trim())) {
    const fileId = imagePath.trim();
    console.log('🔍 extractFileId: Detected as file ID:', fileId.substring(0, 50));
    return fileId;
  }

  // Extract from Google Drive URL patterns
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/FILE_ID
    /[?&]id=([a-zA-Z0-9_-]+)/,      // ?id=FILE_ID or &id=FILE_ID
    /\/d\/([a-zA-Z0-9_-]+)/,        // /d/FILE_ID
    /drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/, // Full Google Drive URL with id param
  ];

  for (const pattern of patterns) {
    const match = imagePath.match(pattern);
    if (match && match[1]) {
      console.log('🔍 extractFileId: Extracted from URL:', match[1].substring(0, 50));
      return match[1];
    }
  }

  // If it's a Google Drive public URL (uc?export=view), extract the file ID so we can use authenticated URL
  if (imagePath.includes('drive.google.com') && imagePath.includes('id=')) {
    const idMatch = imagePath.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      console.log('🔍 extractFileId: Extracted file ID from Google Drive public URL:', idMatch[1].substring(0, 50));
      return idMatch[1];
    }
  }

  // If it's a direct URL (http/https) that's not Google Drive, return as-is
  if (/^https?:\/\//.test(imagePath) && !imagePath.includes('drive.google.com')) {
    console.log('🔍 extractFileId: Direct URL (not Google Drive)');
    return imagePath;
  }

  console.log('❌ extractFileId: Could not extract file ID from:', imagePath?.substring(0, 100));
  return null;
};

// Cache for blob URLs to avoid re-fetching
const blobUrlCache = new Map(); // key: fileId_token, value: blobUrl

// Get Google Drive image URL with authentication
// Since img tags can't use custom headers, we fetch the image and create a blob URL
export const getGoogleDriveImageUrl = async (imagePath, accessToken) => {
  console.log('🖼️ getGoogleDriveImageUrl called:', { imagePath: imagePath?.substring(0, 50), hasToken: !!accessToken });
  
  if (!imagePath) {
    console.log('❌ No imagePath provided');
    return null;
  }

  // Extract file ID from path
  let fileIdOrUrl = extractFileId(imagePath);
  console.log('🔍 Extracted file ID/URL:', fileIdOrUrl?.substring(0, 50));

  if (!fileIdOrUrl) {
    console.log('❌ Could not extract file ID from:', imagePath);
    return null;
  }

  // If it's a Google Drive public URL, extract the file ID (don't use public URL - it fails with 403)
  if (fileIdOrUrl.includes('drive.google.com/uc?export=view') || fileIdOrUrl.includes('drive.google.com/file/d/')) {
    console.warn('⚠️ WARNING: Public Google Drive URL detected! Extracting file ID to use authenticated URL instead.');
    const idMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) || fileIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      fileIdOrUrl = idMatch[1];
      console.log('✅ Extracted file ID from public URL:', fileIdOrUrl.substring(0, 50));
    } else {
      console.error('❌ Could not extract file ID from Google Drive URL');
      return null;
    }
  }

  // If it's a direct URL that's NOT Google Drive, return as-is
  if (/^https?:\/\//.test(fileIdOrUrl) && !fileIdOrUrl.includes('drive.google.com')) {
    console.log('✅ Using direct URL (not Google Drive):', fileIdOrUrl.substring(0, 50));
    return fileIdOrUrl;
  }

  // At this point, fileIdOrUrl should be a file ID (not a URL)
  // If it's still a URL, something went wrong
  if (/^https?:\/\//.test(fileIdOrUrl)) {
    console.error('❌ Still have a URL after processing, this should not happen:', fileIdOrUrl.substring(0, 50));
    return null;
  }

  const fileId = fileIdOrUrl;
  
  // Check blob URL cache first
  const cacheKey = `${fileId}_${accessToken || 'no-token'}`;
  if (blobUrlCache.has(cacheKey)) {
    console.log('✅ Using cached blob URL');
    return blobUrlCache.get(cacheKey);
  }

  // If we have an access token, fetch image and create blob URL
  if (accessToken) {
    try {
      const authenticatedUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      console.log('📡 Fetching from Google Drive API with token:', authenticatedUrl.substring(0, 80));
      
      const response = await fetch(authenticatedUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlCache.set(cacheKey, blobUrl);
        console.log('✅ Created blob URL successfully:', blobUrl.substring(0, 50));
        return blobUrl;
      } else if (response.status === 401) {
        console.warn('⚠️ Token expired (401), attempting refresh...');
        // Token expired, try to refresh
        try {
          const refreshedToken = await refreshGoogleToken();
          if (refreshedToken) {
            console.log('✅ Token refreshed, retrying...');
            // Try again with refreshed token
            const retryResponse = await fetch(authenticatedUrl, {
              headers: {
                'Authorization': `Bearer ${refreshedToken}`
              }
            });
            
            if (retryResponse.ok) {
              const blob = await retryResponse.blob();
              const blobUrl = URL.createObjectURL(blob);
              const newCacheKey = `${fileId}_${refreshedToken}`;
              blobUrlCache.set(newCacheKey, blobUrl);
              console.log('✅ Created blob URL with refreshed token');
              return blobUrl;
            } else {
              console.error('❌ Retry failed with status:', retryResponse.status);
              // Don't fall through to public URL - throw error instead
              throw new Error(`Failed to fetch image after token refresh: ${retryResponse.status}`);
            }
          } else {
            throw new Error('Token refresh returned no token');
          }
        } catch (refreshError) {
          console.error('❌ Failed to refresh Google token:', refreshError);
          throw refreshError; // Don't fall through to public URL
        }
      } else {
        console.error('❌ Google Drive API error:', response.status, response.statusText);
        const errorText = await response.text().catch(() => '');
        console.error('❌ Error details:', errorText.substring(0, 200));
        // For 403/404, don't use public URL - it won't work for private files
        throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error fetching Google Drive image:', error);
      // Re-throw to prevent fallback to public URL
      throw error;
    }
  } else {
    console.warn('⚠️ No access token available - cannot fetch private Google Drive files');
    console.warn('⚠️ Returning null instead of public URL (public URL will fail with 403 for private files)');
    // Don't use public URL for private files - it will fail with 403
    // Return null so the component can show placeholder
    return null;
  }
};

// Clear token cache (useful when token is updated)
export const clearTokenCache = (tallylocId, coGuid) => {
  if (tallylocId && coGuid) {
    const cacheKey = `${tallylocId}_${coGuid}`;
    tokenCache.delete(cacheKey);
  } else {
    tokenCache.clear();
  }
};

