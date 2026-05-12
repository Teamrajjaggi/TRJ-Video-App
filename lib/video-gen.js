// Bridge from the workflow to the actual video generator.
//
// Tries the real Higgsfield CLI first (via lib/higgsfield-cli.js); falls back
// to a sample-video stub when:
//   - HIGGSFIELD_DISABLED=1
//   - the CLI isn't installed / not authenticated
//   - the CLI errors out for any reason
//
// The stub lets the rest of the loop keep working while you tune Higgsfield.

const { generateVideo, isDisabled } = require('./higgsfield-cli');

const STUB_SOURCES = [
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
  },
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
  },
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
  },
];

function stubDraft(prompt, why) {
  const sample = STUB_SOURCES[Math.floor(Math.random() * STUB_SOURCES.length)];
  const seed = Math.random().toString(36).slice(2, 8);
  return {
    src: sample.src,
    poster: sample.poster,
    title: `Stub draft ${seed}`,
    description: why ? `[stub: ${why}]` : '[stub]',
    tags: ['generated', 'stub'],
    prompt: prompt || '',
    source: 'stub',
  };
}

async function callHiggsfield({ prompt, context }) {
  // The prompt arg coming in is the user's instructions; context is the
  // CLAUDE.md. We rely on lib/prompt.js#composePrompt being used upstream to
  // produce a single combined prompt; if not, we still concatenate here.
  const fullPrompt =
    context && !String(prompt || '').includes(String(context).slice(0, 32))
      ? `${prompt || ''}\n\n## Reviewer context\n${context}`
      : prompt || '';

  if (isDisabled()) {
    return stubDraft(fullPrompt, 'HIGGSFIELD_DISABLED');
  }

  try {
    const result = await generateVideo({ prompt: fullPrompt });
    return {
      src: result.src,
      poster: result.raw?.thumbnail_url || result.raw?.poster || '',
      title:
        result.raw?.title ||
        `Higgsfield draft ${Math.random().toString(36).slice(2, 7)}`,
      description: result.raw?.description || 'Generated via Higgsfield CLI',
      tags: Array.isArray(result.raw?.tags)
        ? result.raw.tags
        : ['generated', 'higgsfield'],
      prompt: fullPrompt,
      source: 'higgsfield',
    };
  } catch (e) {
    console.warn('[video-gen] Higgsfield CLI failed, falling back to stub:', e.message);
    return stubDraft(fullPrompt, e.message.slice(0, 80));
  }
}

module.exports = { callHiggsfield };
