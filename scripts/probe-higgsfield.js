#!/usr/bin/env node
// Probe Higgsfield specifically for Nano Banana / Gemini / Imagen image models.
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

const BODY = { prompt: 'ping', aspect_ratio: '9:16', resolution: '720p' };

const IDS = [
  // Nano Banana via Google org (new spellings)
  'google/nano-banana/standard',
  'google/nano-banana/pro',
  'google/nano-banana-pro/standard',
  'google/nano-banana-1/standard',
  'google/nano-banana-2/standard',
  'google/nano-banana-3/standard',
  // Nano Banana under higgsfield-ai
  'higgsfield-ai/nano-banana/standard',
  'higgsfield-ai/nano-banana/pro',
  'higgsfield-ai/nano-banana-pro/standard',
  // Gemini direct
  'google/gemini/flash-image',
  'google/gemini-flash-image/standard',
  'google/gemini-2.5-flash-image/standard',
  'google/gemini-image/standard',
  // Imagen
  'google/imagen/standard',
  'google/imagen-3/standard',
  'google/imagen-3.0/standard',
  'google/imagen/pro',
  'higgsfield-ai/imagen-3/standard',
  // No-org single segment
  'nano-banana',
  'nano-banana-pro',
  'imagen-3',
  'gemini-flash-image',
];

async function probe(id) {
  const url = `${BASE}/${id}`;
  try {
    const res = await fetch(url, { method: 'POST', headers: HEADERS, body: JSON.stringify(BODY) });
    const text = await res.text();
    return { id, status: res.status, snippet: text.slice(0, 220).replace(/\s+/g, ' ') };
  } catch (e) {
    return { id, status: 'ERR', snippet: e.message.slice(0, 200) };
  }
}

(async () => {
  console.log(`Probing ${BASE} for Nano Banana / Gemini / Imagen\n`);
  for (const id of IDS) {
    const r = await probe(id);
    console.log(`${String(r.status).padEnd(5)} ${id.padEnd(50)} ${r.snippet}`);
  }
})();
