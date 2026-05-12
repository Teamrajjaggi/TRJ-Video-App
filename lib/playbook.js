// Playbook composer.
// Picks random scene variables (winner, location, reason, outfits, clip type)
// from data/playbook-variables.json and fills the prompt templates.
//
// Subject names are read from env (SUBJECT_A_NAME / SUBJECT_B_NAME) so they
// never live in source control. If unset, generic placeholders are used so
// the pipeline still runs but identity lock won't work.

const fs = require('fs');
const path = require('path');

const VARS_PATH = path.join(__dirname, '..', 'data', 'playbook-variables.json');
const IMAGE_TMPL_PATH = path.join(__dirname, '..', 'prompts', 'playbook', 'image-baseline.md');
const MOTION_TMPL_PATH = path.join(__dirname, '..', 'prompts', 'playbook', 'motion-baseline.md');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function subjectNames() {
  return {
    a: process.env.SUBJECT_A_NAME || 'Subject A',
    b: process.env.SUBJECT_B_NAME || 'Subject B',
    aRef: process.env.SUBJECT_A_REFERENCE || '[reference image of Subject A]',
    bRef: process.env.SUBJECT_B_REFERENCE || '[reference image of Subject B]',
  };
}

// Pick a coherent set of variables for one clip.
function pickPlan({ preferredClipType, preferredWinner } = {}) {
  const vars = readJson(VARS_PATH);
  const winner = preferredWinner || (Math.random() < 0.5 ? 'A' : 'B');

  // If a clip type is forced, find it; otherwise pick a random one that
  // matches the chosen winner (so a knockout-a clip implies winner A).
  let clipType;
  if (preferredClipType) {
    clipType = vars.clipTypes.find((c) => c.id === preferredClipType);
  }
  if (!clipType) {
    const pool = vars.clipTypes.filter((c) => {
      if (c.id === 'knockout-a' || c.id === 'victory-a') return winner === 'A';
      if (c.id === 'knockout-b' || c.id === 'victory-b') return winner === 'B';
      return true;
    });
    clipType = pick(pool);
  }

  return {
    winner,
    location: pick(vars.locations),
    reason: pick(vars.reasons),
    outfitA: pick(vars.outfits),
    outfitB: pick(vars.outfits),
    cameraAngle: pick(vars.cameraAngles),
    clipType,
    musicVibe: pick(vars.musicVibes),
  };
}

function interpolate(template, replacements) {
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return out;
}

function composeImagePrompt(plan) {
  const tmpl = fs.readFileSync(IMAGE_TMPL_PATH, 'utf8');
  const { a, b, aRef, bRef } = subjectNames();
  const action = plan.clipType.action
    .replace(/Subject A/g, a)
    .replace(/Subject B/g, b);
  return interpolate(tmpl, {
    SUBJECT_A_NAME: a,
    SUBJECT_B_NAME: b,
    SUBJECT_A_REFERENCE: aRef,
    SUBJECT_B_REFERENCE: bRef,
    LOCATION: plan.location,
    REASON: plan.reason,
    OUTFIT_A: plan.outfitA,
    OUTFIT_B: plan.outfitB,
    CAMERA_ANGLE: plan.cameraAngle,
    CLIP_ACTION: action,
  });
}

function composeMotionPrompt(plan) {
  const tmpl = fs.readFileSync(MOTION_TMPL_PATH, 'utf8');
  const { a, b } = subjectNames();
  const motion = plan.clipType.klingMotion
    .replace(/Subject A/g, a)
    .replace(/Subject B/g, b);
  return interpolate(tmpl, { CLIP_MOTION: motion });
}

// Title intentionally avoids subject names — keeps the feed neutral-looking.
function titleFor(plan) {
  return `${plan.clipType.label} · ${plan.location}`;
}

function tagsFor(plan) {
  return [
    plan.clipType.id,
    slug(plan.location),
    slug(plan.reason),
    `winner-${plan.winner.toLowerCase()}`,
    slug(plan.outfitA),
    slug(plan.outfitB),
  ];
}

function descriptionFor(plan) {
  return `${plan.reason}. ${plan.clipType.label}.`;
}

module.exports = {
  pickPlan,
  composeImagePrompt,
  composeMotionPrompt,
  titleFor,
  tagsFor,
  descriptionFor,
};
