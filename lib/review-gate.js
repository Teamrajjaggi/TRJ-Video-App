// Self-review gate. Confirms that a generated video is not wildly out of
// context bounds before publishing. Replace heuristics with model-based checks
// later; for now we do simple structural checks.

function selfReview(video, contextText) {
  const reasons = [];

  if (!video || !video.src) reasons.push('missing src');
  if (!video.title) reasons.push('missing title');
  if (!Array.isArray(video.tags)) reasons.push('tags must be an array');

  // If CLAUDE.md has an "Avoid" section with tags, reject overlap.
  const avoidTags = parseAvoidTags(contextText || '');
  if (avoidTags.length > 0 && Array.isArray(video.tags)) {
    const overlap = video.tags.filter((t) =>
      avoidTags.includes(String(t).toLowerCase()),
    );
    if (overlap.length > 0) {
      reasons.push(`tags overlap with avoid list: ${overlap.join(', ')}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function parseAvoidTags(md) {
  const match = md.match(/##\s+Avoid[\s\S]*?(?=\n##\s|\n---|$)/i);
  if (!match) return [];
  const out = [];
  for (const line of match[0].split('\n')) {
    const m = line.match(/^-\s+\*\*([^*]+)\*\*/);
    if (m) out.push(m[1].toLowerCase().trim());
  }
  return out;
}

module.exports = { selfReview };
