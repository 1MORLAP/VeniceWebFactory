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

// CSS-background chrome-filename signals (Phase H, 2026-05-06). Real bug:
// Dreamweaver / GoDaddy / Wix / static-HTML legacy sites have no CMS image
// widget so they place hero / team / banner photos as CSS background-image.
// Naming conventions consistently mark chrome backgrounds with prefix or
// suffix tokens. Content backgrounds use descriptive names (`headertop.jpg`,
// `team.jpg`, `hero1.jpg`) without these tokens.
//
// We extract the SOURCE filename (NOT localPath, which is always bg_NN.jpg
// for backgrounds) to apply this filter. Filters fire on both <img> and CSS
// background records — same chrome-naming convention applies in both.
//
// Real bug 2026-05-06 (lisastephenscpa.com): a 974×348, 145KB JPEG of the
// team in front of an office (`headertop.jpg`) was filed as bg_6.jpg and
// AR=2.8, so the previous flat AR≥1.5 rule classed it as 'banner' and it
// never reached the build's image pool. Three out of three options shipped
// without the team photo despite it being on every page of the original.
function isChromeFilename(srcName) {
  if (!srcName) return false;
  // Suffix tokens at end of filename (no extension).
  if (/[-_](bg|border)$/i.test(srcName)) return true;
  // Embedded chrome words bounded by separator or string edge.
  if (/(^|[-_])(gradient|shadow|backdrop|spacer|divider|separator|stripe|texture|pattern|swatch|hatch)([-_]|$)/i.test(srcName)) return true;
  // Common explicit prefix patterns: body-bg, content-bg, footer-bg, sidebar-bg, sidebar-h3-bg.
  if (/^(body|content|footer|sidebar|nav)[-_].*[-_]bg/i.test(srcName)) return true;
  return false;
}

