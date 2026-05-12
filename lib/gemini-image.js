// Google Gemini image generation client (Nano Banana).
//
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Auth:     ?key=<GEMINI_API_KEY> query param
//
// Returns the raw image bytes (Buffer) so the caller can stage it wherever.
// The Higgsfield DoP step needs an HTTPS URL, so the caller uploads the
// returned buffer to R2 and passes the public URL into DoP.
//
// Env:
//   GEMINI_API_KEY        (required)
//   GEMINI_IMAGE_MODEL    default: gemini-2.5-flash-image-preview (Nano Banana)
//   GEMINI_DISABLED       "1" forces the upstream to fall back to its stub

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';

function isDisabled() {
  return process.env.GEMINI_DISABLED === '1' || !process.env.GEMINI_API_KEY;
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
    // Some servers report octet-stream; sniff based on URL suffix as a fallback.
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

async function generateImage({ prompt, referenceUrls = [] }) {
  if (isDisabled()) {
    const e = new Error('GEMINI_DISABLED or GEMINI_API_KEY not set');
    e.code = 'GEMINI_DISABLED';
    throw e;
  }

  const parts = [{ text: prompt }];
  for (const url of referenceUrls) {
    const part = await fetchAsInlineData(url);
    if (part) parts.push(part);
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };

  const url = `${ENDPOINT_BASE}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  console.log(`[gemini] POST ${MODEL} (${parts.length - 1} reference image(s))`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini POST ${MODEL} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate) {
    throw new Error(`Gemini returned no candidates: ${text.slice(0, 400)}`);
  }
  const finishReason = candidate.finishReason;
  if (finishReason && !['STOP', 'MAX_TOKENS', undefined].includes(finishReason)) {
    throw new Error(`Gemini finishReason=${finishReason}: ${text.slice(0, 400)}`);
  }
  const imagePart = (candidate.content?.parts || []).find((p) => p.inlineData?.data);
  if (!imagePart) {
    throw new Error(`Gemini returned no inline image data: ${text.slice(0, 400)}`);
  }
  return {
    imageBuffer: Buffer.from(imagePart.inlineData.data, 'base64'),
    mimeType: imagePart.inlineData.mimeType || 'image/png',
  };
}

module.exports = { generateImage, isDisabled };
