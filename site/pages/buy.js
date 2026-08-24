'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const cinc = require('../lib/cinc');
const { buyerSteps } = require('../data/content');
const { findAsset } = require('../lib/assets');
const listings = require('../data/listings');
const neighborhoods = require('../data/neighborhoods');
const testimonials = require('../data/testimonials');

/**
 * Search page. When CINC IDX is configured this page is a launcher into the
 * IDX site; when it is not, it filters the local featured inventory so the
 * page is still useful pre-launch.
 */
function homeSearch(query = {}) {
  const idxReady = cinc.isIdxConfigured();
  const q = String(query.q || '').toLowerCase();
  const minPrice = Number(query.minPrice || 0);
  const maxPrice = Number(query.maxPrice || 0);
  const beds = Number(query.beds || 0);

  const results = listings.filter((l) => {
    if (l.status === 'Sold') return false;
    if (q && !`${l.address} ${l.city} ${l.zip} ${l.type}`.toLowerCase().includes(q)) return false;
    if (minPrice && l.price < minPrice) return false;
    if (maxPrice && l.price > maxPrice) return false;
    if (beds && l.beds < beds) return false;
    return true;
  });

  const idxPanel = idxReady
    ? `<div class="idx-embed">
        <iframe src="${esc(cinc.buildSearchUrl(query) || '')}" title="Live MLS home search" loading="lazy"></iframe>
      </div>
      <p class="fine">Live MLS results are powered by our CINC search platform. <a href="${esc(cinc.buildSearchUrl(query) || '')}" rel="noopener" target="_blank">Open the full map search</a>.</p>`
    : `<div class="notice">
        <h3>Full MLS search is being connected</h3>
        <p>Our live map search runs on the team CINC platform and is being pointed at this domain. In the meantime, tell us what you are looking for and we will send matching listings — including homes that have not reached the open market yet.</p>
      </div>`;

  const body = `
${c.pageHeader({
  eyebrow: 'Home search',
  title: `Find your home on ${esc(brand.market)}`,
  text: 'Search active listings across Nassau and Suffolk, or have us send you matches — including coming-soon homes before they hit the market.',
})}

<section class="section section-search">
  <div class="wrap">
    ${c.searchBar()}
    ${idxPanel}
  </div>
</section>

${results.length ? `<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Featured', title: `${results.length} featured ${results.length === 1 ? 'home' : 'homes'}` })}
    <div class="grid grid-3">${results.map(c.listingCard).join('')}</div>
  </div>
</section>` : ''}

<section class="section section-tint">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Buyer list', title: 'See homes before the open market does' })}
      <p>Our sellers list with us weeks before their homes go live. Buyers on our list see those homes first, tour them first, and write offers before the weekend crowd shows up.</p>
      <ul class="check-list">
        <li>Coming-soon and off-market inventory sent as it comes in.</li>
        <li>Showings within twenty-four hours of a new listing.</li>
        <li>A lender introduction so your pre-approval holds up in a multiple-offer situation.</li>
      </ul>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'buyer-alerts',
        intent: 'buyer',
        title: 'Get matching listings',
        text: 'Tell us the area and price and we will start sending homes.',
        fields: ['name', 'email', 'phone', 'neighborhood', 'priceRange', 'beds', 'preapproved'],
        submitLabel: 'Send Me Listings',
      })}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Browse by town', title: 'Search a specific community' })}
    <div class="chip-grid">
      ${neighborhoods.map((n) => `<a class="chip" href="${esc(c.searchHref({ city: n.city, state: n.state }))}"${c.idxTarget}>${esc(n.name)}</a>`).join('')}
    </div>
  </div>
</section>
`;

  return page({
    title: 'Search Long Island Homes for Sale',
    description: 'Search homes for sale across Nassau and Suffolk County with Team Raj Jaggi. Live MLS search plus coming-soon listings before they hit the market.',
    path: '/home-search',
    body,
  });
}

function featuredListings() {
  const active = listings.filter((l) => l.status !== 'Sold');
  const sold = listings.filter((l) => l.status === 'Sold');
  const body = `
${c.pageHeader({
  eyebrow: 'Our listings',
  title: 'Featured Long Island listings',
  text: 'A selection of what the team has on the market and recently closed. For live inventory across the full MLS, use the search.',
})}

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Available', title: 'On the market and coming soon' })}
    <div class="grid grid-3">${active.map(c.listingCard).join('')}</div>
    <div class="center-actions"><a class="btn btn-primary" href="/home-search"${c.idxTarget}>Search the Full MLS</a></div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Recently sold', title: 'What our listings did' })}
    <div class="grid grid-3">${sold.map(c.listingCard).join('')}</div>
  </div>
</section>

${c.ctaBand({
  title: 'Want your home on this page?',
  text: 'Start with a free valuation and the guaranteed price.',
  actions: [{ label: 'Get My Home Value', href: '/home-valuation' }],
})}
`;

  return page({
    title: 'Featured Listings — Long Island Homes for Sale',
    description: 'Featured Long Island listings from Team Raj Jaggi, including coming-soon homes and recently closed sales.',
    path: '/properties/sale',
    body,
  });
}

