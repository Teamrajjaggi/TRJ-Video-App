const fs = require('fs');
const path = require('path');

const LOCAL_VAULT_DIR = path.join(__dirname, '..', 'data', 'saved-vault');
let driveClient = null;
let driveAttempted = false;

function ensureLocalVaultDir() {
  fs.mkdirSync(LOCAL_VAULT_DIR, { recursive: true });
}

function readServiceAccount() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (e) {
      console.warn('[vault] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON:', e.message);
      return null;
    }
  }
  if (file && fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn('[vault] failed to read GOOGLE_SERVICE_ACCOUNT_FILE:', e.message);
      return null;
    }
  }
  return null;
}

function getDriveClient() {
  if (driveClient || driveAttempted) return driveClient;
  driveAttempted = true;
  const folderId = process.env.VAULT_DRIVE_FOLDER_ID;
  const sa = readServiceAccount();
  if (!folderId || !sa) {
    console.warn(
      '[vault] Google Drive not configured (need GOOGLE_SERVICE_ACCOUNT_JSON|FILE + VAULT_DRIVE_FOLDER_ID). Falling back to local vault.',
    );
    return null;
  }
  try {
    const { google } = require('googleapis');
    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    driveClient = { drive: google.drive({ version: 'v3', auth: jwt }), folderId };
    return driveClient;
  } catch (e) {
    console.warn('[vault] failed to init Google Drive client:', e.message);
    return null;
  }
}

async function uploadToDrive({ name, contents }) {
  const client = getDriveClient();
  if (!client) return null;
  const res = await client.drive.files.create({
    requestBody: {
      name,
      parents: [client.folderId],
      mimeType: 'application/json',
    },
    media: {
      mimeType: 'application/json',
      body: contents,
    },
    fields: 'id, webViewLink',
  });
  return { id: res.data.id, webViewLink: res.data.webViewLink };
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
  const filename = `${video.id}__${Date.now()}.json`;
  const localPath = path.join(LOCAL_VAULT_DIR, filename);
  const contents = JSON.stringify(record, null, 2);
  fs.writeFileSync(localPath, contents, 'utf8');

  let drive = null;
  try {
    drive = await uploadToDrive({ name: filename, contents });
  } catch (e) {
    console.warn('[vault] Drive upload failed:', e.message);
  }
  return { localPath, drive };
}

module.exports = { saveLikedVideoToVault, LOCAL_VAULT_DIR };
