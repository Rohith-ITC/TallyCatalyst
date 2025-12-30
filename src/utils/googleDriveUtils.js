// Google Drive utility functions for image display
import { apiGet, apiPost } from './apiUtils';
import { GOOGLE_DRIVE_CONFIG, isGoogleDriveFullyConfigured } from '../config';
import { isExternalUser } from './cacheUtils';

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

// Validate token by making a test API call
const validateGoogleToken = async (token) => {
  if (!token) return false;
  
  try {
    // Make a lightweight API call to validate token
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token);
    if (response.ok) {
      const data = await response.json();
      // Check if token is expired (expires_in is in seconds)
      if (data.expires_in && data.expires_in > 0) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn('Token validation failed:', error);
    return false;
  }
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

// Enhanced refresh function that updates backend
export const refreshGoogleTokenAndUpdateBackend = async (tallylocId, coGuid, displayName = null, userEmail = null) => {
  return new Promise((resolve, reject) => {
    if (!isGoogleDriveFullyConfigured().configured) {
      reject(new Error('Google API credentials not configured'));
      return;
    }

    const isExternal = isExternalUser();
    if (isExternal) {
      userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
      if (!userEmail) {
        reject(new Error('External users must provide their email address'));
        return;
      }
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
            // Update backend if company info is available
            if (tallylocId && coGuid) {
              try {
                // Get display name from Google if not provided
                let userDisplayName = displayName;
                if (!userDisplayName) {
                  try {
                    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                      headers: { 'Authorization': `Bearer ${response.access_token}` }
                    });
                    if (userInfoResponse.ok) {
                      const userInfo = await userInfoResponse.json();
                      userDisplayName = userInfo.name || userInfo.displayName || userInfo.email || '';
                    }
                  } catch (err) {
                    console.warn('Failed to fetch display name:', err);
                  }
                }
                
                // Save token with user-specific support
                await saveGoogleTokenToConfigs(tallylocId, coGuid, response.access_token, userDisplayName, userEmail);
              } catch (err) {
                console.warn('⚠️ Failed to update backend with refreshed token:', err);
                // Continue anyway - token is still valid
              }
            }
            
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received'));
          }
        },
      });

      // Request token silently (no prompt) - this will refresh if user previously consented
      tokenClient.requestAccessToken({ prompt: '' });
    }).catch(reject);
  });
};

// Get and validate token from backend, auto-refresh if expired
export const getValidGoogleTokenFromConfigs = async (tallylocId, coGuid, userEmail = null) => {
  console.log('🔑 getValidGoogleTokenFromConfigs called:', { tallylocId, coGuid, userEmail });
  
  if (!tallylocId || !coGuid) {
    console.log('❌ Missing tallylocId or coGuid');
    return null;
  }

  const isExternal = isExternalUser();
  if (isExternal) {
    userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
    if (!userEmail) {
      console.log('⚠️ External user but no email provided');
      return null;
    }
  }

  try {
    // First, get the stored token (now with user-specific support)
    const storedToken = await getGoogleTokenFromConfigs(tallylocId, coGuid, userEmail);
    
    if (!storedToken) {
      console.log('⚠️ No stored token found');
      return null;
    }

    // Validate the token
    const isValid = await validateGoogleToken(storedToken);
    
    if (isValid) {
      console.log('✅ Stored token is still valid');
      return storedToken;
    }

    // Token is expired, try to refresh
    console.log('⚠️ Stored token expired, attempting refresh...');
    try {
      const refreshedToken = await refreshGoogleTokenAndUpdateBackend(tallylocId, coGuid, null, userEmail);
      console.log('✅ Token refreshed successfully');
      return refreshedToken;
    } catch (refreshError) {
      console.error('❌ Failed to refresh token:', refreshError);
      // Return null - user will need to re-authenticate
      return null;
    }
  } catch (error) {
    console.error('❌ Error in getValidGoogleTokenFromConfigs:', error);
    return null;
  }
};

