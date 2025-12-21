type Env = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_IMAGES_API_TOKEN?: string;
  CLOUDFLARE_IMAGES_VARIANT?: string;
};

const BUILD_FINGERPRINT = 'upload-fingerprint-2025-12-21-a';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const corsHeaders = (request?: Request | null) => ({
  'Access-Control-Allow-Origin': request?.headers.get('Origin') || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
});

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const withFingerprint = <T extends Record<string, unknown>>(data: T) => ({
  ...data,
  fingerprint: BUILD_FINGERPRINT,
});

const getProcessEnv = (key: string): string | undefined => {
  try {
    const proc = (globalThis as any)?.process;
    const env = proc?.env;
    if (!env) return undefined;
    const value = env[key];
    return typeof value === 'string' ? value : undefined;
  } catch {
    return undefined;
  }
};

const resolveImagesEnv = (env: Env) => {
  const hasContextEnv = Boolean(
    env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_IMAGES_API_TOKEN || env.CLOUDFLARE_IMAGES_VARIANT
  );
  const accountId = hasContextEnv
    ? env.CLOUDFLARE_ACCOUNT_ID
    : getProcessEnv('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = hasContextEnv
    ? env.CLOUDFLARE_IMAGES_API_TOKEN
    : getProcessEnv('CLOUDFLARE_IMAGES_API_TOKEN');
  const variant = hasContextEnv ? env.CLOUDFLARE_IMAGES_VARIANT : getProcessEnv('CLOUDFLARE_IMAGES_VARIANT');

  const missing: string[] = [];
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!apiToken) missing.push('CLOUDFLARE_IMAGES_API_TOKEN');
  return { accountId, apiToken, variant, missing };
};

export async function onRequestOptions(context: { request: Request }): Promise<Response> {
  const { request } = context;
  console.log('[images/upload] handler', {
    handler: 'OPTIONS',
    method: request.method,
    url: request.url,
    contentType: request.headers.get('content-type') || '',
    requestId: request.headers.get('x-upload-request-id'),
  });
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(context.request),
      'X-Upload-Fingerprint': BUILD_FINGERPRINT,
    },
  });
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  console.log('[images/upload] handler', {
    handler: 'GET',
    method: request.method,
    url: request.url,
    contentType: request.headers.get('content-type') || '',
    requestId: request.headers.get('x-upload-request-id'),
  });
  return json(
    withFingerprint({
      error: 'Method not allowed. Use POST.',
      method: 'GET',
      path: request.url,
    }),
    405,
    corsHeaders(request)
  );
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const contentType = request.headers.get('content-type') || '';
  const contentLength = request.headers.get('content-length') || '';

  console.log('[images/upload] handler', {
    handler: 'POST',
    method: request.method,
    url: request.url,
    contentType,
    requestId: request.headers.get('x-upload-request-id'),
  });

  try {
    const { accountId, apiToken, variant, missing } = resolveImagesEnv(env);
    if (missing.length) {
      return json(
        withFingerprint({
          error: 'Missing Cloudflare Images configuration',
          details: missing,
          envPresent: {
            CLOUDFLARE_ACCOUNT_ID: !!accountId,
            CLOUDFLARE_IMAGES_API_TOKEN: !!apiToken,
            CLOUDFLARE_IMAGES_VARIANT: !!variant,
          },
          envPreview: {
            accountIdPrefix: accountId ? accountId.slice(0, 6) : null,
            tokenPrefix: apiToken ? apiToken.slice(0, 6) : null,
          },
        }),
        500,
        corsHeaders(request)
      );
    }

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return json(
        withFingerprint({ error: 'Expected multipart/form-data upload' }),
        400,
        corsHeaders(request)
      );
    }

    const lengthValue = Number(contentLength);
    if (Number.isFinite(lengthValue) && lengthValue > MAX_UPLOAD_BYTES) {
      return json(
        withFingerprint({ error: 'Upload too large', details: 'Max 8MB allowed' }),
        413,
        corsHeaders(request)
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch (err) {
      console.error('[images/upload] Failed to parse form data', err);
      return json(withFingerprint({ error: 'Invalid form data' }), 400, corsHeaders(request));
    }

    let file = form.get('file');
    if (!file) {
      const files = form.getAll('files[]');
      file = files.find((entry) => entry instanceof File) || null;
    }

    if (!file || !(file instanceof File)) {
      return json(withFingerprint({ error: 'Missing file field' }), 400, corsHeaders(request));
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return json(
        withFingerprint({ error: 'Unsupported image type', details: file.type || 'unknown' }),
        415,
        corsHeaders(request)
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return json(
        withFingerprint({ error: 'Upload too large', details: 'Max 8MB allowed' }),
        413,
        corsHeaders(request)
      );
    }

    console.log('[images/upload] file received', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const uploadForm = new FormData();
    uploadForm.append('file', file, file.name || 'upload');

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
          body: uploadForm,
        }
      );
    } catch (err) {
      console.error('[images/upload] Upload request failed', err);
      return json(
        withFingerprint({ error: 'Image upload failed', details: 'Network error' }),
        500,
        corsHeaders(request)
      );
    }

    const raw = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.success) {
      console.error('[images/upload] Upload error', { status: response.status, raw });
      const details =
        payload?.errors?.[0]?.message ||
        payload?.message ||
        raw ||
        `Cloudflare Images error (${response.status})`;
      return json(
        withFingerprint({
          error: 'Image upload failed',
          details: {
            status: response.status,
            body: raw,
            message: details,
          },
        }),
        500,
        corsHeaders(request)
      );
    }

    const result = payload.result || {};
    const variants = Array.isArray(result.variants)
      ? result.variants.filter((v: unknown) => typeof v === 'string')
      : [];
    let url = '';

    if (variant) {
      url = variants.find((v: string) => v.endsWith(`/${variant}`)) || '';
    }
    if (!url && variants.length) {
      url = variants[0];
    }

    if (!result.id || !url) {
      console.error('[images/upload] Missing delivery URL', { result });
      return json(
        withFingerprint({ error: 'Image upload succeeded but no delivery URL returned', details: raw }),
        500,
        corsHeaders(request)
      );
    }

    return json(
      withFingerprint({
        id: result.id,
        url,
        width: typeof result.width === 'number' ? result.width : undefined,
        height: typeof result.height === 'number' ? result.height : undefined,
      }),
      200,
      corsHeaders(request)
    );
  } catch (err) {
    const details = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    console.error('[images/upload] Unexpected error', details);
    return json(withFingerprint({ error: 'Image upload failed', details }), 500, corsHeaders(request));
  }
}
