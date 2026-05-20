// AI social-media captions. Gemini watches the approved video and returns
// one caption + a set of hashtags. Generation is async and fire-and-forget;
// progress is tracked on the videos row via caption_status.

const os = require('os');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

const { streamDriveFile } = require('./drive-source');
const db = require('./db');

const DEFAULT_BRAND_PROMPT =
  'You write short, punchy social-media captions for short video clips ' +
  'posted to TikTok and Instagram Reels. The voice is energetic, modern, ' +
  'and confident — never corporate or hashtag-stuffed. Override per ' +
  'deployment via the CAPTION_BRAND_PROMPT env var.';

// Optional call-to-action appended to every caption. Set CAPTION_CTA per
// deployment (e.g. "📞 Call <Brand> at <phone>"). Empty by default.
const DEFAULT_CTA = '';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  // Lazy require so the app still boots if the dependency is missing.
  const { GoogleGenAI } = require('@google/genai');
  return new GoogleGenAI({ apiKey });
}

function parseCaption(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Gemini did not return valid JSON');
  }
  const caption = String(data.caption || '').trim();
  let hashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
  hashtags = hashtags
    .map((h) => String(h).replace(/^#/, '').trim())
    .filter(Boolean);
  if (!caption) throw new Error('Gemini returned an empty caption');
  return { caption, hashtags };
}

// Downloads the clip from Drive, uploads it to Gemini, waits for video
// processing, then asks for a caption. Throws on any failure.
async function generateCaption(video) {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const brand = process.env.CAPTION_BRAND_PROMPT || DEFAULT_BRAND_PROMPT;
  const tmpPath = path.join(
    os.tmpdir(),
    `shuffl-caption-${video.id}-${Date.now()}`,
  );
  let uploaded = null;

  try {
    // 1. Pull the file from Drive (service-account auth) to a temp file.
    const driveRes = await streamDriveFile(video.drive_file_id);
    await pipeline(driveRes.data, fs.createWriteStream(tmpPath));

    // 2. Upload to the Gemini Files API.
    uploaded = await ai.files.upload({
      file: tmpPath,
      config: { mimeType: video.mime_type || 'video/mp4' },
    });

    // 3. Video files are PROCESSING until Gemini finishes ingesting them.
    let info = uploaded;
    const deadline = Date.now() + 120000;
    while (info.state === 'PROCESSING' && Date.now() < deadline) {
      await sleep(2500);
      info = await ai.files.get({ name: uploaded.name });
    }
    if (info.state !== 'ACTIVE') {
      throw new Error(`Gemini file not ready (state=${info.state || 'unknown'})`);
    }

    // 4. Ask for the caption as strict JSON.
    const prompt =
      `${brand}\n\n` +
      'Watch this video clip. Respond with ONLY a JSON object of the shape ' +
      '{"caption": string, "hashtags": string[]}. ' +
      'The caption is one engaging line of at most ~150 characters with no ' +
      'hashtags inside it. Do NOT include a phone number, "call us", ' +
      '"DM us", or any call-to-action in the caption — a CTA is appended ' +
      'automatically. Provide 5-8 relevant hashtags, each without the ' +
      '# symbol.';

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { fileUri: info.uri, mimeType: info.mimeType } },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json' },
    });

    const parsed = parseCaption(response.text);
    // Append the call-to-action — Gemini writes only the caption body.
    // If neither CAPTION_CTA nor DEFAULT_CTA is set, return the caption as-is.
    const cta = process.env.CAPTION_CTA || DEFAULT_CTA;
    const caption = !cta || parsed.caption.includes(cta)
      ? parsed.caption
      : `${parsed.caption}\n\n${cta}`;
    return { caption, hashtags: parsed.hashtags };
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
    if (uploaded && uploaded.name) {
      ai.files.delete({ name: uploaded.name }).catch(() => {});
    }
  }
}

// Orchestrator used by the server. Never throws — records the outcome on
// the videos row so the UI can show progress / errors.
async function generateCaptionFor(videoId) {
  try {
    const video = await db.getVideo(videoId);
    if (!video) return;
    await db.setCaption(videoId, { status: 'generating', error: null });
    const { caption, hashtags } = await generateCaption(video);
    await db.setCaption(videoId, {
      caption,
      hashtags,
      status: 'ready',
      error: null,
    });
    console.log(`[caption] ready for "${video.filename}"`);
  } catch (e) {
    console.warn(`[caption] failed for ${videoId}: ${e.message}`);
    try {
      await db.setCaption(videoId, { status: 'error', error: e.message });
    } catch {
      /* ignore secondary failure */
    }
  }
}

module.exports = { generateCaption, generateCaptionFor };
