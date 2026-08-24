'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const { whyPoints, sellerSteps, guaranteePoints } = require('../data/content');
const team = require('../data/team');
const listings = require('../data/listings');
const testimonials = require('../data/testimonials');
const neighborhoods = require('../data/neighborhoods');
const posts = require('../data/posts');

module.exports = function home() {
  const featured = listings.filter((l) => l.status !== 'Sold').slice(0, 3);
  const body = `
${c.hero({
  eyebrow: brand.marketLong,
  title: `Your Home Sold Guaranteed<br><span class="accent">or We Will Buy It</span>`,
  subtitle: `${brand.name} is the #1 home selling team on Long Island. More than 1,000 families served, 500+ five-star reviews, and the price and timeline agreed in writing before your home reaches the market.`,
  actions: [
    { label: 'What Is My Home Worth?', href: '/home-valuation' },
    { label: 'Search Homes', href: '/home-search', style: 'secondary' },
  ],
  trust: [
    { icon: 'star', label: '500+ five-star reviews' },
    { icon: 'house', label: '1,000+ families served' },
    { icon: 'pin', label: 'Nassau, Suffolk & Queens' },
  ],
  aside: `${c.graphics.guaranteeSeal(190)}
        <div class="hero-card"><strong>$46,000</strong><span>Over asking, Levittown</span></div>`,
})}

${c.statBar()}

${c.guaranteeBand({
  title: 'A promise you can read before you sign',
  intro: 'Before your home is listed we agree on three numbers together: the list price, the guaranteed price, and how many days the guarantee runs. If it does not sell inside that window, we buy it at the agreed price.',
  points: guaranteePoints.slice(0, 4),
  actions: [
    { label: 'How the Guarantee Works', href: '/guaranteed-sale' },
    { label: `Call ${brand.phone}`, href: brand.phoneHref, style: 'secondary' },
  ],
})}

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Free valuation', title: 'Start with the number the market supports' })}
      <p>An automated estimate cannot see your school district line, your permits, your flood zone, or your condition. We can. Tell us about the property and we will send a written price range with the closed comparables behind it.</p>
      <ul class="check-list">
        <li>Closed sales in your district from the last ninety days, adjusted for condition.</li>
        <li>The active listings you would actually be competing against.</li>
        <li>Your guaranteed-sale price, if the home qualifies.</li>
      </ul>
      <div class="inline-actions">
        <a class="btn btn-ghost" href="${esc(brand.phoneHref)}" data-call>Call ${esc(brand.phone)}</a>
      </div>
    </div>
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'home-valuation-hero',
        intent: 'seller',
        title: 'Get your free home valuation',
        text: 'Most reports go out within one business day.',
        fields: ['name', 'email', 'phone', 'address', 'timeframe'],
        submitLabel: 'Get My Home Value',
      })}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Featured', title: 'Homes on the market now', text: 'A sample of current inventory. Search the full MLS for live listings across Nassau and Suffolk.', align: 'center' })}
    <div class="grid grid-3">${featured.map(c.listingCard).join('')}</div>
    <div class="center-actions">
      <a class="btn btn-primary" href="/home-search"${c.idxTarget}>Search All Homes</a>
      <a class="btn btn-ghost" href="/properties/sale">See Featured Listings</a>
    </div>
  </div>
</section>

${c.splitCta()}

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Why this team', title: 'What you actually get', align: 'center' })}
    <div class="grid grid-3 why-grid">
      ${whyPoints.map(c.whyCard).join('')}
    </div>
  </div>
</section>

<section class="section section-dark">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'The process', title: 'Six steps from valuation to closing', align: 'center' })}
    ${c.steps(sellerSteps)}
    <div class="center-actions">
      <a class="btn btn-primary" href="/sellers-guide">Read the Seller Guide</a>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Reviews', title: 'What our clients say', text: 'More than 500 five-star reviews across Google, Zillow, and Yelp.', align: 'center' })}
    <div class="grid grid-3 quote-row">${testimonials.slice(0, 3).map(c.testimonialCard).join('')}</div>
    <div class="center-actions"><a class="btn btn-ghost" href="/testimonials">Read All Reviews</a></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Communities', title: 'Where we work', text: 'All of Nassau and Suffolk County, plus the Queens border. Tap a pin for that market.' })}
    ${c.mapSection()}
    <div class="grid grid-4 hood-grid">${neighborhoods.slice(0, 8).map(c.neighborhoodCard).join('')}</div>
    <div class="center-actions"><a class="btn btn-ghost" href="/neighborhoods">All Neighborhoods</a></div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'The team', title: 'Who you will be working with', align: 'center' })}
    <div class="grid grid-4">${team.map(c.agentCard).join('')}</div>
    <div class="center-actions"><a class="btn btn-ghost" href="/team">Meet the Full Team</a></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Insights', title: 'From the blog' })}
    <div class="grid grid-3">${posts.slice(0, 3).map(c.postCard).join('')}</div>
  </div>
</section>

${c.ctaBand({
  title: 'Ready to talk about your move?',
  text: `Call ${brand.phone} or send us a note. We will answer either way.`,
  actions: [
    { label: 'Get My Home Value', href: '/home-valuation' },
    { label: 'Contact the Team', href: '/contact-us', style: 'secondary' },
  ],
})}
`;

  return page({
    title: null,
    description: `${brand.legalName} — the #1 home selling team on Long Island. Your home sold guaranteed or we will buy it. Free home valuation, full MLS search, and 500+ five-star reviews.`,
    path: '/',
    body,
    bodyClass: 'page-home',
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: brand.legalName,
      url: brand.baseUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${brand.baseUrl}/home-search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    }],
  });
};
