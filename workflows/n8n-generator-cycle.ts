// n8n workflow: "Video Review — Generator Cycle"
//
// Live at: https://tvtai.app.n8n.cloud/workflow/ATpRqLYDcd7H02HF
//
// n8n's only job is scheduling. The actual generation pipeline (compose
// prompt -> Higgsfield CLI -> self-review -> publish) lives in the
// Video Review app and is exposed at POST /api/admin/generate-one.
//
//   [Schedule (3h)] ──┐
//                      ├──> Build 5 jobs ──> Loop x5 ──> POST /api/admin/generate-one
//   [Manual]        ──┘                                       (Bearer ADMIN_API_TOKEN)

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

const generateOne = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Trigger Generate-One',
    parameters: {
      method: 'POST',
      url: placeholder(
        'Your app URL + /api/admin/generate-one (e.g. http://localhost:3000/api/admin/generate-one)',
      ),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({}) }}'),
      options: {
        timeout: 600000,
        response: { response: { neverError: true, fullResponse: false } },
      },
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [1140, 350],
  },
  output: [{ posted: true, video: { id: 'vid_...' } }],
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
    'Every 3 hours (or on manual trigger) this workflow calls `/api/admin/generate-one` on the Video Review app five times.\n\n' +
    'The Video Review server handles the rest: composing the prompt from CLAUDE.md, shelling out to the Higgsfield CLI, self-reviewing the result, and publishing.\n\n' +
    '**Credential:** `Video Review Admin` → Header Auth, Name=`Authorization`, Value=`Bearer <ADMIN_API_TOKEN>`.',
  [scheduleTrigger, manualTrigger, fanOutFiveJobs, loopBatches],
  { color: 5 },
);

export default workflow('video-review-generator', 'Video Review — Generator Cycle')
  .add(scheduleTrigger)
  .to(fanOutFiveJobs)
  .to(loopBatches.onDone(cycleDone).onEachBatch(generateOne.to(nextBatch(loopBatches))))
  .add(manualTrigger)
  .to(fanOutFiveJobs);
