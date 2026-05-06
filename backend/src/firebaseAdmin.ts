import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  // Method 1: Try individual env vars (most reliable for Railway)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  if (clientEmail && privateKey && projectId) {
    try {
      const credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      });
      admin.initializeApp({
        credential,
        ...(databaseURL && { databaseURL }),
      });
      console.log('Firebase Admin initialized with individual env vars');
    } catch (err) {
      console.error('Failed to init with individual env vars:', err);
    }
  }
  // Method 2: Try SERVICE_ACCOUNT_KEY JSON
  else if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      if (parsed.private_key && parsed.private_key.includes('\\n')) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        ...(databaseURL && { databaseURL }),
      });
      console.log('Firebase Admin initialized with SERVICE_ACCOUNT_KEY');
    } catch (err) {
      console.error('Failed to parse SERVICE_ACCOUNT_KEY:', err);
      if (projectId) {
        admin.initializeApp({ projectId, ...(databaseURL && { databaseURL }) });
      } else {
        admin.initializeApp(databaseURL ? { databaseURL } : undefined);
      }
    }
  }
  // Method 3: Try service account file
  else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
      const absolute = path.resolve(serviceAccountPath);
      const serviceAccount = JSON.parse(fs.readFileSync(absolute, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...(databaseURL && { databaseURL }),
      });
      console.log('Firebase Admin initialized with service account file');
    } catch (err) {
      console.error('Failed to load service account:', err);
      if (projectId) {
        admin.initializeApp({ projectId, ...(databaseURL && { databaseURL }) });
      } else {
        admin.initializeApp(databaseURL ? { databaseURL } : undefined);
      }
    }
  } else if (projectId) {
    admin.initializeApp({ projectId, ...(databaseURL && { databaseURL }) });
  } else {
    admin.initializeApp(databaseURL ? { databaseURL } : undefined);
  }
}

export const adminAuth = admin.auth();
export default admin;
