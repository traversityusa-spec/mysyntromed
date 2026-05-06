import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;

let initialized = false;

function initFirebase() {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return true;
  }

  const databaseURL = process.env.FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  // Method 1: Individual env vars
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey && projectId) {
    try {
      // Handle newlines
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('[FIREBASE] Private key missing PEM header');
        return false;
      }

      const credential = admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      });

      const config: any = { credential };
      if (databaseURL) config.databaseURL = databaseURL;

      admin.initializeApp(config);
      initialized = true;
      console.log('[FIREBASE] Initialized with individual env vars');
      return true;
    } catch (err: any) {
      console.error('[FIREBASE] Failed with individual env vars:', err.message);
    }
  }

  // Method 2: SERVICE_ACCOUNT_KEY JSON
  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      if (parsed.private_key && parsed.private_key.includes('\\n')) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }

      const config: any = {
        credential: admin.credential.cert(parsed),
      };
      if (databaseURL) config.databaseURL = databaseURL;

      admin.initializeApp(config);
      initialized = true;
      console.log('[FIREBASE] Initialized with SERVICE_ACCOUNT_KEY');
      return true;
    } catch (err: any) {
      console.error('[FIREBASE] Failed to parse SERVICE_ACCOUNT_KEY:', err.message);
    }
  }

  // Method 3: Service account file
  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
      const absolute = path.resolve(serviceAccountPath);
      const serviceAccount = JSON.parse(fs.readFileSync(absolute, 'utf8'));
      const config: any = {
        credential: admin.credential.cert(serviceAccount),
      };
      if (databaseURL) config.databaseURL = databaseURL;

      admin.initializeApp(config);
      initialized = true;
      console.log('[FIREBASE] Initialized with service account file');
      return true;
    } catch (err: any) {
      console.error('[FIREBASE] Failed to load service account file:', err.message);
    }
  }

  // Fallback
  try {
    if (projectId) {
      const config: any = { projectId };
      if (databaseURL) config.databaseURL = databaseURL;
      admin.initializeApp(config);
      initialized = true;
      console.warn('[FIREBASE] Initialized without credentials - limited functionality');
      return true;
    }
  } catch (err: any) {
    console.error('[FIREBASE] Failed fallback init:', err.message);
  }

  return false;
}

// Initialize on import
initFirebase();

export const adminAuth = admin.auth();
export default admin;
