import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { notifyAdminsViaEmail, sendEmailViaServer } from '../services/emailClient.js';

const router = Router();

router.post('/call', requireAuth, async (req: AuthedRequest, res) => {
  const { type, specialistName, specialistId, date, time, loginUrl } = req.body;

  if (!type || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const baseUrl = loginUrl.replace(/\/+$/, '');
    const senderDoc = await admin.firestore().collection('users').doc(req.user!.uid).get();
    const senderData = senderDoc.data();
    const clientName = senderData?.displayName || senderData?.email || 'A client';

    const isScheduled = type === 'scheduled';
    const subject = isScheduled
      ? `[MySyntroMed] Call Scheduled - ${clientName} & ${specialistName || 'Specialist'}`
      : `[MySyntroMed] Instant Call Started - ${clientName} & ${specialistName || 'Specialist'}`;

    const html = `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">${isScheduled ? 'Call Scheduled' : 'Instant Call Started'}</h2>
      <p style="color: #475569;"><strong>${clientName}</strong> ${isScheduled ? 'scheduled a call with' : 'started an instant call with'} <strong>${specialistName || 'their specialist'}</strong>.</p>
      ${isScheduled && date ? `<p style="color: #64748b;">Date: ${date} | Time: ${time}</p>` : ''}
      <a href="${baseUrl}/admin/dashboard" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View in Dashboard</a>
    </div>`;

    await notifyAdminsViaEmail(admin, subject, html);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[NOTIFY CALL] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create', requireAuth, async (req: AuthedRequest, res) => {
  const { userId, recipientIds, title, message, type, data } = req.body;
  if ((!userId && !recipientIds) || !title || !message || !type) {
    return res.status(400).json({ error: 'Missing required fields: userId/recipientIds, title, message, type' });
  }
  try {
    const currentUid = req.user!.uid;
    const currentRole = req.user!.role;
    const ids = recipientIds ? (Array.isArray(recipientIds) ? recipientIds : [recipientIds]) : [userId];

    // Only admins can create notifications for other users
    const allForSelf = ids.every((id: string) => id === currentUid);
    if (!allForSelf && currentRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: can only create notifications for yourself' });
    }

    const createdDocs = [];

    for (const id of ids) {
      if (!id) continue;
      const docRef = await admin.firestore().collection('notifications').add({
        userId: id,
        title,
        message,
        type,
        read: false,
        data: data || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      createdDocs.push(docRef.id);

      if (type === 'system') {
        const userDoc = await admin.firestore().collection('users').doc(id).get();
        const userData = userDoc.data();
        const recipientEmail = userData?.email;
        const loginUrl = process.env.FRONTEND_ORIGIN || 'https://mysyntromed.com';

        if (recipientEmail) {
          sendEmailViaServer({
            to: recipientEmail,
            subject: `[MySyntroMed] ${title}`,
            html: `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #0f172a;">${title}</h2>
              <p style="color: #475569;">${message}</p>
              <a href="${loginUrl.replace(/\/+$/, '')}/portal/dashboard" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Dashboard</a>
            </div>`,
          }).catch(e => console.error('[NOTIFY CREATE] Email failed:', e));
        }
      }
    }

    res.json({ success: true, ids: createdDocs });
  } catch (error: any) {
    console.error('[NOTIFY CREATE] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
