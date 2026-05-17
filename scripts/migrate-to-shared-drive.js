// One-off migration: move every clip out of the old My Drive folders into
// the new Shared Drive folders. File IDs are preserved by a move, so the
// Supabase rows that reference them keep working untouched.
//
// Run once, from the video-review directory:  node scripts/migrate-to-shared-drive.js
//
// The destination folder IDs are read from .env (DRIVE_*_FOLDER_ID), which
// must already point at the new Shared Drive folders.

require('dotenv').config();
const { getDriveClient } = require('../lib/drive-source');

// Old My Drive folders -> matching new Shared Drive env var.
const MIGRATIONS = [
  { name: 'Pending', from: '1MyuePNUh9UTW8KI8uHJVGU99XzX-5Fyw', toEnv: 'DRIVE_PENDING_FOLDER_ID' },
  { name: 'Approved', from: '1Z3ENtQI5-3bW0oeNquSGZU4qYiAH7MQI', toEnv: 'DRIVE_APPROVED_FOLDER_ID' },
  { name: 'Trash', from: '1Gkc5PTo8QhMXG0gWrOLTDsWav8q6JdSF', toEnv: 'DRIVE_TRASH_FOLDER_ID' },
  { name: 'Posted', from: '1oPx6BI_hb4OJL_GL5oR1GsxLDxPGp64Z', toEnv: 'DRIVE_POSTED_FOLDER_ID' },
];

async function listFolder(drive, folderId) {
  const all = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, parents)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files || []) all.push(f);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return all;
}

async function main() {
  const client = getDriveClient();
  if (!client) {
    console.error('Drive not configured (need GOOGLE_SERVICE_ACCOUNT_* in .env).');
    process.exit(1);
  }
  const drive = client.drive;

  let moved = 0;
  let failed = 0;

  for (const m of MIGRATIONS) {
    const dest = process.env[m.toEnv];
    if (!dest) {
      console.warn(`! ${m.name}: ${m.toEnv} not set — skipping`);
      continue;
    }
    if (dest === m.from) {
      console.warn(`! ${m.name}: source and destination are the same — skipping`);
      continue;
    }

    let files;
    try {
      files = await listFolder(drive, m.from);
    } catch (e) {
      console.warn(`! ${m.name}: could not read old folder — ${e.message}`);
      continue;
    }
    console.log(`\n${m.name}: ${files.length} item(s) to move`);

    for (const f of files) {
      try {
        await drive.files.update({
          fileId: f.id,
          addParents: dest,
          removeParents: (f.parents || []).join(',') || undefined,
          fields: 'id, parents',
          supportsAllDrives: true,
        });
        moved++;
        console.log(`  moved  ${f.name}`);
      } catch (e) {
        failed++;
        console.warn(`  FAILED ${f.name} — ${e.message}`);
      }
    }
  }

  console.log(`\nDone. ${moved} moved, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
