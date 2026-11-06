#!/usr/bin/env node
/**
 * 本地预览服务器 + 写作后台
 * - 静态预览：http://localhost:4173
 * - 写作后台：http://localhost:4173/admin  （只在 127.0.0.1 可访问）
 * 修改 content/theme/public 会自动重新构建。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, renderMarkdown } from './markdown.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(ROOT, 'dist');
const ADMIN_DIR = path.join(ROOT, 'admin');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const IMAGE_DIR = path.join(ROOT, 'public', 'images');
const PORT = Number(process.env.PORT || 4173);

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
};

/* ------------------------------------------------------------------ 构建 */

let queue = Promise.resolve();
let lastBuildEnd = 0;

function rebuild() {
  queue = queue.then(
    () =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [path.join(HERE, 'build.mjs')], {
          cwd: ROOT,
          stdio: 'inherit',
        });
        child.on('close', (code) => {
          if (code !== 0) console.error(`\n构建失败（退出码 ${code}），请检查上面的报错。\n`);
          lastBuildEnd = Date.now();
          resolve();
        });
        child.on('error', (err) => {
          console.error('无法启动构建进程：', err.message);
          lastBuildEnd = Date.now();
          resolve();
        });
      })
  );
  return queue;
}

/* ------------------------------------------------------------------ 工具 */

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function sendFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}

function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) {
        reject(new Error('内容太大'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function safeSlug(slug) {
  const s = String(slug || '').trim();
  return /^[A-Za-z0-9\u4e00-\u9fa5_-]{1,120}$/.test(s) ? s : '';
}

function postFile(slug) {
  const s = safeSlug(slug);
  if (!s) return null;
  const file = path.join(POSTS_DIR, `${s}.md`);
  return file.startsWith(POSTS_DIR + path.sep) ? file : null;
}

function generateSlug(title, date) {
  const ascii = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  if (ascii) return ascii;
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `post-${String(date).replace(/-/g, '')}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(
    now.getSeconds()
  )}`;
}

function yamlValue(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function serializePost(post) {
  const lines = ['---', `title: ${yamlValue(post.title)}`, `date: ${post.date}`];
  if (post.tags.length) lines.push(`tags: [${post.tags.map(yamlValue).join(', ')}]`);
  if (post.summary) lines.push(`summary: ${yamlValue(post.summary)}`);
  if (post.draft) lines.push('draft: true');
  lines.push('---', '', String(post.content || '').replace(/\s+$/, ''), '');
  return lines.join('\n');
}

function listPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const { data } = parseFrontmatter(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
      const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
      return {
        slug,
        title: data.title || slug,
        date: data.date || '',
        tags,
        draft: data.draft === true || data.draft === 'true' || data.draft === 'yes',
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
}

/* ------------------------------------------------------------------ API */

async function handleApi(req, res, urlPath, query) {
  if (!isLocal(req)) {
    sendJson(res, 403, { error: '写作后台只允许在本机访问' });
    return;
  }

  try {
    if (urlPath === '/api/posts' && req.method === 'GET') {
      sendJson(res, 200, { posts: listPosts() });
      return;
    }

    if (urlPath === '/api/post' && req.method === 'GET') {
      const file = postFile(query.get('slug'));
      if (!file || !fs.existsSync(file)) {
        sendJson(res, 404, { error: '找不到这篇文章' });
        return;
      }
      const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
      sendJson(res, 200, {
        slug: path.basename(file, '.md'),
        title: data.title || '',
        date: data.date || '',
        tags,
        summary: data.summary || '',
        draft: data.draft === true || data.draft === 'true' || data.draft === 'yes',
        content: body,
      });
      return;
    }

    if (urlPath === '/api/post' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)) || '{}');
      const title = String(payload.title || '').trim();
      const date = String(payload.date || '').trim();

      if (!title) {
        sendJson(res, 400, { error: '标题不能为空' });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        sendJson(res, 400, { error: '日期格式应为 YYYY-MM-DD' });
        return;
      }

      const slug = safeSlug(payload.slug) || generateSlug(title, date);
      const file = postFile(slug);
      if (!file) {
        sendJson(res, 400, { error: '网址只能用中文、字母、数字、下划线和短横线' });
        return;
      }

      const post = {
        title,
        date,
        tags: (Array.isArray(payload.tags) ? payload.tags : String(payload.tags || '').split(/[,，]/))
          .map((t) => String(t).trim())
          .filter(Boolean),
        summary: String(payload.summary || '').trim(),
        draft: !!payload.draft,
        content: String(payload.content || ''),
      };

      fs.mkdirSync(POSTS_DIR, { recursive: true });
      fs.writeFileSync(file, serializePost(post), 'utf8');

      const original = safeSlug(payload.originalSlug);
      if (original && original !== slug) {
        const oldFile = postFile(original);
        if (oldFile && fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }

      await rebuild();
      sendJson(res, 200, { ok: true, slug });
      return;
    }

    if (urlPath === '/api/post' && req.method === 'DELETE') {
      const file = postFile(query.get('slug'));
      if (!file || !fs.existsSync(file)) {
        sendJson(res, 404, { error: '找不到这篇文章' });
        return;
      }
      fs.unlinkSync(file);
      await rebuild();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (urlPath === '/api/preview' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req)) || '{}');
      const { html } = renderMarkdown(String(payload.markdown || ''));
      sendJson(res, 200, { html });
      return;
    }

    if (urlPath === '/api/upload' && req.method === 'POST') {
      const payload = JSON.parse((await readBody(req, 12 * 1024 * 1024)) || '{}');
      const match = /^data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(
        String(payload.data || '')
      );
      if (!match) {
        sendJson(res, 400, { error: '只支持 png / jpg / gif / webp / svg 图片' });
        return;
      }

      const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
      const ext = extMap[match[1]] || 'png';
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 8 * 1024 * 1024) {
        sendJson(res, 400, { error: '图片不能超过 8MB' });
        return;
      }

      const base =
        String(payload.name || '')
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 32) || 'image';

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
        now.getHours()
      )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `${stamp}-${base}.${ext}`;

      fs.mkdirSync(IMAGE_DIR, { recursive: true });
      fs.writeFileSync(path.join(IMAGE_DIR, filename), buffer);

      // 同时写进 dist，预览立刻能看到，不用等重建
      if (fs.existsSync(DIST)) {
        const distImages = path.join(DIST, 'images');
        fs.mkdirSync(distImages, { recursive: true });
        fs.copyFileSync(path.join(IMAGE_DIR, filename), path.join(distImages, filename));
      }

      const url = `/images/${filename}`;
      sendJson(res, 200, { ok: true, url, markdown: `![${base}](${url})` });
      return;
    }

    sendJson(res, 404, { error: '未知接口' });
  } catch (err) {
    sendJson(res, 500, { error: err.message || '服务器错误' });
  }
}

