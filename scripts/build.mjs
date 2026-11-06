#!/usr/bin/env node
/**
 * 静态博客构建脚本 —— 零依赖
 * 输入：site.config.json、content 下的 Markdown、theme 下的模板与静态资源、public
 * 输出：dist/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, renderMarkdown, plainText, readingTime, escapeHtml } from './markdown.mjs';
import { layout, rel, formatDate, esc, postCard, tagHref } from '../theme/layout.mjs';
import { getTexts, fmt } from '../theme/texts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const PAGES_DIR = path.join(ROOT, 'content', 'pages');
const THEME_DIR = path.join(ROOT, 'theme');
const PUBLIC_DIR = path.join(ROOT, 'public');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const site = { ...config, texts: getTexts(config) };
const T = site.texts;
const PAGE_SIZE = config.pageSize || 8;
const SHOW_DRAFTS = process.argv.includes('--drafts');

const write = (route, content) => {
  const file = path.join(DIST, route);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

function slugTag(tag) {
  return String(tag).trim().toLowerCase().replace(/\s+/g, '-').replace(/[\\/:*?"<>|]/g, '');
}

function truncate(text, max = 110) {
  const t = String(text).trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * 把正文里以 / 开头的链接和图片改成相对路径。
 * 这样 /images/a.jpg 既能部署在域名根目录，也能部署在 /repo/ 子路径下。
 */
function rewriteRootLinks(html, route) {
  return html.replace(/\b(src|href)="\/(?!\/)([^"]*)"/g, (match, attr, rest) =>
    rest ? `${attr}="${rel(route, rest)}"` : match
  );
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const stat = fs.statSync(path.join(POSTS_DIR, file));
      const rendered = renderMarkdown(body);
      const html = rewriteRootLinks(rendered.html, `posts/${slug}.html`);
      const text = plainText(html);
      const tags = (Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []).filter(Boolean);
      return {
        slug,
        title: data.title || slug,
        date: data.date || stat.mtime.toISOString().slice(0, 10),
        updated: data.updated || '',
        summary: data.summary || truncate(text, 110),
        tags,
        tagSlugs: Object.fromEntries(tags.map((t) => [t, slugTag(t)])),
        draft: data.draft === true || data.draft === 'true' || data.draft === 'yes',
        cover: data.cover || '',
        html,
        headings: rendered.headings,
        text,
        readingTime: readingTime(text),
        wordCount: text.length,
      };
    })
    .filter((p) => SHOW_DRAFTS || !p.draft)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

const posts = loadPosts();
const tagMap = new Map();
for (const post of posts) {
  for (const tag of post.tags) {
    const slug = post.tagSlugs[tag];
    if (!tagMap.has(slug)) tagMap.set(slug, { name: tag, slug, posts: [] });
    tagMap.get(slug).posts.push(post);
  }
}
const tags = [...tagMap.values()].sort((a, b) => b.posts.length - a.posts.length);

const absUrl = (route) => encodeURI(`${String(site.url || '').replace(/\/$/, '')}/${route}`);
const latestDate = posts[0]?.date || new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ 首页 */

