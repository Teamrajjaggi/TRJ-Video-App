#!/usr/bin/env node
// List Gemini models available to your GEMINI_API_KEY.
// Usage: node scripts/probe-gemini.js

require('dotenv').config();

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

(async () => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}&pageSize=200`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    console.error(`ListModels -> ${res.status}: ${text.slice(0, 400)}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  const all = data.models || [];

  const isImageCandidate = (m) => {
    const id = (m.name || '').toLowerCase();
    const desc = ((m.description || '') + ' ' + (m.displayName || '')).toLowerCase();
    if (/imagen/.test(id)) return true;
    if (/nano-banana/.test(id) || /nano_banana/.test(id) || /banana/.test(id)) return true;
    if (/image/.test(id) && /generate/.test(id)) return true;
    if (/image/.test(desc) && /(generate|generation)/.test(desc)) return true;
    return false;
  };

  const supportsContent = (m) =>
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes('generateContent');

  const imageModels = all.filter(isImageCandidate);

  console.log(`\nFound ${all.length} models total.`);
  console.log(`Image-capable candidates (${imageModels.length}):\n`);
  for (const m of imageModels) {
    const id = (m.name || '').replace(/^models\//, '');
    const methods = (m.supportedGenerationMethods || []).join(',') || '(none)';
    console.log(`  ${id.padEnd(50)} methods=${methods}`);
    if (m.description) {
      console.log(`    ${(m.description || '').slice(0, 140)}`);
    }
  }

  console.log(
    '\nPick whichever supports generateContent and looks like Nano Banana / image gen,',
  );
  console.log('then set in .env:');
  console.log('  GEMINI_IMAGE_MODEL=<model-id>\n');
})();
