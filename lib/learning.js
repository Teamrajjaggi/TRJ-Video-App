const { getDb } = require('./db');

function rowToEntry(r) {
  if (!r) return null;
  return {
    id: r.id,
    videoId: r.video_id,
    title: r.title,
    tags: tryParse(r.tags, []),
    reviewer: tryParse(r.reviewer, null),
    comment: r.comment || '',
    kind: r.kind,
    hasReason: !!r.has_reason,
    at: r.at,
    consumed: !!r.consumed,
  };
}

function tryParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function readLearningQueue() {
  return getDb()
    .prepare('SELECT * FROM learning_queue ORDER BY id')
    .all()
    .map(rowToEntry);
}

function recordDislikeForLearning(video, review, reviewer) {
  const comment = (review.comment || '').trim();
  getDb()
    .prepare(
      `INSERT INTO learning_queue (video_id, title, tags, reviewer, comment, kind, has_reason, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      video.id,
      video.title,
      JSON.stringify(video.tags || []),
      JSON.stringify(reviewer ? { id: reviewer.id, username: reviewer.username } : null),
      comment,
      'dislike',
      comment ? 1 : 0,
      new Date().toISOString(),
    );
}

function recordCommentForLearning(video, review, reviewer) {
  getDb()
    .prepare(
      `INSERT INTO learning_queue (video_id, title, tags, reviewer, comment, kind, has_reason, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      video.id,
      video.title,
      JSON.stringify(video.tags || []),
      JSON.stringify(reviewer ? { id: reviewer.id, username: reviewer.username } : null),
      (review.comment || '').trim(),
      'comment',
      1,
      new Date().toISOString(),
    );
}

function markConsumed(videoIds) {
  if (!Array.isArray(videoIds) || videoIds.length === 0) return;
  const placeholders = videoIds.map(() => '?').join(',');
  getDb()
    .prepare(`UPDATE learning_queue SET consumed = 1 WHERE video_id IN (${placeholders})`)
    .run(...videoIds);
}

module.exports = {
  readLearningQueue,
  recordDislikeForLearning,
  recordCommentForLearning,
  markConsumed,
};
