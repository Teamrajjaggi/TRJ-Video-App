const feed = document.getElementById('feed');
const tmpl = document.getElementById('card-template');

async function loadVideos() {
  const res = await fetch('/api/videos');
  const videos = await res.json();
  feed.innerHTML = '';
  videos.forEach((v) => feed.appendChild(buildCard(v)));
  observeCards();
}

function tally(reviews) {
  const counts = { like: 0, dislike: 0, comment: 0 };
  for (const r of reviews) {
    if (counts[r.verdict] !== undefined) counts[r.verdict] += 1;
    if (r.comment) counts.comment += r.verdict === 'comment' ? 0 : 1;
  }
  // total comment count = explicit comment-only + any review that included a comment
  const explicitComments = reviews.filter((r) => r.verdict === 'comment').length;
  const inlineComments = reviews.filter(
    (r) => r.verdict !== 'comment' && r.comment && r.comment.trim(),
  ).length;
  counts.comment = explicitComments + inlineComments;
  return counts;
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

  renderComments(commentList, video.reviews || []);

  videoEl.addEventListener('click', () => {
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  });

  likeBtn.addEventListener('click', () => submitVerdict('like', node, video));
  dislikeBtn.addEventListener('click', () =>
    submitVerdict('dislike', node, video),
  );

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

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const data = await res.json();

    video.reviews = [...(video.reviews || []), data.review];
    const newCounts = tally(video.reviews);
    node.querySelector('.like-count').textContent = newCounts.like;
    node.querySelector('.dislike-count').textContent = newCounts.dislike;
    node.querySelector('.comment-count').textContent = newCounts.comment;
    renderComments(commentList, video.reviews);

    if (verdict === 'like') flagQueued(likeBtn);
    if (verdict === 'like') likeBtn.classList.add('is-active');
    if (verdict === 'dislike') dislikeBtn.classList.add('is-active');

    commentForm.reset();
  });

  return node;
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
    li.appendChild(document.createTextNode(r.comment));
    listEl.appendChild(li);
  }
}

async function submitVerdict(verdict, node, video) {
  const res = await fetch('/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ videoId: video.id, verdict, comment: '' }),
  });
  if (!res.ok) return;
  const data = await res.json();

  video.reviews = [...(video.reviews || []), data.review];
  const counts = tally(video.reviews);
  node.querySelector('.like-count').textContent = counts.like;
  node.querySelector('.dislike-count').textContent = counts.dislike;
  node.querySelector('.comment-count').textContent = counts.comment;

  const likeBtn = node.querySelector('.action.like');
  const dislikeBtn = node.querySelector('.action.dislike');
  if (verdict === 'like') {
    likeBtn.classList.add('is-active');
    dislikeBtn.classList.remove('is-active');
    flagQueued(likeBtn);
  } else {
    dislikeBtn.classList.add('is-active');
    likeBtn.classList.remove('is-active');
  }
}

function flagQueued(btn) {
  btn.classList.add('queued');
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

loadVideos().catch((err) => {
  feed.innerHTML = `<div class="loading">Failed to load: ${err.message}</div>`;
});
