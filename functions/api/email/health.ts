import type { EmailEnv } from '../../_lib/email';

type Env = EmailEnv;

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  const { env } = context;
  const hasResendKey = !!env.RESEND_API_KEY;
  const from = env.RESEND_FROM_EMAIL || env.EMAIL_FROM || 'onboarding@resend.dev';
  const ownerTo = env.EMAIL_OWNER_TO || env.RESEND_OWNER_TO || null;
  const siteUrl = env.PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL || null;
  const hasFrom = !!from;
  const hasOwnerTo = !!ownerTo;
  const hasSiteUrl = !!siteUrl;

  return new Response(
    JSON.stringify({
      ok: true,
      hasResendKey,
      hasFrom,
      hasOwnerTo,
      hasSiteUrl,
      resolved: {
        from,
        ownerTo,
        siteUrl,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
