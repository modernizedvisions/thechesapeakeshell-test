import { sendEmail } from '../../_lib/email';
import type { EmailEnv } from '../../_lib/email';

export async function onRequestGet(context: { request: Request; env: EmailEnv }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const to = url.searchParams.get('to');

  if (!to) {
    return json({ error: 'Missing to param' }, 400);
  }

  const hasKey = !!env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL || env.EMAIL_FROM || 'onboarding@resend.dev';
  if (!hasKey || !from) {
    return json(
      {
        error: 'Email not configured',
        detail: !hasKey ? 'Missing RESEND_API_KEY' : 'Missing sender email',
      },
      500
    );
  }

  const result = await sendEmail(
    {
      to,
      subject: 'Test email from The Chesapeake Shell',
      text: 'This is a test email sent via Resend.',
      html: `<div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">This is a test email sent via Resend.</div>`,
    },
    env
  );

  if (!result.ok) {
    return json({ error: 'Failed to send email', detail: result.error }, 500);
  }

  return json({ success: true, to, from, resendId: (result as any).id });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
