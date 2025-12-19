import { resolveFromEmail, sendEmail, type EmailEnv } from '../../_lib/email';
import { renderOwnerNewOrderEmail } from '../../_lib/emailTemplates';

type TestBody = {
  to?: string;
};

// TODO: Add auth before enabling this endpoint in production.
export async function onRequestPost(context: { request: Request; env: EmailEnv }): Promise<Response> {
  const { request, env } = context;
  const body = (await request.json().catch(() => null)) as TestBody | null;
  const ownerTo = env.RESEND_OWNER_TO || env.EMAIL_OWNER_TO || null;
  const to = body?.to?.trim() || ownerTo || '';

  if (!to) {
    return json({ error: 'Missing to' }, 400);
  }

  const hasKey = !!env.RESEND_API_KEY;
  const from = resolveFromEmail(env);
  if (!hasKey || !from) {
    return json(
      {
        error: 'Email not configured',
        detail: !hasKey ? 'Missing RESEND_API_KEY' : 'Missing sender email',
      },
      500
    );
  }

  const template = renderOwnerNewOrderEmail({
    orderLabel: '25-123',
    customerName: 'Sample Customer',
    customerEmail: 'customer@example.com',
    shippingAddress: {
      line1: '123 Bay St',
      city: 'Chesapeake',
      state: 'VA',
      postal_code: '23320',
      country: 'US',
      name: 'Sample Customer',
    } as any,
    items: [
      { name: 'Ornament Shell', quantity: 1, amountCents: 4500, imageUrl: 'https://placehold.co/56x56' },
      { name: 'Ring Dish', quantity: 2, amountCents: 6400, imageUrl: null },
    ],
    amounts: {
      subtotalCents: 10900,
      shippingCents: 500,
      totalCents: 11400,
      currency: 'usd',
    },
    createdAtIso: new Date().toISOString(),
    adminUrl: (env.PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL || '').replace(/\/+$/, '') + '/admin',
  });

  const result = await sendEmail(
    {
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
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
