// Cloudflare Stream: copies clips to Cloudflare's video CDN so the feed
// plays them from the edge instead of proxying bytes through this server.
//
// Env:
//   CF_ACCOUNT_ID    Cloudflare account id
//   CF_STREAM_TOKEN  API token with Stream:Edit permission
//
// Flow per clip (pushToStream): pull the file from Drive -> upload to
// Stream -> wait for transcode -> request a downloadable MP4 -> wait for
// it -> save the CDN URL on the video row. Fire-and-forget; never throws.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const db = require('./db');
const { streamDriveFile } = require('./drive-source');

const API = 'https://api.cloudflare.com/client/v4';

function cfConfig() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_STREAM_TOKEN;
  if (!accountId || !token) return null;
  return { accountId, token };
}

function isStreamConfigured() {
  return Boolean(cfConfig());
}

async function cfFetch(pathSuffix, opts = {}) {
  const cfg = cfConfig();
  if (!cfg) throw new Error('Cloudflare Stream not configured');
  const res = await fetch(`${API}/accounts/${cfg.accountId}${pathSuffix}`, {
    ...opts,
    headers: { Authorization: `Bearer ${cfg.token}`, ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const msg =
      (json.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return json.result;
}

// Uploads a local video file to Stream. Returns the new video uid.
async function uploadToStream(localPath, name) {
  const cfg = cfConfig();
  if (!cfg) throw new Error('Cloudflare Stream not configured');
  const buf = await fs.promises.readFile(localPath);
  const form = new FormData();
  form.append('file', new Blob([buf]), name || 'clip.mp4');
  const res = await fetch(`${API}/accounts/${cfg.accountId}/stream`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const msg =
      (json.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare upload: ${msg}`);
  }
  return json.result.uid;
}

const getStreamVideo = (uid) => cfFetch(`/stream/${uid}`);
const requestMp4 = (uid) => cfFetch(`/stream/${uid}/downloads`, { method: 'POST' });
const getMp4 = (uid) => cfFetch(`/stream/${uid}/downloads`);

async function deleteFromStream(uid) {
  const cfg = cfConfig();
  if (!cfg || !uid) return;
  await fetch(`${API}/accounts/${cfg.accountId}/stream/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${cfg.token}` },
  }).catch(() => {});
}

async function pollUntil(fn, done, { tries = 60, delayMs = 5000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fn();
    if (done(r)) return r;
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new Error('timed out waiting for Cloudflare');
}

// Full pipeline for one clip. Fire-and-forget — logs failures, never throws.
async function pushToStream(videoId) {
  if (!isStreamConfigured()) return;
  let tmp;
  try {
    const video = await db.getVideo(videoId);
    if (!video || video.kind !== 'video' || !video.drive_file_id) return;
    if (video.stream_playback_url) return; // already on the CDN

    tmp = path.join(os.tmpdir(), `trj-cf-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    const driveRes = await streamDriveFile(video.drive_file_id);
    await pipeline(driveRes.data, fs.createWriteStream(tmp));

    const uid = await uploadToStream(tmp, video.filename);
    await db.setStreamInfo(videoId, { stream_uid: uid });

    // Wait for the transcode, then for the downloadable MP4.
    await pollUntil(() => getStreamVideo(uid), (v) => v && v.readyToStream);
    await requestMp4(uid);
    const dl = await pollUntil(
      () => getMp4(uid),
      (d) => d && d.default && d.default.status === 'ready',
    );

    await db.setStreamInfo(videoId, {
      stream_uid: uid,
      stream_playback_url: dl.default.url,
    });
    console.log(`[stream] ${video.filename} -> Cloudflare CDN ready`);
  } catch (e) {
    console.warn(`[stream] push failed for ${videoId}: ${e.message}`);
  } finally {
    if (tmp) fs.promises.unlink(tmp).catch(() => {});
  }
}

module.exports = {
  isStreamConfigured,
  uploadToStream,
  pushToStream,
  deleteFromStream,
};
