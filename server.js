require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const {
  issueSessionCookie,
  clearSessionCookie,
  readSession,
  verifyPassword,
  constantTimeEqual,
} = require('./lib/auth');
const {
  findById,
  findByUsername,
  createUser,
  updateUsername,
  publicUser,
  bootstrapAdmin,
} = require('./lib/users');
const { rebuildClaudeMd, CLAUDE_MD_PATH, readClaudeMd } = require('./lib/claude-md');
const { saveLikedVideoToVault } = require('./lib/vault');
const {
  recordDislikeForLearning,
  recordCommentForLearning,
  readLearningQueue,
} = require('./lib/learning');
const { publishVideo, generateOneInternal } = require('./lib/workflow');

const VIDEOS_PATH = path.join(__dirname, 'data', 'videos.json');
const REVIEWS_PATH = path.join(__dirname, 'data', 'reviews.json');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- auth middleware ----------
function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'auth required' });
  const user = findById(session.uid);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'session invalid' });
  }
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
    next();
  });
}
// Bearer-token auth for the n8n / external workflow API surface.
function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return res.status(503).json({ error: 'ADMIN_API_TOKEN not set' });
  const header = req.headers.authorization || '';
  const got = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!constantTimeEqual(got, expected)) return res.status(401).json({ error: 'bad token' });
  next();
}

// ---------- static gate ----------
const PROTECTED_PAGES = new Set(['/', '/index.html', '/profile', '/profile.html']);
app.use((req, res, next) => {
  if (PROTECTED_PAGES.has(req.path)) {
    if (!readSession(req)) return res.redirect('/login.html');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- account routes ----------
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password, inviteCode } = req.body || {};
    const expectedInvite = process.env.INVITE_CODE;
    if (!expectedInvite) return res.status(503).json({ error: 'INVITE_CODE not set on server' });
    if (!constantTimeEqual(String(inviteCode || ''), expectedInvite)) {
      return res.status(403).json({ error: 'invalid invite code' });
    }
    const user = await createUser({ username, password, role: 'user' });
    issueSessionCookie(res, user);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = findByUsername(username);
  if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  issueSessionCookie(res, user);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/me', requireAuth, async (req, res) => {
  // The only profile field a user can edit is their username.
  try {
    const { username } = req.body || {};
    const updated = await updateUsername(req.user.id, username);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- feed routes ----------
app.get('/api/videos', requireAuth, (req, res) => {
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
      myReview: (byVideo[v.id] || []).find((r) => r.userId === req.user.id) || null,
    })),
  );
});

async function handleReview(req, res, { kindOverride } = {}) {
  const { videoId, verdict: vIn, comment } = req.body || {};
  const verdict = kindOverride || vIn;
  if (!videoId || !['like', 'dislike', 'comment'].includes(verdict)) {
    return res.status(400).json({ error: 'videoId + verdict (like|dislike|comment) required' });
  }
  const videos = readJson(VIDEOS_PATH, []);
  const video = videos.find((v) => v.id === videoId);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const reviews = readJson(REVIEWS_PATH, []);
  const review = {
    id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    userId: req.user.id,
    username: req.user.username,
    verdict,
    comment: typeof comment === 'string' ? comment : '',
    at: new Date().toISOString(),
  };
  reviews.push(review);
  writeJson(REVIEWS_PATH, reviews);

  rebuildClaudeMd(reviews, videos);

  let vault = null;
  if (verdict === 'like') {
    try {
      vault = await saveLikedVideoToVault(video, review, req.user);
    } catch (e) {
      console.warn('[review] vault save failed:', e.message);
    }
  } else if (verdict === 'dislike') {
    recordDislikeForLearning(video, review, req.user);
  } else if (verdict === 'comment') {
    recordCommentForLearning(video, review, req.user);
  }

  res.json({ ok: true, review, vault });
}

app.post('/api/review', requireAuth, (req, res) => handleReview(req, res));
app.post('/api/comment', requireAuth, (req, res) =>
  handleReview(req, res, { kindOverride: 'comment' }),
);

// ---------- exposed CLAUDE.md ----------
app.get('/api/preferences', requireAuth, (req, res) => {
  res.type('text/markdown').send(readClaudeMd());
});

// ---------- admin / machine API (Bearer token) ----------
app.get('/api/admin/context', requireAdminToken, (req, res) => {
  res.type('text/markdown').send(readClaudeMd());
});

app.get('/api/admin/learning-queue', requireAdminToken, (req, res) => {
  res.json(readLearningQueue());
});

app.post('/api/admin/publish', requireAdminToken, (req, res) => {
  try {
    const video = publishVideo(req.body || {});
    res.json({ ok: true, video });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- admin actions (session-based, the "Generate" button) ----------
app.post('/api/admin/generate-one', requireAdmin, async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) || '';
    const result = await generateOneInternal(prompt);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- startup ----------
async function start() {
  const { user, bootstrappedPassword } = await bootstrapAdmin();
  if (bootstrappedPassword) {
    console.log('\n========================================================');
    console.log('  Admin account "claude" bootstrapped.');
    console.log(`  username: ${user.username}`);
    console.log(`  password: ${bootstrappedPassword}`);
    console.log('  Save this now — it will not be printed again.');
    console.log('========================================================\n');
  }
  if (!process.env.INVITE_CODE) {
    console.warn(
      '[startup] INVITE_CODE is not set — /api/signup will reject all requests until you set it.',
    );
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Video review portal running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
