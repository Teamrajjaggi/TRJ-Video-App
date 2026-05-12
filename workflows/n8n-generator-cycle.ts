// n8n workflow: "Video Review — Generator Cycle"
//
// Live at: https://tvtai.app.n8n.cloud/workflow/ATpRqLYDcd7H02HF
//
// End-to-end pipeline lives in n8n. The app exposes the parts that need
// server-side state (plan composition, R2 staging, publish):
//
//   [Schedule (3h)]   ──┐
//                        ├─→ Build 5 Jobs ─→ Loop x5 ─→
//   [Manual Trigger]  ──┘
//
//     1. Get Plan                  GET  /api/admin/plan
//     2. Build Gemini Body         Code (fetch refs, base64-encode)
//     3. Call Gemini Nano Banana   POST generativelanguage.googleapis.com
//     4. Extract Gemini Image      Code (pull base64 from response)
//     5. Stage Image to R2         POST /api/admin/stage-image
//     6. Submit DoP Turbo          POST platform.higgsfield.ai/.../dop/turbo
//     7. Poll DoP Until Done       Code (poll status_url every 5s, 4-min cap)
//     8. Publish to Feed           POST /api/admin/publish
//
// Credentials needed in n8n:
//   - "Video Review Admin"       Header Auth, Authorization: Bearer <ADMIN_API_TOKEN>
//   - "Gemini API Key (Query)"   Query Auth,  key=<GEMINI_API_KEY>
//   - "Higgsfield API"           Header Auth, Authorization: Key <KEY_ID>:<API_KEY>
//
// Env vars needed on n8n (the Poll node reads them via $env, since Code
// nodes can't reuse other nodes' credentials):
//   - HIGGSFIELD_KEY_ID
//   - HIGGSFIELD_API_KEY

import {
  workflow,
  node,
  trigger,
  splitInBatches,
  nextBatch,
  sticky,
  newCredential,
  placeholder,
  expr,
} from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 3 Hours',
    parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 3 }] } },
    position: [240, 200],
  },
  output: [{}],
});

const manualTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Manually', position: [240, 500] },
  output: [{}],
});

const fanOut = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build 5 Generation Jobs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'return Array.from({ length: 5 }, (_, i) => ({ json: { index: i + 1 } }));',
    },
    position: [540, 350],
  },
  output: [{ index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }, { index: 5 }],
});

const getPlan = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Plan',
    parameters: {
      method: 'GET',
      url: placeholder('Your app URL + /api/admin/plan'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [840, 350],
  },
  output: [{ plan: { winner: 'A' }, imagePrompt: '...', motionPrompt: '...', title: '...', description: '...', tags: [], referenceUrls: [] }],
});

const buildGeminiBody = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Gemini Request Body',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const planItem = $input.first().json;\n" +
        "const refs = planItem.referenceUrls || [];\n" +
        "const parts = [{ text: planItem.imagePrompt }];\n" +
        "for (const url of refs) {\n" +
        "  try {\n" +
        "    const r = await this.helpers.httpRequest({ method: 'GET', url, returnFullResponse: true, encoding: 'arraybuffer' });\n" +
        "    let mime = (r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || '';\n" +
        "    if (!String(mime).startsWith('image/')) {\n" +
        "      if (/\\.png(?:\\?|$)/i.test(url)) mime = 'image/png';\n" +
        "      else mime = 'image/jpeg';\n" +
        "    }\n" +
        "    const buf = Buffer.from(r.body).toString('base64');\n" +
        "    parts.push({ inlineData: { mimeType: mime, data: buf } });\n" +
        "  } catch (e) {}\n" +
        "}\n" +
        "return [{ json: {\n" +
        "  body: { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'] } },\n" +
        "  plan: planItem.plan,\n" +
        "  imagePrompt: planItem.imagePrompt,\n" +
        "  motionPrompt: planItem.motionPrompt,\n" +
        "  title: planItem.title,\n" +
        "  description: planItem.description,\n" +
        "  tags: planItem.tags,\n" +
        "  refCount: parts.length - 1\n" +
        "} }];",
    },
    position: [1140, 350],
  },
  output: [{ body: {}, plan: {}, motionPrompt: '...', title: '...', description: '...', tags: [], refCount: 2 }],
});

const callGemini = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Call Gemini Nano Banana',
    parameters: {
      method: 'POST',
      url: placeholder('https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpQueryAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 180000 },
    },
    credentials: { httpQueryAuth: newCredential('Gemini API Key (Query)') },
    position: [1440, 350],
  },
  output: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: '...' } }] } }] }],
});

const extractImage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Gemini Image',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const gem = $input.first().json;\n" +
        "const planMeta = $('Build Gemini Request Body').item.json;\n" +
        "const cand = gem && gem.candidates && gem.candidates[0];\n" +
        "if (!cand) throw new Error('Gemini returned no candidates: ' + JSON.stringify(gem).slice(0, 400));\n" +
        "const parts = (cand.content && cand.content.parts) || [];\n" +
        "const part = parts.find(p => p.inlineData && p.inlineData.data);\n" +
        "if (!part) throw new Error('Gemini returned no inline image: ' + JSON.stringify(gem).slice(0, 400));\n" +
        "return [{ json: {\n" +
        "  data: part.inlineData.data,\n" +
        "  mimeType: part.inlineData.mimeType || 'image/png',\n" +
        "  plan: planMeta.plan,\n" +
        "  motionPrompt: planMeta.motionPrompt,\n" +
        "  title: planMeta.title,\n" +
        "  description: planMeta.description,\n" +
        "  tags: planMeta.tags,\n" +
        "  prompt: planMeta.imagePrompt\n" +
        "} }];",
    },
    position: [1740, 350],
  },
  output: [{ data: '<base64>', mimeType: 'image/png', plan: {}, motionPrompt: '...', title: '...', description: '...', tags: [], prompt: '...' }],
});

