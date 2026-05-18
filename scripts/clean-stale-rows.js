// Deletes videos rows whose Drive file is in an OLD My Drive folder, was
// trashed, or no longer exists — leftovers from the Shared Drive switch.
// Re-classifies live before deleting. Run: node scripts/clean-stale-rows.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getDriveClient } = require('../lib/drive-source');

const OLD = new Set([
  '1MyuePNUh9UTW8KI8uHJVGU99XzX-5Fyw',
  '1Z3ENtQI5-3bW0oeNquSGZU4qYiAH7MQI',
  '1Gkc5PTo8QhMXG0gWrOLTDsWav8q6JdSF',
  '1oPx6BI_hb4OJL_GL5oR1GsxLDxPGp64Z',
]);

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const drive = getDriveClient().drive;

  const { data: rows, error } = await sb
    .from('videos')
    .select('id, drive_file_id, filename, status');
  if (error) throw new Error(error.message);

  const stale = [];
  for (const r of rows) {
    try {
      const meta = await drive.files.get({
        fileId: r.drive_file_id,
        fields: 'parents, trashed',
        supportsAllDrives: true,
      });
      const parents = meta.data.parents || [];
      if (meta.data.trashed || parents.some((p) => OLD.has(p))) stale.push(r);
    } catch (e) {
      if (e.code === 404) stale.push(r); // file deleted
      else console.warn(`  ? ${r.filename}: ${e.message} (left alone)`);
    }
  }

  if (!stale.length) {
    console.log('No stale rows — nothing to delete.');
    return;
  }
  console.log(`Deleting ${stale.length} stale row(s):`);
  stale.forEach((r) => console.log(`  - [${r.status}] ${r.filename}`));

  const { error: delErr } = await sb
    .from('videos')
    .delete()
    .in('id', stale.map((r) => r.id));
  if (delErr) throw new Error(delErr.message);

  console.log(`\nDone. ${stale.length} row(s) removed.`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
