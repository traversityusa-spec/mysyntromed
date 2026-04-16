import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import admin, { adminAuth } from '../src/firebaseAdmin.js';

async function fixAdminProfile() {
  const email = 'admin@test.com';
  const role = 'admin';
  const password = 'Admin123!';

  try {
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      console.log(`Found existing user with UID: ${userRecord.uid}`);
    } catch (e) {
      console.log('User not found in Auth, creating...');
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: 'MySyntroMed Admin',
        emailVerified: true,
      });
      console.log(`Created new user with UID: ${userRecord.uid}`);
    }

    // Ensure custom claims are set
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });
    console.log(`Custom claims set to { role: '${role}' }`);

    // Ensure Firestore profile exists
    const userDocRef = admin.firestore().collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email,
      displayName: 'MySyntroMed Admin',
      role,
      isNewUser: false, // Set to false so admin can log in immediately
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('Firestore profile fixed/created successfully! 🎉');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing admin profile:', error);
    process.exit(1);
  }
}

fixAdminProfile();
