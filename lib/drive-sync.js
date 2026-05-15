// Scan the Pending Drive folder and register new files in Supabase.
// No file uploads here — the stream_url just points at Drive.
// Banned drive_file_ids are skipped so a rejected file never re-imports.

const { listPendingFiles, isDriveConfigured, kindFromMime } = require('./drive-source');
const db = require('./db');

function streamUrlFor(file) {
  // Public-ish Drive playback URL. In Phase 2 this will likely become a
  // signed/proxied URL served by this app, but for now the frontend can
  // hit Drive directly if the folder is shared.
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
}

async function syncFromDrive() {
  if (!isDriveConfigured()) {
    return {
      ok: false,
      error:
        'Drive not configured (need GOOGLE_SERVICE_ACCOUNT_JSON|FILE + DRIVE_PENDING_FOLDER_ID)',
    };
  }

  const files = await listPendingFiles();
  const added = [];
  const skipped = [];
  const errors = [];

  for (const f of files) {
    try {
      if (await db.isDriveIdBanned(f.id)) {
        skipped.push({ driveFileId: f.id, name: f.name, reason: 'banned' });
        continue;
      }
      const existing = await db.getVideoByDriveFileId(f.id);
      if (existing) {
        skipped.push({ driveFileId: f.id, name: f.name, reason: 'already imported' });
        continue;
      }
      const kind = kindFromMime(f.mimeType);
      if (!kind) {
        skipped.push({ driveFileId: f.id, name: f.name, reason: 'unsupported mime' });
        continue;
      }
      const row = await db.upsertVideoFromDrive({
        driveFileId: f.id,
        filename: f.name || 'untitled',
        mimeType: f.mimeType,
        kind,
        thumbnailUrl: f.thumbnailLink || null,
        streamUrl: streamUrlFor(f),
      });
      added.push({ driveFileId: f.id, videoId: row.id, name: f.name });
    } catch (e) {
      console.warn(`[drive-sync] failed on ${f.name}: ${e.message}`);
      errors.push({ driveFileId: f.id, name: f.name, error: e.message });
    }
  }

  return {
    ok: true,
    discovered: files.length,
    added: added.length,
    skipped: skipped.length,
    errors: errors.length,
    addedDetails: added,
    errorsDetails: errors,
  };
}

module.exports = { syncFromDrive };
