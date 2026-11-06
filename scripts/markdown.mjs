/**
 * 极简 Markdown 渲染器（零依赖）
 * 支持：标题、段落、加粗/斜体/删除线、行内代码、代码块、链接、图片、
 *       有序/无序列表（含一级嵌套）、引用、分割线、表格、自动链接。
 */

const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F]/;

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str = '') {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/** 只允许安全协议，挡掉 javascript: 之类 */
function safeUrl(url) {
  const u = String(url || '').trim();
  if (/^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)) return u;
  if (/^[\w.-]+(\/[\w./-]*)?(\.html|\.xml|\.json)?$/.test(u)) return u;
  return '#';
}

function stripInline(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .trim();
}

function slugifyHeading(text, used) {
  let base = stripInline(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  if (!base) base = 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function joinLines(parts) {
  let out = '';
  for (const part of parts) {
    if (!out) {
      out = part;
      continue;
    }
    const prev = out.slice(-1);
    const next = part[0] || '';
    out += CJK_RE.test(prev) && CJK_RE.test(next) ? part : `\n${part}`;
  }
  return out;
}

function inline(raw, ctx) {
  const codes = [];
  let s = escapeHtml(raw);

  // 行内代码先抽出来，避免被其它规则误伤（支持用多个反引号包裹含反引号的内容）
  s = s.replace(/(`+)([^]*?)\1/g, (whole, ticks, content) => {
    if (content.includes('\n')) return whole;
    let text = content;
    if (text.length > 1 && text.startsWith(' ') && text.endsWith(' ') && text.trim()) {
      text = text.slice(1, -1);
    }
    codes.push(`<code>${text}</code>`);
    return `\u0000C${codes.length - 1}\u0000`;
  });

  // 图片
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, alt, src, title) =>
      `<img src="${safeUrl(src)}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" decoding="async">`
  );

  // 链接
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, text, href, title) => {
      const url = safeUrl(href);
      const external = /^https?:\/\//i.test(url);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${url}"${title ? ` title="${title}"` : ''}${attrs}>${text}</a>`;
    }
  );

  // 自动链接 <https://...>
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // 强调
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w_])__([^_\n]+)__/g, '$1<strong>$2</strong>');
  s = s.replace(/(^|[^\w_])_([^_\n]+)_/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  // 收尾换行
  s = s.replace(/ {2,}\n/g, '<br>\n');

  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[Number(i)]);
  return s;
}

const FENCE_RE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

function isTableStart(lines, i) {
  const head = lines[i];
  const sep = lines[i + 1];
  if (!head || !sep) return false;
  if (!head.includes('|')) return false;
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(sep);
}

function splitRow(row) {
  let r = row.trim();
  if (r.startsWith('|')) r = r.slice(1);
  if (r.endsWith('|')) r = r.slice(0, -1);
  return r.split('|').map((c) => c.trim());
}

function startsBlock(line, lines, i) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    QUOTE_RE.test(line) ||
    isTableStart(lines, i)
  );
}

function renderList(items, ctx) {
  let html = '';
  const stack = [];
  let needClose = false;

  for (const item of items) {
    const tag = item.ordered ? 'ol' : 'ul';
    while (stack.length && item.level < stack[stack.length - 1].level) {
      if (needClose) html += '</li>';
      html += `</${stack.pop().tag}>`;
      // 关掉内层列表后，父级 <li> 还开着
      needClose = stack.length > 0;
    }
    if (!stack.length) {
      stack.push({ level: item.level, tag });
      html += `<${tag}>`;
      needClose = true;
    } else if (item.level > stack[stack.length - 1].level) {
      stack.push({ level: item.level, tag });
      html += `<${tag}>`;
      needClose = true;
    } else {
      if (needClose) html += '</li>';
      needClose = true;
      if (stack[stack.length - 1].tag !== tag) {
        html += `</${stack.pop().tag}><${tag}>`;
        stack.push({ level: item.level, tag });
      }
    }
    html += `<li>${inline(item.text, ctx)}`;
  }

  while (stack.length) {
    if (needClose) html += '</li>';
    html += `</${stack.pop().tag}>`;
    needClose = stack.length > 0;
  }
  return html;
}

