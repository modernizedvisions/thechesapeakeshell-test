type Env = {
  CF_ACCOUNT_ID?: string;
  CF_IMAGES_API_TOKEN?: string;
  CF_IMAGES_VARIANT?: string;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  if (!env.CF_ACCOUNT_ID || !env.CF_IMAGES_API_TOKEN) {
    return json({ error: 'Missing Cloudflare Images configuration' }, 500);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data upload' }, 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    console.error('[images/upload] Failed to parse form data', err);
    return json({ error: 'Invalid form data' }, 400);
  }

  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return json({ error: 'Missing file field' }, 400);
  }

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
    return json({ error: 'Image upload failed', detail: 'Network error' }, 500);
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
    const detail =
      payload?.errors?.[0]?.message ||
      payload?.message ||
      raw ||
      `Cloudflare Images error (${response.status})`;
    return json({ error: 'Image upload failed', detail }, 500);
  }

  const result = payload.result || {};
  const variants = Array.isArray(result.variants) ? result.variants.filter((v: unknown) => typeof v === 'string') : [];
  let url = '';

  if (env.CF_IMAGES_VARIANT) {
    url = variants.find((v: string) => v.endsWith(`/${env.CF_IMAGES_VARIANT}`)) || '';
  }
  if (!url && variants.length) {
    url = variants[0];
  }

  if (!result.id || !url) {
    console.error('[images/upload] Missing delivery URL', { result });
    return json({ error: 'Image upload succeeded but no delivery URL returned' }, 500);
  }

  return json({ id: result.id, url });
}
