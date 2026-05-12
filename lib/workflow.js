const crypto = require('crypto');

const { callHiggsfield } = require('./video-gen');
const { selfReview } = require('./review-gate');
const { readClaudeMd } = require('./claude-md');
const { composePrompt } = require('./prompt');
const { getDb } = require('./db');

function newVideoId() {
  return `vid_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// Publish a fully-formed video record to the feed. Used by both the internal
// fallback pipeline and the external n8n workflow (via /api/admin/publish).
function publishVideo(video) {
  if (!video || !video.src || !video.title) {
    throw new Error('publishVideo requires { src, title }');
  }
  const entry = {
    id: video.id || newVideoId(),
    title: video.title,
    description: video.description || '',
    src: video.src,
    poster: video.poster || '',
    tags: Array.isArray(video.tags) ? video.tags : [],
    prompt: video.prompt || '',
    postedAt: new Date().toISOString(),
    source: video.source || {},
  };
  getDb()
    .prepare(
      `INSERT INTO videos (id, title, description, src, poster, tags, prompt, posted_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entry.id,
      entry.title,
      entry.description,
      entry.src,
      entry.poster,
      JSON.stringify(entry.tags),
      entry.prompt,
      entry.postedAt,
      JSON.stringify(entry.source),
    );
  return entry;
}

// Pipeline: compose prompt -> generate (Higgsfield CLI) -> self-review -> publish.
async function generateOneInternal(extraInstructions) {
  const context = readClaudeMd();
  const composed = composePrompt(context);
  const fullPrompt = extraInstructions
    ? `${composed.user}\n\n## Extra instructions for this run\n${extraInstructions}`
    : composed.user;

  const draft = await callHiggsfield({ prompt: fullPrompt, context });
  const gate = selfReview({ ...draft, tags: draft.tags || [] }, context);
  if (!gate.ok) {
    return { posted: false, review: gate };
  }
  const published = publishVideo(draft);
  return { posted: true, review: gate, video: published };
}

module.exports = { publishVideo, generateOneInternal };
