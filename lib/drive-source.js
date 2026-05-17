// Google Drive source for the four-folder pipeline.
//
// Auth: Google Cloud service account.
//   1) Create a service account in Google Cloud Console
//   2) Enable the Google Drive API on the project
//   3) Download the service account JSON key
//   4) Create four folders in Drive: Pending, Approved, Trash, Posted.
//      Share all four with the service account's client_email (Editor).
//   5) Paste the four folder ids into the DRIVE_*_FOLDER_ID env vars.
//
// Env:
//   GOOGLE_SERVICE_ACCOUNT_JSON  inline service-account JSON
//   GOOGLE_SERVICE_ACCOUNT_FILE  OR a path to the JSON file
//   DRIVE_PENDING_FOLDER_ID      folder we scan for new uploads
//   DRIVE_APPROVED_FOLDER_ID     destination on approve
//   DRIVE_TRASH_FOLDER_ID        destination on reject
//   DRIVE_POSTED_FOLDER_ID       destination after n8n auto-post (Phase 4)

const fs = require('fs');

function readServiceAccount() {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (e) {
      console.warn('[drive] GOOGLE_SERVICE_ACCOUNT_JSON not valid JSON:', e.message);
      return null;
    }
  }
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (file && fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn('[drive] failed to read GOOGLE_SERVICE_ACCOUNT_FILE:', e.message);
      return null;
    }
  }
  return null;
}

let cachedClient = null;
function getDriveClient() {
  if (cachedClient) return cachedClient;
  const sa = readServiceAccount();
  if (!sa) return null;
  try {
    const { google } = require('googleapis');
    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      // Drive write access is required for moves and trash purge.
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    cachedClient = { drive: google.drive({ version: 'v3', auth: jwt }) };
    return cachedClient;
  } catch (e) {
    console.warn('[drive] failed to init Drive client:', e.message);
    return null;
  }
}

function pendingFolderId() {
  return process.env.DRIVE_PENDING_FOLDER_ID;
}

function isDriveConfigured() {
  return Boolean(getDriveClient() && pendingFolderId());
}

// Lists files in the Pending folder. The VA puts both videos and images
// here; the kind field is derived from mimeType.
async function listPendingFiles() {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const folderId = pendingFolderId();
  if (!folderId) throw new Error('DRIVE_PENDING_FOLDER_ID not set');

  const all = [];
  let pageToken = undefined;
  do {
    const res = await client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (mimeType contains 'video/' or mimeType contains 'image/')`,
      fields:
        'nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink, webContentLink, webViewLink)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files || []) all.push(f);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return all;
}

function kindFromMime(mimeType) {
  if (!mimeType) return null;
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

// Streams a Drive file's raw bytes through this server. The browser can't
// fetch private Drive files directly — only the service account can — so
// the app proxies them. Forwards an HTTP Range header so <video> can seek.
// Returns the raw googleapis response: res.data is a Node stream, and
// res.status / res.headers carry the status and content metadata.
async function streamDriveFile(fileId, rangeHeader) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const headers = {};
  if (rangeHeader) headers.Range = rangeHeader;
  return client.drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream', headers },
  );
}

// Uploads a local file into a Drive folder. Returns { id, name }.
async function uploadFileToFolder(localPath, name, mimeType, folderId) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  if (!folderId) throw new Error('uploadFileToFolder: destination folder id required');
  const res = await client.drive.files.create({
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(localPath) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return res.data;
}

// Renames a Drive file in place — same file id, new display name.
async function renameFile(fileId, newName) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const res = await client.drive.files.update({
    fileId,
    requestBody: { name: newName },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return res.data;
}

// Replaces a Drive file's content in place — keeps the same file id.
async function updateFileContent(fileId, localPath, mimeType) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const res = await client.drive.files.update({
    fileId,
    media: { mimeType, body: fs.createReadStream(localPath) },
    fields: 'id, name',
    supportsAllDrives: true,
  });
  return res.data;
}

module.exports = {
  getDriveClient,
  isDriveConfigured,
  listPendingFiles,
  pendingFolderId,
  kindFromMime,
  streamDriveFile,
  uploadFileToFolder,
  updateFileContent,
};