/* ------------------------------------------------------------------ 页面 */

function serveAdmin(req, res, urlPath) {
  if (!isLocal(req)) {
    sendText(res, 403, '写作后台只允许在本机访问');
    return;
  }

  if (urlPath === '/admin') {
    res.writeHead(302, { Location: '/admin/' });
    res.end();
    return;
  }

  const relPath = urlPath.replace(/^\/admin\/?/, '') || 'index.html';
  const file = path.join(ADMIN_DIR, relPath);

  if (!file.startsWith(ADMIN_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    sendText(res, 404, 'Not Found');
    return;
  }

  if (path.basename(file) === 'index.html') {
    const html = fs
      .readFileSync(file, 'utf8')
      .replace(/__SITE_TITLE__/g, String(config.title || '博客').replace(/</g, '&lt;'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(html);
    return;
  }

  sendFile(res, file);
}

function serveDist(req, res, urlPath) {
  let filePath = path.join(DIST, urlPath);

  if (!filePath.startsWith(DIST)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html');
  if (!fs.existsSync(filePath) && fs.existsSync(`${filePath}.html`)) filePath = `${filePath}.html`;

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  const notFound = path.join(DIST, '404.html');
  res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : '404 Not Found');
}

/* ------------------------------------------------------------------ 启动 */

async function main() {
  await rebuild();

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let urlPath = parsed.pathname;
    try {
      urlPath = decodeURIComponent(urlPath);
    } catch (e) {
      /* 保留原样 */
    }

    if (urlPath === '/api' || urlPath.startsWith('/api/')) {
      handleApi(req, res, urlPath, parsed.searchParams);
      return;
    }
    if (urlPath === '/admin' || urlPath.startsWith('/admin/')) {
      serveAdmin(req, res, urlPath);
      return;
    }
    serveDist(req, res, urlPath);
  });

  server.listen(PORT, () => {
    console.log(`\n  博客预览： http://localhost:${PORT}`);
    console.log(`  写作后台： http://localhost:${PORT}/admin   （仅本机可访问）`);
    console.log(`\n  监听中… 修改内容会自动重建，刷新浏览器即可。\n`);
  });

  const dirs = ['content', 'theme', 'public'];
  let timer = null;
  for (const dir of dirs) {
    const target = path.join(ROOT, dir);
    if (!fs.existsSync(target)) continue;
    fs.watch(target, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // 后台保存后已主动构建过，跳过这次文件事件，避免重复构建
        if (Date.now() - lastBuildEnd < 600) return;
        rebuild();
      }, 180);
    });
  }
  fs.watch(path.join(ROOT, 'site.config.json'), () => {
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(), 180);
  });
}

main();
