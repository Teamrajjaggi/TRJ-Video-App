'use strict';

// Lead pipeline: validate -> log to disk -> upsert into CINC -> mirror to an
// optional webhook. Disk comes first on purpose: if CINC is down, or not yet
// provisioned, the lead is still recoverable and the retry queue replays it.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { leads: cfg, cinc: cincCfg } = require('../config');
const cinc = require('./cinc');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function appendJsonl(file, record) {
  try {
    ensureDir(file);
    fs.appendFileSync(file, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('[leads] failed writing', file, err.message);
  }
}

function clean(value, max = 500) {
  if (value === undefined || value === null) return '';
  return String(value).replace(CONTROL_CHARS, ' ').trim().slice(0, max);
}

/**
 * Normalize an arbitrary form body into the shape lib/cinc.js expects.
 * Returns { lead, errors }.
 */
function normalize(body = {}, meta = {}) {
  const errors = [];

  const lead = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    formName: clean(body.formName || body.form || 'contact', 80),
    intent: clean(body.intent, 80),
    name: clean(body.name, 120),
    firstName: clean(body.firstName || body.first_name, 80),
    lastName: clean(body.lastName || body.last_name, 80),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 40),
    message: clean(body.message || body.notes, 2000),
    propertyAddress: clean(body.propertyAddress || body.address, 240),
    timeframe: clean(body.timeframe, 80),
    priceRange: clean(body.priceRange || body.budget, 80),
    beds: clean(body.beds, 20),
    baths: clean(body.baths, 20),
    neighborhood: clean(body.neighborhood || body.area, 120),
    preapproved: clean(body.preapproved, 40),
    source: clean(body.source, 120) || cincCfg.defaultSource,
    tags: []
      .concat(body.tags || [])
      .map((t) => clean(t, 40))
      .filter(Boolean)
      .slice(0, 12),
    pageUrl: clean(body.pageUrl, 400),
    referrer: clean(body.referrer || meta.referrer, 400),
    utm: {
      utm_source: clean(body.utm_source, 120),
      utm_medium: clean(body.utm_medium, 120),
      utm_campaign: clean(body.utm_campaign, 160),
      utm_term: clean(body.utm_term, 160),
      utm_content: clean(body.utm_content, 160),
      gclid: clean(body.gclid, 160),
      fbclid: clean(body.fbclid, 160),
    },
    ip: meta.ip || '',
    userAgent: clean(meta.userAgent, 300),
  };

  // The form's honeypot field. Bots fill it; humans never see it.
  if (clean(body.company)) errors.push('spam');

  if (!lead.name && !lead.firstName && !lead.lastName) errors.push('Please enter your name.');
  if (!lead.email && !lead.phone) errors.push('Please enter an email address or phone number.');
  if (lead.email && !EMAIL_RE.test(lead.email)) errors.push('That email address looks incomplete.');
  if (lead.phone && lead.phone.replace(/\D/g, '').length < 10) errors.push('That phone number looks incomplete.');

  // Tag by form so CINC routing/automation can branch on website traffic.
  if (lead.formName) lead.tags.push(`web:${lead.formName}`);
  if (lead.intent) lead.tags.push(lead.intent);

  return { lead, errors };
}

async function mirrorToWebhook(lead, cincResult) {
  if (!cfg.webhookUrl) return { skipped: true };
  const payload = JSON.stringify({ lead, cinc: cincResult });
  const headers = { 'content-type': 'application/json' };
  if (cfg.webhookSecret) {
    headers['x-signature'] = crypto.createHmac('sha256', cfg.webhookSecret).update(payload).digest('hex');
  }
  try {
    const res = await fetch(cfg.webhookUrl, { method: 'POST', headers, body: payload });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function queueRetry(lead, result) {
  appendJsonl(cfg.retryPath, {
    lead,
    attempts: 1,
    lastError: result.error || result.body || result.status || 'unknown',
    queuedAt: new Date().toISOString(),
  });
}

/**
 * Full submit path. Never throws: a lead that cannot reach CINC is still
 * written to disk and queued, and the visitor still gets a thank-you.
 */
async function submit(body, meta = {}) {
  const { lead, errors } = normalize(body, meta);

  if (errors.includes('spam')) {
    // Silently accept so the bot does not learn it was filtered.
    return { ok: true, spam: true, leadId: lead.id };
  }
  if (errors.length) return { ok: false, errors };

  appendJsonl(cfg.logPath, lead);

  const cincResult = await cinc.upsertLead(lead);
  if (!cincResult.ok && cincResult.retryable) queueRetry(lead, cincResult);
  if (!cincResult.ok && !cincResult.skipped && !cincResult.retryable) {
    console.error('[leads] CINC rejected lead', lead.id, cincResult.status, JSON.stringify(cincResult.body));
  }

  const webhookResult = await mirrorToWebhook(lead, cincResult);

  return { ok: true, leadId: lead.id, cinc: cincResult, webhook: webhookResult };
}

/** Replay queued leads. Called on boot and on an interval. */
async function drainRetryQueue() {
  if (!fs.existsSync(cfg.retryPath)) return { drained: 0 };
  if (!cinc.isConfigured()) return { drained: 0, reason: 'cinc-not-configured' };

  let rows;
  try {
    rows = fs.readFileSync(cfg.retryPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (err) {
    console.error('[leads] unreadable retry queue:', err.message);
    return { drained: 0, error: err.message };
  }

  // Truncate up front, then re-queue whatever still fails. A crash mid-drain
  // loses at most the in-flight rows, which the leads.jsonl log still holds.
  try { fs.writeFileSync(cfg.retryPath, ''); } catch { /* best effort */ }

  let drained = 0;
  for (const row of rows) {
    if (row.attempts >= cfg.maxAttempts) {
      console.error('[leads] giving up on lead', row.lead && row.lead.id, 'after', row.attempts, 'attempts');
      continue;
    }
    const result = await cinc.upsertLead(row.lead);
    if (result.ok) {
      drained += 1;
    } else if (result.retryable) {
      appendJsonl(cfg.retryPath, { ...row, attempts: row.attempts + 1, lastError: result.error || result.status });
    } else {
      console.error('[leads] permanent failure for lead', row.lead && row.lead.id, result.status);
    }
  }

  if (drained) console.log(`[leads] replayed ${drained} queued lead(s) into CINC`);
  return { drained };
}

function startRetryLoop() {
  if (!cfg.retryIntervalMs) return null;
  drainRetryQueue().catch((err) => console.error('[leads] drain failed:', err.message));
  const timer = setInterval(() => {
    drainRetryQueue().catch((err) => console.error('[leads] drain failed:', err.message));
  }, cfg.retryIntervalMs);
  timer.unref();
  return timer;
}

function recent(limit = 50) {
  if (!fs.existsSync(cfg.logPath)) return [];
  const lines = fs.readFileSync(cfg.logPath, 'utf8').split('\n').filter(Boolean);
  return lines
    .slice(-limit)
    .reverse()
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { submit, normalize, drainRetryQueue, startRetryLoop, recent };