const stageImage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Stage Image to R2',
    parameters: {
      method: 'POST',
      url: placeholder('Your app URL + /api/admin/stage-image'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ data: $json.data, mimeType: $json.mimeType }) }}'),
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [2040, 350],
  },
  output: [{ ok: true, key: 'staging/...png', url: 'https://pub-xxx.r2.dev/staging/...png' }],
});

const submitDop = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Submit DoP Turbo',
    parameters: {
      method: 'POST',
      url: placeholder('https://platform.higgsfield.ai/higgsfield-ai/dop/turbo'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ prompt: $('Extract Gemini Image').item.json.motionPrompt, image_url: $json.url, aspect_ratio: '9:16', duration: 5 }) }}",
      ),
    },
    credentials: { httpHeaderAuth: newCredential('Higgsfield API') },
    position: [2340, 350],
  },
  output: [{ status: 'queued', request_id: 'abc', status_url: 'https://platform.higgsfield.ai/requests/abc/status' }],
});

const pollDop = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Poll DoP Until Done',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const sub = $input.first().json;\n" +
        "const statusUrl = sub.status_url;\n" +
        "if (!statusUrl) throw new Error('no status_url in submit response: ' + JSON.stringify(sub).slice(0, 300));\n" +
        "const keyId = $env.HIGGSFIELD_KEY_ID;\n" +
        "const apiKey = $env.HIGGSFIELD_API_KEY;\n" +
        "if (!keyId || !apiKey) throw new Error('Set HIGGSFIELD_KEY_ID and HIGGSFIELD_API_KEY in n8n env');\n" +
        "const cred = keyId + ':' + apiKey;\n" +
        "const deadline = Date.now() + 4 * 60 * 1000;\n" +
        "const interval = 5000;\n" +
        "const TERMINAL_FAIL = ['failed', 'nsfw', 'cancelled', 'canceled', 'rejected'];\n" +
        "while (Date.now() < deadline) {\n" +
        "  const data = await this.helpers.httpRequest({ method: 'GET', url: statusUrl, headers: { Authorization: 'Key ' + cred }, json: true });\n" +
        "  const status = String((data && data.status) || '').toLowerCase();\n" +
        "  if (status === 'completed') return [{ json: data }];\n" +
        "  if (TERMINAL_FAIL.indexOf(status) >= 0) throw new Error('Higgsfield job ' + status + ': ' + JSON.stringify(data).slice(0, 300));\n" +
        "  await new Promise(r => setTimeout(r, interval));\n" +
        "}\n" +
        "throw new Error('Higgsfield poll timed out after 4 minutes');",
    },
    position: [2640, 350],
  },
  output: [{ status: 'completed', video: { url: 'https://...mp4' } }],
});

const publishVideo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Publish to Feed',
    parameters: {
      method: 'POST',
      url: placeholder('Your app URL + /api/admin/publish'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ title: $('Extract Gemini Image').item.json.title, description: $('Extract Gemini Image').item.json.description, src: $json.video.url, poster: $('Stage Image to R2').item.json.url, tags: $('Extract Gemini Image').item.json.tags, prompt: $('Extract Gemini Image').item.json.prompt }) }}",
      ),
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [2940, 350],
  },
  output: [{ ok: true, video: { id: 'vid_...' } }],
});

const loop = splitInBatches({
  version: 3,
  config: { name: 'Loop (5 generations)', parameters: { batchSize: 1 }, position: [840, 600] },
});

const cycleDone = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Cycle Done',
    parameters: {
      mode: 'manual',
      assignments: { assignments: [{ id: 'status', name: 'status', value: 'cycle complete', type: 'string' }] },
    },
    position: [1140, 700],
  },
  output: [{ status: 'cycle complete' }],
});

const howToNote = sticky(
  '## Generator cycle\n\nSchedule + Manual triggers → Build 5 jobs → loop x5 → for each:\n' +
    '1. Get Plan (from app)\n2. Build Gemini Request Body (fetch refs, base64)\n3. Call Gemini Nano Banana\n' +
    '4. Extract Gemini Image\n5. Stage Image to R2 (via app)\n6. Submit DoP Turbo\n7. Poll DoP Until Done\n' +
    '8. Publish to Feed (via app)\n\n**Credentials needed:**\n' +
    '- `Video Review Admin` → Header Auth, Authorization: Bearer <ADMIN_API_TOKEN>\n' +
    '- `Gemini API Key (Query)` → Query Auth, key=<GEMINI_API_KEY>\n' +
    '- `Higgsfield API` → Header Auth, Authorization: Key <KEY_ID>:<API_KEY>\n\n' +
    '**Env vars on n8n** (for Poll node):\n- HIGGSFIELD_KEY_ID\n- HIGGSFIELD_API_KEY',
  [scheduleTrigger, manualTrigger, fanOut, loop],
  { color: 5 },
);

export default workflow('video-review-generator', 'Video Review — Generator Cycle')
  .add(scheduleTrigger)
  .to(fanOut)
  .to(
    loop.onDone(cycleDone).onEachBatch(
      getPlan
        .to(buildGeminiBody)
        .to(callGemini)
        .to(extractImage)
        .to(stageImage)
        .to(submitDop)
        .to(pollDop)
        .to(publishVideo.to(nextBatch(loop))),
    ),
  )
  .add(manualTrigger)
  .to(fanOut);
