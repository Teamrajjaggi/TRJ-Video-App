// Video trimming via the bundled ffmpeg binary (ffmpeg-static).
// Image cropping is done in the browser (canvas) — no server work needed.

const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Trim inputPath to [startSeconds, endSeconds] and write outputPath.
// Re-encodes (libx264/aac) so the cut is frame-accurate rather than
// snapping to the nearest keyframe. Resolves with outputPath.
function trimVideo(inputPath, outputPath, startSeconds, endSeconds) {
  return new Promise((resolve, reject) => {
    const start = Math.max(0, Number(startSeconds) || 0);
    const end = Number(endSeconds) || 0;
    const duration = end - start;
    if (!(duration > 0)) {
      reject(new Error('trim range must have end > start'));
      return;
    }
    const args = [
      '-y',
      '-ss', String(start),
      '-i', inputPath,
      '-t', String(duration),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ];
    execFile(ffmpegPath, args, { timeout: 180000 }, (err) => {
      if (err) {
        reject(new Error(`ffmpeg trim failed: ${err.message}`));
        return;
      }
      resolve(outputPath);
    });
  });
}

module.exports = { trimVideo };
