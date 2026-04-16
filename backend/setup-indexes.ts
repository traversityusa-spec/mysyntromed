import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const databaseURL = process.env.FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const absolute = path.resolve(serviceAccountPath);
      const serviceAccount = JSON.parse(fs.readFileSync(absolute, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...(databaseURL && { databaseURL }),
      });
      console.log('✅ Firebase Admin initialized');
    } catch (err) {
      console.error('❌ Failed to load service account:', err);
    }
  }
}

const db = admin.firestore();

async function setupIndexes() {
  console.log('');
  console.log('📝 Adding test document to messages collection...');

  try {
    await db.collection('messages').add({
      participants: ['_setup_index_temp_user_1', '_setup_index_temp_user_2'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      text: 'Temporary document for index setup',
      senderId: '_setup_index_temp_user_1',
      senderName: 'System Setup',
      senderRole: 'system',
      receiverId: '_setup_index_temp_user_2',
      read: false,
      status: 'sent',
    });

    console.log('✅ Test document added successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('NOW: Go to Firebase Console and add the index:');
    console.log('🔗 https://console.firebase.google.com/project/mysyntromed-81242/firestore/indexes');
    console.log('');
    console.log('Add composite index:');
    console.log('   Collection: messages');
    console.log('   Fields: participants (Array) + createdAt (Descending)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

setupIndexes().catch(console.error);
