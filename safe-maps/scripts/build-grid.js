/**
 * Orchestrates data pipeline: fetches lighting, builds crime grid.
 * Run: node scripts/build-grid.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('=== Safe Maps Data Pipeline ===\n');

try {
  console.log('1. Building crime grid...');
  require('./fetch-crime.js');
  console.log('');
} catch (e) {
  console.error('Crime script failed:', e.message);
}

try {
  console.log('2. Fetching street lighting...');
  require('./fetch-lighting.js');
  console.log('');
} catch (e) {
  console.error('Lighting script failed:', e.message);
}

console.log('Done. Data files in server/src/data/');
