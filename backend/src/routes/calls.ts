import { Router } from 'express';
import crypto from 'crypto';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

router.post('/create-meet', requireAuth, async (req: AuthedRequest, res) => {
  const { roomName } = req.body;

  const roomCode = `msm-${crypto.randomBytes(6).toString('hex')}`;
  const meetLink = `https://meet.jit.si/MySyntroMed-${roomCode}`;

  return res.json({ meetLink, roomName });
});

export default router;
