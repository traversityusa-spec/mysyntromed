import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

async function sendEmail({ from, to, subject, html }) {
  if (process.env.RESEND_API_KEY) {
    console.log('[EMAIL] Using Resend API (HTTP)');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error (${res.status}): ${err}`);
    }
    return { previewUrl: null };
  }

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('[EMAIL] Using Gmail SMTP');
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
    const info = await transport.sendMail({ from, to, subject, html });
    return { previewUrl: nodemailer.getTestMessageUrl(info) };
  }

  throw new Error('No email provider configured. Set RESEND_API_KEY in .env or configure SMTP credentials.');
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

// Serve logo for email clients
app.use('/logo.png', (req, res) => {
  res.sendFile(path.resolve('logo.png'), {
    headers: { 'Cache-Control': 'public, max-age=31536000' },
  });
});

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

// Input sanitization helper
const sanitize = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, 500).replace(/[<>]/g, '');
};

const normalizeBaseUrl = (url) => sanitize(url).replace(/\/+$/, '');

const PUBLIC_LOGO_URL = 'https://mysyntromed.com/MySyntroMed-Logo-L2-Aqua.png';
const logoUrl = () => process.env.LOGO_URL || PUBLIC_LOGO_URL;

const dashboardPathForRole = (role, section = 'dashboard') => {
  if (role === 'admin') return `/admin/${section}`;
  if (role === 'specialist') return `/specialist/${section}`;
  return `/portal/${section}`;
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
  const sanitizedUrl = normalizeBaseUrl(loginUrl);
  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let companyEmail = 'noreply@mysyntromed.com';
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';

  if (rawFrom) {
    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      fromAddress = rawFrom;
      const match = rawFrom.match(/<([^>]+)>/);
      if (match) companyEmail = match[1];
    } else {
      fromAddress = `MySyntroMed <${rawFrom}>`;
      companyEmail = rawFrom;
    }
  }

  const roleLabel = role === 'specialist' ? 'Specialist' : 'Healthcare Professional';
  const portalUrl = role === 'specialist' ? sanitizedUrl + '/specialist' : sanitizedUrl + '/portal';
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
    .button { display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
    </div>
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
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: `Welcome to MySyntroMed - Let's Get You Started${role === 'specialist' ? ', Specialist!' : '!'}`,
      html: htmlContent,
    });

    console.log('[EMAIL] Welcome email sent to:', email);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Error:', error.message, error.code, error.command);
    res.status(500).json({ error: error.message });
  }
});

