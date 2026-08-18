'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand, stats } = require('../config');
const { faq } = require('../data/content');
const team = require('../data/team');
const testimonials = require('../data/testimonials');
const neighborhoods = require('../data/neighborhoods');

function teamPage() {
  const body = `
${c.pageHeader({
  eyebrow: 'About us',
  title: `Meet ${esc(brand.name)}`,
  text: 'A listing department, a buyer department, and a transaction manager — so no part of your deal waits on one person’s calendar.',
})}

${c.statBar()}

<section class="section">
  <div class="wrap narrow">
    ${c.sectionHead({ eyebrow: 'Our story', title: 'Built on one promise', align: 'center' })}
    <p class="lede">Raj Jaggi started this team with a single idea: a seller should never be stuck in a listing that will not sell. That is where the guarantee came from, and it is still the first thing said on a listing appointment.</p>
    <p>Fifteen years later, the team has served more than a thousand families across Nassau and Suffolk, earned over five hundred five-star reviews, and become the number one home selling team on Long Island by sales volume. The structure has grown, but the standard has not moved: honest pricing, real marketing money behind every listing, and somebody who answers the phone.</p>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'The team', title: 'Who does what', align: 'center' })}
    <div class="grid grid-4">${team.map(c.agentCard).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Coverage', title: 'Where we work' })}
      <p>All of Nassau and Suffolk County, plus the Queens border communities. Headquarters is in Hicksville, two minutes from the LIRR station.</p>
      <div class="chip-grid">
        ${neighborhoods.map((n) => `<a class="chip" href="/neighborhoods/${esc(n.slug)}">${esc(n.name)}</a>`).join('')}
      </div>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'team-contact',
        title: 'Talk to the team',
        fields: ['name', 'email', 'phone', 'message'],
        submitLabel: 'Send Message',
      })}
    </div>
  </div>
</section>

${c.ctaBand({
  title: 'Thinking about joining us?',
  text: 'We are hiring agents across Long Island. Leads, systems, and admin support included.',
  actions: [{ label: 'See Open Roles', href: '/join-us' }],
})}
`;

  return page({
    title: 'Meet the Team',
    description: `Meet ${brand.legalName} — the #1 home selling team on Long Island, with more than 1,000 families served across Nassau and Suffolk County.`,
    path: '/team',
    body,
  });
}

function agentPage(member) {
  const body = `
${c.breadcrumb([{ label: 'Home', href: '/' }, { label: 'Team', href: '/team' }, { label: member.name }])}
<section class="section">
  <div class="wrap agent-detail">
    <div class="agent-detail-media">
      ${member.photo ? `<img src="${esc(member.photo)}" alt="${esc(member.name)}">` : `<span class="agent-initials agent-initials-lg" aria-hidden="true">${esc(c.initials(member.name))}</span>`}
      <div class="agent-detail-contact">
        <a class="btn btn-primary btn-block" href="tel:+1${esc(member.phone.replace(/\D/g, ''))}" data-call>${esc(member.phone)}</a>
        <a class="btn btn-ghost btn-block" href="mailto:${esc(member.email)}">${esc(member.email)}</a>
      </div>
    </div>
    <div class="agent-detail-body">
      <p class="eyebrow">${esc(member.role)}</p>
      <h1>${esc(member.name)}</h1>
      ${member.license ? `<p class="fine">${esc(member.license)} &middot; ${esc(brand.brokerage)}</p>` : `<p class="fine">${esc(brand.brokerage)}</p>`}
      ${member.bio.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${member.specialties && member.specialties.length ? `<h2 class="h-sm">Specialties</h2><div class="chip-grid">${member.specialties.map((s) => `<span class="chip chip-static">${esc(s)}</span>`).join('')}</div>` : ''}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap narrow">
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'agent-contact',
        title: `Contact ${esc(member.name)}`,
        fields: ['name', 'email', 'phone', 'message'],
        submitLabel: 'Send Message',
        hidden: { tags: `agent:${member.slug}` },
      })}
    </div>
  </div>
</section>
`;

  return page({
    title: `${member.name} — ${member.role}`,
    description: member.short,
    path: `/agent/${member.slug}`,
    body,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'RealEstateAgent',
      name: member.name,
      jobTitle: member.role,
      telephone: member.phone,
      email: member.email,
      worksFor: { '@type': 'Organization', name: brand.legalName },
      url: `${brand.baseUrl}/agent/${member.slug}`,
    }],
  });
}

