#!/usr/bin/env node
/**
 * 构建产物自检：检查坏链、缺失的标题、重复 id、空链接等常见问题。
 * 用法： node scripts/check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '..', 'dist');

if (!fs.existsSync(DIST)) {
  console.error('没有找到 dist/，请先运行 npm run build');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const problems = [];
let checkedLinks = 0;

for (const file of htmlFiles) {
  const rel = path.relative(DIST, file).split(path.sep).join('/');
  const html = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);

  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`${rel}: 缺少 <title>`);
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) problems.push(`${rel}: <h1> 数量不是 1`);

  // 重复 id
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) problems.push(`${rel}: 重复 id → ${[...new Set(dup)].join(', ')}`);

  // 内部链接
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(url)) continue;
    checkedLinks++;
    const clean = decodeURI(url.split('#')[0].split('?')[0]);
    if (!clean) continue;
    const target = path.resolve(dir, clean);
    if (!target.startsWith(DIST) || !fs.existsSync(target)) {
      problems.push(`${rel}: 链接不存在 → ${url}`);
    }
  }
}

console.log(`\n扫描 ${htmlFiles.length} 个页面，检查 ${checkedLinks} 个站内链接。`);
if (problems.length) {
  console.log(`\n发现 ${problems.length} 个问题：\n`);
  for (const p of problems) console.log('  ✗ ' + p);
  process.exitCode = 1;
} else {
  console.log('✓ 没有发现问题。\n');
}
