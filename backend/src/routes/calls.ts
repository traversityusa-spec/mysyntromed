import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

router.post('/create-meet', requireAuth, async (req: AuthedRequest, res) => {
  const { roomName } = req.body;

  const roomCode = `msm-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
  const meetLink = `https://meet.jit.si/MySyntroMed-${roomCode}`;

  return res.json({ meetLink, roomName });
});

export default router;
