'use strict';

// Long-form page content that is copy, not layout: guides, FAQ, process steps.

const sellerSteps = [
  { n: '01', title: 'Free home valuation', text: 'We walk the house, pull the closed comparables inside your school district, and give you a written price range with the reasoning behind it.' },
  { n: '02', title: 'Prep and pricing plan', text: 'A punch list of what to fix and what to leave alone, plus the list price and the guaranteed price, agreed in writing before anything goes live.' },
  { n: '03', title: 'Pre-market exposure', text: 'Your home goes to our buyer database and coming-soon list before it reaches the open market.' },
  { n: '04', title: 'Full-market launch', text: 'Professional photography, video, floor plans, MLS syndication, and a paid search and social campaign aimed at your price band.' },
  { n: '05', title: 'Offers and negotiation', text: 'We present every offer with the terms broken out — not just price — and negotiate the full package.' },
  { n: '06', title: 'Contract to closing', text: 'A dedicated transaction manager runs attorney review, inspection, appraisal, and the mortgage commitment on a written schedule.' },
];

const buyerSteps = [
  { n: '01', title: 'Strategy call', text: 'Districts, commute, taxes, and the honest version of what your budget buys in each town.' },
  { n: '02', title: 'Financing squared away', text: 'A real pre-approval from a lender listing agents recognize — before you tour a single house.' },
  { n: '03', title: 'Early access to inventory', text: 'You see our coming-soon listings and off-market opportunities before the open market does.' },
  { n: '04', title: 'Showings within 24 hours', text: 'New listings get seen fast, because on Long Island the good ones are gone by the weekend.' },
  { n: '05', title: 'Offer strategy', text: 'We build the offer around what the seller actually needs — timeline, occupancy, inspection posture — not price alone.' },
  { n: '06', title: 'Inspection to keys', text: 'Inspection, appraisal, attorney review, and closing, managed on a written timeline.' },
];

const guaranteePoints = [
  { title: 'Agreed in writing, up front', text: 'The list price, the guaranteed price, and the timeline are all set and signed before your home goes on the market.' },
  { title: 'No moving the goalposts', text: 'The number we commit to is the number. If the home does not sell in the agreed window, the guarantee is exercised at that price.' },
  { title: 'Not every home qualifies', text: 'Condition, title, showing access, and a realistic price all have to line up. We will tell you on the first visit whether yours does.' },
  { title: 'Ask to read the terms', text: 'Bring your attorney. Any guarantee worth having is one you can read before you sign a listing agreement.' },
];

const faq = [
  {
    q: 'What does "Your Home Sold Guaranteed or We Will Buy It" actually mean?',
    a: 'We agree on a list price, a guaranteed purchase price, and a timeline in writing before your home is listed. If it does not sell within that window, we buy it at the agreed price. Conditions apply and not every home qualifies — the full written terms are provided at the listing appointment.',
  },
  {
    q: 'What does it cost to get a home valuation?',
    a: 'Nothing, and there is no obligation to list with us. You get the comparables, the range, and the reasoning whether or not you decide to sell.',
  },
  {
    q: 'Which areas do you cover?',
    a: 'All of Nassau and Suffolk County, plus the Queens border communities. The team is headquartered in Hicksville.',
  },
  {
    q: 'How fast can you get my home on the market?',
    a: 'Photography and marketing can be scheduled within a few days of the listing agreement. The pace is usually set by the prep list, not by us.',
  },
  {
    q: 'Do you work with first-time buyers?',
    a: 'Yes, and it is a large part of the buy side of the business. The first step is a strategy call and a proper pre-approval before you tour anything.',
  },
  {
    q: 'Do you handle investment and multi-family property?',
    a: 'Yes. Two-family, mixed-use, and small multi-family are underwritten on rent roll and condition, and we run the numbers with you before writing an offer.',
  },
  {
    q: 'What if my home is already listed with another agent?',
    a: 'If you are under contract with another brokerage, we cannot solicit that listing. Call us when the listing expires and we will show you what we would do differently.',
  },
];

const whyPoints = [
  { title: 'A guarantee in writing', text: 'Your home sold at the agreed price and timeline, or we buy it. Terms provided before you sign anything.' },
  { title: 'A team, not a solo agent', text: 'Listing specialists, buyer specialists, a marketing department, and a transaction manager — so no part of your deal waits on one person’s calendar.' },
  { title: 'Marketing spend behind every listing', text: 'Professional photography, video, floor plans, and a paid campaign are included, not an upsell.' },
  { title: 'A buyer database that moves first', text: 'Our listings go to an active buyer list and a coming-soon audience before they hit the open market.' },
  { title: 'Straight pricing advice', text: 'We will tell you the number the market supports, even when it is not the number you hoped for.' },
  { title: 'Someone answers the phone', text: 'The most common line in our reviews, and the least glamorous thing on this list.' },
];

module.exports = { sellerSteps, buyerSteps, guaranteePoints, faq, whyPoints };
