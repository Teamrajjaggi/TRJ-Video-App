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
  // ---- Image gen: simpler nano-banana variants ----
  { path: 'nano-banana', body: { prompt: 'ping' } },
  { path: 'nanobanana', body: { prompt: 'ping' } },
  { path: 'nanobanana-pro', body: { prompt: 'ping' } },
  { path: 'nanobanana-2', body: { prompt: 'ping' } },
  { path: 'nano_banana', body: { prompt: 'ping' } },
  { path: 'banana', body: { prompt: 'ping' } },
  { path: 'banana-pro', body: { prompt: 'ping' } },
  // Nanobanana with version segments
  { path: 'nano-banana/v1', body: { prompt: 'ping' } },
  { path: 'nano-banana/v2', body: { prompt: 'ping' } },
  { path: 'nano-banana/v3', body: { prompt: 'ping' } },
  { path: 'nano-banana/pro', body: { prompt: 'ping' } },
  // Other image gen possibilities
  { path: 'flux', body: { prompt: 'ping' } },
  { path: 'flux-pro', body: { prompt: 'ping' } },
  { path: 'flux-1.1-pro', body: { prompt: 'ping' } },
  { path: 'flux-dev', body: { prompt: 'ping' } },
  { path: 'soul', body: { prompt: 'ping' } },
  { path: 'higgsfield-soul', body: { prompt: 'ping' } },
  { path: 'imagen', body: { prompt: 'ping' } },
  { path: 'imagen-3', body: { prompt: 'ping' } },
  // Generic
  { path: 'text-to-image', body: { prompt: 'ping' } },
  { path: 'v1/text-to-image', body: { prompt: 'ping' } },

  // ---- Kling i2v: discover the right input_image shape ----
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: { url: 'https://example.com/x.png' } },
    label: 'kling { input_image: { url } }',
  },
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: { image: 'https://example.com/x.png' } },
    label: 'kling { input_image: { image } }',
  },
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: { source_url: 'https://example.com/x.png' } },
    label: 'kling { input_image: { source_url } }',
  },
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: { id: 'placeholder' } },
    label: 'kling { input_image: { id } }',
  },
  {
    path: 'kling',
    body: { prompt: 'ping', input_image: { type: 'image_url', url: 'https://example.com/x.png' } },
    label: 'kling { input_image: { type, url } }',
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
    console.log(`${String(r.status).padEnd(5)} ${label.padEnd(55)} ${r.snippet}`);
  }
})();
