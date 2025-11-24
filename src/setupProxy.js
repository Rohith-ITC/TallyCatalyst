const { createProxyMiddleware } = require('http-proxy-middleware');

// Use dev API URL in development, otherwise production URL
// Read from .env file, with fallback for backward compatibility
const DEFAULT_TARGET =
  process.env.NODE_ENV === 'development'
    ? (process.env.REACT_APP_DEV_API_URL || 'http://localhost:3001')
    : (process.env.REACT_APP_PRODUCTION_API_URL || process.env.REACT_APP_STAGING_API_URL || 'http://localhost:3001');

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
          console.error('Proxy error for API request:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Proxy error: ' + err.message });
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

