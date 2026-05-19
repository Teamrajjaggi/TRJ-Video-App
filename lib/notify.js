// Notifications: records an in-app notification (the bell list) and fires
// a Web Push to every device the recipient subscribed. Best-effort — push
// failures never block the action that triggered them.
//
// Env: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
// Without the keys, push is disabled and only the in-app bell works.

const webpush = require('web-push');
const db = require('./db');

let pushReady = false;
(function initPush() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.log('[notify] VAPID keys not set — Web Push disabled (bell still works)');
    return;
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
      pub,
      priv,
    );
    pushReady = true;
  } catch (e) {
    console.warn('[notify] VAPID setup failed:', e.message);
  }
})();

// Sends one Web Push to every device a user has subscribed.
async function sendPush(userId, { title, body, videoId }) {
  if (!pushReady) return;
  let subs = [];
  try {
    subs = await db.listPushSubscriptions(userId);
  } catch {
    return;
  }
  const payload = JSON.stringify({
    title,
    body: body || '',
    videoId: videoId || null,
  });
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, payload);
    } catch (e) {
      // 404/410: the subscription is dead — drop it.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.deletePushSubscription(s.endpoint).catch(() => {});
      } else {
        console.warn('[notify] push send failed:', e.message);
      }
    }
  }
}

// Records an in-app notification and fires a Web Push. Never throws.
async function notify(userId, payload) {
  if (!userId) return;
  try {
    await db.addNotification(userId, payload);
  } catch (e) {
    console.warn('[notify] db insert failed:', e.message);
  }
  sendPush(userId, payload).catch(() => {});
}

// Notifies every user holding a given role.
async function notifyByRole(role, payload) {
  let users = [];
  try {
    users = await db.listUsersByRole(role);
  } catch {
    return;
  }
  for (const u of users) await notify(u.id, payload);
}

module.exports = { notify, notifyByRole };
