'use strict';

// Team roster. `photo` is a path under site/public/images — drop the real
// headshots there and the cards pick them up; until then the initials tile
// renders in their place.
module.exports = [
  {
    slug: 'raj-jaggi',
    name: 'Raj Jaggi',
    role: 'Team Leader & Listing Specialist',
    license: 'Licensed Real Estate Salesperson, NY',
    phone: '(516) 996-3633',
    email: 'raj@teamrajjaggi.com',
    photo: '',
    lead: true,
    short: 'Award-winning Long Island realtor who has guided more than 1,000 families through the sale or purchase of a home.',
    bio: [
      'Raj Jaggi built Team Raj Jaggi on a single promise: a seller should never be trapped in a listing that will not sell. Fifteen years and a thousand-plus closings later, that promise is still the first thing he says on a listing appointment.',
      'Raj leads listing strategy for the team — pricing, pre-market preparation, marketing spend, and negotiation. He is known across Nassau and Suffolk for pulling multiple offers on homes that sat unsold with another agent, and for telling sellers the truth about their number before it costs them a season on the market.',
      'He works out of the team headquarters in Hicksville and personally reviews every listing the team takes.',
    ],
    specialties: ['Listing strategy', 'Guaranteed sale program', 'Negotiation', 'Nassau County'],
  },
  {
    slug: 'rahul-jaggi',
    name: 'Rahul Jaggi',
    role: 'Partner & Buyer Strategy',
    license: 'Licensed Real Estate Salesperson, NY',
    phone: '(516) 247-9533',
    email: 'rahul@teamrajjaggi.com',
    photo: '',
    short: 'Runs the buy side of the team — from the first showing through the closing table.',
    bio: [
      'Rahul Jaggi leads buyer representation for the team. He built the process that gets a Team Raj Jaggi buyer to the front of the line in a multiple-offer market: financing squared away first, showings within twenty-four hours of a new listing, and an offer written the same day.',
      'He works closely with the team lender partners so that a buyer walks into a showing already able to prove they can close.',
    ],
    specialties: ['First-time buyers', 'Multiple-offer strategy', 'Investment property', 'Suffolk County'],
  },
  {
    slug: 'listing-team',
    name: 'The Listing Department',
    role: 'Pricing, Prep & Marketing',
    license: '',
    phone: '(516) 996-3633',
    email: 'listings@teamrajjaggi.com',
    photo: '',
    short: 'Photography, staging guidance, syndication, and the paid campaign behind every listing.',
    bio: [
      'Every home the team lists goes through the same production line: pre-market walkthrough and repair punch list, professional photography and video, floor plans, and a paid social and search campaign aimed at the buyers most likely to move on that price point.',
      'The department also runs the coming-soon list, which puts a listing in front of the team buyer database before it reaches the open market.',
    ],
    specialties: ['Listing preparation', 'Photography & video', 'Coming-soon marketing'],
  },
  {
    slug: 'client-care',
    name: 'Client Care & Transaction Management',
    role: 'Contract to Closing',
    license: '',
    phone: '(516) 996-3633',
    email: 'info@teamrajjaggi.com',
    photo: '',
    short: 'Keeps every deal on schedule between accepted offer and keys in hand.',
    bio: [
      'Once an offer is accepted, a dedicated transaction manager takes over the calendar: attorney review, inspection, appraisal, mortgage commitment, and closing. Clients get a written timeline the week the contract is signed and a check-in every week after that.',
      'It is the least glamorous part of the business and the reason the team closes on time.',
    ],
    specialties: ['Attorney coordination', 'Inspection & appraisal', 'Closing timelines'],
  },
];
