'use strict';

// Marketing site for Team Raj Jaggi. Runs independently of the video-review
// app in the repo root: its own port, its own static root, its own routes.
//
//   npm run site        -> http://localhost:4000
//
// CINC pathway:
//   POST /api/lead      every form on the site, upserted into the CINC CRM
//   GET  /cinc/connect  one-time OAuth handshake to mint a refresh token
//   GET  /cinc/callback handshake return leg
//   POST /api/cinc/webhook  inbound lead/status callbacks from CINC
//   GET  /api/cinc/health   integration diagnostic (admin token required)

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const { brand, site: siteCfg, cinc: cincCfg } = require('./config');
const cinc = require('./lib/cinc');
const leads = require('./lib/leads');

const home = require('./pages/home');
const sell = require('./pages/sell');
const buy = require('./pages/buy');
const about = require('./pages/about');
const blog = require('./pages/blog');
const misc = require('./pages/misc');
const openHouses = require('./pages/open-houses');
const schedule = require('./lib/open-houses');

const team = require('./data/team');
const neighborhoods = require('./data/neighborhoods');
const listings = require('./data/listings');
const posts = require('./data/posts');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

const send = (res, html) => res.type('html').send(html);

// ------------------------------------------------------------ static ------

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: siteCfg.env === 'production' ? '7d' : 0,
  extensions: [],
}));

// ------------------------------------------------------------ pages -------

app.get('/', (req, res) => send(res, home()));

app.get('/home-search', (req, res) => send(res, buy.homeSearch(req.query)));
app.get('/properties/sale', (req, res) => send(res, buy.featuredListings()));
app.get('/properties/:mlsId', (req, res, next) => {
  const listing = listings.find((l) => l.mlsId === req.params.mlsId);
  if (!listing) return next();
  send(res, buy.listingDetail(listing));
});
app.get('/open-houses', (req, res) => send(res, openHouses.openHousesPage()));
app.get('/buyers-guide', (req, res) => send(res, buy.buyersGuide()));
app.get('/mortgage-calculator', (req, res) => send(res, buy.mortgageCalculator()));

app.get('/home-valuation', (req, res) => send(res, sell.homeValuation()));
app.get('/guaranteed-sale', (req, res) => send(res, sell.guaranteedSale()));
app.get('/sellers-guide', (req, res) => send(res, sell.sellersGuide()));

app.get('/neighborhoods', (req, res) => send(res, about.neighborhoodsPage()));
app.get('/neighborhoods/:slug', (req, res, next) => {
  const hood = neighborhoods.find((n) => n.slug === req.params.slug);
  if (!hood) return next();
  send(res, about.neighborhoodPage(hood));
});

app.get('/team', (req, res) => send(res, about.teamPage()));
app.get('/agent/:slug', (req, res, next) => {
  const member = team.find((m) => m.slug === req.params.slug);
  if (!member) return next();
  send(res, about.agentPage(member));
});
app.get('/testimonials', (req, res) => send(res, about.testimonialsPage()));
app.get('/contact-us', (req, res) => send(res, about.contactPage()));
app.get('/join-us', (req, res) => send(res, about.joinUsPage()));

app.get('/blog', (req, res) => send(res, blog.blogIndex(req.query.category)));
app.get('/blog/:slug', (req, res, next) => {
  const post = posts.find((p) => p.slug === req.params.slug);
  if (!post) return next();
  send(res, blog.blogPost(post));
});

app.get('/thank-you', (req, res) => send(res, misc.thankYou(req.query)));
app.get('/privacy', (req, res) => send(res, misc.legal('privacy')));
app.get('/terms', (req, res) => send(res, misc.legal('terms')));
app.get('/accessibility', (req, res) => send(res, misc.legal('accessibility')));

// Legacy/alternate paths people will link to.
const ALIASES = {
  '/contact': '/contact-us',
  '/about': '/team',
  '/our-team': '/team',
  '/reviews': '/testimonials',
  '/search': '/home-search',
  '/listings': '/properties/sale',
  '/open-house': '/open-houses',
  '/openhouses': '/open-houses',
  '/sell': '/home-valuation',
  '/what-is-my-home-worth': '/home-valuation',
  '/careers': '/join-us',
  '/apply': '/join-us',
};
Object.entries(ALIASES).forEach(([from, to]) => app.get(from, (req, res) => res.redirect(301, to)));

// ------------------------------------------------------------- SEO --------

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${brand.baseUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const urls = [
    '/', '/home-search', '/properties/sale', '/buyers-guide', '/mortgage-calculator',
    '/home-valuation', '/guaranteed-sale', '/sellers-guide', '/neighborhoods', '/open-houses',
    '/team', '/testimonials', '/contact-us', '/join-us', '/blog',
    '/privacy', '/terms', '/accessibility',
  ]
    .concat(neighborhoods.map((n) => `/neighborhoods/${n.slug}`))
    .concat(team.map((m) => `/agent/${m.slug}`))
    .concat(posts.map((p) => `/blog/${p.slug}`))
    .concat(listings.map((l) => `/properties/${l.mlsId}`));

  const body = urls
    .map((u) => `  <url><loc>${brand.baseUrl}${u === '/' ? '' : u}</loc></url>`)
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
});

// ------------------------------------------------------- lead capture -----

// Small in-memory throttle. Enough to stop a form-spam script; a CDN or WAF
// handles anything larger.
const hits = new Map();
function throttled(ip) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > require('./config').leads.rateLimitPerHour;
}

