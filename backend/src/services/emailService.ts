import { sendEmailViaServer } from './emailClient.js';
import { getLogoHTML } from './emailLogo.js';

interface WelcomeEmailParams {
  email: string;
  displayName: string;
  password: string;
  role: 'client' | 'specialist';
  loginUrl: string;
}

export const sendWelcomeEmail = async ({
  email,
  displayName,
  password,
  role,
  loginUrl,
}: WelcomeEmailParams): Promise<{ success: boolean; error?: string }> => {
  const roleLabel = role === 'client' ? 'Healthcare Professional' : 'Specialist';
  const baseLoginUrl = loginUrl.replace(/\/+$/, '');
  const portalUrl = role === 'client'
    ? `${baseLoginUrl}/portal`
    : `${baseLoginUrl}/specialist`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 40px; margin: 20px 0; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
    .tagline { color: #64748b; font-size: 14px; }
    h1 { color: #0f172a; font-size: 24px; margin-bottom: 20px; }
    p { margin-bottom: 16px; color: #475569; }
    .credentials { background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .credentials h3 { margin: 0 0 12px 0; color: #0f172a; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    .credential-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1; }
    .credential-item:last-child { border-bottom: none; }
    .credential-label { color: #64748b; font-size: 13px; }
    .credential-value { font-weight: 600; color: #0f172a; font-family: monospace; background: #ffffff; padding: 2px 8px; border-radius: 4px; }
    .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; transition: background 0.3s; }
    .cta-button:hover { background: #0f766e; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .warning-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
    .warning-text { color: #92400e; font-size: 14px; margin: 0; }
    .features { list-style: none; padding: 0; margin: 20px 0; }
    .features li { padding: 8px 0; padding-left: 28px; position: relative; color: #475569; }
    .features li::before { content: "✓"; position: absolute; left: 0; color: #14b8a6; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
    @media (max-width: 480px) {
      .card { padding: 24px; }
      h1 { font-size: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="text-align: center; margin-bottom: 20px;">
        ${getLogoHTML(baseLoginUrl)}
      </div>
      <div class="tagline">Virtual Medical Assistant & Healthcare Support</div>

      <h1>Welcome Aboard, ${displayName}!</h1>
      
      <p>We're thrilled to have you join the MySyntroMed family as a <strong>${roleLabel}</strong>. Your account has been successfully created and you're all set to get started.</p>

      <div class="credentials">
        <h3>Your Account Details</h3>
        <div class="credential-item">
          <span class="credential-label">Email</span>
          <span class="credential-value">${email}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${portalUrl}" class="cta-button">Access Your Dashboard</a>
      </div>

      <div class="warning">
        <div class="warning-title">WARNING: First-Time Login</div>
        <p class="warning-text">Click the "Forgot Password" link on the login page to set up your secure password. This ensures your account is protected with credentials only you know.</p>
      </div>

      <h2 style="font-size: 18px; margin-top: 30px;">What's Next?</h2>
      <ul class="features">
        ${role === 'client' ? `
          <li>Complete your profile with clinic information</li>
          <li>Submit support requests for assistance</li>
          <li>Message your assigned specialist directly</li>
          <li>Schedule consultation calls</li>
        ` : `
          <li>Complete your specialist profile</li>
          <li>Review assigned client requests</li>
          <li>Coordinate with clients through secure messaging</li>
          <li>Access training resources</li>
        `}
      </ul>

      <p>If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.</p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
        <p>This email was sent because an admin created your account.</p>
        <p style="margin-top: 12px;">
          <a href="${baseLoginUrl}" style="color: #0d9488;">Visit Website</a> ·
          <a href="mailto:support@mysyntromed.com" style="color: #0d9488;">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
Welcome to MySyntroMed, ${displayName}!

We're thrilled to have you join the MySyntroMed family as a ${roleLabel}. Your account has been successfully created and you're all set to get started.

YOUR ACCOUNT DETAILS
═══════════════════════════════════════════
Email:              ${email}
Login URL:          ${portalUrl}
═══════════════════════════════════════════

FIRST-TIME LOGIN: Use the "Forgot Password" link on the login page to set up your secure password.

NEXT STEPS
${role === 'client' ? `
• Complete your profile with clinic information
• Submit support requests for assistance
• Message your assigned specialist directly
• Schedule consultation calls
` : `
• Complete your specialist profile
• Review assigned client requests
• Coordinate with clients through secure messaging
• Access training resources
`}

If you have any questions or need assistance getting started, don't hesitate to reach out to our support team.

© ${new Date().getFullYear()} MySyntroMed. All rights reserved.
This email was sent because an admin created your account.
`;

  return sendEmailViaServer({
    from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
    to: email,
    subject: `Welcome to MySyntroMed - Your Account is Ready${role === 'specialist' ? ', Specialist!' : '!'}`,
    html: htmlContent,
  });
};

interface SubscriptionExpiryEmailParams {
  email: string;
  displayName: string;
  daysLeft: number;
  expiryDate: string;
  loginUrl: string;
}

export const sendSubscriptionExpiryEmail = async ({
  email,
  displayName,
  daysLeft,
  expiryDate,
  loginUrl,
}: SubscriptionExpiryEmailParams): Promise<{ success: boolean; error?: string }> => {
  const isUrgent = daysLeft <= 3;
  const baseLoginUrl = loginUrl.replace(/\/+$/, '');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Reminder - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 40px; margin: 20px 0; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo-container { margin-bottom: 15px; }
    .logo { font-size: 28px; font-weight: 700; color: #0d9488; }
    .tagline { color: #64748b; font-size: 14px; }
    h1 { color: #0f172a; font-size: 24px; margin-bottom: 20px; text-align: center; }
    p { margin-bottom: 16px; color: #475569; }
    .warning-box { background: ${isUrgent ? '#fef2f2' : '#fffbeb'}; border: 2px solid ${isUrgent ? '#ef4444' : '#f59e0b'}; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center; }
    .days-left { font-size: 48px; font-weight: 700; color: ${isUrgent ? '#dc2626' : '#d97706'}; margin: 16px 0; line-height: 1; }
    .days-label { font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .expiry-date { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
    .expiry-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .expiry-value { font-size: 18px; font-weight: 600; color: #0f172a; margin-top: 4px; }
    .cta-button { display: inline-block; background: ${isUrgent ? '#dc2626' : '#0d9488'}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; transition: background 0.3s; }
    .cta-button:hover { background: ${isUrgent ? '#b91c1c' : '#0f766e'}; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
    @media (max-width: 480px) {
      .card { padding: 24px; }
      h1 { font-size: 20px; }
      .days-left { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div style="text-align: center; margin-bottom: 20px;">
          ${getLogoHTML(baseLoginUrl)}
        </div>
        <div class="tagline">Virtual Medical Assistant & Healthcare Support</div>
      </div>

      <h1>${isUrgent ? 'URGENT: Subscription Expiring Soon!' : 'Subscription Reminder'}</h1>
      
      <p>Dear ${displayName},</p>
      
      <p>Your MySyntroMed subscription is ${isUrgent ? 'about to expire' : 'coming to an end'}. Please take action to ensure uninterrupted access.</p>

      <div class="warning-box">
        <div class="days-label">Time Remaining</div>
        <div class="days-left">${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'}</div>
      </div>

      <div class="expiry-date">
        <div class="expiry-label">Subscription Expires On</div>
        <div class="expiry-value">${expiryDate}</div>
      </div>

      <p>After expiration, your account access will be suspended. Please contact your administrator to renew.</p>

      <div style="text-align: center;">
        <a href="${baseLoginUrl}" class="cta-button">Contact Administrator</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px;">If you have questions, contact our support team.</p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
        <p style="margin-top: 12px;">
          <a href="${baseLoginUrl}" style="color: #0d9488;">Visit Website</a> ·
          <a href="mailto:support@mysyntromed.com" style="color: #0d9488;">Contact Support</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
MySyntroMed - Subscription Reminder

Dear ${displayName},

Your MySyntroMed subscription is ${isUrgent ? 'about to expire' : 'coming to an end'}. Please take action.

TIME REMAINING: ${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'}

Subscription Expires On: ${expiryDate}

After expiration, your account access will be suspended. Please contact your administrator to renew.

Visit: ${baseLoginUrl}

© ${new Date().getFullYear()} MySyntroMed. All rights reserved.
`;

  return sendEmailViaServer({
    from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
    to: email,
    subject: isUrgent 
      ? `URGENT: MySyntroMed Subscription Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}!` 
      : `MySyntroMed Subscription Reminder - ${daysLeft} Days Left`,
    html: htmlContent,
  });
};

export const sendSubscriptionExpiredEmail = async ({
  email,
  displayName,
  expiryDate,
  loginUrl,
}: Omit<SubscriptionExpiryEmailParams, 'daysLeft'>): Promise<{ success: boolean; error?: string }> => {
  const baseLoginUrl = loginUrl.replace(/\/+$/, '');

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Expired - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 40px; margin: 20px 0; }
    .header { text-align: center; margin-bottom: 30px; }
    .logo { font-size: 28px; font-weight: 700; color: #0d9488; margin-bottom: 8px; }
    .tagline { color: #64748b; font-size: 14px; }
    h1 { color: #dc2626; font-size: 24px; margin-bottom: 20px; text-align: center; }
    p { margin-bottom: 16px; color: #475569; }
    .expired-box { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center; }
    .expired-text { font-size: 20px; font-weight: 600; color: #dc2626; margin: 16px 0; }
    .cta-button { display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .cta-button:hover { background: #b91c1c; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="text-align: center; margin-bottom: 20px;">
        ${getLogoHTML(baseLoginUrl)}
      </div>
      <div class="tagline">Virtual Medical Assistant & Healthcare Support</div>

      <h1>Subscription Expired</h1>
      
      <p>Dear ${displayName},</p>
      
      <p>Your MySyntroMed subscription has expired as of <strong>${expiryDate}</strong>.</p>

      <div class="expired-box">
        <div class="expired-text">Your account access has been suspended</div>
        <p style="margin: 0; color: #64748b;">Contact your administrator to reactivate your subscription.</p>
      </div>

      <div style="text-align: center;">
        <a href="${baseLoginUrl}" class="cta-button">Contact Administrator</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px;">Questions? Contact support@mysyntromed.com</p>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
MySyntroMed - Subscription Expired

Dear ${displayName},

Your MySyntroMed subscription has expired as of ${expiryDate}.

Your account access has been suspended. Contact your administrator to reactivate.

Visit: ${baseLoginUrl}

Questions? Contact support@mysyntromed.com

© ${new Date().getFullYear()} MySyntroMed. All rights reserved.
`;

  return sendEmailViaServer({
    from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
    to: email,
    subject: `MySyntroMed Subscription Expired - Action Required`,
    html: htmlContent,
  });
};