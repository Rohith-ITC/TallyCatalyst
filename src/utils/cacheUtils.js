// Cache management utilities
export const CACHE_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
export const CACHE_KEY_PREFIX = 'datalynk_';

// Clear all application caches
export const clearAllCaches = () => {
  try {
    console.log('🧹 clearAllCaches called');
    console.log('🧹 sessionStorage BEFORE clear:', {
      token: !!sessionStorage.getItem('token'),
      email: !!sessionStorage.getItem('email'),
      allKeys: Object.keys(sessionStorage)
    });
    
    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear only cache-related sessionStorage items, NOT authentication tokens
    // Keep token, email, name, and other auth-related sessionStorage items
    const authKeys = ['token', 'email', 'name', 'tallyloc_id', 'company', 'guid', 'status', 'access_type'];
    const sessionKeys = Object.keys(sessionStorage);
    
    console.log('🧹 sessionStorage keys to check:', sessionKeys);
    
    let clearedCount = 0;
    sessionKeys.forEach(key => {
      // Only clear cache-related keys, preserve authentication data
      const isCacheKey = key.startsWith(CACHE_KEY_PREFIX) || 
                        key.startsWith('ledgerlist-w-addrs_') || 
                        key.startsWith('stockitem_');
      
      const isAuthKey = authKeys.includes(key);
      
      if (!isAuthKey && isCacheKey) {
        console.log(`🧹 Clearing cache key: ${key}`);
        sessionStorage.removeItem(key);
        clearedCount++;
      } else if (isAuthKey) {
        console.log(`🧹 Preserving auth key: ${key}`);
      }
    });
    
    // Clear service worker caches if available
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    console.log(`🧹 All caches cleared successfully (authentication data preserved). Cleared ${clearedCount} cache keys`);
    console.log('🧹 sessionStorage AFTER clear:', {
      token: !!sessionStorage.getItem('token'),
      email: !!sessionStorage.getItem('email'),
      allKeys: Object.keys(sessionStorage)
    });
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

// Check if app version has changed
export const checkVersionUpdate = () => {
  const storedVersion = localStorage.getItem(`${CACHE_KEY_PREFIX}version`);
  
  console.log('🔄 checkVersionUpdate called:', {
    storedVersion,
    currentVersion: CACHE_VERSION,
    hasToken: !!sessionStorage.getItem('token'),
    hasEmail: !!sessionStorage.getItem('email')
  });
  
  // Don't clear if storedVersion is a placeholder (build issue)
  if (storedVersion && storedVersion.includes('%') && storedVersion.includes('REACT_APP_VERSION')) {
    console.log('⚠️ Detected placeholder version, setting to current version without clearing');
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
    return false; // Don't clear on placeholder detection
  }
  
  if (storedVersion && storedVersion !== CACHE_VERSION) {
    console.log(`🔄 Version changed from ${storedVersion} to ${CACHE_VERSION} - clearing caches`);
    clearAllCaches();
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
    return true; // Version changed
  } else if (!storedVersion) {
    console.log('🔄 No stored version found, setting initial version');
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
  } else {
    console.log('🔄 Version unchanged, no cache clear needed');
  }
  
  return false; // No version change
};

// Force reload with cache busting
export const forceReload = () => {
  // Add timestamp to force reload
  const timestamp = new Date().getTime();
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('_t', timestamp);
  
  // Clear caches first
  clearAllCaches();
  
  // Reload with cache busting
  window.location.href = currentUrl.toString();
};

// Add cache busting to API calls
export const addCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${Date.now()}`;
};
