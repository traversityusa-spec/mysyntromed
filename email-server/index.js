import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

// Load dotenv if available (for local development)
try {
  import('dotenv/config').catch(() => {});
} catch (e) {
  // dotenv not available, that's fine - Railway sets env vars directly
}

const app = express();

// CORS for backend access
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));

// Security: Global rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 100;

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    requestCounts.set(ip, { timestamp: now, count: 1 });
    return next();
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
};

app.use(rateLimiter);

// Auth Middleware - REQUIRED for all endpoints
const authenticateRequest = (req, res, next) => {
  const serviceKey = process.env.EMAIL_SERVICE_KEY;
  if (!serviceKey) {
    console.error('[AUTH] EMAIL_SERVICE_KEY not set - rejecting all requests');
    return res.status(500).json({ error: 'Server misconfigured' });
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
    console.log('[EMAIL] No EMAIL_PASS set → using Ethereal test account');
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
  } else {
    console.log('[EMAIL] Using Gmail SMTP (real emails will be sent)');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  return transporter;
}

// Input sanitization helper
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, 500).replace(/[<>]/g, '');
};

app.post('/send-welcome', authenticateRequest, async (req, res) => {
  const { email, displayName, role, loginUrl, tempCode } = req.body;

  console.log('[DEBUG] send-welcome received - tempCode:', tempCode);

  if (!email || !displayName || !role || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedName = sanitize(displayName);
  const sanitizedUrl = sanitize(loginUrl);
  const roleLabel = role === 'specialist' ? 'Specialist' : 'Healthcare Professional';
  const portalUrl = role === 'specialist' ? sanitizedUrl + '/specialist' : sanitizedUrl + '/portal';
  const companyEmail = process.env.SMTP_FROM || 'noreply@mysyntromed.com';
  const tempPassword = tempCode || 'N/A';

  console.log('[DEBUG] tempPassword to send:', tempPassword);

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
    .temp-code { font-size: 28px; font-weight: 700; font-family: monospace; color: #0d9488; letter-spacing: 4px; text-align: center; padding: 12px; background: #f0fdfa; border-radius: 8px; }
    .button { display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MySyntroMed</div>
    <p style="color: #64748b;">Virtual Medical Assistant & Healthcare Support</p>
    
    <h1>Welcome to MySyntroMed, ${sanitizedName}!</h1>
    <p>We're excited to have you join us as a <strong>${roleLabel}</strong>. Let's get you started!</p>
    
    <div class="credentials">
      <h3 style="margin: 0 0 12px 0;">Your Account Details</h3>
      <div class="credential-item">
        <span class="credential-label">Email</span>
        <span class="credential-value">${email}</span>
      </div>
      <div class="credential-item">
        <span class="credential-label">Temporary Password</span>
        <span class="credential-value">${tempPassword}</span>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Use this password to log in. You can change it after your first login.</p>
    </div>
    
    <a href="${portalUrl}" class="button">Log In to Your Dashboard</a>
    
    <div class="warning">
      <strong>Important:</strong> This password will work for your first login. Use "Forgot Password" to reset if needed.
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      <p>Questions? Contact us at <a href="mailto:${companyEmail}" style="color: #0d9488;">${companyEmail}</a></p>
    </div>
  </div>
</body>
</html>`;

try {
    const mail = await getTransporter();
    const info = await mail.sendMail({
      from: `"MySyntroMed" <${companyEmail}>`,
      to: email,
      subject: `Welcome to MySyntroMed - Let's Get You Started${role === 'specialist' ? ', Specialist!' : '!'}`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('[EMAIL] Welcome email sent to:', email);
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedReceiver = sanitize(receiverName);
  const sanitizedSender = sanitize(senderName);
  const sanitizedUrl = sanitize(loginUrl);
  const sanitizedPreview = sanitize(messagePreview).substring(0, 100);
  const companyEmail = process.env.SMTP_FROM || 'noreply@mysyntromed.com';

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
    
    <h2>Hello ${sanitizedReceiver},</h2>
    <p>You have a new unread message from <strong>${sanitizedSender}</strong> on MySyntroMed.</p>
    
    ${sanitizedPreview ? `<div class="message-box">"${sanitizedPreview}..."</div>` : ''}
    
    <a href="${sanitizedUrl}" class="button">Reply to Message</a>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      <p>You are receiving this email because you have unread messages.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const mail = await getTransporter();
    const info = await mail.sendMail({
      from: '"MySyntroMed" <noreply@mysyntromed.com>',
      to: email,
      subject: `New message from ${sanitizedSender} on MySyntroMed`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('[EMAIL] Unread message notification sent to:', email);
    res.json({ success: true, previewUrl: previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Notification Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
  console.log(`SMTP: ${process.env.EMAIL_USER ? 'Gmail configured' : 'Not configured (Ethereal mode)'}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'email-server', smtpConfigured: !!process.env.EMAIL_USER });
});

// Send OTP code endpoint
app.post('/send-otp', authenticateRequest, async (req, res) => {
  const { email, code, loginUrl } = req.body;

  if (!email || !code || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedUrl = sanitize(loginUrl);
  const companyEmail = process.env.SMTP_FROM || 'noreply@mysyntromed.com';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .logo { font-size: 24px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
    .code-box { background: #f0fdfa; border: 2px solid #14b8a6; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center; }
    .code { font-size: 36px; font-weight: 700; font-family: monospace; color: #0d9488; letter-spacing: 4px; }
    .warning { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; color: #92400e; font-size: 14px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MySyntroMed</div>
    <h1>Your Verification Code</h1>
    <p>Use the following code to verify your email address:</p>
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    <div class="warning">
      <strong>Security Notice:</strong> This code expires in 10 minutes. Do not share it with anyone.
    </div>
    <a href="${sanitizedUrl}" class="button" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">Go to Login</a>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const mail = await getTransporter();
    const info = await mail.sendMail({
      from: '"MySyntroMed" <noreply@mysyntromed.com>',
      to: email,
      subject: 'Your MySyntroMed Verification Code',
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('[EMAIL] OTP sent to:', email);
    res.json({ success: true, previewUrl: previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] OTP Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});