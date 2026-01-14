const webpack = require('webpack');
const fs = require('fs');
const path = require('path');

// Read homepage from package.json
const packageJsonPath = path.resolve(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const homepage = packageJson.homepage || '';

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Set public path based on environment
      // For development, use root path (works with localhost)
      // For production, use homepage value from package.json
      if (env === 'production' && homepage) {
        // Ensure homepage ends with / for proper path resolution
        webpackConfig.output.publicPath = homepage.endsWith('/') ? homepage : homepage + '/';
      } else {
        // Development: use root path
        webpackConfig.output.publicPath = '/';
      }

      // Fix chunk loading issues
      if (env === 'development') {
        webpackConfig.output.filename = 'static/js/[name].bundle.js';
        webpackConfig.output.chunkFilename = 'static/js/[name].chunk.js';
        webpackConfig.output.crossOriginLoading = 'anonymous';
      }

      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer/"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert/")
      };

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      // Optimize chunk splitting to prevent loading issues
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        runtimeChunk: 'single', // Extract runtime into a separate chunk
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
              name: 'vendors',
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };

      return webpackConfig;
    },
  },
  devServer: {
    // Disable caching for HTML files
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    // Enable hot module replacement
    hot: true,
    // Fallback to index.html for SPA routing
    historyApiFallback: true,
    // Disable host check for local development
    allowedHosts: 'all',
  },
};
