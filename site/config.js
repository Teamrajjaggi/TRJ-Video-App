'use strict';

// Central config for the Team Raj Jaggi marketing site.
// Everything here is env-overridable so the site can be rebranded or
// re-pointed at a different CINC instance without touching templates.

const { findAsset } = require('./lib/assets');

const env = process.env;

function bool(v, fallback = false) {
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(v));
}

const brand = {
  name: env.SITE_BRAND_NAME || 'Team Raj Jaggi',
  legalName: env.SITE_LEGAL_NAME || 'Team Raj Jaggi — Your Home Sold Guaranteed',
  // Empty by default: no brokerage affiliation is shown anywhere on the site.
  // Set SITE_BROKERAGE to surface one in the header, footer, and agent bios.
  brokerage: env.SITE_BROKERAGE || '',
  tagline: env.SITE_TAGLINE || "Your Home Sold Guaranteed or I'll Buy It",
  positioning: env.SITE_POSITIONING || 'Home Buying & Selling System',
  market: env.SITE_MARKET || 'Long Island',
  marketLong: env.SITE_MARKET_LONG || 'Long Island & the New York Metro Area',
  domain: env.SITE_DOMAIN || 'teamrajjaggi.com',
  baseUrl: (env.SITE_BASE_URL || 'https://www.teamrajjaggi.com').replace(/\/$/, ''),
  phone: env.SITE_PHONE || '(516) 996-3633',
  phoneAlt: env.SITE_PHONE_ALT || '(516) 247-9533',
  email: env.SITE_EMAIL || 'info@teamrajjaggi.com',
  address: {
    street: env.SITE_ADDRESS_STREET || '54 W John St',
    city: env.SITE_ADDRESS_CITY || 'Hicksville',
    state: env.SITE_ADDRESS_STATE || 'NY',
    zip: env.SITE_ADDRESS_ZIP || '11801',
  },
  social: {
    facebook: env.SITE_FACEBOOK || 'https://www.facebook.com/TeamRajJaggi/',
    instagram: env.SITE_INSTAGRAM || 'https://www.instagram.com/teamrajjaggi/',
    linkedin: env.SITE_LINKEDIN || 'https://www.linkedin.com/in/teamrajjaggi/',
    youtube: env.SITE_YOUTUBE || '',
    x: env.SITE_X || 'https://x.com/teamrajjaggi',
  },
};

// Drop the supplied artwork at public/images/logo.png (and logo-light.png for
// the dark footer) to replace the placeholder lockup — no code change needed.
// A supplied logo file always wins; the vector stand-in is only the fallback.
brand.logo = env.SITE_LOGO || findAsset('images', 'logo') || findAsset('images', 'logo-fallback');
brand.logoLight = env.SITE_LOGO_LIGHT || findAsset('images', 'logo-light') || findAsset('images', 'logo-fallback-light') || brand.logo;

brand.phoneHref = 'tel:+1' + brand.phone.replace(/\D/g, '');
brand.addressLine = `${brand.address.street}, ${brand.address.city}, ${brand.address.state} ${brand.address.zip}`;

const stats = [
  { value: env.SITE_STAT_1_VALUE || '65,000+', label: env.SITE_STAT_1_LABEL || 'Buyers in our database' },
  { value: env.SITE_STAT_2_VALUE || '10x', label: env.SITE_STAT_2_LABEL || 'More homes sold than the average agent' },
  { value: env.SITE_STAT_3_VALUE || '3.8%', label: env.SITE_STAT_3_LABEL || 'Higher sales price than average' },
  { value: env.SITE_STAT_4_VALUE || '38', label: env.SITE_STAT_4_LABEL || 'Days to sell, vs 91 market average' },
];

