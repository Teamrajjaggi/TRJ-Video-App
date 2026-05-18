// Storage housekeeping: rejected clips that have sat past the retention
// window are removed — both the Drive file and the Supabase row — so the
// dashboard and cloud storage don't fill up with discarded content.
//
// TRASH_RETENTION_DAYS controls the window (default 14). Set it to 0 to
// disable auto-deletion entirely.

const { getDriveClient } = require('./drive-source');
const { deleteFromStream } = require('./cloudflare-stream');
const db = require('./db');

function retentionDays() {
  return parseInt(process.env.TRASH_RETENTION_DAYS ?? '14', 10);
}

// Permanently deletes a Drive file. Hard delete needs Manager rights on a
// Shared Drive; if that's denied, fall back to trashing it (Google empties
// Shared Drive trash automatically after 30 days).
async function removeDriveFile(fileId) {
  const client = getDriveClient();
  if (!client) return;
  const drive = client.drive;
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (e) {
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    });
  }
}

// Deletes rejected clips older than the retention window. Best-effort per
// clip: a Drive failure still removes the DB row so it leaves the platform.
async function purgeOldRejected() {
  const days = retentionDays();
  if (!days || days < 1) return { ok: false, error: 'retention disabled' };

  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const rows = await db.listRejectedBefore(cutoff);
  let removed = 0;

  for (const v of rows) {
    try {
      if (v.drive_file_id) {
        try {
          await removeDriveFile(v.drive_file_id);
        } catch (e) {
          console.warn(`[purge] drive delete ${v.filename}: ${e.message}`);
        }
      }
      if (v.stream_uid) {
        try {
          await deleteFromStream(v.stream_uid);
        } catch (e) {
          console.warn(`[purge] stream delete ${v.filename}: ${e.message}`);
        }
      }
      await db.deleteVideo(v.id);
      removed += 1;
    } catch (e) {
      console.warn(`[purge] failed on ${v.filename}: ${e.message}`);
    }
  }
  return { ok: true, scanned: rows.length, removed };
}

module.exports = { purgeOldRejected, retentionDays };
