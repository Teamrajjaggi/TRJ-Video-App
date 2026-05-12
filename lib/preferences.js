const fs = require('fs');
const path = require('path');

const PREFS_PATH = path.join(__dirname, '..', 'PREFERENCES.md');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'as', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we',
  'they', 'he', 'she', 'them', 'his', 'her', 'their', 'my', 'me', 'our',
  'so', 'too', 'very', 'just', 'really', 'not', 'no', 'yes', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'can',
  'about', 'than', 'then', 'there', 'here', 'what', 'when', 'where', 'why',
  'how', 'because', 'if', 'into', 'out', 'up', 'down', 'over', 'under',
  'more', 'less', 'like', 'dislike'
]);

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function rankCounts(counts, limit = 10) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function renderList(entries, suffix = '') {
  if (entries.length === 0) return '_(none yet)_';
  return entries.map(([k, v]) => `- **${k}** — ${v}${suffix}`).join('\n');
}

function rebuildPreferences(reviews, videos) {
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));

  const likedTags = {};
  const dislikedTags = {};
  const likedWords = {};
  const dislikedWords = {};
  const commentNotes = [];

  let likes = 0;
  let dislikes = 0;

  for (const r of reviews) {
    const video = videoById[r.videoId];
    if (!video) continue;
    const tagBucket = r.verdict === 'like' ? likedTags : dislikedTags;
    const wordBucket = r.verdict === 'like' ? likedWords : dislikedWords;

    if (r.verdict === 'like') likes += 1;
    else if (r.verdict === 'dislike') dislikes += 1;

    for (const tag of video.tags || []) {
      tagBucket[tag] = (tagBucket[tag] || 0) + 1;
    }

    if (r.comment && r.comment.trim()) {
      commentNotes.push({
        videoId: r.videoId,
        title: video.title,
        verdict: r.verdict,
        comment: r.comment.trim(),
        at: r.at,
      });

      for (const w of tokenize(r.comment)) {
        wordBucket[w] = (wordBucket[w] || 0) + 1;
      }
    }
  }

  const topLikedTags = rankCounts(likedTags);
  const topDislikedTags = rankCounts(dislikedTags);
  const topLikedWords = rankCounts(likedWords);
  const topDislikedWords = rankCounts(dislikedWords);

  const recentNotes = commentNotes.slice(-20).reverse();

  const md = `# Reviewer Preferences

_Auto-generated from like/dislike actions and comments. Regenerated on every review submission._

**Totals:** ${likes} likes · ${dislikes} dislikes · ${commentNotes.length} comments

## Liked themes (tags)
${renderList(topLikedTags, ' likes')}

## Disliked themes (tags)
${renderList(topDislikedTags, ' dislikes')}

## Words associated with likes
${renderList(topLikedWords)}

## Words associated with dislikes
${renderList(topDislikedWords)}

## Recent comment notes
${
  recentNotes.length === 0
    ? '_(none yet)_'
    : recentNotes
        .map(
          (n) =>
            `- [${n.verdict}] **${n.title}** — ${n.comment}  \n  _${n.at}_`,
        )
        .join('\n')
}

---

_This file is consumed downstream as context for which kinds of videos the reviewer prefers. Edit at your own risk — it will be overwritten on the next review._
`;

  fs.writeFileSync(PREFS_PATH, md, 'utf8');
  return PREFS_PATH;
}

module.exports = { rebuildPreferences, PREFS_PATH };
