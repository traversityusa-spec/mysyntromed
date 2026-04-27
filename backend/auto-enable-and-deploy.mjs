import { execSync, spawn } from 'child_process';
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';

const projectId = '1074510275502';
const projectNumber = '1074510275502';

function log(msg, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}${msg}${colors.reset}`);
}

async function enableCloudRunAPI() {
  log('\n🔐 Extracting Firebase authentication...\n', 'info');
  
  // Try to get the access token from Firebase CLI
  try {
    const refreshTokenPath = path.join(os.homedir(), '.config/firebase/credentials.json');
    
    if (!fs.existsSync(refreshTokenPath)) {
      log('⚠ Firebase credentials not found at: ' + refreshTokenPath, 'warn');
      return false;
    }
    
    const credentials = JSON.parse(fs.readFileSync(refreshTokenPath, 'utf-8'));
    const refreshToken = credentials.refresh_token;
    
    if (!refreshToken) {
      log('⚠ No refresh token found', 'warn');
      return false;
    }
    
    log('✓ Found Firebase credentials', 'success');
    log('📡 Requesting access token...', 'info');
    
    // Exchange refresh token for access token
    const accessToken = await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
        client_secret: 'o69Jyy7F3dJQcMtFd7VsStUi'
      });

      const req = https.request({
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) {
              resolve(parsed.access_token);
            } else {
              reject(new Error('No access token in response'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    log('✓ Got access token', 'success');
    
    // Enable Cloud Run API
    log('\n🚀 Enabling Cloud Run API...', 'info');
    
    return new Promise((resolve) => {
      const enableData = JSON.stringify({
        id: 'run.googleapis.com'
      });

      const req = https.request({
        hostname: 'servicemanagement.googleapis.com',
        port: 443,
        path: `/v1/services/run.googleapis.com/enable?project=${projectId}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': enableData.length
        }
      }, (res) => {
        log(`Status: ${res.statusCode}`, 'info');
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 409) {
            log('✓ Cloud Run API enabled!', 'success');
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });

      req.on('error', (e) => {
        log(`⚠ Error: ${e.message}`, 'warn');
        resolve(false);
      });
      
      req.write(enableData);
      req.end();
    });

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    return false;
  }
}

async function deployBackend() {
  log('\n⏳ Waiting 15 seconds for API to propagate...', 'info');
  await new Promise(r => setTimeout(r, 15000));
  
  log('\n🚀 Starting deployment...\n', 'success');
  
  try {
    execSync('npx firebase deploy --only hosting', { stdio: 'inherit' });
    log('\n✅ Deployment successful!', 'success');
    return true;
  } catch (error) {
    log('\n❌ Deployment failed', 'error');
    return false;
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'info');
  log('║   MySyntroMed - Automated API Enablement & Deployment      ║', 'info');
  log('╚════════════════════════════════════════════════════════════╝\n', 'info');

  const apiEnabled = await enableCloudRunAPI();
  
  if (apiEnabled) {
    await deployBackend();
  } else {
    log('\n⚠ Could not auto-enable API, please do manually:', 'warn');
    log(`\n1. Open: https://console.cloud.google.com/apis/library/run.googleapis.com?project=${projectId}`, 'info');
    log('2. Click "Enable"', 'info');
    log('3. Wait 1-2 minutes', 'info');
    log('4. Run: cd backend && npx firebase deploy --only hosting\n', 'info');
  }
}

main().catch(error => {
  log(`Fatal error: ${error.message}\n`, 'error');
  process.exit(1);
});
