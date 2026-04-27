#!/usr/bin/env node

import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔄 Update Frontend API URL for Render Backend');
console.log('=============================================\n');

rl.question('Enter your Render backend URL (e.g., https://mysyntromed-backend.onrender.com): ', (renderUrl) => {
  if (!renderUrl.trim()) {
    console.log('❌ No URL provided. Exiting...');
    rl.close();
    return;
  }

  // Remove trailing slash if present
  const cleanUrl = renderUrl.replace(/\/$/, '');

  const envPath = 'frontend/.env';
  let envContent = '';

  try {
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add VITE_API_BASE_URL
    const apiUrlRegex = /^VITE_API_BASE_URL=.*/m;
    const newApiUrl = `VITE_API_BASE_URL=${cleanUrl}`;

    if (apiUrlRegex.test(envContent)) {
      envContent = envContent.replace(apiUrlRegex, newApiUrl);
    } else {
      envContent += `\n${newApiUrl}`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`✅ Updated frontend/.env with API URL: ${cleanUrl}`);
    console.log('🚀 Ready to deploy frontend to production!');

  } catch (error) {
    console.error('❌ Error updating frontend config:', error.message);
  }

  rl.close();
});