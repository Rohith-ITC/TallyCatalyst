const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer/"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert/")
      };
      
      // Ensure webpack uses the "module" field from package.json (for .mjs files)
      webpackConfig.resolve.mainFields = ['browser', 'module', 'main'];
      
      // Add .mjs to resolve extensions for @nivo packages (before .js)
      // Also ensure .es.js is NOT in the extensions list
      const extensions = webpackConfig.resolve.extensions || [];
      
      // Remove .es.js if it exists (we don't want webpack trying this)
      const esJsIndex = extensions.indexOf('.es.js');
      if (esJsIndex !== -1) {
        extensions.splice(esJsIndex, 1);
      }
      
      if (!extensions.includes('.mjs')) {
        // Insert .mjs before .js to prioritize it
        const jsIndex = extensions.indexOf('.js');
        if (jsIndex !== -1) {
          extensions.splice(jsIndex, 0, '.mjs');
        } else {
          extensions.unshift('.mjs');
        }
      }
      webpackConfig.resolve.extensions = extensions;
      
      // Add alias to redirect .es.js to .mjs for @nivo packages
      webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
      
      // Add explicit aliases for @nivo packages to prevent .es.js resolution
      try {
        const path = require('path');
        const fs = require('fs');
        
        // Force @nivo packages to resolve to their .mjs files directly
        const nivoLinePath = path.join(__dirname, 'node_modules', '@nivo', 'line', 'dist', 'nivo-line.mjs');
        const nivoPiePath = path.join(__dirname, 'node_modules', '@nivo', 'pie', 'dist', 'nivo-pie.mjs');
        const nivoBarPath = path.join(__dirname, 'node_modules', '@nivo', 'bar', 'dist', 'nivo-bar.mjs');
        const nivoTreemapPath = path.join(__dirname, 'node_modules', '@nivo', 'treemap', 'dist', 'nivo-treemap.mjs');
        
        // Alias .es.js requests to .mjs (absolute paths)
        if (fs.existsSync(nivoLinePath)) {
          webpackConfig.resolve.alias['@nivo/line/dist/nivo-line.es.js'] = nivoLinePath;
          // Also try with absolute path pattern
          const absEsJsPath = path.join(__dirname, 'node_modules', '@nivo', 'line', 'dist', 'nivo-line.es.js');
          webpackConfig.resolve.alias[absEsJsPath] = nivoLinePath;
        }
        if (fs.existsSync(nivoPiePath)) {
          webpackConfig.resolve.alias['@nivo/pie/dist/nivo-pie.es.js'] = nivoPiePath;
          const absEsJsPath = path.join(__dirname, 'node_modules', '@nivo', 'pie', 'dist', 'nivo-pie.es.js');
          webpackConfig.resolve.alias[absEsJsPath] = nivoPiePath;
        }
        if (fs.existsSync(nivoBarPath)) {
          webpackConfig.resolve.alias['@nivo/bar/dist/nivo-bar.es.js'] = nivoBarPath;
          const absEsJsPath = path.join(__dirname, 'node_modules', '@nivo', 'bar', 'dist', 'nivo-bar.es.js');
          webpackConfig.resolve.alias[absEsJsPath] = nivoBarPath;
        }
        if (fs.existsSync(nivoTreemapPath)) {
          webpackConfig.resolve.alias['@nivo/treemap/dist/nivo-treemap.es.js'] = nivoTreemapPath;
          const absEsJsPath = path.join(__dirname, 'node_modules', '@nivo', 'treemap', 'dist', 'nivo-treemap.es.js');
          webpackConfig.resolve.alias[absEsJsPath] = nivoTreemapPath;
        }
      } catch (e) {
        console.warn('Could not set up @nivo aliases:', e.message);
      }
      
      // Exclude @nivo packages from babel-loader processing
      const oneOfRule = webpackConfig.module.rules.find(rule => rule.oneOf);
      if (oneOfRule) {
        // Find the babel-loader rule and exclude @nivo packages
        oneOfRule.oneOf.forEach(rule => {
          if (rule.test && rule.test.toString().includes('jsx?') && rule.use) {
            const useArray = Array.isArray(rule.use) ? rule.use : [rule.use];
            useArray.forEach(use => {
              if (use.loader && use.loader.includes('babel-loader')) {
                // Exclude @nivo packages from babel processing
                if (!rule.exclude) {
                  rule.exclude = [];
                } else if (typeof rule.exclude === 'function') {
                  const originalExclude = rule.exclude;
                  rule.exclude = (modulePath) => {
                    if (modulePath.includes('@nivo')) return true;
                    return originalExclude(modulePath);
                  };
                } else if (Array.isArray(rule.exclude)) {
                  rule.exclude.push(/node_modules\/@nivo/);
                } else {
                  rule.exclude = [rule.exclude, /node_modules\/@nivo/];
                }
              }
            });
          }
        });
        
        // Add rule to handle .mjs files from @nivo (before babel processing)
        const hasMjsRule = oneOfRule.oneOf.some(rule => 
          rule.test && rule.test.toString().includes('mjs')
        );
        
        if (!hasMjsRule) {
          oneOfRule.oneOf.unshift({
            test: /\.mjs$/,
            include: /node_modules\/@nivo/,
            type: 'javascript/auto',
            resolve: {
              fullySpecified: false
            }
          });
        }
        
        // Add rule to handle .es.js files from @nivo (treat them as .mjs)
        const hasEsJsRule = oneOfRule.oneOf.some(rule => 
          rule.test && rule.test.toString().includes('es\\.js')
        );
        
        if (!hasEsJsRule) {
          oneOfRule.oneOf.unshift({
            test: /\.es\.js$/,
            include: /node_modules\/@nivo/,
            type: 'javascript/auto',
            resolve: {
              fullySpecified: false
            }
          });
        }
        
      }
      
      // Custom resolver plugin to intercept .es.js requests for @nivo packages
      class NivoEsJsResolver {
        apply(resolver) {
          const path = require('path');
          const fs = require('fs');
          
          // Hook into multiple resolution stages to catch .es.js requests
          resolver.hooks.beforeResolve.tapAsync('NivoEsJsResolver', (request, resolveContext, callback) => {
            if (request && request.request && typeof request.request === 'string') {
              // Check if request is for .es.js file in @nivo
              if (request.request.includes('@nivo') && request.request.includes('.es.js')) {
                const newRequest = request.request.replace(/\.es\.js$/, '.mjs');
                resolver.doResolve(
                  resolver.hooks.resolve,
                  { ...request, request: newRequest },
                  'Redirected .es.js to .mjs for @nivo package (beforeResolve)',
                  resolveContext,
                  callback
                );
                return;
              }
            }
            callback();
          });
          
          // Also hook into the resolve phase
          resolver.hooks.resolve.tapAsync('NivoEsJsResolver', (request, resolveContext, callback) => {
            if (request && request.request && typeof request.request === 'string') {
              if (request.request.includes('@nivo') && request.request.includes('.es.js')) {
                const newRequest = request.request.replace(/\.es\.js$/, '.mjs');
                resolver.doResolve(
                  resolver.hooks.resolve,
                  { ...request, request: newRequest },
                  'Redirected .es.js to .mjs for @nivo package (resolve)',
                  resolveContext,
                  callback
                );
                return;
              }
            }
            callback();
          });
          
          // Hook into file resolution to catch absolute paths
          resolver.hooks.file.tapAsync('NivoEsJsResolver', (request, resolveContext, callback) => {
            if (request && request.path && typeof request.path === 'string') {
              if (request.path.includes('@nivo') && request.path.includes('.es.js')) {
                const newPath = request.path.replace(/\.es\.js$/, '.mjs');
                if (fs.existsSync(newPath)) {
                  resolver.doResolve(
                    resolver.hooks.file,
                    { ...request, path: newPath },
                    'Redirected .es.js path to .mjs for @nivo package (file)',
                    resolveContext,
                    callback
                  );
                  return;
                }
              }
            }
            callback();
          });
        }
      }
      
      // Add NormalModuleReplacementPlugin as backup - catch all patterns
      // Match both ./node_modules/@nivo/... and @nivo/... formats
      const nivoReplacementPlugin = new webpack.NormalModuleReplacementPlugin(
        /([./]*node_modules\/)?@nivo\/[^/]+\/dist\/[^/]+\.es\.js$/,
        (resource) => {
          const newRequest = resource.request.replace(/\.es\.js$/, '.mjs');
          console.log(`[Nivo] Redirecting ${resource.request} to ${newRequest}`);
          resource.request = newRequest;
        }
      );
      
      // Also add a more general pattern matcher for any .es.js in @nivo
      const nivoReplacementPluginGeneral = new webpack.NormalModuleReplacementPlugin(
        /([./]*node_modules\/)?@nivo\/.*\.es\.js$/,
        (resource) => {
          const newRequest = resource.request.replace(/\.es\.js$/, '.mjs');
          console.log(`[Nivo General] Redirecting ${resource.request} to ${newRequest}`);
          resource.request = newRequest;
        }
      );
      
      // Add resolver plugin to resolve.plugins
      if (!webpackConfig.resolve.plugins) {
        webpackConfig.resolve.plugins = [];
      }
      webpackConfig.resolve.plugins.unshift(new NivoEsJsResolver());
      
      // Custom plugin that hooks into module factory to catch .es.js requests
      class NivoEsJsModulePlugin {
        apply(compiler) {
          compiler.hooks.normalModuleFactory.tap('NivoEsJsModulePlugin', (nmf) => {
            nmf.hooks.beforeResolve.tap('NivoEsJsModulePlugin', (data) => {
              if (data && data.request && typeof data.request === 'string') {
                // Check for both relative and absolute paths
                if ((data.request.includes('@nivo') || data.request.includes('node_modules/@nivo')) && 
                    data.request.includes('.es.js')) {
                  const originalRequest = data.request;
                  data.request = data.request.replace(/\.es\.js$/, '.mjs');
                  console.log(`[Nivo Module Plugin] Redirected request: ${originalRequest} -> ${data.request}`);
                }
              }
            });
            
            nmf.hooks.afterResolve.tap('NivoEsJsModulePlugin', (data) => {
              if (data) {
                // Check request
                if (data.request && typeof data.request === 'string') {
                  if ((data.request.includes('@nivo') || data.request.includes('node_modules/@nivo')) && 
                      data.request.includes('.es.js')) {
                    const originalRequest = data.request;
                    data.request = data.request.replace(/\.es\.js$/, '.mjs');
                    console.log(`[Nivo Module Plugin] Redirected afterResolve request: ${originalRequest} -> ${data.request}`);
                  }
                }
                // Check resource (the actual file path)
                if (data.resource && typeof data.resource === 'string') {
                  if ((data.resource.includes('@nivo') || data.resource.includes('node_modules/@nivo')) && 
                      data.resource.includes('.es.js')) {
                    const originalResource = data.resource;
                    data.resource = data.resource.replace(/\.es\.js$/, '.mjs');
                    console.log(`[Nivo Module Plugin] Redirected resource: ${originalResource} -> ${data.resource}`);
                  }
                }
              }
            });
          });
        }
      }
      
      webpackConfig.plugins = [
        new NivoEsJsModulePlugin(), // Add first to catch at module factory level
        nivoReplacementPlugin, // Add early to catch .es.js requests
        nivoReplacementPluginGeneral, // General pattern matcher
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ];
      return webpackConfig;
    },
  },
};

