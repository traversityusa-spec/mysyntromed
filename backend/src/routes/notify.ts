import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { notifyAdminsViaEmail, sendEmailViaServer } from '../services/emailClient.js';

const router = Router();

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
    // Exception: any user can send call-type notifications (calls, Google Meet invites)
    const allForSelf = ids.every((id: string) => id === currentUid);
    if (!allForSelf && currentRole !== 'admin' && type !== 'call') {
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
