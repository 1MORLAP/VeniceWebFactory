#!/usr/bin/env node
/**
 * validate-image-pool.cjs — pre-Stage-3-dispatch hard gate for chrome contamination
 *
 * Built 2026-05-04 as a complement to the qa-check `portfolio-integrity`
 * rule. portfolio-integrity catches chrome leaks at QA time (after Stage 4),
 * by which point the Sonnet sub-agents have already wasted compute
 * rendering chrome. This gate catches the leak at Stage 2.5c (BEFORE Stage 3
 * dispatch) by inspecting `jobs/{domain}/specs/_image-pools.json` for any
 * non-content-class image assigned to a portfolio / catalog / gallery slot.
 *
 * The orchestrator's Stage 2/2.5 image-pool generator MUST filter
 * `_class === 'content'` per the PORTFOLIO INTEGRITY RULE. This script
 * verifies they did.
 *
 * Naming convention: portfolio-class slot keys are case-insensitively
 * matched against:
 *   productPhotos | gallery | portfolio | catalog | recentWork |
 *   ourWork | shopWork | examples | beforeAfter | actualWork
 *
 * Pool slot keys for non-portfolio purposes (e.g., `heroImages`, `aboutPhoto`,
 * `serviceCards`, `iconography`) are NOT checked — those have their own
 * curation considerations and may legitimately use icon-class images.
 *
 * Usage:
 *   node scripts/validate-image-pool.cjs <domain>
 *
 * Exit codes:
 *   0 — pool clean (no chrome in portfolio slots)
 *   1 — image-classification.json missing (run classify-images.cjs first)
 *   2 — chrome leak detected; report listed; orchestrator must re-curate
 *
 * Soft-skip: if `_image-pools.json` doesn't exist, exit 0 with a warning —
 * the orchestrator may use a different naming convention or inline pool
 * generation. The qa-check `portfolio-integrity` rule is the safety net
 * for that case.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/validate-image-pool.cjs <domain>');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const poolPath = path.join(jobDir, 'specs', '_image-pools.json');
const manifestPath = path.join(jobDir, 'manifest.json');
const classifyPath = path.join(jobDir, 'image-classification.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Missing manifest: ${manifestPath}`);
  process.exit(1);
}
if (!fs.existsSync(classifyPath)) {
  console.error(`✗ Missing classification: ${classifyPath}`);
  console.error('  Run scripts/classify-images.cjs <domain> first (Stage 1d).');
  process.exit(1);
}
if (!fs.existsSync(poolPath)) {
  console.warn(`⚠ ${poolPath} not found — skipping pool validation.`);
  console.warn('  Pre-dispatch chrome filtering is recommended but not enforceable here.');
  console.warn('  The qa-check `portfolio-integrity` rule is the post-build safety net.');
  process.exit(0);
}

// Build basename → _class map from the manifest (already enriched by classify-images.cjs).
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const classByBasename = new Map();
for (const p of manifest.pages || []) {
  for (const img of p.images || []) {
    if (img.localPath && img._class) {
      const bn = img.localPath.split('/').pop();
      if (bn && !classByBasename.has(bn)) classByBasename.set(bn, img._class);
    }
  }
}

if (classByBasename.size === 0) {
  console.error('✗ Manifest has no _class tags on images. Re-run scripts/classify-images.cjs first.');
  process.exit(1);
}

// Slot key vocabulary — case-insensitive, plus underscore/dash/camelCase
// variants. NOTE: NO `\b` anchors — slot keys are typically camelCase
// (`portfolioGrid`, `galleryStrip`, `productPhotos`) which don't have
// word boundaries between the keyword and the suffix. Substring match
// on the lowercased slot key.
const PORTFOLIO_SLOT_RE = /(product[-_]?photos?|gallery|portfolio|catalog|recent[-_]?work|our[-_]?work|shop[-_]?work|examples?|before[-_]?after|actual[-_]?work|crafted[-_]?by[-_]?us|made[-_]?by[-_]?us|work[-_]?samples?)/i;

const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8'));

const violations = [];
for (const [pageKey, pageEntry] of Object.entries(pool)) {
  if (!pageEntry || typeof pageEntry !== 'object') continue;
  for (const [slotKey, slotValue] of Object.entries(pageEntry)) {
    if (!PORTFOLIO_SLOT_RE.test(slotKey)) continue;
    if (!Array.isArray(slotValue)) continue;
    for (const entry of slotValue) {
      // Pool entries may be objects ({src, w, h, alt}) or strings ("img_5.jpg").
      let src = '';
      if (typeof entry === 'string') src = entry;
      else if (entry && typeof entry === 'object') src = entry.src || entry.localPath || entry.path || '';
      if (!src) continue;
      const basename = src.split('/').pop().split('?')[0];
      const cls = classByBasename.get(basename);
      if (cls && cls !== 'content' && cls !== 'icon') {
        violations.push({ page: pageKey, slot: slotKey, basename, class: cls });
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ Image pool clean for ${domain} — every portfolio slot contains content-class images only.`);

  // Phase F self-instrumentation
  const { logDecision } = require('./_log-helper.cjs');
  logDecision(domain, '2.5c', 'validate-image-pool-pass', { mode: 'clean' });

  process.exit(0);
}

console.error('═══════════════════════════════════════════════════════════════════════');
console.error(`  ✗ STAGE 2.5c GATE FAILED — ${violations.length} chrome image(s) in portfolio slots`);
console.error('═══════════════════════════════════════════════════════════════════════');
console.error('');
console.error(`Image pool: ${poolPath}`);
console.error('');

// Group violations by class for a tighter report.
const byClass = {};
for (const v of violations) {
  byClass[v.class] = byClass[v.class] || [];
  byClass[v.class].push(v);
}
for (const [cls, vs] of Object.entries(byClass).sort((a, b) => b[1].length - a[1].length)) {
  console.error(`### ${vs.length}× ${cls}-class images leaked into portfolio slots:`);
  for (const v of vs.slice(0, 8)) {
    console.error(`  • ${v.page}.${v.slot} → ${v.basename}`);
  }
  if (vs.length > 8) console.error(`  • ... and ${vs.length - 8} more`);
  console.error('');
}

console.error('Resolution: re-curate the portfolio slots in _image-pools.json — only images');
console.error('with `_class === "content"` (per manifest tags written by classify-images.cjs)');
console.error('belong in productPhotos / gallery / portfolio / catalog slots.');
console.error('');
console.error('See PORTFOLIO INTEGRITY RULE in SKILL.md.');
process.exit(2);
