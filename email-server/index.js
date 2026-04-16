import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateRequest = (req, res, next) => {
  const serviceKey = process.env.EMAIL_SERVICE_KEY;
  if (!serviceKey) {
    console.warn('[AUTH] EMAIL_SERVICE_KEY not set, allowing all requests (INSECURE)');
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${serviceKey}`) {
    console.warn('[AUTH] Unauthorized request from', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Auto-select transport: Ethereal (dev preview) or Gmail (production)
let transporter;
let testAccount = null;

async function getTransporter() {
  if (transporter) return transporter;

  const isDevMode = !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'your_app_password_here';

  if (isDevMode) {
    console.log('[EMAIL] No EMAIL_PASS set → using Ethereal test account (emails are NOT sent for real)');
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[EMAIL] Ethereal account ready:', testAccount.user);
    console.log('[EMAIL] View sent emails at: https://ethereal.email/messages');
  } else {
    console.log('[EMAIL] Using Gmail SMTP (real emails will be sent)');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'mysyntromed@gmail.com',
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return transporter;
}

app.post('/send-welcome', authenticateRequest, async (req, res) => {

  const { email, displayName, password, role, loginUrl } = req.body;

  if (!email || !displayName || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const roleLabel = role === 'specialist' ? 'Specialist' : 'Healthcare Professional';
  const portalUrl = role === 'specialist' ? loginUrl + '/specialist' : loginUrl + '/portal';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
    h1 { color: #0f172a; margin-bottom: 20px; }
    .credentials { background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .credential-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1; }
    .credential-item:last-child { border-bottom: none; }
    .credential-label { color: #64748b; }
    .credential-value { font-weight: 600; font-family: monospace; background: white; padding: 2px 8px; border-radius: 4px; }
    .button { display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MySyntroMed</div>
    <p style="color: #64748b;">Virtual Medical Assistant & Healthcare Support</p>
    
    <h1>Welcome Aboard, ${displayName}!</h1>
    <p>We're thrilled to have you join the MySyntroMed family as a <strong>${roleLabel}</strong>.</p>
    
    <div class="credentials">
      <h3 style="margin: 0 0 12px 0;">Your Login Credentials</h3>
      <div class="credential-item">
        <span class="credential-label">Email</span>
        <span class="credential-value">${email}</span>
      </div>
      <div class="credential-item">
        <span class="credential-label">Temporary Password</span>
        <span class="credential-value">${password}</span>
      </div>
      <div class="credential-item">
        <span class="credential-label">Login URL</span>
        <span class="credential-value">${portalUrl}</span>
      </div>
    </div>
    
    <a href="${portalUrl}" class="button">Access Your Dashboard</a>
    
    <div class="warning">
      <strong>Important:</strong> You will be required to change your temporary password upon first login.
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      <p>This email was sent because an admin created your account.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const mail = await getTransporter();
    const info = await mail.sendMail({
      from: '"MySyntroMed" <noreply@mysyntromed.com>',
      to: email,
      subject: `Welcome to MySyntroMed - Your Account is Ready${role === 'specialist' ? ', Specialist!' : '!'}`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[EMAIL] ✅ Preview welcome email here:', previewUrl);
    } else {
      console.log('[EMAIL] ✅ Welcome email sent to:', email);
    }
    res.json({ success: true, previewUrl: previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-unread-message', authenticateRequest, async (req, res) => {
  const { email, receiverName, senderName, messagePreview, loginUrl } = req.body;

  if (!email || !receiverName || !senderName || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
    h1 { color: #0f172a; margin-bottom: 20px; }
    .message-box { background: #f1f5f9; border-left: 4px solid #0d9488; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; font-style: italic; color: #475569; }
    .button { display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MySyntroMed</div>
    <p style="color: #64748b;">Virtual Medical Assistant & Healthcare Support</p>
    
    <h2>Hello ${receiverName},</h2>
    <p>You have a new unread message from <strong>${senderName}</strong> on MySyntroMed because you seem to be offline.</p>
    
    ${messagePreview ? `<div class="message-box">"${messagePreview}..."</div>` : ''}
    
    <a href="${loginUrl}" class="button">Reply to Message</a>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      <p>You are receiving this email because you have unread messages in your MySyntroMed portal.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const mail = await getTransporter();
    const info = await mail.sendMail({
      from: '"MySyntroMed" <noreply@mysyntromed.com>',
      to: email,
      subject: `New message from ${senderName} on MySyntroMed`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[EMAIL] ✅ Preview message email here:', previewUrl);
    } else {
      console.log('[EMAIL] ✅ Unread message notification sent to:', email);
    }
    res.json({ success: true, previewUrl: previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Notification Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
});