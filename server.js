require('dotenv').config();

const path = require('path');
const os = require('os');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');

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
  bootstrapCreator,
  isAdminUsername,
} = require('./lib/users');
const db = require('./lib/db');
const { approveVideo, rejectVideo } = require('./lib/approve');
const { faststartDriveVideo } = require('./lib/drive-sync');
const { purgeOldRejected } = require('./lib/purge');
const {
  streamDriveFile,
  uploadFileToFolder,
  renameFile,
  pendingFolderId,
  kindFromMime,
} = require('./lib/drive-source');
const { moveFile } = require('./lib/drive-move');
const { trimVideo } = require('./lib/edit-media');
const { generateCaptionFor } = require('./lib/caption');
const { pushToStream } = require('./lib/cloudflare-stream');
const { notify, notifyByRole } = require('./lib/notify');

const app = express();
// 20mb: cropped images arrive as base64 data URLs in the JSON body.
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

// VA clip uploads. Stored to a temp file, then pushed to Drive Pending.
const uploadTmp = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 400 * 1024 * 1024 }, // 400 MB ceiling
});

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
const PROTECTED_PAGES = new Set([
  '/',
  '/index.html',
  '/profile',
  '/profile.html',
  '/creator',
  '/creator.html',
]);
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
  const { videoId, verdict, reason, note } = req.body || {};
  if (!videoId || !['like', 'dislike'].includes(verdict)) {
    return res.status(400).json({ error: 'videoId + verdict (like|dislike) required' });
  }
  try {
    const video = await db.getVideo(videoId);
    if (!video) return res.status(404).json({ error: 'video not found' });

    const reviewedAt = new Date().toISOString();

    if (verdict === 'like') {
      // The reviewer can note what worked; the creator sees it.
      await db.updateVideoStatus(video.id, 'approved', {
        reviewed_at: reviewedAt,
        approval_reason:
          typeof reason === 'string' && reason.trim() ? reason.trim() : null,
        approval_note:
          typeof note === 'string' && note.trim() ? note.trim() : null,
      });
      let driveMove = null;
      try {
        driveMove = await approveVideo(video);
      } catch (e) {
        console.warn('[review] Drive move to Approved failed:', e.message);
      }
      // Generate the social caption in the background — don't block the swipe.
      generateCaptionFor(video.id);
      // Tell the uploader their clip was approved.
      const approvedNote = {
        type: 'review',
        title: 'Clip approved ✅',
        body: `"${video.filename}" was approved.`,
        videoId: video.id,
      };
      if (video.uploaded_by) notify(video.uploaded_by, approvedNote);
      else notifyByRole('creator', approvedNote);
      return res.json({ ok: true, status: 'approved', driveMove });
    }

    // dislike → reject. The reason (one-tap chip) is shown back to the
    // creator so they know what to fix; note is an optional free-text add.
    await db.banDriveId(video.drive_file_id);
    await db.updateVideoStatus(video.id, 'rejected', {
      reviewed_at: reviewedAt,
      rejection_reason:
        typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      rejection_note:
        typeof note === 'string' && note.trim() ? note.trim() : null,
    });
    let driveMove = null;
    try {
      driveMove = await rejectVideo(video);
    } catch (e) {
      console.warn('[review] Drive move to Trash failed:', e.message);
    }
    // Tell the uploader their clip was sent back, with the reason.
    const cleanReason =
      typeof reason === 'string' && reason.trim() ? reason.trim() : null;
    const rejectedNote = {
      type: 'review',
      title: 'Clip sent back ↩️',
      body: cleanReason
        ? `"${video.filename}" — ${cleanReason}`
        : `"${video.filename}" was sent back.`,
      videoId: video.id,
    };
    if (video.uploaded_by) notify(video.uploaded_by, rejectedNote);
    else notifyByRole('creator', rejectedNote);
    return res.json({ ok: true, status: 'rejected', driveMove });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

app.post('/api/review', requireAuth, handleReview);

// Approve an *edited* version: trim a video or crop an image, render the
// result, push it to the Approved folder, and point the row at the new file.
app.post('/api/review/edit', requireAuth, async (req, res) => {
  const { videoId, edit } = req.body || {};
  if (!videoId || !edit || !edit.type) {
    return res.status(400).json({ error: 'videoId + edit{type} required' });
  }
  try {
    const video = await db.getVideo(videoId);
    if (!video) return res.status(404).json({ error: 'video not found' });

    const approvedFolder = process.env.DRIVE_APPROVED_FOLDER_ID;
    if (!approvedFolder) {
      return res.status(503).json({ error: 'DRIVE_APPROVED_FOLDER_ID not set' });
    }

    const stamp = Date.now();
    const base = (video.filename || 'clip').replace(/\.[^.]+$/, '');
    let editedPath;
    let editedName;
    let editedMime;
    const extras = {};

    if (edit.type === 'trim') {
      const inPath = path.join(os.tmpdir(), `shuffl-edit-in-${stamp}.mp4`);
      editedPath = path.join(os.tmpdir(), `shuffl-edit-out-${stamp}.mp4`);
      const driveRes = await streamDriveFile(video.drive_file_id);
      await pipeline(driveRes.data, fs.createWriteStream(inPath));
      try {
        await trimVideo(inPath, editedPath, edit.start, edit.end);
      } finally {
        fs.promises.unlink(inPath).catch(() => {});
      }
      editedName = `${base}-trimmed.mp4`;
      editedMime = 'video/mp4';
      extras.trim_start_seconds = Number(edit.start);
      extras.trim_end_seconds = Number(edit.end);
    } else if (edit.type === 'crop') {
      const m = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(edit.dataUrl || '');
      if (!m) return res.status(400).json({ error: 'crop needs an image data URL' });
      editedMime = m[1];
      const ext = (editedMime.split('/')[1] || 'png').replace(/[^\w]/g, '');
      editedPath = path.join(os.tmpdir(), `shuffl-edit-out-${stamp}.${ext}`);
      await fs.promises.writeFile(editedPath, Buffer.from(m[2], 'base64'));
      editedName = `${base}-cropped.${ext}`;
      if (edit.cropBox) extras.crop_box = edit.cropBox;
    } else {
      return res.status(400).json({ error: `unknown edit type: ${edit.type}` });
    }

    // Upload the rendered file to the Approved folder.
    let uploaded;
    try {
      uploaded = await uploadFileToFolder(editedPath, editedName, editedMime, approvedFolder);
    } finally {
      fs.promises.unlink(editedPath).catch(() => {});
    }

    // Send the original clip to Trash (best-effort).
    try {
      const trash = process.env.DRIVE_TRASH_FOLDER_ID;
      if (trash) await moveFile(video.drive_file_id, trash);
    } catch (e) {
      console.warn('[edit] moving original to Trash failed:', e.message);
    }

    // Point the row at the edited file and mark it approved.
    const updated = await db.applyEdit(video.id, {
      drive_file_id: uploaded.id,
      filename: editedName,
      mime_type: editedMime,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      ...extras,
    });

    // Caption the edited result.
    generateCaptionFor(video.id);

    res.json({ ok: true, status: 'approved', video: updated });
  } catch (e) {
    console.warn('[edit] failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

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

// Comments on a single video, oldest first.
app.get('/api/videos/:id/comments', requireAuth, async (req, res) => {
  try {
    res.json(await db.listComments(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stream a Drive file's bytes through the server so the browser can play
// a private file. Honours Range requests so <video> can seek.
app.get('/api/videos/:id/stream', requireAuth, async (req, res) => {
  try {
    const video = await db.getVideo(req.params.id);
    if (!video) return res.status(404).json({ error: 'video not found' });

    // Once the clip is on Cloudflare's CDN, hand playback off there —
    // the video bytes never touch this server.
    if (video.stream_playback_url) {
      return res.redirect(302, video.stream_playback_url);
    }

    const driveRes = await streamDriveFile(video.drive_file_id, req.headers.range);
    res.status(driveRes.status || 200);
    res.setHeader('Content-Type', video.mime_type || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=300');
    const len = driveRes.headers['content-length'];
    const contentRange = driveRes.headers['content-range'];
    if (len) res.setHeader('Content-Length', len);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    driveRes.data.on('error', (e) => {
      console.warn('[stream] drive error:', e.message);
      if (!res.headersSent) res.status(502).end();
      else res.destroy();
    });
    driveRes.data.pipe(res);
  } catch (e) {
    console.warn('[stream] failed:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ---------- creator (VA) ----------

// Every clip in the system, newest first — pending, approved, rejected
// (with the reason), or posted. The VA is the content manager, so they
// see all clips, not only the ones they uploaded through the app.
app.get('/api/creator/videos', requireAuth, async (req, res) => {
  try {
    res.json(await db.listAllVideos());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload a clip straight into the review pipeline: store it in Drive's
// Pending folder, fast-start it, and register the row tagged to this user.
app.post(
  '/api/creator/upload',
  requireAuth,
  uploadTmp.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
    const tmpPath = req.file.path;
    try {
      const kind = kindFromMime(req.file.mimetype);
      if (!kind) {
        return res.status(400).json({ error: 'only video or image files are accepted' });
      }
      const folder = pendingFolderId();
      if (!folder) {
        return res.status(503).json({ error: 'DRIVE_PENDING_FOLDER_ID not set' });
      }
      const name = req.file.originalname || `upload-${Date.now()}`;
      const uploaded = await uploadFileToFolder(
        tmpPath,
        name,
        req.file.mimetype,
        folder,
      );
      // Fast-start videos so they play instantly in the feed. Best-effort.
      if (kind === 'video') {
        try {
          await faststartDriveVideo(uploaded.id, req.file.mimetype);
        } catch (e) {
          console.warn('[upload] fast-start skipped:', e.message);
        }
      }
      const row = await db.upsertVideoFromDrive({
        driveFileId: uploaded.id,
        filename: name,
        mimeType: req.file.mimetype,
        kind,
        thumbnailUrl: null,
        streamUrl: null,
        uploadedBy: req.user.id,
      });
      // Copy the clip to Cloudflare's CDN in the background.
      if (kind === 'video') pushToStream(row.id);
      // Tell the admin a new clip is waiting.
      notifyByRole('admin', {
        type: 'upload',
        title: 'New clip uploaded 🎬',
        body: `${name} is ready to review.`,
        videoId: row.id,
      });
      res.json({ ok: true, video: row });
    } catch (e) {
      console.warn('[upload] failed:', e.message);
      res.status(500).json({ error: e.message });
    } finally {
      fs.promises.unlink(tmpPath).catch(() => {});
    }
  },
);

// Rename a clip. Writes the new name to Drive and the DB row; the
// original file extension is preserved so playback is unaffected.
app.patch('/api/creator/videos/:id/rename', requireAuth, async (req, res) => {
  try {
    const video = await db.getVideo(req.params.id);
    if (!video) return res.status(404).json({ error: 'video not found' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'name required' });
    if (name.length > 120) {
      return res.status(400).json({ error: 'name too long (max 120 characters)' });
    }
    if (/[\\/]/.test(name)) {
      return res.status(400).json({ error: 'name cannot contain slashes' });
    }
    const ext = path.extname(video.filename || '');
    const finalName =
      ext && !name.toLowerCase().endsWith(ext.toLowerCase()) ? name + ext : name;
    if (video.drive_file_id) await renameFile(video.drive_file_id, finalName);
    const row = await db.updateFilename(video.id, finalName);
    res.json({ ok: true, video: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// The VA's posting checklist: approved clips not yet posted.
app.get('/api/creator/to-post', requireAuth, async (req, res) => {
  try {
    res.json(await db.listVideos({ status: 'approved', posted: false }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// VA checks a clip off the list once it's live on social.
app.post('/api/creator/videos/:id/posted', requireAuth, async (req, res) => {
  try {
    const video = await db.getVideo(req.params.id);
    if (!video) return res.status(404).json({ error: 'video not found' });
    const updated = await db.updateVideoStatus(video.id, 'posted', {
      posted_at: new Date().toISOString(),
    });
    // Tell the admin the clip is confirmed posted.
    notifyByRole('admin', {
      type: 'posted',
      title: 'Clip marked as posted 📣',
      body: `"${video.filename}" is now live.`,
      videoId: video.id,
    });
    res.json({ ok: true, video: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- notifications & web push ----------

// The VAPID public key the browser needs to subscribe to push.
app.get('/api/push/key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
});

// Register this device's push subscription for the logged-in user.
app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) {
      return res.status(400).json({ error: 'invalid subscription' });
    }
    await db.savePushSubscription(req.user.id, sub);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/push/unsubscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await db.deletePushSubscription(endpoint);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// The bell list for the logged-in user.
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const items = await db.listNotifications(req.user.id);
    res.json({ items, unread: items.filter((n) => !n.read).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  try {
    await db.markNotificationsRead(req.user.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- admin actions (admin session OR bearer token) ----------

// Approved videos. ?filter=unposted (default) | posted | all
app.get('/api/admin/approved', requireAdminOrToken, async (req, res) => {
  try {
    const filter = req.query.filter || 'unposted';
    const opts = { status: 'approved' };
    if (filter === 'unposted') opts.posted = false;
    else if (filter === 'posted') opts.posted = true;
    // 'all' leaves the posted constraint off entirely.
    const videos = await db.listVideos(opts);
    res.json(videos);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save an edited caption / hashtags.
app.patch('/api/admin/approved/:id/caption', requireAdminOrToken, async (req, res) => {
  try {
    const { caption, hashtags } = req.body || {};
    const patch = { status: 'ready', error: null };
    if (caption !== undefined) patch.caption = String(caption);
    if (hashtags !== undefined) {
      patch.hashtags = Array.isArray(hashtags)
        ? hashtags.map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean)
        : [];
    }
    const updated = await db.setCaption(req.params.id, patch);
    res.json({ ok: true, video: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Re-run Gemini caption generation for a video (background).
app.post(
  '/api/admin/approved/:id/caption/regenerate',
  requireAdminOrToken,
  async (req, res) => {
    try {
      const video = await db.getVideo(req.params.id);
      if (!video) return res.status(404).json({ error: 'video not found' });
      generateCaptionFor(video.id);
      res.json({ ok: true, status: 'generating' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

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

// ---------- error handler ----------
// Catches multer upload errors (e.g. file too large) and anything else
// that reaches here, so the client gets JSON instead of an HTML stack.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE' ? 'file too large (max 400 MB)' : err.message;
    return res.status(400).json({ error: msg });
  }
  console.warn('[error]', err.message);
  res.status(500).json({ error: err.message || 'server error' });
});

// Trash purger: deletes rejected clips (Drive file + DB row) once they've
// aged past TRASH_RETENTION_DAYS, so storage and the dashboard stay clean.
function schedulePurge() {
  const days = parseInt(process.env.TRASH_RETENTION_DAYS ?? '14', 10);
  if (!days || days < 1) {
    console.log('[purge] auto-delete disabled (TRASH_RETENTION_DAYS=0)');
    return;
  }
  const run = async () => {
    try {
      const r = await purgeOldRejected();
      if (r.ok && r.removed) {
        console.log(`[purge] removed ${r.removed} rejected clip(s) older than ${days}d`);
      }
    } catch (e) {
      console.warn('[purge] run failed:', e.message);
    }
  };
  setTimeout(run, 20000); // shortly after boot
  setInterval(run, 24 * 60 * 60 * 1000); // daily
  console.log(`[purge] rejected clips auto-delete after ${days} days`);
}

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

  try {
    const creator = await bootstrapCreator();
    if (creator.bootstrappedPassword) {
      console.log('\n========================================================');
      console.log(`  Creator account "${creator.user.username}" bootstrapped.`);
      console.log(`  password: ${creator.bootstrappedPassword}`);
      console.log('========================================================\n');
    } else if (creator.resynced) {
      console.log('[startup] Creator password resynced from CREATOR_PASSWORD env.');
    }
  } catch (e) {
    console.warn('[startup] creator bootstrap skipped:', e.message);
  }

  if (!process.env.INVITE_CODE) {
    console.warn(
      '[startup] INVITE_CODE is not set — /api/signup will reject all requests until you set it.',
    );
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Video review portal running on http://localhost:${PORT}`);
    schedulePurge();
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
