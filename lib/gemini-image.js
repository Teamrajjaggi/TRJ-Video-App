// Image generation through Google's Gemini API.
//
// Primary: Nano Banana (generateContent endpoint) with reference image attach
//   for identity lock.
// Fallback: Imagen 4 (predict endpoint) when Nano Banana exhausts retries.
//   Imagen doesn't take reference images, so identity is looser, but it has
//   separate capacity from Nano Banana so it still works during NB outages.
//
// Env:
//   GEMINI_API_KEY                (required)
//   GEMINI_IMAGE_MODEL            primary model id, default nano-banana-pro-preview
//   GEMINI_FALLBACK_MODEL         fallback model id, default imagen-4.0-fast-generate-001
//                                  (or "" to disable fallback)
//   GEMINI_MAX_RETRIES            primary-model retries, default 3
//   GEMINI_BACKOFF_MS             base backoff in ms, default 3000
//   GEMINI_DISABLED               "1" forces upstream stub

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const PRIMARY_MODEL = process.env.GEMINI_IMAGE_MODEL || 'nano-banana-pro-preview';
const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL === ''
    ? null
    : process.env.GEMINI_FALLBACK_MODEL || 'imagen-4.0-fast-generate-001';
const MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10);
const BASE_BACKOFF_MS = parseInt(process.env.GEMINI_BACKOFF_MS || '3000', 10);

function isDisabled() {
  return process.env.GEMINI_DISABLED === '1' || !process.env.GEMINI_API_KEY;
}

function isTransient(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function fetchAsInlineData(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[gemini] reference ${url} -> ${res.status}, skipping`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    let mimeType = res.headers.get('content-type') || '';
    if (!mimeType.startsWith('image/')) {
      if (/\.png(?:\?|$)/i.test(url)) mimeType = 'image/png';
      else if (/\.webp(?:\?|$)/i.test(url)) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }
    return { inlineData: { mimeType, data: buf.toString('base64') } };
  } catch (e) {
    console.warn(`[gemini] reference ${url} fetch failed: ${e.message}`);
    return null;
  }
}

async function postWithRetry({ url, body, label }) {
  let lastStatus = 0;
  let lastText = '';
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (res.ok) return { res, text };
    lastStatus = res.status;
    lastText = text;
    if (!isTransient(res.status) || attempt > MAX_RETRIES) break;
    const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
    console.warn(`[gemini] ${label} ${res.status} (attempt ${attempt}/${MAX_RETRIES + 1}); retrying in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }
  const err = new Error(`${label} -> ${lastStatus}: ${lastText.slice(0, 400)}`);
  err.status = lastStatus;
  throw err;
}

// Nano Banana / generateContent flow — supports reference images.
async function callGenerateContent({ model, prompt, referenceUrls }) {
  const parts = [{ text: prompt }];
  for (const url of referenceUrls) {
    const part = await fetchAsInlineData(url);
    if (part) parts.push(part);
  }
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
  const url = `${ENDPOINT_BASE}/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  console.log(`[gemini] POST ${model} (${parts.length - 1} reference image(s))`);
  const { text } = await postWithRetry({ url, body, label: `Gemini POST ${model}` });
  const payload = JSON.parse(text);
  const candidate = payload?.candidates?.[0];
  if (!candidate) throw new Error(`Gemini returned no candidates: ${text.slice(0, 400)}`);
  const finishReason = candidate.finishReason;
  if (finishReason && !['STOP', 'MAX_TOKENS', undefined].includes(finishReason)) {
    throw new Error(`Gemini finishReason=${finishReason}: ${text.slice(0, 400)}`);
  }
  const imagePart = (candidate.content?.parts || []).find((p) => p.inlineData?.data);
  if (!imagePart) throw new Error(`Gemini returned no inline image: ${text.slice(0, 400)}`);
  return {
    imageBuffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    source: model,
  };
}

// Imagen 4 / predict flow — no reference images, just prompt.
async function callPredict({ model, prompt }) {
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: '9:16' },
  };
  const url = `${ENDPOINT_BASE}/${model}:predict?key=${process.env.GEMINI_API_KEY}`;
  console.log(`[gemini] POST ${model} (Imagen, no references)`);
  const { text } = await postWithRetry({ url, body, label: `Imagen POST ${model}` });
  const payload = JSON.parse(text);
  const pred = payload?.predictions?.[0];
  const data = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded;
  if (!data) throw new Error(`Imagen returned no image data: ${text.slice(0, 400)}`);
  return {
    imageBuffer: Buffer.from(data, 'base64'),
    mimeType: pred?.mimeType || 'image/png',
    source: model,
  };
}

async function generateImage({ prompt, referenceUrls = [] }) {
  if (isDisabled()) {
    const e = new Error('GEMINI_DISABLED or GEMINI_API_KEY not set');
    e.code = 'GEMINI_DISABLED';
    throw e;
  }
  try {
    return await callGenerateContent({ model: PRIMARY_MODEL, prompt, referenceUrls });
  } catch (e) {
    if (!FALLBACK_MODEL) throw e;
    // Only fall back on transient/capacity issues. Non-transient (404, 401, 400)
    // means the request itself is wrong and Imagen won't fix that.
    if (e.status && !isTransient(e.status) && e.status !== 0) throw e;
    console.warn(
      `[gemini] ${PRIMARY_MODEL} exhausted retries (${e.message.slice(0, 80)}), falling back to ${FALLBACK_MODEL}`,
    );
    return await callPredict({ model: FALLBACK_MODEL, prompt });
  }
}

module.exports = { generateImage, isDisabled };
