// Sync videos from a Google Drive folder into the feed.
// Idempotent — only adds files we haven't ingested before, tracked in the
// drive_sync table.

const crypto = require('crypto');

const { listDriveVideos, downloadDriveFile, isDriveConfigured } = require('./drive-source');
const { putObject, r2Configured } = require('./r2');
const { getDb } = require('./db');

function newVideoId() {
  return `vid_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function titleFromFilename(name) {
  return (
    String(name || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 120) || 'Untitled video'
  );
}

async function syncFromDrive() {
  if (!isDriveConfigured()) {
    return {
      ok: false,
      error: 'Drive not configured (need GOOGLE_SERVICE_ACCOUNT_JSON|FILE + DRIVE_FOLDER_ID)',
    };
  }
  if (!r2Configured()) {
    return { ok: false, error: 'R2 not configured (need R2_* env vars)' };
  }

  const files = await listDriveVideos();
  const db = getDb();
  const seen = new Set(
    db.prepare('SELECT drive_id FROM drive_sync').all().map((r) => r.drive_id),
  );

  const added = [];
  const skipped = [];
  const errors = [];

  const insertVideo = db.prepare(`
    INSERT INTO videos (id, title, description, src, poster, tags, prompt, posted_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSync = db.prepare(`
    INSERT INTO drive_sync (drive_id, video_id, r2_key, r2_url, synced_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const f of files) {
    if (seen.has(f.id)) {
      skipped.push({ driveId: f.id, name: f.name, reason: 'already synced' });
      continue;
    }
    try {
      console.log(`[drive-sync] downloading ${f.name} (${f.size || '?'} bytes)`);
      const buf = await downloadDriveFile(f.id);
      const ext = (f.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'mp4').toLowerCase();
      const key = `feed/${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${ext}`;
      const result = await putObject({
        key,
        body: buf,
        contentType: f.mimeType || 'video/mp4',
      });
      if (!result?.url) throw new Error('R2 upload returned no public URL');

      const videoId = newVideoId();
      const title = titleFromFilename(f.name);
      const now = new Date().toISOString();
      const source = { kind: 'drive', driveId: f.id, originalName: f.name };

      const tx = db.transaction(() => {
        insertVideo.run(
          videoId,
          title,
          '',
          result.url,
          '',
          JSON.stringify(['drive-import']),
          '',
          now,
          JSON.stringify(source),
        );
        insertSync.run(f.id, videoId, result.key, result.url, now);
      });
      tx();

      added.push({ driveId: f.id, videoId, title, url: result.url });
    } catch (e) {
      console.warn(`[drive-sync] failed on ${f.name}: ${e.message}`);
      errors.push({ driveId: f.id, name: f.name, error: e.message });
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