function srcBasenameLower(rec) {
  const src = String(rec.src || '');
  const m = src.match(/\/([^\/?#]+)\.(jpe?g|png|gif|webp|svg|avif)(\?|#|$)/i);
  return m ? m[1].toLowerCase() : '';
}

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

  // 2.5. Unmeasurable dimensions (Phase H, 2026-05-06). Real bug:
  //      Playwright sometimes fails to measure CSS-background dimensions
  //      for lazy-loaded / off-screen images, leaving width=height=0 in
  //      the manifest. Without dims we can't apply any size-based rule,
  //      so we use FILE SIZE as the sole disambiguator:
  //        • < 5000 bytes → 'tiny' (chrome icon, theme-skin, gradient stub
  //          — e.g. giffins.net default-skin.png at 547 bytes)
  //        • ≥ 5000 bytes → 'content' (real photo, even if dims missing —
  //          e.g. giffins.net hero photos at 85–693 KB with 0×0 dims)
  //      Real photos compressed below 5KB are vanishingly rare in 2026
  //      (hero JPEGs are typically 50–500 KB). Conservative cutoff.
  if (w === 0 && h === 0) {
    if (fileSize > 0 && fileSize < 5000) return 'tiny';
    if (fileSize >= 5000) return 'content';
    return 'tiny';   // defensive default when we have nothing
  }

  // 2a. Chrome by source filename (Phase H, 2026-05-06). The original
  //     site's URL filename is the most reliable signal of intent — a
  //     site author who calls a file "header-bg.jpg" or "gradient.png"
  //     is explicitly marking it as chrome. Fires for both <img> and CSS
  //     background records (legacy `<img class="hero-bg">` patterns exist
  //     too). The bpp escape hatch (≥ 0.30) rescues the rare case of a
  //     real photo named something-bg.jpg.
  const srcName = srcBasenameLower(rec);
  if (srcName && isChromeFilename(srcName) && bytesPerPixel < 0.30) {
    if (/[-_]border\b|[-_]border$/i.test(srcName)) return 'line';
    if (/(^|[-_])(spacer|divider|separator)([-_]|$)/i.test(srcName)) return 'spacer';
    return 'banner';
  }

  // 3. CSS-background extreme aspect → banner, with photo-grade rescue.
  //    Scraper writes CSS background-image sources as bg_*.{jpg,png}.
  //    Wide-aspect (AR≥1.5) bg files are USUALLY chrome (gradient strips,
  //    decorative banners), but legacy static-HTML sites also use them
  //    for content (group team photos, landscape hero shots, storefront
  //    photos — the Dreamweaver / GoDaddy era had no other way to put a
  //    photo in a hero slot). Bytes-per-pixel disambiguates: chrome
  //    compresses to 0.01–0.06 bpp (gradients, solid fills, low entropy);
  //    real photos sit at 0.15–2.0 bpp (high entropy). The 0.15 cutoff
  //    is well below any real-photo territory while still excluding
  //    even rich gradients.
  //
  //    The chrome-filename check above (rule 2a) catches the common case
  //    cleanly, so this rule only fires for backgrounds with NO chrome
  //    filename — which is precisely the lisastephenscpa headertop.jpg
  //    case (974×348, 145KB → 0.43 bpp → content).
  const isCssBackground = rec.type === 'background' || /^bg[_\-]?\d+\./.test(basename);
  if (isCssBackground && ar >= 1.5) {
    if (bytesPerPixel >= 0.15) return 'content';   // photo-grade — keep
    return 'banner';                                // gradient/chrome — drop
  }

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
let totalBackgrounds = 0;
let backgroundContent = 0;

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
        kind: 'img',
      });
    }
  }
  // Phase H (2026-05-06): walk backgroundImages too. CSS-background sources
  // are how Dreamweaver / GoDaddy / Wix legacy static-HTML sites place hero
  // photos, team photos, and other content imagery — they have no CMS image
  // widget, so any photo larger than ~200px lands here. Pre-Phase-H, the
  // classifier ignored this array entirely; downstream image-pool generation
  // filtered for `_class === 'content'` and silently dropped every CSS-
  // background photo regardless of whether it was chrome or content. Real
  // bug surfaced 2026-05-06 (lisastephenscpa.com) — 974×348 team photo
  // missing from all 3 deploys.
  for (const bg of page.backgroundImages || []) {
    // Mark explicitly as background so classifyImage's tiered chrome rule
    // can use the right path. The scraper sets `type: 'background'` already
    // but defensive set in case of older manifests.
    if (!bg.type) bg.type = 'background';
    const cls = classifyImage(bg, jobDir);
    bg._class = cls;
    counts[cls] = (counts[cls] || 0) + 1;
    totalImages++;
    totalBackgrounds++;
    if (cls === 'content') backgroundContent++;
    if (cls !== 'content' && samples[cls] && samples[cls].length < 30) {
      samples[cls].push({
        src: bg.src,
        localPath: bg.localPath,
        w: bg.width,
        h: bg.height,
        fileSize: bg.fileSize,
        alt: bg.alt || '',
        page: page.url || page.path || '',
        kind: 'background',
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
  // Phase H: backgrounds are a separate counted axis so we can audit how
  // often CSS-background photos rescue legitimate content. See header
  // comment + lisastephenscpa.com bug.
  totalBackgrounds,
  backgroundContent,
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

// Phase F self-instrumentation: emit images-classified event regardless of
// whether the orchestrator's prose remembers to do so. Lets audit-orchestration
// see Stage 1d ran even when the orchestrator drops the explicit log call.
const { logDecision } = require('./_log-helper.cjs');
const contentPct = totalImages > 0 ? Math.round((counts.content / totalImages) * 100) : 0;
logDecision(domain, '1d', 'images-classified', {
  total: totalImages,
  content: counts.content,
  contentPct,
  navButton: counts['nav-button'],
  banner: counts.banner,
  line: counts.line,
  spacer: counts.spacer,
  tracking: counts.tracking,
  tiny: counts.tiny,
});

process.exit(0);
