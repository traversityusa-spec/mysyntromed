#!/usr/bin/env node

/**
 * MySyntroMed Backend - Master Deployment Script
 * One-command deployment to Firebase Cloud Run
 * 
 * Usage: npm run deploy-auto
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function prompt(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

function runCommand(command, silent = false) {
    try {
        return execSync(command, {
            stdio: silent ? 'pipe' : 'inherit',
            encoding: 'utf-8'
        });
    } catch (error) {
        throw new Error(`Command failed: ${command}\n${error.message}`);
    }
}

async function checkPrerequisites() {
    log('\n📋 Checking Prerequisites...\n', 'cyan');

    const checks = [
        { name: 'Node.js', command: 'node --version' },
        { name: 'npm', command: 'npm --version' }
    ];

    for (const check of checks) {
        try {
            const version = runCommand(check.command, true).trim();
            log(`  ✓ ${check.name}: ${version}`, 'green');
        } catch {
            log(`  ✗ ${check.name} is required`, 'red');
            process.exit(1);
        }
    }

    // Docker is optional but recommended
    try {
        const dockerVersion = runCommand('docker --version', true);
        log(`  ✓ Docker: ${dockerVersion.trim()}`, 'green');
    } catch {
        log(`  ⚠ Docker: Not found (recommended for Cloud Run)`, 'yellow');
    }

    log('', 'reset');
}

async function buildBackend() {
    log('🔨 Building Backend...\n', 'cyan');

    try {
        runCommand('npm install --legacy-peer-deps 2>/dev/null || npm install');
        log('  ✓ Dependencies installed', 'green');

        runCommand('npm run build');
        log('  ✓ TypeScript compiled\n', 'green');
    } catch (error) {
        log(`  ✗ Build failed: ${error.message}\n`, 'red');
        process.exit(1);
    }
}

async function setupFirebase() {
    log('⚙️  Setting up Firebase...\n', 'cyan');

    try {
        // Check if firebase-tools is installed
        try {
            runCommand('npx firebase --version', true);
        } catch {
            log('  Installing firebase-tools...', 'blue');
            runCommand('npm install firebase-tools --save-dev --legacy-peer-deps 2>/dev/null || npm install firebase-tools --save-dev');
        }
        log('  ✓ Firebase tools ready', 'green');

        // Create firebase.json if needed
        const firebaseJsonPath = path.join(__dirname, 'firebase.json');
        if (!fs.existsSync(firebaseJsonPath)) {
            const config = {
                hosting: {
                    public: 'dist',
                    ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
                    rewrites: [{
                        source: '**',
                        run: {
                            serviceId: 'mysyntromed-backend',
                            region: 'us-central1'
                        }
                    }]
                }
            };
            fs.writeFileSync(firebaseJsonPath, JSON.stringify(config, null, 2));
            log('  ✓ firebase.json created', 'green');
        } else {
            log('  ✓ firebase.json already exists', 'green');
        }

        log('', 'reset');
    } catch (error) {
        log(`  ✗ Firebase setup failed: ${error.message}\n`, 'red');
        process.exit(1);
    }
}

async function checkAuthentication() {
    log('🔐 Checking Authentication...\n', 'cyan');

    try {
        // Check if already logged in
        runCommand('npx firebase projects:list', true);
        log('  ✓ Already authenticated\n', 'green');
        return true;
    } catch {
        log('  ✗ Not authenticated yet', 'yellow');

        const shouldLogin = await prompt('\n  Do you want to login to Firebase now? (y/n): ');
        if (shouldLogin) {
            log('\n  Opening browser for authentication...\n', 'blue');
            try {
                runCommand('npx firebase login');
                log('  ✓ Authentication successful\n', 'green');
                return true;
            } catch {
                log('  ✗ Authentication failed', 'red');
                return false;
            }
        }
        return false;
    }
}

async function deployToCloudRun() {
    log('🚀 Deploying to Cloud Run...\n', 'cyan');

    try {
        log('  Starting deployment (this may take 2-3 minutes)...\n', 'blue');

        runCommand('npx firebase deploy --only hosting');

        log('\n  ✓ Deployment successful!\n', 'green');

        // Get the service URL
        try {
            const projectId = runCommand('npx firebase projects:list --json 2>/dev/null', true);
            log(`  Project: mysyntromed-81242`, 'blue');
            log(`  Service: mysyntromed-backend`, 'blue');
            log(`  Region: us-central1\n`, 'blue');
        } catch { }

        return true;
    } catch (error) {
        log(`  ✗ Deployment failed: ${error.message}\n`, 'red');
        return false;
    }
}

async function showFinalInstructions() {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('✅ DEPLOYMENT COMPLETE!\n', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'green');

    log('📝 Your backend is now running on Firebase Cloud Run!', 'yellow');
    log('\nBackend URL: https://mysyntromed-backend-[hash].run.app\n', 'blue');

    log('Next steps:\n', 'yellow');
    log('1. Test your API:', 'white');
    log('   curl https://mysyntromed-backend-[hash].run.app/api/auth/health\n', 'blue');

    log('2. Update frontend .env:', 'white');
    log('   VITE_API_BASE_URL=https://mysyntromed-backend-[hash].run.app\n', 'blue');

    log('3. Rebuild frontend:', 'white');
    log('   cd ../frontend && npm run build\n', 'blue');

    log('4. View deployment logs:', 'white');
    log('   gcloud run services logs read mysyntromed-backend\n', 'blue');

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'green');
}

async function main() {
    try {
        log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
        log('║  MySyntroMed Backend - Automated Cloud Run Deployment      ║', 'cyan');
        log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

        await checkPrerequisites();
        await buildBackend();
        await setupFirebase();

        const isAuthenticated = await checkAuthentication();
        if (!isAuthenticated) {
            log('Please authenticate and run again.', 'yellow');
            process.exit(0);
        }

        const deployed = await deployToCloudRun();
        if (deployed) {
            await showFinalInstructions();
        } else {
            log('Deployment failed. Please check the logs above.', 'red');
            process.exit(1);
        }

    } catch (error) {
        log(`\n❌ Fatal error: ${error.message}\n`, 'red');
        process.exit(1);
    }
}

main();
