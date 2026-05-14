import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

router.post('/notify-offline', requireAuth, async (req: AuthedRequest, res) => {
  const { receiverId, senderName, messagePreview, loginUrl } = req.body;
  const senderId = req.user?.uid;

  if (!receiverId || !senderName || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check receiver presence in RTDB
    const db = admin.database();
    const statusRef = db.ref(`/status/${receiverId}`);
    const snap = await statusRef.once('value');
    
    let isOffline = true;
    if (snap.exists()) {
      const data = snap.val();
      if (data.state === 'online') {
        isOffline = false;
      }
    }

    if (!isOffline) {
      // User is online, no need to send an email
      return res.json({ sent: false, reason: 'User is online' });
    }

    // User is offline. Fetch their email and name from Firestore
    const firestore = admin.firestore();
    const userDocRef = firestore.collection('users').doc(receiverId);
    const userSnap = await userDocRef.get();
    
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Receiver not found' });
    }
    
    const receiverData = userSnap.data();
    const email = receiverData?.email;
    const receiverName = receiverData?.displayName || 'User';
    const receiverRole = receiverData?.role || 'client';

    if (!email) {
      return res.json({ sent: false, reason: 'Receiver has no email' });
    }

    const prefs = receiverData?.notificationPreferences;
    if (prefs && prefs.emailMessages === false) {
      return res.json({ sent: false, reason: 'Receiver has email notifications disabled' });
    }

    // Call internal email service
    const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
    const serviceKey = process.env.EMAIL_SERVICE_KEY;
    
    const emailResponse = await fetch(`${emailServerUrl}/send-unread-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        receiverName,
        senderName,
        messagePreview: messagePreview?.substring(0, 100), // truncate for preview
        loginUrl,
        receiverRole,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      throw new Error(`Email server error: ${errText}`);
    }

    return res.json({ sent: true });
  } catch (error: any) {
    console.error('[NOTIFY] Error sending offline notification:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
