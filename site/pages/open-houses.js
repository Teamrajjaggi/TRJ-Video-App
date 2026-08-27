'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const schedule = require('../lib/open-houses');

/** Public open-house schedule with a registration form per house. */
function openHousesPage() {
  const data = schedule.read();
  const saturday = data.houses.filter((h) => h.saturday);
  const sunday = data.houses.filter((h) => h.sunday);

  const row = (house) => `<tr>
    <th scope="row">
      <span class="oh-address">${esc(house.address)}</span>
      <span class="oh-town">${esc(house.town)}</span>
    </th>
    <td data-label="Saturday">${house.saturday ? esc(house.saturday) : '<span class="oh-off">—</span>'}</td>
    <td data-label="Sunday">${house.sunday ? esc(house.sunday) : '<span class="oh-off">—</span>'}</td>
    <td class="oh-action">
      <a class="btn btn-ghost btn-sm" href="#register" data-register="${esc(house.address + ', ' + house.town)}">Register</a>
    </td>
  </tr>`;

  const body = `
${c.pageHeader({
  eyebrow: data.weekendLabel,
  title: esc(data.heading),
  text: data.intro,
})}

${data.houses.length ? `<section class="section">
  <div class="wrap">
    <div class="oh-summary" data-reveal>
      <span>${data.houses.length} open ${data.houses.length === 1 ? 'house' : 'houses'}</span>
      <span>${saturday.length} Saturday</span>
      <span>${sunday.length} Sunday</span>
    </div>
    <div class="oh-table-wrap">
      <table class="oh-table">
        <caption class="sr-only">${esc(data.weekendLabel)}</caption>
        <thead>
          <tr><th scope="col">Address</th><th scope="col">Saturday</th><th scope="col">Sunday</th><th scope="col"><span class="sr-only">Register</span></th></tr>
        </thead>
        <tbody>${data.houses.map(row).join('')}</tbody>
      </table>
    </div>
    <p class="fine">Times can change if a house goes under contract. Call ${esc(brand.phone)} to confirm before you drive out.</p>
  </div>
</section>` : `<section class="section">
  <div class="wrap narrow">
    <div class="notice">
      <h3>No open houses scheduled right now</h3>
      <p>New listings go up every week. Tell us what you are looking for and we will send you the next round before it is published.</p>
    </div>
  </div>
</section>`}

<section class="section section-tint" id="register">
  <div class="wrap two-col">
    <div>
      ${c.sectionHead({ eyebrow: 'Register', title: 'Get instant access to the house' })}
      <p>Register and we will send you the full feature sheet, disclosures, and taxes for the house you pick — plus a heads up when we add a home in your area.</p>
      <ul class="check-list">
        <li>Full feature list, tax figures, and disclosures for that address.</li>
        <li>A team member on site to answer questions, not a sign-in sheet.</li>
        <li>First look at next weekend's listings before they are published.</li>
      </ul>
    </div>
    <div class="form-panel form-panel-raised">
      ${c.leadForm({
        name: 'open-house',
        intent: 'buyer',
        title: 'Register for an open house',
        text: 'Pick the address you want to see — or leave it blank and we will send the full list.',
        fields: [
          { name: 'propertyAddress', label: 'Which open house?', wide: true, placeholder: 'e.g. 20 Cornwall Ln, Hicksville' },
          'name',
          'email',
          'phone',
          'preapproved',
        ],
        submitLabel: 'Send Me The Details',
        hidden: { tags: 'open-house' },
      })}
    </div>
  </div>
</section>

${c.ctaBand({
  title: 'Thinking of selling instead?',
  text: 'These open houses draw the buyers who end up bidding on the next listing we take.',
  actions: [{ label: 'Get My Home Value', href: '/home-valuation' }],
})}
`;

  return page({
    title: 'Open Houses This Weekend',
    description: `${data.weekendLabel} — open houses across Nassau and Suffolk with ${brand.legalName}. Register for instant access to the details of any house on the list.`,
    path: '/open-houses',
    body,
    schema: data.houses.slice(0, 20).map((house) => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: `Open house: ${house.address}, ${house.town}`,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: `${house.address}, ${house.town}, NY`,
        address: { '@type': 'PostalAddress', streetAddress: house.address, addressLocality: house.town, addressRegion: 'NY' },
      },
      organizer: { '@type': 'Organization', name: brand.legalName, url: brand.baseUrl },
    })),
  });
}

/**
 * Token-protected editor. Deliberately plain: the team updates the weekend
 * label and the rows, saves, and the public page changes immediately.
 */
function openHousesAdmin({ token = '', saved = false, error = '' } = {}) {
  const data = schedule.read();
  const rows = data.houses.concat([{}, {}, {}]); // three blank rows to add to

  const rowFields = (house, i) => `<tr>
    <td><input name="address_${i}" value="${esc(house.address || '')}" placeholder="20 Cornwall Ln"></td>
    <td><input name="town_${i}" value="${esc(house.town || '')}" placeholder="Hicksville"></td>
    <td><input name="saturday_${i}" value="${esc(house.saturday || '')}" placeholder="12:00PM-1:30PM"></td>
    <td><input name="sunday_${i}" value="${esc(house.sunday || '')}" placeholder="2:00PM-3:30PM"></td>
  </tr>`;

  const body = `
${c.pageHeader({ eyebrow: 'Admin', title: 'Update open houses', text: 'Edit the list and save. The public page updates immediately. Clear an address to remove that row.' })}

<section class="section">
  <div class="wrap">
    ${saved ? '<p class="admin-flash is-ok">Saved. The open house page is live with these times.</p>' : ''}
    ${error ? `<p class="admin-flash is-error">${esc(error)}</p>` : ''}
    <form method="post" action="/admin/open-houses" class="admin-form">
      <input type="hidden" name="token" value="${esc(token)}">
      <div class="form-grid">
        <div class="field field-wide">
          <label for="weekendLabel">Weekend label</label>
          <input id="weekendLabel" name="weekendLabel" value="${esc(data.weekendLabel)}" placeholder="Open houses — August 22 &amp; 23, 2026">
        </div>
        <div class="field field-wide">
          <label for="heading">Heading</label>
          <input id="heading" name="heading" value="${esc(data.heading)}">
        </div>
        <div class="field field-wide">
          <label for="intro">Intro paragraph</label>
          <textarea id="intro" name="intro" rows="3">${esc(data.intro)}</textarea>
        </div>
      </div>

      <div class="oh-table-wrap">
        <table class="oh-table oh-table-edit">
          <thead><tr><th>Address</th><th>Town</th><th>Saturday</th><th>Sunday</th></tr></thead>
          <tbody>${rows.map(rowFields).join('')}</tbody>
        </table>
      </div>

      <button class="btn btn-primary" type="submit">Save open houses</button>
      <p class="fine">Times are free text, so "12:00PM-1:30PM" or "Noon to 1:30" both work. Leave a day blank when the house is not open that day.</p>
    </form>
  </div>
</section>
`;

  return page({ title: 'Update Open Houses', description: 'Team admin.', path: '/admin/open-houses', body });
}

module.exports = { openHousesPage, openHousesAdmin };