function testimonialsPage() {
  const body = `
${c.pageHeader({
  eyebrow: 'Reviews',
  title: 'What our clients say',
  text: 'More than 500 five-star reviews across Google, Zillow, and Yelp. A selection is below.',
})}

${c.statBar()}

<section class="section">
  <div class="wrap">
    <div class="grid grid-3">${testimonials.map(c.testimonialCard).join('')}</div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap narrow">
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'review-cta',
        title: 'Want the same experience?',
        text: 'Tell us whether you are buying, selling, or both, and we will take it from there.',
        fields: ['name', 'email', 'phone', { name: 'intentChoice', label: 'I am', type: 'select', options: ['Selling', 'Buying', 'Both', 'Investing'] }, 'message'],
        submitLabel: 'Get Started',
      })}
    </div>
  </div>
</section>
`;

  return page({
    title: 'Client Reviews',
    description: `Read reviews for ${brand.legalName} from Long Island home buyers and sellers across Nassau and Suffolk County.`,
    path: '/testimonials',
    body,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: `${brand.legalName} real estate services`,
      review: testimonials.map((t) => ({
        '@type': 'Review',
        reviewRating: { '@type': 'Rating', ratingValue: 5, bestRating: 5 },
        author: { '@type': 'Person', name: t.name },
        reviewBody: t.quote,
      })),
    }],
  });
}

function contactPage() {
  const body = `
${c.pageHeader({
  eyebrow: 'Contact',
  title: 'Talk to the team',
  text: 'Call, email, or send a note. Someone will get back to you the same business day.',
})}

<section class="section">
  <div class="wrap two-col">
    <div>
      <div class="contact-block">
        <h2 class="h-sm">Office</h2>
        <p>${esc(brand.addressLine)}</p>
        <p><a href="https://www.google.com/maps/search/${encodeURIComponent(brand.addressLine)}" target="_blank" rel="noopener">Get directions</a></p>
      </div>
      <div class="contact-block">
        <h2 class="h-sm">Phone</h2>
        <p><a href="${esc(brand.phoneHref)}" data-call>${esc(brand.phone)}</a></p>
        <p><a href="tel:+1${esc(brand.phoneAlt.replace(/\D/g, ''))}" data-call>${esc(brand.phoneAlt)}</a></p>
      </div>
      <div class="contact-block">
        <h2 class="h-sm">Email</h2>
        <p><a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a></p>
      </div>
      <div class="contact-block">
        <h2 class="h-sm">Hours</h2>
        <p>Monday to Friday, 9:00am to 7:00pm</p>
        <p>Saturday and Sunday, 10:00am to 5:00pm</p>
      </div>
      <div class="contact-block">
        <h2 class="h-sm">Follow</h2>
        <p class="socials socials-dark">
          ${[['Facebook', brand.social.facebook], ['Instagram', brand.social.instagram], ['LinkedIn', brand.social.linkedin], ['X', brand.social.x]]
            .filter(([, href]) => href)
            .map(([label, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`)
            .join('')}
        </p>
      </div>
    </div>
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'contact',
        title: 'Send us a message',
        fields: [
          'name',
          'email',
          'phone',
          { name: 'intentChoice', label: 'I am', type: 'select', options: ['Selling a home', 'Buying a home', 'Both', 'Investing', 'Joining the team', 'Something else'] },
          'message',
        ],
        submitLabel: 'Send Message',
      })}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap narrow">
    ${c.sectionHead({ eyebrow: 'FAQ', title: 'Questions we get a lot', align: 'center' })}
    ${c.faqList(faq)}
  </div>
</section>
`;

  return page({
    title: 'Contact Us',
    description: `Contact ${brand.legalName} in ${brand.address.city}, NY. Call ${brand.phone} or send a message and we will respond the same business day.`,
    path: '/contact-us',
    body,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    }],
  });
}

function joinUsPage() {
  const body = `
