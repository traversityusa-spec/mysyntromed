#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚀 MySyntroMed - FREE Render Deployment');
console.log('=====================================\n');

// Check if we're in the right directory
if (!fs.existsSync('render.yaml')) {
  console.error('❌ Error: render.yaml not found. Please run from project root.');
  process.exit(1);
}

console.log('✅ Found render.yaml configuration');
console.log('📋 Deployment Checklist:');
console.log('   1. Create Render account at https://render.com');
console.log('   2. Connect your GitHub repository');
console.log('   3. Create new Web Service with these settings:');
console.log('      - Name: mysyntromed-backend');
console.log('      - Root Directory: backend');
console.log('      - Runtime: Node');
console.log('      - Build Command: npm install && npm run build');
console.log('      - Start Command: npm start');
console.log('      - Plan: Free');
console.log('   4. Add environment variables (see RENDER-FREE.md)');
console.log('   5. Deploy and get your URL');
console.log('\n💡 Pro tip: Use UptimeRobot (free) to keep backend awake');
console.log('   See RENDER-FREE.md for complete instructions\n');

console.log('🔗 Quick Links:');
console.log('   Render: https://render.com');
console.log('   UptimeRobot: https://uptimerobot.com');
console.log('   Full Guide: RENDER-FREE.md\n');

console.log('✨ Your backend will be FREE with these limits:');
console.log('   • 750 hours/month');
console.log('   • Sleeps after 15 min inactivity');
console.log('   • ~30 second cold starts');
console.log('   • But stays awake with UptimeRobot pings\n');

console.log('🎯 Ready to deploy? Follow the steps above!');