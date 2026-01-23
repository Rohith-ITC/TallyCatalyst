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

// Fix echarts and zrender tslib files
const tslibPackages = [
  { parent: 'echarts', name: 'echarts' },
  { parent: 'zrender', name: 'zrender' }
];

tslibPackages.forEach(({ parent, name }) => {
  const tslibDir = path.join(__dirname, '..', 'node_modules', parent, 'node_modules', 'tslib');
  const mainTslibPath = path.join(__dirname, '..', 'node_modules', 'tslib', 'tslib.es6.js');
  const targetTslibPath = path.join(tslibDir, 'tslib.es6.js');
  
  // Check if the directory exists but file is missing
  if (fs.existsSync(tslibDir) && !fs.existsSync(targetTslibPath)) {
    // Try to copy from main tslib if it exists
    if (fs.existsSync(mainTslibPath)) {
      try {
        // Ensure directory exists
        if (!fs.existsSync(tslibDir)) {
          fs.mkdirSync(tslibDir, { recursive: true });
        }
        fs.copyFileSync(mainTslibPath, targetTslibPath);
        console.log(`✓ Created ${targetTslibPath}`);
      } catch (error) {
        console.warn(`⚠ Could not create ${targetTslibPath}:`, error.message);
      }
    } else {
      // If main tslib doesn't have .es6.js, try to find any tslib file
      const mainTslibDir = path.join(__dirname, '..', 'node_modules', 'tslib');
      if (fs.existsSync(mainTslibDir)) {
        const tslibFiles = fs.readdirSync(mainTslibDir).filter(f => f.endsWith('.js'));
        if (tslibFiles.length > 0) {
          const sourceFile = path.join(mainTslibDir, tslibFiles[0]);
          try {
            if (!fs.existsSync(tslibDir)) {
              fs.mkdirSync(tslibDir, { recursive: true });
            }
            fs.copyFileSync(sourceFile, targetTslibPath);
            console.log(`✓ Created ${targetTslibPath} from ${tslibFiles[0]}`);
          } catch (error) {
            console.warn(`⚠ Could not create ${targetTslibPath}:`, error.message);
          }
        }
      }
    }
  }
});

console.log('✓ tslib files check complete');