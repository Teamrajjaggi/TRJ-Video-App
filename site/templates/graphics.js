'use strict';

// Original SVG artwork for the site: hero scene, property and neighborhood
// illustrations, blog covers, a Long Island map, the guarantee seal, and the
// icon set. Everything is inline SVG in the brand palette — no external
// requests, no stock photography, and it scales to any viewport without
// shipping a single raster file.
//
// Illustrations are deterministic: the same slug or MLS id always produces the
// same scene, so a listing card does not change art between page loads.

const NAVY = '#242a63';
const NAVY_DEEP = '#161a45';
const NAVY_MID = '#38407f';
const NAVY_SOFT = '#5b64a8';
const RED = '#d0202f';
const RED_SOFT = '#f2616c';
const CREAM = '#f5f2ec';
const SKY_TOP = '#2c3474';
const SKY_LOW = '#7f6f9e';

/** Stable small integer from a string, for picking scene variants. */
function hashOf(value) {
  let h = 0;
  const str = String(value || '');
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pick(list, seed) {
  return list[hashOf(seed) % list.length];
}

// --------------------------------------------------------------- icons ----

// 24x24 line icons on a common grid, stroked with currentColor so they take
// the colour of whatever they sit in.
const ICON_PATHS = {
  house: '<path d="M3 10.2 12 3l9 7.2"/><path d="M5.5 9.4V20h13V9.4"/><path d="M10 20v-5.4h4V20"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M17 12v3.5"/><path d="M20 12v2.5"/>',
  shield: '<path d="M12 3l7.5 3v5.6c0 4.3-3 8.1-7.5 9.4-4.5-1.3-7.5-5.1-7.5-9.4V6z"/><path d="m8.8 11.9 2.3 2.3 4.2-4.4"/>',
  handshake: '<path d="M3 12.5 7 8.6l3 1.3 3.6-1.5 4.4 3.4"/><path d="m10 15.3 2 1.9 2.2-2 2 1.7"/><path d="M3 8.6h2.4M18.6 8.6H21"/>',
  camera: '<path d="M3 8.5h3.6L8.2 6h7.6l1.6 2.5H21V19H3z"/><circle cx="12" cy="13" r="3.4"/>',
  megaphone: '<path d="M4 10.5v3l10 4.5V6z"/><path d="M14 8.5a3 3 0 0 1 0 7"/><path d="M6.5 14.5 8 21h3l-1-5.3"/>',
  clipboard: '<path d="M8 5H6v15h12V5h-2"/><rect x="9" y="3" width="6" height="3.4" rx="1"/><path d="M9.5 11h5M9.5 15h5"/>',
  calendar: '<rect x="3.5" y="5.5" width="17" height="15" rx="1.5"/><path d="M3.5 10h17M8 3.5v4M16 3.5v4"/>',
  dollar: '<path d="M12 3.5v17"/><path d="M15.8 7.6c-.6-1.3-2-2-3.8-2-2.2 0-3.7 1.1-3.7 2.9 0 4 7.6 2.2 7.6 6.3 0 1.9-1.7 3.1-4 3.1-2 0-3.5-.8-4.1-2.3"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="m7.5 15.5 3.5-4 3 2.4 4.5-6"/>',
  phone: '<path d="M7.6 3.8 9.9 8l-2 2.2a12 12 0 0 0 4.9 4.9l2.2-2 4.2 2.3-.8 3.5c-.2.8-1 1.3-1.8 1.2C10.3 19.3 4.7 13.7 3.9 7.3c-.1-.8.4-1.6 1.2-1.8z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="m3.6 6.6 8.4 6 8.4-6"/>',
  pin: '<path d="M12 21c4-4.6 6-8 6-10.6A6 6 0 0 0 6 10.4C6 13 8 16.4 12 21z"/><circle cx="12" cy="10.3" r="2.4"/>',
  star: '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
  check: '<path d="m4.5 12.6 4.8 4.7L19.5 6.9"/>',
  users: '<circle cx="9" cy="8.6" r="3.4"/><path d="M3.4 19.4c.6-3 2.9-4.8 5.6-4.8s5 1.8 5.6 4.8"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6.2"/><path d="M17.2 14.9c2 .5 3.4 2.2 3.8 4.5"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7v5.3l3.4 2"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.4"/><path d="m15.6 15.6 4.6 4.6"/>',
  tag: '<path d="M4 11.4V4.6h6.8l8.6 8.6-6.8 6.8z"/><circle cx="8.2" cy="8.2" r="1.5"/>',
  scale: '<path d="M12 4.5v15"/><path d="M6 7.5h12"/><path d="M4 15.5 6.9 8l2.9 7.5a3 3 0 0 1-5.8 0Z"/><path d="M14.2 15.5 17.1 8l2.9 7.5a3 3 0 0 1-5.8 0Z"/>',
  train: '<rect x="5.5" y="3.5" width="13" height="12" rx="2.5"/><path d="M5.5 9.5h13"/><path d="m7.5 19.5-1.6 2M16.5 19.5l1.6 2"/><circle cx="9" cy="12.6" r="1"/><circle cx="15" cy="12.6" r="1"/><path d="M7.5 15.5h9"/>',
  tree: '<path d="M12 3.5 6.8 11h3L6 17h12l-3.8-6h3z"/><path d="M12 17v3.5"/>',
  wave: '<path d="M3 9.2c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 15.2c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  award: '<circle cx="12" cy="9.6" r="5.6"/><path d="m8.6 14.4-1.4 6 4.8-2.5 4.8 2.5-1.4-6"/>',
  doc: '<path d="M13.6 3.5H7.5v17h9V6.9z"/><path d="M13.4 3.6v3.4h3.2"/><path d="M10 12h4M10 15.5h4"/>',
};

/**
 * Inline icon.
 * @param {string} name key of ICON_PATHS
 * @param {object} opts { size, stroke, className }
 */
function icon(name, opts = {}) {
  const paths = ICON_PATHS[name];
  if (!paths) return '';
  const size = opts.size || 24;
  const stroke = opts.stroke || 1.6;
  const cls = opts.className ? ` class="${opts.className}"` : '';
  return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// ----------------------------------------------------------- textures ----

/** Fine grain overlay, as a CSS-ready data URI. */
const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")";

// ------------------------------------------------------------- scenes ----

/**
 * Hero illustration: a Long Island street at dusk — rooflines stepping back in
 * three depth layers, street trees, the LIRR embankment, and a lit window grid.
 * Drawn wide (1200x760) and cropped by its container.
 */
function heroScene() {
  return `<svg class="scene scene-hero" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY_DEEP}"/>
      <stop offset="58%" stop-color="${SKY_TOP}"/>
      <stop offset="100%" stop-color="${SKY_LOW}"/>
    </linearGradient>
    <radialGradient id="hero-sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${RED_SOFT}" stop-opacity=".95"/>
      <stop offset="60%" stop-color="${RED}" stop-opacity=".35"/>
      <stop offset="100%" stop-color="${RED}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hero-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY_MID}"/>
      <stop offset="100%" stop-color="${NAVY}"/>
    </linearGradient>
    <linearGradient id="hero-near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="760" fill="url(#hero-sky)"/>
  <circle cx="905" cy="330" r="230" fill="url(#hero-sun)"/>
  <circle cx="905" cy="330" r="62" fill="${RED_SOFT}" opacity=".85"/>

  <!-- distant treeline -->
  <g fill="${NAVY_MID}" opacity=".55">
    ${treeRow(0, 470, 1200, 46, 'far')}
  </g>

  <!-- rail embankment with a train silhouette -->
  <g opacity=".8">
    <rect x="0" y="492" width="1200" height="10" fill="${NAVY_MID}"/>
    <g fill="${NAVY_DEEP}">
      <rect x="120" y="452" width="230" height="42" rx="8"/>
      <rect x="356" y="452" width="150" height="42" rx="8"/>
    </g>
    <g fill="${RED_SOFT}" opacity=".9">
      ${Array.from({ length: 7 }, (_, i) => `<rect x="${140 + i * 30}" y="464" width="14" height="12" rx="2"/>`).join('')}
      ${Array.from({ length: 4 }, (_, i) => `<rect x="${372 + i * 30}" y="464" width="14" height="12" rx="2"/>`).join('')}
    </g>
  </g>

  <!-- middle row of houses -->
  <g fill="url(#hero-far)">
    ${houseRow(-40, 502, [96, 128, 110, 140, 104, 132, 118, 146, 108, 126], 0.78)}
  </g>

  <!-- foreground row, larger and darker -->
  <g fill="url(#hero-near)">
    ${houseRow(-80, 604, [176, 208, 190, 226, 184, 214, 198], 1)}
  </g>

  <!-- lit windows -->
  <g fill="${RED_SOFT}" opacity=".72">
    ${windowGrid(-80, 604, [176, 208, 190, 226, 184, 214, 198])}
  </g>

  <!-- street trees in front -->
  <g fill="${NAVY_DEEP}">
    ${treeRow(-30, 700, 1260, 74, 'near')}
  </g>

  <rect y="720" width="1200" height="40" fill="${NAVY_DEEP}"/>
</svg>`;
}

/** A row of gabled houses, returned as path data. */
function houseRow(startX, baseline, widths, scale) {
  let x = startX;
  return widths
    .map((w, i) => {
      const h = Math.round((72 + ((i * 37) % 46)) * scale);
      const roof = Math.round(34 * scale);
      const body = `M${x} ${baseline} v-${h} h${w} v${h} z`;
      const gable = `M${x - 10} ${baseline - h} L${x + w / 2} ${baseline - h - roof} L${x + w + 10} ${baseline - h} z`;
      const chimney =
        i % 3 === 0
          ? `M${x + w * 0.68} ${baseline - h - roof * 0.45} h${14 * scale} v${26 * scale} h-${14 * scale} z`
          : '';
      x += w + Math.round(26 * scale);
      return `<path d="${body}"/><path d="${gable}"/>${chimney ? `<path d="${chimney}"/>` : ''}`;
    })
    .join('');
}

/** Warm window rectangles matching the foreground house row. */
function windowGrid(startX, baseline, widths) {
  let x = startX;
  const out = [];
  widths.forEach((w, i) => {
    const h = 72 + ((i * 37) % 46);
    const cols = Math.max(2, Math.floor(w / 62));
    for (let c = 0; c < cols; c += 1) {
      // Leave roughly a third of the windows dark so the row reads as evening.
      if ((i + c) % 3 === 0) continue;
      const wx = x + 20 + c * ((w - 30) / cols);
      out.push(`<rect x="${Math.round(wx)}" y="${baseline - h + 26}" width="22" height="26" rx="3"/>`);
    }
    x += w + 26;
  });
  return out.join('');
}

/** A row of simple conifer/deciduous silhouettes. */
function treeRow(startX, baseline, width, size, variant) {
  const step = variant === 'near' ? size * 2.4 : size * 1.6;
  const out = [];
  for (let x = startX, i = 0; x < startX + width; x += step, i += 1) {
    const s = size * (0.7 + ((i * 13) % 7) / 10);
    if (i % 3 === 0) {
      out.push(
        `<path d="M${x} ${baseline} l${s * 0.5} -${s * 1.5} l${s * 0.5} ${s * 1.5} z"/>` +
          `<rect x="${x + s * 0.42}" y="${baseline - 4}" width="${s * 0.16}" height="${s * 0.28}"/>`
      );
    } else {
      out.push(
        `<ellipse cx="${x + s * 0.5}" cy="${baseline - s * 0.85}" rx="${s * 0.58}" ry="${s * 0.72}"/>` +
          `<rect x="${x + s * 0.42}" y="${baseline - s * 0.3}" width="${s * 0.16}" height="${s * 0.34}"/>`
      );
    }
  }
  return out.join('');
}

// ------------------------------------------------- property card scenes ---

const HOUSE_PALETTES = [
  { sky: ['#3d4795', '#8f86b4'], body: '#f0ece4', roof: NAVY, trim: RED, ground: '#2c3474' },
  { sky: ['#2b3370', '#6f6a9d'], body: '#e7e2d8', roof: NAVY_DEEP, trim: RED, ground: '#232a5e' },
  { sky: ['#4a5aa8', '#a99fc4'], body: '#fbf8f2', roof: '#3a3f78', trim: RED, ground: '#343c7f' },
  { sky: ['#232a5e', '#5d5892'], body: '#eae5db', roof: '#1c2050', trim: RED_SOFT, ground: '#1b2050' },
];

/**
 * Illustration for a property card. Roofline, garage, dormers, and palette are
 * chosen from the seed, so every listing looks distinct but on-brand.
 */
function houseScene(seed, kind = '') {
  const h = hashOf(seed);
  const p = HOUSE_PALETTES[h % HOUSE_PALETTES.length];
  const id = 'hs' + (h % 100000);
  const twoStory = h % 3 !== 0;
  const garage = h % 2 === 0;
  const dormers = h % 4 === 0;
  const waterfront = /water|canal/i.test(kind);

  const bodyTop = twoStory ? 150 : 186;
  const roofPeak = bodyTop - 62;

  return `<svg class="scene scene-house" viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.sky[0]}"/><stop offset="100%" stop-color="${p.sky[1]}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="320" fill="url(#${id}-sky)"/>
  <circle cx="392" cy="74" r="34" fill="${RED_SOFT}" opacity=".5"/>

  <!-- back treeline -->
  <g fill="${p.ground}" opacity=".55">${treeRow(0, 228, 480, 44, 'far')}</g>

  ${waterfront
    ? `<rect y="242" width="480" height="78" fill="#2f3f8c"/>
       <g stroke="#8fa0dd" stroke-width="2.4" fill="none" opacity=".55">
         <path d="M20 262c18-9 36-9 54 0s36 9 54 0 36-9 54 0"/>
         <path d="M180 284c18-9 36-9 54 0s36 9 54 0 36-9 54 0"/>
         <path d="M40 302c18-9 36-9 54 0s36 9 54 0"/>
       </g>
       <g fill="${NAVY_DEEP}"><rect x="330" y="238" width="120" height="8"/><rect x="342" y="246" width="7" height="26"/><rect x="422" y="246" width="7" height="26"/></g>`
    : `<rect y="242" width="480" height="78" fill="${p.ground}"/>
       <path d="M0 268h480" stroke="${CREAM}" stroke-width="3" stroke-dasharray="26 22" opacity=".35"/>`}

  <!-- main structure -->
  <g>
    <rect x="118" y="${bodyTop}" width="200" height="${242 - bodyTop}" fill="${p.body}"/>
    <path d="M104 ${bodyTop} L218 ${roofPeak} L332 ${bodyTop} z" fill="${p.roof}"/>
    ${dormers
      ? `<path d="M170 ${bodyTop - 4} l20 -26 l20 26 z" fill="${p.roof}"/><rect x="180" y="${bodyTop - 6}" width="20" height="8" fill="${p.body}"/>
         <path d="M240 ${bodyTop - 4} l20 -26 l20 26 z" fill="${p.roof}"/><rect x="250" y="${bodyTop - 6}" width="20" height="8" fill="${p.body}"/>`
      : ''}
    <rect x="272" y="${roofPeak + 6}" width="18" height="34" fill="${p.roof}"/>

    <!-- door and windows -->
    <rect x="200" y="192" width="36" height="50" fill="${p.trim}"/>
    <circle cx="229" cy="217" r="2.6" fill="${CREAM}"/>
    <g fill="${NAVY_DEEP}" opacity=".85">
      <rect x="140" y="${bodyTop + 22}" width="38" height="34" rx="2"/>
      <rect x="258" y="${bodyTop + 22}" width="38" height="34" rx="2"/>
      ${twoStory ? `<rect x="140" y="196" width="38" height="34" rx="2"/><rect x="258" y="196" width="38" height="34" rx="2"/>` : ''}
    </g>
    <g stroke="${p.body}" stroke-width="2" opacity=".8">
      <path d="M159 ${bodyTop + 22}v34M140 ${bodyTop + 39}h38"/>
      <path d="M277 ${bodyTop + 22}v34M258 ${bodyTop + 39}h38"/>
    </g>

    ${garage
      ? `<rect x="326" y="186" width="86" height="56" fill="${p.body}"/>
         <path d="M316 186 L369 152 L422 186 z" fill="${p.roof}"/>
         <rect x="338" y="200" width="62" height="42" fill="${NAVY_DEEP}" opacity=".8"/>
         <g stroke="${p.body}" stroke-width="2" opacity=".6"><path d="M338 214h62M338 228h62"/></g>`
      : ''}

    <!-- walkway and shrubs -->
    <path d="M206 242 l-14 40 h52 l-14 -40 z" fill="${CREAM}" opacity=".55"/>
    <g fill="${p.ground}" opacity=".9">
      <ellipse cx="130" cy="240" rx="18" ry="13"/>
      <ellipse cx="308" cy="240" rx="16" ry="12"/>
    </g>
  </g>

  <!-- foreground tree -->
  <g fill="${NAVY_DEEP}">
    <rect x="49" y="196" width="10" height="52"/>
    <circle cx="54" cy="182" r="34"/><circle cx="30" cy="196" r="22"/><circle cx="78" cy="196" r="22"/>
  </g>
</svg>`;
}

// ------------------------------------------------- neighborhood scenes ----

/**
 * Town illustration. `scene` comes from data/neighborhoods.js; unknown values
 * fall back to a village street.
 */
function hoodScene(slug, scene) {
  const kind = scene || pick(['village', 'rail', 'water', 'park', 'estate'], slug);
  const id = 'nb' + (hashOf(slug) % 100000);
  const sky = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY_MID}"/><stop offset="100%" stop-color="${SKY_LOW}"/>
    </linearGradient></defs>
    <rect width="480" height="270" fill="url(#${id})"/>`;

  const scenes = {
    // Main-street storefronts with awnings and a lamp post.
    village: `${sky}
      <circle cx="386" cy="66" r="30" fill="${RED_SOFT}" opacity=".45"/>
      <g fill="${NAVY_DEEP}">
        <rect x="30" y="118" width="104" height="94"/><rect x="146" y="96" width="88" height="116"/>
        <rect x="246" y="126" width="96" height="86"/><rect x="354" y="104" width="96" height="108"/>
      </g>
      <g fill="${RED}">
        <path d="M30 156h104l-10 22H40z"/><path d="M246 164h96l-10 22h-76z"/>
      </g>
      <g fill="${CREAM}" opacity=".8">
        <rect x="46" y="126" width="20" height="22"/><rect x="80" y="126" width="20" height="22"/>
        <rect x="160" y="112" width="18" height="20"/><rect x="196" y="112" width="18" height="20"/>
        <rect x="160" y="146" width="18" height="20"/><rect x="196" y="146" width="18" height="20"/>
        <rect x="372" y="120" width="20" height="22"/><rect x="410" y="120" width="20" height="22"/>
        <rect x="372" y="158" width="20" height="22"/><rect x="410" y="158" width="20" height="22"/>
      </g>
      <rect y="212" width="480" height="58" fill="${NAVY}"/>
      <path d="M0 240h480" stroke="${CREAM}" stroke-width="3" stroke-dasharray="24 20" opacity=".35"/>
      <g fill="${NAVY_DEEP}"><rect x="222" y="168" width="6" height="46"/><circle cx="225" cy="162" r="9" fill="${RED_SOFT}"/></g>`,

    // LIRR platform and train.
    rail: `${sky}
      <g fill="${NAVY_DEEP}" opacity=".6">${treeRow(0, 150, 480, 40, 'far')}</g>
      <rect y="212" width="480" height="58" fill="${NAVY_DEEP}"/>
      <g fill="${NAVY}"><rect x="0" y="196" width="480" height="16"/></g>
      <g fill="${NAVY_MID}">
        <rect x="40" y="132" width="300" height="64" rx="10"/>
        <rect x="352" y="140" width="108" height="56" rx="10"/>
      </g>
      <g fill="${RED_SOFT}">
        ${Array.from({ length: 8 }, (_, i) => `<rect x="${58 + i * 36}" y="150" width="22" height="18" rx="3"/>`).join('')}
        <rect x="372" y="156" width="22" height="18" rx="3"/><rect x="410" y="156" width="22" height="18" rx="3"/>
      </g>
      <g fill="${CREAM}" opacity=".25">${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 42}" y="216" width="26" height="6"/>`).join('')}</g>
      <g fill="${NAVY_DEEP}"><rect x="0" y="222" width="480" height="10"/></g>`,

    // Canal, dock, and a moored boat.
    water: `${sky}
      <circle cx="392" cy="60" r="32" fill="${RED_SOFT}" opacity=".45"/>
      <g fill="${NAVY_DEEP}">${houseRow(20, 168, [70, 84, 76], 0.6)}</g>
      <rect y="168" width="480" height="102" fill="#2f3f8c"/>
      <g stroke="#93a3e0" stroke-width="2.6" fill="none" opacity=".5">
        <path d="M10 196c20-10 40-10 60 0s40 10 60 0 40-10 60 0"/>
        <path d="M160 224c20-10 40-10 60 0s40 10 60 0 40-10 60 0"/>
        <path d="M40 250c20-10 40-10 60 0s40 10 60 0 40-10 60 0"/>
      </g>
      <g fill="${NAVY_DEEP}"><rect x="286" y="164" width="170" height="9"/>
        <rect x="300" y="173" width="8" height="30"/><rect x="360" y="173" width="8" height="30"/><rect x="424" y="173" width="8" height="30"/></g>
      <g><path d="M96 214h96l-14 24H110z" fill="${CREAM}"/><rect x="140" y="160" width="4" height="54" fill="${NAVY_DEEP}"/>
        <path d="M146 166l40 42h-40z" fill="${RED}"/></g>`,

    // Park, ball field, and open green.
    park: `${sky}
      <circle cx="80" cy="62" r="26" fill="${RED_SOFT}" opacity=".4"/>
      <g fill="${NAVY_DEEP}" opacity=".7">${treeRow(0, 176, 480, 54, 'far')}</g>
      <rect y="176" width="480" height="94" fill="#2f3a7d"/>
      <path d="M0 214q120 -34 240 -6t240 -14" stroke="${CREAM}" stroke-width="3" fill="none" opacity=".3"/>
      <g fill="${NAVY_DEEP}">
        <rect x="330" y="120" width="10" height="60"/><circle cx="335" cy="106" r="30"/><circle cx="308" cy="122" r="20"/><circle cx="362" cy="122" r="20"/>
        <rect x="96" y="140" width="8" height="40"/><circle cx="100" cy="130" r="24"/>
      </g>
      <g fill="${CREAM}" opacity=".5"><ellipse cx="220" cy="238" rx="120" ry="22"/></g>
      <g fill="${RED}" opacity=".8"><rect x="196" y="228" width="48" height="6" rx="3"/></g>`,

    // Gated estate lane with hedges and columns.
    estate: `${sky}
      <circle cx="400" cy="70" r="34" fill="${RED_SOFT}" opacity=".4"/>
      <g fill="${NAVY_DEEP}">${houseRow(150, 190, [190], 1.1)}</g>
      <rect y="196" width="480" height="74" fill="${NAVY}"/>
      <path d="M170 270 l40 -74 h72 l40 74 z" fill="${CREAM}" opacity=".4"/>
      <g fill="${NAVY_DEEP}">
        <rect x="52" y="140" width="18" height="58"/><rect x="44" y="132" width="34" height="12"/>
        <rect x="410" y="140" width="18" height="58"/><rect x="402" y="132" width="34" height="12"/>
      </g>
      <g stroke="${NAVY_DEEP}" stroke-width="4" opacity=".85">
        <path d="M70 156h60M350 156h60"/><path d="M70 176h60M350 176h60"/>
      </g>
      <g fill="${NAVY_DEEP}" opacity=".9">
        <ellipse cx="120" cy="196" rx="34" ry="18"/><ellipse cx="360" cy="196" rx="34" ry="18"/>
      </g>`,
  };

  return `<svg class="scene scene-hood" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${scenes[kind] || scenes.village}</svg>`;
}

// ------------------------------------------------------- blog covers -----

/** Abstract editorial cover keyed to the post category. */
function blogCover(slug, category) {
  const id = 'bc' + (hashOf(slug) % 100000);
  const kind = /buy/i.test(category) ? 'key' : /market/i.test(category) ? 'chart' : 'price';
  const base = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/><stop offset="100%" stop-color="${NAVY_DEEP}"/>
    </linearGradient></defs>
    <rect width="480" height="270" fill="url(#${id})"/>
    <g stroke="${NAVY_SOFT}" stroke-width="1" opacity=".28">
      ${Array.from({ length: 9 }, (_, i) => `<path d="M0 ${i * 32} H480"/>`).join('')}
      ${Array.from({ length: 15 }, (_, i) => `<path d="M${i * 32} 0 V270"/>`).join('')}
    </g>`;

  const art = {
    // Rising trendline over the blueprint grid.
    chart: `<path d="M56 214 L146 168 L214 186 L296 118 L360 138 L432 74" fill="none" stroke="${RED}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <g fill="${CREAM}">
        ${[[56, 214], [146, 168], [214, 186], [296, 118], [360, 138], [432, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}
      </g>
      <g fill="${NAVY_SOFT}" opacity=".5">
        ${[0, 1, 2, 3, 4].map((i) => `<rect x="${64 + i * 76}" y="${228}" width="46" height="${10 + i * 6}" transform="translate(0,-${10 + i * 6})"/>`).join('')}
      </g>`,
    // Oversized key crossing the frame.
    key: `<g stroke="${RED}" stroke-width="14" stroke-linecap="round" fill="none">
        <circle cx="150" cy="150" r="52"/>
        <path d="M198 150 H408"/>
        <path d="M352 150 V196"/>
        <path d="M392 150 V182"/>
      </g>
      <circle cx="150" cy="150" r="20" fill="${NAVY_DEEP}"/>
      <g fill="${CREAM}" opacity=".25"><circle cx="404" cy="70" r="10"/><circle cx="360" cy="46" r="6"/></g>`,
    // Price tag over a roofline.
    price: `<path d="M60 210 L172 122 L284 210 z" fill="none" stroke="${NAVY_SOFT}" stroke-width="4" opacity=".6"/>
      <g transform="rotate(-12 330 130)">
        <path d="M262 92 H392 a14 14 0 0 1 14 14 V178 a14 14 0 0 1 -14 14 H262 L214 142 z" fill="${RED}"/>
        <circle cx="268" cy="142" r="13" fill="${NAVY_DEEP}"/>
        <g fill="${CREAM}"><rect x="296" y="128" width="86" height="9" rx="4"/><rect x="296" y="152" width="58" height="9" rx="4"/></g>
      </g>`,
  };

  return `<svg class="scene scene-cover" viewBox="0 0 480 270" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${base}${art[kind]}</svg>`;
}

// ---------------------------------------------------------- portraits ----

/** Fallback headshot tile: gradient panel, figure silhouette, and a label. */
function portraitTile(label, seed) {
  const id = 'pt' + (hashOf(seed || label) % 100000);
  return `<svg class="scene scene-portrait" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${NAVY_MID}"/><stop offset="100%" stop-color="${NAVY_DEEP}"/>
  </linearGradient></defs>
  <rect width="300" height="400" fill="url(#${id})"/>
  <g stroke="${NAVY_SOFT}" stroke-width="1" opacity=".25">
    ${Array.from({ length: 10 }, (_, i) => `<path d="M0 ${i * 40} H300"/>`).join('')}
  </g>
  <g fill="${NAVY_DEEP}" opacity=".55">
    <circle cx="150" cy="176" r="58"/>
    <path d="M52 400c0-58 44-100 98-100s98 42 98 100z"/>
  </g>
  <path d="M0 330 h300" stroke="${RED}" stroke-width="3" opacity=".7"/>
  <text x="150" y="372" text-anchor="middle" fill="${CREAM}" font-family="Georgia, serif" font-size="30" letter-spacing="1">${label}</text>
</svg>`;
}

// -------------------------------------------------------------- seal -----

/** Circular guarantee seal with text on a curved path. */
function guaranteeSeal(size = 168) {
  return `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 200 200" role="img" aria-label="Your home sold guaranteed or we will buy it">
  <defs>
    <path id="seal-arc-top" d="M100 100 m-72 0 a72 72 0 0 1 144 0" fill="none"/>
    <path id="seal-arc-bottom" d="M100 100 m-72 0 a72 72 0 0 0 144 0" fill="none"/>
  </defs>
  <circle cx="100" cy="100" r="96" fill="${NAVY}"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="${RED}" stroke-width="2"/>
  <circle cx="100" cy="100" r="58" fill="none" stroke="${CREAM}" stroke-width="1" opacity=".3"/>
  <text fill="${CREAM}" font-family="Georgia, serif" font-size="12.5" letter-spacing="2.2">
    <textPath href="#seal-arc-top" startOffset="50%" text-anchor="middle">SOLD GUARANTEED</textPath>
  </text>
  <text fill="${RED_SOFT}" font-family="Georgia, serif" font-size="11" letter-spacing="2">
    <textPath href="#seal-arc-bottom" startOffset="50%" text-anchor="middle">OR WE BUY IT</textPath>
  </text>
  <g transform="translate(100 100)">
    <g transform="translate(-24 -32) scale(2)" fill="none" stroke="${CREAM}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      ${ICON_PATHS.house}
    </g>
    <path d="M-26 22 h52" stroke="${RED}" stroke-width="2"/>
    <text y="40" text-anchor="middle" fill="${CREAM}" font-family="Georgia, serif" font-size="10.5" letter-spacing="1.4">TEAM RAJ JAGGI</text>
  </g>
</svg>`;
}

// -------------------------------------------------------- island map -----

// Long Island silhouette: blunt western end at the Queens line, a north shore
// broken by harbours, a smoother south shore, and the twin forks east of
// Riverhead. Drawn for recognisability rather than survey accuracy, and given
// more vertical weight than the real coastline so it reads as land on screen.
const ISLAND_PATH = [
  'M40 214',
  'C52 176 70 148 104 138',                              // western end at the Queens line
  'Q150 128 186 140 Q214 150 236 132',                   // Manhasset and Hempstead bays
  'Q272 112 300 140 Q330 166 360 138',                   // Oyster Bay, Huntington harbours
  'Q396 112 428 142 Q462 170 496 140',                   // Northport, Smithtown Bay
  'Q532 114 568 144 Q604 172 640 142',                   // Stony Brook, Port Jefferson
  'Q676 118 714 134 Q744 146 772 128',                   // Wading River to Riverhead
  'L820 108 L868 92 L916 78 L962 66 L978 82',            // north fork out to Orient
  'L928 100 L878 120 L830 140 L792 154',
  'L840 164 L888 170 L928 178 L964 192 L940 206',        // south fork out to Montauk
  'L892 198 L844 188 L796 178 L750 176',
  'Q700 190 640 204 Q560 222 470 234',                   // south shore, running back west
  'Q380 244 292 238 Q200 230 132 216',
  'Q86 208 40 214',
  'Z',
].join(' ');

// x/y are the pin positions; `row` puts the label above or below the island so
// the dense Nassau cluster stays readable. Label x positions are spread at
// render time, and a leader line connects each label to its pin.
const MAP_PINS = [
  { slug: 'queens', x: 84, y: 196, label: 'Queens Line', row: 'below' },
  { slug: 'garden-city', x: 150, y: 200, label: 'Garden City', row: 'below' },
  { slug: 'westbury', x: 186, y: 176, label: 'Westbury', row: 'above' },
  { slug: 'levittown', x: 182, y: 214, label: 'Levittown', row: 'below' },
  { slug: 'hicksville', x: 218, y: 172, label: 'Hicksville', row: 'above' },
  { slug: 'jericho', x: 244, y: 160, label: 'Jericho', row: 'above' },
  { slug: 'syosset', x: 276, y: 152, label: 'Syosset', row: 'above' },
  { slug: 'plainview', x: 258, y: 184, label: 'Plainview', row: 'below' },
  { slug: 'bethpage', x: 232, y: 200, label: 'Bethpage', row: 'below' },
  { slug: 'massapequa', x: 254, y: 222, label: 'Massapequa', row: 'below' },
  { slug: 'farmingdale', x: 300, y: 196, label: 'Farmingdale', row: 'below' },
  { slug: 'huntington', x: 344, y: 150, label: 'Huntington', row: 'above' },
];

const LABEL_ROW_Y = { above: 56, below: 292 };

/** Spread label x positions so no two in a row sit closer than `gap`. */
function spreadLabels(pins, gap) {
  const sorted = pins.slice().sort((a, b) => a.x - b.x);
  let previous = -Infinity;
  return sorted.map((pin) => {
    const x = Math.max(pin.x, previous + gap);
    previous = x;
    return { ...pin, labelX: x };
  });
}

/**
 * Long Island coverage map. Pins link to neighborhood pages; `activeSlug`
 * highlights one.
 */
function islandMap(activeSlug) {
  const placed = ['above', 'below'].flatMap((row) =>
    spreadLabels(MAP_PINS.filter((pin) => pin.row === row), 96)
  );

  const pins = placed
    .map((pin) => {
      const active = pin.slug === activeSlug;
      const labelY = LABEL_ROW_Y[pin.row];
      const tick = pin.row === 'above' ? labelY + 8 : labelY - 16;
      return `<a href="/neighborhoods/${pin.slug}" class="map-pin${active ? ' is-active' : ''}">
      <title>${pin.label}</title>
      <path class="map-leader" d="M${pin.x} ${pin.y} L${pin.labelX} ${tick}"/>
      <circle cx="${pin.x}" cy="${pin.y}" r="16" class="map-hit"/>
      <circle cx="${pin.x}" cy="${pin.y}" r="5" class="map-dot"/>
      <text x="${pin.labelX}" y="${labelY}" text-anchor="middle" class="map-label">${pin.label}</text>
    </a>`;
    })
    .join('');

  return `<svg class="island-map" viewBox="0 0 1000 340" role="img" aria-label="Team Raj Jaggi coverage across Nassau and Suffolk County, Long Island">
  <defs>
    <linearGradient id="island-fill" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${NAVY_MID}"/><stop offset="100%" stop-color="${NAVY_DEEP}"/>
    </linearGradient>
  </defs>
  <path d="${ISLAND_PATH}" fill="url(#island-fill)" stroke="${NAVY_SOFT}" stroke-width="1.5" stroke-linejoin="round"/>
  <!-- Nassau / Suffolk county line -->
  <path d="M382 134 L372 236" stroke="${CREAM}" stroke-width="1.6" stroke-dasharray="7 7" opacity=".5"/>
  <text x="286" y="212" text-anchor="middle" class="map-county">NASSAU</text>
  <text x="540" y="196" text-anchor="middle" class="map-county">SUFFOLK</text>
  <text x="915" y="150" text-anchor="middle" class="map-county map-county-faint">THE FORKS</text>
  <g class="map-pins">${pins}</g>
</svg>`;
}

// ---------------------------------------------------------- dividers -----

/** Angled or curved section transition. `fill` should match the next section. */
function divider(kind, fill) {
  if (kind === 'angle') {
    return `<svg class="divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 90 L1440 0 L1440 90 Z" fill="${fill}"/></svg>`;
  }
  if (kind === 'notch') {
    return `<svg class="divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 90 L640 90 L720 20 L800 90 L1440 90 Z" fill="${fill}"/></svg>`;
  }
  return `<svg class="divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 46 C240 96 420 6 720 34 C1020 62 1220 96 1440 44 L1440 90 L0 90 Z" fill="${fill}"/></svg>`;
}

/** Decorative rule: a short red bar used under eyebrows and headings. */
function rule() {
  return '<span class="rule" aria-hidden="true"></span>';
}

module.exports = {
  icon,
  ICON_PATHS,
  heroScene,
  houseScene,
  hoodScene,
  blogCover,
  portraitTile,
  guaranteeSeal,
  islandMap,
  divider,
  rule,
  NOISE_DATA_URI,
  colors: { NAVY, NAVY_DEEP, NAVY_MID, NAVY_SOFT, RED, RED_SOFT, CREAM },
};
