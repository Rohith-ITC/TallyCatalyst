const fs = require('fs');
const path = require('path');

// Fix @nivo .es.js files by copying from .mjs
const nivoPackages = ['line', 'pie', 'bar', 'treemap'];

nivoPackages.forEach(pkg => {
  const mjsPath = path.join(__dirname, '..', 'node_modules', '@nivo', pkg, 'dist', `nivo-${pkg}.mjs`);
  const esJsPath = path.join(__dirname, '..', 'node_modules', '@nivo', pkg, 'dist', `nivo-${pkg}.es.js`);
  
  if (fs.existsSync(mjsPath) && !fs.existsSync(esJsPath)) {
    try {
      fs.copyFileSync(mjsPath, esJsPath);
      console.log(`✓ Created ${esJsPath}`);
    } catch (error) {
      console.warn(`⚠ Could not create ${esJsPath}:`, error.message);
    }
  }
});

console.log('✓ @nivo .es.js files check complete');
