type Env = {
  CF_ACCOUNT_ID?: string;
  CF_IMAGES_API_TOKEN?: string;
  CF_IMAGES_VARIANT?: string;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const contentType = request.headers.get('content-type') || '';
  const contentLength = request.headers.get('content-length') || '';

  console.log('[images/upload] incoming request', {
    method: request.method,
    contentType,
    contentLength,
    provider: 'cloudflare_images',
  });

  try {
    if (!env.CF_ACCOUNT_ID || !env.CF_IMAGES_API_TOKEN) {
      return json({ error: 'Missing Cloudflare Images configuration' }, 500);
    }

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return json({ error: 'Expected multipart/form-data upload' }, 400);
    }

    const lengthValue = Number(contentLength);
    if (Number.isFinite(lengthValue) && lengthValue > MAX_UPLOAD_BYTES) {
      return json({ error: 'Upload too large', details: 'Max 8MB allowed' }, 413);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch (err) {
      console.error('[images/upload] Failed to parse form data', err);
      return json({ error: 'Invalid form data' }, 400);
    }

    let file = form.get('file');
    if (!file) {
      const files = form.getAll('files[]');
      file = files.find((entry) => entry instanceof File) || null;
    }

    if (!file || !(file instanceof File)) {
      return json({ error: 'Missing file field' }, 400);
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return json({ error: 'Unsupported image type', details: file.type || 'unknown' }, 415);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return json({ error: 'Upload too large', details: 'Max 8MB allowed' }, 413);
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
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/images/v1`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}`,
          },
          body: uploadForm,
        }
      );
    } catch (err) {
      console.error('[images/upload] Upload request failed', err);
      return json({ error: 'Image upload failed', details: 'Network error' }, 500);
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
      return json({ error: 'Image upload failed', details }, 500);
    }

    const result = payload.result || {};
    const variants = Array.isArray(result.variants)
      ? result.variants.filter((v: unknown) => typeof v === 'string')
      : [];
    let url = '';

    if (env.CF_IMAGES_VARIANT) {
      url = variants.find((v: string) => v.endsWith(`/${env.CF_IMAGES_VARIANT}`)) || '';
    }
    if (!url && variants.length) {
      url = variants[0];
    }

    if (!result.id || !url) {
      console.error('[images/upload] Missing delivery URL', { result });
      return json({ error: 'Image upload succeeded but no delivery URL returned', details: raw }, 500);
    }

    return json({
      id: result.id,
      url,
      width: typeof result.width === 'number' ? result.width : undefined,
      height: typeof result.height === 'number' ? result.height : undefined,
    });
  } catch (err) {
    const details = err instanceof Error ? `${err.message}\n${err.stack || ''}` : String(err);
    console.error('[images/upload] Unexpected error', details);
    return json({ error: 'Image upload failed', details }, 500);
  }
}
