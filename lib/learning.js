const fs = require('fs');
const path = require('path');

const LEARNING_PATH = path.join(__dirname, '..', 'data', 'learning-queue.json');

function readLearningQueue() {
  if (!fs.existsSync(LEARNING_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEARNING_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeLearningQueue(q) {
  fs.mkdirSync(path.dirname(LEARNING_PATH), { recursive: true });
  fs.writeFileSync(LEARNING_PATH, JSON.stringify(q, null, 2), 'utf8');
}

function recordDislikeForLearning(video, review, reviewer) {
  const queue = readLearningQueue();
  queue.push({
    videoId: video.id,
    title: video.title,
    tags: video.tags || [],
    reviewer: reviewer ? { id: reviewer.id, username: reviewer.username } : null,
    comment: (review.comment || '').trim(),
    hasReason: Boolean((review.comment || '').trim()),
    at: new Date().toISOString(),
    consumed: false,
  });
  writeLearningQueue(queue);
}

function recordCommentForLearning(video, review, reviewer) {
  const queue = readLearningQueue();
  queue.push({
    videoId: video.id,
    title: video.title,
    tags: video.tags || [],
    reviewer: reviewer ? { id: reviewer.id, username: reviewer.username } : null,
    comment: (review.comment || '').trim(),
    kind: 'comment',
    at: new Date().toISOString(),
    consumed: false,
  });
  writeLearningQueue(queue);
}

function markConsumed(ids) {
  const queue = readLearningQueue();
  const set = new Set(ids);
  for (const item of queue) {
    if (set.has(item.videoId)) item.consumed = true;
  }
  writeLearningQueue(queue);
}

module.exports = {
  readLearningQueue,
  recordDislikeForLearning,
  recordCommentForLearning,
  markConsumed,
  LEARNING_PATH,
};
