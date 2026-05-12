// n8n workflow: "Video Review — Auto-Post (stub)"
//
// Live at: https://tvtai.app.n8n.cloud/workflow/hPstrNLDfDmqlWui
//
// Pulls the unposted approval queue from the Video Review app and runs a
// stubbed "post to social" step. The stub doesn't actually post anywhere
// — it just logs the video info and reports back. Replace the stub
// Code node ("POST TO SOCIAL (STUB — NOT POSTING)") with real TikTok /
// Instagram / YouTube calls when you're ready to ship.
//
// Schedule + Manual trigger -> Fetch /api/admin/approved?filter=unposted
//   -> Split Out -> Loop one video at a time:
//        -> stub post (log only)
//        -> POST /api/admin/approved/:id/posted (with the returned targets)

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
    name: 'Every 1 Hour',
    parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1 }] } },
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

const fetchApproved = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Approved Queue',
    parameters: {
      method: 'GET',
      url: placeholder('Your app URL + /api/admin/approved?filter=unposted'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [540, 350],
  },
  output: [[{ id: 'vid_abc', title: 'Example', src: 'https://...mp4' }]],
});

const splitItems = node({
  type: 'n8n-nodes-base.splitOut',
  version: 1,
  config: {
    name: 'One Per Run',
    parameters: { fieldToSplitOut: 'data', include: 'noOtherFields' },
    position: [840, 350],
  },
  output: [{ id: 'vid_abc', title: 'Example', src: 'https://...mp4' }],
});

const loop = splitInBatches({
  version: 3,
  config: { name: 'Loop One Video at a Time', parameters: { batchSize: 1 }, position: [1140, 350] },
});

const stubPost = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'POST TO SOCIAL (STUB — NOT POSTING)',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const item = $input.first().json;\n" +
        "// === REPLACE THIS BLOCK WITH REAL POSTING WHEN YOU'RE READY ===\n" +
        "console.log('[stub-post] would post:', item.id, item.title, item.src);\n" +
        "return [{ json: {\n" +
        "  videoId: item.id,\n" +
        "  title: item.title,\n" +
        "  targets: ['stub:no-network-call'],\n" +
        "  postedAt: new Date().toISOString()\n" +
        "} }];",
    },
    position: [1440, 350],
  },
  output: [{ videoId: 'vid_abc', targets: ['stub'] }],
});

const markPosted = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Mark as Posted (server)',
    parameters: {
      method: 'POST',
      url: expr(
        "{{ 'PLACEHOLDER_APP_URL' + '/api/admin/approved/' + encodeURIComponent($json.videoId) + '/posted' }}",
      ),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ targets: $json.targets }) }}"),
    },
    credentials: { httpHeaderAuth: newCredential('Video Review Admin') },
    position: [1740, 350],
  },
  output: [{ ok: true }],
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
          { id: 'status', name: 'status', value: 'autopost cycle complete', type: 'string' },
        ],
      },
    },
    position: [1440, 650],
  },
  output: [{ status: 'autopost cycle complete' }],
});

const howToNote = sticky(
  '## Auto-post cycle (STUB)\n\nReplace the stub Code node with real social-post calls when ready. Wire credentials + URLs same as the gen workflow.',
  [scheduleTrigger, manualTrigger, fetchApproved],
  { color: 5 },
);

export default workflow('video-review-autopost', 'Video Review — Auto-Post (stub)')
  .add(scheduleTrigger)
  .to(fetchApproved)
  .to(splitItems)
  .to(loop.onEachBatch(stubPost.to(markPosted.to(nextBatch(loop)))).onDone(cycleDone))
  .add(manualTrigger)
  .to(fetchApproved);
