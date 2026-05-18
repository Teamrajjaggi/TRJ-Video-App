// Dedupe: removes duplicate video rows (the same clip imported or
// uploaded more than once). Keeps one per clip — the most-progressed,
// then oldest — and deletes the rest along with their Cloudflare Stream
// copy and Drive file.
//
//   node scripts/dedupe-videos.js            preview only (no deletes)
//   node scripts/dedupe-videos.js --apply    actually delete
require('dotenv').config();

const APPLY = process.argv.includes('--apply');

const { createClient } = require('@supabase/supabase-js');
const db = require('../lib/db');
const { deleteFromStream } = require('../lib/cloudflare-stream');

// Dedupe key: drop the extension and a trailing " (N)" copy suffix that
// Drive / repeated uploads append. Same key => same clip.
function dedupeKey(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
    .toLowerCase();
}

// Keep the furthest-along status; ties broken by oldest.
const STATUS_RANK = { posted: 0, approved: 1, rejected: 2, pending: 3 };

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const { data: rows, error } = await sb
    .from('videos')
    .select('id, filename, status, drive_file_id, stream_uid, created_at');
  if (error) throw new Error(error.message);

  const groups = new Map();
  for (const r of rows) {
    const k = dedupeKey(r.filename);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const toDelete = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => {
      const s = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
      if (s !== 0) return s;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    const keep = group[0];
    console.log(
      `keep [${keep.status}] ${keep.filename}  (dropping ${group.length - 1} dup)`,
    );
    toDelete.push(...group.slice(1));
  }

  if (!toDelete.length) {
    console.log('No duplicates found.');
    return;
  }

  if (!APPLY) {
    console.log(`\nPREVIEW — ${toDelete.length} duplicate row(s) would be removed:`);
    for (const v of toDelete) console.log(`  - [${v.status}] ${v.filename}`);
    console.log('\nRe-run with --apply to delete them.');
    return;
  }

  console.log(`\nRemoving ${toDelete.length} duplicate row(s)...`);
  for (const v of toDelete) {
    // Ban the drive id FIRST — that's what makes the dedupe stick. The
    // duplicate file stays in Drive, but every future sync skips it, so
    // the row is never re-created.
    if (v.drive_file_id) {
      try {
        await db.banDriveId(v.drive_file_id);
      } catch (e) {
        console.warn(`  ban ${v.filename}: ${e.message}`);
      }
    }
    if (v.stream_uid) {
      try {
        await deleteFromStream(v.stream_uid);
      } catch (e) {
        console.warn(`  stream ${v.filename}: ${e.message}`);
      }
    }
    await db.deleteVideo(v.id);
    console.log(`  removed ${v.filename}`);
  }
  console.log('\nDedupe complete — duplicate drive ids banned, will not re-import.');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
