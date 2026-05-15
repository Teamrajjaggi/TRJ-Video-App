// One-off: diagnose why videos are slow to load.
// Run: node scripts/diag-speed.js
require('dotenv').config();
const db = require('../lib/db');
const { streamDriveFile } = require('../lib/drive-source');

(async () => {
  db.init();
  const vids = await db.listVideos({ status: 'pending' });
  if (!vids.length) {
    console.log('No videos in the DB to test.');
    return;
  }
  const v = vids[0];
  console.log(`Testing: ${v.filename}\n`);

  // 1. Full download timing from Drive.
  const t0 = Date.now();
  const res = await streamDriveFile(v.drive_file_id);
  const chunks = [];
  for await (const c of res.data) chunks.push(c);
  const buf = Buffer.concat(chunks);
  const ms = Date.now() - t0;
  const mb = buf.length / 1024 / 1024;
  console.log(
    `Drive download: ${mb.toFixed(2)} MB in ${ms} ms  (${((buf.length / 1024 / ms) * 1000).toFixed(0)} KB/s)`,
  );

  // 2. Fast-start check: moov atom must come before mdat for instant playback.
  const moov = buf.indexOf('moov');
  const mdat = buf.indexOf('mdat');
  console.log(`moov atom @ byte ${moov}   mdat atom @ byte ${mdat}`);
  if (moov > -1 && mdat > -1) {
    console.log(
      moov < mdat
        ? 'FAST-START OK — playback can begin while downloading'
        : 'NOT fast-start — browser must download the WHOLE file before it plays',
    );
  }

  // 3. Range support — needed for seeking + progressive load.
  const r = await streamDriveFile(v.drive_file_id, 'bytes=0-1023');
  console.log(
    `\nRange request -> HTTP ${r.status}  content-range: ${r.headers['content-range'] || '(none)'}`,
  );
})().catch((e) => console.error('ERROR:', e.message));
