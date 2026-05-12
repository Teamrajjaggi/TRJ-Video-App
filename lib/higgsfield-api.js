// Higgsfield video generation client.
//
// Matches the official Python SDK's protocol:
//   https://github.com/higgsfield-ai/higgsfield-client
//
//   POST  https://platform.higgsfield.ai/<application>     (submit)
//   GET   <status_url returned by submit>                  (poll)
//
// Auth header: `Authorization: Key <api_key>:<api_secret>`
//
// In our .env, we name the two halves HIGGSFIELD_KEY_ID (the public id /
// "API Key" UUID shown in your dashboard label) and HIGGSFIELD_API_KEY
// (the long hex "secret"). The official names HF_API_KEY/HF_API_SECRET
// are also accepted.
//
//   HIGGSFIELD_BASE_URL        default: https://platform.higgsfield.ai
//   HIGGSFIELD_APPLICATION     default: kuaishou/kling/v3.0/text-to-video
//   HIGGSFIELD_CRED_ORDER      "id-first" (default) | "key-first"
//   HIGGSFIELD_DURATION        default: 5
//   HIGGSFIELD_ASPECT          default: 9:16
//   HIGGSFIELD_RESOLUTION      default: 720p
//   HIGGSFIELD_POLL_INTERVAL   ms (default 4000)
//   HIGGSFIELD_TIMEOUT_MS      give-up timeout (default 10 min)
//   HIGGSFIELD_DISABLED        "1" forces stub

const BASE = process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai';
const APPLICATION = process.env.HIGGSFIELD_APPLICATION || 'sora-2/text-to-video';
// Sora 2 only accepts durations 4, 8, or 12. Default to 8.
const DURATION = parseInt(process.env.HIGGSFIELD_DURATION || '8', 10);
const ASPECT = process.env.HIGGSFIELD_ASPECT || '9:16';
const RESOLUTION = process.env.HIGGSFIELD_RESOLUTION || '720p';
const POLL_INTERVAL = parseInt(process.env.HIGGSFIELD_POLL_INTERVAL || '4000', 10);
const TIMEOUT_MS = parseInt(process.env.HIGGSFIELD_TIMEOUT_MS || String(10 * 60 * 1000), 10);

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
    'User-Agent': 'video-review/0.1',
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

function extractVideoUrl(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.video_url === 'string') return obj.video_url;
  if (obj.video && typeof obj.video.url === 'string') return obj.video.url;
  if (Array.isArray(obj.videos) && obj.videos[0]?.url) return obj.videos[0].url;
  if (obj.output && typeof obj.output.url === 'string') return obj.output.url;
  if (Array.isArray(obj.outputs) && obj.outputs[0]?.url) return obj.outputs[0].url;
  if (obj.result) return extractVideoUrl(obj.result);
  if (typeof obj.url === 'string' && /\.(mp4|mov|webm)(?:\?|$)/i.test(obj.url)) {
    return obj.url;
  }
  return null;
}

const TERMINAL_OK = new Set(['completed', 'succeeded', 'success', 'done', 'finished']);
const TERMINAL_FAIL = new Set([
  'failed',
  'error',
  'errored',
  'canceled',
  'cancelled',
  'nsfw',
  'rejected',
]);

async function pollUntilDone(statusUrl, deadline) {
  while (Date.now() < deadline) {
    const data = await getJson(statusUrl);
    const status = String(data?.status || '').toLowerCase();
    const video = extractVideoUrl(data);
    if (video) return { videoUrl: video, raw: data };
    if (TERMINAL_OK.has(status) && !video) {
      throw new Error(
        `Higgsfield job completed but no video URL in response: ${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    if (TERMINAL_FAIL.has(status)) {
      throw new Error(
        `Higgsfield job ${status}: ${JSON.stringify(data).slice(0, 400)}`,
      );
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Higgsfield poll timed out after ${TIMEOUT_MS}ms`);
}

async function generateVideo({ prompt }) {
  if (isDisabled()) {
    const err = new Error('HIGGSFIELD_DISABLED or no API credentials');
    err.code = 'HIGGSFIELD_DISABLED';
    throw err;
  }
  const submitUrl = `${BASE}/${APPLICATION.replace(/^\//, '')}`;
  // Some models want `prompts: [string]` (seedance), most want `prompt: string`.
  const body = APPLICATION.startsWith('seedance')
    ? {
        prompts: [prompt],
        duration: DURATION,
        aspect_ratio: ASPECT,
        resolution: RESOLUTION,
      }
    : {
        prompt,
        duration: DURATION,
        aspect_ratio: ASPECT,
        resolution: RESOLUTION,
      };

  console.log(`[higgsfield] POST ${submitUrl}`);
  const submitted = await postJson(submitUrl, body);

  // If the submit response somehow already contained a video URL, take it.
  const direct = extractVideoUrl(submitted);
  if (direct) return { videoUrl: direct, raw: submitted };

  const statusUrl =
    submitted?.status_url ||
    (submitted?.request_id ? `${BASE}/requests/${submitted.request_id}/status` : null);
  if (!statusUrl) {
    throw new Error(
      `Submit returned no status_url or request_id. Response: ${JSON.stringify(submitted).slice(0, 400)}`,
    );
  }
  console.log(`[higgsfield] polling ${statusUrl}`);
  return pollUntilDone(statusUrl, Date.now() + TIMEOUT_MS);
}

module.exports = { generateVideo, isDisabled };
