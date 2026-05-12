#!/usr/bin/env node
// Probe Higgsfield for valid model paths.
// Usage: node scripts/probe-higgsfield.js

require('dotenv').config();

const BASE = process.env.HIGGSFIELD_BASE_URL || 'https://platform.higgsfield.ai';
const keyId = process.env.HIGGSFIELD_KEY_ID || '';
const apiKey = process.env.HIGGSFIELD_API_KEY || '';
if (!keyId || !apiKey) {
  console.error('Missing HIGGSFIELD_KEY_ID / HIGGSFIELD_API_KEY in .env');
  process.exit(1);
}
const credOrder = process.env.HIGGSFIELD_CRED_ORDER || 'id-first';
const cred =
  credOrder === 'key-first' ? `${apiKey}:${keyId}` : `${keyId}:${apiKey}`;

const HEADERS = {
  Authorization: `Key ${cred}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Each item: { path, body, label }
const PROBES = [
  // ---- Image gen (Nanobanana) ----
  { path: 'nano-banana-pro', body: { prompt: 'ping' } },
  { path: 'nano-banana-2', body: { prompt: 'ping' } },
  { path: 'nano_banana_2', body: { prompt: 'ping' } },
  { path: 'nano_banana_pro', body: { prompt: 'ping' } },
  { path: 'google/nano-banana-pro', body: { prompt: 'ping' } },
  { path: 'google/nano-banana-2', body: { prompt: 'ping' } },
  { path: 'google/nano-banana-pro/text-to-image', body: { prompt: 'ping' } },
  { path: 'google/nano-banana-2/text-to-image', body: { prompt: 'ping' } },
  { path: 'nano-banana-pro/text-to-image', body: { prompt: 'ping' } },
  { path: 'nano-banana-2/text-to-image', body: { prompt: 'ping' } },
  // Seedream image gen (confirmed format in SDK README)
  { path: 'bytedance/seedream/v4/text-to-image', body: { prompt: 'ping' } },
  { path: 'seedream/v4/text-to-image', body: { prompt: 'ping' } },
  { path: 'seedream', body: { prompt: 'ping' } },

  // ---- Kling i2v variants (we know `kling` accepts input_image) ----
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
    label: 'kling (with input_image)',
  },
  {
    path: 'kling-2.5',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling-2.5-turbo',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling/v2.5',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling/v2.5-turbo',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling/image-to-video',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kuaishou/kling-2.5/image-to-video',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kuaishou/kling-2.5-turbo/image-to-video',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling-2.5/image-to-video',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
  {
    path: 'kling-2.5-turbo/image-to-video',
    body: { prompt: 'ping', input_image: 'https://example.com/x.png' },
  },
];

async function probe(item) {
  const url = `${BASE}/${item.path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(item.body),
    });
    const text = await res.text();
    return { item, status: res.status, snippet: text.slice(0, 240).replace(/\s+/g, ' ') };
  } catch (e) {
    return { item, status: 'ERR', snippet: e.message.slice(0, 200) };
  }
}

(async () => {
  console.log(`Probing ${BASE} with cred order=${credOrder}\n`);
  for (const item of PROBES) {
    const r = await probe(item);
    const label = item.label || item.path;
    console.log(`${String(r.status).padEnd(5)} ${label.padEnd(50)} ${r.snippet}`);
  }
})();
