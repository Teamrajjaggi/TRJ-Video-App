#!/usr/bin/env node
// Probe Higgsfield for valid model_id strings.
// Higgsfield's model_id pattern is `<org>/<model>/<variant>`, per official docs.
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

const TEXT_BODY = { prompt: 'ping', aspect_ratio: '9:16', resolution: '720p' };
const I2V_BODY = {
  prompt: 'ping',
  input_image: { url: 'https://example.com/x.png' },
  aspect_ratio: '9:16',
};

const PROBES = [
  // ---- Higgsfield's own models ----
  { id: 'higgsfield-ai/soul/standard', body: TEXT_BODY },
  { id: 'higgsfield-ai/soul/pro', body: TEXT_BODY },
  { id: 'higgsfield-ai/soul-pro/standard', body: TEXT_BODY },
  { id: 'higgsfield-ai/dop/standard', body: TEXT_BODY },
  { id: 'higgsfield-ai/dop/pro', body: TEXT_BODY },

  // ---- Nano Banana (Google image gen) ----
  { id: 'higgsfield-ai/nano-banana/standard', body: TEXT_BODY },
  { id: 'higgsfield-ai/nano-banana/pro', body: TEXT_BODY },
  { id: 'higgsfield-ai/nano-banana-pro/standard', body: TEXT_BODY },
  { id: 'higgsfield-ai/nano-banana-2/standard', body: TEXT_BODY },
  { id: 'google/nano-banana/pro', body: TEXT_BODY },
  { id: 'google/nano-banana/standard', body: TEXT_BODY },
  { id: 'google/nano-banana-pro/standard', body: TEXT_BODY },
  { id: 'google/nano-banana-2/standard', body: TEXT_BODY },

  // ---- Seedream / Bytedance image gen ----
  { id: 'bytedance/seedream/standard', body: TEXT_BODY },
  { id: 'bytedance/seedream/v4', body: TEXT_BODY },
  { id: 'bytedance/seedream/pro', body: TEXT_BODY },
  { id: 'higgsfield-ai/seedream/v4', body: TEXT_BODY },

  // ---- Flux / others ----
  { id: 'higgsfield-ai/flux/pro', body: TEXT_BODY },
  { id: 'higgsfield-ai/flux/dev', body: TEXT_BODY },
  { id: 'black-forest-labs/flux/pro', body: TEXT_BODY },

  // ---- Kling image-to-video (we know /kling works) ----
  { id: 'higgsfield-ai/kling/standard', body: I2V_BODY },
  { id: 'higgsfield-ai/kling/pro', body: I2V_BODY },
  { id: 'higgsfield-ai/kling/turbo', body: I2V_BODY },
  { id: 'higgsfield-ai/kling/2.5-turbo', body: I2V_BODY },
  { id: 'higgsfield-ai/kling/v2.5-turbo', body: I2V_BODY },
  { id: 'higgsfield-ai/kling-2.5/turbo', body: I2V_BODY },
  { id: 'higgsfield-ai/kling-2.5-turbo/standard', body: I2V_BODY },
  { id: 'kuaishou/kling/2.5-turbo', body: I2V_BODY },
  { id: 'kuaishou/kling/v2.5-turbo', body: I2V_BODY },
  { id: 'kuaishou/kling-2.5-turbo/standard', body: I2V_BODY },

  // Also try variations of bare `kling` with different input_image shapes
  {
    id: 'kling',
    body: { prompt: 'ping', input_image: { url: 'https://example.com/x.png' } },
    label: 'kling + input_image:{url}',
  },
  {
    id: 'kling',
    body: { prompt: 'ping', input_image: { image_url: 'https://example.com/x.png' } },
    label: 'kling + input_image:{image_url}',
  },
];

async function probe(item) {
  const url = `${BASE}/${item.id}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(item.body),
    });
    const text = await res.text();
    return { item, status: res.status, snippet: text.slice(0, 260).replace(/\s+/g, ' ') };
  } catch (e) {
    return { item, status: 'ERR', snippet: e.message.slice(0, 200) };
  }
}

(async () => {
  console.log(`Probing ${BASE} with cred order=${credOrder}\n`);
  for (const item of PROBES) {
    const r = await probe(item);
    const label = item.label || item.id;
    console.log(`${String(r.status).padEnd(5)} ${label.padEnd(50)} ${r.snippet}`);
  }
})();
