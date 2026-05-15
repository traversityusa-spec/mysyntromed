import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { sendEmailViaServer, notifyAdminsViaEmail } from '../services/emailClient.js';

const router = Router();

router.post('/notify-offline', requireAuth, async (req: AuthedRequest, res) => {
  const { receiverId, senderName, messagePreview, loginUrl } = req.body;

  if (!receiverId || !senderName || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const firestore = admin.firestore();

    // Fetch receiver info
    const receiverDoc = await firestore.collection('users').doc(receiverId).get();
    const receiverData = receiverDoc.data();
    const receiverRole = receiverData?.role || 'client';
    const receiverName = receiverData?.displayName || 'User';

    // Fetch sender info
    const senderDoc = await firestore.collection('users').doc(req.user!.uid).get();
    const senderData = senderDoc.data();
    const senderRole = senderData?.role || 'client';
    const senderDisplayName = senderData?.displayName || senderName;

    // Notify the admin about the message activity
    const preview = (messagePreview || '').substring(0, 120);
    const dashboardLink = `${loginUrl.replace(/\/+$/, '')}/admin/conversations`;
    notifyAdminsViaEmail(
      admin,
      `[MySyntroMed] New Message from ${senderDisplayName}`,
      `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">New Message Activity</h2>
        <p style="color: #475569;"><strong>${senderDisplayName}</strong> (${senderRole}) sent a message to <strong>${receiverName}</strong> (${receiverRole}).</p>
        ${preview ? `<div style="background: #f8fafc; border-left: 4px solid #0d9488; padding: 12px; margin: 16px 0; color: #475569; font-style: italic;">"${preview}..."</div>` : ''}
        <a href="${dashboardLink}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Messages</a>
      </div>`
    );

    // Check if recipient is offline
    const statusRef = admin.database().ref(`/status/${receiverId}`);
    const snap = await statusRef.once('value');
    let isOffline = true;
    if (snap.exists() && snap.val().state === 'online') {
      isOffline = false;
    }

    if (isOffline) {
      const email = receiverData?.email;
      if (email) {
        const prefs = receiverData?.notificationPreferences;
        if (!prefs || prefs.emailMessages !== false) {
          const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
          const serviceKey = process.env.EMAIL_SERVICE_KEY;
          fetch(`${emailServerUrl}/send-unread-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({
              email,
              receiverName,
              senderName: senderDisplayName,
              messagePreview: messagePreview?.substring(0, 100),
              loginUrl,
              receiverRole,
            }),
          }).catch(e => console.error('[NOTIFY] Offline email failed:', e));
        }
      }
    }

    return res.json({ sent: true });
  } catch (error: any) {
    console.error('[NOTIFY] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
