import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const router = Router();

const GOOGLE_CALENDAR_ENABLED = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

router.post('/create-meet', requireAuth, async (req: AuthedRequest, res) => {
  const { roomName } = req.body;
  const uid = req.user?.uid;

  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!roomName) {
    return res.status(400).json({ error: 'roomName is required' });
  }

  try {
    const userSnap = await admin.firestore().collection('users').doc(uid).get();
    const userData = userSnap.data();
    const displayName = userData?.displayName || 'User';

    if (GOOGLE_CALENDAR_ENABLED) {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      const calendar = google.calendar({ version: 'v3', auth });
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      const event = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        requestBody: {
          summary: `MySyntroMed Call - ${roomName}`,
          description: `Call initiated by ${displayName}`,
          start: { dateTime: startTime.toISOString(), timeZone: 'UTC' },
          end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
          conferenceData: {
            createRequest: {
              requestId: `msm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      const meetLink = event.data.hangoutLink;
      return res.json({ meetLink, roomName });
    }

    const roomCode = `msm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const fallbackLink = `https://meet.google.com/lookup/${roomCode}`;
    return res.json({ meetLink: fallbackLink, roomName, fallback: true });
  } catch (error: any) {
    console.error('[CALLS] Failed to create Meet link:', error.message);
    const roomCode = `msm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const fallbackLink = `https://meet.google.com/lookup/${roomCode}`;
    return res.json({ meetLink: fallbackLink, roomName, fallback: true });
  }
});

export default router;
