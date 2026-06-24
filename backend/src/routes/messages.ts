import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { sendMessageNotification, notifyAdminsViaEmail } from '../services/emailClient.js';

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

    // Send email to recipient and admins
    await sendMessageNotification(
      admin,
      req.user!.uid,
      senderDisplayName,
      senderRole,
      receiverId,
      receiverName,
      receiverData?.email,
      receiverRole,
      messagePreview,
      loginUrl
    );

    return res.json({ sent: true });
  } catch (error: any) {
    console.error('[NOTIFY] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
