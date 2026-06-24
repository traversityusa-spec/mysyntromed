import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { Options } from 'express-rate-limit';
import crypto from 'crypto';
import { createServer } from 'http';
import { Server } from 'socket.io';
import * as Sentry from '@sentry/node';
import admin from './firebaseAdmin.js';
import { requireAuth, requireRole, type AuthedRequest } from './middleware/requireAuth.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import messageRoutes from './routes/messages.js';
import requestRoutes from './routes/requests.js';
import notifyRoutes from './routes/notify.js';
import workflowRoutes from './routes/workflow.js';
import { sendMessageNotification, notifyAdminsViaEmail } from './services/emailClient.js';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development', tracesSampleRate: 0.2 });
}

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(allowed => origin === allowed || origin.includes('.railway.app') || origin.includes('.onrender.com') || origin.endsWith('.mysyntromed.com'))) {
        return callback(null, true);
      }
      callback(new Error('Socket CORS policy: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  if (req.secure === false && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(`https://${req.hostname}${req.originalUrl}`);
  }
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", 'https://*.firebaseio.com', 'https://*.googleapis.com'],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Support multiple origins for CORS
const PRODUCTION_ORIGINS = [
  'https://mysyntromed.com',
  'https://www.mysyntromed.com',
];

const allowedOrigins = [
  frontendOrigin,
  ...PRODUCTION_ORIGINS,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin === allowed || origin.includes('.railway.app'))) {
      return callback(null, true);
    }
    callback(new Error('CORS policy: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  next();
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use('/api/', generalLimiter);

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

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

const sanitizeInput = (str: string): string => {
  if (typeof str !== 'string') return '';
  return escapeHtml(str.replace(/javascript:/gi, '').replace(/on\w+\s*=/gi, ''))
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

    console.log(`[OTP] Generated OTP for ${normalizedEmail}`);

    const loginUrl = process.env.FRONTEND_ORIGIN || frontendOrigin;
    const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
    const serviceKey = process.env.EMAIL_SERVICE_KEY;

    try {
      const emailResponse = await fetch(`${emailServerUrl}/send-otp`, {
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

      if (emailResponse.ok) {
        console.log('[OTP] Verification code sent to email');
      } else {
        console.warn('[OTP] Email server returned error, code logged for dev');
      }
    } catch (emailError) {
      console.error('[OTP] Email server unavailable');
      return res.status(502).json({ error: 'Email service unavailable. Please try again later.' });
    }

    console.log('[OTP] Verification code sent to email');
    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('[OTP] Error generating OTP:', error);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many verification attempts. Please wait.' },
});

app.post('/api/auth/verify-otp', verifyOtpLimiter, async (req, res) => {
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

    // Atomic Firestore transaction to prevent race condition
    await admin.firestore().runTransaction(async (transaction) => {
      const freshSnap = await transaction.get(otpDoc.ref);
      const freshData = freshSnap.data();
      if (!freshData) throw new Error('OTP doc deleted during transaction');

      if (freshData.used) {
        throw new Error('Code already used');
      }

      if (freshData.attempts >= MAX_OTP_ATTEMPTS) {
        transaction.delete(otpDoc.ref);
        throw new Error('Too many attempts');
      }

      if (freshData.code !== cleanCode) {
        transaction.update(otpDoc.ref, { attempts: admin.firestore.FieldValue.increment(1) });
        throw new Error('Invalid code');
      }

      transaction.update(otpDoc.ref, { used: true });
    });

    const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
    let otpRole = userRecord.customClaims?.role;
    if (!otpRole) {
      const profileSnap = await admin.firestore().collection('users').doc(userRecord.uid).get();
      const profileRole = profileSnap.data()?.role;
      if (profileRole === 'admin' || profileRole === 'specialist' || profileRole === 'client') {
        otpRole = profileRole;
        try {
          await admin.auth().setCustomUserClaims(userRecord.uid, { role: otpRole });
        } catch (claimErr) {
          console.error('[OTP] Failed to set custom claims:', claimErr);
        }
      } else {
        otpRole = 'client';
      }
    }
    const customToken = await admin.auth().createCustomToken(userRecord.uid, {
      role: otpRole
    });

    res.json({ success: true, customToken });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Verification failed';
    if (msg === 'Invalid code' || msg === 'Code already used' || msg === 'Too many attempts') {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    console.error('[OTP] Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);
app.use('/api/messages', authLimiter, messageRoutes);
app.use('/api/requests', authLimiter, requestRoutes);
app.use('/api/notify', authLimiter, notifyRoutes);
app.use('/api/workflow', authLimiter, workflowRoutes);

// Subscription management endpoint
app.post('/api/subscription/send-reminder', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user?.uid;
  
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userDoc.exists || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userData.role !== 'specialist' && userData.role !== 'admin') {
      return res.status(403).json({ error: 'Only specialists and admins can send reminders' });
    }

    const clientId = req.body.clientId;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }

    const clientDoc = await admin.firestore().collection('users').doc(clientId).get();
    const clientData = clientDoc.data();

    if (!clientDoc.exists || clientData?.role !== 'client') {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!clientData?.subscriptionEndDate || !clientData?.subscriptionActive) {
      return res.status(400).json({ error: 'Client does not have an active subscription' });
    }

    const expiryDate = clientData.subscriptionEndDate.toDate();
    const now = new Date();
    const daysLeft = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft > 7) {
      return res.status(400).json({ error: 'Subscription reminder can only be sent within 7 days of expiry' });
    }

    const loginUrl = process.env.FRONTEND_ORIGIN || frontendOrigin;
    
    const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
    const serviceKey = process.env.EMAIL_SERVICE_KEY;

    const emailResponse = await fetch(`${emailServerUrl}/send-subscription-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: clientData.email,
        displayName: clientData.displayName || 'Valued Client',
        daysLeft,
        expiryDate: expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        loginUrl,
      }),
    });

    if (emailResponse.ok) {
      await admin.firestore().collection('users').doc(clientId).update({
        subscriptionReminderSent: true,
      });
      return res.json({ success: true, message: 'Subscription reminder sent successfully' });
    } else {
      throw new Error('Email server returned error');
    }
  } catch (error) {
    console.error('[SUBSCRIPTION] Error sending reminder:', error);
    return res.status(500).json({ error: 'Failed to send subscription reminder' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message, err.stack);
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
});

const userSockets = new Map<string, string>();
const socketUserMap = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('[SOCKET] Client connected:', socket.id);

  socket.on('authenticate', (userId: string) => {
    userSockets.set(userId, socket.id);
    socketUserMap.set(socket.id, userId);
    socket.join(`user:${userId}`);
    console.log('[SOCKET] User authenticated:', userId);
  });

  socket.on('sendMessage', async (data: { to: string; message: unknown }) => {
    console.log('[SOCKET] Send message to:', data.to);

    // Sanitize message content server-side to prevent XSS
    let sanitized: any;
    if (data.message && typeof data.message === 'object') {
      sanitized = { ...data.message as any };
      if (typeof sanitized.text === 'string') {
        sanitized.text = sanitizeInput(sanitized.text);
      }
      if (typeof sanitized.senderName === 'string') {
        sanitized.senderName = sanitizeInput(sanitized.senderName);
      }
    } else {
      sanitized = sanitizeInput(String(data.message || ''));
    }

    io.to(`user:${data.to}`).emit('newMessage', sanitized);

    // Send email notification to recipient and admins
    try {
      const senderId = socketUserMap.get(socket.id);
      if (!senderId) {
        console.warn('[SOCKET] sendMessage: No authenticated user for this socket');
        return;
      }
      
      // Get sender info
      const firestore = admin.firestore();
      const [senderDoc, receiverDoc] = await Promise.all([
        firestore.collection('users').doc(senderId).get(),
        firestore.collection('users').doc(data.to).get()
      ]);
      
      const senderData = senderDoc.data();
      const receiverData = receiverDoc.data();
      
      if (!senderData || !receiverData) {
        console.warn('[SOCKET] sendMessage: Could not find sender or receiver data');
        return;
      }
      
      const messageObj = (data.message as any) || {};
      const messagePreview = messageObj.text || '';
      const loginUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
      
      // Send the message notification
      await sendMessageNotification(
        admin,
        senderId,
        senderData.displayName || 'User',
        senderData.role || 'client',
        data.to,
        receiverData.displayName || 'User',
        receiverData.email,
        receiverData.role || 'client',
        messagePreview,
        loginUrl
      );
    } catch (error: any) {
      console.error('[SOCKET] sendMessage email notification error:', error.message);
    }
  });

  socket.on('typing', (data: { to: string; isTyping: boolean; senderName?: string; senderId?: string }) => {
    io.to(`user:${data.to}`).emit('userTyping', {
      isTyping: data.isTyping,
      senderName: sanitizeInput(data.senderName || 'User'),
      senderId: data.senderId || ''
    });
  });

  socket.on('statusUpdate', (data: {
    requestId: string;
    status: string;
    userId: string;
    specialistId?: string;
    changedByName?: string;
    type?: string;
  }) => {
    io.to(`user:${data.userId}`).emit('statusUpdated', data);
    if (data.specialistId && data.specialistId !== data.userId) {
      io.to(`user:${data.specialistId}`).emit('statusUpdated', data);
    }
  });

  socket.on('workflowUpdate', (data: {
    specialistId: string;
    clientId: string;
    field: string;
    value: string;
    specialistName?: string;
  }) => {
    io.to(`user:${data.clientId}`).emit('workflowUpdated', data);
  });

  socket.on('disconnect', () => {
    for (const [userId, sockId] of userSockets.entries()) {
      if (sockId === socket.id) {
        userSockets.delete(userId);
        socketUserMap.delete(socket.id);
        break;
      }
    }
    console.log('[SOCKET] Client disconnected:', socket.id);
  });
});

httpServer.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
