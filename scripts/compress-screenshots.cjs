#!/usr/bin/env node
/**
 * compress-screenshots.cjs — produce slim JPEG sidecars for vision-using stages (Phase L.1)
 *
 * Built 2026-05-07 as Phase L.1 of the cost-optimization plan. Visual
 * sanity pass sub-agents (Stage 4c-bis, 6c, 7g) and the 4c-tris audit
 * each read 12-24 PNG screenshots at full resolution. Each PNG is
 * typically 100-300 KB, decoded as ~50-100K vision tokens. Across the
 * 4 vision-using stages × ~18 screenshots, vision tokens dominate the
 * Opus visual-pass cost line item.
 *
 * The fix: 1280px-wide JPEG sidecars at quality 75. Same visual signal
 * the 18-item checklist and the dramatic-improvement audit work with;
 * just smaller. Typical reduction: 100-300 KB PNG → 30-60 KB JPEG
 * (~70-80% smaller). Vision token count drops proportionally.
 *
 * Quality risk: none-to-very-low. 1280px is the standard "design review"
 * resolution; JPEG Q75 has no visible artifacts at typical screen DPI.
 * The lossless-PNG signal is preserved on disk so debugging / human
 * review can reach for the original whenever needed.
 *
 * Usage:
 *   node scripts/compress-screenshots.cjs <input-dir>
 *
 *   Walks <input-dir> non-recursively, finds *.png, produces *.jpg
 *   sidecar in the same directory. Idempotent: skips if .jpg is newer
 *   than .png. Writes nothing if no PNGs found (silent no-op).
 *
 * Domain auto-detection: if <input-dir> path matches the WebFactory
 * convention (jobs/{domain}/qa-option-{a|b|c}/ or jobs/{domain}/assets/
 * screenshots/), the script self-instruments to that domain via Phase F.
 *
 * Soft dependency: requires `sips` (macOS native — every Mac has it).
 * On non-macOS systems falls back to a clear error rather than silent
 * non-compression. Cross-platform alternative would add a sharp/jimp
 * dependency; not done today since WebFactory is macOS-pinned.
 *
 * Exit codes:
 *   0 — success (compression done OR no PNGs to compress)
 *   1 — bad CLI args / input dir not found
 *   2 — sips not available (non-macOS or sips broken)
 *   3 — sips invocation failed on at least one file
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAX_WIDTH = Number(process.env.SCREENSHOT_MAX_WIDTH) || 1280;
const JPEG_QUALITY = Number(process.env.SCREENSHOT_JPEG_QUALITY) || 75;

const inputDir = process.argv[2];
if (!inputDir) {
  console.error('Usage: node scripts/compress-screenshots.cjs <input-dir>');
  console.error('  Walks <input-dir> for *.png files and writes *.jpg sidecars at');
  console.error(`  ${MAX_WIDTH}px max width, JPEG quality ${JPEG_QUALITY}.`);
  process.exit(1);
}
if (!fs.existsSync(inputDir)) {
  console.error(`✗ Input directory not found: ${inputDir}`);
  process.exit(1);
}
if (!fs.statSync(inputDir).isDirectory()) {
  console.error(`✗ Not a directory: ${inputDir}`);
  process.exit(1);
}

// Verify sips is available before doing any work.
const sipsCheck = spawnSync('sips', ['--version'], { stdio: 'ignore' });
if (sipsCheck.status !== 0) {
  console.error('✗ `sips` command not available. This script requires macOS.');
  console.error('  WebFactory is currently macOS-pinned; if you need cross-platform,');
  console.error('  add a sharp / jimp dependency and update this script.');
  process.exit(2);
}

const pngs = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.png'));
if (pngs.length === 0) {
  console.log(`✓ ${inputDir}: no PNGs to compress (silent no-op)`);
  process.exit(0);
}

let bytesIn = 0;
let bytesOut = 0;
let compressed = 0;
let skipped = 0;
let errors = 0;

for (const png of pngs) {
  const pngPath = path.join(inputDir, png);
  const jpgPath = path.join(inputDir, png.replace(/\.png$/i, '.jpg'));

  // Idempotent: skip if jpg sidecar is newer than the PNG.
  if (fs.existsSync(jpgPath)) {
    const pngMtime = fs.statSync(pngPath).mtimeMs;
    const jpgMtime = fs.statSync(jpgPath).mtimeMs;
    if (jpgMtime >= pngMtime) {
      skipped++;
      bytesOut += fs.statSync(jpgPath).size;
      bytesIn += fs.statSync(pngPath).size;
      continue;
    }
  }

  const r = spawnSync('sips', [
    '-Z', String(MAX_WIDTH),
    '-s', 'format', 'jpeg',
    '-s', 'formatOptions', String(JPEG_QUALITY),
    pngPath,
    '--out', jpgPath,
  ], { stdio: 'pipe' });

  if (r.status !== 0) {
    console.error(`  ✗ sips failed on ${png}: ${(r.stderr || '').toString().slice(0, 200)}`);
    errors++;
    continue;
  }

  bytesIn += fs.statSync(pngPath).size;
  bytesOut += fs.statSync(jpgPath).size;
  compressed++;
}

const pctSaved = bytesIn > 0 ? Math.round((1 - bytesOut / bytesIn) * 100) : 0;

console.log(
  `✓ ${inputDir}: ${compressed} compressed, ${skipped} skipped (already current), ${errors} errors`
);
console.log(`  ${(bytesIn / 1024).toFixed(0)}KB in → ${(bytesOut / 1024).toFixed(0)}KB out (-${pctSaved}%)`);

// Self-instrumentation: derive domain from path conventions.
//   jobs/{domain}/qa-option-{a|b|c}/    →  domain captured + option captured
//   jobs/{domain}/assets/screenshots/   →  domain captured (option=null)
const m = inputDir.match(/jobs\/([^\/]+)\/(?:qa-option-([abc])|assets\/screenshots)/);
if (m) {
  const [, domain, option] = m;
  try {
    const { logDecision } = require('./_log-helper.cjs');
    logDecision(domain, '4-pre', 'compressed-screenshots', {
      option: option || 'original-site',
      count: compressed + skipped,
      bytesIn,
      bytesOut,
      pctSaved,
    });
  } catch { /* best-effort */ }
}

if (errors > 0) process.exit(3);
process.exit(0);