/** Fallback listing detail used when CINC IDX is not configured yet. */
function listingDetail(listing) {
  const body = `
${c.breadcrumb([
  { label: 'Home', href: '/' },
  { label: 'Listings', href: '/properties/sale' },
  { label: `${listing.address}, ${listing.city}` },
])}
<section class="section">
  <div class="wrap">
    <div class="listing-hero">
      <div class="listing-hero-media"><span class="photo-placeholder" aria-hidden="true">${esc(listing.city)}</span></div>
      <div class="listing-hero-body">
        <span class="badge badge-${esc(listing.status.toLowerCase().replace(/\s+/g, '-'))}">${esc(listing.status)}</span>
        <h1>${esc(listing.address)}</h1>
        <p class="listing-city">${esc(listing.city)}, ${esc(listing.state)} ${esc(listing.zip)}</p>
        <p class="listing-price listing-price-lg">${c.money(listing.price)}</p>
        <ul class="listing-specs listing-specs-lg">
          <li><strong>${esc(listing.beds)}</strong> beds</li>
          <li><strong>${esc(listing.baths)}</strong> baths</li>
          <li><strong>${Number(listing.sqft).toLocaleString('en-US')}</strong> sqft</li>
          <li><strong>${esc(listing.lot)}</strong> lot</li>
        </ul>
        <p>${esc(listing.blurb)}</p>
        <p class="fine">MLS #${esc(listing.mlsId)} &middot; ${esc(listing.type)}</p>
      </div>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap narrow">
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'listing-inquiry',
        intent: 'buyer',
        title: `Ask about ${listing.address}`,
        text: 'Request a showing or get the full disclosure package.',
        fields: ['name', 'email', 'phone', 'message'],
        submitLabel: 'Request a Showing',
        hidden: { propertyAddress: `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip}`, tags: `mls:${listing.mlsId}` },
      })}
    </div>
  </div>
</section>
`;

  return page({
    title: `${listing.address}, ${listing.city}, ${listing.state}`,
    description: `${listing.beds} bed, ${listing.baths} bath ${listing.type} at ${listing.address}, ${listing.city}, ${listing.state}. ${listing.blurb}`,
    path: `/properties/${listing.mlsId}`,
    body,
  });
}

