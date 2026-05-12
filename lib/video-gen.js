// Two-stage generation pipeline:
//   1) Pick a scene plan (winner, location, reason, outfits, clip type)
//   2) Compose image + motion prompts from prompts/playbook/*
//   3) Gemini Nano Banana generates the still (with subject reference photos
//      passed in as inline data for identity lock)
//   4) Upload the still to R2 (staging/) so we have a public URL
//   5) Higgsfield DoP turbo animates that URL into a clip
//
// On any failure, falls back to a sample-video stub so the rest of the
// review loop keeps working.

const crypto = require('crypto');

const { generateImage: geminiGenerateImage, isDisabled: geminiDisabled } =
  require('./gemini-image');
const {
  generateVideoFromImage,
  isDisabled: higgsfieldDisabled,
} = require('./higgsfield-api');
const { putObject, r2Configured } = require('./r2');
const {
  pickPlan,
  composeImagePrompt,
  composeMotionPrompt,
  titleFor,
  tagsFor,
  descriptionFor,
} = require('./playbook');

const STUB_SOURCES = [
  {
    src: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    poster: 'https://media.w3.org/2010/05/sintel/poster.png',
  },
  {
    src: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    poster: 'https://media.w3.org/2010/05/bunny/poster.png',
  },
  {
    src: 'https://vjs.zencdn.net/v/oceans.mp4',
    poster: 'https://vjs.zencdn.net/v/oceans.png',
  },
];

function stubDraft(plan, why) {
  const sample = STUB_SOURCES[Math.floor(Math.random() * STUB_SOURCES.length)];
  const seed = Math.random().toString(36).slice(2, 7);
  return {
    src: sample.src,
    poster: sample.poster,
    title: `Stub · ${plan ? plan.clipType.label : 'no plan'} (${seed})`,
    description: why ? `[stub: ${why}]` : '[stub]',
    tags: plan ? ['stub', ...tagsFor(plan)] : ['stub'],
    prompt: '',
    source: 'stub',
    plan: plan || null,
  };
}

function collectReferenceUrls() {
  const urls = [];
  if (process.env.SUBJECT_A_REFERENCE) urls.push(process.env.SUBJECT_A_REFERENCE);
  if (process.env.SUBJECT_B_REFERENCE) urls.push(process.env.SUBJECT_B_REFERENCE);
  return urls;
}

function stagingKey(mimeType) {
  const ext = (mimeType || '').includes('png')
    ? 'png'
    : (mimeType || '').includes('webp')
      ? 'webp'
      : 'jpg';
  const stamp = Date.now();
  const rand = crypto.randomBytes(3).toString('hex');
  return `staging/${stamp}-${rand}.${ext}`;
}

async function callHiggsfield({ prompt: extraInstructions } = {}) {
  const plan = pickPlan();
  const imagePrompt = composeImagePrompt(plan);
  const motionPrompt = composeMotionPrompt(plan);
  const fullImagePrompt = extraInstructions
    ? `${imagePrompt}\n\n## Extra instructions\n${extraInstructions}`
    : imagePrompt;

  if (geminiDisabled()) {
    return stubDraft(plan, 'GEMINI_API_KEY not set');
  }
  if (higgsfieldDisabled()) {
    return stubDraft(plan, 'Higgsfield credentials not set');
  }
  if (!r2Configured()) {
    return stubDraft(plan, 'R2 not configured (need bucket to stage images)');
  }

  try {
    // Stage 1: Gemini Nano Banana → image bytes (with refs for identity lock)
    const refs = collectReferenceUrls();
    const img = await geminiGenerateImage({
      prompt: fullImagePrompt,
      referenceUrls: refs,
    });

    // Stage 1.5: stage the image into R2 so DoP can fetch it via public URL
    const key = stagingKey(img.mimeType);
    const staged = await putObject({
      key,
      body: img.imageBuffer,
      contentType: img.mimeType,
    });
    if (!staged?.url) {
      throw new Error('R2 staging returned no public URL — set R2_PUBLIC_BASE_URL');
    }
    console.log(`[video-gen] staged Gemini image at ${staged.url}`);

    // Stage 2: Higgsfield DoP turbo image-to-video
    const vid = await generateVideoFromImage({
      prompt: motionPrompt,
      imageUrl: staged.url,
    });

    return {
      src: vid.videoUrl,
      poster: staged.url,
      title: titleFor(plan),
      description: descriptionFor(plan),
      tags: tagsFor(plan),
      prompt: fullImagePrompt,
      source: 'gemini+higgsfield',
      plan,
    };
  } catch (e) {
    console.warn('[video-gen] pipeline failed, falling back to stub:', e.message);
    return stubDraft(plan, e.message.slice(0, 140));
  }
}

module.exports = { callHiggsfield };
