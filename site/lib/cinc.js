'use strict';

// CINC (Commissions Inc.) integration.
//
// Pathway 1 — IDX handoff: buildSearchUrl()/buildListingUrl() point search
// traffic at the CINC-hosted IDX site, where CINC's registration gate does the
// capture. If CINC_IDX_BASE_URL is unset the caller falls back to the internal
// /home-search page, so the site works before CINC is provisioned.
//
// Pathway 2 — Open API: upsertLead() posts to POST {apiBase}/site/leads with an
// OAuth2 bearer token. The upsert keys off lead.id, lead.username, or
// lead.info.contact.email, so re-submissions update the existing lead instead
// of creating duplicates. Required scope: api:create.

const { cinc: cfg } = require('../config');

let cachedToken = null; // { accessToken, expiresAt }

function log(...args) {
  if (cfg.debug) console.log('[cinc]', ...args);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- auth ----

function tokenUrl() {
  return `${cfg.authBaseUrl}/integrator/token`;
}

/**
 * Exchange an authorization code for tokens. Used once by /cinc/callback to
 * mint the long-lived refresh token that goes into CINC_REFRESH_TOKEN.
 */
async function exchangeAuthorizationCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  if (cfg.redirectUri) body.set('redirect_uri', cfg.redirectUri);

  const res = await fetchWithTimeout(tokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`CINC token exchange failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function requestAccessToken() {
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error('CINC credentials missing (CINC_CLIENT_ID / CINC_CLIENT_SECRET)');
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });

  if (cfg.grantType === 'refresh_token') {
    if (!cfg.refreshToken) throw new Error('CINC_GRANT_TYPE=refresh_token but CINC_REFRESH_TOKEN is unset');
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', cfg.refreshToken);
  } else {
    body.set('grant_type', 'client_credentials');
    if (cfg.scope) body.set('scope', cfg.scope);
  }

  const res = await fetchWithTimeout(tokenUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`CINC auth failed (${res.status}): ${JSON.stringify(json)}`);
  }

  // Renew a minute early so an in-flight request never rides an expiring token.
  const ttl = Number(json.expires_in || 3600);
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + Math.max(ttl - 60, 30) * 1000,
  };
  log('access token acquired, ttl', ttl);
  return cachedToken.accessToken;
}

async function getAccessToken({ force = false } = {}) {
  if (!force && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;
  return requestAccessToken();
}

// ---------------------------------------------------------------- leads ----

function splitName(lead) {
  const first = (lead.firstName || '').trim();
  const last = (lead.lastName || '').trim();
  if (first || last) return { first, last };
  const parts = (lead.name || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts.shift() || '', last: parts.join(' ') };
}

function digits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/**
 * Map a normalized site lead onto the CINC lead schema.
 * Shape follows the v2 upsert example: { lead: { info: { contact: {...} } } }.
 */
function toCincPayload(lead) {
  const { first, last } = splitName(lead);
  const cell = digits(lead.phone);

  const contact = {
    first_name: first || 'Website',
    last_name: last || 'Lead',
  };
  if (lead.email) contact.email = lead.email;
  if (cell) contact.phone_numbers = { cell_phone: cell };

  const notes = buildNote(lead);
  const tags = Array.from(new Set([...(cfg.defaultTags || []), ...(lead.tags || [])].filter(Boolean)));

  const payload = {
    lead: {
      source: lead.source || cfg.defaultSource,
      registered_date: lead.submittedAt || new Date().toISOString(),
      created_by: 'teamrajjaggi.com',
      info: { contact },
    },
  };

  if (lead.email) payload.lead.username = lead.email;
  if (tags.length) payload.lead.tags = tags;
  if (notes) payload.lead.notes = notes;
  if (cfg.assignedAgentId) payload.lead.assigned_user_id = cfg.assignedAgentId;
  if (cfg.siteId) payload.lead.site_id = cfg.siteId;

  return payload;
}

function buildNote(lead) {
  const lines = [];
  if (lead.formName) lines.push(`Form: ${lead.formName}`);
  if (lead.intent) lines.push(`Intent: ${lead.intent}`);
  if (lead.propertyAddress) lines.push(`Property: ${lead.propertyAddress}`);
  if (lead.timeframe) lines.push(`Timeframe: ${lead.timeframe}`);
  if (lead.priceRange) lines.push(`Price range: ${lead.priceRange}`);
  if (lead.beds) lines.push(`Beds: ${lead.beds}`);
  if (lead.baths) lines.push(`Baths: ${lead.baths}`);
  if (lead.neighborhood) lines.push(`Area of interest: ${lead.neighborhood}`);
  if (lead.preapproved) lines.push(`Pre-approved: ${lead.preapproved}`);
  if (lead.message) lines.push(`Message: ${lead.message}`);
  if (lead.pageUrl) lines.push(`Page: ${lead.pageUrl}`);
  if (lead.referrer) lines.push(`Referrer: ${lead.referrer}`);
  const utm = Object.entries(lead.utm || {}).filter(([, v]) => v);
  if (utm.length) lines.push(utm.map(([k, v]) => `${k}=${v}`).join(' '));
  return lines.join('\n');
}

/**
 * Upsert a lead into CINC. Resolves { ok, status, body } — never throws for a
 * transport failure, so the caller can queue a retry and still thank the user.
 */
async function upsertLead(lead, { retryOnUnauthorized = true } = {}) {
  if (!cfg.configured) {
    return { ok: false, skipped: true, reason: 'cinc-not-configured' };
  }

  const payload = toCincPayload(lead);
  log('POST /site/leads', JSON.stringify(payload));

  let token;
  try {
    token = await getAccessToken();
  } catch (err) {
    return { ok: false, status: 0, error: err.message, retryable: true };
  }

  let res;
  try {
    res = await fetchWithTimeout(`${cfg.apiBaseUrl}/site/leads`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, status: 0, error: err.message, retryable: true };
  }

  // A stale cached token surfaces as a 401; refresh once and replay.
  if (res.status === 401 && retryOnUnauthorized) {
    cachedToken = null;
    return upsertLead(lead, { retryOnUnauthorized: false });
  }

  const text = await res.text().catch(() => '');
  let body = text;
  try { body = text ? JSON.parse(text) : {}; } catch { /* keep raw text */ }

  if (!res.ok) {
    // 4xx other than 429 is a bad payload — retrying it will never help.
    const retryable = res.status === 429 || res.status >= 500;
    return { ok: false, status: res.status, body, retryable };
  }

  return { ok: true, status: res.status, body };
}

/** Read-side probe used by the /api/cinc/health diagnostic. */
async function ping() {
  if (!cfg.configured) return { ok: false, configured: false, reason: 'cinc-not-configured' };
  try {
    const token = await getAccessToken({ force: true });
    return { ok: Boolean(token), configured: true, grantType: cfg.grantType, apiBaseUrl: cfg.apiBaseUrl };
  } catch (err) {
    return { ok: false, configured: true, error: err.message };
  }
}

// ------------------------------------------------------------- IDX links ----

const IDX_PARAM_MAP = {
  city: 'cityName',
  state: 'stateName',
  zip: 'postalCode',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  beds: 'minBeds',
  baths: 'minBaths',
  propertyType: 'propertyType',
  query: 'q',
};

/**
 * Build a CINC IDX search URL. Returns null when IDX is not configured yet, so
 * templates can fall back to the internal search page.
 */
function buildSearchUrl(params = {}) {
  if (!cfg.idxBaseUrl) return null;
  const url = new URL(cfg.idxBaseUrl + cfg.idxSearchPath);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(IDX_PARAM_MAP[key] || key, String(value));
  }
  return url.toString();
}

function buildListingUrl(mlsId) {
  if (!cfg.idxBaseUrl || !mlsId) return null;
  return `${cfg.idxBaseUrl}${cfg.idxListingPath}/${encodeURIComponent(mlsId)}`;
}

function buildValuationUrl() {
  if (!cfg.idxBaseUrl) return null;
  return `${cfg.idxBaseUrl}${cfg.idxValuationPath}`;
}

/** One-time OAuth handshake entry point (see /cinc/connect). */
function buildAuthorizeUrl(state) {
  const url = new URL(`${cfg.authBaseUrl}/integrator/authorize`);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('response_type', 'code');
  if (cfg.redirectUri) url.searchParams.set('redirect_uri', cfg.redirectUri);
  if (cfg.scope) url.searchParams.set('scope', cfg.scope);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

module.exports = {
  upsertLead,
  toCincPayload,
  getAccessToken,
  exchangeAuthorizationCode,
  buildAuthorizeUrl,
  buildSearchUrl,
  buildListingUrl,
  buildValuationUrl,
  ping,
  isConfigured: () => cfg.configured,
  isIdxConfigured: () => Boolean(cfg.idxBaseUrl),
};
