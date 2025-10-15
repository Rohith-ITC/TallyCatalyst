// Cache management utilities
export const CACHE_VERSION = process.env.REACT_APP_VERSION || '1.0.0';
export const CACHE_KEY_PREFIX = 'tallycatalyst_';

// Clear all application caches
export const clearAllCaches = () => {
  try {
    // Clear localStorage
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear service worker caches if available
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName);
        });
      });
    }
    
    console.log('All caches cleared successfully');
  } catch (error) {
    console.error('Error clearing caches:', error);
  }
};

// Check if app version has changed
export const checkVersionUpdate = () => {
  const storedVersion = localStorage.getItem(`${CACHE_KEY_PREFIX}version`);
  
  if (storedVersion && storedVersion !== CACHE_VERSION) {
    console.log(`Version changed from ${storedVersion} to ${CACHE_VERSION}`);
    clearAllCaches();
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
    return true; // Version changed
  } else if (!storedVersion) {
    localStorage.setItem(`${CACHE_KEY_PREFIX}version`, CACHE_VERSION);
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
