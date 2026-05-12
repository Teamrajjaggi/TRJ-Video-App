require('dotenv').config();

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
const { rebuildClaudeMd, readClaudeMd } = require('./lib/claude-md');
const { saveLikedVideoToVault } = require('./lib/vault');
const {
  recordDislikeForLearning,
  recordCommentForLearning,
  readLearningQueue,
} = require('./lib/learning');
const { publishVideo, generateOneInternal } = require('./lib/workflow');
const { composePrompt } = require('./lib/prompt');
const {
  pickPlan,
  composeImagePrompt,
  composeMotionPrompt,
  titleFor,
  tagsFor,
  descriptionFor,
} = require('./lib/playbook');
const { putObject, deleteObject, r2KeyForUrl, r2Configured } = require('./lib/r2');
const { syncFromDrive } = require('./lib/drive-sync');
const { getDb } = require('./lib/db');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(cookieParser());

function tryParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

function rowToVideo(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    src: r.src,
    poster: r.poster,
    tags: tryParse(r.tags, []),
    prompt: r.prompt,
    postedAt: r.posted_at,
    source: tryParse(r.source, {}),
  };
}
function rowToReview(r) {
  if (!r) return null;
  return {
    id: r.id,
    videoId: r.video_id,
    userId: r.user_id,
    username: r.username,
    verdict: r.verdict,
    comment: r.comment,
    at: r.at,
  };
}

