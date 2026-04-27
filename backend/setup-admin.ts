/**
 * Admin Setup Script - Run this to create your admin account
 * 
 * PREREQUISITES:
 * 1. Download your Firebase service account key:
 *    - Go to Firebase Console > Project Settings > Service Accounts
 *    - Click "Generate new private key"
 *    - Save the JSON file as "serviceAccountKey.json" in the backend folder
 * 
 * 2. Run: cd backend && npx ts-node setup-admin.ts
 * 
 * This will create:
 * - Firebase Auth user for thompsonfadaisi@gmail.com
 * - Admin role in custom claims
 * - User profile in Firestore
 */

import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const ADMIN_EMAIL = 'thompsonfadaisi@gmail.com';
const ADMIN_PASSWORD = 'Admin@2024!'; // CHANGE THIS before running!

function checkServiceAccount() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('\n❌ ERROR: serviceAccountKey.json not found!\n');
    console.log('Please download it from:');
    console.log('Firebase Console > Project Settings > Service Accounts > Generate new private key\n');
    process.exit(1);
  }
}

async function setupAdmin() {
  console.log('🚀 MySyntroMed Admin Setup\n');
  console.log('=' .repeat(50) + '\n');

  checkServiceAccount();

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
      });
    }

    console.log('✓ Firebase initialized\n');

    // 1. Create or get user
    let userRecord;
    let isNewUser = false;
    try {
      userRecord = await admin.auth().getUserByEmail(ADMIN_EMAIL);
      console.log(`✓ User already exists: ${userRecord.uid}`);
    } catch {
      userRecord = await admin.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: 'Thompson',
        emailVerified: true,
      });
      isNewUser = true;
      console.log(`✓ Created new user: ${userRecord.uid}`);
    }

    const uid = userRecord.uid;

    // 2. Set admin role in custom claims
    await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    console.log('✓ Admin role assigned');

    // 3. Create Firestore profile
    await admin.firestore().collection('users').doc(uid).set({
      uid,
      email: ADMIN_EMAIL,
      displayName: 'Thompson',
      role: 'admin',
      isNewUser: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('✓ Firestore profile created');

    console.log('\n' + '=' .repeat(50));
    console.log('✅ ADMIN SETUP COMPLETE!');
    console.log('=' .repeat(50));
    console.log('\nLogin at: /admin');
    console.log(`Email:    ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log('\n⚠️  IMPORTANT: Change this password after first login!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupAdmin();