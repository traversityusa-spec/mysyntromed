#!/usr/bin/env node

/**
 * MySyntroMed Backend - Automated Firebase Cloud Run Deployment
 * Run with: npm run deploy-auto
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
    try {
        log(`\n▶ ${description}...`, 'blue');
        execSync(command, { stdio: 'inherit' });
        log(`✓ ${description} complete`, 'green');
        return true;
    } catch (error) {
        log(`✗ ${description} failed: ${error.message}`, 'red');
        return false;
    }
}

async function deploy() {
    log('\n🚀 MySyntroMed Backend - Automated Firebase Cloud Run Deployment\n', 'blue');

    const steps = [
        {
            name: 'Build backend',
            command: 'npm run build'
        },
        {
            name: 'Install firebase-tools locally',
            command: 'npm install firebase-tools --save-dev --legacy-peer-deps 2>/dev/null || npm install firebase-tools --save-dev'
        }
    ];

    // Create firebase.json
    log('\n▶ Creating Firebase configuration...', 'blue');
    const firebaseConfig = {
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

    fs.writeFileSync(
        path.join(__dirname, 'firebase.json'),
        JSON.stringify(firebaseConfig, null, 2)
    );
    log('✓ Firebase configuration created', 'green');

    // Run build steps
    for (const step of steps) {
        if (!runCommand(step.command, step.name)) {
            log(`\n❌ Deployment failed at: ${step.name}`, 'red');
            process.exit(1);
        }
    }

    // Verify Docker
    try {
        execSync('docker --version', { stdio: 'pipe' });
        log('\n✓ Docker is available', 'green');
    } catch {
        log('\n⚠ Docker not found - Cloud Run deployment requires Docker', 'yellow');
    }

    // Final instructions
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('✅ Preparation complete!', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'green');

    log('📋 NEXT STEPS:\n', 'yellow');
    log('1. Login to Firebase:');
    log('   npx firebase login\n', 'blue');

    log('2. Deploy to Cloud Run:');
    log('   npx firebase deploy\n', 'blue');

    log('3. Or deploy directly with gcloud:');
    log('   gcloud run deploy mysyntromed-backend \\', 'blue');
    log('     --source . \\', 'blue');
    log('     --platform managed \\', 'blue');
    log('     --region us-central1 \\', 'blue');
    log('     --allow-unauthenticated\n', 'blue');

    log('Your backend will be available at:', 'yellow');
    log('https://mysyntromed-backend-[random].run.app\n', 'blue');

    log('📌 Configuration files created:', 'yellow');
    log('   - firebase.json', 'blue');
    log('   - .env (already exists)', 'blue');
    log('   - Dockerfile (already exists)\n', 'blue');
}

deploy().catch(error => {
    log(`\nFatal error: ${error.message}`, 'red');
    process.exit(1);
});