function renderIndex(page = 1) {
  const route = page === 1 ? 'index.html' : `page-${page}.html`;
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const slice = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const postsCount = esc(T.postsCount).replace('{count}', `<strong>${posts.length}</strong>`);

  const hero =
    page === 1
      ? `<section class="hero">
  <p class="hero-kicker"><span class="pulse" aria-hidden="true"></span>${esc(T.heroKicker)}</p>
  <h1 class="hero-title">${esc(site.heroTitle || site.title)}</h1>
  <p class="hero-text">${esc(site.heroText || site.description)}</p>
  <div class="hero-actions">
    <a class="btn" href="${rel(route, 'about.html')}">${esc(T.heroPrimary)}</a>
    <a class="btn btn-ghost" href="${rel(route, 'feed.xml')}">${esc(T.heroSecondary)}</a>
  </div>
  <div class="hero-meta">
    <span>${postsCount}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>${esc(fmt(T.lastUpdated, { date: formatDate(latestDate, 'iso') }))}</span>
  </div>
</section>`
      : '';

  const list = slice.map((post) => postCard({ site, route, post })).join('\n');
  const sectionTitle = page === 1 ? esc(T.latestPosts) : esc(fmt(T.allPosts, { page }));
  const sectionTag = page === 1 ? 'h2' : 'h1';

  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);
  const pagination =
    totalPages > 1
      ? `<nav class="pagination" aria-label="${esc(T.postsNavLabel)}">
  ${
    page > 1
      ? `<a class="page-link" href="${rel(route, page - 1 === 1 ? 'index.html' : `page-${page - 1}.html`)}">${esc(
          T.prevPage
        )}</a>`
      : `<span class="page-link is-disabled">${esc(T.prevPage)}</span>`
  }
  <span class="page-numbers">${pages
    .map((n) =>
      n === page
        ? `<span class="page-number is-current" aria-current="page">${n}</span>`
        : `<a class="page-number" href="${rel(route, n === 1 ? 'index.html' : `page-${n}.html`)}">${n}</a>`
    )
    .join('')}</span>
  ${
    page < totalPages
      ? `<a class="page-link" href="${rel(route, `page-${page + 1}.html`)}">${esc(T.nextPage)}</a>`
      : `<span class="page-link is-disabled">${esc(T.nextPage)}</span>`
  }
</nav>`
      : '';

  const content = `<div class="wrap">
${hero}
<section class="section">
  <div class="section-head">
    <${sectionTag} class="section-title">${sectionTitle}</${sectionTag}>
    <a class="section-more" href="${rel(route, 'archive.html')}">${esc(T.viewArchive)}</a>
  </div>
  <div class="post-list">${list || `<p class="empty">${esc(T.emptyPosts)}</p>`}</div>
  ${pagination}
</section>
</div>`;

  return layout({
    site,
    route,
    title: page === 1 ? '' : fmt(T.pageTitle, { page }),
    description: site.description,
    content,
    activeNav: 'index.html',
    canonical: absUrl(route),
    bodyClass: 'home',
  });
}

/* ------------------------------------------------------------------ 文章页 */

function renderPost(post) {
  const route = `posts/${post.slug}.html`;
  const index = posts.findIndex((p) => p.slug === post.slug);
  const newer = posts[index - 1];
  const older = posts[index + 1];

  const tagLinks = post.tags
    .map((t) => `<a class="tag" href="${tagHref(route, post.tagSlugs[t])}">${esc(t)}</a>`)
    .join('');

  const tocItems = post.headings.filter((h) => h.level === 2 || h.level === 3);
  const toc =
    tocItems.length >= 3
      ? `<nav class="toc" aria-label="${esc(T.tocLabel)}">
  <p class="toc-title">${esc(T.tocTitle)}</p>
  <ul>${tocItems
    .map((h) => `<li class="toc-l${h.level}"><a href="#${h.id}">${esc(h.text)}</a></li>`)
    .join('')}</ul>
</nav>`
      : '';

  const related = posts
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, 2);

  const relatedHtml = related.length
    ? `<section class="related">
  <h2 class="related-title">${esc(T.related)}</h2>
  <div class="related-grid">${related
    .map(
      (p) => `<a class="related-card" href="${rel(route, `posts/${p.slug}.html`)}">
    <span class="related-date">${formatDate(p.date, 'iso')}</span>
    <span class="related-name">${esc(p.title)}</span>
  </a>`
    )
    .join('')}</div>
</section>`
    : '';

  const license = T.license
    .replace('{author}', esc(site.author))
    .replace(
      '{site}',
      `<a href="${absUrl('index.html')}">${esc(site.title)}</a>`
    );

  const content = `<div class="wrap wrap-narrow">
<article class="post">
  <header class="post-header">
    <div class="post-meta">
      <time datetime="${esc(post.date)}">${formatDate(post.date)}</time>
      <span class="dot" aria-hidden="true">·</span>
      <span>${esc(fmt(T.readTime, { n: post.readingTime }))}</span>
    </div>
    <h1 class="post-title">${esc(post.title)}</h1>
    <div class="post-tags">${tagLinks}</div>
  </header>
  ${toc}
  <div class="prose">${post.html}</div>
  <footer class="post-footer">
    <p class="post-end">${esc(T.postEnd)}</p>
    <p class="post-license">${license}</p>
  </footer>
</article>
<nav class="post-nav" aria-label="${esc(T.postNavLabel)}">
  ${
    older
      ? `<a class="post-nav-item" href="${rel(route, `posts/${older.slug}.html`)}">
    <span class="post-nav-label">${esc(T.prevPost)}</span>
    <span class="post-nav-title">${esc(older.title)}</span>
  </a>`
      : '<span class="post-nav-item is-empty"></span>'
  }
  ${
    newer
      ? `<a class="post-nav-item post-nav-next" href="${rel(route, `posts/${newer.slug}.html`)}">
    <span class="post-nav-label">${esc(T.nextPost)}</span>
    <span class="post-nav-title">${esc(newer.title)}</span>
  </a>`
      : '<span class="post-nav-item is-empty"></span>'
  }
</nav>
${relatedHtml}
</div>`;

  return layout({
    site,
    route,
    title: post.title,
    description: post.summary,
    content,
    activeNav: '',
    canonical: absUrl(route),
    bodyClass: 'post-page',
    ogType: 'article',
    extraHead: `<meta property="article:published_time" content="${esc(post.date)}">
${post.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}`,
  });
}