// Get Google token from backend configs
export const getGoogleTokenFromConfigs = async (tallylocId, coGuid, userEmail = null) => {
  console.log('🔑 getGoogleTokenFromConfigs called:', { tallylocId, coGuid, userEmail });
  
  if (!tallylocId || !coGuid) {
    console.log('❌ Missing tallylocId or coGuid', { tallylocId, coGuid });
    return null;
  }

  // For external users, require userEmail and check user-specific token first
  const isExternal = isExternalUser();
  if (isExternal) {
    userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
    if (!userEmail) {
      console.log('⚠️ External user but no email provided');
      return null;
    }
  }

  // Build cache key (include userEmail for external users)
  const cacheKey = isExternal && userEmail 
    ? `${tallylocId}_${coGuid}_${userEmail.toLowerCase()}`
    : `${tallylocId}_${coGuid}`;
  
  const cached = tokenCache.get(cacheKey);
  
  // Return cached token if available and not too old (cache for 5 minutes)
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log('✅ Using cached token');
    return cached.token;
  }

  try {
    // For external users, include user email in API call if backend supports it
    // Otherwise, try user-specific config key pattern
    let apiUrl = `/api/cmpconfig/list?tallyloc_id=${tallylocId}&co_guid=${coGuid}`;
    if (isExternal && userEmail) {
      // Try user-specific endpoint or add email as parameter
      apiUrl += `&user_email=${encodeURIComponent(userEmail)}`;
    }
    
    console.log('📡 Fetching configs from API:', apiUrl);
    
    const data = await apiGet(apiUrl);
    
    if (!data) {
      console.log('❌ No data returned from API');
      return null;
    }

    // Parse the response - expect an array of configuration objects
    let configs = [];
    if (Array.isArray(data)) {
      configs = data;
    } else if (data.data && Array.isArray(data.data)) {
      configs = data.data;
    } else if (data.success && data.data && Array.isArray(data.data)) {
      configs = data.data;
    } else {
      console.warn('⚠️ Unexpected response format:', { 
        isArray: Array.isArray(data),
        hasData: !!data.data,
        keys: data ? Object.keys(data) : []
      });
      return null;
    }

    console.log('📋 Found configs:', configs.length);

    // For external users, look for user-specific token first
    // Config key pattern: google_token_user_{email} or check user_email field
    let tokenConfig = null;
    if (isExternal && userEmail) {
      // Try user-specific config key
      const userEmailLower = userEmail.toLowerCase();
      tokenConfig = configs.find(c => 
        c.config_key === `google_token_user_${userEmailLower}` ||
        (c.config_key === 'google_token' && c.user_email === userEmailLower)
      );
    }
    
    // Fallback to company-wide token if no user-specific token found
    if (!tokenConfig) {
      tokenConfig = configs.find(c => c.config_key === 'google_token');
      
      // External users should NOT use company-wide tokens
      if (isExternal && tokenConfig) {
        console.log('⚠️ External user attempted to use company-wide token - denying access');
        return null;
      }
    }

    if (!tokenConfig) {
      console.log('⚠️ No google_token config found in configs.');
      console.log('📋 Available config keys:', 
        configs.map(c => c.config_key).filter(Boolean).slice(0, 20)
      );
      return null;
    }

    // Log the full token config object for debugging
    console.log('🔍 Token config object:', {
      config_key: tokenConfig.config_key,
      permission_value_type: typeof tokenConfig.permission_value,
      permission_value_length: typeof tokenConfig.permission_value === 'string' ? tokenConfig.permission_value.length : 'N/A',
      permission_value_preview: typeof tokenConfig.permission_value === 'string' 
        ? `${tokenConfig.permission_value.substring(0, 50)}...` 
        : tokenConfig.permission_value,
      config_value_type: typeof tokenConfig.config_value,
      config_value_length: typeof tokenConfig.config_value === 'string' ? tokenConfig.config_value.length : 'N/A',
      config_value_preview: typeof tokenConfig.config_value === 'string' 
        ? `${tokenConfig.config_value.substring(0, 50)}...` 
        : tokenConfig.config_value,
      full_config: tokenConfig
    });

    // Extract the token from permission_value or config_value (check both)
    const token = tokenConfig.permission_value || tokenConfig.config_value;

    // Log which field was used
    if (tokenConfig.permission_value && tokenConfig.config_value) {
      console.log('📋 Token found in both permission_value and config_value, using permission_value');
    } else if (tokenConfig.config_value) {
      console.log('📋 Token found in config_value (permission_value was empty)');
    }

    // Validate the token
    if (token && typeof token === 'string' && token.trim().length > 0) {
      const trimmedToken = token.trim();
      console.log('✅ Google token found in configs:', {
        length: trimmedToken.length,
        first_50_chars: trimmedToken.substring(0, 50),
        last_50_chars: trimmedToken.substring(Math.max(0, trimmedToken.length - 50)),
        full_token: trimmedToken, // Show full token for verification
        starts_with: trimmedToken.substring(0, 20),
        ends_with: trimmedToken.substring(Math.max(0, trimmedToken.length - 20))
      });
      // Cache the token with user-specific key if external
      tokenCache.set(cacheKey, { token: trimmedToken, timestamp: Date.now() });
      return trimmedToken;
    } else {
      console.warn('⚠️ google_token config found but permission_value is invalid:', {
        hasPermissionValue: !!tokenConfig.permission_value,
        permissionValueType: typeof tokenConfig.permission_value,
        permissionValueLength: typeof tokenConfig.permission_value === 'string' ? tokenConfig.permission_value.length : 'N/A',
        permissionValue: tokenConfig.permission_value, // Show actual value for debugging
        full_config: tokenConfig
      });
      return null;
    }
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

  // Extract from Google Drive URL patterns (try most specific first)
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/FILE_ID
    /\/d\/([a-zA-Z0-9_-]+)/,        // /d/FILE_ID
    /\/uc\?id=([a-zA-Z0-9_-]+)/,    // /uc?id=FILE_ID
    /\/open\?id=([a-zA-Z0-9_-]+)/,   // /open?id=FILE_ID
    /[?&]id=([a-zA-Z0-9_-]+)/,      // ?id=FILE_ID or &id=FILE_ID
    /drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/, // Full Google Drive URL with id param
  ];

  for (const pattern of patterns) {
    const match = imagePath.match(pattern);
    if (match && match[1]) {
      const fileId = match[1];
      console.log('🔍 extractFileId: Extracted from URL:', fileId.substring(0, 50));
      return fileId;
    }
  }

  // If it's a Google Drive public URL (uc?export=view), extract the file ID so we can use authenticated URL
  if (imagePath.includes('drive.google.com')) {
    // Try to extract ID from various Google Drive URL formats
    const idMatch = imagePath.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                    imagePath.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    imagePath.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      console.log('🔍 extractFileId: Extracted file ID from Google Drive URL:', idMatch[1].substring(0, 50));
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
const thumbnailCache = new Map(); // key: fileId_token, value: thumbnailBlobUrl

// Get Google Drive image URL using lh3 CDN (fastest method, no authentication needed for public/shared files)
export const getGoogleDriveCDNUrl = (imagePath, size = 'w800') => {
  if (!imagePath) {
    console.log('❌ getGoogleDriveCDNUrl: No imagePath provided');
    return null;
  }

  console.log('🔍 getGoogleDriveCDNUrl: Processing:', imagePath?.substring(0, 100));

  let fileId = null;

  // If it's already a file ID (alphanumeric, typically 15-33 chars)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(imagePath.trim())) {
    fileId = imagePath.trim();
    console.log('✅ getGoogleDriveCDNUrl: Detected as file ID:', fileId.substring(0, 50));
  } 
  // If it's a Google Drive URL, extract file ID
  else if (imagePath.includes('drive.google.com')) {
    // Try various patterns to extract file ID
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/FILE_ID
      /\/d\/([a-zA-Z0-9_-]+)/,        // /d/FILE_ID
      /\/uc\?id=([a-zA-Z0-9_-]+)/,    // /uc?id=FILE_ID
      /\/open\?id=([a-zA-Z0-9_-]+)/,   // /open?id=FILE_ID
      /[?&]id=([a-zA-Z0-9_-]+)/,      // ?id=FILE_ID or &id=FILE_ID
    ];

    for (const pattern of patterns) {
      const match = imagePath.match(pattern);
      if (match && match[1]) {
        fileId = match[1];
        console.log('✅ getGoogleDriveCDNUrl: Extracted file ID from URL:', fileId.substring(0, 50));
        break;
      }
    }
  }
  // If it's a direct URL that's NOT Google Drive, return null
  else if (/^https?:\/\//.test(imagePath)) {
    console.log('❌ getGoogleDriveCDNUrl: Direct URL (not Google Drive)');
    return null;
  }

  if (!fileId) {
    console.log('❌ getGoogleDriveCDNUrl: Could not extract file ID');
    return null;
  }

  // Validate file ID format
  if (!/^[a-zA-Z0-9_-]{15,}$/.test(fileId)) {
    console.log('❌ getGoogleDriveCDNUrl: Invalid file ID format:', fileId.substring(0, 50));
    return null;
  }

  // Use Google's lh3 CDN - much faster than API calls
  // Format: https://lh3.googleusercontent.com/d/{FILE_ID}=w{SIZE}
  // Alternative format: https://drive.google.com/thumbnail?id={FILE_ID}&sz=w{SIZE}
  // Note: lh3 CDN only works for public/shared files. Private files need API with token.
  
  // Try lh3 CDN format first (most reliable for public files)
  const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}=${size}`;
  console.log('✅ getGoogleDriveCDNUrl: Generated CDN URL:', cdnUrl);
  
  // Also log alternative format for debugging
  const altUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=${size}`;
  console.log('🔍 getGoogleDriveCDNUrl: Alternative format:', altUrl);
  
  return cdnUrl;
};

