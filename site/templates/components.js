'use strict';

const { esc } = require('./layout');
const { brand, stats, cinc: cincCfg } = require('../config');
const cinc = require('../lib/cinc');
const { findHeadshot, findListingPhoto } = require('../lib/assets');

const money = (n) => '$' + Number(n).toLocaleString('en-US');

/** Where a "search homes" action should point: CINC IDX if configured. */
function searchHref(params = {}) {
  return cinc.buildSearchUrl(params) || ('/home-search' + toQuery(params));
}

function toQuery(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function listingHref(listing) {
  return cinc.buildListingUrl(listing.mlsId) || `/properties/${encodeURIComponent(listing.mlsId)}`;
}

const idxTarget = cincCfg.idxNewTab && cinc.isIdxConfigured() ? ' target="_blank" rel="noopener"' : '';

// --------------------------------------------------------------- sections ---

function hero({ eyebrow, title, subtitle, actions = [], search = true, variant = 'home' }) {
  return `<section class="hero hero-${esc(variant)}">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="hero-title">${title}</h1>
    ${subtitle ? `<p class="hero-sub">${esc(subtitle)}</p>` : ''}
    ${actions.length ? `<div class="hero-actions">${actions.map(button).join('')}</div>` : ''}
    ${search ? searchBar() : ''}
  </div>
</section>`;
}

function button(action) {
  const cls = action.style === 'secondary' ? 'btn btn-outline' : action.style === 'ghost' ? 'btn btn-ghost' : 'btn btn-primary';
  const attrs = action.external ? ' target="_blank" rel="noopener"' : '';
  return `<a class="${cls}" href="${esc(action.href)}"${attrs}>${esc(action.label)}</a>`;
}

/** IDX-aware search bar. Submits into CINC IDX when configured. */
function searchBar({ compact = false } = {}) {
  const action = cinc.buildSearchUrl() ? cinc.buildSearchUrl() : '/home-search';
  return `<form class="searchbar${compact ? ' searchbar-compact' : ''}" action="${esc(action)}" method="get" data-idx-search${idxTarget}>
  <div class="searchbar-field">
    <label class="sr-only" for="q">City, ZIP, or address</label>
    <input id="q" name="${cinc.isIdxConfigured() ? 'q' : 'q'}" type="search" placeholder="City, ZIP code, or address" autocomplete="off">
  </div>
  <div class="searchbar-field searchbar-select">
    <label class="sr-only" for="minPrice">Minimum price</label>
    <select id="minPrice" name="minPrice">
      <option value="">Min price</option>
      ${[400000, 500000, 600000, 700000, 800000, 1000000, 1500000].map((v) => `<option value="${v}">${money(v)}</option>`).join('')}
    </select>
  </div>
  <div class="searchbar-field searchbar-select">
    <label class="sr-only" for="maxPrice">Maximum price</label>
    <select id="maxPrice" name="maxPrice">
      <option value="">Max price</option>
      ${[600000, 750000, 900000, 1100000, 1500000, 2000000, 3000000].map((v) => `<option value="${v}">${money(v)}</option>`).join('')}
    </select>
  </div>
  <div class="searchbar-field searchbar-select">
    <label class="sr-only" for="beds">Bedrooms</label>
    <select id="beds" name="beds">
      <option value="">Beds</option>
      ${[1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v}+ beds</option>`).join('')}
    </select>
  </div>
  <button class="btn btn-primary" type="submit">Search Homes</button>
</form>`;
}

function statBar(items = stats) {
  return `<section class="statbar">
  <div class="wrap statbar-grid">
    ${items.map((s) => `<div class="stat"><span class="stat-value">${esc(s.value)}</span><span class="stat-label">${esc(s.label)}</span></div>`).join('')}
  </div>
