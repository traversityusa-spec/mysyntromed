const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const FIREBASE_SERVICE_ACCOUNT_KEY = process.env.SERVICE_ACCOUNT_KEY;

type MeetResult = {
  meetLink: string;
  spaceName?: string;
};

function normalizePrivateKey(key: string): string {
  let normalized = key.trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\n/g, '\n');

  if (normalized.includes('-----BEGIN PRIVATE KEY-----') && !normalized.includes('\n')) {
    normalized = normalized
      .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
      .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
  }

  return normalized;
}

function parseServiceAccount(value: string): { clientEmail?: string; privateKey?: string } | null {
  const candidates = [value.trim()];

  try {
    candidates.push(Buffer.from(value.trim(), 'base64').toString('utf8'));
  } catch {
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key ? normalizePrivateKey(parsed.private_key) : undefined,
      };
    } catch {
    }
  }

  return null;
}

function getGoogleCredentials(): { email: string; key: string } | null {
  const explicitServiceAccount = GOOGLE_SERVICE_ACCOUNT_KEY ? parseServiceAccount(GOOGLE_SERVICE_ACCOUNT_KEY) : null;
  const fallbackServiceAccount = FIREBASE_SERVICE_ACCOUNT_KEY ? parseServiceAccount(FIREBASE_SERVICE_ACCOUNT_KEY) : null;

  const email =
    GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    explicitServiceAccount?.clientEmail ||
    fallbackServiceAccount?.clientEmail;

  const key =
    explicitServiceAccount?.privateKey ||
    (GOOGLE_SERVICE_ACCOUNT_KEY ? normalizePrivateKey(GOOGLE_SERVICE_ACCOUNT_KEY) : undefined) ||
    fallbackServiceAccount?.privateKey;

  if (!email || !key) return null;

  return { email, key };
}

function generateRandomMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

export async function createGoogleMeetLink(
  title: string,
  startTime?: Date,
  endTime?: Date,
): Promise<MeetResult> {
  const credentials = getGoogleCredentials();

  if (credentials) {
    try {
      const { google } = await import('googleapis');
      const auth = new google.auth.JWT({
        email: credentials.email,
        key: credentials.key,
        scopes: ['https://www.googleapis.com/auth/meetings'],
      });

      const tokens = await auth.authorize();

      const resp = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await resp.json();

      if (resp.ok) {
        const meetLink = data.meetingUri || `https://meet.google.com/${data.meetingCode}`;
        const spaceName = data.name || undefined;
        console.log('[MEET] Created space:', spaceName, meetLink);
        return { meetLink, spaceName };
      }

      console.warn('[MEET] API error, falling back to random code:', data.error?.message || JSON.stringify(data));
    } catch (err: any) {
      console.warn('[MEET] Exception, falling back to random code:', err.message);
    }
  } else {
    console.warn('[MEET] No credentials configured, using random Meet code');
  }

  const code = generateRandomMeetCode();
  const meetLink = `https://meet.google.com/${code}`;
  console.log('[MEET] Generated fallback link:', meetLink);
  return { meetLink };
}
