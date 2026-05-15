// Approval / rejection side-effects on Drive. The DB status flip lives in
// server.js — this module owns the file move into the right folder.

const { moveFile } = require('./drive-move');

function pendingFolderId() {
  return process.env.DRIVE_PENDING_FOLDER_ID;
}
function approvedFolderId() {
  return process.env.DRIVE_APPROVED_FOLDER_ID;
}
function trashFolderId() {
  return process.env.DRIVE_TRASH_FOLDER_ID;
}
function postedFolderId() {
  return process.env.DRIVE_POSTED_FOLDER_ID;
}

async function approveVideo(video) {
  if (!video?.drive_file_id) return null;
  const dest = approvedFolderId();
  if (!dest) throw new Error('DRIVE_APPROVED_FOLDER_ID not set');
  return moveFile(video.drive_file_id, dest);
}

async function rejectVideo(video) {
  if (!video?.drive_file_id) return null;
  const dest = trashFolderId();
  if (!dest) throw new Error('DRIVE_TRASH_FOLDER_ID not set');
  return moveFile(video.drive_file_id, dest);
}

module.exports = {
  approveVideo,
  rejectVideo,
  pendingFolderId,
  approvedFolderId,
  trashFolderId,
  postedFolderId,
};
