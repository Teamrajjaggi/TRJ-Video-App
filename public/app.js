// Swipe-to-review feed. Consumes raw video rows from /api/videos.
// Swipe right = approve (like), swipe left = reject (dislike).
import { jsonFetch, getMe } from '/auth.js';

const deck = document.getElementById('deck');
const tpl = document.getElementById('card-tpl');
const loadingEl = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const actionBar = document.getElementById('action-bar');
const progressEl = document.getElementById('progress');
const commentBtn = document.getElementById('comment-btn');
const syncBtn = document.getElementById('sync-btn');
const logoutBtn = document.getElementById('logout-btn');
const emptySync = document.getElementById('empty-sync');
const sheet = document.getElementById('comment-sheet');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const sheetClose = document.getElementById('sheet-close');
const commentList = document.getElementById('comment-list');
const commentForm = document.getElementById('comment-form');
const commentInput = document.getElementById('comment-input');
const commentSend = document.getElementById('comment-send');
const editBtn = document.getElementById('edit-btn');
const editor = document.getElementById('editor');
const editorTitle = document.getElementById('editor-title');
const editorBody = document.getElementById('editor-body');
const editorSave = document.getElementById('editor-save');
const editorCancel = document.getElementById('editor-cancel');
const trimBar = document.getElementById('trim-bar');
const trimTrack = document.getElementById('trim-track');
const trimFill = document.getElementById('trim-fill');
const trimStartH = document.getElementById('trim-start');
const trimEndH = document.getElementById('trim-end');
const trimReadout = document.getElementById('trim-readout');
const trimPlayhead = document.getElementById('trim-playhead');
const cropHint = document.getElementById('crop-hint');
const toastEl = document.getElementById('toast');

const SWIPE_THRESHOLD = 96; // px of horizontal travel to commit a verdict
const SKIP_THRESHOLD = 90; // px of vertical travel to skip ("review later")

let me = null;
let queue = [];
let index = 0;
let busy = false; // locked while a card animates out
let soundOn = false; // session-wide unmute preference (starts muted for autoplay)

async function bootstrap() {
  me = await getMe();
  if (!me) {
    location.href = '/login.html';
    return;
  }
  logoutBtn.addEventListener('click', async () => {
    try {
      await jsonFetch('/api/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    location.href = '/login.html';
  });
  syncBtn.addEventListener('click', runSync);
  emptySync.addEventListener('click', runSync);
  commentBtn.addEventListener('click', openSheet);
  sheetClose.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  commentForm.addEventListener('submit', submitComment);
  commentInput.addEventListener('input', autoGrow);
  editBtn.addEventListener('click', openEditor);
  editorCancel.addEventListener('click', closeEditor);
  editorSave.addEventListener('click', submitEdit);
  // Trim controls live on persistent elements — wire them once.
  attachTrimHandle(trimStartH, 'start');
  attachTrimHandle(trimEndH, 'end');
  trimTrack.addEventListener('pointerdown', onTrackSeek);
  document.addEventListener('keydown', onKey);

  await loadQueue();
}

async function loadQueue() {
  loadingEl.hidden = false;
  try {
    queue = await jsonFetch('/api/videos');
  } catch (e) {
    toast(`Failed to load: ${e.message}`, 'bad');
    queue = [];
  }
  loadingEl.hidden = true;
  index = 0;
  renderDeck();
}

function current() {
  return queue[index] || null;
}

function renderDeck() {
  deck.innerHTML = '';
  const cur = current();
  if (!cur) {
    actionBar.hidden = true;
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;
  actionBar.hidden = false;

  const next = queue[index + 1];
  if (next) deck.appendChild(buildCard(next, false));

  const card = buildCard(cur, true);
  deck.appendChild(card);
  attachGestures(card, cur);
  playCard(card);
  progressEl.textContent = `${index + 1} of ${queue.length}`;
}

function cleanTitle(name) {
  return (name || 'Untitled').replace(/\.[a-z0-9]+$/i, '');
}

function buildCard(video, isCurrent) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.classList.toggle('card--current', isCurrent);
  node.classList.toggle('card--next', !isCurrent);
  node.dataset.videoId = video.id;

  const wrap = node.querySelector('.media-wrap');
  const soundBtn = node.querySelector('.sound-btn');
  const src = `/api/videos/${encodeURIComponent(video.id)}/stream`;
  let media;

  if (video.kind === 'image') {
    media = document.createElement('img');
    media.src = src;
    media.alt = cleanTitle(video.filename);
    soundBtn.hidden = true; // images have no audio
  } else {
    media = document.createElement('video');
    media.src = src;
    media.loop = true;
    media.muted = !soundOn;
    media.playsInline = true;
    media.preload = 'metadata';
    // Play-triangle overlay tracks real playback. 'playing' fires once
    // frames actually render; 'pause' when stopped. The dimmed peek-behind
    // card never plays, so keep the overlay off there.
    const overlay = node.querySelector('.play-overlay');
    overlay.hidden = !isCurrent;
    media.addEventListener('playing', () => {
      overlay.hidden = true;
    });
    media.addEventListener('pause', () => {
      if (isCurrent) overlay.hidden = false;
    });
    setSoundIcon(soundBtn, soundOn);
    soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setSound(!soundOn);
    });
  }
  media.className = 'media';
  wrap.appendChild(media);

  node.querySelector('.card-title').textContent = cleanTitle(video.filename);
  return node;
}

