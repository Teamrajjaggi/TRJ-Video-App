const fs = require('fs');
const path = require('path');
const express = require('express');

const { rebuildPreferences, PREFS_PATH } = require('./lib/preferences');
const { triggerPostWorkflow, readQueue } = require('./lib/workflow');

const VIDEOS_PATH = path.join(__dirname, 'data', 'videos.json');
const REVIEWS_PATH = path.join(__dirname, 'data', 'reviews.json');

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/videos', (req, res) => {
  const videos = readJson(VIDEOS_PATH, []);
  const reviews = readJson(REVIEWS_PATH, []);
  const byVideo = {};
  for (const r of reviews) {
    if (!byVideo[r.videoId]) byVideo[r.videoId] = [];
    byVideo[r.videoId].push(r);
  }
  res.json(
    videos.map((v) => ({
      ...v,
      reviews: byVideo[v.id] || [],
    })),
  );
});

app.post('/api/review', (req, res) => {
  const { videoId, verdict, comment } = req.body || {};
  if (!videoId || !['like', 'dislike'].includes(verdict)) {
    return res.status(400).json({ error: 'videoId and verdict (like|dislike) are required' });
  }

  const videos = readJson(VIDEOS_PATH, []);
  const video = videos.find((v) => v.id === videoId);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const reviews = readJson(REVIEWS_PATH, []);
  const review = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    verdict,
    comment: typeof comment === 'string' ? comment : '',
    at: new Date().toISOString(),
  };
  reviews.push(review);
  writeJson(REVIEWS_PATH, reviews);

  rebuildPreferences(reviews, videos);

  let queued = null;
  if (verdict === 'like') {
    queued = triggerPostWorkflow(video, review);
  }

  res.json({ ok: true, review, queued });
});

app.post('/api/comment', (req, res) => {
  const { videoId, comment } = req.body || {};
  if (!videoId || !comment || !comment.trim()) {
    return res.status(400).json({ error: 'videoId and non-empty comment are required' });
  }
  const videos = readJson(VIDEOS_PATH, []);
  const video = videos.find((v) => v.id === videoId);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const reviews = readJson(REVIEWS_PATH, []);
  const review = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    verdict: 'comment',
    comment: comment.trim(),
    at: new Date().toISOString(),
  };
  reviews.push(review);
  writeJson(REVIEWS_PATH, reviews);
  rebuildPreferences(reviews, videos);

  res.json({ ok: true, review });
});

app.get('/api/preferences', (req, res) => {
  if (!fs.existsSync(PREFS_PATH)) {
    return res.type('text/markdown').send('# Reviewer Preferences\n\n_(no reviews yet)_\n');
  }
  res.type('text/markdown').send(fs.readFileSync(PREFS_PATH, 'utf8'));
});

app.get('/api/post-queue', (req, res) => {
  res.json(readQueue());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video review portal running on http://localhost:${PORT}`);
});
