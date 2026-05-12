#!/usr/bin/env node
// Probe Higgsfield to find a valid model "application" path.
//
// Usage: node scripts/probe-higgsfield.js
//
// Reads HIGGSFIELD_KEY_ID + HIGGSFIELD_API_KEY from .env, then POSTs a
// tiny prompt to a list of candidate model paths. Prints the status code
// for each so you can pick a working one. Anything that returns 200/202
// (or even 400 — a real model rejecting the body) is valid; 404 means
// the model doesn't exist on the platform.

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

const PATHS = [
  // Kling family
  'kling/v3.0/text-to-video',
  'kling-v3.0/text-to-video',
  'kling/3.0/text-to-video',
  'kling3.0/text-to-video',
  'kling/v2.5/text-to-video',
  'kling/v2.1/text-to-video',
  'kling/v2.0/text-to-video',
  'kling/v1.6/text-to-video',
  'kuaishou/kling/v3.0/text-to-video',
  'kuaishou/kling-3.0/text-to-video',
  'kuaishou/kling/v2.0/text-to-video',
  // Higgsfield in-house
  'higgsfield/dop/text-to-video',
  'higgsfield/dop/v1/text-to-video',
  'higgsfield/soul/text-to-video',
  // Other vendors
  'minimax/hailuo/text-to-video',
  'minimax/hailuo-02/text-to-video',
  'bytedance/seedance/v1/text-to-video',
  'bytedance/seedance/text-to-video',
  'google/veo/v3/text-to-video',
  'google/veo3/text-to-video',
  'openai/sora2/text-to-video',
  'openai/sora/text-to-video',
  'alibaba/wan/v2.5/text-to-video',
  // Also try a likely "list models" route to see what's available
  '__list_models_probe__:GET:/models',
  '__list_models_probe__:GET:/applications',
  '__list_models_probe__:GET:/v1/models',
];

async function probe(item) {
  let method = 'POST';
  let url;
  let body = JSON.stringify({ prompt: 'ping', duration: 5 });
  if (item.startsWith('__list_models_probe__')) {
    const [, m, path] = item.split(':');
    method = m;
    url = `${BASE}${path}`;
    body = undefined;
  } else {
    url = `${BASE}/${item}`;
  }
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Key ${cred}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });
    const text = await res.text();
    return { item, status: res.status, snippet: text.slice(0, 160).replace(/\s+/g, ' ') };
  } catch (e) {
    return { item, status: 'ERR', snippet: e.message.slice(0, 160) };
  }
}

(async () => {
  console.log(`Probing ${BASE} with cred order=${credOrder}\n`);
  for (const p of PATHS) {
    const r = await probe(p);
    const label = r.item.replace('__list_models_probe__:', '');
    console.log(`${String(r.status).padEnd(5)} ${label.padEnd(50)} ${r.snippet}`);
  }
})();
