import { sendEmailViaServer } from './emailClient.js';
import { getLogoHTML } from './emailLogo.js';

interface StatusChangeEmailParams {
  recipientEmail: string;
  recipientName: string;
  role: 'client' | 'specialist';
  requestType: string;
  oldStatus: string;
  newStatus: string;
  changedByName: string;
  loginUrl: string;
}

const formatStatus = (s: string) => s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);

const statusColors: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#10b981',
};

export const sendStatusChangeEmail = async ({
  recipientEmail,
  recipientName,
  role,
  requestType,
  newStatus,
  changedByName,
  loginUrl,
}: StatusChangeEmailParams): Promise<{ success: boolean; error?: string }> => {
  if (!recipientEmail) return { success: false, error: 'No email' };

  const baseLoginUrl = loginUrl.replace(/\/+$/, '');
  const color = statusColors[newStatus] || '#94a3b8';
  const statusLabel = formatStatus(newStatus);
  const dashboardUrl = role === 'specialist' ? `${baseLoginUrl}/specialist` : `${baseLoginUrl}/portal`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Request Status Update - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 30px; margin: 20px 0; }
    .header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .logo { font-size: 22px; font-weight: 700; color: #0d9488; }
    .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; background: ${color}20; color: ${color}; }
    h1 { color: #0f172a; font-size: 20px; margin: 0 0 10px 0; }
    .update-section { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div style="text-align: center; margin-bottom: 20px;">
        ${getLogoHTML(baseLoginUrl)}
      </div>

      <h1>Request Status Updated</h1>
      <p>Hello ${recipientName},</p>
      <p>The status of your <strong>${requestType}</strong> request has been updated by <strong>${changedByName}</strong>.</p>

      <div class="update-section" style="text-align:center;">
        <span class="status-badge">${statusLabel}</span>
      </div>

      <p style="color: #64748b; font-size: 14px;">Log in to your dashboard to view full details and track all your requests.</p>

      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">View in Dashboard</a>
      </div>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  const textContent = `
REQUEST STATUS UPDATE

Hello ${recipientName},

The status of your ${requestType} request has been updated by ${changedByName}.

New Status: ${statusLabel}

View in Dashboard: ${dashboardUrl}

© ${new Date().getFullYear()} MySyntroMed
`;

  return sendEmailViaServer({
    from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
    to: recipientEmail,
    subject: `[MySyntroMed] Request Status Update - ${requestType} is now ${statusLabel}`,
    html: htmlContent,
  });
};