/* ------------------------------------------------------------------ 归档页 */

function renderArchive() {
  const route = 'archive.html';
  const groups = new Map();
  for (const post of posts) {
    const y = String(post.date).slice(0, 4);
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(post);
  }

  const years = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  const body = years
    .map(
      (year) => `<section class="archive-year">
  <h2 class="archive-year-title">${year}<span class="archive-count">${esc(
        fmt(T.unitPosts, { n: groups.get(year).length })
      )}</span></h2>
  <ul class="archive-list">
    ${groups
      .get(year)
      .map(
        (p) => `<li>
      <time datetime="${esc(p.date)}">${formatDate(p.date, 'iso').slice(5)}</time>
      <a href="${rel(route, `posts/${p.slug}.html`)}">${esc(p.title)}</a>
    </li>`
      )
      .join('\n    ')}
  </ul>
</section>`
    )
    .join('\n');

  const content = `<div class="wrap wrap-narrow">
<header class="page-header">
  <p class="page-kicker">${esc(T.archiveKicker)}</p>
  <h1 class="page-title">${esc(T.archiveTitle)}</h1>
  <p class="page-desc">${esc(fmt(T.archiveDesc, { count: posts.length, years: years.length }))}</p>
</header>
${body || `<p class="empty">${esc(T.archiveEmpty)}</p>`}
</div>`;

  return layout({
    site,
    route,
    title: T.archiveTitle,
    description: `按年份浏览 ${site.title} 的全部文章`,
    content,
    activeNav: 'archive.html',
    canonical: absUrl(route),
  });
}

/* ------------------------------------------------------------------ 标签页 */

function renderTagsPage() {
  const route = 'tags.html';
  const cloud = tags
    .map(
      (t) =>
        `<a class="tag-chip" href="${tagHref(route, t.slug)}">${esc(t.name)}<span class="tag-count">${
          t.posts.length
        }</span></a>`
    )
    .join('\n');

  const content = `<div class="wrap wrap-narrow">
<header class="page-header">
  <p class="page-kicker">${esc(T.tagsKicker)}</p>
  <h1 class="page-title">${esc(T.tagsTitle)}</h1>
  <p class="page-desc">${esc(fmt(T.tagsDesc, { count: tags.length, posts: posts.length }))}</p>
</header>
<div class="tag-cloud">${cloud || `<p class="empty">${esc(T.tagsEmpty)}</p>`}</div>
</div>`;

  return layout({
    site,
    route,
    title: T.tagsTitle,
    description: `按标签浏览 ${site.title} 的文章`,
    content,
    activeNav: 'tags.html',
    canonical: absUrl(route),
  });
}

