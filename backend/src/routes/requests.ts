import { Router } from 'express';
import { sendNewRequestEmailToAdmin, sendNewRequestEmailToSpecialist } from '../services/requestEmailService.js';
import { sendStatusChangeEmail } from '../services/statusEmailService.js';
import { notifyAdminsViaEmail } from '../services/emailClient.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/requireAuth.js';

const escapeHtml = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const router = Router();

router.post('/notify-admin', requireAuth, async (req: AuthedRequest, res) => {
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
          clientName: escapeHtml(clientName || ''),
          clientEmail: escapeHtml(clientEmail || ''),
          requestType: escapeHtml(requestType || 'Support'),
          description: escapeHtml(description || ''),
          priority: escapeHtml(priority || 'normal'),
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
          clientName: escapeHtml(clientName || ''),
          clientEmail: escapeHtml(clientEmail || ''),
          requestType: escapeHtml(requestType || 'Support'),
          description: escapeHtml(description || ''),
          priority: escapeHtml(priority || 'normal'),
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
          specialistName: escapeHtml(specialistName || specialistData?.displayName || 'Specialist'),
          clientName: escapeHtml(clientName || ''),
          clientEmail: escapeHtml(clientEmail || ''),
          requestType: escapeHtml(requestType || 'Support'),
          description: escapeHtml(description || ''),
          priority: escapeHtml(priority || 'normal'),
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

router.post('/notify-status-change', requireAuth, async (req: AuthedRequest, res) => {
  const { requestId, requestType, status, changedByName, clientName, clientEmail, specialistName, specialistId, userId, loginUrl } = req.body;

  const sanitizedStatus = typeof status === 'string' ? status : '';

  try {
    const baseUrl = loginUrl || 'https://mysyntromed.com';
    const admin = (await import('../firebaseAdmin.js')).default;

    if (userId) {
      const userSnap = await admin.firestore().collection('users').doc(userId).get();
      const userData = userSnap.data();
      const userEmail = userData?.email || clientEmail;
      const prefs = userData?.notificationPreferences;
      if (userEmail && (!prefs || prefs.emailRequests !== false)) {
        await sendStatusChangeEmail({
          recipientEmail: userEmail,
          recipientName: escapeHtml(clientName || userData?.displayName || 'Client'),
          role: 'client',
          requestType: escapeHtml(requestType || 'Request'),
          oldStatus: '',
          newStatus: sanitizedStatus,
          changedByName: escapeHtml(changedByName || 'System'),
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
          recipientName: escapeHtml(specialistName || 'Specialist'),
          role: 'specialist',
          requestType: escapeHtml(requestType || 'Request'),
          oldStatus: '',
          newStatus: sanitizedStatus,
          changedByName: escapeHtml(changedByName || 'System'),
          loginUrl: baseUrl,
        });
      }
    }

    // Also notify all admins about the status change
    const statusLabel = sanitizedStatus === 'in_progress' ? 'In Progress' : sanitizedStatus.charAt(0).toUpperCase() + sanitizedStatus.slice(1);
    notifyAdminsViaEmail(
      admin,
      `[MySyntroMed] Request Updated: ${escapeHtml(requestType || 'Request')} is now ${escapeHtml(statusLabel)}`,
      `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">Request Status Updated</h2>
        <p style="color: #475569;"><strong>${escapeHtml(changedByName || 'Someone')}</strong> changed the status of <strong>${escapeHtml(requestType || 'a request')}</strong> to <strong>${escapeHtml(statusLabel)}</strong>.</p>
        <p style="color: #64748b;">Client: ${escapeHtml(clientName || 'N/A')} | Specialist: ${escapeHtml(specialistName || 'N/A')}</p>
        <a href="${baseUrl}/admin/dashboard" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View in Dashboard</a>
      </div>`
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('[STATUS EMAIL ERROR]:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;