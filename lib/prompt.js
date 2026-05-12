const fs = require('fs');
const path = require('path');

const SYSTEM_PATH = path.join(__dirname, '..', 'prompts', 'system.md');
const USER_TEMPLATE_PATH = path.join(__dirname, '..', 'prompts', 'user-template.md');
const REVIEWS_PATH = path.join(__dirname, '..', 'data', 'reviews.json');
const VIDEOS_PATH = path.join(__dirname, '..', 'data', 'videos.json');

function readFileSafe(p, fallback = '') {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return fallback;
  }
}
function readJsonSafe(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function pickRecentNotes(verdict, limit = 10) {
  const reviews = readJsonSafe(REVIEWS_PATH, []);
  const videos = readJsonSafe(VIDEOS_PATH, []);
  const byId = Object.fromEntries(videos.map((v) => [v.id, v]));
  return reviews
    .filter((r) => r.verdict === verdict && r.comment && r.comment.trim())
    .slice(-limit)
    .reverse()
    .map((r) => {
      const v = byId[r.videoId];
      const title = v ? v.title : r.videoId;
      return `- "${r.comment.trim()}" — about "${title}" (${r.at})`;
    })
    .join('\n');
}

function composePrompt(contextMarkdown) {
  const system = readFileSafe(SYSTEM_PATH);
  const tmpl = readFileSafe(USER_TEMPLATE_PATH);
  const recentDislikes = pickRecentNotes('dislike') || '(none yet)';
  const recentLikes = pickRecentNotes('like') || '(none yet)';
  const user = tmpl
    .replace('{{CONTEXT}}', contextMarkdown || '(no context yet)')
    .replace('{{RECENT_DISLIKE_NOTES}}', recentDislikes)
    .replace('{{RECENT_LIKE_NOTES}}', recentLikes);

  return {
    system,
    user,
    composedAt: new Date().toISOString(),
  };
}

module.exports = { composePrompt };