function renderTagPage(tag) {
  const route = `tags/${tag.slug}.html`;
  const list = tag.posts.map((post) => postCard({ site, route, post })).join('\n');
  const content = `<div class="wrap">
<header class="page-header">
  <p class="page-kicker">${esc(T.tagKicker)}</p>
  <h1 class="page-title">${esc(tag.name)}</h1>
  <p class="page-desc">${esc(fmt(T.tagDesc, { count: tag.posts.length }))}</p>
  <a class="back-link" href="${rel(route, 'tags.html')}">${esc(T.tagBack)}</a>
</header>
<div class="post-list">${list}</div>
</div>`;

  return layout({
    site,
    route,
    title: fmt(T.tagPageTitle, { name: tag.name }),
    description: `标签「${tag.name}」下的全部文章`,
    content,
    activeNav: 'tags.html',
    canonical: absUrl(route),
  });
}

/* ------------------------------------------------------------------ 独立页面 */

function loadPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const name = file.replace(/\.md$/, '');
      const { data, body } = parseFrontmatter(fs.readFileSync(path.join(PAGES_DIR, file), 'utf8'));
      const rendered = renderMarkdown(body);
      const route = `${name}.html`;
      return {
        route,
        title: data.title || name,
        description: data.description || '',
        kicker: data.kicker || '',
        html: rewriteRootLinks(rendered.html, route),
      };
    });
}

function renderPage(page) {
  const content = `<div class="wrap wrap-narrow">
<header class="page-header">
  ${page.kicker ? `<p class="page-kicker">${esc(page.kicker)}</p>` : ''}
  <h1 class="page-title">${esc(page.title)}</h1>
  ${page.description ? `<p class="page-desc">${esc(page.description)}</p>` : ''}
</header>
<div class="prose">${page.html}</div>
</div>`;

  return layout({
    site,
    route: page.route,
    title: page.title,
    description: page.description || site.description,
    content,
    activeNav: page.route,
    canonical: absUrl(page.route),
  });
}

/* ------------------------------------------------------------------ 搜索页 */

function renderSearchPage() {
  const route = 'search.html';
  const content = `<div class="wrap wrap-narrow">
<header class="page-header">
  <p class="page-kicker">${esc(T.searchKicker)}</p>
  <h1 class="page-title">${esc(T.searchTitle)}</h1>
  <p class="page-desc">${esc(T.searchDesc)}</p>
</header>
<div class="search-box">
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
  <input id="search-input" type="search" placeholder="${esc(
    T.searchPlaceholder
  )}" autocomplete="off" aria-label="${esc(T.searchTitle)}">
  <kbd class="search-kbd">/</kbd>
</div>
<p class="search-hint" id="search-hint">${esc(T.searchHint)}</p>
<div id="search-results" class="search-results"></div>
</div>`;

  return layout({
    site,
    route,
    title: T.searchTitle,
    description: `搜索 ${site.title} 的全部文章`,
    content,
    activeNav: 'search.html',
    canonical: absUrl(route),
  });
}

/* ------------------------------------------------------------------ 404 */

function render404() {
  const route = '404.html';
  const content = `<div class="wrap wrap-narrow not-found">
<p class="nf-code">404</p>
<h1 class="nf-title">${esc(T.notFoundTitle)}</h1>
<p class="nf-text">${esc(T.notFoundText)}</p>
<div class="hero-actions">
  <a class="btn" href="${rel(route, 'index.html')}">${esc(T.notFoundHome)}</a>
  <a class="btn btn-ghost" href="${rel(route, 'archive.html')}">${esc(T.notFoundArchive)}</a>
</div>
</div>`;
  return layout({
    site,
    route,
    title: T.notFoundPageTitle,
    description: T.notFoundPageTitle,
    content,
  });
}

