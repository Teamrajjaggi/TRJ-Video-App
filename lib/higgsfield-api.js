// HTTP client for the Higgsfield video generation API.
//
// The only thing required is HIGGSFIELD_API_KEY in .env. Everything else
// has env-overridable defaults so we can tune without touching code if
// Higgsfield's path/shape differs from these assumptions.
//
//   HIGGSFIELD_API_KEY        (required) — Bearer token sent as Authorization
//   HIGGSFIELD_BASE_URL       default: https://fnf.higgsfield.ai
//   HIGGSFIELD_SUBMIT_PATH    default: /jobs/v2/kling3_0
//   HIGGSFIELD_STATUS_PATH    default: /jobs/{id}  — `{id}` replaced at request time
//   HIGGSFIELD_DURATION       default: 5
//   HIGGSFIELD_ASPECT         default: 9:16
//   HIGGSFIELD_RESOLUTION     default: 720p
//   HIGGSFIELD_POLL_INTERVAL  ms between polls (default 4000)
//   HIGGSFIELD_TIMEOUT_MS     give up after this long (default 10 min)
//   HIGGSFIELD_DISABLED       "1" to skip the API and let video-gen stub

const BASE = process.env.HIGGSFIELD_BASE_URL || 'https://fnf.higgsfield.ai';
const SUBMIT = process.env.HIGGSFIELD_SUBMIT_PATH || '/jobs/v2/kling3_0';
const STATUS = process.env.HIGGSFIELD_STATUS_PATH || '/jobs/{id}';
const DURATION = parseInt(process.env.HIGGSFIELD_DURATION || '5', 10);
const ASPECT = process.env.HIGGSFIELD_ASPECT || '9:16';
const RESOLUTION = process.env.HIGGSFIELD_RESOLUTION || '720p';
const POLL_INTERVAL = parseInt(process.env.HIGGSFIELD_POLL_INTERVAL || '4000', 10);
const TIMEOUT_MS = parseInt(process.env.HIGGSFIELD_TIMEOUT_MS || String(10 * 60 * 1000), 10);

function isDisabled() {
  return process.env.HIGGSFIELD_DISABLED === '1' || !process.env.HIGGSFIELD_API_KEY;
}

function authHeaders() {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) throw new Error('HIGGSFIELD_API_KEY is not set');
  return {
    Authorization: `Bearer ${key}`,
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
  if (!res.ok) {
    throw new Error(`POST ${url} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: authHeaders() });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

// Tolerant extractor — different model paths return slightly different shapes.
function extractJobId(obj) {
  return (
    obj?.id ||
    obj?.job_id ||
    obj?.jobId ||
    obj?.data?.id ||
    obj?.result?.id ||
    null
  );
}
function extractVideoUrl(obj) {
  const direct =
    obj?.video_url ||
    obj?.videoUrl ||
    obj?.output ||
    obj?.result?.video_url ||
    obj?.result?.videoUrl ||
    obj?.result?.url ||
    obj?.data?.video_url;
  if (direct && typeof direct === 'string') return direct;
  // Sometimes results are arrays of {url, type:"video"}
  const list = obj?.results || obj?.outputs || obj?.data?.results;
  if (Array.isArray(list)) {
    const hit = list.find((x) => typeof x?.url === 'string' && /\.(mp4|mov|webm)/i.test(x.url));
    if (hit) return hit.url;
  }
  return null;
}
function extractStatus(obj) {
  return (
    obj?.status || obj?.state || obj?.data?.status || obj?.result?.status || 'unknown'
  );
}
function isTerminalSuccess(status) {
  return /^(succeeded|success|done|completed|finished)$/i.test(status);
}
function isTerminalFailure(status) {
  return /^(failed|error|cancelled|canceled|rejected)$/i.test(status);
}

async function pollUntilDone(jobId, deadline) {
  const path = STATUS.replace('{id}', encodeURIComponent(jobId));
  const url = `${BASE}${path}`;
  while (Date.now() < deadline) {
    const obj = await getJson(url);
    const status = extractStatus(obj);
    const video = extractVideoUrl(obj);
    if (video) return { videoUrl: video, raw: obj };
    if (isTerminalSuccess(status) && !video) {
      throw new Error(`Higgsfield job ${jobId} succeeded but no video URL in response: ${JSON.stringify(obj).slice(0, 400)}`);
    }
    if (isTerminalFailure(status)) {
      throw new Error(`Higgsfield job ${jobId} failed: ${JSON.stringify(obj).slice(0, 400)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Higgsfield job ${jobId} timed out after ${TIMEOUT_MS}ms`);
}

async function generateVideo({ prompt }) {
  if (isDisabled()) {
    const err = new Error('HIGGSFIELD_DISABLED or no API key');
    err.code = 'HIGGSFIELD_DISABLED';
    throw err;
  }
  const submitUrl = `${BASE}${SUBMIT}`;
  const body = {
    prompt,
    params: {
      duration: DURATION,
      aspect_ratio: ASPECT,
      resolution: RESOLUTION,
    },
  };

  const submitted = await postJson(submitUrl, body);

  // If the submit endpoint already returned the video synchronously, take it.
  const directVideo = extractVideoUrl(submitted);
  if (directVideo) {
    return { videoUrl: directVideo, raw: submitted };
  }

  const jobId = extractJobId(submitted);
  if (!jobId) {
    throw new Error(
      `Higgsfield submit returned no job id and no video url. Response: ${JSON.stringify(submitted).slice(0, 400)}`,
    );
  }
  const deadline = Date.now() + TIMEOUT_MS;
  return pollUntilDone(jobId, deadline);
}

module.exports = { generateVideo, isDisabled };
