import admin from '../src/firebaseAdmin.js';

async function checkAdmin() {
  const email = 'admin@test.com';
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log('Auth User:', { uid: user.uid, email: user.email, customClaims: user.customClaims });
    
    const doc = await admin.firestore().collection('users').doc(user.uid).get();
    if (doc.exists) {
      console.log('Firestore Doc:', doc.data());
    } else {
      console.log('Firestore Doc NOT FOUND for UID:', user.uid);
    }
  } catch (error) {
    console.error('Error checking admin:', error);
  }
  process.exit();
}

checkAdmin();
