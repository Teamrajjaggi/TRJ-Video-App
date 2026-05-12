export async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    credentials: 'same-origin',
    ...opts,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function getMe() {
  try {
    const data = await jsonFetch('/api/me');
    return data.user;
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}

export function showError(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}
