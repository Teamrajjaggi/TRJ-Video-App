// Shared Cloudflare R2 (S3-compatible) client.
// Used by both lib/vault.js (liked-video archive) and lib/video-gen.js
// (staging Gemini-generated images so Higgsfield DoP can fetch them).

let s3Client = null;
let s3Tried = false;

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
      '[r2] not configured (need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).',
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
    console.warn('[r2] failed to init client:', e.message);
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

async function deleteObject({ key }) {
  const client = getS3();
  if (!client) return false;
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  await client.send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
  );
  return true;
}

// If `url` lives under our R2 public base, return its bucket key. Else null.
function r2KeyForUrl(url) {
  const base = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!base || !url) return null;
  if (!url.startsWith(base + '/')) return null;
  return url.slice(base.length + 1);
}

module.exports = {
  getS3,
  putObject,
  deleteObject,
  r2KeyForUrl,
  publicUrlFor,
  r2Configured,
};
