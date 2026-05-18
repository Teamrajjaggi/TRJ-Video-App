// After a dedupe, Drive files whose DB row was removed become "orphans".
// The Pending-folder sync would re-import them, undoing the dedupe — so
// we ban their drive_file_ids. Banned ids are skipped by every sync.
//
//   node scripts/reconcile-orphans.js            preview only
//   node scripts/reconcile-orphans.js --apply    ban the orphan ids
require('dotenv').config();

const { listPendingFiles } = require('../lib/drive-source');
const db = require('../lib/db');

const APPLY = process.argv.includes('--apply');

async function main() {
  const files = await listPendingFiles();
  const orphans = [];
  for (const f of files) {
    const row = await db.getVideoByDriveFileId(f.id);
    if (!row) orphans.push(f);
  }

  console.log(
    `${files.length} files in Drive Pending — ${orphans.length} orphan(s) with no DB row:`,
  );
  for (const o of orphans) console.log(`  - ${o.name}`);

  if (!orphans.length) return;
  if (!APPLY) {
    console.log('\nRe-run with --apply to ban these ids (stops re-import).');
    return;
  }

  for (const o of orphans) {
    await db.banDriveId(o.id);
    console.log(`  banned ${o.name}`);
  }
  console.log(`\nDone — ${orphans.length} orphan id(s) banned.`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