</section>`;
}

function sectionHead({ eyebrow, title, text, align = 'left' }) {
  return `<div class="section-head section-head-${esc(align)}">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h2>${title}</h2>
    ${text ? `<p class="section-text">${esc(text)}</p>` : ''}
  </div>`;
}

function ctaBand({ title, text, actions = [] }) {
  return `<section class="cta-band">
  <div class="wrap cta-inner">
    <div>
      <h2>${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
    </div>
    <div class="cta-actions">${actions.map(button).join('')}</div>
  </div>
</section>`;
}

function splitCta() {
  return `<section class="section">
  <div class="wrap split-cta">
    <article class="split-card">
      <p class="eyebrow">Selling</p>
      <h3>Find out what your home is worth</h3>
      <p>A written price range built from closed sales inside your school district — not an automated guess. Free, with no obligation to list.</p>
      <a class="btn btn-primary" href="/home-valuation">Get My Home Value</a>
    </article>
    <article class="split-card split-card-dark">
      <p class="eyebrow">Buying</p>
      <h3>See listings before they hit the market</h3>
      <p>Our buyers get coming-soon inventory and off-market opportunities first, plus showings within twenty-four hours of a new listing.</p>
      <a class="btn btn-outline" href="/home-search"${idxTarget}>Start Your Search</a>
    </article>
  </div>
</section>`;
}

// ------------------------------------------------------------------ cards ---

function listingCard(listing) {
  const statusClass = listing.status.toLowerCase().replace(/\s+/g, '-');
  const photoSrc = listing.photo || findListingPhoto(listing.mlsId);
  const photo = photoSrc
    ? `<img src="${esc(photoSrc)}" alt="${esc(listing.address + ', ' + listing.city)}" loading="lazy">`
    : `<span class="photo-placeholder" aria-hidden="true">${esc(listing.city)}</span>`;
  return `<article class="listing-card">
  <a class="listing-media" href="${esc(listingHref(listing))}"${idxTarget}>
    ${photo}
    <span class="badge badge-${esc(statusClass)}">${esc(listing.status)}</span>
  </a>
  <div class="listing-body">
    <p class="listing-price">${money(listing.price)}</p>
    <h3 class="listing-address"><a href="${esc(listingHref(listing))}"${idxTarget}>${esc(listing.address)}</a></h3>
    <p class="listing-city">${esc(listing.city)}, ${esc(listing.state)} ${esc(listing.zip)}</p>
    <ul class="listing-specs">
      <li><strong>${esc(listing.beds)}</strong> bd</li>
      <li><strong>${esc(listing.baths)}</strong> ba</li>
      <li><strong>${Number(listing.sqft).toLocaleString('en-US')}</strong> sqft</li>
    </ul>
    <p class="listing-blurb">${esc(listing.blurb)}</p>
  </div>
</article>`;
}

function testimonialCard(t) {
  return `<figure class="quote-card">
  <div class="stars" aria-label="Five out of five stars">${'&#9733;'.repeat(5)}</div>
  <blockquote>${esc(t.quote)}</blockquote>
  <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.location)}${t.source ? ' &middot; ' + esc(t.source) : ''}</span></figcaption>
</figure>`;
}

function agentCard(member) {
  const photoSrc = member.photo || findHeadshot(member.slug);
  const photo = photoSrc
    ? `<img src="${esc(photoSrc)}" alt="${esc(member.name)}" loading="lazy">`
    : `<span class="agent-initials" aria-hidden="true">${esc(member.tile || initials(member.name))}</span>`;
  return `<article class="agent-card">
  <a class="agent-media" href="/agent/${esc(member.slug)}">${photo}</a>
  <div class="agent-body">
    <h3><a href="/agent/${esc(member.slug)}">${esc(member.name)}</a></h3>
    <p class="agent-role">${esc(member.role)}</p>
    <p class="agent-short">${esc(member.short)}</p>
    <p class="agent-links">
      <a href="tel:+1${esc(member.phone.replace(/\D/g, ''))}" data-call>${esc(member.phone)}</a>
      <a href="mailto:${esc(member.email)}">Email</a>
    </p>
  </div>
</article>`;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function neighborhoodCard(n) {
  return `<article class="hood-card">
  <a class="hood-media" href="/neighborhoods/${esc(n.slug)}"><span aria-hidden="true">${esc(n.name)}</span></a>
  <div class="hood-body">
    <h3><a href="/neighborhoods/${esc(n.slug)}">${esc(n.name)}</a></h3>
    <p class="hood-county">${esc(n.county)}</p>
    <p>${esc(n.blurb)}</p>
    <a class="link-arrow" href="${esc(searchHref({ city: n.city, state: n.state }))}"${idxTarget}>View homes in ${esc(n.name)}</a>
  </div>
</article>`;
}

function postCard(post) {
  return `<article class="post-card">
  <a class="post-media" href="/blog/${esc(post.slug)}"><span aria-hidden="true">${esc(post.category)}</span></a>
  <div class="post-body">
    <p class="post-meta">${esc(post.category)} &middot; ${esc(formatDate(post.date))} &middot; ${esc(post.readMinutes)} min read</p>
    <h3><a href="/blog/${esc(post.slug)}">${esc(post.title)}</a></h3>
    <p>${esc(post.excerpt)}</p>
    <a class="link-arrow" href="/blog/${esc(post.slug)}">Read more</a>
  </div>
</article>`;
}

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function steps(items) {
  return `<ol class="steps">
  ${items.map((s) => `<li><span class="step-n">${esc(s.n)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}
</ol>`;
}

function faqList(items) {
  return `<div class="faq">
  ${items.map((f) => `<details><summary>${esc(f.q)}</summary><div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join('')}
</div>`;
}

function breadcrumb(trail) {
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><div class="wrap">
    ${trail.map((t, i) => (t.href && i < trail.length - 1 ? `<a href="${esc(t.href)}">${esc(t.label)}</a>` : `<span>${esc(t.label)}</span>`)).join('<span class="sep" aria-hidden="true">/</span>')}
  </div></nav>`;
}

function pageHeader({ eyebrow, title, text }) {
  return `<section class="page-header">
  <div class="wrap">
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1>${title}</h1>
    ${text ? `<p class="page-header-text">${esc(text)}</p>` : ''}
  </div>
</section>`;
}

// ------------------------------------------------------------------ forms ---

