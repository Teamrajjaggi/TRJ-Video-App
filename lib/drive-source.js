// Google Drive source: list and download videos from a shared folder.
//
// Auth model: Google Cloud service account.
//   1) Create a service account in Google Cloud Console
//   2) Enable the Google Drive API on the project
//   3) Download the service account JSON key
//   4) In Google Drive, share your videos folder with the service account's
//      client_email (the JSON has it) — Viewer access is enough
//   5) Copy the folder id from the Drive URL (the long string after /folders/)
//
// Env vars:
//   GOOGLE_SERVICE_ACCOUNT_JSON   inline service-account JSON
//   GOOGLE_SERVICE_ACCOUNT_FILE   OR a path to the JSON file
//   DRIVE_FOLDER_ID               id of the folder containing the videos

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

function getDriveClient() {
  const sa = readServiceAccount();
  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!sa || !folderId) {
    return null;
  }
  try {
    const { google } = require('googleapis');
    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return { drive: google.drive({ version: 'v3', auth: jwt }), folderId };
  } catch (e) {
    console.warn('[drive] failed to init Drive client:', e.message);
    return null;
  }
}

function isDriveConfigured() {
  return Boolean(getDriveClient());
}

async function listDriveVideos() {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const { drive, folderId } = client;
  const all = [];
  let pageToken = undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and mimeType contains 'video/'`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files || []) all.push(f);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return all;
}

async function downloadDriveFile(fileId) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  const res = await client.drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data);
}

module.exports = {
  isDriveConfigured,
  listDriveVideos,
  downloadDriveFile,
};
