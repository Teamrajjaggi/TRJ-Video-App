// n8n workflow: "Video Review — Generator Cycle"
//
// Live in n8n at:
//   https://tvtai.app.n8n.cloud/workflow/ATpRqLYDcd7H02HF
//
// Pipeline per cycle (every 3h or on manual trigger), 5 generations per cycle:
//   1. Fetch Next Prompt   → GET  /api/admin/next-prompt
//                            returns { system, user } with CLAUDE.md baked in
//   2. Call Higgsfield     → POST <Higgsfield endpoint>
//                            you wire the real URL + API key here
//   3. Normalize           → adapts Higgsfield's response to /publish's shape
//   4. Publish to Feed     → POST /api/admin/publish

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

const fanOutFiveJobs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build 5 Generation Jobs',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'return Array.from({ length: 5 }, (_, i) => ({ json: { index: i + 1 } }));',
    },
    position: [540, 350],
  },
  output: [{ index: 1 }, { index: 2 }, { index: 3 }, { index: 4 }, { index: 5 }],
});

const fetchNextPrompt = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Next Prompt',
    parameters: {
      method: 'GET',
      url: placeholder(
        'Your app URL + /api/admin/next-prompt (e.g. http://localhost:3000/api/admin/next-prompt)',
      ),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [1140, 350],
  },
  output: [
    { system: '# Video generation — system prompt ...', user: '# Generation request ...', composedAt: '2026-01-01T00:00:00.000Z' },
  ],
});

const callHiggsfield = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Call Higgsfield (REPLACE URL + AUTH)',
    parameters: {
      method: 'POST',
      url: placeholder('Higgsfield generation endpoint (e.g. https://api.higgsfield.ai/v1/...)'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(
        '{{ JSON.stringify({ prompt: $json.user, system: $json.system, params: { duration: 30, aspect_ratio: "9:16" } }) }}',
      ),
    },
    credentials: { httpHeaderAuth: newCredential('Higgsfield API') },
    position: [1440, 350],
  },
  output: [{ video_url: 'https://example.com/generated.mp4', thumbnail_url: 'https://example.com/generated.jpg', title: 'Generated draft', description: 'stub', tags: ['generated'] }],
});

const normalizeResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize for /publish (ADAPT TO HIGGSFIELD RESPONSE)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const r = $input.first().json;\n' +
        'return [{ json: {\n' +
        "  title: r.title || ('Generated ' + Math.random().toString(36).slice(2, 7)),\n" +
        "  description: r.description || '',\n" +
        '  src: r.video_url || r.src || r.url,\n' +
        "  poster: r.thumbnail_url || r.poster || r.thumb || '',\n" +
        "  tags: Array.isArray(r.tags) ? r.tags : ['generated'],\n" +
        "  prompt: r.prompt || ''\n" +
        '} }];',
    },
    position: [1740, 350],
  },
  output: [{ title: 'Generated draft', description: '', src: 'https://example.com/generated.mp4', poster: 'https://example.com/generated.jpg', tags: ['generated'], prompt: '' }],
});

const publishDraft = node({
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
      jsonBody: expr('{{ JSON.stringify($json) }}'),
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [2040, 350],
  },
  output: [{ ok: true, video: { id: 'vid_...' } }],
});

const loopBatches = splitInBatches({
  version: 3,
  config: { name: 'Loop (5 generations)', parameters: { batchSize: 1 }, position: [840, 350] },
});

const cycleDone = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Cycle Done',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [{ id: 'status', name: 'status', value: 'cycle complete', type: 'string' }],
      },
    },
    position: [1140, 650],
  },
  output: [{ status: 'cycle complete' }],
});

const howToNote = sticky(
  '## Generator cycle\n\n' +
    'Every 3 hours (or on manual trigger) this workflow runs 5 generations and publishes each to the Video Review app.\n\n' +
    '**Steps:**\n' +
    '1. **Fetch Next Prompt** — pulls the composed prompt (system + user, with live CLAUDE.md context baked in) from `/api/admin/next-prompt`.\n' +
    '2. **Call Higgsfield** — POSTs that prompt to the video-gen API. Replace the URL and credential with your Higgsfield endpoint + API key.\n' +
    "3. **Normalize** — adapts Higgsfield's response shape into the publish payload.\n" +
    '4. **Publish to Feed** — POSTs the final video record to `/api/admin/publish`.\n\n' +
    '**Credentials:**\n' +
    '- `Video Review Admin` → Header Auth, Name=`Authorization`, Value=`Bearer <ADMIN_API_TOKEN>`.\n' +
    '- `Higgsfield API` → Header Auth or whatever scheme Higgsfield uses for your account.',
  [scheduleTrigger, manualTrigger, fanOutFiveJobs, loopBatches],
  { color: 5 },
);

export default workflow('video-review-generator', 'Video Review — Generator Cycle')
  .add(scheduleTrigger)
  .to(fanOutFiveJobs)
  .to(
    loopBatches
      .onDone(cycleDone)
      .onEachBatch(
        fetchNextPrompt.to(
          callHiggsfield.to(normalizeResponse.to(publishDraft.to(nextBatch(loopBatches)))),
        ),
      ),
  )
  .add(manualTrigger)
  .to(fanOutFiveJobs);
