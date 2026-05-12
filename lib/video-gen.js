// Two-stage generation pipeline:
//   1) Pick a scene plan (winner, location, reason, outfits, clip type)
//   2) Compose image + motion prompts from prompts/playbook/*
//   3) Call Higgsfield image gen     (-> still image)
//   4) Call Higgsfield image-to-video (-> short clip)
//
// On any failure, falls back to a sample-video stub so the rest of the
// review loop keeps working.

const { generateImage, generateVideoFromImage, isDisabled } = require('./higgsfield-api');
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

async function callHiggsfield({ prompt: extraInstructions } = {}) {
  const plan = pickPlan();
  const imagePrompt = composeImagePrompt(plan);
  const motionPrompt = composeMotionPrompt(plan);
  const fullImagePrompt = extraInstructions
    ? `${imagePrompt}\n\n## Extra instructions\n${extraInstructions}`
    : imagePrompt;

  if (isDisabled()) {
    return stubDraft(plan, 'no Higgsfield credentials');
  }

  try {
    const img = await generateImage({ prompt: fullImagePrompt });
    const vid = await generateVideoFromImage({
      prompt: motionPrompt,
      imageUrl: img.imageUrl,
    });
    return {
      src: vid.videoUrl,
      poster: img.imageUrl,
      title: titleFor(plan),
      description: descriptionFor(plan),
      tags: tagsFor(plan),
      prompt: fullImagePrompt,
      source: 'higgsfield',
      plan,
    };
  } catch (e) {
    console.warn('[video-gen] pipeline failed, falling back to stub:', e.message);
    return stubDraft(plan, e.message.slice(0, 140));
  }
}

module.exports = { callHiggsfield };