// ---- CINC (Commissions Inc.) ----------------------------------------------
// Two independent pathways, either of which can run on its own:
//   1. IDX handoff  — search traffic is handed to the CINC-hosted IDX site,
//                     where CINC's own registration gate captures the lead.
//   2. Open API     — every form on this site upserts a lead into the CINC
//                     CRM through POST /v2/site/leads.
const cinc = {
  // 1. IDX handoff
  idxBaseUrl: (env.CINC_IDX_BASE_URL || '').replace(/\/$/, ''),
  idxSearchPath: env.CINC_IDX_SEARCH_PATH || '/results-gallery',
  idxListingPath: env.CINC_IDX_LISTING_PATH || '/listing',
  idxValuationPath: env.CINC_IDX_VALUATION_PATH || '/home-valuation',
  // Open a new tab for IDX handoffs instead of navigating away.
  idxNewTab: bool(env.CINC_IDX_NEW_TAB, false),

  // 2. Open API
  apiBaseUrl: (env.CINC_API_BASE_URL || 'https://public.cincapi.com/v2').replace(/\/$/, ''),
  authBaseUrl: (env.CINC_AUTH_BASE_URL || 'https://authv2.cincapi.com').replace(/\/$/, ''),
  clientId: env.CINC_CLIENT_ID || '',
  clientSecret: env.CINC_CLIENT_SECRET || '',
  // Long-lived refresh token from the one-time /cinc/connect handshake.
  refreshToken: env.CINC_REFRESH_TOKEN || '',
  // Grant to use: 'client_credentials' (server-to-server) or 'refresh_token'.
  grantType: env.CINC_GRANT_TYPE || (env.CINC_REFRESH_TOKEN ? 'refresh_token' : 'client_credentials'),
  scope: env.CINC_SCOPE || 'api:create api:read api:update',
  redirectUri: env.CINC_REDIRECT_URI || '',
  siteId: env.CINC_SITE_ID || '',
  // Every lead is tagged so CINC routing rules can act on website traffic.
  defaultTags: (env.CINC_DEFAULT_TAGS || 'website').split(',').map((s) => s.trim()).filter(Boolean),
  defaultSource: env.CINC_DEFAULT_SOURCE || 'teamrajjaggi.com',
  assignedAgentId: env.CINC_ASSIGNED_AGENT_ID || '',
  timeoutMs: Number(env.CINC_TIMEOUT_MS || 12000),
  // Verbatim body logging for the first integration run.
  debug: bool(env.CINC_DEBUG, false),
};

cinc.configured = Boolean(cinc.clientId && cinc.clientSecret &&
  (cinc.grantType !== 'refresh_token' || cinc.refreshToken));

const leads = {
  // Durable local record of every submission, written before CINC is called.
  logPath: env.LEAD_LOG_PATH || require('path').join(__dirname, 'data', 'leads.jsonl'),
  // Anything CINC rejected, replayed on boot and on an interval.
  retryPath: env.LEAD_RETRY_PATH || require('path').join(__dirname, 'data', 'lead-retry.jsonl'),
  retryIntervalMs: Number(env.LEAD_RETRY_INTERVAL_MS || 5 * 60 * 1000),
  maxAttempts: Number(env.LEAD_MAX_ATTEMPTS || 8),
  // Optional mirror (Zapier / n8n / Make) so leads land in a second system.
  webhookUrl: env.LEAD_WEBHOOK_URL || '',
  webhookSecret: env.LEAD_WEBHOOK_SECRET || '',
  // Simple per-IP throttle on the public endpoint.
  rateLimitPerHour: Number(env.LEAD_RATE_LIMIT_PER_HOUR || 20),
};

const site = {
  port: Number(env.SITE_PORT || env.PORT || 4000),
  adminToken: env.SITE_ADMIN_TOKEN || env.ADMIN_API_TOKEN || '',
  googleAnalyticsId: env.SITE_GA_ID || '',
  metaPixelId: env.SITE_META_PIXEL_ID || '',
  recaptchaSiteKey: env.SITE_RECAPTCHA_SITE_KEY || '',
  recaptchaSecret: env.SITE_RECAPTCHA_SECRET || '',
  env: env.NODE_ENV || 'development',
};

module.exports = { brand, stats, cinc, leads, site, bool };
