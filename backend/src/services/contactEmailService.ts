import { sendEmailViaServer } from './emailClient.js';
import { getLogoHTML } from './emailLogo.js';

interface ContactFormData {
  fullName: string;
  practiceName: string;
  email: string;
  phone: string;
  serviceInterest: string;
  message: string;
}

const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

export const sendContactFormEmail = async (data: ContactFormData): Promise<{ success: boolean; error?: string }> => {
  const { fullName, practiceName, email, phone, serviceInterest, message } = data;
  const companyEmail = process.env.COMPANY_EMAIL || 'info@mysyntromed.com';
  const companyName = 'MySyntroMed';

  // Sanitize all user data before inserting into HTML
  const safeFullName = escapeHtml(fullName);
  const safePracticeName = escapeHtml(practiceName);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeServiceInterest = escapeHtml(serviceInterest || '');
  const safeMessage = escapeHtml(message || '');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Contact Form Submission</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 32px; margin: 20px 0; }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; margin: -32px -32px 24px -32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
    .field { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; }
    .field:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #0f172a; font-weight: 500; }
    .message-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 8px; }
    .message-box p { margin: 0; white-space: pre-wrap; }
    .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
    .badge { display: inline-block; background: #f0fdfa; color: #0d9488; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .urgent { background: #fef3c7; color: #92400e; }
    .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin-top: 16px; }
    @media (max-width: 480px) {
      .card { padding: 20px; }
      .header { margin: -20px -20px 20px -20px; padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>📬 New Contact Form Submission</h1>
        <p>Someone is interested in MySyntroMed services</p>
      </div>

      <div style="text-align: center; margin-bottom: 20px;">
        ${getLogoHTML()}
      </div>

      <div class="field">
        <div class="badge">Contact Inquiry</div>
      </div>

      <div class="field">
        <div class="field-label">Full Name</div>
        <div class="field-value">${safeFullName}</div>
      </div>

      <div class="field">
        <div class="field-label">Practice / Organization</div>
        <div class="field-value">${safePracticeName}</div>
      </div>

      <div class="field">
        <div class="field-label">Email Address</div>
        <div class="field-value">
          <a href="mailto:${safeEmail}" style="color: #0d9488;">${safeEmail}</a>
        </div>
      </div>

      <div class="field">
        <div class="field-label">Phone Number</div>
        <div class="field-value">
          <a href="tel:${safePhone}" style="color: #0d9488;">${safePhone}</a>
        </div>
      </div>

      <div class="field">
        <div class="field-label">Service Interested In</div>
        <div class="field-value">${safeServiceInterest || 'Not specified'}</div>
      </div>

      ${safeMessage ? `
      <div class="field">
        <div class="field-label">Message</div>
        <div class="message-box">
          <p>${safeMessage}</p>
        </div>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="mailto:${safeEmail}?subject=Re: MySyntroMed Inquiry - ${encodeURIComponent(practiceName)}" class="cta-button">
          Reply to ${safeFullName}
        </a>
      </div>

      <div class="footer">
        <p>This email was sent from the MySyntroMed website contact form.</p>
        <p>Submitted: ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
NEW CONTACT FORM SUBMISSION
=========================

Someone is interested in MySyntroMed services!

CONTACT DETAILS
---------------
Name:         ${safeFullName}
Practice:     ${safePracticeName}
Email:        ${safeEmail}
Phone:        ${safePhone}
Service:      ${safeServiceInterest || 'Not specified'}
${safeMessage ? `
MESSAGE
-------
${safeMessage}
` : ''}
---
Submitted: ${new Date().toLocaleString()}
Reply directly to this email or contact them at: ${safeEmail}
`;

  const mailOptions = {
    from: process.env.SMTP_FROM || `"MySyntroMed Website" <noreply@mysyntromed.com>`,
    to: companyEmail,
    replyTo: email,
    subject: `New Inquiry from ${safeFullName} - ${safePracticeName}`,
    text: textContent,
    html: htmlContent,
  };

  const autoReplyOptions = {
    from: process.env.SMTP_FROM || `"MySyntroMed" <noreply@mysyntromed.com>`,
    to: email,
    subject: `Thank you for contacting MySyntroMed, ${safeFullName}!`,
    text: `
Dear ${safeFullName},

Thank you for reaching out to MySyntroMed!

We have received your inquiry and our team will review your message. We typically respond within 24 hours during business days.

Here's a summary of your inquiry:
- Service(s) of Interest: ${safeServiceInterest || 'Not specified'}
- Practice: ${safePracticeName}

What to expect next:
1. Our team will review your inquiry and prepare a personalized response
2. You will receive a follow-up email with more information
3. If you'd like a consultation, we'll schedule a time that works for you

In the meantime, feel free to learn more about our services at https://mysyntromed.com

Best regards,
The MySyntroMed Team

---
This is an automated message. Please do not reply directly to this email.
    `,
  };

  try {
    const results = await Promise.allSettled([
      sendEmailViaServer({
        from: process.env.SMTP_FROM || `"MySyntroMed Website" <noreply@mysyntromed.com>`,
        to: companyEmail,
        subject: `New Inquiry from ${safeFullName} - ${safePracticeName}`,
        html: htmlContent,
      }),
      sendEmailViaServer({
        from: process.env.SMTP_FROM || `"MySyntroMed" <noreply@mysyntromed.com>`,
        to: email,
        subject: `Thank you for contacting MySyntroMed, ${safeFullName}!`,
        html: `<div style="font-family: 'Segoe UI', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            ${getLogoHTML()}
          </div>
          <p style="margin-bottom: 16px;">Dear ${safeFullName},</p>
          <p style="margin-bottom: 16px;">Thank you for reaching out to MySyntroMed!</p>
          <p style="margin-bottom: 16px;">We have received your inquiry and our team will review your message. We typically respond within 24 hours during business days.</p>
          <p style="margin-bottom: 16px;"><strong>Here's a summary of your inquiry:</strong></p>
          <ul style="margin-bottom: 16px;">
            <li>Service(s) of Interest: ${safeServiceInterest || 'Not specified'}</li>
            <li>Practice: ${safePracticeName}</li>
          </ul>
          <p style="margin-bottom: 16px;"><strong>What to expect next:</strong></p>
          <ol style="margin-bottom: 16px;">
            <li>Our team will review your inquiry and prepare a personalized response</li>
            <li>You will receive a follow-up email with more information</li>
            <li>If you'd like a consultation, we'll schedule a time that works for you</li>
          </ol>
          <p style="margin-bottom: 16px;">In the meantime, feel free to learn more about our services at <a href="https://mysyntromed.com" style="color: #0d9488;">mysyntromed.com</a></p>
          <p style="margin-bottom: 16px;">Best regards,<br>The MySyntroMed Team</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #64748b;">This is an automated message. Please do not reply directly to this email.</p>
        </div>`,
      }),
    ]);

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[EMAIL] Contact email ${i} failed:`, r.reason);
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[EMAIL ERROR] Failed to send contact form email:`, error.message);
    return { success: false, error: error.message };
  }
};