app.post('/send-unread-message', authenticateRequest, async (req, res) => {
  const { email, receiverName, senderName, messagePreview, loginUrl, receiverRole } = req.body;

  if (!email || !receiverName || !senderName || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedReceiver = sanitize(receiverName);
  const sanitizedSender = sanitize(senderName);
  const sanitizedUrl = normalizeBaseUrl(loginUrl) + dashboardPathForRole(receiverRole, 'messages');
  const sanitizedPreview = sanitize(messagePreview).substring(0, 100);
  
  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';

  if (rawFrom) {
    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      fromAddress = rawFrom;
    } else {
      fromAddress = `MySyntroMed <${rawFrom}>`;
    }
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
    .button { display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
    </div>
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
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: `New message from ${sanitizedSender} on MySyntroMed`,
      html: htmlContent,
    });

    console.log('[EMAIL] Unread message notification sent to:', email);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Notification Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Generic send-email endpoint for backend services
app.post('/send-email', authenticateRequest, async (req, res) => {
  const { from, to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const recipients = Array.isArray(to) ? to : [to];
  for (const addr of recipients) {
    if (!emailRegex.test(addr)) {
      return res.status(400).json({ error: `Invalid email address: ${addr}` });
    }
  }

  const rawFrom = from || process.env.SMTP_FROM || 'MySyntroMed <noreply@mysyntromed.com>';

  try {
    const result = await sendEmail({
      from: rawFrom,
      to: recipients.join(', '),
      subject,
      html,
    });

    console.log(`[EMAIL] Sent via generic endpoint to: ${recipients.join(', ')}`);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Generic send error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Root route for platform health checks
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'email-server' });
});

const PORT = process.env.PORT || 3002;

// Health check endpoint
app.get('/health', (req, res) => {
  const provider = process.env.RESEND_API_KEY ? 'resend' : process.env.EMAIL_USER ? 'gmail-smtp' : null;
  res.json({ ok: true, service: 'email-server', provider, configured: !!provider });
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

  const sanitizedUrl = normalizeBaseUrl(loginUrl);
  
  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';

  if (rawFrom) {
    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      fromAddress = rawFrom;
    } else {
      fromAddress = `MySyntroMed <${rawFrom}>`;
    }
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
    .code-box { background: #f0fdfa; border: 2px solid #14b8a6; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center; }
    .code { font-size: 36px; font-weight: 700; font-family: monospace; color: #0d9488; letter-spacing: 4px; }
    .warning { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0; color: #92400e; font-size: 14px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
    </div>
    <h1>Your Verification Code</h1>
    <p>Use the following code to verify your email address:</p>
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    <div class="warning">
      <strong>Security Notice:</strong> This code expires in 10 minutes. Do not share it with anyone.
    </div>
    <a href="${sanitizedUrl}" class="button" style="display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">Go to Login</a>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: 'Your MySyntroMed Verification Code',
      html: htmlContent,
    });

    console.log('[EMAIL] OTP sent to:', email);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] OTP Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Send subscription reminder endpoint
app.post('/send-subscription-reminder', authenticateRequest, async (req, res) => {
  const { email, displayName, daysLeft, expiryDate, loginUrl } = req.body;

  if (!email || !displayName || daysLeft === undefined || !expiryDate || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedName = sanitize(displayName);
  const sanitizedUrl = normalizeBaseUrl(loginUrl);
  const isUrgent = daysLeft <= 3;

  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';

  if (rawFrom) {
    if (rawFrom.includes('<') && rawFrom.includes('>')) {
      fromAddress = rawFrom;
    } else {
      fromAddress = `MySyntroMed <${rawFrom}>`;
    }
  }


  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Reminder - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin: 20px 0; }
    .logo-container { text-align: center; margin-bottom: 20px; }
    .logo { font-size: 28px; font-weight: 700; color: #0d9488; }
    .tagline { color: #64748b; font-size: 14px; margin-top: 4px; }
    .header { text-align: center; margin-bottom: 30px; }
    h1 { color: #0f172a; font-size: 24px; margin-bottom: 20px; text-align: center; }
    .warning-box { background: ${isUrgent ? '#fef2f2' : '#fffbeb'}; border: 2px solid ${isUrgent ? '#ef4444' : '#f59e0b'}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center; }
    .days-left { font-size: 48px; font-weight: 700; color: ${isUrgent ? '#dc2626' : '#d97706'}; margin: 16px 0; line-height: 1; }
    .days-label { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; }
    .expiry-info { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .expiry-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .expiry-value { font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px; }
    .button { display: inline-block; background: ${isUrgent ? '#dc2626' : '#0d9488'}; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px auto; display: block; width: fit-content; }
    .button:hover { background: ${isUrgent ? '#b91c1c' : '#0f766e'}; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
    .highlight { color: #0d9488; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
      </div>
      <div class="tagline">Virtual Medical Assistant & Healthcare Support</div>

      <h1>${isUrgent ? '⚠️ Urgent: Subscription Expiring Soon!' : '📅 Subscription Reminder'}</h1>
      
      <p style="text-align: center;">Dear <span class="highlight">${sanitizedName}</span>,</p>
      
      <p style="text-align: center;">Your MySyntroMed subscription is ${isUrgent ? '<strong>about to expire</strong>' : 'coming to an end'}. Please take action to ensure uninterrupted access to your account.</p>

      <div class="warning-box">
        <div class="days-left">${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'}</div>
        <div class="days-label">Time Remaining</div>
      </div>

      <div class="expiry-info">
        <div class="expiry-label">Subscription Expires On</div>
        <div class="expiry-value">${sanitize(expiryDate)}</div>
      </div>

      <p style="text-align: center;">After your subscription expires, your account access will be <strong>suspended</strong>. Please contact your administrator to renew your subscription.</p>

      <a href="${sanitizedUrl}" class="button">Contact Administrator</a>

      <p style="text-align: center; font-size: 14px; color: #64748b; margin-top: 24px;">If you have any questions or need immediate assistance, please contact our support team.</p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
        <p style="margin-top: 12px;">
          <a href="${sanitizedUrl}" style="color: #0d9488;">Visit Website</a> ·
          <a href="mailto:support@mysyntromed.com" style="color: #0d9488;">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: isUrgent 
        ? `⚠️ Urgent: MySyntroMed Subscription Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}!` 
        : `MySyntroMed Subscription Reminder - ${daysLeft} Days Left`,
      html: htmlContent,
    });

    console.log('[EMAIL] Subscription reminder sent to:', email, '- Days left:', daysLeft);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    console.error('[EMAIL] Subscription Reminder Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Send New Request Confirmation
app.post('/send-new-request', authenticateRequest, async (req, res) => {
  const { email, displayName, requestType, loginUrl } = req.body;

  if (!email || !displayName || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedName = sanitize(displayName);
  const sanitizedUrl = normalizeBaseUrl(loginUrl);
  const typeLabel = requestType || 'consultation';

  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';
  if (rawFrom) {
    fromAddress = rawFrom.includes('<') ? rawFrom : `MySyntroMed <${rawFrom}>`;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #0f172a; margin-bottom: 20px; }
    .button { display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
    </div>
    <h1>Request Received!</h1>
    <p>Hello ${sanitizedName},</p>
    <p>We have successfully received your ${sanitize(typeLabel)} request. Our team is reviewing it and will update you shortly.</p>
    <a href="${sanitizedUrl}/portal" class="button">View Dashboard</a>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: 'We have received your request - MySyntroMed',
      html: htmlContent,
    });
    console.log('[EMAIL] New request email sent to:', email);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Request Status Update
app.post('/send-status-update', authenticateRequest, async (req, res) => {
  const { email, displayName, requestType, newStatus, loginUrl } = req.body;

  if (!email || !displayName || !newStatus || !loginUrl) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const sanitizedName = sanitize(displayName);
  const sanitizedStatus = sanitize(newStatus).toUpperCase();
  const sanitizedUrl = normalizeBaseUrl(loginUrl);
  const typeLabel = requestType || 'request';

  const rawFrom = (process.env.SMTP_FROM || '').trim();
  let fromAddress = 'MySyntroMed <noreply@mysyntromed.com>';
  if (rawFrom) {
    fromAddress = rawFrom.includes('<') ? rawFrom : `MySyntroMed <${rawFrom}>`;
  }

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    h1 { color: #0f172a; margin-bottom: 20px; }
    .status-box { background: #f0fdfa; border: 2px solid #14b8a6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; font-size: 20px; font-weight: bold; color: #0d9488; }
    .button { display: inline-block; background: #0d9488; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="${logoUrl(loginUrl)}" alt="MySyntroMed" style="height: 80px; width: auto;" />
    </div>
    <h1>Request Status Updated</h1>
    <p>Hello ${sanitizedName},</p>
    <p>There is an update regarding your ${sanitize(typeLabel)}. The status has been changed to:</p>
    <div class="status-box">${sanitizedStatus}</div>
    <a href="${sanitizedUrl}/portal" class="button">View Dashboard</a>
    <div class="footer">
      <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await sendEmail({
      from: fromAddress,
      to: email,
      subject: 'Request Status Update - MySyntroMed',
      html: htmlContent,
    });
    console.log('[EMAIL] Status update email sent to:', email);
    res.json({ success: true, previewUrl: result.previewUrl || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  const provider = process.env.RESEND_API_KEY ? 'Resend API' : process.env.EMAIL_USER ? 'Gmail SMTP' : 'Not configured';
  console.log(`Email server running on port ${PORT}`);
  console.log(`Provider: ${provider}`);
});
