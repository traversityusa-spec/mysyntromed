import { Router } from 'express';
import admin, { adminAuth } from '../firebaseAdmin.js';
import { requireAuth, requireRole, type AuthedRequest } from '../middleware/requireAuth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'auth' });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

// Helper function to send welcome email via custom email server
const sendWelcomeEmail = async (email: string, displayName: string, password: string, role: 'client' | 'specialist', loginUrl: string): Promise<{success: boolean; error?: string}> => {
  try {
    const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
    const serviceKey = process.env.EMAIL_SERVICE_KEY;
    
    const response = await fetch(`${emailServerUrl}/send-welcome`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ email, displayName, password, role, loginUrl }),
    });

    
    const text = await response.text();
    if (!text) {
      console.log('[EMAIL] Email server returned empty response, skipping...');
      return { success: true };
    }
    
    const result = JSON.parse(text);
    
    if (!result.success) {
      console.error('[EMAIL] Email server error:', result.error);
      return { success: false, error: result.error };
    }
    
    console.log('[EMAIL] Welcome email sent to', email);
    return { success: true };
  } catch (error: any) {
    console.warn('[EMAIL] Could not reach email server:', error.message, '- User creation will continue');
    return { success: false, error: error.message };
  }
};

// Admin management endpoints
router.post('/admin/create-user', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, password, displayName, role } = req.body;
  
  if (!email || !password || !displayName || !role) {
    return res.status(400).json({ error: 'Missing required fields: email, password, displayName, role' });
  }

  // Robust Input Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Block fake/temporary emails
  const disposableDomains = [
    'yopmail.com', 'mailinator.com', 'guerrillamail.com', 'temp-mail.org',
    '10minutemail.com', 'tempmail.com', 'trashmail.com', 'sharklasers.com',
    'getairmail.com', 'throwawaymail.com', 'maildrop.cc'
  ];
  const emailDomain = email.split('@')[1]?.toLowerCase();
  
  if (disposableDomains.includes(emailDomain)) {
    return res.status(400).json({ error: 'Temporary, fake, or disposable email addresses are not allowed.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const validRoles = ['client', 'specialist', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role' });
  }

  if (displayName.length < 2 || displayName.length > 100) {
    return res.status(400).json({ error: 'Display name must be between 2 and 100 characters' });
  }

  try {

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });

    // Set custom claims for role-based access control
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // Initialize user profile in Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role,
      isNewUser: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 1. Create a Welcome Message
    const authedReq = req as AuthedRequest;
    const adminId = authedReq.user?.uid || 'system-admin';
    const adminName = authedReq.user?.displayName || 'MySyntroMed Admin';
    
    await admin.firestore().collection('messages').add({
      senderId: adminId,
      senderName: adminName,
      senderRole: 'admin',
      receiverId: userRecord.uid,
      text: role === 'client' 
        ? `Welcome to MySyntroMed, ${displayName}! We are excited to support your practice. Your account is ready, and you can now start requesting specialist assistance.`
        : `Welcome to the MySyntroMed Specialist Team, ${displayName}! You will receive client assignments here. Please complete your profile to get started.`,
      participants: [adminId, userRecord.uid],
      read: false,
      status: 'sent',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Create an App Notification
    await admin.firestore().collection('notifications').add({
      userId: userRecord.uid,
      title: 'Welcome to MySyntroMed',
      message: 'Your account has been successfully created. Explore your dashboard to get started.',
      type: 'system',
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Send Welcome Email
    const loginUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    const emailResult = await sendWelcomeEmail(email, displayName, password, role as 'client' | 'specialist', loginUrl);
    
    if (!emailResult.success) {
      console.error('[EMAIL] Failed to send welcome email:', emailResult.error);
    }

    res.json({ 
      success: true, 
      uid: userRecord.uid,
      emailSent: emailResult.success
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/deactivate-user', requireAuth, requireRole('admin'), async (req, res) => {
  const { uid, disabled } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  try {
    await adminAuth.updateUser(uid, { disabled: !!disabled });
    
    // Also update Firestore to reflect status if needed
    await admin.firestore().collection('users').doc(uid).update({
      disabled: !!disabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/delete-user', requireAuth, requireRole('admin'), async (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  try {
    // Check if trying to delete another admin
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const userData = userDoc.data();
    
    if (userData?.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin accounts' });
    }

    // Delete Firestore user data (messages, notifications, etc.)
    const batch = admin.firestore().batch();
    
    // Delete user profile
    batch.delete(admin.firestore().collection('users').doc(uid));
    
    // Delete user messages
    const messagesSnap = await admin.firestore().collection('messages')
      .where('participants', 'array-contains', uid).get();
    messagesSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete user notifications
    const notifsSnap = await admin.firestore().collection('notifications')
      .where('userId', '==', uid).get();
    notifsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete user requests
    const requestsSnap = await admin.firestore().collection('requests')
      .where('userId', '==', uid).get();
    requestsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete user calls
    const callsSnap = await admin.firestore().collection('calls')
      .where('userId', '==', uid).get();
    callsSnap.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    
    // Delete from Firebase Auth
    await adminAuth.deleteUser(uid);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/users', requireAuth, requireRole('admin'), async (_req, res) => {
  try {
    const listUsersResult = await adminAuth.listUsers(1000);
    const firestoreUsers = await admin.firestore().collection('users').get();
    const profiles = new Map();
    firestoreUsers.docs.forEach(doc => {
      profiles.set(doc.id, doc.data());
    });

    const users = listUsersResult.users.map(u => {
      const profile = profiles.get(u.uid) || {};
      return {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || profile.displayName,
        disabled: u.disabled,
        role: u.customClaims?.role || profile.role,
        createdAt: profile.createdAt?.toDate?.() || u.metadata.creationTime,
        assignedSpecialistId: profile.assignedSpecialistId,
        assignedSpecialistName: profile.assignedSpecialistName,
        isNewUser: profile.isNewUser
      };
    });
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me/client', requireAuth, requireRole('client'), (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

router.get('/me/admin', requireAuth, requireRole('admin'), (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

router.get('/me/specialist', requireAuth, requireRole('specialist'), (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

export default router;

