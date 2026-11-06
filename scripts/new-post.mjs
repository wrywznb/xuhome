#!/usr/bin/env node
/**
 * 新建一篇文章
 * 用法： npm run new -- "文章标题"
 *        npm run new -- "文章标题" --slug my-post
 *        node scripts/new-post.mjs "文章标题"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');

const args = process.argv.slice(2);

// 支持 --slug my-post 指定网址
let customSlug = '';
const slugFlag = args.indexOf('--slug');
if (slugFlag !== -1) {
  customSlug = (args[slugFlag + 1] || '').replace(/[^a-zA-Z0-9-]/g, '');
  args.splice(slugFlag, 2);
}

const title = args.join(' ').trim();

if (!title) {
  console.log('\n用法： npm run new -- "文章标题" [--slug my-post]\n');
  process.exit(1);
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

// 从标题里提取一个安全的英文 slug，中文标题则退回时间戳
const ascii = title
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .slice(0, 48);

const slug = customSlug || ascii || `post-${date.replace(/-/g, '')}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const fileName = `${date}-${slug}.md`;
const filePath = path.join(POSTS_DIR, fileName);

if (fs.existsSync(filePath)) {
  console.error(`\n文件已存在：${fileName}\n`);
  process.exit(1);
}

const template = `---
title: ${title}
date: ${date}
tags: [随笔]
summary: 一句话摘要，会显示在列表页和 RSS 里。
draft: false
---

在这里开始写正文。

## 第一个小标题

写完记得把 frontmatter 里的 \`summary\` 改成真正的摘要。
`;

fs.mkdirSync(POSTS_DIR, { recursive: true });
fs.writeFileSync(filePath, template, 'utf8');

console.log(`
✓ 已创建：content/posts/${fileName}

  下一步：
    1. 编辑这个文件，写完正文
    2. npm run dev      本地预览
    3. npm run build    构建到 dist/
`);
