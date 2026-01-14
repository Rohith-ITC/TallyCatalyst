// Service Worker for cache management
const CACHE_NAME = 'datalynk-v1';
const CACHE_VERSION = '%REACT_APP_VERSION%';

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip requests with unsupported schemes (chrome-extension, data, blob, etc.)
  const requestUrl = event.request.url;
  const unsupportedSchemes = ['chrome-extension:', 'moz-extension:', 'safari-extension:', 'ms-browser-extension:', 'data:', 'blob:', 'about:'];
  const hasUnsupportedScheme = unsupportedSchemes.some(scheme => requestUrl.startsWith(scheme));
  
  if (hasUnsupportedScheme) {
    // Let unsupported schemes pass through without caching
    return;
  }

  // Only handle http/https requests
  if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
    return;
  }

  // Skip API calls (let them go to network)
  if (event.request.url.includes('/api/')) {
    return;
  }

  // CRITICAL FIX: Never cache index.html to prevent version mismatch loops
  // Always fetch index.html from network to ensure it has the latest version
  const isHtmlRequest = event.request.url.endsWith('/') || 
                       event.request.url.endsWith('/index.html') || 
                       event.request.url.includes('index.html') ||
                       (event.request.url === self.location.origin + '/' || 
                        event.request.url === self.location.origin + '/index.html');

  // For HTML requests, always fetch from network (never cache)
  if (isHtmlRequest) {
    event.respondWith(
      fetch(event.request).then((fetchResponse) => {
        return fetchResponse;
      }).catch((error) => {
        // If network fails, try cache as fallback
        return caches.match(event.request);
      })
    );
    return;
  }

  // For other resources, use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request).then((fetchResponse) => {
        // Don't cache if not a valid response
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }

        // Clone the response
        const responseToCache = fetchResponse.clone();

        // Cache the response with error handling
        caches.open(CACHE_NAME).then((cache) => {
          try {
            // Only cache if the request URL is still valid (http/https)
            if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
              cache.put(event.request, responseToCache).catch((error) => {
                // Silently fail if caching is not possible (e.g., unsupported scheme)
                console.warn('Failed to cache resource:', requestUrl, error);
              });
            }
          } catch (error) {
            // Silently fail if caching is not possible
            console.warn('Error caching resource:', requestUrl, error);
          }
        }).catch((error) => {
          // Silently fail if cache cannot be opened
          console.warn('Error opening cache:', error);
        });

        return fetchResponse;
      });
    })
  );
});

// Message event - handle cache clearing
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Clearing all caches...');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});
