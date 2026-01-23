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

      // Resolve tslib from root node_modules to fix echarts/zrender issues
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        // Resolve nested tslib references to root tslib
        'echarts/node_modules/tslib/tslib.es6.js': path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
        'zrender/node_modules/tslib/tslib.es6.js': path.resolve(__dirname, 'node_modules/tslib/tslib.js'),
      };

      // Add a plugin to handle missing tslib.es6.js files
      webpackConfig.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /echarts[/\\]node_modules[/\\]tslib[/\\]tslib\.es6\.js$/,
          require.resolve('tslib/tslib.js')
        ),
        new webpack.NormalModuleReplacementPlugin(
          /zrender[/\\]node_modules[/\\]tslib[/\\]tslib\.es6\.js$/,
          require.resolve('tslib/tslib.js')
        )
      );

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ];

      // Optimize chunk splitting to prevent loading issues
      // Heavy libraries are split into separate chunks to reduce initial bundle size
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        runtimeChunk: 'single', // Extract runtime into a separate chunk
        splitChunks: {
          chunks: 'all',
          minSize: 20000, // Minimum chunk size (20KB)
          maxSize: 500000, // Maximum chunk size (500KB) - auto-split larger chunks
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            // Separate chunk for echarts (1-2MB)
            echarts: {
              test: /[\\/]node_modules[\\/]echarts[\\/]/,
              name: 'echarts',
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // Separate chunk for nivo charts
            nivo: {
              test: /[\\/]node_modules[\\/]@nivo[\\/]/,
              name: 'nivo',
              chunks: 'all',
              priority: 35,
              enforce: true,
            },
            // Separate chunk for d3 (dependency of nivo)
            d3: {
              test: /[\\/]node_modules[\\/]d3.*[\\/]/,
              name: 'd3',
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            // Separate chunk for recharts
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              chunks: 'all',
              priority: 25,
              enforce: true,
            },
            // Separate chunk for xlsx (Excel handling)
            xlsx: {
              test: /[\\/]node_modules[\\/]xlsx[\\/]/,
              name: 'xlsx',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // Separate chunk for jspdf
            jspdf: {
              test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/,
              name: 'jspdf',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // MUI components
            mui: {
              test: /[\\/]node_modules[\\/]@mui[\\/]/,
              name: 'mui',
              chunks: 'all',
              priority: 15,
              enforce: true,
            },
            // Remaining vendors
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
