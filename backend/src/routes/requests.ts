import { Router } from 'express';
import { sendNewRequestEmailToAdmin, sendNewRequestEmailToSpecialist } from '../services/requestEmailService.js';
import { sendStatusChangeEmail } from '../services/statusEmailService.js';

const router = Router();

router.post('/notify-admin', async (req, res) => {
  const { clientName, clientEmail, requestType, description, priority, loginUrl, specialistName, specialistId } = req.body;

  if (!clientName && !clientEmail) {
    return res.status(400).json({ error: 'Missing clientName or clientEmail' });
  }

  try {
    const admin = (await import('../firebaseAdmin.js')).default;
    const baseUrl = loginUrl || 'https://mysyntromed.com';

    // Send email to ALL admin users
    const adminSnap = await admin.firestore().collection('users').where('role', '==', 'admin').get();
    const emailPromises: Promise<any>[] = [];

    adminSnap.docs.forEach((doc: any) => {
      const adminData = doc.data();
      const adminEmail = adminData?.email;
      if (!adminEmail) return;
      const prefs = adminData?.notificationPreferences;
      if (prefs && prefs.emailRequests === false) return;

      emailPromises.push(
        sendNewRequestEmailToAdmin({
          adminEmail,
          clientName: clientName || '',
          clientEmail: clientEmail || '',
          requestType: requestType || 'Support',
          description: description || '',
          priority: priority || 'normal',
          loginUrl: baseUrl,
        })
      );
    });

    // To also support ADMIN_EMAIL env var fallback
    const envAdminEmail = process.env.ADMIN_EMAIL;
    if (envAdminEmail && !adminSnap.docs.some((d: any) => d.data()?.email === envAdminEmail)) {
      emailPromises.push(
        sendNewRequestEmailToAdmin({
          adminEmail: envAdminEmail,
          clientName: clientName || '',
          clientEmail: clientEmail || '',
          requestType: requestType || 'Support',
          description: description || '',
          priority: priority || 'normal',
          loginUrl: baseUrl,
        })
      );
    }

  // Send proper new-request email to assigned specialist
  if (specialistId) {
    const userSnap = await admin.firestore().collection('users').doc(specialistId).get();
    const specialistData = userSnap.data();
    const specialistEmail = specialistData?.email;
    const prefs = specialistData?.notificationPreferences;
    if (specialistEmail && (!prefs || prefs.emailRequests !== false)) {
      emailPromises.push(
        sendNewRequestEmailToSpecialist({
          specialistEmail,
          specialistName: specialistName || specialistData?.displayName || 'Specialist',
          clientName: clientName || '',
          clientEmail: clientEmail || '',
          requestType: requestType || 'Support',
          description: description || '',
          priority: priority || 'normal',
          loginUrl: baseUrl,
        })
      );
    }
  }

    const results = await Promise.allSettled(emailPromises);
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.warn(`[REQUEST EMAIL] Email send failed:`, r.reason);
      }
    });

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
    const admin = (await import('../firebaseAdmin.js')).default;

    if (clientEmail && userId) {
      const userSnap = await admin.firestore().collection('users').doc(userId).get();
      const userData = userSnap.data();
      const prefs = userData?.notificationPreferences;
      if (!prefs || prefs.emailRequests !== false) {
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
    }

    if (specialistId) {
      const userSnap = await admin.firestore().collection('users').doc(specialistId).get();
      const specialistEmail = userSnap.exists ? userSnap.data()?.email : null;
      const specialistData = userSnap.data();
      const prefs = specialistData?.notificationPreferences;
      if (specialistEmail && (!prefs || prefs.emailRequests !== false)) {
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