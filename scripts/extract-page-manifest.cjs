#!/usr/bin/env node
/**
 * extract-page-manifest.cjs — emit a per-page manifest slice (Phase G.2)
 *
 * Built 2026-05-06 as Phase G.2 of the cost-optimization plan. Per-page
 * sub-agents at Stages 2.5b (Phase G.1's parallel spec-gen), 3 (Build A
 * per-page render), and 7d-build (Option C per-page render) historically
 * read the FULL `jobs/{domain}/manifest.json` (~35KB on a 5-page site,
 * ~80KB on a 14-page site) just to find the one page they're working on.
 *
 * The other N-1 pages of manifest content are pure overhead in their
 * context window. With G.1's parallelization, the input bloat compounded
 * across N parallel calls — total input went up ~N× vs the monolithic
 * pre-G.1 path, undoing G.1's wall-clock win on the cost axis.
 *
 * G.2 fix: orchestrator pre-extracts a per-page slice combining
 *   1. that page's specific data (manifest.pages[index] entry — text,
 *      images, backgroundImages, sections, videos, forms, etc.)
 *   2. global metadata every page needs (business name + identity,
 *      navigation, footer, social, meta, manifest.logo, favicon)
 *
 * Per-page sub-agents read this slim slice (~10KB) instead of the full
 * manifest. Saves ~25KB × N parallel calls of input tokens per build.
 *
 * Usage:
 *   node scripts/extract-page-manifest.cjs <domain> <page-index>
 *
 * Output: JSON to stdout (the per-page slice + globals).
 *
 * Or batch mode — write all pages at once into jobs/{domain}/page-manifests/:
 *   node scripts/extract-page-manifest.cjs <domain> --all
 *
 * Exit codes:
 *   0 — success
 *   1 — bad CLI args / manifest missing / page-index out of range
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const domain = args[0];
if (!domain) {
  console.error('Usage: node scripts/extract-page-manifest.cjs <domain> <page-index>|--all');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const manifestPath = path.join(jobDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pages = manifest.pages || [];

// Globals — fields a per-page sub-agent likely needs for cross-page context
// (e.g., footer text, nav structure, business identity for hero copy).
function buildGlobals(m) {
  return {
    domain: m.domain,
    business: m.business,
    logo: m.logo,
    favicon: m.favicon,
    navigation: m.navigation || (pages[0] && pages[0].navigation) || null,
    footer: m.footer || (pages[0] && pages[0].footer) || null,
    meta: {
      title: m.title || (pages[0] && pages[0].title) || null,
      description: m.description || (pages[0] && pages[0].meta && pages[0].meta.description) || null,
    },
    pageCount: pages.length,
    pageIndex: null,    // filled in below per-page
    pageSlugs: pages.map((p, i) => ({
      index: i,
      url: p.url || p.path || '',
      title: p.title || '',
    })),
  };
}

function slugFromPage(p) {
  const u = p.url || p.path || '';
  // Trim leading/trailing slashes, dot-extension, replace separators with hyphens.
  const cleaned = u.replace(/\.[a-z0-9]+$/i, '').replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return cleaned || 'index';
}

function buildSliceForIndex(idx) {
  if (idx < 0 || idx >= pages.length) {
    console.error(`✗ Page index ${idx} out of range (manifest has ${pages.length} pages)`);
    process.exit(1);
  }
  const globals = buildGlobals(manifest);
  globals.pageIndex = idx;
  return {
    page: pages[idx],
    globals,
  };
}

if (args[1] === '--all') {
  // Batch mode: write to jobs/{domain}/page-manifests/{slug}.json
  const outDir = path.join(jobDir, 'page-manifests');
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (let i = 0; i < pages.length; i++) {
    const slice = buildSliceForIndex(i);
    const slug = slugFromPage(pages[i]);
    const outPath = path.join(outDir, `${slug}.json`);
    fs.writeFileSync(outPath, JSON.stringify(slice, null, 2));
    written.push({ slug, path: path.relative(REPO_ROOT, outPath), bytes: fs.statSync(outPath).size });
  }
  console.log(JSON.stringify({ domain, written }, null, 2));

  // Phase F self-instrumentation
  try {
    const { logDecision } = require('./_log-helper.cjs');
    logDecision(domain, '2.5-pre', 'page-manifests-extracted', {
      count: written.length,
      totalBytes: written.reduce((s, w) => s + w.bytes, 0),
    });
  } catch {}

  process.exit(0);
}

// Single-page mode
const idx = Number(args[1]);
if (!Number.isInteger(idx) || idx < 0) {
  console.error('Usage: node scripts/extract-page-manifest.cjs <domain> <page-index>|--all');
  console.error('  page-index must be a non-negative integer (0-based)');
  process.exit(1);
}
const slice = buildSliceForIndex(idx);
console.log(JSON.stringify(slice, null, 2));
