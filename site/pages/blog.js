'use strict';

const { page, esc } = require('../templates/layout');
const c = require('../templates/components');
const { brand } = require('../config');
const posts = require('../data/posts');

function blogIndex(category) {
  const categories = Array.from(new Set(posts.map((p) => p.category)));
  const shown = category ? posts.filter((p) => p.category.toLowerCase() === category.toLowerCase()) : posts;

  const body = `
${c.pageHeader({
  eyebrow: 'Blog',
  title: 'Long Island real estate, explained',
  text: 'Pricing, taxes, offer strategy, and what actually moves a sale on Long Island.',
})}

<section class="section">
  <div class="wrap">
    <div class="chip-grid chip-filters">
      <a class="chip${category ? '' : ' chip-on'}" href="/blog">All</a>
      ${categories.map((cat) => `<a class="chip${category && category.toLowerCase() === cat.toLowerCase() ? ' chip-on' : ''}" href="/blog?category=${encodeURIComponent(cat)}">${esc(cat)}</a>`).join('')}
    </div>
    <div class="grid grid-3">${shown.map(c.postCard).join('')}</div>
  </div>
</section>

${c.ctaBand({
  title: 'Have a question we have not written about?',
  text: 'Ask it directly. We answer every message.',
  actions: [{ label: 'Contact the Team', href: '/contact-us' }],
})}
`;

  return page({
    title: 'Blog — Long Island Real Estate Insights',
    description: 'Long Island real estate insights from Team Raj Jaggi: pricing, property taxes, offer strategy, and preparing a home for market.',
    path: '/blog',
    body,
  });
}

function renderBlock(block) {
  if (block.h2) return `<h2>${esc(block.h2)}</h2>`;
  if (block.p) return `<p>${esc(block.p)}</p>`;
  if (block.quote) return `<blockquote class="pull-quote">${esc(block.quote)}</blockquote>`;
  if (block.ul) return `<ul class="check-list">${block.ul.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`;
  return '';
}

function blogPost(post) {
  const related = posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const body = `
${c.breadcrumb([{ label: 'Home', href: '/' }, { label: 'Blog', href: '/blog' }, { label: post.title }])}
<article class="section">
  <div class="wrap narrow">
    <p class="eyebrow">${esc(post.category)} &middot; ${esc(c.formatDate(post.date))} &middot; ${esc(post.readMinutes)} min read</p>
    <h1 class="post-title">${esc(post.title)}</h1>
    <p class="lede">${esc(post.excerpt)}</p>
    <div class="prose">${post.body.map(renderBlock).join('')}</div>
    <div class="post-cta">
      ${c.leadForm({
        name: 'blog-cta',
        intent: post.category === 'Buying' ? 'buyer' : 'seller',
        title: post.category === 'Buying' ? 'Want help finding the right house?' : 'Want the real number for your home?',
        fields: ['name', 'email', 'phone'],
        submitLabel: post.category === 'Buying' ? 'Send Me Listings' : 'Get My Home Value',
        compact: true,
        hidden: { tags: `blog:${post.slug}` },
      })}
    </div>
  </div>
</article>

<section class="section section-tint">
  <div class="wrap">
    ${c.sectionHead({ eyebrow: 'Keep reading', title: 'More from the blog' })}
    <div class="grid grid-3">${related.map(c.postCard).join('')}</div>
  </div>
</section>
`;

  return page({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    body,
    schema: [{
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      datePublished: post.date,
      author: { '@type': 'Organization', name: brand.legalName },
      publisher: { '@type': 'Organization', name: brand.legalName },
      mainEntityOfPage: `${brand.baseUrl}/blog/${post.slug}`,
    }],
  });
}

module.exports = { blogIndex, blogPost };
