// Vault for approved (liked) videos.
//
// Primary destination is Cloudflare R2 (S3-compatible). The actual video
// file is mirrored to R2 alongside a metadata JSON so we have a stable
// public URL we can hand to social-posting integrations later.
//
// Falls back to a local mirror in data/saved-vault/ when R2 isn't
// configured, so the rest of the loop keeps working during setup.
//
// Required env vars to enable R2:
//   R2_ACCOUNT_ID         Cloudflare account id
//   R2_ACCESS_KEY_ID      R2 API token access key
//   R2_SECRET_ACCESS_KEY  R2 API token secret
//   R2_BUCKET             bucket name
//   R2_PUBLIC_BASE_URL    public base url for the bucket (R2.dev or custom domain)

const fs = require('fs');
const path = require('path');

const LOCAL_VAULT_DIR = path.join(__dirname, '..', 'data', 'saved-vault');

let s3Client = null;
let s3Tried = false;

function ensureLocalVaultDir() {
  fs.mkdirSync(LOCAL_VAULT_DIR, { recursive: true });
}

function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

function getS3() {
  if (s3Client || s3Tried) return s3Client;
  s3Tried = true;
  if (!r2Configured()) {
    console.warn(
      '[vault] Cloudflare R2 not configured (need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET). Falling back to local vault.',
    );
    return null;
  }
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    return s3Client;
  } catch (e) {
    console.warn('[vault] failed to init R2 client:', e.message);
    return null;
  }
}

function publicUrlFor(key) {
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/${key.replace(/^\//, '')}`;
}

async function putObject({ key, body, contentType }) {
  const client = getS3();
  if (!client) return null;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { key, url: publicUrlFor(key) };
}

async function mirrorVideoFile(video) {
  if (!video?.src) return null;
  if (!getS3()) return null;
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
  if (getS3()) {
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
