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

// Helper function to send welcome email via email-server service
const sendWelcomeEmail = (email: string, displayName: string, role: 'client' | 'specialist', loginUrl: string, tempCode: string): Promise<{success: boolean; error?: string}> => {
  console.log('[EMAIL] Sending welcome email to:', email);

  return new Promise((resolve) => {
    try {
      const emailServerUrl = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
      const serviceKey = process.env.EMAIL_SERVICE_KEY;

      if (!serviceKey) {
        console.error('[EMAIL] EMAIL_SERVICE_KEY not set - cannot send welcome email');
        resolve({ success: false, error: 'EMAIL_SERVICE_KEY not configured' });
        return;
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      fetch(`${emailServerUrl}/send-welcome`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          email,
          displayName,
          role,
          loginUrl,
          tempCode,
        }),
        signal: controller.signal,
      })
        .then(response => {
          clearTimeout(timeout);
          return response.json();
        })
        .then(data => {
          if (data.success) {
            console.log('[EMAIL] Welcome email sent successfully to:', email);
            resolve({ success: true });
          } else {
            console.error('[EMAIL] Email server returned error:', data.error);
            resolve({ success: false, error: data.error });
          }
        })
        .catch(error => {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            console.error('[EMAIL] Timeout contacting email server for:', email);
            resolve({ success: false, error: 'Email server timeout' });
          } else {
            console.error('[EMAIL] Failed to contact email server:', error.message);
            resolve({ success: false, error: error.message });
          }
        });

    } catch (error: any) {
      console.error('[EMAIL] Exception for', email, ':', error.message);
      resolve({ success: false, error: error.message });
    }
  });
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

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
        ? `Welcome to MySyntroMed, ${displayName}! We're excited to support your practice. Your temporary password is: ${password}. Check your email for the password and get started!`
        : `Welcome to the MySyntroMed Specialist Team, ${displayName}! Your temporary password is: ${password}. Check your email for the password to get started!`,
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

    // 3. Send Welcome Email (non-blocking - don't await)
    const loginUrl = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    sendWelcomeEmail(email, displayName, role as 'client' | 'specialist', loginUrl, password)
      .then(result => {
        if (!result.success) {
          console.error('[EMAIL] Failed to send welcome email:', result.error);
        }
      })
      .catch(err => {
        console.error('[EMAIL] Exception sending welcome email:', err);
      });

    res.json({ 
      success: true, 
      uid: userRecord.uid,
      tempCode: password,
      emailSent: 'pending'
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

router.post('/admin/assign-specialist', requireAuth, requireRole('admin'), async (req, res) => {
  const { userId, specialistId } = req.body;

  if (!userId || !specialistId) {
    return res.status(400).json({ error: 'Missing required fields: userId, specialistId' });
  }

  try {
    const firestore = admin.firestore();
    const [clientSnap, specialistSnap] = await Promise.all([
      firestore.collection('users').doc(userId).get(),
      firestore.collection('users').doc(specialistId).get(),
    ]);

    if (!clientSnap.exists) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!specialistSnap.exists) {
      return res.status(404).json({ error: 'Specialist not found' });
    }

    const client = clientSnap.data() || {};
    const specialist = specialistSnap.data() || {};

    if (client.role !== 'client') {
      return res.status(400).json({ error: 'Selected user is not a client' });
    }

    if (specialist.role !== 'specialist') {
      return res.status(400).json({ error: 'Selected user is not a specialist' });
    }

    const specialistName = specialist.displayName || specialist.email || 'Specialist';
    const clientName = client.displayName || client.email || 'Client';
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = firestore.batch();

    batch.update(clientSnap.ref, {
      assignedSpecialistId: specialistId,
      assignedSpecialistName: specialistName,
      updatedAt: now,
    });

    const assignmentRequestsSnap = await firestore.collection('requests')
      .where('userId', '==', userId)
      .get();

    assignmentRequestsSnap.docs.forEach((requestDoc) => {
      const request = requestDoc.data();
      if (request.type !== 'Specialist Assignment' || request.status !== 'pending') return;

      batch.update(requestDoc.ref, {
        specialistId,
        specialistName,
        status: 'completed',
        assignedAt: now,
        completedAt: now,
      });
    });

    batch.create(firestore.collection('notifications').doc(), {
      userId,
      title: 'Specialist Assigned to You',
      message: `${specialistName} has been assigned as your specialist. You can now message them for assistance.`,
      type: 'assignment',
      read: false,
      createdAt: now,
    });

    batch.create(firestore.collection('notifications').doc(), {
      userId: specialistId,
      title: 'New Client Assignment',
      message: `You have been assigned to ${clientName}. Check your messages to introduce yourself.`,
      type: 'assignment',
      read: false,
      createdAt: now,
    });

    batch.create(firestore.collection('activity').doc(), {
      userId,
      title: `Specialist Assigned: ${specialistName}`,
      type: 'Assignment',
      specialistId,
      specialistName,
      status: 'completed',
      createdAt: now,
    });

    await batch.commit();

    res.json({
      success: true,
      assignedSpecialistId: specialistId,
      assignedSpecialistName: specialistName,
    });
  } catch (error: any) {
    console.error('Assign specialist error:', error);
    res.status(500).json({ error: error.message || 'Failed to assign specialist' });
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

    const users = listUsersResult.users.map((u: any) => {
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
