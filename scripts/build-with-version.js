#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Generate version based on timestamp
const version = `${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`;

console.log(`Building with version: ${version}`);

// Update package.json with new version
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
packageJson.version = version;
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));

// Set environment variable for build
process.env.REACT_APP_VERSION = version;

// Run the build
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed successfully!');
  console.log(`Version: ${version}`);
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
