const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { callHiggsfield } = require('./video-gen');
const { selfReview } = require('./review-gate');
const { readClaudeMd } = require('./claude-md');

const VIDEOS_PATH = path.join(__dirname, '..', 'data', 'videos.json');
const GEN_LOG_PATH = path.join(__dirname, '..', 'data', 'generation-log.json');

function readJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function appendGenLog(entry) {
  const log = readJson(GEN_LOG_PATH, []);
  log.push({ ...entry, at: new Date().toISOString() });
  writeJson(GEN_LOG_PATH, log);
}

function newVideoId() {
  return `vid_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// Publish a fully-formed video record to the feed. Used by both the internal
// fallback pipeline and the external n8n workflow (via /api/admin/publish).
function publishVideo(video) {
  if (!video || !video.src || !video.title) {
    throw new Error('publishVideo requires { src, title }');
  }
  const videos = readJson(VIDEOS_PATH, []);
  const entry = {
    id: video.id || newVideoId(),
    title: video.title,
    description: video.description || '',
    src: video.src,
    poster: video.poster || '',
    tags: Array.isArray(video.tags) ? video.tags : [],
    prompt: video.prompt || '',
    postedAt: new Date().toISOString(),
  };
  videos.push(entry);
  writeJson(VIDEOS_PATH, videos);
  appendGenLog({ stage: 'published', videoId: entry.id });
  return entry;
}

// Internal fallback pipeline: generate -> self-review -> publish.
// The real generation flow is expected to live in n8n; this is what runs when
// the admin clicks "Generate" without n8n configured.
async function generateOneInternal(prompt) {
  const context = readClaudeMd();
  appendGenLog({ stage: 'generation_started', prompt });
  const draft = await callHiggsfield({ prompt, context });
  appendGenLog({ stage: 'generation_finished', title: draft.title });

  const gate = selfReview({ ...draft, tags: draft.tags || [] }, context);
  if (!gate.ok) {
    appendGenLog({ stage: 'rejected_by_self_review', reasons: gate.reasons });
    return { posted: false, review: gate };
  }

  const published = publishVideo(draft);
  return { posted: true, review: gate, video: published };
}

module.exports = { publishVideo, generateOneInternal };
