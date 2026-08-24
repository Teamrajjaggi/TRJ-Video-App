'use strict';

const { brand, site, cinc } = require('../config');

/**
 * Brand lockup. Renders the logo file when one is present under
 * public/images/, and otherwise falls back to a navy TRJ monogram tile paired
 * with the red wordmark from .brand-text.
 */
function brandMark({ light = false } = {}) {
  const src = light ? brand.logoLight : brand.logo;
  if (src) {
    return `<img class="brand-logo${light ? ' brand-logo-light' : ''}" src="${esc(src)}" alt="${esc(brand.name)}" width="200" height="109">`;
  }
  return '<span class="brand-mark" aria-hidden="true">TRJ</span>';
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape a value for HTML text or attribute context. */
function esc(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Serialize a JS value for a <script type="application/json"> block. */
function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

const NAV = [
  {
    label: 'Buy',
    href: '/home-search',
    children: [
      { label: 'Search Homes', href: '/home-search' },
      { label: 'Featured Listings', href: '/properties/sale' },
      { label: 'Buyer Guide', href: '/buyers-guide' },
      { label: 'Mortgage Calculator', href: '/mortgage-calculator' },
    ],
  },
  {
    label: 'Sell',
    href: '/home-valuation',
    children: [
      { label: 'What Is My Home Worth', href: '/home-valuation' },
      { label: 'The Guarantee', href: '/guaranteed-sale' },
      { label: 'Seller Guide', href: '/sellers-guide' },
    ],
  },
  { label: 'Neighborhoods', href: '/neighborhoods' },
  {
    label: 'About',
    href: '/team',
    children: [
      { label: 'Meet the Team', href: '/team' },
      { label: 'Reviews', href: '/testimonials' },
      { label: 'Blog', href: '/blog' },
      { label: 'Join Our Team', href: '/join-us' },
    ],
  },
  { label: 'Contact', href: '/contact-us' },
];

function navItem(item, currentPath) {
  const active = currentPath === item.href || (item.children || []).some((c) => c.href === currentPath);
  const children = item.children
    ? `<div class="nav-menu">${item.children
        .map((c) => `<a href="${esc(c.href)}"${c.href === currentPath ? ' aria-current="page"' : ''}>${esc(c.label)}</a>`)
        .join('')}</div>`
    : '';
  return `<li class="nav-item${item.children ? ' has-menu' : ''}${active ? ' is-active' : ''}">
      <a href="${esc(item.href)}"${active ? ' aria-current="page"' : ''}>${esc(item.label)}</a>${children}
    </li>`;
}

function header(currentPath) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<div class="topbar">
  <div class="wrap topbar-inner">
    <span class="topbar-claim">${esc(brand.tagline)}*</span>
    <span class="topbar-contact">
      <a href="${esc(brand.phoneHref)}" data-call>${esc(brand.phone)}</a>
      <span class="dot" aria-hidden="true">&middot;</span>
      <a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a>
    </span>
  </div>
</div>
<header class="site-header" data-header>
  <div class="wrap header-inner">
    <a class="brand${brand.logo ? ' brand-has-logo' : ''}" href="/">
      ${brandMark()}
      <span class="brand-text">
        <span class="brand-name">${esc(brand.name)}</span>
        <span class="brand-sub">${esc(brand.brokerage || brand.market + " Real Estate")}</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <ul>${NAV.map((item) => navItem(item, currentPath)).join('')}</ul>
    </nav>
    <div class="header-actions">
      <a class="btn btn-ghost" href="${esc(brand.phoneHref)}" data-call>${esc(brand.phone)}</a>
      <a class="btn btn-primary" href="/home-valuation">Home Value</a>
    </div>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" data-nav-toggle>
      <span class="sr-only">Menu</span>
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
  </div>
  <div class="mobile-nav" id="mobile-nav" hidden>
    <ul>
      ${NAV.flatMap((item) => [item, ...(item.children || [])])
        .map((item) => `<li><a href="${esc(item.href)}">${esc(item.label)}</a></li>`)
        .join('')}
    </ul>
    <div class="mobile-cta">
      <a class="btn btn-primary btn-block" href="/home-valuation">Get My Home Value</a>
      <a class="btn btn-ghost btn-block" href="${esc(brand.phoneHref)}" data-call>Call ${esc(brand.phone)}</a>
    </div>
  </div>
</header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      ${brandMark({ light: true })}
      <p class="footer-name">${esc(brand.legalName)}</p>
      ${brand.brokerage ? `<p class="footer-line">${esc(brand.brokerage)}</p>` : ''}
      <p class="footer-line">${esc(brand.addressLine)}</p>
      <p class="footer-line"><a href="${esc(brand.phoneHref)}" data-call>${esc(brand.phone)}</a></p>
      <p class="footer-line"><a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a></p>
      <div class="socials">
        ${[['Facebook', brand.social.facebook], ['Instagram', brand.social.instagram], ['LinkedIn', brand.social.linkedin], ['X', brand.social.x], ['YouTube', brand.social.youtube]]
          .filter(([, href]) => href)
          .map(([label, href]) => `<a href="${esc(href)}" rel="noopener" target="_blank">${esc(label)}</a>`)
          .join('')}
      </div>
    </div>
    <div class="footer-col">
      <h3>Buy</h3>
      <a href="/home-search">Search Homes</a>
      <a href="/properties/sale">Featured Listings</a>
      <a href="/buyers-guide">Buyer Guide</a>
      <a href="/mortgage-calculator">Mortgage Calculator</a>
      <a href="/neighborhoods">Neighborhoods</a>
    </div>
    <div class="footer-col">
      <h3>Sell</h3>
      <a href="/home-valuation">What Is My Home Worth</a>
      <a href="/guaranteed-sale">The Guarantee</a>
      <a href="/sellers-guide">Seller Guide</a>
      <a href="/testimonials">Client Reviews</a>
    </div>
    <div class="footer-col">
      <h3>Company</h3>
      <a href="/team">Meet the Team</a>
      <a href="/blog">Blog</a>
      <a href="/join-us">Join Our Team</a>
      <a href="/contact-us">Contact</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Use</a>
      <a href="/accessibility">Accessibility</a>
    </div>
  </div>
  <div class="wrap footer-legal">
    <p>*Guarantee terms are agreed in writing before listing. Seller and ${esc(brand.name)} must agree on price and timeline. Not every home qualifies. Full terms provided at the listing appointment.</p>
    <p>&copy; ${year} ${esc(brand.legalName)}. All rights reserved.${brand.brokerage ? ' ' + esc(brand.brokerage) + '.' : ''} Licensed real estate salespersons in the State of New York.</p>
    <p class="fair-housing"><span class="eho" aria-hidden="true">EHO</span> Equal Housing Opportunity. Information deemed reliable but not guaranteed. Listing data is provided for consumers' personal, non-commercial use.</p>
  </div>
</footer>`;
}

function structuredData(extra) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: brand.legalName,
    url: brand.baseUrl,
    telephone: brand.phone,
    email: brand.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: brand.address.street,
      addressLocality: brand.address.city,
      addressRegion: brand.address.state,
      postalCode: brand.address.zip,
      addressCountry: 'US',
    },
    areaServed: brand.marketLong,
    sameAs: Object.values(brand.social).filter(Boolean),
  };
  if (brand.brokerage) org.parentOrganization = { '@type': 'Organization', name: brand.brokerage };
  const blocks = [org].concat(extra || []);
  return blocks.map((b) => `<script type="application/ld+json">${jsonScript(b)}</script>`).join('\n');
}

function analytics() {
  let out = '';
  if (site.googleAnalyticsId) {
    out += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.googleAnalyticsId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(site.googleAnalyticsId)}');</script>`;
  }
  if (site.metaPixelId) {
    out += `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(site.metaPixelId)}');fbq('track','PageView');</script>`;
  }
  return out;
}

/**
 * Render a full page.
 * @param {object} opts title, description, path, body, schema, bodyClass
 */
function page(opts) {
  const {
    title,
    description = `${brand.legalName} — ${brand.tagline}. ${brand.marketLong} real estate.`,
    path = '/',
    body = '',
    schema = null,
    bodyClass = '',
  } = opts;

  const fullTitle = title ? `${title} | ${brand.name}` : `${brand.name} | ${brand.market} Real Estate`;
  const canonical = brand.baseUrl + (path === '/' ? '' : path);

  return `<!doctype html>
<html lang="en">
<head>
<script>document.documentElement.className+=" js";</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(brand.legalName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#242a63">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=DM+Sans:wght@400;500;700;900&display=swap">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/design.css">
${structuredData(schema)}
${analytics()}
</head>
<body class="${esc(bodyClass)}" data-idx="${cinc.idxBaseUrl ? 'on' : 'off'}">
${header(path)}
<main id="main">
${body}
</main>
${footer()}
<script src="/main.js" defer></script>
</body>
</html>`;
}

module.exports = { page, esc, jsonScript, brandMark, NAV };