function buyersGuide() {
  const body = `
${c.pageHeader({
  eyebrow: 'Buyer guide',
  title: 'Buying a home on Long Island',
  text: 'What the process actually looks like, and where buyers lose houses they could have won.',
})}

<section class="section">
  <div class="wrap">${c.steps(buyerSteps)}</div>
</section>

${findAsset('images/photos', 'kitchen') ? `<section class="section section-tint">
  <div class="wrap two-col">
    <div class="frame media-figure" data-reveal>
      <img class="photo" src="${findAsset('images/photos', 'kitchen')}" alt="Renovated kitchen interior" loading="lazy">
    </div>
    <div>
      ${c.sectionHead({ eyebrow: 'What to look for', title: 'Buy the house, not the staging' })}
      <ul class="check-list">
        <li>Renovations that were permitted and closed out with the town.</li>
        <li>Roof, boiler, and electrical age — the three that cost real money.</li>
        <li>Oil tank history on anything built before the 1970s.</li>
        <li>Water pressure, drainage, and grading around the foundation.</li>
        <li>What the taxes will be for you, without the seller exemptions.</li>
      </ul>
    </div>
  </div>
</section>` : ''}

<section class="section section-dark">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Offers', title: 'Price is one of six levers' })}
      <ul class="check-list check-list-light">
        <li>Proof of funds and a pre-approval the listing agent recognizes.</li>
        <li>A closing timeline built around the seller, not around you.</li>
        <li>Post-closing occupancy for a seller who has not found their next home.</li>
        <li>Inspection posture — informational rather than a second negotiation.</li>
        <li>Appraisal gap coverage sized to your actual cash reserves.</li>
        <li>A complete offer package delivered the same day.</li>
      </ul>
    </div>
    <div>
      ${c.sectionHead({ eyebrow: 'Costs', title: 'What a Long Island buyer pays' })}
      <ul class="check-list check-list-light">
        <li>Down payment and lender closing costs.</li>
        <li>Attorney fee — required in practice on Long Island.</li>
        <li>Title insurance and search fees.</li>
        <li>Mansion tax of 1% on purchases at or above $1,000,000.</li>
        <li>Inspection, and an oil tank sweep where the house calls for one.</li>
        <li>First-year homeowners insurance, plus flood insurance in south-shore zones.</li>
      </ul>
      <p class="fine">General information only, not legal or tax advice. Your attorney and lender will give you exact figures.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Get started', title: 'Start with a strategy call' })}
      <p>Twenty minutes on the phone will tell you more than a month of scrolling listings: which districts fit your budget, what the taxes do to your monthly payment, and how fast you need to be able to move in the towns you like.</p>
      <div class="inline-actions">
        <a class="btn btn-ghost" href="${esc(brand.phoneHref)}" data-call>Call ${esc(brand.phone)}</a>
        <a class="btn btn-ghost" href="/mortgage-calculator">Mortgage Calculator</a>
      </div>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'buyer-consult',
        intent: 'buyer',
        title: 'Book a buyer strategy call',
        fields: ['name', 'email', 'phone', 'neighborhood', 'priceRange', 'preapproved', 'timeframe'],
        submitLabel: 'Request My Call',
      })}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Buyers', title: 'How it went for them', align: 'center' })}
    <div class="grid grid-3">${testimonials.filter((t) => t.intent !== 'seller').slice(0, 3).map(c.testimonialCard).join('')}</div>
  </div>
</section>
`;

  return page({
    title: 'Buyer Guide — Buying a Home on Long Island',
    description: 'A practical guide to buying a home on Long Island: financing, offer strategy in multiple-offer markets, closing costs, and the full process.',
    path: '/buyers-guide',
    body,
  });
}

function mortgageCalculator() {
  const body = `
${c.pageHeader({
  eyebrow: 'Tools',
  title: 'Long Island mortgage calculator',
  text: 'Estimate a monthly payment including the part that surprises people here: the taxes.',
})}

<section class="section">
  <div class="wrap two-col">
    <div class="calc-panel">
      <form class="calc" data-calc>
        <div class="form-grid">
          <div class="field"><label for="price">Home price</label><input id="price" name="price" type="number" value="750000" min="0" step="1000"></div>
          <div class="field"><label for="down">Down payment (%)</label><input id="down" name="down" type="number" value="20" min="0" max="100" step="1"></div>
          <div class="field"><label for="rate">Interest rate (%)</label><input id="rate" name="rate" type="number" value="6.5" min="0" max="20" step="0.05"></div>
          <div class="field"><label for="years">Term (years)</label><input id="years" name="years" type="number" value="30" min="1" max="40" step="1"></div>
          <div class="field"><label for="taxes">Annual property taxes</label><input id="taxes" name="taxes" type="number" value="14000" min="0" step="100"></div>
          <div class="field"><label for="insurance">Annual insurance</label><input id="insurance" name="insurance" type="number" value="2200" min="0" step="100"></div>
        </div>
      </form>
      <div class="calc-out" data-calc-out aria-live="polite"></div>
      <p class="fine">Estimate only. Excludes PMI, HOA, and flood insurance. Your lender will give you exact figures.</p>
    </div>
    <div>
      ${c.sectionHead({ eyebrow: 'Why taxes matter here', title: 'The number that changes what you can afford' })}
      <p>On Long Island, property taxes routinely add $1,000 to $1,800 a month to a payment. Two identical houses on the same block can carry bills thousands of dollars apart depending on when the assessment was last grieved.</p>
      <p>Underwrite the taxes the way the bank does — without any seller exemption that will not transfer to you.</p>
      <div class="callout">
        <h3>Need a lender introduction?</h3>
        <p>We will connect you with a local lender who can close on a Long Island timeline.</p>
        <a class="btn btn-primary" href="/contact-us">Connect Me With a Lender</a>
      </div>
    </div>
  </div>
</section>
`;

  return page({
    title: 'Mortgage Calculator — Long Island Monthly Payment Estimator',
    description: 'Estimate your monthly payment on a Long Island home, including property taxes and insurance, with the Team Raj Jaggi mortgage calculator.',
    path: '/mortgage-calculator',
    body,
  });
}

module.exports = { homeSearch, featuredListings, listingDetail, buyersGuide, mortgageCalculator };
