import 'dotenv/config';
import admin from '../src/firebaseAdmin.js';

async function seedAdminUser() {
  console.log('🔐 Configuring MySyntroMed Admin Seed...');
  
  const email = 'admin@test.com';
  const password = 'Admin123!';
  const displayName = 'Admin User';

  console.log(`🚀 Target: ${email}`);
  
  try {
    const auth = admin.auth();
    console.log('Firebase Admin: ', admin.app().name ? 'Initialized' : 'Not initialized');
    
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log('Admin user already exists. Updating password...');
      await auth.updateUser(user.uid, { password, emailVerified: true });
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        user = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: true,
        });
        console.log('✅ Admin user created!');
      } else {
        throw e;
      }
    }

    const db = admin.firestore();
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      displayName,
      role: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isNewUser: false,
    }, { merge: true });

    console.log('\n🎉 Admin account ready!');
    console.log('   Email: ' + email);
    console.log('   Password: ' + password);
    console.log('\n📝 Note: Email is pre-verified for testing.');
    console.log('   For production, remove emailVerified: true in the script.\n');
    
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

seedAdminUser();