function listVideos() {
  return getDb()
    .prepare('SELECT * FROM videos ORDER BY posted_at')
    .all()
    .map(rowToVideo);
}
function listReviews() {
  return getDb()
    .prepare('SELECT * FROM reviews ORDER BY at')
    .all()
    .map(rowToReview);
}
function getVideoById(id) {
  return rowToVideo(getDb().prepare('SELECT * FROM videos WHERE id = ?').get(id));
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
function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return res.status(503).json({ error: 'ADMIN_API_TOKEN not set' });
  const header = req.headers.authorization || '';
  const got = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!constantTimeEqual(got, expected)) return res.status(401).json({ error: 'bad token' });
  next();
}
function requireAdminOrToken(req, res, next) {
  const session = readSession(req);
  if (session) {
    const user = findById(session.uid);
    if (user && user.role === 'admin') {
      req.user = user;
      return next();
    }
  }
  const expected = process.env.ADMIN_API_TOKEN;
  const header = req.headers.authorization || '';
  const got = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (expected && constantTimeEqual(got, expected)) return next();
  return res.status(401).json({ error: 'admin required' });
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
  try {
    const { username } = req.body || {};
    const updated = await updateUsername(req.user.id, username);
    res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- feed ----------
app.get('/api/videos', requireAuth, (req, res) => {
  const videos = listVideos();
  const reviews = listReviews();
  const byVideo = {};
  for (const r of reviews) {
    if (!byVideo[r.videoId]) byVideo[r.videoId] = [];
    byVideo[r.videoId].push(r);
  }
  res.json(
    videos.map((v) => {
      const all = byVideo[v.id] || [];
      const mine = all.filter((r) => r.userId === req.user.id);
      return {
        ...v,
        reviews: all,
        myVerdict:
          mine.find((r) => r.verdict === 'like' || r.verdict === 'dislike') || null,
        myComment: mine.find((r) => r.verdict === 'comment') || null,
      };
    }),
  );
});

// Each user gets at most one verdict (like/dislike) and one comment per video.
// Submitting the same verdict again toggles it off.
async function handleReview(req, res, { kindOverride } = {}) {
  const { videoId, verdict: vIn, comment } = req.body || {};
  const verdict = kindOverride || vIn;
  if (!videoId || !['like', 'dislike', 'comment'].includes(verdict)) {
    return res.status(400).json({ error: 'videoId + verdict (like|dislike|comment) required' });
  }
  const video = getVideoById(videoId);
  if (!video) return res.status(404).json({ error: 'video not found' });

  const db = getDb();
  const userId = req.user.id;
  const username = req.user.username;
  const text = typeof comment === 'string' ? comment.trim() : '';
  const newId = () => `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  let action = 'added';
  let review = null;
  let vault = null;

  if (verdict === 'comment') {
    const existingRow = db
      .prepare(
        "SELECT * FROM reviews WHERE user_id = ? AND video_id = ? AND verdict = 'comment'",
      )
      .get(userId, videoId);
    const existing = rowToReview(existingRow);

    if (!text && existing) {
      db.prepare('DELETE FROM reviews WHERE id = ?').run(existing.id);
      action = 'removed';
    } else if (!text) {
      return res.status(400).json({ error: 'comment is empty' });
    } else if (existing) {
      const at = new Date().toISOString();
      db.prepare('UPDATE reviews SET comment = ?, at = ?, username = ? WHERE id = ?').run(
        text,
        at,
        username,
        existing.id,
      );
      review = {
        id: existing.id,
        videoId,
        userId,
        username,
        verdict: 'comment',
        comment: text,
        at,
      };
      action = 'updated';
      recordCommentForLearning(video, review, req.user);
    } else {
      const id = newId();
      const at = new Date().toISOString();
      db.prepare(
        'INSERT INTO reviews (id, video_id, user_id, username, verdict, comment, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, videoId, userId, username, 'comment', text, at);
      review = { id, videoId, userId, username, verdict: 'comment', comment: text, at };
      action = 'added';
      recordCommentForLearning(video, review, req.user);
    }
  } else {
    // like / dislike — one verdict slot per (userId, videoId)
    const existingRow = db
      .prepare(
        "SELECT * FROM reviews WHERE user_id = ? AND video_id = ? AND verdict IN ('like', 'dislike')",
      )
      .get(userId, videoId);
    const existing = rowToReview(existingRow);

    if (existing && existing.verdict === verdict && !text) {
      db.prepare('DELETE FROM reviews WHERE id = ?').run(existing.id);
      action = 'removed';
    } else if (existing) {
      const at = new Date().toISOString();
      db.prepare(
        'UPDATE reviews SET verdict = ?, comment = ?, at = ?, username = ? WHERE id = ?',
      ).run(verdict, text, at, username, existing.id);
      review = { id: existing.id, videoId, userId, username, verdict, comment: text, at };
      action = 'updated';
      if (verdict === 'like') {
        try {
          vault = await saveLikedVideoToVault(video, review, req.user);
        } catch (e) {
          console.warn('[review] vault save failed:', e.message);
        }
      } else if (verdict === 'dislike') {
        recordDislikeForLearning(video, review, req.user);
      }
    } else {
      const id = newId();
      const at = new Date().toISOString();
      db.prepare(
        'INSERT INTO reviews (id, video_id, user_id, username, verdict, comment, at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, videoId, userId, username, verdict, text, at);
      review = { id, videoId, userId, username, verdict, comment: text, at };
      action = 'added';
      if (verdict === 'like') {
        try {
          vault = await saveLikedVideoToVault(video, review, req.user);
        } catch (e) {
          console.warn('[review] vault save failed:', e.message);
        }
      } else if (verdict === 'dislike') {
        recordDislikeForLearning(video, review, req.user);
      }
    }
  }

  rebuildClaudeMd(listReviews(), listVideos());

  res.json({ ok: true, action, review, vault });
}

app.post('/api/review', requireAuth, (req, res) => handleReview(req, res));
app.post('/api/comment', requireAuth, (req, res) =>
  handleReview(req, res, { kindOverride: 'comment' }),
);

// ---------- exposed CLAUDE.md ----------
app.get('/api/preferences', requireAuth, (req, res) => {
  const md = readClaudeMd();
  const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CLAUDE.md · Video Review</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; background: #000; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    header { display: flex; align-items: center; gap: 12px;
      padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.08);
      position: sticky; top: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); }
    header a { color: #fff; text-decoration: none;
      border: 1px solid rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 999px; font-size: 0.85rem; }
    header a:hover { background: rgba(255,255,255,0.08); }
    header h1 { margin: 0; font-size: 1rem; color: rgba(255,255,255,0.7); font-weight: 500; }
    pre { margin: 0; padding: 24px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.85rem; line-height: 1.55; white-space: pre-wrap; word-wrap: break-word; }
  </style>
</head>
<body>
  <header>
    <a href="/">← back to feed</a>
    <h1>CLAUDE.md (auto-generated from reviews)</h1>
  </header>
  <pre>${escaped}</pre>
</body>
</html>`);
});

// ---------- admin / machine API (Bearer token) ----------
app.get('/api/admin/context', requireAdminToken, (req, res) => {
  res.type('text/markdown').send(readClaudeMd());
});

app.get('/api/admin/learning-queue', requireAdminToken, (req, res) => {
  res.json(readLearningQueue());
});

app.get('/api/admin/next-prompt', requireAdminToken, (req, res) => {
  const composed = composePrompt(readClaudeMd());
  res.json(composed);
});

