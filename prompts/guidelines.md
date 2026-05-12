# Prompt-tuning guidelines

Quick reference for changing how the generator behaves without touching code.

## File map

| File | What it does | When to edit |
| --- | --- | --- |
| `prompts/playbook/image-baseline.md` | Image prompt sent to Higgsfield Soul | When the still images look wrong (composition, lighting, identity, style) |
| `prompts/playbook/motion-baseline.md` | Motion prompt sent to Higgsfield DoP turbo | When clips drift (camera moves, fighters morph, motion looks fake) |
| `data/playbook-variables.json` | Pool of locations / reasons / outfits / clip types / camera angles | When you want more variety, fewer of one kind, or to fix a specific scene |
| `prompts/subjects.local.md` (gitignored) | Per-subject appearance and demeanor | When the AI keeps getting the look of a specific subject wrong |

Every change takes effect on the **next** Generate — no rebuild, no restart needed (the templates and variables file are read fresh on every run).

## The 6 playbook rules — where each one lives

| Rule | Where it's enforced |
| --- | --- |
| 1. Only the two subjects fight | Image template "Who is in this image" section |
| 2. Camera locked, no movement inside a clip | Motion template "camera is locked off" paragraph |
| 3. Fighters look the same in every clip | Motion template "look identical to the starting image" paragraph |
| 4. Kling prompts stay short | Motion template is intentionally one short paragraph |
| 5. Don't make either fighter look bad | Image template "Rendering" section + every clip type's `action` |
| 6. Every video changes 4 things | `lib/playbook.js` randomizes winner / location / reason / outfits per Generate |

## How the prompt is assembled

```
For each Generate:
  1. lib/playbook.js picks one item each from:
       - locations
       - reasons
       - outfits  (one for A, one for B)
       - cameraAngles
       - clipTypes
       - musicVibes
     and decides the winner (A or B).
  2. lib/playbook.js reads:
       - prompts/playbook/image-baseline.md  (template)
       - prompts/subjects.local.md           (your subject descriptions)
       - .env                                 (subject names + reference URLs)
     and substitutes everything into the template.
  3. The composed image prompt is POSTed to Higgsfield Soul standard.
  4. The returned image URL + a short motion prompt (composed from
     prompts/playbook/motion-baseline.md and the clip type's klingMotion)
     is POSTed to Higgsfield DoP turbo.
  5. The returned video URL is published to the feed.
```

## Common tuning recipes

### "The face still doesn't look right"

1. Verify the reference URL loads (paste it into a browser private tab).
2. Add more facial detail to `prompts/subjects.local.md` — eye shape, jaw, nose
   width, ear placement, beard/stubble pattern.
3. Switch image model to character mode in `.env`:
   ```
   HIGGSFIELD_IMAGE_MODEL=higgsfield-ai/soul/character
   ```
   Character mode is built specifically for identity lock with a reference image.

### "Same scene over and over"

Add new entries to `data/playbook-variables.json` → `locations` and `reasons`.
The randomizer weights every entry equally.

### "Too many fight scenes, want more promo / non-fight stuff"

Add new clip types to `clipTypes` with `action` and `klingMotion` fields. Promo
ideas already in there: weigh-in staredown, podcast argument, club bottle slam,
shove that escalates, bystanders pulling them apart. Add more along those lines.

### "Always ends in a knockout — want some that don't"

The randomizer picks any clip type. To bias toward non-knockout clips, just add
more non-knockout entries (or remove `knockout-a` / `knockout-b`).

### "Want a specific scene right now"

Currently the picker is random per Generate. To force a specific clip type,
edit `lib/playbook.js#pickPlan` and pass `{ preferredClipType: "weigh-in" }`.
Quick UI version of this is on the roadmap.

### "Camera moves inside a clip"

Tighten the motion template — DoP turbo sometimes drifts. Add stronger language
like "absolutely no camera motion of any kind, the camera is bolted to a tripod
that does not move."

### "Subjects morph between starting image and end of clip"

Same — tighten motion template. Also keep `HIGGSFIELD_DURATION` at 5 (longer
clips drift more). Don't bump it past 10.

## What goes in the image prompt vs the Kling prompt

Per Rule 4 — image prompt is long, Kling is short.

**Image prompt:** identity lock, full scene description, lighting, camera, framing,
wardrobe, every visual detail you want.

**Kling prompt:** only what's *moving* in this clip. One to three sentences,
plus the consistency block. If you find yourself re-describing the scene in the
Kling prompt, stop — that detail belongs in the image instead.

## Rendering tips that actually help

- Specify a real lens and aperture (24mm at f/11). Vague camera language gives
  vague images.
- Always request photorealistic + ultra-detailed skin texture explicitly.
- Always mention 9:16 vertical and the framing percentages.
- Always say "no text, no letters, no logos, no watermarks." Models love to
  hallucinate text otherwise.
- Always state where each subject is in the frame (left / right / center).
- Always describe the lighting source (overhead fluorescent, golden hour,
  neon, etc.). Light direction sells realism.

## Things that hurt the output

- Negative prompts inside the positive prompt ("not blurry, not stylized") — Soul
  reads those as suggestions to do them. Always frame requirements positively.
- Conflicting instructions (saying "low angle" + "eye level" in the same prompt).
- Vague locations ("a place"). Specifics generate better.
- Asking for too many people in the action. Keep the action to two.

## Who can edit what without me

- `data/playbook-variables.json` — add / remove items, never breaks
- `prompts/subjects.local.md` — rewrite descriptions, never breaks
- `prompts/playbook/image-baseline.md` — keep the `{{PLACEHOLDER}}` tokens in,
  rewrite anything else
- `prompts/playbook/motion-baseline.md` — keep `{{CLIP_MOTION}}` in, rewrite
  anything else
- `.env` — model overrides (`HIGGSFIELD_IMAGE_MODEL`, `HIGGSFIELD_VIDEO_MODEL`,
  `HIGGSFIELD_DURATION`, `HIGGSFIELD_ASPECT`)

If you change a placeholder name (e.g. invent `{{NEW_THING}}`), `lib/playbook.js`
needs to know about it — that one's a code change.
