import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { createGoogleMeetLink } from '../services/meet.js';

const router = Router();

router.post('/create-meet', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { roomName, startTime, endTime } = req.body;

    const result = await createGoogleMeetLink(
      roomName || 'MySyntroMed Call',
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
    );

    return res.json({ meetLink: result.meetLink, eventId: result.eventId, roomName });
  } catch (err: any) {
    console.error('[CALLS] Failed to create Google Meet link:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create Google Meet link' });
  }
});

export default router;
