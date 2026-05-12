// Higgsfield API client — two-stage pipeline.
//   Stage 1: image gen via `higgsfield-ai/soul/standard` (or override)
//   Stage 2: image-to-video via `higgsfield-ai/dop/turbo` (or override)
//
// Auth header: `Authorization: Key <key_id>:<api_key>`
// Submit returns `{ request_id, status_url, cancel_url }`; we poll status_url.
// Completed image payload: { images: [{ url }] }
// Completed video payload: { video: { url } }

const BASE = process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai';
const IMAGE_MODEL =
  process.env.HIGGSFIELD_IMAGE_MODEL || 'higgsfield-ai/soul/standard';
const VIDEO_MODEL =
  process.env.HIGGSFIELD_VIDEO_MODEL || 'higgsfield-ai/dop/turbo';
const ASPECT = process.env.HIGGSFIELD_ASPECT || '9:16';
const RESOLUTION = process.env.HIGGSFIELD_RESOLUTION || '720p';
const DURATION = parseInt(process.env.HIGGSFIELD_DURATION || '5', 10);
const POLL_INTERVAL = parseInt(process.env.HIGGSFIELD_POLL_INTERVAL || '4000', 10);
const TIMEOUT_MS = parseInt(process.env.HIGGSFIELD_TIMEOUT_MS || String(15 * 60 * 1000), 10);

function combinedCredential() {
  if (process.env.HF_KEY) return process.env.HF_KEY;
  if (process.env.HF_API_KEY && process.env.HF_API_SECRET) {
    return `${process.env.HF_API_KEY}:${process.env.HF_API_SECRET}`;
  }
  const keyId = process.env.HIGGSFIELD_KEY_ID;
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!keyId || !apiKey) return null;
  return process.env.HIGGSFIELD_CRED_ORDER === 'key-first'
    ? `${apiKey}:${keyId}`
    : `${keyId}:${apiKey}`;
}

function isDisabled() {
  return process.env.HIGGSFIELD_DISABLED === '1' || !combinedCredential();
}

function authHeaders() {
  const cred = combinedCredential();
  if (!cred) throw new Error('Higgsfield credentials not set');
  return {
    Authorization: `Key ${cred}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`POST ${url} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}: ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GET ${url} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

const TERMINAL_FAIL = new Set(['failed', 'nsfw', 'cancelled', 'canceled', 'rejected']);

async function pollUntilCompleted(initial, deadline) {
  if (initial?.status === 'completed') return initial;
  const statusUrl = initial?.status_url;
  if (!statusUrl) {
    throw new Error(
      `Submit returned no status_url. Response: ${JSON.stringify(initial).slice(0, 400)}`,
    );
  }
  while (Date.now() < deadline) {
    const data = await getJson(statusUrl);
    const status = String(data?.status || '').toLowerCase();
    if (status === 'completed') return data;
    if (TERMINAL_FAIL.has(status)) {
      throw new Error(`Higgsfield job ${status}: ${JSON.stringify(data).slice(0, 400)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Higgsfield poll timed out after ${TIMEOUT_MS}ms`);
}

// Stage 1: text -> image. Returns { imageUrl, raw }.
async function generateImage({ prompt }) {
  if (isDisabled()) {
    const err = new Error('Higgsfield credentials not set / disabled');
    err.code = 'HIGGSFIELD_DISABLED';
    throw err;
  }
  const url = `${BASE}/${IMAGE_MODEL}`;
  const body = { prompt, aspect_ratio: ASPECT, resolution: RESOLUTION };
  console.log(`[higgsfield] image POST ${url}`);
  const submitted = await postJson(url, body);
  const completed = await pollUntilCompleted(submitted, Date.now() + TIMEOUT_MS);
  const imageUrl = completed?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error(
      `Image generation completed but no images[0].url. Body: ${JSON.stringify(completed).slice(0, 400)}`,
    );
  }
  return { imageUrl, raw: completed };
}

// Stage 2: image -> video. Returns { videoUrl, raw }.
async function generateVideoFromImage({ prompt, imageUrl, duration }) {
  if (isDisabled()) {
    const err = new Error('Higgsfield credentials not set / disabled');
    err.code = 'HIGGSFIELD_DISABLED';
    throw err;
  }
  const url = `${BASE}/${VIDEO_MODEL}`;
  const body = {
    prompt,
    image_url: imageUrl,
    aspect_ratio: ASPECT,
    duration: duration || DURATION,
  };
  console.log(`[higgsfield] video POST ${url}`);
  const submitted = await postJson(url, body);
  const completed = await pollUntilCompleted(submitted, Date.now() + TIMEOUT_MS);
  const videoUrl =
    completed?.video?.url ||
    completed?.videos?.[0]?.url ||
    completed?.output?.url;
  if (!videoUrl) {
    throw new Error(
      `Video generation completed but no video.url. Body: ${JSON.stringify(completed).slice(0, 400)}`,
    );
  }
  return { videoUrl, raw: completed };
}

module.exports = { generateImage, generateVideoFromImage, isDisabled };
