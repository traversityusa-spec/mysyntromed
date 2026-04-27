import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface NewRequestEmailParams {
  adminEmail: string;
  clientName: string;
  clientEmail: string;
  requestType: string;
  description: string;
  priority: string;
  loginUrl: string;
}

export const sendNewRequestEmailToAdmin = async ({
  adminEmail,
  clientName,
  clientEmail,
  requestType,
  description,
  priority,
  loginUrl,
}: NewRequestEmailParams): Promise<{ success: boolean; error?: string }> => {
  const priorityColors: Record<string, string> = {
    urgent: '#dc2626',
    high: '#f59e0b',
    normal: '#14b8a6',
  };
  const priorityColor = priorityColors[priority] || priorityColors.normal;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Request - MySyntroMed</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); padding: 30px; margin: 20px 0; }
    .header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .logo { font-size: 22px; font-weight: 700; color: #0d9488; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-urgent { background: #fef2f2; color: #dc2626; }
    .badge-high { background: #fef3c7; color: #f59e0b; }
    .badge-normal { background: #f0fdfa; color: #14b8a6; }
    h1 { color: #0f172a; font-size: 20px; margin: 0 0 10px 0; }
    .request-type { font-size: 18px; color: #0d9488; font-weight: 600; margin-bottom: 15px; }
    .details { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 15px 0; }
    .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; width: 120px; font-size: 13px; }
    .detail-value { color: #0f172a; font-weight: 500; }
    .cta-button { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .cta-button:hover { background: #0f766e; }
    .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">MySyntroMed</div>
      </div>

      <span class="badge badge-${priority}">${priority} Priority</span>

      <div class="request-type">New ${requestType} Request</div>
      
      <p>A new client has submitted a support request and requires attention.</p>

      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Client Name</span>
          <span class="detail-value">${clientName || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${clientEmail || 'N/A'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Request Type</span>
          <span class="detail-value">${requestType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Priority</span>
          <span class="detail-value">${priority}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Description</span>
          <span class="detail-value">${description || 'No description provided'}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${loginUrl}/admin" class="cta-button">View in Admin Dashboard</a>
      </div>

      <div class="footer">
        <p>© ${new Date().getFullYear()} MySyntroMed. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  const textContent = `
NEW ${requestType.toUpperCase()} REQUEST

A new client has submitted a support request.

CLIENT DETAILS
══════════════════════════════════════════
Client Name:     ${clientName || 'N/A'}
Email:         ${clientEmail || 'N/A'}
Request Type:  ${requestType}
Priority:     ${priority}
Description:  ${description || 'No description provided'}
══════════════════════════════════════════

View in Admin Dashboard: ${loginUrl}/admin

© ${new Date().getFullYear()} MySyntroMed
`;

  const mailOptions = {
    from: process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
    to: adminEmail,
    subject: `[MySyntroMed] New ${requestType} Request (${priority}) - ${clientName || clientEmail}`,
    text: textContent,
    html: htmlContent,
  };

  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] Admin notification sent to ${adminEmail}`);
      return { success: true };
    } else {
      console.log(`[EMAIL SIMULATION] Would send new request notification to: ${adminEmail}`);
      return { success: true };
    }
  } catch (error: any) {
    console.error(`[EMAIL ERROR] Failed to send admin notification:`, error.message);
    return { success: false, error: error.message };
  }
};