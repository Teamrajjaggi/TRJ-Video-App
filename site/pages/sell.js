'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const cinc = require('../lib/cinc');
const { sellerSteps, guaranteePoints, faq } = require('../data/content');
const testimonials = require('../data/testimonials');

function homeValuation() {
  const idxValuation = cinc.buildValuationUrl();
  const body = `
${c.pageHeader({
  eyebrow: 'Free, no obligation',
  title: 'What is my Long Island home worth?',
  text: 'An automated estimate cannot see your school district line, your permits, your flood zone, or your condition. We can. Tell us about the property and we will send a written price range with the comparables behind it.',
})}

<section class="section">
  <div class="wrap two-col two-col-reverse">
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'home-valuation',
        intent: 'seller',
        title: 'Request your valuation',
        text: 'Most reports go out within one business day.',
        fields: [
          'address',
          'name',
          'email',
          'phone',
          { name: 'beds', label: 'Bedrooms', type: 'select', options: ['', '1', '2', '3', '4', '5', '6+'].map((v) => ({ value: v, label: v || 'Select' })) },
          { name: 'baths', label: 'Bathrooms', type: 'select', options: ['', '1', '1.5', '2', '2.5', '3', '3.5+'].map((v) => ({ value: v, label: v || 'Select' })) },
          'timeframe',
          { name: 'message', label: 'Anything we should know? (updates, additions, tenants, estate sale)', type: 'textarea', rows: 3 },
        ],
        submitLabel: 'Send My Valuation Request',
      })}
      ${idxValuation ? `<p class="form-alt">Prefer an instant estimate first? <a href="${esc(idxValuation)}" rel="noopener">Run the automated tool</a>, then have us check it.</p>` : ''}
    </div>
    <div>
      ${c.sectionHead({ eyebrow: 'What you get', title: 'A real number, with the reasoning attached' })}
      <ul class="check-list">
        <li>Closed sales inside your school district from the last ninety days, adjusted for condition.</li>
        <li>The active listings you would be competing against, and how they are priced.</li>
        <li>Absorption for your price band — how fast homes like yours are actually selling.</li>
        <li>A prep list of what to fix and, just as important, what to leave alone.</li>
        <li>Your guaranteed-sale price, if the home qualifies for the guarantee.</li>
      </ul>
      <div class="callout">
        <h3>Already thinking about timing?</h3>
        <p>Call ${esc(brand.phone)} and ask for a walkthrough. There is no cost and no obligation to list.</p>
        <a class="btn btn-ghost" href="${esc(brand.phoneHref)}" data-call>Call ${esc(brand.phone)}</a>
      </div>
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Sellers', title: 'They asked the same question first', align: 'center' })}
    <div class="grid grid-3">${testimonials.filter((t) => t.intent === 'seller').slice(0, 3).map(c.testimonialCard).join('')}</div>
  </div>
</section>

${c.ctaBand({
  title: 'Want the guaranteed price too?',
  text: 'We will bring both numbers to the walkthrough — the market price and the price we would guarantee.',
  actions: [{ label: 'How the Guarantee Works', href: '/guaranteed-sale' }],
})}
`;

  return page({
    title: 'What Is My Home Worth? Free Long Island Home Valuation',
    description: 'Get a free, no-obligation home valuation from Team Raj Jaggi. A written price range built from closed sales in your Long Island school district.',
    path: '/home-valuation',
    body,
  });
}