// Mute/unmute is a session-wide preference applied to every card on screen.
function setSound(on) {
  soundOn = on;
  deck.querySelectorAll('video').forEach((v) => {
    v.muted = !on;
  });
  deck.querySelectorAll('.sound-btn').forEach((b) => setSoundIcon(b, on));
}

function setSoundIcon(btn, on) {
  btn.innerHTML = on
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a9 9 0 0 1 0 12"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-5 5"/><path d="M17 9l5 5"/></svg>';
  btn.setAttribute('aria-label', on ? 'Mute' : 'Unmute');
}

function playCard(card) {
  const v = card.querySelector('video');
  if (v) v.play().catch(() => {});
}

function togglePlay(card) {
  const v = card.querySelector('video');
  if (!v) return;
  if (v.paused) v.play().catch(() => {});
  else v.pause();
}

// ---------- swipe gestures ----------
// Horizontal = approve / reject. Vertical = skip ("review later").
function attachGestures(card, video) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;
  let moved = false;
  const stampA = card.querySelector('.stamp-approve');
  const stampR = card.querySelector('.stamp-reject');
  const stampS = card.querySelector('.stamp-skip');

  card.addEventListener('pointerdown', (e) => {
    if (busy) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dy = 0;
    card.setPointerCapture(e.pointerId);
    card.classList.add('card--dragging');
  });

  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    if (Math.abs(dx) >= Math.abs(dy)) {
      // horizontal — approve / reject
      card.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${dx / 24}deg)`;
      const p = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
      stampA.style.opacity = dx > 0 ? p : 0;
      stampR.style.opacity = dx < 0 ? p : 0;
      if (stampS) stampS.style.opacity = 0;
    } else {
      // vertical — skip / review later
      card.style.transform = `translate(${dx * 0.15}px, ${dy}px)`;
      if (stampS) stampS.style.opacity = Math.min(Math.abs(dy) / SKIP_THRESHOLD, 1);
      stampA.style.opacity = 0;
      stampR.style.opacity = 0;
    }
  });

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.remove('card--dragging');
    if (!moved) {
      togglePlay(card);
      snapBack(card);
      return;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > SWIPE_THRESHOLD) commit(card, video, 'like');
      else if (dx < -SWIPE_THRESHOLD) commit(card, video, 'dislike');
      else snapBack(card);
    } else if (Math.abs(dy) > SKIP_THRESHOLD) {
      skip(card, dy < 0 ? -1 : 1);
    } else {
      snapBack(card);
    }
  };
  card.addEventListener('pointerup', finish);
  card.addEventListener('pointercancel', finish);
}

function snapBack(card) {
  card.style.transform = '';
  const a = card.querySelector('.stamp-approve');
  const r = card.querySelector('.stamp-reject');
  const s = card.querySelector('.stamp-skip');
  if (a) a.style.opacity = 0;
  if (r) r.style.opacity = 0;
  if (s) s.style.opacity = 0;
}

function commit(card, video, verdict) {
  if (busy) return;
  busy = true;
  const dir = verdict === 'like' ? 1 : -1;
  const stamp = card.querySelector(
    verdict === 'like' ? '.stamp-approve' : '.stamp-reject',
  );
  if (stamp) stamp.style.opacity = 1;
  card.style.transform = `translate(${dir * 140}%, 60px) rotate(${dir * 22}deg)`;

  submitVerdict(video, verdict);

  setTimeout(() => {
    index += 1;
    busy = false;
    renderDeck();
  }, 340);
}

// Skip without a verdict: the video stays pending and moves to the back of
// the queue, so it comes back around later in the feed.
function skip(card, dir) {
  if (busy) return;
  if (queue.length <= 1) {
    snapBack(card);
    toast('Nothing else in the queue');
    return;
  }
  busy = true;
  card.style.transform = `translateY(${dir * 130}%)`;
  const [v] = queue.splice(index, 1);
  queue.push(v);
  // If that was the last card, wrap to the front.
  if (index >= queue.length - 1) index = 0;
  toast('Saved for later');
  setTimeout(() => {
    busy = false;
    renderDeck();
  }, 320);
}

async function submitVerdict(video, verdict) {
  try {
    await jsonFetch('/api/review', {
      method: 'POST',
      body: JSON.stringify({ videoId: video.id, verdict }),
    });
    toast(verdict === 'like' ? 'Approved' : 'Rejected', verdict === 'like' ? 'ok' : 'bad');
  } catch (e) {
    toast(`Failed: ${e.message}`, 'bad');
  }
}

// ---------- keyboard ----------
function onKey(e) {
  if (!editor.hidden) {
    if (e.key === 'Escape') closeEditor();
    return;
  }
  if (!sheet.hidden) {
    if (e.key === 'Escape') closeSheet();
    return;
  }
  if (busy || !current()) return;
  const card = deck.querySelector('.card--current');
  if (!card) return;
  if (e.key === 'ArrowRight') commit(card, current(), 'like');
  else if (e.key === 'ArrowLeft') commit(card, current(), 'dislike');
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    skip(card, e.key === 'ArrowUp' ? -1 : 1);
  } else if (e.key === ' ') {
    e.preventDefault();
    togglePlay(card);
  }
}

// ---------- sync ----------
async function runSync() {
  syncBtn.disabled = true;
  syncBtn.classList.add('spinning');
  try {
    const r = await jsonFetch('/api/admin/sync-drive', {
      method: 'POST',
      body: '{}',
    });
    if (r && r.ok) toast(`Synced — ${r.added} new`, r.added ? 'ok' : null);
    else toast(`Sync: ${(r && r.error) || 'failed'}`, 'bad');
    await loadQueue();
  } catch (e) {
    toast(`Sync failed: ${e.message}`, 'bad');
  } finally {
    syncBtn.disabled = false;
    syncBtn.classList.remove('spinning');
  }
}

// ---------- comment sheet ----------
async function openSheet() {
  const v = current();
  if (!v) return;
  sheet.dataset.videoId = v.id;
  sheetBackdrop.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('sheet--open'));
  commentList.innerHTML = '<li class="comment-empty">Loading…</li>';
  try {
    const rows = await jsonFetch(
      `/api/videos/${encodeURIComponent(v.id)}/comments`,
    );
    renderComments(rows);
  } catch (e) {
    commentList.innerHTML = `<li class="comment-empty">Failed: ${e.message}</li>`;
  }
}

function closeSheet() {
  sheet.classList.remove('sheet--open');
  sheetBackdrop.hidden = true;
  setTimeout(() => {
    sheet.hidden = true;
  }, 260);
}

function renderComments(rows) {
  commentList.innerHTML = '';
  if (!rows || !rows.length) {
    commentList.innerHTML = '<li class="comment-empty">No comments yet.</li>';
    return;
  }
  for (const r of rows) {
    const li = document.createElement('li');
    li.className = 'comment-item';
    const body = document.createElement('p');
    body.className = 'comment-body';
    body.textContent = r.body;
    const time = document.createElement('time');
    time.className = 'comment-time';
    time.textContent = new Date(r.created_at).toLocaleString();
    li.append(body, time);
    commentList.appendChild(li);
  }
}

async function submitComment(e) {
  e.preventDefault();
  const videoId = sheet.dataset.videoId;
  const text = commentInput.value.trim();
  if (!videoId || !text) return;
  commentSend.disabled = true;
  try {
    await jsonFetch('/api/comment', {
      method: 'POST',
      body: JSON.stringify({ videoId, comment: text }),
    });
    commentInput.value = '';
    autoGrow();
    const rows = await jsonFetch(
      `/api/videos/${encodeURIComponent(videoId)}/comments`,
    );
    renderComments(rows);
    toast('Comment added', 'ok');
  } catch (e2) {
    toast(`Failed: ${e2.message}`, 'bad');
  } finally {
    commentSend.disabled = false;
  }
}

function autoGrow() {
  commentInput.style.height = 'auto';
  commentInput.style.height = `${Math.min(commentInput.scrollHeight, 120)}px`;
}

// ---------- toast ----------
let toastTimer = null;
function toast(msg, kind) {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (kind ? ` toast--${kind}` : '');
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('toast--show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('toast--show');
    setTimeout(() => {
      toastEl.hidden = true;
    }, 250);
  }, 2200);
}

// ---------- media editor (trim video / crop image) ----------
let editState = null;

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function fmtTime(sec) {
  const s = Math.max(0, sec || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

function openEditor() {
  const v = current();
  if (!v) return;
  // Pause the feed playing behind the editor so only one video runs.
  deck.querySelectorAll('video').forEach((vid) => vid.pause());
  editorBody.innerHTML = '';
  trimBar.hidden = true;
  cropHint.hidden = true;
  editorSave.disabled = false;
  editorSave.textContent = 'Approve';
  if (v.kind === 'image') {
    editorTitle.textContent = 'Crop image';
    setupCrop(v);
  } else {
    editorTitle.textContent = 'Trim video';
    setupTrim(v);
  }
  editor.hidden = false;
}

function closeEditor() {
  editor.hidden = true;
  editorBody.innerHTML = '';
  editState = null;
  // Resume the feed card that was paused when the editor opened.
  const card = deck.querySelector('.card--current');
  if (card) playCard(card);
}

// --- trim ---
function setupTrim(v) {
  const video = document.createElement('video');
  video.src = `/api/videos/${encodeURIComponent(v.id)}/stream`;
  video.playsInline = true;
  video.muted = false; // play with sound so you can hear where to cut
  video.preload = 'auto';
  editorBody.appendChild(video);
  trimBar.hidden = false;

  editState = { videoId: v.id, kind: 'video', video, startFrac: 0, endFrac: 1, duration: 0 };

  video.addEventListener('loadedmetadata', () => {
    editState.duration = video.duration || 0;
    layoutTrim();
    video.currentTime = 0;
    video.play().catch(() => {});
  });
  video.addEventListener('timeupdate', () => {
    const { duration, startFrac, endFrac } = editState;
    if (!duration) return;
    const start = startFrac * duration;
    const end = endFrac * duration;
    // Loop within the selected range so you preview exactly the cut.
    if (video.currentTime >= end || video.currentTime < start - 0.05) {
      video.currentTime = start;
    }
    if (trimPlayhead) {
      trimPlayhead.style.left = `${(video.currentTime / duration) * 100}%`;
    }
  });
  video.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
}

function layoutTrim() {
  trimStartH.style.left = `${editState.startFrac * 100}%`;
  trimEndH.style.left = `${editState.endFrac * 100}%`;
  trimFill.style.left = `${editState.startFrac * 100}%`;
  trimFill.style.right = `${(1 - editState.endFrac) * 100}%`;
  const start = editState.startFrac * editState.duration;
  const end = editState.endFrac * editState.duration;
  trimReadout.textContent = `${fmtTime(start)} – ${fmtTime(end)}  ·  ${(end - start).toFixed(1)}s`;
}

// Tap/drag anywhere on the track (off the handles) to scrub the video.
function onTrackSeek(e) {
  if (!editState || editState.kind !== 'video' || !editState.duration) return;
  if (e.target.classList.contains('trim-handle')) return;
  const rect = trimTrack.getBoundingClientRect();
  const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  editState.video.currentTime = frac * editState.duration;
}

function attachTrimHandle(handle, which) {
  handle.addEventListener('pointerdown', (e) => {
    if (!editState || editState.kind !== 'video' || !editState.duration) return;
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const MIN_GAP = 0.03;
    const onMove = (ev) => {
      const rect = trimTrack.getBoundingClientRect();
      let frac = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      if (which === 'start') {
        editState.startFrac = clamp(frac, 0, editState.endFrac - MIN_GAP);
      } else {
        editState.endFrac = clamp(frac, editState.startFrac + MIN_GAP, 1);
      }
      if (editState.video && editState.duration) {
        editState.video.currentTime =
          (which === 'start' ? editState.startFrac : editState.endFrac) * editState.duration;
      }
      layoutTrim();
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

// --- crop ---
function setupCrop(v) {
  const frame = document.createElement('div');
  frame.className = 'crop-frame';
  const img = document.createElement('img');
  img.src = `/api/videos/${encodeURIComponent(v.id)}/stream`;
  img.alt = '';
  const box = document.createElement('div');
  box.className = 'crop-box';
  for (const corner of ['nw', 'ne', 'sw', 'se']) {
    const h = document.createElement('div');
    h.className = `crop-corner ${corner}`;
    h.dataset.corner = corner;
    box.appendChild(h);
  }
  frame.append(img, box);
  editorBody.appendChild(frame);
  cropHint.hidden = false;

  editState = { videoId: v.id, kind: 'image', img, box, crop: null };

  img.addEventListener('load', () => {
    const w = img.clientWidth;
    const h = img.clientHeight;
    editState.crop = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 };
    layoutCrop();
  });
  attachCropDrag(box);
}

function layoutCrop() {
  if (!editState || !editState.crop) return;
  const { x, y, w, h } = editState.crop;
  const b = editState.box;
  b.style.left = `${x}px`;
  b.style.top = `${y}px`;
  b.style.width = `${w}px`;
  b.style.height = `${h}px`;
}

function attachCropDrag(box) {
  box.addEventListener('pointerdown', (e) => {
    if (!editState || !editState.crop) return;
    e.preventDefault();
    e.stopPropagation();
    const corner = e.target.dataset && e.target.dataset.corner;
    const target = corner ? e.target : box;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...editState.crop };
    const fw = editState.img.clientWidth;
    const fh = editState.img.clientHeight;
    const MIN = 44;
    target.setPointerCapture(e.pointerId);
    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let { x, y, w, h } = orig;
      if (!corner) {
        x = clamp(orig.x + dx, 0, fw - w);
        y = clamp(orig.y + dy, 0, fh - h);
      } else {
        if (corner.includes('w')) {
          const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN);
          w = orig.w + (orig.x - nx);
          x = nx;
        }
        if (corner.includes('e')) w = clamp(orig.w + dx, MIN, fw - orig.x);
        if (corner.includes('n')) {
          const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN);
          h = orig.h + (orig.y - ny);
          y = ny;
        }
        if (corner.includes('s')) h = clamp(orig.h + dy, MIN, fh - orig.y);
      }
      editState.crop = { x, y, w, h };
      layoutCrop();
    };
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  });
}

// --- submit ---
async function submitEdit() {
  if (!editState) return;
  editorSave.disabled = true;
  editorSave.textContent = 'Rendering…';
  try {
    let payload;
    if (editState.kind === 'video') {
      if (!editState.duration) throw new Error('video not loaded yet');
      payload = {
        videoId: editState.videoId,
        edit: {
          type: 'trim',
          start: editState.startFrac * editState.duration,
          end: editState.endFrac * editState.duration,
        },
      };
    } else {
      const { img, crop } = editState;
      if (!crop) throw new Error('image not loaded yet');
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      const sx = crop.x * scaleX;
      const sy = crop.y * scaleY;
      const sw = crop.w * scaleX;
      const sh = crop.h * scaleY;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      payload = {
        videoId: editState.videoId,
        edit: {
          type: 'crop',
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          cropBox: {
            x: Math.round(sx),
            y: Math.round(sy),
            width: Math.round(sw),
            height: Math.round(sh),
          },
        },
      };
    }
    await jsonFetch('/api/review/edit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    closeEditor();
    toast('Edited & approved', 'ok');
    index += 1;
    renderDeck();
  } catch (e) {
    toast(`Edit failed: ${e.message}`, 'bad');
    editorSave.disabled = false;
    editorSave.textContent = 'Approve';
  }
}

bootstrap().catch((err) => {
  loadingEl.hidden = true;
  toast(`Error: ${err.message}`, 'bad');
});