app.post('/api/lead', async (req, res) => {
  const ip = req.ip || '';
  if (throttled(ip)) {
    return res.status(429).json({ ok: false, errors: ['Too many submissions. Please call us instead.'] });
  }

  try {
    const result = await leads.submit(req.body, {
      ip,
      userAgent: req.get('user-agent') || '',
      referrer: req.get('referer') || '',
    });
    if (!result.ok) return res.status(400).json(result);
    return res.json({ ok: true, leadId: result.leadId });
  } catch (err) {
    console.error('[site] lead submit failed:', err);
    return res.status(500).json({ ok: false, errors: ['Something went wrong on our end. Please call us.'] });
  }
});

// ------------------------------------------------------------- CINC -------

// One-time handshake. Visit /cinc/connect in a browser, approve in CINC, and
// the callback prints the refresh token to paste into CINC_REFRESH_TOKEN.
const pendingStates = new Set();

app.get('/cinc/connect', (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!cincCfg.clientId) return res.status(400).type('text').send('CINC_CLIENT_ID is not set.');
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref();
  res.redirect(cinc.buildAuthorizeUrl(state));
});

app.get('/cinc/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).type('text').send(`CINC returned an error: ${error}`);
  if (!code) return res.status(400).type('text').send('Missing authorization code.');
  if (state && !pendingStates.delete(state)) {
    return res.status(400).type('text').send('State mismatch — restart at /cinc/connect.');
  }

  try {
    const tokens = await cinc.exchangeAuthorizationCode(String(code));
    console.log('[cinc] handshake complete. Set CINC_REFRESH_TOKEN to the value below.');
    console.log('[cinc] refresh_token:', tokens.refresh_token);
    res.type('text').send(
      'CINC connected.\n\n' +
      'Copy the refresh token printed in the server log into CINC_REFRESH_TOKEN,\n' +
      'set CINC_GRANT_TYPE=refresh_token, and restart the site.\n'
    );
  } catch (err) {
    console.error('[cinc] handshake failed:', err.message);
    res.status(502).type('text').send('Token exchange failed: ' + err.message);
  }
});

// Inbound callbacks from CINC (lead assigned, status changed, and so on).
app.post('/api/cinc/webhook', (req, res) => {
  const secret = process.env.CINC_WEBHOOK_SECRET || '';
  if (secret) {
    const signature = req.get('x-cinc-signature') || '';
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body || {})).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ ok: false, error: 'bad signature' });
    }
  }
  console.log('[cinc] webhook:', JSON.stringify(req.body || {}).slice(0, 2000));
  res.json({ ok: true });
});

function requireAdmin(req, res) {
  if (!siteCfg.adminToken) {
    res.status(403).type('text').send('SITE_ADMIN_TOKEN is not set; admin routes are disabled.');
    return false;
  }
  const token = req.get('x-admin-token') || req.query.token || (req.body && req.body.token) || '';
  const a = Buffer.from(String(token));
  const b = Buffer.from(siteCfg.adminToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).type('text').send('Unauthorized.');
    return false;
  }
  return true;
}

// --------------------------------------------------- open house admin ----

app.get('/admin/open-houses', (req, res) => {
  if (!requireAdmin(req, res)) return;
  send(res, openHouses.openHousesAdmin({ token: String(req.query.token || ''), saved: req.query.saved === '1' }));
});

app.post('/admin/open-houses', (req, res) => {
  if (!requireAdmin(req, res)) return;

  // The form posts flat address_0, town_0, ... fields; fold them back to rows.
  const houses = [];
  for (let i = 0; `address_${i}` in req.body; i += 1) {
    houses.push({
      address: req.body[`address_${i}`],
      town: req.body[`town_${i}`],
      saturday: req.body[`saturday_${i}`],
      sunday: req.body[`sunday_${i}`],
    });
  }

  try {
    schedule.write({
      heading: req.body.heading,
      weekendLabel: req.body.weekendLabel,
      intro: req.body.intro,
      houses,
    });
  } catch (err) {
    console.error('[site] could not save open houses:', err.message);
    return send(res, openHouses.openHousesAdmin({
      token: String(req.body.token || ''),
      error: 'Could not save: ' + err.message,
    }));
  }

  res.redirect(`/admin/open-houses?token=${encodeURIComponent(String(req.body.token || ''))}&saved=1`);
});

// JSON equivalent, for updating the schedule from a script or automation.
app.post('/api/admin/open-houses', (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json({ ok: true, schedule: schedule.write(req.body || {}) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/cinc/health', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = await cinc.ping();
  res.json({
    ok: status.ok,
    cinc: status,
    idx: { configured: cinc.isIdxConfigured(), baseUrl: cincCfg.idxBaseUrl || null },
    queuedLeads: leads.recent(1).length ? 'log present' : 'log empty',
  });
});

app.get('/api/leads/recent', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true, leads: leads.recent(Number(req.query.limit) || 25) });
});

app.get('/healthz', (req, res) => res.json({ ok: true, cinc: cinc.isConfigured(), idx: cinc.isIdxConfigured() }));

// -------------------------------------------------------------- 404 -------

app.use((req, res) => res.status(404).type('html').send(misc.notFound()));

app.use((err, req, res, next) => {
  console.error('[site] unhandled error:', err);
  res.status(500).type('html').send(misc.notFound());
});

if (require.main === module) {
  leads.startRetryLoop();
  app.listen(siteCfg.port, () => {
    console.log(`[site] ${brand.name} listening on http://localhost:${siteCfg.port}`);
    console.log(`[site] CINC API: ${cinc.isConfigured() ? 'configured' : 'NOT configured (leads log to disk and queue for replay)'}`);
    console.log(`[site] CINC IDX: ${cinc.isIdxConfigured() ? cincCfg.idxBaseUrl : 'NOT configured (search falls back to the internal page)'}`);
  });
}

module.exports = app;
