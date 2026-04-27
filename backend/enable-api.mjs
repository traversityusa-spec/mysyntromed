import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectId = '1074510275502';

console.log('🔧 Enabling Cloud Run API...\n');

try {
  // Try using firebase CLI to make API calls
  const result = execSync(`npx firebase apps:list`, { encoding: 'utf-8' });
  console.log('✓ Firebase authenticated\n');
  
  // Now try a direct deploy which might trigger API enablement
  console.log('⏳ Waiting 10 seconds for API to initialize...');
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n🚀 Retrying deployment...\n');
  execSync('npx firebase deploy --only hosting', { stdio: 'inherit' });
  
} catch (error) {
  console.error('Error:', error.message);
  
  // Try alternative approach - use the stored Firebase token
  console.log('\n📋 Alternative: Enable via Google Cloud Console');
  console.log('https://console.developers.google.com/apis/api/run.googleapis.com/overview?project=' + projectId);
  process.exit(1);
}
