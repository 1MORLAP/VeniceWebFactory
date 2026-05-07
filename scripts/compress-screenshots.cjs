#!/usr/bin/env node
/**
 * compress-screenshots.cjs — produce slim JPEG sidecars for vision-using stages (Phase L.1)
 *
 * Built 2026-05-07 as Phase L.1 of the cost-optimization plan. Visual
 * sanity pass sub-agents (Stage 4c-bis, 6c, 7g) and the 4c-tris
 * World-Class Audit each read 12-24 PNG screenshots at full resolution.
 * Each PNG is typically 100-300 KB, decoded as ~50-100K vision tokens.
 * Across the 4 vision-using stages × ~18 screenshots, vision tokens
 * dominate the Opus visual-pass cost line item.
 *
 * The fix: 1280px-wide JPEG sidecars at quality 75. Same visual signal
 * the 18-item checklist and the World-Class Audit work with; just
 * smaller. Typical reduction: 100-300 KB PNG → 30-60 KB JPEG
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
// Phase K-narrow fix 2026-05-07: cap full-page screenshot HEIGHT to avoid
// rejecting at vision-API validation. Venice's per-image dimension cap
// rejects images > ~8K pixels on either axis; full-page screenshots can
// be 25K+ pixels tall. We crop top-anchored (preserve hero + first content
// section + maybe testimonials — i.e. the above-the-fold content that
// matters most for visual sanity pass) instead of central crop (loses
// hero entirely). 4096 captures ~3 mobile viewport heights or ~4 desktop
// viewport heights — enough for the visual judgment without bloating
// vision tokens.
const MAX_HEIGHT = Number(process.env.SCREENSHOT_MAX_HEIGHT) || 4096;
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

  // BUG FIX 2026-05-07 (Phase K-narrow Venice integration): the previous
  // `-Z 1280` flag scaled images to fit within a 1280×1280 BOUNDING BOX,
  // which mangled tall full-page screenshots. A 375×8478 mobile full-page
  // capture became 56×1280 — a thin sliver Venice rejected with
  // "Supplied image did not pass validation checks." The correct flag is
  // `--resampleWidth N` which sets the width to N and scales height
  // proportionally (aspect ratio preserved). Anthropic's vision API
  // tolerated the mangled aspect ratio (returning verdicts on near-empty
  // slivers) so the bug went unnoticed until Venice's stricter validation
  // surfaced it. Production visual passes pre-2026-05-07 were silently
  // running on thin slivers — quality-impacting bug.
  const r = spawnSync('sips', [
    '--resampleWidth', String(MAX_WIDTH),
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

  // Step 2 (Phase K-narrow fix): full-page mobile screenshots can be
  // 28K+ pixels tall after the width-resample. Most vision APIs cap at
  // ~8K pixels per dimension. Crop top-anchored to MAX_HEIGHT if needed
  // — preserves hero + first content section (the highest-signal portion
  // for visual judgment).
  const heightProbe = spawnSync('sips', ['-g', 'pixelHeight', jpgPath], { stdio: 'pipe' });
  const heightMatch = (heightProbe.stdout || '').toString().match(/pixelHeight:\s*(\d+)/);
  const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;
  if (height > MAX_HEIGHT) {
    const tmpPath = jpgPath.replace(/\.jpg$/i, '.tmp.jpg');
    try { fs.renameSync(jpgPath, tmpPath); } catch { /* ignore */ }
    const cropResult = spawnSync('ffmpeg', [
      '-y',
      '-i', tmpPath,
      '-vf', `crop=${MAX_WIDTH}:${MAX_HEIGHT}:0:0`,
      '-q:v', '5',
      jpgPath,
    ], { stdio: 'pipe' });
    if (cropResult.status === 0) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    } else {
      // Fallback: ffmpeg failed → restore the un-cropped tall version (Venice may
      // reject it but at least we don't lose data). Log a warning.
      console.error(`  ⚠ ffmpeg crop failed on ${png} (tall ${height}px → uncropped fallback)`);
      try { fs.renameSync(tmpPath, jpgPath); } catch { /* ignore */ }
    }
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
