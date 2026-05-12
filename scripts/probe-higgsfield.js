#!/usr/bin/env node
// Probe Higgsfield to find a valid model "application" path.
//
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

// Format: "METHOD path [body]"
const PROBES = [
  // Known-working from official README — confirms our auth + format is right
  'POST bytedance/seedream/v4/text-to-image',
  // Discovery: POST to plural routes (we saw they exist via 405 on GET)
  'POST models',
  'POST applications',
  'POST v1/models',
  'POST v1/applications',
  // CLI-style underscored model ids (the CLI uses `kling3_0`)
  'POST kling3_0',
  'POST seedance_v1',
  'POST higgsfield-dop',
  // Single-segment vendor paths
  'POST kling',
  'POST seedance',
  'POST hailuo',
  'POST veo',
  'POST sora',
  // /apps namespace
  'POST apps/kling-3.0/text-to-video',
  'POST apps/kling/v3.0/text-to-video',
  // model-id with /text-to-video suffix at root
  'POST kling-3.0/text-to-video',
  'POST kling-3/text-to-video',
  'POST seedance-v1/text-to-video',
  'POST hailuo-02/text-to-video',
  'POST veo-3/text-to-video',
  'POST sora-2/text-to-video',
  // platform-style: vendor/model/task
  'POST kuaishou/kling-3.0/text-to-video',
  'POST bytedance/seedance-v1/text-to-video',
  'POST minimax/hailuo-02/text-to-video',
  // No version number
  'POST kuaishou/kling/text-to-video',
  'POST bytedance/seedance/text-to-video',
];

async function probe(spec) {
  const [method, ...rest] = spec.split(' ');
  const path = rest.join(' ');
  const url = `${BASE}/${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: HEADERS,
      body: method === 'POST' ? JSON.stringify({ prompt: 'ping', duration: 5 }) : undefined,
    });
    const text = await res.text();
    return { spec, status: res.status, snippet: text.slice(0, 240).replace(/\s+/g, ' ') };
  } catch (e) {
    return { spec, status: 'ERR', snippet: e.message.slice(0, 200) };
  }
}

(async () => {
  console.log(`Probing ${BASE} with cred order=${credOrder}\n`);
  for (const spec of PROBES) {
    const r = await probe(spec);
    console.log(`${String(r.status).padEnd(5)} ${spec.padEnd(50)} ${r.snippet}`);
  }
})();
