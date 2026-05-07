#!/usr/bin/env node
/**
 * extract-brief-input.cjs — emit a slim manifest for the Stage 2 brief sub-agent (Phase L.2)
 *
 * Built 2026-05-07 as Phase L.2 of the cost-optimization plan. The
 * Stage 2 design-brief sub-agent today reads the FULL manifest.json:
 * 35-80KB on typical 5-page sites, 200KB+ on 14-page sites. Most of
 * that content is duplicate (rawText vs sections), low-signal-for-
 * brief (form fields, scrape metadata), or already-classified-as-
 * chrome imagery the brief author won't cite anyway.
 *
 * The brief author actually needs:
 *   1. Business identity: logo, domain, page titles, key paragraphs
 *   2. Page list with content gist (heading + 1-3 paragraphs each)
 *   3. Footer + social + nav structure (small)
 *   4. Image inventory STATS (counts per class, not full image lists)
 *   5. Visual signal — but that comes from screenshots, NOT manifest
 *
 * Things the brief author does NOT need from the manifest:
 *   - rawText (duplicate of sections content)
 *   - Full sections.lists / sections.links arrays
 *   - Full forms (form fields rarely shape brief direction)
 *   - Per-page scrape metadata (screenshots, timestamps)
 *   - Chrome-class image entries (banner, tracking, spacer, etc.)
 *
 * Companion to extract-brief-essentials.cjs (Phase G.5) which trims
 * the OUTPUT-side brief for downstream per-page workers. L.2 trims
 * the INPUT-side manifest for the Stage 2 brief author itself.
 *
 * Pairs with image-classification.json (Stage 1d output): when present,
 * the slim manifest filters images/backgroundImages to _class === "content"
 * so the brief author isn't shown chrome and gets accurate content
 * inventory counts.
 *
 * Usage:
 *   node scripts/extract-brief-input.cjs <domain>
 *
 * Output: writes jobs/{domain}/brief-input.json + prints summary
 *         (full size, slim size, % saved).
 *
 * Self-instruments via Phase F (`brief-input-extracted` event with
 * fullBytes / slimBytes / pctSaved / pageCount).
 *
 * Exit codes:
 *   0 — success
 *   1 — bad CLI args
 *   2 — manifest.json missing
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/extract-brief-input.cjs <domain>');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const manifestPath = path.join(jobDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Manifest not found: ${manifestPath}`);
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fullSize = fs.statSync(manifestPath).size;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function trimSections(sections) {
  if (!Array.isArray(sections)) return sections;
  return sections.map(s => {
    if (!s || typeof s !== 'object') return s;
    const out = {};
    if (s.type) out.type = s.type;
    if (s.heading) out.heading = s.heading;
    // Keep up to 3 paragraphs per section. The brief author needs the gist,
    // not the verbatim copy. Verbatim text is preserved in the FULL manifest
    // for downstream stages (Phase 2.5b spec author can still read it).
    if (Array.isArray(s.paragraphs) && s.paragraphs.length) {
      out.paragraphs = s.paragraphs.slice(0, 3);
      if (s.paragraphs.length > 3) out._paragraphsTotal = s.paragraphs.length;
    }
    // Drop lists/links arrays — the brief author doesn't itemize them, just
    // notes the page exists. The full lists are in the manifest if needed.
    if (Array.isArray(s.lists) && s.lists.length) out._listsCount = s.lists.length;
    if (Array.isArray(s.links) && s.links.length) out._linksCount = s.links.length;
    return out;
  });
}

function isContentClass(img) {
  // Phase H classifier writes `_class` on every image (foreground OR
  // background). When the classifier hasn't run yet, treat unclassified as
  // content (defensive — the brief author would rather see too many than
  // too few; the spec author at Phase 2.5b filters again with stricter
  // rules). When _class IS set, only `content` and `icon` survive.
  if (!img._class) return true;
  return img._class === 'content' || img._class === 'icon';
}

function trimImageRecord(img) {
  if (!img) return img;
  const out = {};
  if (img.src) out.src = img.src;
  if (img.alt) out.alt = img.alt;
  if (img.width) out.width = img.width;
  if (img.height) out.height = img.height;
  if (img.localPath) out.localPath = img.localPath;
  if (img._class) out._class = img._class;
  return out;
}

function trimPage(p) {
  const out = {
    url: p.url,
    title: p.title,
  };
  if (p.sections) out.sections = trimSections(p.sections);
  // Filter images to content-class only; chrome (banner, line, spacer,
  // tracking, tiny) wastes brief-author attention.
  if (Array.isArray(p.images)) {
    out.images = p.images.filter(isContentClass).map(trimImageRecord);
    const dropped = p.images.length - out.images.length;
    if (dropped > 0) out._imagesChromeFiltered = dropped;
  }
  if (Array.isArray(p.backgroundImages)) {
    out.backgroundImages = p.backgroundImages.filter(isContentClass).map(trimImageRecord);
    const dropped = p.backgroundImages.length - out.backgroundImages.length;
    if (dropped > 0) out._backgroundImagesChromeFiltered = dropped;
  }
  // Videos are usually small + brief author cares about presence + variant.
  if (Array.isArray(p.videos) && p.videos.length) {
    out.videos = p.videos.map(v => ({
      src: v.src,
      _variant: v._variant || null,
    }));
  }
  if (p.videoCta && (p.videoCta.href || p.videoCta._variant)) {
    out.videoCta = {
      href: p.videoCta.href,
      _variant: p.videoCta._variant || null,
    };
  }
  // rawText: keep first 500 chars as a "voice/tone summary". Drops 70-95%
  // of the full rawText size while preserving enough for the brief author
  // to understand the customer's existing copy register.
  if (p.rawText && typeof p.rawText === 'string') {
    out.rawTextSummary = p.rawText.slice(0, 500);
    if (p.rawText.length > 500) out._rawTextLengthFull = p.rawText.length;
  }
  // Forms: brief author only cares that forms exist + their action target.
  if (Array.isArray(p.forms) && p.forms.length) {
    out.forms = p.forms.map(f => ({ action: f.action, fieldCount: (f.fields || []).length }));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Build the slim manifest
// ─────────────────────────────────────────────────────────────────────

const slim = {
  _meta: {
    extractedAt: new Date().toISOString(),
    extractedBy: 'scripts/extract-brief-input.cjs',
    fullManifestPath: 'manifest.json',
    note: 'Slim manifest for the Stage 2 design-brief sub-agent (Phase L.2). The FULL manifest stays on disk; the spec author at Phase 2.5b uses page-manifests/{slug}.json (Phase G.2) for the verbatim copy.',
  },
  domain: manifest.domain,
  url: manifest.url,
  scrapedAt: manifest.scrapedAt,
  totalPages: manifest.totalPages || (manifest.pages || []).length,
  navigation: manifest.navigation,
  footer: manifest.footer,
  meta: manifest.meta,
  favicon: manifest.favicon,
  logo: manifest.logo,
  pages: (manifest.pages || []).map(trimPage),
};

// Image inventory stats (read from image-classification.json if present)
const classificationPath = path.join(jobDir, 'image-classification.json');
if (fs.existsSync(classificationPath)) {
  try {
    const c = JSON.parse(fs.readFileSync(classificationPath, 'utf8'));
    slim.imageStats = {
      totalImages: c.totalImages,
      counts: c.counts,
      contentRatio: c.contentRatio,
      totalBackgrounds: c.totalBackgrounds,
      backgroundContent: c.backgroundContent,
    };
  } catch { /* best-effort */ }
}

// ─────────────────────────────────────────────────────────────────────
// Persist + report
// ─────────────────────────────────────────────────────────────────────

const outPath = path.join(jobDir, 'brief-input.json');
fs.writeFileSync(outPath, JSON.stringify(slim, null, 2));
const slimSize = fs.statSync(outPath).size;
const pctSaved = Math.round((1 - slimSize / fullSize) * 100);

console.log(`✓ Brief input extracted for ${domain}`);
console.log(`  full   ${fullSize.toString().padStart(7)} bytes  (${manifestPath.replace(REPO_ROOT + '/', '')})`);
console.log(`  slim   ${slimSize.toString().padStart(7)} bytes  (${outPath.replace(REPO_ROOT + '/', '')})  -${pctSaved}%`);

// Phase F self-instrumentation
try {
  const { logDecision } = require('./_log-helper.cjs');
  logDecision(domain, '1-post', 'brief-input-extracted', {
    fullBytes: fullSize,
    slimBytes: slimSize,
    pctSaved,
    pageCount: (manifest.pages || []).length,
  });
} catch { /* best-effort */ }

process.exit(0);
