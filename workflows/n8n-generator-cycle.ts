// n8n workflow: "Video Review — Generator Cycle"
//
// Live in n8n at:
//   https://tvtai.app.n8n.cloud/workflow/ATpRqLYDcd7H02HF
//
// This file is the source-of-truth for the workflow. Edit it in n8n's UI, or
// re-import via the n8n MCP server + update_workflow tool.
//
// Pipeline:
//   [Schedule Trigger (every 3h)] ─┐
//                                   ├─→ Build 5 jobs → Loop x5 →
//   [Manual Trigger]              ──┘     ├─ Fetch CLAUDE.md context
//                                         ├─ Generate Draft (replace w/ Higgsfield)
//                                         └─ Publish to /api/admin/publish
//
// To wire up:
//   1. In n8n, set the "Video Review Admin" credential to Header Name
//      `Authorization`, Value `Bearer <ADMIN_API_TOKEN>` (matches the env var
//      on the Video Review server).
//   2. Fill the placeholder URLs in both HTTP nodes with your app's host.
//   3. Replace the "Generate Draft" Code node with an HTTP Request to
//      Higgsfield. Use the fetched `context` field as part of the prompt.

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
    parameters: {
      rule: { interval: [{ field: 'hours', hoursInterval: 3 }] },
    },
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

const fetchContext = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch CLAUDE.md',
    parameters: {
      method: 'GET',
      url: placeholder(
        'Your app URL + /api/admin/context (e.g. http://localhost:3000/api/admin/context)',
      ),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      options: {
        response: {
          response: {
            responseFormat: 'text',
            outputPropertyName: 'context',
          },
        },
      },
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [1140, 350],
  },
  output: [{ context: '# CLAUDE.md ...' }],
});

const generateDraft = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Generate Draft (replace with Higgsfield)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        'const ctx = ($input.first().json && $input.first().json.context) || "";\n' +
        'const sources = [\n' +
        '  { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4", poster: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg" },\n' +
        '  { src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", poster: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg" }\n' +
        '];\n' +
        'const pick = sources[Math.floor(Math.random() * sources.length)];\n' +
        'const seed = Math.random().toString(36).slice(2, 7);\n' +
        'return [{ json: {\n' +
        '  title: "Generated draft " + seed,\n' +
        '  description: "Stub generation. Replace this Code node with a Higgsfield HTTP call that uses ctx as context.",\n' +
        '  src: pick.src,\n' +
        '  poster: pick.poster,\n' +
        '  tags: ["generated", "draft"],\n' +
        '  prompt: "(replace with the real prompt; CLAUDE.md context length: " + ctx.length + ")"\n' +
        '} }];',
    },
    position: [1440, 350],
  },
  output: [
    {
      title: 'Generated draft',
      description: 'stub',
      src: 'https://example/video.mp4',
      poster: 'https://example/poster.jpg',
      tags: ['generated', 'draft'],
      prompt: 'stub',
    },
  ],
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
    position: [1740, 350],
  },
  output: [{ ok: true, video: { id: 'vid_...' } }],
});

const loopBatches = splitInBatches({
  version: 3,
  config: {
    name: 'Loop (5 generations)',
    parameters: { batchSize: 1 },
    position: [840, 350],
  },
});

const cycleDone = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Cycle Done',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'status', name: 'status', value: 'cycle complete', type: 'string' },
        ],
      },
    },
    position: [1140, 650],
  },
  output: [{ status: 'cycle complete' }],
});

const howToNote = sticky(
  '## Generator cycle\n\n' +
    'Every 3 hours (or on manual trigger) this workflow generates 5 video drafts and publishes them to the Video Review app.\n\n' +
    '**To wire it up:**\n' +
    "- Set the Video Review Admin credential to Header Name `Authorization`, Value `Bearer <your ADMIN_API_TOKEN>`.\n" +
    "- Fill the placeholder URLs in the HTTP nodes with your app's host.\n" +
    "- Replace the **Generate Draft** code node with an HTTP Request to Higgsfield. Use the fetched CLAUDE.md (`$json.context`) as part of the prompt.",
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
        fetchContext.to(generateDraft.to(publishDraft.to(nextBatch(loopBatches)))),
      ),
  )
  .add(manualTrigger)
  .to(fanOutFiveJobs);
