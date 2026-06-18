import crypto from 'crypto';

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

type MeetResult = {
  meetLink: string;
  eventId?: string;
};

async function getAccessToken(scopes: string[]): Promise<string> {
  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n'),
    scopes,
  });
  const tokens = await auth.authorize();
  return tokens.access_token!;
}

export async function createGoogleMeetLink(
  title: string,
  startTime?: Date,
  endTime?: Date,
): Promise<MeetResult> {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google Meet is not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY.');
  }

  const token = await getAccessToken(['https://www.googleapis.com/auth/meetings']);

  const resp = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(`Google Meet API error: ${data.error?.message || JSON.stringify(data)}`);
  }

  const meetLink = data.meetingUri || `https://meet.google.com/${data.meetingCode}`;

  return {
    meetLink,
    eventId: data.name || undefined,
  };
}
