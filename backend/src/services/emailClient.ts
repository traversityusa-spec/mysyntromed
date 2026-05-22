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