// Get Google Drive thumbnail URL (much faster than full image)
export const getGoogleDriveThumbnailUrl = async (imagePath, accessToken) => {
  console.log('🖼️ getGoogleDriveThumbnailUrl called:', { imagePath: imagePath?.substring(0, 50), hasToken: !!accessToken });
  
  if (!imagePath) {
    return null;
  }

  // Extract file ID from path
  let fileIdOrUrl = extractFileId(imagePath);
  
  if (!fileIdOrUrl) {
    return null;
  }

  // If it's a direct URL that's NOT Google Drive, return null (no thumbnail)
  if (/^https?:\/\//.test(fileIdOrUrl) && !fileIdOrUrl.includes('drive.google.com')) {
    return null;
  }

  // Extract file ID if it's still a URL
  if (fileIdOrUrl.includes('drive.google.com')) {
    const idMatch = fileIdOrUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                    fileIdOrUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    fileIdOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) {
      fileIdOrUrl = idMatch[1];
    } else {
      return null;
    }
  }

  // At this point, fileIdOrUrl should be a file ID
  if (/^https?:\/\//.test(fileIdOrUrl)) {
    return null;
  }

  const fileId = fileIdOrUrl;
  
  // Check thumbnail cache first
  const cacheKey = `${fileId}_${accessToken || 'no-token'}`;
  if (thumbnailCache.has(cacheKey)) {
    console.log('✅ Using cached thumbnail URL');
    return thumbnailCache.get(cacheKey);
  }

  // If we have an access token, fetch thumbnail
  if (accessToken) {
    try {
      const thumbnailUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/thumbnail?alt=media`;
      console.log('📡 Fetching thumbnail from Google Drive API');
      
      const response = await fetch(thumbnailUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        thumbnailCache.set(cacheKey, blobUrl);
        console.log('✅ Created thumbnail blob URL');
        return blobUrl;
      } else {
        console.warn('⚠️ Thumbnail fetch failed:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Error fetching thumbnail:', error);
    }
  }

  return null;
};

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
  
  // Validate token if provided
  if (accessToken && typeof accessToken === 'string' && accessToken.trim().length === 0) {
    console.warn('⚠️ Access token is an empty string, treating as no token');
    accessToken = null;
  }
  
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

// Save Google token to configs - supports per-user tokens for external users
export const saveGoogleTokenToConfigs = async (tallylocId, coGuid, token, displayName = null, userEmail = null) => {
  console.log('💾 saveGoogleTokenToConfigs called:', { tallylocId, coGuid, userEmail });
  
  if (!tallylocId || !coGuid || !token) {
    throw new Error('Missing required parameters');
  }

  const isExternal = isExternalUser();
  if (isExternal) {
    userEmail = userEmail || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('email') : null);
    if (!userEmail) {
      throw new Error('External users must provide their email address');
    }
  }

  try {
    // Get existing configs
    let apiUrl = `/api/cmpconfig/list?tallyloc_id=${tallylocId}&co_guid=${coGuid}`;
    if (isExternal && userEmail) {
      apiUrl += `&user_email=${encodeURIComponent(userEmail)}`;
    }
    
    const existingConfigsResponse = await apiGet(apiUrl);
    
    let existingConfigs = [];
    if (Array.isArray(existingConfigsResponse)) {
      existingConfigs = existingConfigsResponse;
    } else if (existingConfigsResponse?.data && Array.isArray(existingConfigsResponse.data)) {
      existingConfigs = existingConfigsResponse.data;
    } else if (existingConfigsResponse?.success && existingConfigsResponse?.data && Array.isArray(existingConfigsResponse.data)) {
      existingConfigs = existingConfigsResponse.data;
    }

    // Determine config keys based on user type
    const tokenConfigKey = isExternal && userEmail 
      ? `google_token_user_${userEmail.toLowerCase()}`
      : 'google_token';
    
    const displayNameConfigKey = isExternal && userEmail
      ? `google_display_name_user_${userEmail.toLowerCase()}`
      : 'google_display_name';

    // Update or add token config
    let updatedConfigs = existingConfigs.map(config => {
      if (config.config_key === tokenConfigKey) {
        return {
          ...config,
          permission_value: token,
          config_value: token,
          is_enabled: true
        };
      }
      if (displayName && config.config_key === displayNameConfigKey) {
        return {
          ...config,
          permission_value: displayName,
          config_value: displayName
        };
      }
      return config;
    });

    // Add token config if it doesn't exist
    if (!updatedConfigs.find(c => c.config_key === tokenConfigKey)) {
      updatedConfigs.push({
        config_key: tokenConfigKey,
        permission_value: token,
        config_value: token,
        is_enabled: true,
        user_email: isExternal && userEmail ? userEmail.toLowerCase() : undefined
      });
    }

    // Add display name config if it doesn't exist and displayName is provided
    if (displayName && !updatedConfigs.find(c => c.config_key === displayNameConfigKey)) {
      updatedConfigs.push({
        config_key: displayNameConfigKey,
        permission_value: displayName,
        config_value: displayName,
        user_email: isExternal && userEmail ? userEmail.toLowerCase() : undefined
      });
    }

    // Prepare payload
    const companyConfig = existingConfigs[0] || {};
    const payload = {
      tallyloc_id: tallylocId,
      co_guid: coGuid,
      co_name: companyConfig.co_name || '',
      configurations: updatedConfigs.map(config => ({
        config_id: config.config_id || config.id,
        is_enabled: config.is_enabled === true || config.is_enabled === 1,
        permission_value: config.permission_value || config.config_value || ''
      })),
      user_email: isExternal && userEmail ? userEmail.toLowerCase() : undefined
    };

    // Save to backend
    await apiPost('/api/cmpconfig/update', payload);
    
    // Clear cache
    const cacheKey = isExternal && userEmail 
      ? `${tallylocId}_${coGuid}_${userEmail.toLowerCase()}`
      : `${tallylocId}_${coGuid}`;
    tokenCache.delete(cacheKey);
    
    console.log('✅ Google token saved successfully');
  } catch (error) {
    console.error('❌ Error saving Google token:', error);
    throw error;
  }
};

// Clear token cache (useful when token is updated)
export const clearTokenCache = (tallylocId, coGuid, userEmail = null) => {
  if (tallylocId && coGuid) {
    const isExternal = isExternalUser();
    if (isExternal && userEmail) {
      const cacheKey = `${tallylocId}_${coGuid}_${userEmail.toLowerCase()}`;
      tokenCache.delete(cacheKey);
    } else {
      const cacheKey = `${tallylocId}_${coGuid}`;
      tokenCache.delete(cacheKey);
    }
  } else {
    tokenCache.clear();
  }
};

