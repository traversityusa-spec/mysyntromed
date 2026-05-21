import { Router } from 'express';
import admin from '../firebaseAdmin.js';
import { requireAuth, type AuthedRequest } from '../middleware/requireAuth.js';
import { sendEmailViaServer, notifyAdminsViaEmail } from '../services/emailClient.js';
import { getLogoHTML } from '../services/emailLogo.js';

const router = Router();

router.post('/notify', requireAuth, async (req: AuthedRequest, res) => {
  const { specialistId, specialistName, step, status, loginUrl, recipientEmails } = req.body;

  if (!specialistId || !step || !status || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields: specialistId, step, status, loginUrl' });
  }

  try {
    const baseUrl = loginUrl.replace(/\/+$/, '');
    const statusLabel = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
    const statusColor = status === 'completed' ? '#10b981' : status === 'in_progress' ? '#3b82f6' : '#94a3b8';
    const displayName = specialistName || 'Your Specialist';

    const buildHtml = (recipientName: string, role: string) => {
      const dashboardUrl = role === 'specialist' ? `${baseUrl}/specialist/dashboard` : `${baseUrl}/portal/dashboard`;
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workflow Update - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 30px; margin: 20px 0; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; background: ${statusColor}20; color: ${statusColor}; }
    h1 { color: #0f172a; font-size: 20px; margin: 0 0 10px 0; }
    .update-section { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="text-align: center; margin-bottom: 20px;">
        ${getLogoHTML(baseUrl)}
      </div>
      <h1>Workflow Status Update</h1>
      <p>Hello ${recipientName},</p>
      <p><strong>${displayName}</strong> has updated <strong>${step}</strong> to:</p>
      <div class="update-section" style="text-align:center;">
        <span class="status-badge">${statusLabel}</span>
      </div>
      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to see the latest updates.</p>
      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">View in Dashboard</a>
      </div>
      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
    };

    const subject = `[MySyntroMed] Workflow Update - ${step} is now ${statusLabel}`;
    const emailPromises: Promise<any>[] = [];

    if (recipientEmails && Array.isArray(recipientEmails) && recipientEmails.length > 0) {
      for (const email of recipientEmails) {
        if (!email) continue;
        emailPromises.push(
          sendEmailViaServer({
            from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
            to: email,
            subject,
            html: buildHtml(email, 'client'),
          })
        );
      }
    } else {
      const clientsSnap = await admin.firestore().collection('users')
        .where('assignedSpecialistId', '==', specialistId).get();

      clientsSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (!data.email) return;
        emailPromises.push(
          sendEmailViaServer({
            from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
            to: data.email,
            subject,
            html: buildHtml(data.displayName || data.email || 'Client', 'client'),
          })
        );
      });

      const adminSnap = await admin.firestore().collection('users')
        .where('role', '==', 'admin').get();

      adminSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        if (!data.email) return;
        const prefs = data.notificationPreferences;
        if (prefs && prefs.emailRequests === false) return;
        emailPromises.push(
          sendEmailViaServer({
            from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
            to: data.email,
            subject,
            html: buildHtml(data.displayName || data.email || 'Admin', 'admin'),
          })
        );
      });
    }

    await Promise.allSettled(emailPromises);
    console.log(`[WORKFLOW] Notified ${emailPromises.length} recipients of ${step} → ${statusLabel}`);
    res.json({ success: true, sent: emailPromises.length });
  } catch (error: any) {
    console.error('[WORKFLOW NOTIFY] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
