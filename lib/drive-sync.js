// Scan the Pending Drive folder and register new files in Supabase.
// New videos are remuxed in place to "fast-start" so they play in the
// browser without a full download first.
// Banned drive_file_ids are skipped so a rejected file never re-imports.

const os = require('os');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

const {
  listPendingFiles,
  isDriveConfigured,
  kindFromMime,
  streamDriveFile,
  updateFileContent,
} = require('./drive-source');
const { faststartVideo } = require('./edit-media');
const db = require('./db');

function streamUrlFor(file) {
  // Unused by the current frontend (it plays via /api/videos/:id/stream),
  // kept for the row's stream_url column.
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
}

// Remux a Drive video in place so its moov atom is at the front. One-time
// cost per clip; afterwards playback starts without downloading it all.
async function faststartDriveVideo(fileId, mimeType) {
  const stamp = Date.now();
  const inPath = path.join(os.tmpdir(), `trj-fs-in-${stamp}.mp4`);
  const outPath = path.join(os.tmpdir(), `trj-fs-out-${stamp}.mp4`);
  try {
    const res = await streamDriveFile(fileId);
    await pipeline(res.data, fs.createWriteStream(inPath));
    await faststartVideo(inPath, outPath);
    await updateFileContent(fileId, outPath, mimeType || 'video/mp4');
  } finally {
    fs.promises.unlink(inPath).catch(() => {});
    fs.promises.unlink(outPath).catch(() => {});
  }
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
      // Remux videos to fast-start so the feed loads quickly. Best-effort:
      // a failure here just means that clip stays slow, not a sync failure.
      if (kind === 'video') {
        try {
          await faststartDriveVideo(f.id, f.mimeType);
        } catch (e) {
          console.warn(`[drive-sync] fast-start skipped for ${f.name}: ${e.message}`);
        }
      }
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

module.exports = { syncFromDrive, faststartDriveVideo };
