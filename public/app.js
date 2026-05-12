import { jsonFetch, getMe } from '/auth.js';

const feed = document.getElementById('feed');
const tmpl = document.getElementById('card-template');
const usernameEl = document.getElementById('username');
const roleChip = document.getElementById('role-chip');
const generateBtn = document.getElementById('generate-btn');
const logoutBtn = document.getElementById('logout-btn');

let me = null;

async function bootstrap() {
  me = await getMe();
  if (!me) {
    window.location.href = '/login.html';
    return;
  }
  usernameEl.textContent = `@${me.username}`;
  if (me.role === 'admin') {
    roleChip.textContent = 'admin';
    roleChip.hidden = false;
    generateBtn.hidden = false;
  }

  logoutBtn.addEventListener('click', async () => {
    await jsonFetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  generateBtn.addEventListener('click', async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';
    try {
      await jsonFetch('/api/admin/generate-one', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadVideos();
    } catch (e) {
      alert(`Generate failed: ${e.message}`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = '+ Generate';
    }
  });

  await loadVideos();
}

async function loadVideos() {
  const videos = await jsonFetch('/api/videos');
  feed.innerHTML = '';
  if (videos.length === 0) {
    feed.innerHTML = '<div class="loading">No videos yet. Hang tight.</div>';
    return;
  }
  videos.forEach((v) => feed.appendChild(buildCard(v)));
  observeCards();
}

function tally(reviews) {
  const explicitComments = reviews.filter((r) => r.verdict === 'comment').length;
  const inlineComments = reviews.filter(
    (r) => r.verdict !== 'comment' && r.comment && r.comment.trim(),
  ).length;
  return {
    like: reviews.filter((r) => r.verdict === 'like').length,
    dislike: reviews.filter((r) => r.verdict === 'dislike').length,
    comment: explicitComments + inlineComments,
  };
}

function buildCard(video) {
  const node = tmpl.content.firstElementChild.cloneNode(true);
  node.dataset.videoId = video.id;

  const videoEl = node.querySelector('.video');
  videoEl.src = video.src;
  if (video.poster) videoEl.poster = video.poster;
  videoEl.muted = true;

  node.querySelector('.title').textContent = video.title;
  node.querySelector('.description').textContent = video.description || '';

  const tagsEl = node.querySelector('.tags');
  (video.tags || []).forEach((t) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${t}`;
    tagsEl.appendChild(span);
  });

  const counts = tally(video.reviews || []);
  node.querySelector('.like-count').textContent = counts.like;
  node.querySelector('.dislike-count').textContent = counts.dislike;
  node.querySelector('.comment-count').textContent = counts.comment;

  const likeBtn = node.querySelector('.action.like');
  const dislikeBtn = node.querySelector('.action.dislike');
  const commentBtn = node.querySelector('.action.comment-toggle');
  const commentsPanel = node.querySelector('.comments');
  const commentList = node.querySelector('.comment-list');
  const commentForm = node.querySelector('.comment-form');
  const closeBtn = node.querySelector('.comments .close');

  if (video.myReview?.verdict === 'like') likeBtn.classList.add('is-active');
  if (video.myReview?.verdict === 'dislike') dislikeBtn.classList.add('is-active');

  renderComments(commentList, video.reviews || []);

  videoEl.addEventListener('click', () => {
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  });

  likeBtn.addEventListener('click', () => submitVerdict('like', node, video));
  dislikeBtn.addEventListener('click', () => submitVerdict('dislike', node, video));

  commentBtn.addEventListener('click', () => {
    commentsPanel.hidden = !commentsPanel.hidden;
  });
  closeBtn.addEventListener('click', () => {
    commentsPanel.hidden = true;
  });

  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(commentForm);
    const comment = formData.get('comment')?.toString().trim();
    const verdict = formData.get('verdict')?.toString() || 'comment';
    if (!comment) return;

    const endpoint = verdict === 'comment' ? '/api/comment' : '/api/review';
    const payload =
      verdict === 'comment'
        ? { videoId: video.id, comment }
        : { videoId: video.id, verdict, comment };

    try {
      const data = await jsonFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      video.reviews = [...(video.reviews || []), data.review];
      updateCounts(node, video.reviews);
      renderComments(commentList, video.reviews);
      if (verdict === 'like') {
        likeBtn.classList.add('is-active');
        dislikeBtn.classList.remove('is-active');
        flagSaved(likeBtn, 'saved');
      } else if (verdict === 'dislike') {
        dislikeBtn.classList.add('is-active');
        likeBtn.classList.remove('is-active');
      }
      commentForm.reset();
    } catch (e2) {
      alert(`Failed: ${e2.message}`);
    }
  });

  return node;
}

function updateCounts(node, reviews) {
  const c = tally(reviews);
  node.querySelector('.like-count').textContent = c.like;
  node.querySelector('.dislike-count').textContent = c.dislike;
  node.querySelector('.comment-count').textContent = c.comment;
}

function renderComments(listEl, reviews) {
  listEl.innerHTML = '';
  const withText = reviews.filter((r) => r.comment && r.comment.trim());
  if (withText.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No comments yet — be the first.';
    li.style.color = 'rgba(255,255,255,0.5)';
    listEl.appendChild(li);
    return;
  }
  for (const r of withText.slice().reverse()) {
    const li = document.createElement('li');
    const chip = document.createElement('span');
    chip.className = `verdict-chip ${r.verdict}`;
    chip.textContent = r.verdict;
    li.appendChild(chip);
    if (r.username) {
      const who = document.createElement('span');
      who.className = 'comment-author';
      who.textContent = `@${r.username} `;
      li.appendChild(who);
    }
    li.appendChild(document.createTextNode(r.comment));
    listEl.appendChild(li);
  }
}

async function submitVerdict(verdict, node, video) {
  try {
    const data = await jsonFetch('/api/review', {
      method: 'POST',
      body: JSON.stringify({ videoId: video.id, verdict, comment: '' }),
    });
    video.reviews = [...(video.reviews || []), data.review];
    updateCounts(node, video.reviews);
    const likeBtn = node.querySelector('.action.like');
    const dislikeBtn = node.querySelector('.action.dislike');
    if (verdict === 'like') {
      likeBtn.classList.add('is-active');
      dislikeBtn.classList.remove('is-active');
      flagSaved(likeBtn, 'saved');
    } else {
      dislikeBtn.classList.add('is-active');
      likeBtn.classList.remove('is-active');
    }
  } catch (e) {
    alert(`Failed: ${e.message}`);
  }
}

function flagSaved(btn, label) {
  btn.classList.add('queued');
  btn.dataset.flag = label;
  setTimeout(() => btn.classList.remove('queued'), 1800);
}

function observeCards() {
  const cards = feed.querySelectorAll('.card');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const v = entry.target.querySelector('.video');
        if (!v) continue;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    },
    { threshold: [0, 0.6, 1] },
  );
  cards.forEach((c) => io.observe(c));
}

bootstrap().catch((err) => {
  feed.innerHTML = `<div class="loading">Failed: ${err.message}</div>`;
});
