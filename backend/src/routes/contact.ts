import { Router } from 'express';
import { sendContactFormEmail } from '../services/contactEmailService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { fullName, practiceName, email, phone, serviceInterest, message } = req.body;

  if (!fullName || !email || !practiceName) {
    return res.status(400).json({ error: 'Missing required fields: fullName, email, and practiceName are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const result = await sendContactFormEmail({
      fullName: fullName.trim(),
      practiceName: practiceName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || '',
      serviceInterest: serviceInterest?.trim() || '',
      message: message?.trim() || '',
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send email.' });
    }

    res.json({ success: true, message: 'Your message has been sent. We will contact you shortly.' });
  } catch (error: any) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to process your request. Please try again later.' });
  }
});

export default router;