app.post('/api/admin/publish', requireAdminToken, (req, res) => {
  try {
    const video = publishVideo(req.body || {});
    res.json({ ok: true, video });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/admin/plan', requireAdminToken, (req, res) => {
  const plan = pickPlan();
  const imagePrompt = composeImagePrompt(plan);
  const motionPrompt = composeMotionPrompt(plan);
  const referenceUrls = [
    process.env.SUBJECT_A_REFERENCE,
    process.env.SUBJECT_B_REFERENCE,
  ].filter(Boolean);
  res.json({
    plan,
    imagePrompt,
    motionPrompt,
    title: titleFor(plan),
    description: descriptionFor(plan),
    tags: tagsFor(plan),
    referenceUrls,
  });
});

app.post('/api/admin/stage-image', requireAdminToken, async (req, res) => {
  try {
    const { data, mimeType } = req.body || {};
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'body.data (base64 string) required' });
    }
    if (!r2Configured()) {
      return res.status(503).json({ error: 'R2 not configured' });
    }
    const ext = (mimeType || '').includes('png')
      ? 'png'
      : (mimeType || '').includes('webp')
        ? 'webp'
        : 'jpg';
    const key = `staging/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const buf = Buffer.from(data, 'base64');
    const result = await putObject({ key, body: buf, contentType: mimeType || 'image/png' });
    if (!result?.url) {
      return res
        .status(503)
        .json({ error: 'staging upload failed (R2_PUBLIC_BASE_URL not set?)' });
    }
    res.json({ ok: true, key: result.key, url: result.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- admin actions (admin session OR bearer token) ----------
app.post('/api/admin/generate-one', requireAdminOrToken, async (req, res) => {
  try {
    const prompt = (req.body && req.body.prompt) || '';
    const result = await generateOneInternal(prompt);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/sync-drive', requireAdminOrToken, async (req, res) => {
  try {
    const result = await syncFromDrive();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/videos/:id', requireAdminOrToken, async (req, res) => {
  try {
    const videoId = req.params.id;
    const db = getDb();
    const video = getVideoById(videoId);
    if (!video) return res.status(404).json({ error: 'video not found' });

    const reviewsRemoved = db
      .prepare('SELECT COUNT(*) as n FROM reviews WHERE video_id = ?')
      .get(videoId).n;
    // ON DELETE CASCADE cleans up reviews automatically.
    db.prepare('DELETE FROM videos WHERE id = ?').run(videoId);

    let r2Removed = false;
    let r2Error = null;
    const key = r2KeyForUrl(video.src);
    if (key && r2Configured()) {
      try {
        await deleteObject({ key });
        r2Removed = true;
      } catch (e) {
        r2Error = e.message;
        console.warn('[delete] R2 cleanup failed:', e.message);
      }
    }

    rebuildClaudeMd(listReviews(), listVideos());

    res.json({
      ok: true,
      deleted: { id: video.id, title: video.title },
      r2Removed,
      r2Error,
      reviewsRemoved,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-sync Drive on boot + on an interval so the admin doesn't have to
// click the button every time. Off if DRIVE_SYNC_INTERVAL_MINUTES=0.
let driveSyncInflight = false;
async function autoSyncDrive(reason) {
  if (driveSyncInflight) return;
  driveSyncInflight = true;
  try {
    const result = await syncFromDrive();
    if (result.ok) {
      console.log(
        `[drive-sync] ${reason}: ${result.added} new / ${result.skipped} already in feed / ${result.errors} errors`,
      );
    } else if (result.error) {
      console.warn(`[drive-sync] ${reason}: skipped — ${result.error}`);
    }
  } catch (e) {
    console.warn(`[drive-sync] ${reason}: failed`, e.message);
  } finally {
    driveSyncInflight = false;
  }
}

function scheduleDriveSync() {
  const minutes = parseInt(process.env.DRIVE_SYNC_INTERVAL_MINUTES ?? '15', 10);
  if (!minutes || minutes < 1) {
    console.log('[drive-sync] auto-sync disabled (DRIVE_SYNC_INTERVAL_MINUTES=0)');
    return;
  }
  // Kick off once on boot (don't block startup).
  setTimeout(() => autoSyncDrive('boot sync'), 2000);
  // Then run on the configured interval.
  setInterval(() => autoSyncDrive('scheduled'), minutes * 60 * 1000);
  console.log(`[drive-sync] auto-syncing every ${minutes} min`);
}

// ---------- startup ----------
async function start() {
  // Eagerly init the DB so any startup errors surface immediately.
  getDb();

  const { user, bootstrappedPassword, resynced } = await bootstrapAdmin();
  if (bootstrappedPassword) {
    console.log('\n========================================================');
    console.log('  Admin account "claude" bootstrapped.');
    console.log(`  username: ${user.username}`);
    console.log(`  password: ${bootstrappedPassword}`);
    console.log('  Save this now — it will not be printed again.');
    console.log('========================================================\n');
  } else if (resynced) {
    console.log('[startup] Admin password resynced from ADMIN_PASSWORD env.');
  }
  if (!process.env.INVITE_CODE) {
    console.warn(
      '[startup] INVITE_CODE is not set — /api/signup will reject all requests until you set it.',
    );
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Video review portal running on http://localhost:${PORT}`);
    scheduleDriveSync();
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
