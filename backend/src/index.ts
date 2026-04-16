import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import admin from './firebaseAdmin.js';
import { requireAuth, requireRole, type AuthedRequest } from './middleware/requireAuth.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://*.firebaseio.com', 'https://*.googleapis.com'],
      frameSrc: ["'self'", 'https://meet.jit.si'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: frontendOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { error: 'Too many OTP requests. Please wait 5 minutes.' },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});

const sanitizeInput = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, 1000);
};

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

app.post('/api/auth/request-otp', otpLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await admin.firestore().collection('otp_codes').add({
      email: normalizedEmail,
      code,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      used: false,
    });

    console.log(`[OTP] Generated OTP for ${normalizedEmail}: ${code}`);

    const loginUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
    const serviceKey = process.env.EMAIL_SERVICE_KEY;

    try {
      await fetch(`${emailServerUrl}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          code,
          loginUrl,
        }),
      });
    } catch (emailError) {
      console.warn('[OTP] Email server unavailable, OTP logged to console:', code);
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('[OTP] Error generating OTP:', error);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanCode = code.trim().replace(/\s/g, '');

    const snap = await admin.firestore().collection('otp_codes')
      .where('email', '==', normalizedEmail)
      .where('used', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(400).json({ error: 'No pending verification found' });
    }

    const otpDoc = snap.docs[0];
    const otpData = otpDoc.data();

    if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
      await otpDoc.ref.delete();
      return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
    }

    const expiresAt = otpData.expiresAt.toDate();
    if (expiresAt < new Date()) {
      await otpDoc.ref.delete();
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    if (otpData.code !== cleanCode) {
      await otpDoc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
      const remaining = MAX_OTP_ATTEMPTS - otpData.attempts - 1;
      return res.status(400).json({
        error: 'Invalid verification code',
        remainingAttempts: remaining > 0 ? remaining : 0
      });
    }

    await otpDoc.ref.update({ used: true });

    const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    const customToken = await admin.auth().createCustomToken(userRecord.uid, {
      role: userRecord.customClaims?.role || 'client'
    });

    res.json({ success: true, customToken });
  } catch (error) {
    console.error('[OTP] Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.use('/api/auth', authLimiter, require('./routes/auth.js'));
app.use('/api/contact', contactLimiter, require('./routes/contact.js'));
app.use('/api/messages', authLimiter, require('./routes/messages.js'));

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
