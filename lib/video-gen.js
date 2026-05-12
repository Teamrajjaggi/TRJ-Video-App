// Stub for the video generation step (e.g. Higgsfield).
// Replace the body of callHiggsfield() with the actual API call.
// The function receives the synthesized CLAUDE.md context + the user's prompt
// guidelines (provided later) and must return a fully-formed video record.

const SAMPLE_SOURCES = [
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerMeltdowns.jpg',
  },
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
  },
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg',
  },
  {
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    poster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
  },
];

async function callHiggsfield({ prompt, context }) {
  // STUB ONLY. Replace with real Higgsfield SDK / HTTP call.
  // Inputs:
  //   prompt: user-supplied guideline (string)
  //   context: full CLAUDE.md content (string)
  // Output: { src, poster, title, description, tags, prompt }
  const sample = SAMPLE_SOURCES[Math.floor(Math.random() * SAMPLE_SOURCES.length)];
  const seed = Math.random().toString(36).slice(2, 8);
  return {
    src: sample.src,
    poster: sample.poster,
    title: `Generated draft ${seed}`,
    description: prompt ? `Generated from prompt: ${prompt.slice(0, 80)}` : 'Generated draft',
    tags: ['generated', 'draft'],
    prompt: prompt || '',
    contextDigest: context ? context.length : 0,
  };
}

module.exports = { callHiggsfield };
