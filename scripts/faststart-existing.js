// One-off: fast-start every video already imported. Drive sync only
// processes NEW files, so clips imported before the fast-start change
// need this run once. Run: node scripts/faststart-existing.js
require('dotenv').config();
const db = require('../lib/db');
const { faststartDriveVideo } = require('../lib/drive-sync');

(async () => {
  db.init();
  const pending = await db.listVideos({ status: 'pending' });
  const approved = await db.listVideos({ status: 'approved' });
  const all = [...pending, ...approved].filter((v) => v.kind === 'video');
  console.log(`Fast-starting ${all.length} video(s)…\n`);
  for (const v of all) {
    process.stdout.write(`  ${v.filename} … `);
    try {
      await faststartDriveVideo(v.drive_file_id, v.mime_type);
      console.log('done');
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
  console.log('\nFinished.');
})().catch((e) => console.error('ERROR:', e.message));
