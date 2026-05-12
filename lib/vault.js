// Vault for approved (liked) videos.
// The actual video file is mirrored to R2 alongside a metadata JSON so we
// have a stable public URL ready for social-posting integrations later.
// Also writes a local audit copy in data/saved-vault/.

const fs = require('fs');
const path = require('path');

const { putObject, r2Configured } = require('./r2');

const LOCAL_VAULT_DIR = path.join(__dirname, '..', 'data', 'saved-vault');

function ensureLocalVaultDir() {
  fs.mkdirSync(LOCAL_VAULT_DIR, { recursive: true });
}

async function mirrorVideoFile(video) {
  if (!video?.src) return null;
  if (!r2Configured()) return null;
  const key = `videos/${video.id}.mp4`;
  try {
    const res = await fetch(video.src);
    if (!res.ok) throw new Error(`fetch ${video.src} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'video/mp4';
    return await putObject({ key, body: buf, contentType });
  } catch (e) {
    console.warn('[vault] video mirror failed:', e.message);
    return null;
  }
}

async function saveLikedVideoToVault(video, review, reviewer) {
  ensureLocalVaultDir();
  const record = {
    videoId: video.id,
    title: video.title,
    description: video.description,
    src: video.src,
    poster: video.poster,
    tags: video.tags,
    likedBy: reviewer ? { id: reviewer.id, username: reviewer.username } : null,
    comment: review.comment || '',
    savedAt: new Date().toISOString(),
  };

  // Always keep a local audit trail.
  const filename = `${video.id}__${Date.now()}.json`;
  const localPath = path.join(LOCAL_VAULT_DIR, filename);
  fs.writeFileSync(localPath, JSON.stringify(record, null, 2), 'utf8');

  let video_r2 = null;
  let metadata_r2 = null;
  if (r2Configured()) {
    video_r2 = await mirrorVideoFile(video);
    if (video_r2) record.r2 = { videoUrl: video_r2.url, videoKey: video_r2.key };
    try {
      metadata_r2 = await putObject({
        key: `metadata/${video.id}.json`,
        body: JSON.stringify(record, null, 2),
        contentType: 'application/json',
      });
    } catch (e) {
      console.warn('[vault] metadata upload failed:', e.message);
    }
  }

  return { localPath, video_r2, metadata_r2 };
}

module.exports = { saveLikedVideoToVault, LOCAL_VAULT_DIR };
