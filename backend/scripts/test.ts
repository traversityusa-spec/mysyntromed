import { config } from 'dotenv';
config();
import admin from '../src/firebaseAdmin.js';

async function test() {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
      console.log('No users found.');
    } else {
      snapshot.forEach(doc => {
        console.log(doc.id, doc.data().email, doc.data().role);
      });
    }
    process.exit(0);
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
test();
