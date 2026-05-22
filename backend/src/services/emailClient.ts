const EMAIL_SERVER_URL = process.env.EMAIL_SERVER_URL || 'http://localhost:3002';
const EMAIL_SERVICE_KEY = process.env.EMAIL_SERVICE_KEY;

interface SendEmailParams {
  from?: string;
  to: string;
  subject: string;
  html: string;
}

export const sendEmailViaServer = async ({
  from,
  to,
  subject,
  html,
}: SendEmailParams): Promise<{ success: boolean; error?: string }> => {
  if (EMAIL_SERVICE_KEY) {
    try {
      const res = await fetch(`${EMAIL_SERVER_URL}/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EMAIL_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          from: from || process.env.SMTP_FROM || '"MySyntroMed" <noreply@mysyntromed.com>',
          to,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`[EMAIL CLIENT] Server returned ${res.status}: ${err}`);
        return { success: false, error: `Email server error: ${res.status}` };
      }

      console.log(`[EMAIL CLIENT] Sent to ${to} via email server`);
      return { success: true };
    } catch (error: any) {
      console.error(`[EMAIL CLIENT] Failed to reach email server:`, error.message);
      return { success: false, error: error.message };
    }
  }

  console.log(`[EMAIL CLIENT] EMAIL_SERVICE_KEY not set. Would send to: ${to}`);
  return { success: true };
};

export const notifyAdminsViaEmail = async (
  admin: any,
  subject: string,
  html: string
): Promise<void> => {
  try {
    const adminSnap = await admin.firestore().collection('users').where('role', '==', 'admin').get();
    const promises: Promise<any>[] = [];
    adminSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const email = data?.email;
      if (!email) return;
      promises.push(
        sendEmailViaServer({
          to: email,
          subject,
          html,
        })
      );
    });
    await Promise.allSettled(promises);
  } catch (e) {
    console.error('[NOTIFY ADMINS] Failed:', e);
  }
};

export const sendMessageNotification = async (
  adminInstance: any,
  senderId: string,
  senderName: string,
  senderRole: string,
  receiverId: string,
  receiverName: string,
  receiverEmail: string | null | undefined,
  receiverRole: string,
  messagePreview: string | undefined | null,
  loginUrl: string
): Promise<void> => {
  try {
    const preview = (messagePreview || '').substring(0, 120);
    const dashboardLink = `${loginUrl.replace(/\/+$/, '')}/admin/conversations`;

    // Notify admins
    notifyAdminsViaEmail(
      adminInstance,
      `[MySyntroMed] New Message from ${senderName}`,
      `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">New Message Activity</h2>
        <p style="color: #475569;"><strong>${senderName}</strong> (${senderRole}) sent a message to <strong>${receiverName}</strong> (${receiverRole}).</p>
        ${preview ? `<div style="background: #f8fafc; border-left: 4px solid #0d9488; padding: 12px; margin: 16px 0; color: #475569; font-style: italic;">"${preview}..."</div>` : ''}
        <a href="${dashboardLink}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Messages</a>
      </div>`
    );

    // Send email to receiver
    sendEmailToReceiver(receiverEmail, receiverName, senderName, messagePreview, loginUrl, receiverRole).catch(e => console.error('[NOTIFY] Message email failed:', e));
  } catch (error: any) {
    console.error('[SEND MESSAGE NOTIFICATION] Error:', error.message);
  }
};

export const sendCallNotification = async (
  adminInstance: any,
  callerName: string,
  receiverName: string,
  receiverEmail: string | null | undefined,
  callType: string,
  meetingLink: string,
  loginUrl: string
): Promise<void> => {
  try {
    const dashboardLink = `${loginUrl.replace(/\/+$/, '')}/admin/conversations`;

    // Notify admins
    notifyAdminsViaEmail(
      adminInstance,
      `[MySyntroMed] Call from ${callerName}`,
      `<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0f172a;">New Call Activity</h2>
        <p style="color: #475569;"><strong>${callerName}</strong> started a ${callType} call with <strong>${receiverName}</strong>.</p>
        <a href="${meetingLink}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">Join Call</a>
        <a href="${dashboardLink}" style="display: inline-block; background: #0d9488; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Conversations</a>
      </div>`
    );

    // Send email to receiver
    if (receiverEmail && EMAIL_SERVICE_KEY) {
      fetch(`${EMAIL_SERVER_URL}/send-unread-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EMAIL_SERVICE_KEY}` },
        body: JSON.stringify({
          email: receiverEmail,
          receiverName,
          senderName: callerName,
          messagePreview: `Incoming ${callType} call from ${callerName}`,
          loginUrl,
          receiverRole: 'client',
        }),
      }).catch(e => console.error('[NOTIFY] Call email failed:', e));
    }
  } catch (error: any) {
    console.error('[SEND CALL NOTIFICATION] Error:', error.message);
  }
};

const sendEmailToReceiver = async (
  receiverEmail: string | null | undefined,
  receiverName: string,
  senderName: string,
  messagePreview: string | undefined | null,
  loginUrl: string,
  receiverRole: string
): Promise<void> => {
  if (receiverEmail && EMAIL_SERVICE_KEY) {
    const res = await fetch(`${EMAIL_SERVER_URL}/send-unread-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EMAIL_SERVICE_KEY}` },
      body: JSON.stringify({
        email: receiverEmail,
        receiverName,
        senderName,
        messagePreview: (messagePreview || '').substring(0, 100),
        loginUrl,
        receiverRole,
      }),
    });

    if (!res.ok) {
      console.error(`[EMAIL CLIENT] Unread message email failed: ${await res.text()}`);
    }
  }
};
