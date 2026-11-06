/**
 * 界面文案（所有页面上出现的固定文字都集中在这里）
 * ------------------------------------------------------------------
 * 想改哪句就改哪句，改完刷新即可。{count}、{n} 这类花括号是变量占位符，
 * 删掉它们会导致数字显示不出来，保留即可。
 *
 * 如果不想动这个文件，也可以在 site.config.json 里加一个 "texts": {...}
 * 对象，里面写同名的键，会覆盖这里的默认值。
 */

export const DEFAULT_TEXTS = {
  /* ---------------------------------------------------------- 全站通用 */
  skipLink: '跳到正文',
  navLabel: '主导航',
  themeToggle: '切换深色模式',
  themeToDark: '切换到深色模式',
  themeToLight: '切换到浅色模式',
  copyright: '© {year} {author} · 保留所有权利',

  /* ---------------------------------------------------------- 页脚 */
  footerHome: '首页',
  footerArchive: '归档',
  footerRss: 'RSS',
  footerTop: '回到顶部',

  /* ---------------------------------------------------------- 首页 */
  heroKicker: '个人博客 · 持续更新中',
  heroPrimary: '关于我',
  heroSecondary: '订阅 RSS',
  postsCount: '共 {count} 篇文章',
  lastUpdated: '最近更新 {date}',
  latestPosts: '最新文章',
  allPosts: '全部文章 · 第 {page} 页',
  pageTitle: '第 {page} 页',
  viewArchive: '查看归档 →',
  emptyPosts: '还没有文章，先运行 npm run new 写第一篇吧。',
  prevPage: '← 上一页',
  nextPage: '下一页 →',
  postsNavLabel: '分页',

  /* ---------------------------------------------------------- 文章页 */
  readTime: '{n} 分钟阅读',
  readTimeShort: '{n} 分钟',
  tocTitle: '本文目录',
  tocLabel: '目录',
  postEnd: '— 完 —',
  license: '本文作者 {author}，首发于 {site}。转载请注明出处。',
  prevPost: '← 上一篇',
  nextPost: '下一篇 →',
  postNavLabel: '上一篇 / 下一篇',
  related: '相关阅读',
  draftBadge: '草稿',

  /* ---------------------------------------------------------- 归档页 */
  archiveKicker: 'Archive',
  archiveTitle: '归档',
  archiveDesc: '共 {count} 篇文章，横跨 {years} 年。',
  archiveEmpty: '还没有文章。',
  unitPosts: '{n} 篇',

  /* ---------------------------------------------------------- 标签页 */
  tagsKicker: 'Tags',
  tagsTitle: '标签',
  tagsDesc: '共 {count} 个标签，{posts} 篇文章。',
  tagsEmpty: '还没有标签。',
  tagKicker: 'Tag',
  tagDesc: '该标签下有 {count} 篇文章。',
  tagBack: '← 全部标签',
  tagPageTitle: '标签：{name}',

  /* ---------------------------------------------------------- 搜索页 */
  searchKicker: 'Search',
  searchTitle: '搜索',
  searchDesc: '输入关键词，在全部文章里查找。',
  searchPlaceholder: '搜索标题、标签或正文…',
  searchHint: '试试搜索「写作」「Markdown」或「博客」。',
  searchEmpty: '没有找到相关文章，换个关键词试试。',
  searchFound: '找到 {n} 篇相关文章。',
  searchFail: '搜索索引加载失败，请通过本地服务器或线上地址访问。',

  /* ---------------------------------------------------------- 404 */
  notFoundPageTitle: '页面不存在',
  notFoundTitle: '这一页走丢了',
  notFoundText: '链接可能已经失效，或者文章被移动到了别处。',
  notFoundHome: '回到首页',
  notFoundArchive: '翻翻归档',

  /* ---------------------------------------------------------- 代码块按钮 */
  copy: '复制',
  copied: '已复制',
  copyFail: '复制失败',
};

/** 合并 site.config.json 里的覆盖项 */
export function getTexts(config = {}) {
  return { ...DEFAULT_TEXTS, ...(config.texts || {}) };
}

/** 把 {name} 占位符替换成实际值 */
export function fmt(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) =>
    vars[key] !== undefined ? String(vars[key]) : match
  );
}
