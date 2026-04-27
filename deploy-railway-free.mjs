#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚂 MySyntroMed - FREE Railway Deployment');
console.log('=======================================\n');

console.log('✅ Railway CLI installed successfully!');
console.log('📋 Railway Free Tier Benefits:');
console.log('   • 512MB RAM, 1GB disk');
console.log('   • 512 hours/month (~21 days)');
console.log('   • No credit card required');
console.log('   • Consistent uptime (no sleeping)');
console.log('   • Built-in databases available\n');

console.log('🔧 Deployment Steps:');
console.log('   1. Create Railway account: https://railway.app');
console.log('   2. Install Railway CLI (already done)');
console.log('   3. Login to Railway');
console.log('   4. Create project and deploy\n');

console.log('⚡ Quick Deploy Commands:\n');

// Check if railway.json exists, if not create it
const railwayConfig = {
  build: {
    builder: "NIXPACKS"
  },
  deploy: {
    startCommand: "npm start"
  }
};

if (!fs.existsSync('backend/railway.json')) {
  fs.writeFileSync('backend/railway.json', JSON.stringify(railwayConfig, null, 2));
  console.log('✅ Created backend/railway.json');
}

console.log('📝 Run these commands in backend/ directory:');
console.log('');
console.log('   # Login to Railway');
console.log('   railway login');
console.log('');
console.log('   # Create new project');
console.log('   railway init');
console.log('');
console.log('   # Set environment variables');
console.log('   railway variables set NODE_ENV=production');
console.log('   railway variables set PORT=3001');
console.log('   railway variables set FRONTEND_ORIGIN=https://mysyntromed.com');
console.log('   railway variables set FIREBASE_PROJECT_ID=mysyntromed-81242');
console.log('   # ... add other env vars from your .env file');
console.log('');
console.log('   # Deploy');
console.log('   railway deploy');
console.log('');
console.log('   # Get your URL');
console.log('   railway domain');
console.log('');

console.log('🔗 Links:');
console.log('   Railway: https://railway.app');
console.log('   Docs: https://docs.railway.app/');
console.log('');

console.log('💡 Pro tip: Railway has better uptime than Render!');
console.log('   No sleeping, consistent performance.\n');

console.log('🎯 Ready to deploy? Run the commands above!');