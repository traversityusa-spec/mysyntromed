import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

config();

const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (SERVICE_ACCOUNT_PATH && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const absolute = path.resolve(SERVICE_ACCOUNT_PATH);
    const serviceAccount = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (FIREBASE_PROJECT_ID) {
    admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
  } else {
    admin.initializeApp();
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('');
  return [0, 6, 12, 18].map((i) => code.slice(i, i + 6)).join('-');
}

const ADMIN_EMAIL = 'admin@mysyntromed.com';
const ADMIN_PASSWORD = 'Admin123!';

async function seed() {
  console.log('🔧 MySyntroMed Seed Script\n');
  console.log('─'.repeat(40));
  
  const db = admin.firestore();

  // 1. Create Admin User
  console.log('\n1️⃣  Creating admin account...');
  let adminUser;
  try {
    adminUser = await admin.auth().getUserByEmail(ADMIN_EMAIL);
    await admin.auth().updateUser(adminUser.uid, { 
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    console.log('   ✓ Admin user updated');
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      adminUser = await admin.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: 'Admin User',
        emailVerified: true,
      });
      console.log('   ✓ Admin user created');
    } else {
      throw e;
    }
  }

  // Create Firestore user document
  await db.collection('users').doc(adminUser.uid).set({
    uid: adminUser.uid,
    email: ADMIN_EMAIL,
    displayName: 'Admin User',
    role: 'admin',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isNewUser: false,
  }, { merge: true });
  console.log('   ✓ Firestore profile created');

  // 2. Create Invite Codes
  console.log('\n2️⃣  Creating invite codes...');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const codes = [];
  for (const role of ['client', 'specialist']) {
    const code = generateCode();
    await db.collection('invite_codes').add({
      code,
      role,
      createdBy: adminUser.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      used: false,
      label: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    });
    codes.push({ role, code });
    console.log(`   ✓ ${role} code: ${code}`);
  }

  // Summary
  console.log('\n' + '─'.repeat(40));
  console.log('\n✅ SETUP COMPLETE!\n');
  console.log('📋 TEST CREDENTIALS:\n');
  console.log('   ADMIN:');
  console.log(`   ├─ URL:      /admin`);
  console.log(`   ├─ Email:    ${ADMIN_EMAIL}`);
  console.log(`   └─ Password: ${ADMIN_PASSWORD}\n`);
  console.log('   CLIENT (use at /portal):');
  console.log(`   └─ Code: ${codes.find(c => c.role === 'client')?.code}\n`);
  console.log('   SPECIALIST (use at /portal):');
  console.log(`   └─ Code: ${codes.find(c => c.role === 'specialist')?.code}\n`);
  console.log('─'.repeat(40) + '\n');
  
  process.exit(0);
}

seed().catch((e) => {
  console.error('\n❌ Error:', e.message);
  console.log('\n💡 Make sure Firebase credentials are configured in backend/.env');
  process.exit(1);
});