function renderBlocks(lines, ctx) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // 代码块
    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2] || '';
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束围栏
      const cls = lang ? ` class="language-${escapeAttr(lang)}"` : '';
      html += `<pre class="code-block"${lang ? ` data-lang="${escapeAttr(lang)}"` : ''}><code${cls}>${escapeHtml(
        buf.join('\n')
      )}</code></pre>`;
      continue;
    }

    // 标题
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = slugifyHeading(text, ctx.headingIds);
      ctx.headings.push({ level, text: stripInline(text), id });
      html += `<h${level} id="${id}">${inline(text, ctx)}<a class="anchor" href="#${id}" aria-label="锚点">#</a></h${level}>`;
      i++;
      continue;
    }

    // 分割线
    if (HR_RE.test(line)) {
      html += '<hr>';
      i++;
      continue;
    }

    // 引用
    if (QUOTE_RE.test(line)) {
      const buf = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        buf.push(lines[i].match(QUOTE_RE)[1]);
        i++;
      }
      html += `<blockquote>${renderBlocks(buf, ctx)}</blockquote>`;
      continue;
    }

    // 表格
    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      const aligns = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(':');
        const r = c.endsWith(':');
        if (l && r) return 'center';
        if (r) return 'right';
        if (l) return 'left';
        return '';
      });
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cell = (tag, text, idx) =>
        `<${tag}${aligns[idx] ? ` style="text-align:${aligns[idx]}"` : ''}>${inline(text, ctx)}</${tag}>`;
      html += '<div class="table-wrap"><table><thead><tr>';
      html += header.map((c, idx) => cell('th', c, idx)).join('');
      html += '</tr></thead><tbody>';
      for (const row of rows) {
        html += '<tr>' + header.map((_, idx) => cell('td', row[idx] ?? '', idx)).join('') + '</tr>';
      }
      html += '</tbody></table></div>';
      continue;
    }

    // 列表
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const items = [];
      while (i < lines.length) {
        const cur = lines[i];
        const ul = cur.match(UL_RE);
        const ol = cur.match(OL_RE);
        if (ul) {
          items.push({ level: Math.floor(ul[1].length / 2), ordered: false, text: ul[3] });
          i++;
        } else if (ol) {
          items.push({ level: Math.floor(ol[1].length / 2), ordered: true, text: ol[3] });
          i++;
        } else if (cur.trim() && items.length && /^\s{2,}\S/.test(cur)) {
          // 续行
          items[items.length - 1].text += ' ' + cur.trim();
          i++;
        } else {
          break;
        }
      }
      html += renderList(items, ctx);
      continue;
    }

    // 段落
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines, i)) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${inline(joinLines(buf), ctx)}</p>`;
  }

  return html;
}

export function renderMarkdown(src = '') {
  const ctx = { headingIds: new Set(), headings: [] };
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
  const html = renderBlocks(lines, ctx);
  return { html, headings: ctx.headings };
}

export function plainText(html = '') {
  return String(html)
    .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 中文按字计、英文按词计，约 350 字/分钟 */
export function readingTime(text = '') {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 350 + words / 220));
}

/** 解析 frontmatter（只支持简单 key: value 与数组） */
export function parseFrontmatter(raw = '') {
  const text = String(raw).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, body: text.trim() };

  const data = {};
  let currentKey = null;

  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(listItem[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const value = kv[2].trim();
      if (!value) {
        data[currentKey] = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        data[currentKey] = value
          .slice(1, -1)
          .split(',')
          .map((v) => unquote(v.trim()))
          .filter(Boolean);
      } else {
        data[currentKey] = unquote(value);
      }
    }
  }

  return { data, body: text.slice(match[0].length).trim() };
}

function unquote(v = '') {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