function guaranteedSale() {
  const body = `
${c.pageHeader({
  eyebrow: 'The signature program',
  title: 'Your Home Sold Guaranteed,<br><span class="accent">or We Will Buy It</span>',
  text: 'The price and the timeline are agreed in writing before your home goes on the market. If it does not sell inside that window, we buy it.',
})}

<section class="section">
  <div class="wrap">
    <div class="grid grid-2 guarantee-grid">
      ${guaranteePoints.map((p) => `<article class="why-card"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></article>`).join('')}
    </div>
  </div>
</section>

<section class="section section-dark">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'How it works', title: 'Three numbers, agreed up front', align: 'center' })}
    <ol class="steps steps-3">
      <li><span class="step-n">01</span><h3>The list price</h3><p>Set from closed comparables in your district and the active competition — not from a wish.</p></li>
      <li><span class="step-n">02</span><h3>The guaranteed price</h3><p>The number we commit to buy at if the home does not sell. You see it before you sign.</p></li>
      <li><span class="step-n">03</span><h3>The timeline</h3><p>The number of days the guarantee runs, agreed with you and written into the agreement.</p></li>
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Read this part', title: 'The conditions, stated plainly' })}
      <p>A guarantee only means something if you can read it. Here is what has to be true for a home to qualify:</p>
      <ul class="check-list">
        <li>Seller and ${esc(brand.name)} agree on the list price and the guaranteed price in writing before listing.</li>
        <li>Clear, marketable title.</li>
        <li>Reasonable showing access during the guarantee window.</li>
        <li>Agreed repairs and preparation completed before the home goes live.</li>
        <li>The property is in a market and condition where the guarantee is realistic.</li>
      </ul>
      <p class="fine">Not every home qualifies. Full written terms are provided at the listing appointment, before any agreement is signed. Bring your attorney.</p>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'guaranteed-sale',
        intent: 'seller',
        title: 'See if your home qualifies',
        text: 'We will review the property and bring both numbers to the walkthrough.',
        fields: ['address', 'name', 'email', 'phone', 'timeframe'],
        submitLabel: 'Check My Eligibility',
      })}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap narrow">
    ${c.sectionHead({ eyebrow: 'Questions', title: 'Common questions about the guarantee', align: 'center' })}
    ${c.faqList(faq.slice(0, 4))}
  </div>
</section>
`;

  return page({
    title: 'Your Home Sold Guaranteed or We Will Buy It',
    description: 'How the Team Raj Jaggi guaranteed sale program works: the list price, the guaranteed price, and the timeline, all agreed in writing before your Long Island home is listed.',
    path: '/guaranteed-sale',
    body,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.slice(0, 4).map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    }],
  });
}

function sellersGuide() {
  const body = `
${c.pageHeader({
  eyebrow: 'Seller guide',
  title: 'Selling a home on Long Island',
  text: 'What actually moves your net proceeds, in the order it happens.',
})}

<section class="section">
  <div class="wrap">
    ${c.steps(sellerSteps)}
  </div>
</section>

<section class="section section-tint">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Preparation', title: 'The two-week list that pays' })}
      <ul class="check-list">
        <li>Neutral paint — the highest-return item on any prep list.</li>
        <li>Clear two-thirds of everything from closets, counters, and the garage.</li>
        <li>Fix every small thing a buyer can touch: sticking doors, running toilets, dead bulbs.</li>
        <li>Deep clean, windows and grout included.</li>
        <li>Front landscaping: mulch, edging, a clean sight line to the door.</li>
        <li>Close out open permits before listing, not during attorney review.</li>
      </ul>
      <p class="fine">Skip the kitchen renovation. On Long Island it rarely returns what it costs at resale.</p>
    </div>
    <div>
      ${c.sectionHead({ eyebrow: 'Marketing', title: 'What we put behind your listing' })}
      <ul class="check-list">
        <li>Professional photography, video walkthrough, and floor plans.</li>
        <li>Coming-soon exposure to our buyer database before the open market.</li>
        <li>Full MLS syndication to the major consumer portals.</li>
        <li>A paid search and social campaign aimed at your price band and district.</li>
        <li>Open houses staffed by the team, with every visitor followed up personally.</li>
        <li>Weekly written reporting: traffic, feedback, and what it means for the price.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap narrow">
    ${c.sectionHead({ eyebrow: 'Costs', title: 'What a Long Island seller actually pays', align: 'center' })}
    <ul class="check-list">
      <li>Brokerage commission, agreed in the listing agreement.</li>
      <li>Attorney fee — on Long Island, an attorney handles the contract, not the agent.</li>
      <li>New York State transfer tax, plus the mansion tax on sales at or above $1,000,000 (paid by the buyer).</li>
      <li>Any agreed repair credits coming out of the inspection.</li>
      <li>Payoff of your mortgage and any open liens at closing.</li>
    </ul>
    <p class="fine">We will build a written net sheet for your specific sale before you accept an offer. This page is general information, not legal or tax advice.</p>
  </div>
</section>

${c.ctaBand({
  title: 'Start with the number',
  text: 'A free valuation is the first step, and it commits you to nothing.',
  actions: [
    { label: 'Get My Home Value', href: '/home-valuation' },
    { label: 'The Guarantee', href: '/guaranteed-sale', style: 'secondary' },
  ],
})}
`;

  return page({
    title: 'Seller Guide — Selling a Home on Long Island',
    description: 'A step-by-step guide to selling a home on Long Island: pricing, preparation, marketing, offers, and closing costs, from Team Raj Jaggi.',
    path: '/sellers-guide',
    body,
  });
}

module.exports = { homeValuation, guaranteedSale, sellersGuide };
