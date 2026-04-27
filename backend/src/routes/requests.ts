import { Router } from 'express';
import { sendNewRequestEmailToAdmin } from '../services/requestEmailService.js';

const router = Router();

router.post('/notify-admin', async (req, res) => {
  const { clientName, clientEmail, requestType, description, priority, loginUrl } = req.body;

  if (!clientName && !clientEmail) {
    return res.status(400).json({ error: 'Missing clientName or clientEmail' });
  }

  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mysyntromed.com';
    
    const result = await sendNewRequestEmailToAdmin({
      adminEmail,
      clientName: clientName || '',
      clientEmail: clientEmail || '',
      requestType: requestType || 'Support',
      description: description || '',
      priority: priority || 'normal',
      loginUrl: loginUrl || 'https://mysyntromed.com',
    });

    if (!result.success) {
      console.warn(`[REQUEST EMAIL] Failed to send: ${result.error}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[REQUEST EMAIL ERROR]:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

export default router;