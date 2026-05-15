// One-off: exercise the full Gemini caption pipeline on one video.
// Run: node scripts/test-caption.js
require('dotenv').config();
const db = require('../lib/db');
const { generateCaption } = require('../lib/caption');

(async () => {
  db.init();
  const videos = await db.listVideos({ status: 'pending' });
  if (!videos.length) {
    console.log('No videos in the DB to test with.');
    return;
  }
  const v = videos[0];
  console.log(`Testing caption for: ${v.filename}`);
  console.log('(downloading from Drive, uploading to Gemini, generating…)');
  const t = Date.now();
  const result = await generateCaption(v);
  console.log(`\nDone in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
  console.log('CAPTION :', result.caption);
  console.log('HASHTAGS:', result.hashtags.map((h) => '#' + h).join(' '));
})().catch((e) => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
