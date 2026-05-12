import { Router } from 'express';
import { sendNewRequestEmailToAdmin } from '../services/requestEmailService.js';
import { sendStatusChangeEmail } from '../services/statusEmailService.js';

const router = Router();

router.post('/notify-admin', async (req, res) => {
  const { clientName, clientEmail, requestType, description, priority, loginUrl, specialistName, specialistId } = req.body;

  if (!clientName && !clientEmail) {
    return res.status(400).json({ error: 'Missing clientName or clientEmail' });
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mysyntromed.com';
    const baseUrl = loginUrl || 'https://mysyntromed.com';
    
    const result = await sendNewRequestEmailToAdmin({
      adminEmail,
      clientName: clientName || '',
      clientEmail: clientEmail || '',
      requestType: requestType || 'Support',
      description: description || '',
      priority: priority || 'normal',
      loginUrl: baseUrl,
    });

    if (!result.success) {
      console.warn(`[REQUEST EMAIL] Failed to send: ${result.error}`);
    }

    if (specialistId) {
      const admin = (await import('../firebaseAdmin.js')).default;
      const userSnap = await admin.firestore().collection('users').doc(specialistId).get();
      const specialistEmail = userSnap.exists ? userSnap.data()?.email : null;
      if (specialistEmail) {
        await sendStatusChangeEmail({
          recipientEmail: specialistEmail,
          recipientName: specialistName || 'Specialist',
          role: 'specialist',
          requestType: requestType || 'Request',
          oldStatus: '',
          newStatus: 'pending',
          changedByName: clientName || 'Client',
          loginUrl: baseUrl,
        });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[REQUEST EMAIL ERROR]:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/notify-status-change', async (req, res) => {
  const { requestId, requestType, status, changedByName, clientName, clientEmail, specialistName, specialistId, userId, loginUrl } = req.body;

  try {
    const baseUrl = loginUrl || 'https://mysyntromed.com';

    if (clientEmail) {
      await sendStatusChangeEmail({
        recipientEmail: clientEmail,
        recipientName: clientName || 'Client',
        role: 'client',
        requestType: requestType || 'Request',
        oldStatus: '',
        newStatus: status,
        changedByName: changedByName || 'System',
        loginUrl: baseUrl,
      });
    }

    if (specialistId) {
      const admin = (await import('../firebaseAdmin.js')).default;
      const userSnap = await admin.firestore().collection('users').doc(specialistId).get();
      const specialistEmail = userSnap.exists ? userSnap.data()?.email : null;
      if (specialistEmail) {
        await sendStatusChangeEmail({
          recipientEmail: specialistEmail,
          recipientName: specialistName || 'Specialist',
          role: 'specialist',
          requestType: requestType || 'Request',
          oldStatus: '',
          newStatus: status,
          changedByName: changedByName || 'System',
          loginUrl: baseUrl,
        });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[STATUS EMAIL ERROR]:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;