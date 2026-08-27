'use strict';

// Long-form page content that is copy, not layout: guides, FAQ, process steps.

const sellerSteps = [
  { icon: 'chart', n: '01', title: 'Free home valuation', text: 'We walk the house, pull the closed comparables inside your school district, and give you a written price range with the reasoning behind it.' },
  { icon: 'clipboard', n: '02', title: 'Prep and pricing plan', text: 'A punch list of what to fix and what to leave alone, plus the list price and the guaranteed price, agreed in writing before anything goes live.' },
  { icon: 'users', n: '03', title: 'Pre-market exposure', text: 'Your home goes to our buyer database and coming-soon list before it reaches the open market.' },
  { icon: 'megaphone', n: '04', title: 'Full-market launch', text: 'Professional photography, video, floor plans, MLS syndication, and a paid search and social campaign aimed at your price band.' },
  { icon: 'scale', n: '05', title: 'Offers and negotiation', text: 'We present every offer with the terms broken out — not just price — and negotiate the full package.' },
  { icon: 'key', n: '06', title: 'Contract to closing', text: 'A dedicated transaction manager runs attorney review, inspection, appraisal, and the mortgage commitment on a written schedule.' },
];

const buyerSteps = [
  { icon: 'phone', n: '01', title: 'Strategy call', text: 'Districts, commute, taxes, and the honest version of what your budget buys in each town.' },
  { icon: 'dollar', n: '02', title: 'Financing squared away', text: 'A real pre-approval from a lender listing agents recognize — before you tour a single house.' },
  { icon: 'search', n: '03', title: 'Early access to inventory', text: 'You see our coming-soon listings and off-market opportunities before the open market does.' },
  { icon: 'clock', n: '04', title: 'Showings within 24 hours', text: 'New listings get seen fast, because on Long Island the good ones are gone by the weekend.' },
  { icon: 'tag', n: '05', title: 'Offer strategy', text: 'We build the offer around what the seller actually needs — timeline, occupancy, inspection posture — not price alone.' },
  { icon: 'key', n: '06', title: 'Inspection to keys', text: 'Inspection, appraisal, attorney review, and closing, managed on a written timeline.' },
];

const guaranteePoints = [
  { title: 'Agreed in writing, up front', text: 'The list price, the guaranteed price, and the timeline are all set and signed before your home goes on the market.' },
  { title: 'No moving the goalposts', text: 'The number we commit to is the number. If the home does not sell in the agreed window, the guarantee is exercised at that price.' },
  { title: 'Not every home qualifies', text: 'Condition, title, showing access, and a realistic price all have to line up. We will tell you on the first visit whether yours does.' },
  { title: 'Ask to read the terms', text: 'Bring your attorney. Any guarantee worth having is one you can read before you sign a listing agreement.' },
];

const faq = [
  {
    q: `What does "Your Home Sold Guaranteed or I'll Buy It" actually mean?`,
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
  { icon: 'shield', title: 'A guarantee in writing', text: 'Your home sold at the agreed price and timeline, or we buy it. Terms provided before you sign anything.' },
  { icon: 'users', title: 'A team, not a solo agent', text: 'Listing specialists, buyer specialists, a marketing department, and a transaction manager — so no part of your deal waits on one person’s calendar.' },
  { icon: 'camera', title: 'Marketing spend behind every listing', text: 'Professional photography, video, floor plans, and a paid campaign are included, not an upsell.' },
  { icon: 'megaphone', title: 'A buyer database that moves first', text: 'Our listings go to an active buyer list and a coming-soon audience before they hit the open market.' },
  { icon: 'scale', title: 'Straight pricing advice', text: 'We will tell you the number the market supports, even when it is not the number you hoped for.' },
  { icon: 'phone', title: 'Someone answers the phone', text: 'The most common line in our reviews, and the least glamorous thing on this list.' },
];

// The team's own listing-presentation numbers.
const sellingReasons = [
  {
    n: '1',
    icon: 'users',
    title: '65,000+ buyers in waiting',
    text: 'Our database holds more than 65,000 active buyers. Your home may already be sold to someone on that list before it reaches the open market.',
  },
  {
    n: '2',
    icon: 'house',
    title: '10x more homes sold',
    text: 'We sell over ten times more homes than the average agent. Because we sell more homes, we can put more behind selling yours.',
  },
  {
    n: '3',
    icon: 'dollar',
    title: '3.8% higher sales price',
    text: 'Our listings sell for 3.8% more than the average agent achieves — real dollars that stay in your pocket at closing.',
  },
  {
    n: '4',
    icon: 'clock',
    title: '38 days, not 91',
    text: 'Per the Long Island MLS, the average agent takes 91 days to sell a home. Our average is 38.',
  },
];

// The three seller programs, as presented on the listing appointment.
const sellerPrograms = [
  {
    icon: 'shield',
    title: 'Guaranteed Sold',
    text: 'Your home sold at the agreed price and timeline, or we buy it. Ask about the program — a service guarantee by Team Raj Jaggi, some terms and conditions apply.',
    href: '/guaranteed-sale',
    cta: 'How it works',
  },
  {
    icon: 'doc',
    title: 'One Day Listing',
    text: 'Cancel your listing agreement at any time, without penalty. You stay because the work is working, not because you signed something.',
    href: '/home-valuation',
    cta: 'Start here',
  },
  {
    icon: 'scale',
    title: 'Flexible Commissions',
    text: 'Several commission structures to choose from. Pick the one that fits your sale — we give you every opportunity to save money.',
    href: '/contact-us',
    cta: 'Talk options',
  },
];

// Outlets the team has appeared on, shown as a credibility strip.
const asSeenOn = [
  'Zillow 5-Star Premier Agent',
  'FOX',
  'CBS News',
  'NBC',
  'ABC',
  'Top Agent Magazine',
];

module.exports = { sellerSteps, buyerSteps, guaranteePoints, faq, whyPoints, sellingReasons, sellerPrograms, asSeenOn };
