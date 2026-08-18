'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');

function thankYou(query = {}) {
  const intent = String(query.intent || '');
  const nextSteps = intent === 'seller'
    ? 'We are pulling the closed comparables for your street now. Expect a call or email within one business day.'
    : intent === 'recruit'
      ? 'Your application is with team leadership. Someone will reach out to set up a confidential conversation.'
      : 'Someone from the team will reach out shortly — usually the same business day.';

  const body = `
<section class="section section-center">
  <div class="wrap narrow">
    <p class="eyebrow">Received</p>
    <h1>Thank you — we have your request.</h1>
    <p class="lede">${esc(nextSteps)}</p>
    <p>If it is urgent, call us directly at <a href="${esc(brand.phoneHref)}" data-call>${esc(brand.phone)}</a>.</p>
    <div class="inline-actions center-actions">
      <a class="btn btn-primary" href="/home-search"${c.idxTarget}>Browse Homes</a>
      <a class="btn btn-ghost" href="/blog">Read the Blog</a>
    </div>
  </div>
</section>
`;
  return page({ title: 'Thank You', description: 'Thank you for contacting Team Raj Jaggi.', path: '/thank-you', body });
}

function legal(kind) {
  const pages = {
    privacy: {
      title: 'Privacy Policy',
      intro: `This policy explains what ${brand.legalName} collects through ${brand.domain}, how it is used, and the choices you have.`,
      sections: [
        ['What we collect', 'Information you submit through a form on this site — name, email address, phone number, property address, and anything you write in a message field. We also collect standard technical data such as IP address, browser type, pages viewed, and the campaign or referring site that brought you here.'],
        ['How we use it', 'To respond to your inquiry, provide home valuations and listing information you requested, and follow up about buying or selling. Submissions are stored in our real estate CRM, CINC (Commissions Inc.), which our licensed agents use to manage client communication.'],
        ['Who we share it with', 'Our brokerage, our CRM and marketing service providers, and — only where you ask for it — a lender, attorney, or inspector referral. We do not sell your personal information.'],
        ['Communication consent', 'By submitting a form you agree to be contacted by phone, text, or email about your inquiry. Consent is not a condition of any purchase. Message and data rates may apply. Reply STOP to any text to opt out, or use the unsubscribe link in any email.'],
        ['Cookies and analytics', 'This site may use cookies and analytics tags to measure traffic and advertising performance. You can block cookies in your browser settings; some features may not work as intended if you do.'],
        ['Your choices', `Email ${brand.email} to request access to, correction of, or deletion of the information we hold about you.`],
        ['Changes', 'We may update this policy. The version posted on this page is the one in effect.'],
      ],
    },
    terms: {
      title: 'Terms of Use',
      intro: `By using ${brand.domain} you agree to these terms.`,
      sections: [
        ['Information is not advice', 'Content on this site is general information about real estate on Long Island. It is not legal, tax, financial, or appraisal advice. Consult your attorney, accountant, or lender for advice about your situation.'],
        ['Listing data', 'Listing information displayed on or linked from this site comes from third-party sources including the MLS. It is deemed reliable but is not guaranteed accurate. Listings may be sold, withdrawn, or changed without notice.'],
        ['Guarantee terms', 'Any reference to a guaranteed sale program is subject to a separate written agreement between the seller and the team. The list price, guaranteed price, and timeline must be agreed in writing before listing. Not every home qualifies.'],
        ['No agency relationship', 'Submitting a form does not create an agency relationship. An agency relationship is created only by a signed written agreement.'],
        ['Third-party links', 'This site links to third-party services, including our MLS search platform. We are not responsible for the content or privacy practices of those services.'],
        ['Intellectual property', `Site design, text, and graphics are the property of ${brand.legalName} unless otherwise noted.`],
      ],
    },
    accessibility: {
      title: 'Accessibility Statement',
      intro: `${brand.legalName} is committed to making ${brand.domain} usable by everyone, including people using assistive technology.`,
      sections: [
        ['Our standard', 'We work toward conformance with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. That includes keyboard navigation, visible focus states, sufficient color contrast, text alternatives for images, and labeled form fields.'],
        ['Third-party content', 'Some content — including our MLS search platform and embedded maps — is provided by third parties. We ask those vendors to meet the same standard but do not control their code.'],
        ['Tell us about a barrier', `If you have trouble using any part of this site, email ${brand.email} or call ${brand.phone} and we will help you directly and work to fix the issue.`],
        ['Fair housing', 'We comply with the Fair Housing Act and New York State fair housing law. We do not discriminate on the basis of race, color, religion, sex, disability, familial status, national origin, sexual orientation, gender identity, marital status, military status, source of income, or any other protected class.'],
      ],
    },
  };

  const data = pages[kind];
  const body = `
${c.pageHeader({ eyebrow: 'Legal', title: esc(data.title), text: data.intro })}
<section class="section">
  <div class="wrap narrow prose">
    ${data.sections.map(([h, p]) => `<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('')}
    <p class="fine">Last updated ${esc(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))}. Questions: <a href="mailto:${esc(brand.email)}">${esc(brand.email)}</a>.</p>
  </div>
</section>
`;
  return page({ title: data.title, description: data.intro, path: `/${kind}`, body });
}

function notFound() {
  const body = `
<section class="section section-center">
  <div class="wrap narrow">
    <p class="eyebrow">404</p>
    <h1>That page has been sold.</h1>
    <p class="lede">The link you followed does not exist anymore. Try one of these instead.</p>
    <div class="inline-actions center-actions">
      <a class="btn btn-primary" href="/">Home</a>
      <a class="btn btn-ghost" href="/home-search"${c.idxTarget}>Search Homes</a>
      <a class="btn btn-ghost" href="/home-valuation">Home Valuation</a>
      <a class="btn btn-ghost" href="/contact-us">Contact</a>
    </div>
  </div>
</section>
`;
  return page({ title: 'Page Not Found', description: 'The page you were looking for could not be found.', path: '/404', body });
}

module.exports = { thankYou, legal, notFound };
