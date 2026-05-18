// Diagnostic: classify every videos row by where its Drive file lives.
// Read-only — deletes nothing. Run: node scripts/diag-stale-rows.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { getDriveClient } = require('../lib/drive-source');

const OLD = {
  '1MyuePNUh9UTW8KI8uHJVGU99XzX-5Fyw': 'OLD Pending',
  '1Z3ENtQI5-3bW0oeNquSGZU4qYiAH7MQI': 'OLD Approved',
  '1Gkc5PTo8QhMXG0gWrOLTDsWav8q6JdSF': 'OLD Trash',
  '1oPx6BI_hb4OJL_GL5oR1GsxLDxPGp64Z': 'OLD Posted',
};
const NEW = {
  [process.env.DRIVE_PENDING_FOLDER_ID]: 'NEW Pending',
  [process.env.DRIVE_APPROVED_FOLDER_ID]: 'NEW Approved',
  [process.env.DRIVE_TRASH_FOLDER_ID]: 'NEW Trash',
  [process.env.DRIVE_POSTED_FOLDER_ID]: 'NEW Posted',
};

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const drive = getDriveClient().drive;

  const { data: rows, error } = await sb
    .from('videos')
    .select('id, drive_file_id, filename, status, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  console.log(`${rows.length} videos rows in Supabase\n`);
  const stale = [];

  for (const r of rows) {
    let where = 'UNKNOWN';
    try {
      const meta = await drive.files.get({
        fileId: r.drive_file_id,
        fields: 'id, parents, trashed',
        supportsAllDrives: true,
      });
      const parents = meta.data.parents || [];
      if (meta.data.trashed) where = 'TRASHED';
      else {
        const labels = parents.map((p) => OLD[p] || NEW[p] || `other:${p}`);
        where = labels.join(', ') || 'no-parent';
      }
    } catch (e) {
      where = e.code === 404 ? 'FILE DELETED' : `ERROR: ${e.message}`;
    }
    const isStale =
      where.includes('OLD') ||
      where === 'FILE DELETED' ||
      where === 'TRASHED';
    if (isStale) stale.push(r);
    console.log(
      `${isStale ? 'STALE ' : '  ok  '} [${r.status}] ${r.filename}  ->  ${where}`,
    );
  }

  console.log(`\n${stale.length} stale row(s) (old folder / deleted / trashed).`);
  if (stale.length) {
    console.log('IDs:', stale.map((r) => r.id).join(','));
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
