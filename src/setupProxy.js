const { createProxyMiddleware } = require('http-proxy-middleware');

// Use dev API URL in development, otherwise production URL
// Read from .env file, with fallback for backward compatibility
// Handle empty strings properly - check if value exists and is not empty
const getApiUrl = (envVar, fallback) => {
  const value = process.env[envVar];
  return value && value.trim() !== '' ? value : fallback;
};

const DEFAULT_TARGET =
  process.env.NODE_ENV === 'development'
    ? getApiUrl('REACT_APP_DEV_API_URL', 
        getApiUrl('REACT_APP_STAGING_API_URL', 'https://itcatalystindia.com/Development/CustomerPortal_API'))
    : (getApiUrl('REACT_APP_PRODUCTION_API_URL', 
        getApiUrl('REACT_APP_STAGING_API_URL', 'https://itcatalystindia.com/Development/CustomerPortal_API')));

module.exports = function setupProxy(app) {
  // Log the proxy target for debugging
  console.log('🔧 Proxy configured to target:', DEFAULT_TARGET);
  
  // Only proxy /api requests, ignore webpack hot-update files and other assets
  app.use(
    '/api',
    createProxyMiddleware({
      target: DEFAULT_TARGET,
      changeOrigin: true,
      secure: false, // Allow self-signed certificates in development
      logLevel: 'debug', // Enable debug logging to see what's happening
      timeout: 300000,
      proxyTimeout: 300000,
      // Add CORS headers to response
      onProxyRes: (proxyRes, req, res) => {
        // Add CORS headers if not already present
        if (!proxyRes.headers['access-control-allow-origin']) {
          proxyRes.headers['access-control-allow-origin'] = '*';
        }
        if (!proxyRes.headers['access-control-allow-methods']) {
          proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        }
        if (!proxyRes.headers['access-control-allow-headers']) {
          proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization, x-tallyloc-id, x-company, x-guid';
        }
      },
      // Filter out non-API requests
      filter: (pathname, req) => {
        return pathname.startsWith('/api');
      },
      onError: (err, req, res) => {
        // Only log errors for /api requests, ignore webpack hot-update files
        if (req.url && req.url.startsWith('/api')) {
          const errorMsg = err.code === 'ECONNREFUSED' 
            ? `Cannot connect to backend server at ${DEFAULT_TARGET}. Make sure the backend is running or check your REACT_APP_DEV_API_URL in .env file.`
            : err.message;
          console.error('❌ Proxy error for API request:', errorMsg);
          console.error('   Request URL:', req.url);
          console.error('   Target:', DEFAULT_TARGET);
          if (!res.headersSent) {
            res.status(503).json({ 
              error: 'Backend server unavailable',
              message: errorMsg,
              target: DEFAULT_TARGET
            });
          }
        }
        // Silently ignore errors for non-API requests (like webpack files)
      },
      onProxyReq: (proxyReq, req) => {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (authHeader) {
          proxyReq.setHeader('Authorization', authHeader);
        }

        const xTallyLocId =
          req.headers['x-tallyloc-id'] ||
          req.headers['X-Tallyloc-Id'] ||
          req.headers['x-tallyloc-id'];
        if (xTallyLocId) {
          proxyReq.setHeader('x-tallyloc-id', xTallyLocId);
        }

        const xCompany = req.headers['x-company'] || req.headers['X-Company'];
        if (xCompany) {
          proxyReq.setHeader('x-company', xCompany);
        }

        const xGuid = req.headers['x-guid'] || req.headers['X-Guid'];
        if (xGuid) {
          proxyReq.setHeader('x-guid', xGuid);
        }

        const contentType = req.headers['content-type'] || req.headers['Content-Type'];
        if (contentType) {
          proxyReq.setHeader('Content-Type', contentType);
        }
      },
    })
  );
};

