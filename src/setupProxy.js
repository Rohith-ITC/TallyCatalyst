const { createProxyMiddleware } = require('http-proxy-middleware');

const DEFAULT_TARGET =
  process.env.REACT_APP_PRODUCTION_API_URL;

module.exports = function setupProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: DEFAULT_TARGET,
      changeOrigin: true,
      secure: true,
      logLevel: 'silent',
      timeout: 300000,
      proxyTimeout: 300000,
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

