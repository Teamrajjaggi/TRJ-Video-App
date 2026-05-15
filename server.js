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
  isAdminUsername,
} = require('./lib/users');
const db = require('./lib/db');
const { approveVideo, rejectVideo } = require('./lib/approve');
const { syncFromDrive } = require('./lib/drive-sync');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// ---------- auth middleware ----------
async function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'auth required' });
  const user = await findById(session.uid);
  if (!user) {
    clearSessionCookie(res);
    return res.status(401).json({ error: 'session invalid' });
  }
  req.user = user;
  next();
}
function requireAdminToken(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return res.status(503).json({ error: 'ADMIN_API_TOKEN not set' });
  const header = req.headers.authorization || '';
  const got = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!constantTimeEqual(got, expected)) return res.status(401).json({ error: 'bad token' });
  next();
}
async function requireAdminOrToken(req, res, next) {
  const session = readSession(req);
  if (session) {
    const user = await findById(session.uid);
    if (user && isAdminUsername(user.username)) {
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
    const user = await createUser({ username, password, role: 'admin' });
    issueSessionCookie(res, user);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await findByUsername(username);
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    issueSessionCookie(res, user);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
// The pending queue: every file the VA has uploaded that hasn't been
// approved or rejected yet.
// TODO(phase3): the frontend in public/ expects the legacy enriched shape
// (reviews[], myVerdict, approved, tags, etc.). The Phase 3 UI rewrite
// will consume this raw row shape directly.
app.get('/api/videos', requireAuth, async (req, res) => {
  try {
    const videos = await db.listVideos({ status: 'pending' });
    res.json(videos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Approve / reject the single admin's verdict on a video.
async function handleReview(req, res) {
  const { videoId, verdict } = req.body || {};
  if (!videoId || !['like', 'dislike'].includes(verdict)) {
    return res.status(400).json({ error: 'videoId + verdict (like|dislike) required' });
  }
  try {
    const video = await db.getVideo(videoId);
    if (!video) return res.status(404).json({ error: 'video not found' });

    const reviewedAt = new Date().toISOString();

    if (verdict === 'like') {
      await db.updateVideoStatus(video.id, 'approved', { reviewed_at: reviewedAt });
      let driveMove = null;
      try {
        driveMove = await approveVideo(video);
      } catch (e) {
        console.warn('[review] Drive move to Approved failed:', e.message);
      }
      return res.json({ ok: true, status: 'approved', driveMove });
    }

    // dislike → reject
    await db.banDriveId(video.drive_file_id);
    await db.updateVideoStatus(video.id, 'rejected', { reviewed_at: reviewedAt });
    let driveMove = null;
    try {
      driveMove = await rejectVideo(video);
    } catch (e) {
      console.warn('[review] Drive move to Trash failed:', e.message);
    }
    return res.json({ ok: true, status: 'rejected', driveMove });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

app.post('/api/review', requireAuth, handleReview);

app.post('/api/comment', requireAuth, async (req, res) => {
  try {
    const { videoId, comment } = req.body || {};
    const body = typeof comment === 'string' ? comment.trim() : '';
    if (!videoId || !body) {
      return res.status(400).json({ error: 'videoId + non-empty comment required' });
    }
    const video = await db.getVideo(videoId);
    if (!video) return res.status(404).json({ error: 'video not found' });
    const row = await db.addComment(videoId, body);
    res.json({ ok: true, comment: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- admin actions (admin session OR bearer token) ----------

// Approved-and-not-yet-posted: ready for n8n to pick up.
app.get('/api/admin/approved', requireAdminOrToken, async (req, res) => {
  try {
    const videos = await db.listVideos({ status: 'approved' });
    res.json(videos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark an approved video as posted (called by the auto-post worker).
app.post('/api/admin/approved/:id/posted', requireAdminOrToken, async (req, res) => {
  try {
    const updated = await db.updateVideoStatus(req.params.id, 'posted', {
      posted_at: new Date().toISOString(),
    });
    res.json({ ok: true, video: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Un-approve (status back to pending). Does NOT touch Drive.
// TODO(phase2): also move the Drive file from Approved back to Pending.
app.delete('/api/admin/approved/:id', requireAdminOrToken, async (req, res) => {
  try {
    const updated = await db.updateVideoStatus(req.params.id, 'pending', {
      reviewed_at: null,
    });
    res.json({ ok: true, video: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/banned', requireAdminOrToken, async (req, res) => {
  try {
    res.json(await db.listBannedDriveIds());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/banned/:driveId', requireAdminOrToken, async (req, res) => {
  try {
    await db.unbanDriveId(req.params.driveId);
    res.json({ ok: true });
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

// Hard-delete a video row. Does not delete the underlying Drive file —
// use the reject flow for that.
app.delete('/api/admin/videos/:id', requireAdminOrToken, async (req, res) => {
  try {
    const video = await db.getVideo(req.params.id);
    if (!video) return res.status(404).json({ error: 'video not found' });
    await db.deleteVideo(video.id);
    res.json({ ok: true, deleted: { id: video.id, filename: video.filename } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Drive auto-sync ----------
let driveSyncInflight = false;
async function autoSyncDrive(reason) {
  if (driveSyncInflight) return;
  driveSyncInflight = true;
  try {
    const result = await syncFromDrive();
    if (result.ok) {
      console.log(
        `[drive-sync] ${reason}: ${result.added} new / ${result.skipped} skipped / ${result.errors} errors`,
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
  const minutes = parseInt(process.env.DRIVE_SYNC_INTERVAL_MINUTES ?? '30', 10);
  if (!minutes || minutes < 1) {
    console.log('[drive-sync] auto-sync disabled (DRIVE_SYNC_INTERVAL_MINUTES=0)');
    return;
  }
  setTimeout(() => autoSyncDrive('boot sync'), 2000);
  setInterval(() => autoSyncDrive('scheduled'), minutes * 60 * 1000);
  console.log(`[drive-sync] auto-syncing every ${minutes} min`);
}

// TODO(phase2): trash purger — periodically delete Drive files that have
// been sitting in DRIVE_TRASH_FOLDER_ID for more than TRASH_RETENTION_DAYS.

// ---------- startup ----------
async function start() {
  db.init();

  const { user, bootstrappedPassword, resynced } = await bootstrapAdmin();
  if (bootstrappedPassword) {
    console.log('\n========================================================');
    console.log(`  Admin account "${user.username}" bootstrapped.`);
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
