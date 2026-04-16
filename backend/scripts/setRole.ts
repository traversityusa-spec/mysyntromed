import { config } from 'dotenv';
config();

import admin from '../src/firebaseAdmin.js';

const args = process.argv.slice(2);
const email = args[0];
const role = args[1] || 'specialist';

async function setRole() {
  if (!email) {
    console.error('Usage: npx tsx scripts/setRole.ts <user_email> [client|specialist|admin]');
    process.exit(1);
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    const db = admin.firestore();
    
    // Update the Firestore Database document
    await db.collection('users').doc(user.uid).update({ role });
    
    // Setup Custom Authentication Claims (for robust future security)
    await admin.auth().setCustomUserClaims(user.uid, { role });
    
    console.log(`✅ Successfully updated the user "${email}" to Role: "${role}"`);
    console.log(`When this user logs in through /portal/auth they will automatically be redirected to the ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error assigning role:', error);
    process.exit(1);
  }
}

setRole();
