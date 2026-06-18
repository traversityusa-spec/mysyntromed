import crypto from 'crypto';

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

type MeetResult = {
  meetLink: string;
  eventId?: string;
};

export async function createGoogleMeetLink(
  title: string,
  startTime?: Date,
  endTime?: Date,
): Promise<MeetResult> {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Google Meet is not configured. Please set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY.');
  }

  const { google } = await import('googleapis');
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  const eventBody: any = {
    summary: title,
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };

  if (startTime && endTime) {
    eventBody.start = { dateTime: startTime.toISOString() };
    eventBody.end = { dateTime: endTime.toISOString() };
  }

  const res = await calendar.events.create({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: eventBody,
  });

  if (!res.data.hangoutLink) {
    throw new Error('Google Meet returned no hangout link.');
  }

  return {
    meetLink: res.data.hangoutLink,
    eventId: res.data.id || undefined,
  };
}