/**
 * Lead form. Every field posts to /api/lead, which upserts into CINC.
 * `name` becomes the CINC tag `web:<name>`; `intent` is carried through to the
 * lead note and tags so CINC routing rules can branch on it.
 */
function leadForm({
  name,
  intent = '',
  title,
  text = '',
  fields = ['name', 'email', 'phone', 'message'],
  submitLabel = 'Send',
  consent = true,
  compact = false,
  hidden = {},
}) {
  const rendered = fields.map((f) => (typeof f === 'string' ? FIELDS[f] : customField(f))).filter(Boolean).join('');
  const hiddenInputs = Object.entries(hidden)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('');

  return `<form class="lead-form${compact ? ' lead-form-compact' : ''}" data-lead-form method="post" action="/api/lead" novalidate>
  ${title ? `<h3 class="form-title">${esc(title)}</h3>` : ''}
  ${text ? `<p class="form-text">${esc(text)}</p>` : ''}
  <input type="hidden" name="formName" value="${esc(name)}">
  <input type="hidden" name="intent" value="${esc(intent)}">
  ${hiddenInputs}
  <div class="hp" aria-hidden="true"><label>Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label></div>
  <div class="form-grid">${rendered}</div>
  ${consent ? `<label class="consent"><input type="checkbox" name="consent" value="yes" checked> I agree to be contacted by ${esc(brand.name)} by phone, text, or email about my inquiry. Consent is not a condition of purchase. Message and data rates may apply.</label>` : ''}
  <button class="btn btn-primary btn-block" type="submit" data-submit>${esc(submitLabel)}</button>
  <p class="form-status" data-status role="status" aria-live="polite"></p>
</form>`;
}

function customField(f) {
  const id = `f-${f.name}`;
  if (f.type === 'select') {
    return `<div class="field${f.wide ? ' field-wide' : ''}">
      <label for="${esc(id)}">${esc(f.label)}</label>
      <select id="${esc(id)}" name="${esc(f.name)}">
        ${(f.options || []).map((o) => `<option value="${esc(o.value !== undefined ? o.value : o)}">${esc(o.label || o)}</option>`).join('')}
      </select>
    </div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="field field-wide">
      <label for="${esc(id)}">${esc(f.label)}</label>
      <textarea id="${esc(id)}" name="${esc(f.name)}" rows="${esc(f.rows || 4)}" placeholder="${esc(f.placeholder || '')}"></textarea>
    </div>`;
  }
  return `<div class="field${f.wide ? ' field-wide' : ''}">
    <label for="${esc(id)}">${esc(f.label)}</label>
    <input id="${esc(id)}" name="${esc(f.name)}" type="${esc(f.type || 'text')}" placeholder="${esc(f.placeholder || '')}"${f.required ? ' required' : ''}${f.autocomplete ? ` autocomplete="${esc(f.autocomplete)}"` : ''}>
  </div>`;
}

const FIELDS = {
  name: customField({ name: 'name', label: 'Full name', required: true, autocomplete: 'name', placeholder: 'Jane Doe' }),
  email: customField({ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email', placeholder: 'you@email.com' }),
  phone: customField({ name: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel', placeholder: '(516) 555-0100' }),
  address: customField({ name: 'propertyAddress', label: 'Property address', wide: true, autocomplete: 'street-address', placeholder: '25 Sycamore Lane, Hicksville, NY' }),
  message: customField({ name: 'message', label: 'How can we help?', type: 'textarea', rows: 4 }),
  timeframe: customField({
    name: 'timeframe',
    label: 'Timeframe',
    type: 'select',
    options: ['', 'ASAP', '1-3 months', '3-6 months', '6-12 months', 'Just researching'].map((v) => ({ value: v, label: v || 'Select a timeframe' })),
  }),
  priceRange: customField({
    name: 'priceRange',
    label: 'Price range',
    type: 'select',
    options: ['', 'Under $600k', '$600k - $800k', '$800k - $1M', '$1M - $1.5M', '$1.5M+'].map((v) => ({ value: v, label: v || 'Select a range' })),
  }),
  beds: customField({
    name: 'beds',
    label: 'Bedrooms',
    type: 'select',
    options: ['', '2+', '3+', '4+', '5+'].map((v) => ({ value: v, label: v || 'Any' })),
  }),
  neighborhood: customField({ name: 'neighborhood', label: 'Area of interest', placeholder: 'Hicksville, Syosset, Massapequa...' }),
  preapproved: customField({
    name: 'preapproved',
    label: 'Mortgage pre-approval',
    type: 'select',
    options: ['', 'Yes, already pre-approved', 'Not yet - please connect me', 'Paying cash'].map((v) => ({ value: v, label: v || 'Select one' })),
  }),
};

module.exports = {
  hero,
  button,
  searchBar,
  statBar,
  sectionHead,
  ctaBand,
  splitCta,
  listingCard,
  testimonialCard,
  agentCard,
  neighborhoodCard,
  postCard,
  steps,
  faqList,
  breadcrumb,
  pageHeader,
  leadForm,
  searchHref,
  listingHref,
  formatDate,
  money,
  initials,
  idxTarget,
};
