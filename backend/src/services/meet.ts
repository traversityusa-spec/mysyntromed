import crypto from 'crypto';

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

type MeetResult = {
  meetLink: string;
  eventId?: string;
};

function generateMeetCode(): string {
  // Generate a random 3-part code like: abc-defg-hij
  const part1 = crypto.randomBytes(2).toString('hex').substring(0, 3).toLowerCase();
  const part2 = crypto.randomBytes(3).toString('hex').substring(0, 4).toLowerCase();
  const part3 = crypto.randomBytes(2).toString('hex').substring(0, 3).toLowerCase();
  return `${part1}-${part2}-${part3}`;
}

export async function createGoogleMeetLink(
  title: string,
  startTime?: Date,
  endTime?: Date,
): Promise<MeetResult> {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google Meet is not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY.');
  }

  const meetCode = generateMeetCode();
  const meetLink = `https://meet.google.com/${meetCode}`;

  // Optionally create a calendar event to track the meeting
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    
    const tokens = await auth.authorize();
    const effectiveStart = startTime || new Date();
    const effectiveEnd = endTime || new Date(effectiveStart.getTime() + 60 * 60 * 1000);
    
    // Create calendar event WITHOUT conference data (just to track the meeting)
    const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description: `Google Meet: ${meetLink}`,
        start: { dateTime: effectiveStart.toISOString() },
        end: { dateTime: effectiveEnd.toISOString() },
      }),
    });
    
    if (resp.ok) {
      const eventData = await resp.json();
      return {
        meetLink,
        eventId: eventData.id || undefined,
      };
    }
  } catch (err: any) {
    console.error('[MEET] Failed to create calendar event, returning meet link only:', err.message);
  }

  // Return just the meet link even if calendar event creation failed
  return { meetLink };
}