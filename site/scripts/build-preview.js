'use strict';

// Renders every route into ONE self-contained HTML file with a small
// client-side router, so the whole site can be previewed from a single page
// (Artifact, email attachment, or a file opened straight off disk).
// Lead forms are stubbed in preview mode — the real ones post to /api/lead.

const fs = require('fs');
const path = require('path');

const home = require('../pages/home');
const sell = require('../pages/sell');
const buy = require('../pages/buy');
const about = require('../pages/about');
const blog = require('../pages/blog');
const misc = require('../pages/misc');

const team = require('../data/team');
const neighborhoods = require('../data/neighborhoods');
const listings = require('../data/listings');
const posts = require('../data/posts');

const routes = [
  ['/', () => home()],
  ['/home-search', () => buy.homeSearch({})],
  ['/properties/sale', () => buy.featuredListings()],
  ['/buyers-guide', () => buy.buyersGuide()],
  ['/mortgage-calculator', () => buy.mortgageCalculator()],
  ['/home-valuation', () => sell.homeValuation()],
  ['/guaranteed-sale', () => sell.guaranteedSale()],
  ['/sellers-guide', () => sell.sellersGuide()],
  ['/neighborhoods', () => about.neighborhoodsPage()],
  ['/team', () => about.teamPage()],
  ['/testimonials', () => about.testimonialsPage()],
  ['/contact-us', () => about.contactPage()],
  ['/join-us', () => about.joinUsPage()],
  ['/blog', () => blog.blogIndex()],
  ['/thank-you', () => misc.thankYou({})],
  ['/privacy', () => misc.legal('privacy')],
  ['/terms', () => misc.legal('terms')],
  ['/accessibility', () => misc.legal('accessibility')],
]
  .concat(neighborhoods.map((n) => [`/neighborhoods/${n.slug}`, () => about.neighborhoodPage(n)]))
  .concat(team.map((m) => [`/agent/${m.slug}`, () => about.agentPage(m)]))
  .concat(posts.map((p) => [`/blog/${p.slug}`, () => blog.blogPost(p)]))
  .concat(listings.map((l) => [`/properties/${l.mlsId}`, () => buy.listingDetail(l)]));

function extract(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1];
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) || [, ''])[1]
    .replace(/<script src="\/main\.js"[^>]*><\/script>/g, '');
  return { title, body };
}

// Inline the photo assets so the single-file preview needs no server.
const photoDir = path.join(__dirname, '..', 'public', 'images', 'photos');
const photos = fs.existsSync(photoDir)
  ? Object.fromEntries(
      fs.readdirSync(photoDir)
        .filter((f) => /\.(webp|png|jpe?g)$/i.test(f))
        .map((f) => [
          `/images/photos/${f}`,
          `data:image/${path.extname(f).slice(1).replace('jpg', 'jpeg')};base64,${fs.readFileSync(path.join(photoDir, f)).toString('base64')}`,
        ])
    )
  : {};

function inlinePhotos(html) {
  return Object.entries(photos).reduce((out, [src, uri]) => out.split(src).join(uri), html);
}

const pages = {};
for (const [route, render] of routes) {
  pages[route] = extract(inlinePhotos(render()));
}

// Inline the logo files so the single-file preview is fully self-contained.
function inlineLogos(html) {
  return html.replace(/src="(\/images\/[^"]+\.svg)"/g, function (match, src) {
    const file = path.join(__dirname, '..', 'public', src);
    if (!fs.existsSync(file)) return match;
    return 'src="data:image/svg+xml;base64,' + fs.readFileSync(file).toString('base64') + '"';
  });
}

for (const route of Object.keys(pages)) {
  pages[route].body = inlineLogos(pages[route].body);
}

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'styles.css'), 'utf8') +
  '\n' + fs.readFileSync(path.join(__dirname, '..', 'public', 'design.css'), 'utf8');
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'main.js'), 'utf8');

const routerJs = `
<script>
window.__PAGES__ = ${JSON.stringify(pages).replace(/<\/script>/gi, '<\\/script>')};
(function () {
  var root = document.getElementById('app');

  function normalize(href) {
    if (!href) return null;
    if (href.charAt(0) !== '/') return null;
    var clean = href.split('?')[0].split('#')[0];
    if (clean.length > 1 && clean.charAt(clean.length - 1) === '/') clean = clean.slice(0, -1);
    return window.__PAGES__[clean] ? clean : null;
  }

  function render(route) {
    var page = window.__PAGES__[route] || window.__PAGES__['/'];
    root.innerHTML = page.body;
    document.title = page.title;
    window.scrollTo(0, 0);
    bind();
  }

  function bind() {
    root.querySelectorAll('a[href^="/"]').forEach(function (a) {
      var route = normalize(a.getAttribute('href'));
      if (!route) {
        a.addEventListener('click', function (e) { e.preventDefault(); note('This link opens the live MLS search once CINC is connected.'); });
        return;
      }
      a.addEventListener('click', function (e) {
        e.preventDefault();
        location.hash = '#' + route;
      });
    });

    root.querySelectorAll('form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var status = form.querySelector('[data-status]');
        if (status) {
          status.className = 'form-status is-ok';
          status.textContent = 'Preview mode — on the live site this posts straight into the CINC CRM as a tagged lead.';
        } else {
          note('Preview mode — search hands off to the CINC IDX site once connected.');
        }
      }, true);
    });

    if (window.__initSite) window.__initSite();
  }

  function note(message) {
    var bar = document.getElementById('preview-note');
    bar.textContent = message;
    bar.classList.add('on');
    clearTimeout(bar.__t);
    bar.__t = setTimeout(function () { bar.classList.remove('on'); }, 4000);
  }

  window.addEventListener('hashchange', function () {
    render(location.hash.slice(1) || '/');
  });

  render(location.hash.slice(1) || '/');
})();
</script>`;

const html = `<title>Team Raj Jaggi — Site Preview</title>
<style>
${css}
#preview-bar {
  position: fixed; z-index: 200; left: 50%; bottom: 18px; transform: translateX(-50%);
  background: #242a63; color: #ff8f97; font-family: var(--sans); font-size: .78rem;
  letter-spacing: .1em; text-transform: uppercase; padding: .6rem 1.1rem; border-radius: 100px;
  box-shadow: 0 12px 32px rgba(0,0,0,.35); pointer-events: none;
}
#preview-note {
  position: fixed; z-index: 201; left: 50%; bottom: 62px; transform: translateX(-50%) translateY(8px);
  background: #d0202f; color: #fff; font-family: var(--sans); font-size: .85rem;
  padding: .7rem 1.1rem; border-radius: 4px; max-width: min(90vw, 460px); text-align: center;
  opacity: 0; transition: opacity .2s ease, transform .2s ease; pointer-events: none;
}
#preview-note.on { opacity: 1; transform: translateX(-50%) translateY(0); }
</style>
<div id="app"></div>
<script>document.documentElement.className+=' js';</script>
<div id="preview-bar">Clickable preview &middot; every page is live</div>
<div id="preview-note"></div>
${routerJs}
<script>
window.__initSite = function () {
${mainJs}
};
</script>`;

const out = process.argv[2] || path.join(__dirname, '..', 'dist', 'preview.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`preview written: ${out} (${routes.length} routes, ${(html.length / 1024).toFixed(0)} KB)`);
