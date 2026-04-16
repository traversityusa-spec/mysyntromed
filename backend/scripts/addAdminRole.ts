import { config } from 'dotenv';
config();

import admin from '../src/firebaseAdmin.js';

async function addAdminRole() {
  const uid = '0X4h6bg2g0ZDgj2s4eOjdwZ9eit1';
  const email = 'thompsonfadaisi@gmail.com';
  const displayName = 'Thompson Fadaisi';

  try {
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      uid,
      email,
      displayName,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isNewUser: false,
    }, { merge: true });

    console.log('✅ Admin role added successfully!');
    console.log('   UID:', uid);
    console.log('   Email:', email);
    console.log('   Role: admin');
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

addAdminRole();
