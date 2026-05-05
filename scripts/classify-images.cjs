#!/usr/bin/env node
/**
 * classify-images.cjs — tag every scraped image as content vs chrome
 *
 * Built 2026-05-04 after the watkinsmonuments.com fabrication-grade error:
 * the orchestrator's image-pool generator at Stage 2 included scraped
 * 2009-era nav buttons, header banners, and gradient strips alongside real
 * product photos. The Sonnet sub-agents at Stage 3 then rendered ~70 of
 * these chrome graphics in catalog galleries captioned "every photo here
 * is an actual monument we have made" — a fabrication that shipped to
 * production. Real bug filed via watkinsmonuments-com-c.vercel.app/monuments.
 *
 * The structural fix is upstream of image-pool generation: every image
 * gets a classification tag at scrape-time. Image-pool generation MUST
 * filter to `_class === 'content'` before assigning to portfolio /
 * catalog / gallery slots. qa-check verifies post-build that no non-
 * content image rendered in a portfolio context (rule:
 * `portfolio-integrity`).
 *
 * Classifications (chrome family is anything that isn't `content`):
 *   content       — real photograph of customer's work / staff / location
 *   nav-button    — navigation-button graphic (Home/About/Contact tile)
 *   banner        — header/footer/sidebar banner image (often bg_*.jpg)
 *   line          — separator strip / divider line
 *   spacer        — uniform-color tile (blank, gradient stub)
 *   tracking      — analytics beacon (1×1 to 8×8 OR <200 bytes)
 *   tiny          — too small to be content (<3000 pixels)
 *   icon          — small UI glyph, often a logo-derivative thumbnail
 *
 * Only `content` is eligible for portfolio rendering. `icon` may be used
 * for navigation. All other classes are excluded from page image-pools.
 *
 * Usage:
 *   node scripts/classify-images.cjs <domain>
 *
 * Output:
 *   1. Mutates jobs/{domain}/manifest.json — every page.images[i] gets
 *      a `_class` field added.
 *   2. Writes jobs/{domain}/image-classification.json — summary report
 *      with counts per class + top 30 examples per non-content class for
 *      audit/debugging.
 *
 * Exit codes:
 *   0 — success (classifications written)
 *   1 — manifest.json missing or unreadable
 *   2 — bad CLI args
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/classify-images.cjs <domain>');
  process.exit(2);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const manifestPath = path.join(jobDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`✗ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// ─────────────────────────────────────────────────────────────────────
// Heuristic classifier. Priority order matters — first match wins.
// ─────────────────────────────────────────────────────────────────────

const NAV_VOCAB = /\b(home|about us|about|contact|menu|location|email us|email|phone|call us|directions|services|faq|sitemap|search|login|sign in|register|cart)\b/i;
const PLACEHOLDER_VOCAB = /\b(spacer|divider|separator|blank|placeholder|loading|transparent.?bg|filler)\b/i;
const TRACKING_HOSTS = /(google-?analytics|googletagmanager|facebook\.com\/tr|doubleclick|hotjar|mixpanel|segment|mouseflow|fullstory|crazyegg|prnx\.net|stat\.|track\.|pixel\.|beacon\.|metrics\.)/i;

function classifyImage(rec, jobDir) {
  const w = Number(rec.width) || 0;
  const h = Number(rec.height) || 0;
  let fileSize = Number(rec.fileSize) || 0;
  const alt = String(rec.alt || '').toLowerCase().trim();
  const lp  = String(rec.localPath || '').toLowerCase();
  const src = String(rec.src || '').toLowerCase();
  const basename = lp.split('/').pop() || '';

  // Inspect file on disk if manifest didn't record fileSize. The scraper
  // sometimes skips this. File-size-per-pixel is the strongest signal
  // for distinguishing button graphics from real photos at the 100×40
  // size range, so we can't afford to skip it.
  if (!fileSize && rec.localPath && jobDir) {
    try {
      const abs = path.join(jobDir, rec.localPath);
      if (fs.existsSync(abs)) fileSize = fs.statSync(abs).size;
    } catch {}
  }

  const area = w * h;
  const ar = (w > 0 && h > 0) ? Math.max(w / h, h / w) : 0;
  const bytesPerPixel = area > 0 ? fileSize / area : 0;

  // 1. Tracking pixel — analytics beacon. Strongest signal.
  if (TRACKING_HOSTS.test(src)) return 'tracking';
  if (fileSize > 0 && fileSize < 200) return 'tracking';
  if ((w >= 1 && w <= 8) || (h >= 1 && h <= 8)) return 'tracking';

  // 2. Tiny area — anything sub-3000 pixels can't be a content photo.
  //    Some sites show 100×30 native-thumbnail product photos but those
  //    are rare; we'd rather false-negative here than ship 100×30 chrome
  //    as a "marker we have crafted."
  if (area > 0 && area < 3000) return 'tiny';

  // 3. CSS-background extreme aspect → banner. Scraper writes CSS
  //    background-image sources as bg_*.{jpg,png}. When their aspect
  //    is ≥1.5 in either direction, they're nearly always decorative
  //    chrome (gradient strips, banners). Real hero photos rarely
  //    exceed 1.78:1 (16:9).
  if (/^bg[_\-]?\d+\./.test(basename) && ar >= 1.5) return 'banner';

  // 4. Spacer — uniform-color tile. Real photos at 240×209 are 5-30 KB
  //    JPEG (≥0.1 bytes/pixel); uniform-fill tiles are 1-3 KB
  //    (≤0.05 bytes/pixel). Empty alt is a corroborating signal.
  if (area > 0 && fileSize > 0 && bytesPerPixel < 0.04 && !alt) return 'spacer';

  // 5. Placeholder vocab in alt or filename — explicit signal.
  if (PLACEHOLDER_VOCAB.test(alt) || PLACEHOLDER_VOCAB.test(basename)) return 'spacer';

  // 6. Line/strip — height under 30 OR width under 30 (when the other
  //    dimension is normal-sized). Catches 196×13 dividers and 100×8
  //    separator lines.
  if (w > 0 && h > 0 && h < 30 && w >= 30) return 'line';
  if (w > 0 && h > 0 && w < 30 && h >= 30) return 'line';

  // 7. Extreme aspect — banner-like even without bg_ prefix. AR≥3 catches
  //    horizontal banners (e.g., 196×60). AR≤0.33 catches tall sidebars.
  if (ar >= 3) return 'banner';

  // 8. Nav-button by alt vocabulary — the strongest non-dimensional
  //    signal. If the alt says "Home" or "Contact Us", it IS a nav
  //    button regardless of dimensions.
  if (NAV_VOCAB.test(alt)) return 'nav-button';
  if (NAV_VOCAB.test(basename)) return 'nav-button';

  // 9. Nav-button by shape + low entropy. Buttons are 100-220 wide ×
  //    20-60 tall AND have low file-size-per-pixel (gradients + text +
  //    arrow chrome don't compress like photos at this resolution).
  //    REQUIRE bytesPerPixel < 0.3 — without that, a real 100×40
  //    product thumbnail with alt="headstones in arkansas" would be
  //    misclassified as nav-button on shape alone. Real bug 2026-05-04
  //    on watkinsmonuments.com: 100×40 thumbnails of actual gravestones
  //    were initially flagged as nav-button until we tightened to
  //    require the file-size signal AND empty alt.
  //
  //    Real-world byte-per-pixel benchmarks:
  //      • Solid-fill button (gradient + arrow + text): ~0.05–0.25
  //      • Real 100×40 JPEG product thumbnail: ~0.5–1.5
  //      • The 0.3 cutoff sits comfortably between them.
  if (
    w >= 100 && w <= 220 && h >= 20 && h <= 60 &&
    bytesPerPixel > 0 && bytesPerPixel < 0.3 &&
    !alt   // real product thumbnails usually have at least a generic alt
  ) {
    return 'nav-button';
  }

  // 10. Logo-thumbnail — scraper sometimes captures site logos as
  //     small images. <400 wide AND alt/filename mentions "logo".
  if (w > 0 && w < 400 && (/logo/.test(alt) || /logo/.test(basename))) {
    return 'icon';
  }

  // 11. Favicon and other tiny UI glyphs — already weeded out by tiny
  //     filter, but keep an explicit branch for clarity.
  if (/favicon|icon|sprite|emoji|symbol/.test(basename) && area < 20000) {
    return 'icon';
  }

  // 12. Everything else → content. This is the default; we lean toward
  //     false-positive content (a chrome image misclassified as content)
  //     being caught by the post-build qa-check `portfolio-integrity`
  //     rule downstream. False-positive chrome (a real photo
  //     misclassified) is more damaging — it removes legitimate
  //     customer photos from the build.
  return 'content';
}

// ─────────────────────────────────────────────────────────────────────
// Walk manifest, classify, accumulate report.
// ─────────────────────────────────────────────────────────────────────

const counts = {
  content: 0,
  'nav-button': 0,
  banner: 0,
  line: 0,
  spacer: 0,
  tracking: 0,
  tiny: 0,
  icon: 0,
};
const samples = {
  'nav-button': [],
  banner: [],
  line: [],
  spacer: [],
  tracking: [],
  tiny: [],
  icon: [],
};

let totalImages = 0;

for (const page of manifest.pages || []) {
  for (const img of page.images || []) {
    const cls = classifyImage(img, jobDir);
    img._class = cls;
    counts[cls] = (counts[cls] || 0) + 1;
    totalImages++;
    if (cls !== 'content' && samples[cls] && samples[cls].length < 30) {
      samples[cls].push({
        src: img.src,
        localPath: img.localPath,
        w: img.width,
        h: img.height,
        fileSize: img.fileSize,
        alt: img.alt || '',
        page: page.url || page.path || '',
      });
    }
  }
}

// Persist enriched manifest.
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Persist classification report — useful for orchestrator audit + qa-check.
const reportPath = path.join(jobDir, 'image-classification.json');
const report = {
  domain,
  classifiedAt: new Date().toISOString(),
  totalImages,
  counts,
  contentRatio: totalImages > 0 ? (counts.content / totalImages).toFixed(2) : null,
  samples,
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// Console summary.
console.log(`✓ Classified ${totalImages} images for ${domain}`);
for (const k of Object.keys(counts)) {
  const n = counts[k];
  if (n > 0) {
    const pct = ((n / totalImages) * 100).toFixed(0);
    console.log(`  ${k.padEnd(12)} ${String(n).padStart(4)}  (${pct}%)`);
  }
}
console.log(`  → ${reportPath}`);

if (counts.content === 0 && totalImages > 0) {
  console.error(`⚠ No content-class images found — every image was filtered as chrome.`);
  console.error(`  Builds will have empty image pools. Inspect ${reportPath}.`);
}

process.exit(0);
