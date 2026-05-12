const fs = require('fs');
const path = require('path');

const QUEUE_PATH = path.join(__dirname, '..', 'data', 'post-queue.json');

function readQueue() {
  if (!fs.existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeQueue(q) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2), 'utf8');
}

// Stub: on approval, queue the video for a future "post" step.
// The actual posting integration is intentionally not implemented yet.
function triggerPostWorkflow(video, review) {
  const queue = readQueue();
  const entry = {
    videoId: video.id,
    title: video.title,
    queuedAt: new Date().toISOString(),
    reviewComment: review.comment || '',
    status: 'pending_post',
  };
  queue.push(entry);
  writeQueue(queue);
  console.log(`[workflow] Queued for post: ${video.id} — ${video.title}`);
  return entry;
}

module.exports = { triggerPostWorkflow, readQueue, QUEUE_PATH };
