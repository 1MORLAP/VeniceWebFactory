#!/usr/bin/env node
/**
 * Mirror the entire Refero Styles catalog into templates/inspiration/refero-styles/.
 *
 * Fetches every DESIGN.md from https://styles.refero.design (Tailwind v4 @theme
 * variant) plus a sibling _index.json with metadata for searchability. Idempotent:
 * re-running overwrites existing files with whatever Refero is currently serving.
 *
 * Usage:
 *   node scripts/fetch-refero-styles.mjs           # fetch everything
 *   node scripts/fetch-refero-styles.mjs --limit 5 # fetch first 5 styles only (smoke test)
 *
 * Concurrency, output dir, and the API base are configurable via env:
 *   REFERO_CONCURRENCY=10  REFERO_OUT_DIR=/some/path  REFERO_API_BASE=https://...
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const API_BASE = process.env.REFERO_API_BASE || 'https://styles.refero.design';
const OUT_DIR = process.env.REFERO_OUT_DIR || path.join(REPO_ROOT, 'templates/inspiration/refero-styles');
const CONCURRENCY = Number(process.env.REFERO_CONCURRENCY) || 10;
const RETRY_LIMIT = 2;
const PAGE_LIMIT = 100; // server caps at 50/page; harmless to ask for 100

const args = process.argv.slice(2);
const limitFlag = args.indexOf('--limit');
const LIMIT = limitFlag >= 0 ? Number(args[limitFlag + 1]) : Infinity;

const decodeEntities = (s) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&'); // last so &amp;#x27; doesn't double-decode

const baseSlug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const urlSuffix = (urlStr) => {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, '');
    const pathSeg = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop();
    return baseSlug(pathSeg ? pathSeg : host.replace(/\.[^.]+$/, ''));
  } catch {
    return '';
  }
};

const enumerateAll = async () => {
  const all = [];
  let page = 1;
  while (true) {
    const url = `${API_BASE}/api/styles?limit=${PAGE_LIMIT}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`enumerate page ${page}: HTTP ${res.status}`);
    const data = await res.json();
    if (!data.styles || data.styles.length === 0) break;
    for (const s of data.styles) all.push(s);
    if (page % 5 === 0) process.stderr.write(`  enumerate page ${page}: total ${all.length}\n`);
    if (!data.nextPage) break;
    page = data.nextPage;
    if (page > 500) throw new Error('safety stop: paged past 500 — API changed?');
  }
  return all;
};

const buildFilenameMap = (all) => {
  const counts = new Map();
  for (const s of all) {
    const k = baseSlug(s.siteName);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const map = new Map();
  const used = new Set();
  for (const s of all) {
    const base = baseSlug(s.siteName);
    let slug = base;
    if (counts.get(base) > 1) {
      const suffix = urlSuffix(s.url);
      slug = suffix ? `${base}-${suffix}` : `${base}-${s.id.slice(0, 6)}`;
      while (used.has(slug)) slug = `${slug}-${s.id.slice(0, 6)}`;
    }
    if (used.has(slug)) slug = `${slug}-${s.id.slice(0, 6)}`;
    used.add(slug);
    map.set(s.id, slug + '.md');
  }
  return map;
};

const fetchOne = async (s, file, dest) => {
  const url = `${API_BASE}/style/${s.id}`;
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (WebFactory; +tomekgroup.com)',
          Accept: 'text/html',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const m = html.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
      if (!m) throw new Error('no <pre><code> block (style page may 404)');
      const md = decodeEntities(m[1]);
      if (md.length < 200) throw new Error(`markdown too short (${md.length} chars)`);
      await fs.writeFile(dest, md);
      return { ok: true, id: s.id, file, bytes: md.length };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_LIMIT) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  return { ok: false, id: s.id, file, error: String(lastErr) };
};

const main = async () => {
  console.error(`Refero Styles mirror → ${OUT_DIR}`);
  console.error(`API: ${API_BASE} | concurrency: ${CONCURRENCY}${LIMIT !== Infinity ? ` | limit: ${LIMIT}` : ''}`);

  console.error('\nEnumerating /api/styles…');
  const all = (await enumerateAll()).slice(0, LIMIT);
  console.error(`Enumerated ${all.length} styles.`);

  const filenames = buildFilenameMap(all);
  await fs.mkdir(OUT_DIR, { recursive: true });

  const results = [];
  let cursor = 0;
  let done = 0;
  const startedAt = Date.now();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < all.length) {
      const idx = cursor++;
      const s = all[idx];
      const file = filenames.get(s.id);
      const dest = path.join(OUT_DIR, file);
      const r = await fetchOne(s, file, dest);
      results.push(r);
      done++;
      if (done % 50 === 0 || done === all.length) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        const okCount = results.filter((x) => x.ok).length;
        process.stderr.write(`  [${elapsed}s] ${done}/${all.length} (ok=${okCount}, fail=${done - okCount})\n`);
      }
    }
  });
  await Promise.all(workers);

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.error(`\nDone. ok=${ok.length} fail=${failed.length}`);
  if (failed.length) {
    console.error('Failures (these IDs will be flagged "missing" in _index.json):');
    for (const f of failed) console.error(`  ${f.id} ${f.file}: ${f.error}`);
  }
  const failedIds = new Set(failed.map((f) => f.id));

  const index = all.map((s) => ({
    id: s.id,
    siteName: s.siteName,
    url: s.url,
    file: filenames.get(s.id),
    colorScheme: s.colorScheme,
    fonts: s.fonts || [],
    colors: s.colors || [],
    northStar: s.northStar || null,
    screenshotUrl: s.screenshotUrl || null,
    thumbnailUrl: s.thumbnailUrl || null,
    iconUrl: s.iconUrl || null,
    previewVideoUrl: s.previewVideoUrl || null,
    createdAt: s.createdAt,
    ...(failedIds.has(s.id) ? { missing: true } : {}),
  }));
  await fs.writeFile(path.join(OUT_DIR, '_index.json'), JSON.stringify(index, null, 2));
  console.error(`Wrote ${index.length} entries to _index.json`);
};

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
