// One-off: copies every video not yet on Cloudflare Stream to the CDN.
// Safe to re-run — clips already on Stream are skipped.
// Run from the video-review directory:  node scripts/backfill-stream.js
require('dotenv').config();

const db = require('../lib/db');
const { pushToStream, isStreamConfigured } = require('../lib/cloudflare-stream');

async function main() {
  if (!isStreamConfigured()) {
    console.error('Cloudflare Stream not configured (CF_ACCOUNT_ID / CF_STREAM_TOKEN).');
    process.exit(1);
  }
  const rows = await db.listVideosNeedingStream();
  if (!rows.length) {
    console.log('All clips are already on Cloudflare Stream.');
    return;
  }
  console.log(`Copying ${rows.length} clip(s) to Cloudflare Stream — this takes a minute or two each...`);
  // pushToStream is best-effort and never throws; run them together.
  await Promise.all(rows.map((v) => pushToStream(v.id)));
  console.log('Backfill complete.');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
