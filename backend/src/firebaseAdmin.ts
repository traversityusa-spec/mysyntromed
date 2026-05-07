import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
const serviceAccountKey = process.env.SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;

let initialized = false;
let initAttempted = false;

function sanitizePrivateKey(key: string): string {
  if (!key) return key;
  let sanitized = key.trim();
  // Replace escaped newlines (\\n) with actual newlines
  sanitized = sanitized.replace(/\\n/g, '\n');
  // Ensure proper PEM format - add newlines if missing
  if (sanitized.includes('-----BEGIN PRIVATE KEY-----') && !sanitized.includes('\n')) {
    sanitized = sanitized
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }
  return sanitized;
}

function initFirebase() {
  if (initAttempted) return initialized;
  initAttempted = true;

  if (admin.apps.length > 0) {
    initialized = true;
    return true;
  }

  const databaseURL = process.env.FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  // Method 1: Individual env vars (FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey && projectId) {
    try {
      privateKey = sanitizePrivateKey(privateKey);

      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('[FIREBASE] Private key missing PEM header. Value starts with:', privateKey.substring(0, 40));
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
      console.error('[FIREBASE] Private key length:', privateKey?.length, 'Has PEM header:', privateKey?.includes('-----BEGIN PRIVATE KEY-----'));
    }
  }

  // Method 2: SERVICE_ACCOUNT_KEY JSON
  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      if (parsed.private_key) {
        parsed.private_key = sanitizePrivateKey(parsed.private_key);
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

  // Fallback: initialize without credentials (limited functionality)
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

  console.error('[FIREBASE] All initialization methods failed. Firebase features will be unavailable.');
  return false;
}

// Initialize on import
initFirebase();

// Lazy getter for adminAuth - doesn't crash on module load
function getAdminAuth() {
  if (!initialized) {
    console.warn('[FIREBASE] adminAuth requested but Firebase not initialized');
    return null;
  }
  return admin.auth();
}

function getAdmin() {
  if (!initialized) {
    console.warn('[FIREBASE] admin requested but Firebase not initialized');
    return null;
  }
  return admin;
}

// Proxy-based adminAuth that lazily accesses admin.auth() on property access
const adminAuthProxy = new Proxy({} as any, {
  get(_target, prop) {
    if (!initialized) {
      console.warn('[FIREBASE] adminAuth accessed but Firebase not initialized');
      return undefined;
    }
    const auth = admin.auth();
    return (auth as any)[prop];
  },
});

export { getAdminAuth, getAdmin };
export const adminAuth = adminAuthProxy;
export default admin;
