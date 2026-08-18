'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const { whyPoints, sellerSteps } = require('../data/content');
const team = require('../data/team');
const listings = require('../data/listings');
const testimonials = require('../data/testimonials');
const neighborhoods = require('../data/neighborhoods');
const posts = require('../data/posts');

module.exports = function home() {
  const featured = listings.filter((l) => l.status !== 'Sold').slice(0, 3);
  const body = `
${c.hero({
  eyebrow: `${brand.marketLong}`,
  title: `Your Home Sold Guaranteed<br><span class="accent">or We Will Buy It</span>`,
  subtitle: `${brand.name} is the #1 home selling team on Long Island. More than 1,000 families served, 500+ five-star reviews, and a written guarantee behind every listing.`,
  actions: [
    { label: 'What Is My Home Worth?', href: '/home-valuation' },
    { label: 'Search Homes', href: '/home-search', style: 'secondary' },
  ],
})}

${c.statBar()}

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({
        eyebrow: 'The guarantee',
        title: 'A promise you can read before you sign',
        text: 'Most agents ask you to trust a marketing plan. We put the price and the timeline in writing first.',
      })}
      <p>Before your home is listed, we agree on three numbers together: the list price, the guaranteed price, and the number of days the guarantee runs. If your home does not sell inside that window, we buy it at the agreed price.</p>
      <p>It works because the hard part happens before the sign goes in the ground — honest pricing, a real preparation list, and marketing money behind the launch. Conditions apply and not every home qualifies; we will tell you on the first visit whether yours does.</p>
      <div class="inline-actions">
        <a class="btn btn-primary" href="/guaranteed-sale">How the Guarantee Works</a>
        <a class="btn btn-ghost" href="${esc(brand.phoneHref)}" data-call>Call ${esc(brand.phone)}</a>
      </div>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'home-valuation-hero',
        intent: 'seller',
        title: 'Get your free home valuation',
        text: 'A written price range for your home, built from closed sales in your school district.',
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
      ${whyPoints.map((p) => `<article class="why-card"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join('')}
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
    <div class="grid grid-3">${testimonials.slice(0, 3).map(c.testimonialCard).join('')}</div>
    <div class="center-actions"><a class="btn btn-ghost" href="/testimonials">Read All Reviews</a></div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Communities', title: 'Where we work', text: 'All of Nassau and Suffolk County, plus the Queens border.' })}
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
