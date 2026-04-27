#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚂 MySyntroMed - Automated Railway Deployment');
console.log('=============================================\n');

try {
  // Check if railway CLI is available
  execSync('railway --version', { stdio: 'pipe' });
  console.log('✅ Railway CLI ready');
} catch (error) {
  console.log('❌ Railway CLI not found. Installing...');
  execSync('npm install -g @railway/cli', { stdio: 'inherit' });
}

console.log('🔐 Please login to Railway in your browser...');
try {
  execSync('railway login', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Login may have failed or was cancelled');
  console.log('   Please run: railway login');
  process.exit(1);
}

console.log('📁 Creating Railway project...');
try {
  execSync('railway init --name mysyntromed-backend --yes', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Project creation may have failed');
  console.log('   Please run: railway init');
}

console.log('🔧 Setting environment variables...');

// Read .env file and set variables
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));

  for (const line of envLines) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      try {
        execSync(`railway variables set ${key}="${value}"`, { stdio: 'pipe' });
        console.log(`   ✅ Set ${key}`);
      } catch (error) {
        console.log(`   ⚠️  Failed to set ${key}`);
      }
    }
  }
} else {
  console.log('   ⚠️  No .env file found. Please set variables manually:');
  console.log('   railway variables set NODE_ENV=production');
  console.log('   railway variables set PORT=3001');
  console.log('   railway variables set FRONTEND_ORIGIN=https://mysyntromed.com');
  console.log('   railway variables set FIREBASE_PROJECT_ID=mysyntromed-81242');
}

console.log('🚀 Deploying to Railway...');
try {
  execSync('railway deploy', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Deployment may have failed');
  console.log('   Please run: railway deploy');
}

console.log('🌐 Getting your Railway URL...');
try {
  const domain = execSync('railway domain', { encoding: 'utf8' });
  console.log(`\n🎉 Deployment complete!`);
  console.log(`   Backend URL: ${domain.trim()}`);
  console.log(`\n💡 Next: Run 'node update-frontend-url.mjs' and enter this URL`);
} catch (error) {
  console.log('⚠️  Could not get domain. Please run: railway domain');
}

console.log('\n✨ Railway Free Tier: 512MB RAM, 1GB disk, 512 hours/month');
console.log('   No credit card required! 🎁');