/* ------------------------------------------------------------------ 订阅 / SEO */

function renderFeed() {
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${escapeHtml(p.title)}</title>
    <link>${absUrl(`posts/${p.slug}.html`)}</link>
    <guid isPermaLink="true">${absUrl(`posts/${p.slug}.html`)}</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${escapeHtml(p.summary)}</description>
${p.tags.map((t) => `    <category>${escapeHtml(t)}</category>`).join('\n')}
  </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeHtml(site.title)}</title>
  <link>${absUrl('index.html')}</link>
  <description>${escapeHtml(site.description)}</description>
  <language>${escapeHtml(site.language || 'zh-CN')}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${absUrl('feed.xml')}" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>
`;
}

function renderSitemap(routes) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${absUrl(r.route)}</loc>
    <lastmod>${r.lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;
}

/* ------------------------------------------------------------------ 执行构建 */

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 静态资源
for (const file of ['styles.css', 'main.js']) {
  const src = path.join(THEME_DIR, file);
  if (fs.existsSync(src)) write(`assets/${file}`, fs.readFileSync(src));
}

// 背景图：单独生成一个样式文件，url 相对 assets/ 解析，子目录部署也不会失效
const backgroundSource = String(site.background || '').trim();
if (backgroundSource) {
  const bgPath = /^https?:\/\//i.test(backgroundSource)
    ? backgroundSource
    : `../${backgroundSource.replace(/^\//, '')}`;
  write(
    'assets/background.css',
    `body.has-bg{background-image:linear-gradient(var(--bg-scrim),var(--bg-scrim)),url('${bgPath}');` +
      `background-size:cover;background-position:center center;background-repeat:no-repeat;background-attachment:fixed}\n`
  );
}
if (fs.existsSync(PUBLIC_DIR)) {
  for (const entry of fs.readdirSync(PUBLIC_DIR)) {
    const src = path.join(PUBLIC_DIR, entry);
    const dest = path.join(DIST, entry);
    fs.cpSync(src, dest, { recursive: true });
  }
}

// 页面
const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
const routes = [];
for (let p = 1; p <= totalPages; p++) {
  const route = p === 1 ? 'index.html' : `page-${p}.html`;
  write(route, renderIndex(p));
  routes.push({ route, lastmod: latestDate });
}

for (const post of posts) {
  write(`posts/${post.slug}.html`, renderPost(post));
  routes.push({ route: `posts/${post.slug}.html`, lastmod: post.date });
}

write('archive.html', renderArchive());
write('tags.html', renderTagsPage());
write('search.html', renderSearchPage());
write('404.html', render404());
routes.push({ route: 'archive.html', lastmod: latestDate });
routes.push({ route: 'tags.html', lastmod: latestDate });

for (const tag of tags) {
  write(`tags/${tag.slug}.html`, renderTagPage(tag));
  routes.push({ route: `tags/${tag.slug}.html`, lastmod: tag.posts[0].date });
}

for (const page of loadPages()) {
  write(page.route, renderPage(page));
  routes.push({ route: page.route, lastmod: latestDate });
}

// 搜索索引
const searchIndex = posts.map((p) => ({
  title: p.title,
  url: `posts/${p.slug}.html`,
  date: p.date,
  tags: p.tags,
  summary: p.summary,
  text: p.text.slice(0, 1500),
}));
write('search-index.json', JSON.stringify(searchIndex));

write('feed.xml', renderFeed());
write(
  'sitemap.xml',
  renderSitemap(routes.sort((a, b) => a.route.localeCompare(b.route)))
);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${absUrl('sitemap.xml')}\n`);

console.log(`\n✓ 构建完成：${posts.length} 篇文章 · ${tags.length} 个标签 · ${routes.length} 个页面`);
console.log(`  输出目录：${DIST}`);
console.log(`  本地预览：npm run dev\n`);
