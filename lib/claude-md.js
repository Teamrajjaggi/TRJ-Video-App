const fs = require('fs');
const path = require('path');

const CLAUDE_MD_PATH = path.join(__dirname, '..', 'CLAUDE.md');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'as', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'we',
  'they', 'he', 'she', 'them', 'his', 'her', 'their', 'my', 'me', 'our',
  'so', 'too', 'very', 'just', 'really', 'not', 'no', 'yes', 'do', 'does',
  'did', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'can',
  'about', 'than', 'then', 'there', 'here', 'what', 'when', 'where', 'why',
  'how', 'because', 'if', 'into', 'out', 'up', 'down', 'over', 'under',
  'more', 'less', 'like', 'dislike',
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

function scoreTags(reviews, videos) {
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));
  const tally = {};
  for (const r of reviews) {
    const v = videoById[r.videoId];
    if (!v) continue;
    for (const tag of v.tags || []) {
      if (!tally[tag]) tally[tag] = { likes: 0, dislikes: 0 };
      if (r.verdict === 'like') tally[tag].likes += 1;
      else if (r.verdict === 'dislike') tally[tag].dislikes += 1;
    }
  }
  return Object.entries(tally).map(([tag, c]) => ({
    tag,
    likes: c.likes,
    dislikes: c.dislikes,
    net: c.likes - c.dislikes,
  }));
}

function preferList(rows) {
  return rows
    .filter((r) => r.net > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 10);
}

function avoidList(rows) {
  return rows
    .filter((r) => r.net < 0)
    .sort((a, b) => a.net - b.net)
    .slice(0, 10);
}

// For each dislike without a comment, guess the most suspect tag:
// the tag on that video with the worst net score across the dataset.
function suspectedDislikeReasons(reviews, videos, tagRows) {
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));
  const tagByName = Object.fromEntries(tagRows.map((r) => [r.tag, r]));
  const out = [];
  for (const r of reviews) {
    if (r.verdict !== 'dislike') continue;
    if (r.comment && r.comment.trim()) continue;
    const v = videoById[r.videoId];
    if (!v) continue;
    const ranked = (v.tags || [])
      .map((t) => tagByName[t])
      .filter(Boolean)
      .sort((a, b) => a.net - b.net);
    if (ranked.length === 0) continue;
    out.push({
      videoId: v.id,
      title: v.title,
      suspectTag: ranked[0].tag,
      tagNet: ranked[0].net,
      at: r.at,
    });
  }
  return out.slice(-10).reverse();
}

function renderGuidance(prefer, avoid, likedWords, dislikedWords) {
  const lines = [];
  if (prefer.length > 0) {
    lines.push(
      `- **Lean into:** ${prefer.slice(0, 5).map((r) => `\`${r.tag}\``).join(', ')}`,
    );
  }
  if (avoid.length > 0) {
    lines.push(
      `- **Avoid:** ${avoid.slice(0, 5).map((r) => `\`${r.tag}\``).join(', ')}`,
    );
  }
  const topLiked = rankCounts(likedWords, 5).map(([w]) => `\`${w}\``);
  const topDisliked = rankCounts(dislikedWords, 5).map(([w]) => `\`${w}\``);
  if (topLiked.length > 0) lines.push(`- **Echo themes:** ${topLiked.join(', ')}`);
  if (topDisliked.length > 0) lines.push(`- **Drop themes:** ${topDisliked.join(', ')}`);
  if (lines.length === 0) return '_(not enough signal yet)_';
  return lines.join('\n');
}

function rebuildClaudeMd(reviews, videos) {
  const tagRows = scoreTags(reviews, videos);
  const prefer = preferList(tagRows);
  const avoid = avoidList(tagRows);

  const likedWords = {};
  const dislikedWords = {};
  const commentNotes = [];
  let likes = 0;
  let dislikes = 0;

  for (const r of reviews) {
    if (r.verdict === 'like') likes += 1;
    else if (r.verdict === 'dislike') dislikes += 1;

    if (r.comment && r.comment.trim()) {
      const bucket =
        r.verdict === 'like' ? likedWords : r.verdict === 'dislike' ? dislikedWords : null;
      if (bucket) {
        for (const w of tokenize(r.comment)) bucket[w] = (bucket[w] || 0) + 1;
      }
      commentNotes.push({
        videoId: r.videoId,
        verdict: r.verdict,
        comment: r.comment.trim(),
        at: r.at,
      });
    }
  }

  const suspects = suspectedDislikeReasons(reviews, videos, tagRows);
  const recentNotes = commentNotes.slice(-20).reverse();
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));
  const guidance = renderGuidance(prefer, avoid, likedWords, dislikedWords);

  const md = `# CLAUDE.md — Generation Context

_Auto-generated from like/dislike/comment events. Regenerated on every review._
_Feed this file in as context for the next video generation pass._

**Totals:** ${likes} likes · ${dislikes} dislikes · ${commentNotes.length} comments

## Generation guidance (synthesized)
${guidance}

## Prefer (positive-net tags)
${
  prefer.length === 0
    ? '_(none yet)_'
    : prefer
        .map(
          (r) =>
            `- **${r.tag}** — net +${r.net} (${r.likes} likes / ${r.dislikes} dislikes)`,
        )
        .join('\n')
}

## Avoid (negative-net tags)
${
  avoid.length === 0
    ? '_(none yet)_'
    : avoid
        .map(
          (r) =>
            `- **${r.tag}** — net ${r.net} (${r.likes} likes / ${r.dislikes} dislikes)`,
        )
        .join('\n')
}

## Suspected dislike reasons (algorithmic guesses, no comment provided)
${
  suspects.length === 0
    ? '_(none yet)_'
    : suspects
        .map(
          (s) =>
            `- **${s.title}** — likely the tag _${s.suspectTag}_ (net ${s.tagNet}) · _${s.at}_`,
        )
        .join('\n')
}

## Words associated with likes
${renderList(rankCounts(likedWords))}

## Words associated with dislikes
${renderList(rankCounts(dislikedWords))}

## Recent comment notes
${
  recentNotes.length === 0
    ? '_(none yet)_'
    : recentNotes
        .map((n) => {
          const v = videoById[n.videoId];
          const title = v ? v.title : n.videoId;
          return `- [${n.verdict}] **${title}** — ${n.comment}  \n  _${n.at}_`;
        })
        .join('\n')
}

---

_This file is intended to be fed to the video-generation pipeline as context._
_It will be overwritten on the next review event._
`;

  fs.writeFileSync(CLAUDE_MD_PATH, md, 'utf8');
  return CLAUDE_MD_PATH;
}

function readClaudeMd() {
  if (!fs.existsSync(CLAUDE_MD_PATH)) {
    return '# CLAUDE.md\n\n_(no reviews yet)_\n';
  }
  return fs.readFileSync(CLAUDE_MD_PATH, 'utf8');
}

module.exports = { rebuildClaudeMd, readClaudeMd, CLAUDE_MD_PATH };
