import { DEFAULT_TEXTS, fmt } from './texts.mjs';

const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=s||(d?'dark':'light');}catch(e){document.documentElement.dataset.theme='light';}})();`;

/** 计算从 fromRoute 指向 toRoute 的相对路径 */
export function rel(fromRoute, toRoute) {
  const fromParts = fromRoute.split('/').filter(Boolean).slice(0, -1);
  const up = fromParts.map(() => '..');
  const target = toRoute.split('/').filter(Boolean);
  const joined = [...up, ...target].join('/');
  return joined || './';
}

export function tagHref(route, slug) {
  return rel(route, `tags/${encodeURIComponent(slug)}.html`);
}

export function formatDate(iso, style = 'long') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (style === 'iso') return `${y}-${m}-${day}`;
  if (style === 'compact') return `${m}.${day}`;
  return `${y} 年 ${Number(m)} 月 ${Number(day)} 日`;
}

export function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 站点 logo：支持 public 下的相对路径，或完整 http(s) 地址 */
function logoSrc(site, route) {
  if (!site.logo) return '';
  const logo = String(site.logo);
  if (/^https?:\/\//i.test(logo)) return logo;
  return rel(route, logo.replace(/^\//, ''));
}

export function layout({
  site,
  route,
  title,
  description,
  content,
  activeNav = '',
  bodyClass = '',
  canonical = '',
  ogType = 'website',
  extraHead = '',
}) {
  const T = site.texts || DEFAULT_TEXTS;
  const pageTitle = title ? `${title} · ${site.title}` : `${site.title} · ${site.description}`;
  const desc = description || site.description;
  const css = rel(route, 'assets/styles.css');
  const js = rel(route, 'assets/main.js');
  const home = rel(route, 'index.html');
  const favicon = rel(route, 'favicon.svg');
  const canonicalTag = canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '';
  const ogImage = site.ogImage
    ? `${String(site.url).replace(/\/$/, '')}/${String(site.ogImage).replace(/^\//, '')}`
    : '';

  const navItems = (site.nav || [])
    .map((item) => {
      const href = rel(route, item.href);
      const isActive = activeNav && item.href === activeNav;
      return `<a class="nav-link${isActive ? ' is-active' : ''}" href="${href}"${
        isActive ? ' aria-current="page"' : ''
      }>${esc(item.label)}</a>`;
    })
    .join('');

  const logo = logoSrc(site, route);
  const brandMark = logo
    ? `<img class="brand-logo" src="${esc(logo)}" alt="" width="26" height="26">`
    : '<span class="brand-mark" aria-hidden="true">✦</span>';
  const footerMark = logo
    ? `<img class="footer-logo" src="${esc(logo)}" alt="" width="18" height="18">`
    : '<span class="footer-mark" aria-hidden="true">✦</span>';

  const copyright = esc(fmt(T.copyright, { year: new Date().getFullYear(), author: site.author }));

  // 交给浏览器端脚本的文案（复制按钮、搜索结果提示）
  const uiTexts = JSON.stringify({
    copy: T.copy,
    copied: T.copied,
    copyFail: T.copyFail,
    searchEmpty: T.searchEmpty,
    searchFound: T.searchFound,
    searchFail: T.searchFail,
    searchHint: T.searchHint,
    themeToDark: T.themeToDark,
    themeToLight: T.themeToLight,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="${esc(site.language || 'zh-CN')}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(site.author)}">
<meta name="theme-color" content="#fdfbf7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f161f" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="${favicon}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${rel(route, 'feed.xml')}">
<link rel="stylesheet" href="${css}">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:locale" content="zh_CN">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
${canonicalTag}
<script>${THEME_SCRIPT}</script>
${extraHead}
</head>
<body class="${esc(bodyClass)}">
<a class="skip-link" href="#main">${esc(T.skipLink)}</a>
<div class="progress-bar" id="progress-bar" aria-hidden="true"></div>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${home}">
      ${brandMark}
      <span class="brand-text">${esc(site.title)}</span>
    </a>
    <nav class="nav" aria-label="${esc(T.navLabel)}">${navItems}</nav>
    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="${esc(
      T.themeToggle
    )}" title="${esc(T.themeToggle)}">
      <svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>
      <svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8z"/></svg>
    </button>
  </div>
</header>
<main id="main">
${content}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <div class="footer-brand">
      ${footerMark}
      <p class="footer-title">${esc(site.title)}</p>
      <p class="footer-note">${esc(site.footerNote || '')}</p>
    </div>
    <div class="footer-links">
      <a href="${rel(route, 'index.html')}">${esc(T.footerHome)}</a>
      <a href="${rel(route, 'archive.html')}">${esc(T.footerArchive)}</a>
      <a href="${rel(route, 'feed.xml')}">${esc(T.footerRss)}</a>
      <a href="${home}#top">${esc(T.footerTop)}</a>
    </div>
    <p class="footer-copy">${copyright}${
      site.icp
        ? ` · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">${esc(site.icp)}</a>`
        : ''
    }</p>
  </div>
</footer>
<script id="ui-texts" type="application/json">${uiTexts}</script>
<script src="${js}" defer></script>
</body>
</html>
`;
}

export function postCard({ site, route, post }) {
  const T = site.texts || DEFAULT_TEXTS;
  const href = rel(route, `posts/${post.slug}.html`);
  const tags = (post.tags || [])
    .map((t) => `<a class="tag" href="${tagHref(route, post.tagSlugs[t])}">${esc(t)}</a>`)
    .join('');
  return `<article class="post-card">
  <div class="post-card-meta">
    <time datetime="${esc(post.date)}">${formatDate(post.date, 'iso')}</time>
    <span class="dot" aria-hidden="true">·</span>
    <span>${esc(fmt(T.readTimeShort, { n: post.readingTime }))}</span>
  </div>
  <h2 class="post-card-title"><a href="${href}">${esc(post.title)}</a></h2>
  <p class="post-card-summary">${esc(post.summary)}</p>
  <div class="post-card-foot">${tags}${
    post.draft ? `<span class="badge">${esc(T.draftBadge)}</span>` : ''
  }</div>
</article>`;
}
