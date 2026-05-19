// Fast-start remuxing for Drive videos. A clip uploaded through the app
// is remuxed in place so its moov atom is at the front — playback then
// starts without downloading the whole file first.
//
// (The old Pending-folder scanner lived here too; it was removed once all
// content started coming in through the app's upload page.)

const os = require('os');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

const { streamDriveFile, updateFileContent } = require('./drive-source');
const { faststartVideo } = require('./edit-media');

// Remux a Drive video in place so its moov atom is at the front. One-time
// cost per clip; afterwards playback starts without downloading it all.
async function faststartDriveVideo(fileId, mimeType) {
  const stamp = Date.now();
  const inPath = path.join(os.tmpdir(), `trj-fs-in-${stamp}.mp4`);
  const outPath = path.join(os.tmpdir(), `trj-fs-out-${stamp}.mp4`);
  try {
    const res = await streamDriveFile(fileId);
    await pipeline(res.data, fs.createWriteStream(inPath));
    await faststartVideo(inPath, outPath);
    await updateFileContent(fileId, outPath, mimeType || 'video/mp4');
  } finally {
    fs.promises.unlink(inPath).catch(() => {});
    fs.promises.unlink(outPath).catch(() => {});
  }
}

module.exports = { faststartDriveVideo };