${c.pageHeader({
  eyebrow: 'Careers',
  title: 'Join the #1 team on Long Island',
  text: 'Leads, systems, marketing, and admin support. You sell; we handle the rest.',
})}

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'What we provide', title: 'The reason agents move here' })}
      <ul class="check-list">
        <li>Inbound leads from the team database and paid campaigns — not a list you buy yourself.</li>
        <li>A listing department that handles photography, marketing, and syndication.</li>
        <li>A transaction manager from accepted offer to closing.</li>
        <li>Live coaching and role-play, weekly, with people who are actually selling.</li>
        <li>Scripts, systems, and a CRM that tells you who to call today.</li>
        <li>An office in Hicksville and a team that shows up in it.</li>
      </ul>
      ${c.sectionHead({ eyebrow: 'Who we hire', title: 'What we look for' })}
      <ul class="check-list">
        <li>Licensed in New York, or in class and about to be.</li>
        <li>Willing to make calls and hold open houses, every week.</li>
        <li>Coachable — the systems here work, and they only work if you run them.</li>
        <li>Honest with clients about price, even when it is uncomfortable.</li>
      </ul>
    </div>
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'join-us',
        intent: 'recruit',
        title: 'Apply to join the team',
        text: 'Every application is read by team leadership. Conversations are confidential.',
        fields: [
          'name',
          'email',
          'phone',
          { name: 'licenseStatus', label: 'License status', type: 'select', options: ['Licensed in NY', 'In class / testing soon', 'Not licensed yet'] },
          { name: 'experience', label: 'Years in real estate', type: 'select', options: ['New to the business', 'Under 2 years', '2-5 years', '5+ years'] },
          { name: 'production', label: 'Transactions in the last 12 months', type: 'select', options: ['0', '1-5', '6-12', '13-24', '25+'] },
          { name: 'message', label: 'What are you looking for in your next brokerage?', type: 'textarea', rows: 4 },
        ],
        submitLabel: 'Submit My Application',
      })}
    </div>
  </div>
</section>

${c.ctaBand({
  title: 'Prefer to talk first?',
  text: `Call ${brand.phone} and ask for team recruiting. No pressure, no pitch deck.`,
  actions: [{ label: `Call ${brand.phone}`, href: brand.phoneHref }],
})}
`;

  return page({
    title: 'Join Our Team — Real Estate Careers on Long Island',
    description: `Join ${brand.legalName}, the #1 home selling team on Long Island. Inbound leads, marketing, and transaction support for licensed New York agents.`,
    path: '/join-us',
    body,
  });
}

function neighborhoodsPage() {
  const body = `
${c.pageHeader({
  eyebrow: 'Communities',
  title: 'Long Island neighborhoods',
  text: 'Where we work, what each market is actually like, and live inventory for every town.',
})}

<section class="section">
  <div class="wrap">
    <div class="grid grid-3 hood-grid">${neighborhoods.map(c.neighborhoodCard).join('')}</div>
  </div>
</section>

${c.ctaBand({
  title: 'Not sure which town fits?',
  text: 'Tell us your budget, commute, and school priorities and we will narrow it down with you.',
  actions: [{ label: 'Talk to the Team', href: '/contact-us' }],
})}
`;

  return page({
    title: 'Long Island Neighborhoods',
    description: 'Explore Long Island neighborhoods with Team Raj Jaggi: Hicksville, Levittown, Syosset, Plainview, Massapequa, Garden City, Jericho, and more.',
    path: '/neighborhoods',
    body,
  });
}

function neighborhoodPage(hood) {
  const body = `
${c.breadcrumb([{ label: 'Home', href: '/' }, { label: 'Neighborhoods', href: '/neighborhoods' }, { label: hood.name }])}
${c.pageHeader({
  eyebrow: hood.county,
  title: `${esc(hood.name)} real estate`,
  text: hood.blurb,
})}

<section class="section">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'The market', title: `What buyers and sellers should know about ${esc(hood.name)}` })}
      <ul class="check-list">${hood.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
      <p class="lede">${esc(hood.priceNote)}</p>
      <div class="inline-actions">
        <a class="btn btn-primary" href="${esc(c.searchHref({ city: hood.city, state: hood.state }))}"${c.idxTarget}>View Homes in ${esc(hood.name)}</a>
        <a class="btn btn-ghost" href="/home-valuation">What Is My ${esc(hood.name)} Home Worth?</a>
      </div>
    </div>
    <div class="form-panel">
      ${c.leadForm({
        name: 'neighborhood-inquiry',
        title: `Ask about ${esc(hood.name)}`,
        text: 'Market reports, new listings, and honest pricing advice for this town.',
        fields: ['name', 'email', 'phone', 'priceRange', 'message'],
        submitLabel: 'Send My Request',
        hidden: { neighborhood: hood.name, tags: `hood:${hood.slug}` },
      })}
    </div>
  </div>
</section>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Nearby', title: 'Other communities we cover' })}
    <div class="chip-grid">
      ${neighborhoods.filter((n) => n.slug !== hood.slug).map((n) => `<a class="chip" href="/neighborhoods/${esc(n.slug)}">${esc(n.name)}</a>`).join('')}
    </div>
  </div>
</section>
`;

  return page({
    title: `${hood.name}, NY Real Estate`,
    description: `${hood.name} real estate with ${brand.legalName}: ${hood.blurb}`,
    path: `/neighborhoods/${hood.slug}`,
    body,
  });
}

module.exports = { teamPage, agentPage, testimonialsPage, contactPage, joinUsPage, neighborhoodsPage, neighborhoodPage };
