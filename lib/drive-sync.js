// Sync videos from a Google Drive folder into the feed.
// Idempotent — only adds files we haven't ingested before, tracked by Drive
// file id in data/drive-sync.json.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { listDriveVideos, downloadDriveFile, isDriveConfigured } = require('./drive-source');
const { putObject, r2Configured } = require('./r2');

const VIDEOS_PATH = path.join(__dirname, '..', 'data', 'videos.json');
const STATE_PATH = path.join(__dirname, '..', 'data', 'drive-sync.json');

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function newVideoId() {
  return `vid_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function readState() {
  return readJson(STATE_PATH, { byDriveId: {} });
}

function writeState(state) {
  writeJson(STATE_PATH, state);
}

function titleFromFilename(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 120) || 'Untitled video';
}

async function syncFromDrive() {
  if (!isDriveConfigured()) {
    return { ok: false, error: 'Drive not configured (need GOOGLE_SERVICE_ACCOUNT_JSON|FILE + DRIVE_FOLDER_ID)' };
  }
  if (!r2Configured()) {
    return { ok: false, error: 'R2 not configured (need R2_* env vars)' };
  }

  const files = await listDriveVideos();
  const state = readState();
  const videos = readJson(VIDEOS_PATH, []);

  const added = [];
  const skipped = [];
  const errors = [];

  for (const f of files) {
    if (state.byDriveId[f.id]) {
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
      const entry = {
        id: videoId,
        title: titleFromFilename(f.name),
        description: '',
        src: result.url,
        poster: '',
        tags: ['drive-import'],
        prompt: '',
        postedAt: new Date().toISOString(),
        source: { kind: 'drive', driveId: f.id, originalName: f.name },
      };
      videos.push(entry);
      state.byDriveId[f.id] = {
        videoId,
        r2Key: result.key,
        r2Url: result.url,
        syncedAt: new Date().toISOString(),
      };
      added.push({ driveId: f.id, videoId, title: entry.title, url: result.url });
      writeJson(VIDEOS_PATH, videos);
      writeState(state);
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
