// Drop-in notifications: a bell button with an unread badge + dropdown
// panel, plus Web Push subscription. Self-contained — injects its own
// styles and registers the service worker.
//
//   import { mountNotifications } from '/notifications.js';
//   mountNotifications(document.querySelector('.header-actions'));

const POLL_MS = 60000;

let panel;
let badge;
let bellBtn;
let items = [];
let vapidKey = null;

function injectStyles() {
  if (document.getElementById('trj-notif-style')) return;
  const el = document.createElement('style');
  el.id = 'trj-notif-style';
  el.textContent = `
  .trj-bell{position:relative;display:grid;place-items:center;width:44px;
    height:44px;border:none;border-radius:12px;background:transparent;
    color:inherit;cursor:pointer}
  .trj-bell:hover{background:rgba(255,255,255,.08)}
  .trj-bell svg{width:21px;height:21px;fill:none;stroke:currentColor;
    stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .trj-badge{position:absolute;top:5px;right:5px;min-width:17px;height:17px;
    padding:0 4px;border-radius:999px;background:#f43f5e;color:#fff;
    font-size:10px;font-weight:700;line-height:17px;text-align:center;
    display:none}
  .trj-badge.show{display:block}
  .trj-panel{position:fixed;top:60px;right:10px;z-index:300;
    width:min(360px,calc(100vw - 20px));max-height:75vh;overflow-y:auto;
    background:#17171c;border:1px solid rgba(255,255,255,.12);
    border-radius:14px;box-shadow:0 24px 60px -16px rgba(0,0,0,.85);
    padding:8px;display:none}
  .trj-panel.show{display:block}
  .trj-panel-head{display:flex;justify-content:space-between;
    align-items:center;padding:8px 8px 10px;font-weight:700;color:#fafafa;
    font-size:.95rem}
  .trj-enable{border:none;background:#4ade80;color:#fff;border-radius:999px;
    padding:6px 11px;font-size:.72rem;font-weight:700;cursor:pointer}
  .trj-n{padding:10px;border-radius:10px}
  .trj-n+.trj-n{margin-top:2px}
  .trj-n.unread{background:rgba(99,102,241,.13)}
  .trj-n-title{font-weight:600;font-size:.86rem;color:#fafafa}
  .trj-n-body{font-size:.8rem;color:#9a9aa6;margin-top:2px;
    word-break:break-word}
  .trj-n-time{font-size:.68rem;color:#6b6b76;margin-top:3px}
  .trj-empty{padding:28px 0;text-align:center;color:#9a9aa6;font-size:.85rem}
  `;
  document.head.appendChild(el);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function setBadge(n) {
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.classList.toggle('show', n > 0);
}

function render() {
  const needsEnable =
    'Notification' in window && Notification.permission !== 'granted';
  let html =
    '<div class="trj-panel-head"><span>Notifications</span>' +
    (needsEnable ? '<button class="trj-enable" id="trj-enable">Enable push</button>' : '') +
    '</div>';
  if (!items.length) {
    html += '<div class="trj-empty">No notifications yet.</div>';
  } else {
    for (const n of items) {
      html +=
        `<div class="trj-n${n.read ? '' : ' unread'}">` +
        `<div class="trj-n-title">${esc(n.title)}</div>` +
        (n.body ? `<div class="trj-n-body">${esc(n.body)}</div>` : '') +
        `<div class="trj-n-time">${timeAgo(n.created_at)}</div></div>`;
    }
  }
  panel.innerHTML = html;
  const enableBtn = panel.querySelector('#trj-enable');
  if (enableBtn) enableBtn.addEventListener('click', enablePush);
}

async function load() {
  try {
    const res = await fetch('/api/notifications', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    items = data.items || [];
    setBadge(data.unread || 0);
    if (panel.classList.contains('show')) render();
  } catch {
    /* offline / transient — ignore */
  }
}

async function onBellClick() {
  const open = panel.classList.toggle('show');
  if (!open) return;
  render();
  if (items.some((n) => !n.read)) {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      /* ignore */
    }
    setBadge(0);
    items = items.map((n) => ({ ...n, read: true }));
    render();
  }
}

// ---- Web Push ----
function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getVapidKey() {
  if (vapidKey !== null) return vapidKey;
  try {
    const res = await fetch('/api/push/key', { credentials: 'same-origin' });
    const j = await res.json();
    vapidKey = j.key || '';
  } catch {
    vapidKey = '';
  }
  return vapidKey;
}

async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const key = await getVapidKey();
  if (!key) return;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key),
    });
  }
  await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub),
  });
}

async function enablePush() {
  if (!('Notification' in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') await subscribePush();
  } catch {
    /* ignore */
  }
  render();
}

export async function mountNotifications(container) {
  if (!container || bellBtn) return;
  injectStyles();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  bellBtn = document.createElement('button');
  bellBtn.className = 'trj-bell';
  bellBtn.type = 'button';
  bellBtn.setAttribute('aria-label', 'Notifications');
  bellBtn.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>' +
    '<path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="trj-badge">0</span>';
  badge = bellBtn.querySelector('.trj-badge');
  container.prepend(bellBtn);

  panel = document.createElement('div');
  panel.className = 'trj-panel';
  document.body.appendChild(panel);

  bellBtn.addEventListener('click', onBellClick);
  document.addEventListener('click', (e) => {
    if (
      panel.classList.contains('show') &&
      !panel.contains(e.target) &&
      !bellBtn.contains(e.target)
    ) {
      panel.classList.remove('show');
    }
  });

  await load();
  setInterval(load, POLL_MS);
  // Re-subscribe silently if push was already granted on this device.
  subscribePush().catch(() => {});
}
