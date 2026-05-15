// Helper: move a Drive file between folders by changing parents in-place.
// `files.update` with addParents/removeParents avoids a copy.

const { getDriveClient } = require('./drive-source');

async function moveFile(fileId, toFolderId) {
  const client = getDriveClient();
  if (!client) throw new Error('Google Drive not configured');
  if (!toFolderId) throw new Error('moveFile: destination folder id required');

  const meta = await client.drive.files.get({
    fileId,
    fields: 'id, parents',
    supportsAllDrives: true,
  });
  const previousParents = (meta.data.parents || []).join(',');

  const res = await client.drive.files.update({
    fileId,
    addParents: toFolderId,
    removeParents: previousParents || undefined,
    fields: 'id, parents',
    supportsAllDrives: true,
  });
  return { fileId, parents: res.data.parents || [] };
}

module.exports = { moveFile };
