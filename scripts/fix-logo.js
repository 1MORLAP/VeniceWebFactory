#!/usr/bin/env node
/**
 * fix-logo.js — Post-scrape helper that finds the best site logo variant,
 * detects whether it has a transparent or opaque background, and writes
 * background metadata so downstream builds can place it without color clash.
 *
 * Why we do this:
 *   1. WordPress rewrites the logo <img src> to favicon crops like
 *      `cropped-3-24x8.png` (literally 24×8 pixels). The browser CSS-resizes
 *      it to the intended size, but the file on disk is a blurry blob.
 *   2. Even with a high-res file, customer logos often have an OPAQUE
 *      coloured background (e.g. solid navy rectangle). Placing such a logo
 *      on a different-coloured nav produces visible colour mismatch.
 *      (Real bug: sspowerwashing.com 2026-04-24.)
 *
 * Strategy (in order):
 *   1. Catalog all logo candidates from the homepage manifest entry.
 *   2. Hunt for transparent / SVG / variant URLs and download them.
 *      Score by: transparency > resolution > "logo"-named.
 *   3. Pick the best variant, write it to the local logo path.
 *   4. Detect alpha-channel transparency in the chosen file.
 *   5. If opaque: sample the four corners. If they agree, that's the
 *      logo's intended background colour.
 *   6. Write everything to manifest.logo for downstream builds:
 *        { src, localPath, width, height, hasTransparency, backgroundColor }
 *
 * Usage: node scripts/fix-logo.js <domain>
 */

import { readFile, writeFile, stat, open } from 'fs/promises';
import { join, resolve, dirname, basename, extname } from 'path';
import { spawnSync } from 'child_process';

// ---------- PNG / image inspection ----------

async function readBuf(path, n = 64) {
  const fd = await open(path, 'r');
  try {
    const buf = Buffer.alloc(n);
    await fd.read(buf, 0, n, 0);
    return buf;
  } finally {
    await fd.close();
  }
}

function isPng(buf) {
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function isSvg(buf) {
  // SVG starts with <?xml ... or <svg ...>; lower case fragment present in first 256 bytes
  const head = buf.slice(0, Math.min(buf.length, 256)).toString('utf8').toLowerCase();
  return head.includes('<svg');
}

function pngDimensions(buf) {
  // PNG IHDR chunk: width @ offset 16, height @ offset 20 (big-endian uint32)
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25], // 0=gray, 2=rgb, 3=palette, 4=gray+alpha, 6=rgb+alpha
  };
}

// ---------- Candidate URL generation ----------

function generateCandidateUrls(originalUrl) {
  const candidates = new Set();
  candidates.add(originalUrl);

  // Strip -WxH suffix (WordPress resize variant)
  const noSize = originalUrl.replace(/-\d+x\d+(\.[a-z0-9]+)$/i, '$1');
  if (noSize !== originalUrl) candidates.add(noSize);

  // Strip "cropped-" prefix (WP customizer site icon prefix)
  const noCropped = noSize.replace(/\/cropped-/i, '/');
  if (noCropped !== noSize) candidates.add(noCropped);

  // Try SVG sibling (highest preference if it exists)
  for (const base of [originalUrl, noSize, noCropped]) {
    candidates.add(base.replace(/\.[a-z0-9]+$/i, '.svg'));
  }

  // Try common transparent / variant filename patterns
  for (const base of [noSize, noCropped]) {
    const stem = base.replace(/\.[a-z0-9]+$/i, '');
    const ext = base.match(/\.[a-z0-9]+$/i)?.[0] || '.png';
    for (const suffix of ['-transparent', '-trans', '-tp', '-alpha', '-white', '-light', '-dark', '-color']) {
      candidates.add(stem + suffix + ext);
      candidates.add(stem + suffix + '.svg');
      candidates.add(stem + suffix + '.png');
    }
  }

  return Array.from(candidates);
}

// ---------- Placeholder detection ----------

/**
 * Returns true if the URL or filename looks like a CMS-platform placeholder
 * (Hibu, Wix, Squarespace, GoDaddy, etc.) — the "your logo here" default
 * served when the customer didn't upload their own.
 */
function looksLikePlaceholderLogo(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  const patterns = [
    /\bgen-logo\b/,
    /\bgenerated-logo\b/,
    /\bplaceholder\b/,
    /\bdefault-logo\b/,
    /\btemplate-logo\b/,
    /\blogo-placeholder\b/,
    /\blogo-default\b/,
    /\byour-logo-here\b/,
    /\bdefault-image\b/,
    /\bdefault-site-icon\b/,
    /\bwix-default\b/,
    /\bgodaddy-default\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

// ---------- Off-domain hostname rejection (added 2026-04-30 — cherokee bug) ----------
//
// Real bug 2026-04-30 (cherokeecarpetcleaning.com): the variant-hunter scored
// an Arvixe HOSTING-COMPANY logo at 5213 (highest of any candidate) and
// silently overwrote the customer's real logo with the Arvixe brand mark.
// Variant-hunt had no domain-scope filter — any URL that pattern-matched as a
// "logo" was a candidate, including third-party hosting/CDN/analytics badges.
//
// Two-tier defense:
//   (1) Hard blocklist — known hosting / CMS / web-design vendors that ship
//       branding in their default templates, footer badges, or admin panels.
//       Always reject these regardless of URL pattern.
//   (2) Off-domain warn — for any URL whose hostname doesn't match the
//       customer's domain AND isn't on the recognized-CDN allowlist, log a
//       warning. We don't auto-reject (customers legitimately use S3,
//       CloudFront, Cloudinary, Wix-static, etc.), but a flag in the variant
//       table makes the operator review the chosen logo's origin.
//
// The blocklist is conservative — only obvious "this is the hosting company,
// not the customer" hosts. Add more hosts as new false-positives surface.

// Hard-blocklist hostnames. Any logo URL whose hostname (or parent host)
// matches any of these is REJECTED outright with no scoring.
const HOST_HARD_BLOCKLIST = [
  'arvixe.com',                   // Arvixe hosting (cherokee bug)
  'hibu.com',                     // Hibu CMS (template branding)
  'godaddy.com',                  // GoDaddy default site logos
  'godaddy-cdn.com',              // GoDaddy CDN paths for default assets
  'googleusercontent.com',        // Generic Google hosting; usually ad / analytics badges in this context
  'www.w3.org',                   // W3C "valid HTML" badges
  'validator.w3.org',
  'jigsaw.w3.org',                // CSS validator badge
  'sealserver.trustwave.com',     // Trustwave seal
  'siteseal.godaddy.com',         // GoDaddy SSL siteseal
  'click.linksynergy.com',
  'badge.fluencer.com',
  'cdn.networksolutions.com',     // Network Solutions hosting
  // Auction / affiliate / payment-processor BADGE platforms (added 2026-05-01,
  // mckeecoins.com bug). The customer's real logo (cover.jpg) returned
  // 0 bytes; the variant-hunter then scored a Proxibid bidding banner
  // (alt="Proxibid - Live Internet Bidding") highest because it was the
  // only successfully-fetched candidate. These are third-party affiliate
  // badges, never the customer's own brand mark.
  'proxibid.com',                 // Live auction bidding (mckee bug)
  'liveauctioneers.com',
  'icollector.com',
  'invaluable.com',
  'verify.authorize.net',         // Authorize.Net merchant seal
  'verify.geotrust.com',
  'seal.networksolutions.com',
  'kitco.com',                    // Precious-metals price ticker badges
  'ws.amazon-adsystem.com',
  'ir-na.amazon-adsystem.com',
  's.yelp.com',                   // Yelp review badges
];

// Recognized-CDN allowlist. URLs on these hosts get NO warning even if
// hostname doesn't match customer domain — they're legit places to host
// real customer assets.
const HOST_CDN_ALLOWLIST = [
  's3.amazonaws.com',
  's3.us-east-1.amazonaws.com',
  's3.us-east-2.amazonaws.com',
  's3.us-west-1.amazonaws.com',
  's3.us-west-2.amazonaws.com',
  'cloudfront.net',
  'cloudinary.com',
  'imgix.net',
  'akamai.net',
  'akamaihd.net',
  'fastly.net',
  'cdn.shopify.com',
  'shopifycdn.com',
  'wixstatic.com',                // Wix CDN — customer-uploaded assets
  'squarespace-cdn.com',
  'static1.squarespace.com',
  'static.wixstatic.com',
  'images.squarespace-cdn.com',
  'res.cloudinary.com',
  'cdn.duda.co',
  'irp.cdn-website.com',          // Duda CDN
  'lirp.cdn-website.com',         // Duda CDN
];

function hostnameOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

function rootDomain(host) {
  if (!host) return null;
  // Trim www. and take the last 2 dot-separated parts (good enough for .com,
  // .net, .org, .co.uk gets handled imperfectly but that's OK for the
  // "is this off-domain" comparison).
  const cleaned = host.replace(/^www\./, '');
  const parts = cleaned.split('.');
  if (parts.length <= 2) return cleaned;
  return parts.slice(-2).join('.');
}

function isHardBlocklistedHost(url) {
  const h = hostnameOf(url);
  if (!h) return false;
  for (const blocked of HOST_HARD_BLOCKLIST) {
    if (h === blocked || h.endsWith('.' + blocked)) return true;
  }
  return false;
}

function isOffDomain(url, customerDomain) {
  const h = hostnameOf(url);
  if (!h) return false;
  if (!customerDomain) return false;
  const customer = rootDomain(customerDomain.toLowerCase().replace(/^www\./, ''));
  const candidate = rootDomain(h);
  if (candidate === customer) return false;
  for (const allowed of HOST_CDN_ALLOWLIST) {
    if (h === allowed || h.endsWith('.' + allowed)) return false;
  }
  return true;
}

// Affiliate-badge alt-text / filename heuristic (added 2026-05-01 — mckee bug).
// Catches third-party affiliate / verification / payment-processor badges
// whose host isn't in HOST_HARD_BLOCKLIST (because we can't enumerate every
// possible badge platform). Soft penalty in the score function — these CAN
// still win as last resort if nothing better exists.
const AFFILIATE_BADGE_PATTERNS = [
  // Auction / bidding platforms
  /\bproxibid\b/i,
  /\bbid(?:ding)?\b/i,
  /\blive[- ]auction\b/i,
  /\bicollector\b/i,
  /\binvaluable\b/i,
  // Payment / verification seals
  /\bauthorize\.?net\b/i,
  /\bsecure\s+(?:payments?|trading)\b/i,
  /\bverified\b/i,
  /\btrust(?:wave|seal)\b/i,
  /\bnortonsecured\b/i,
  /\bmcafee\s+secure\b/i,
  /\bgeotrust\b/i,
  // Affiliate / partner badges
  /\baffiliate\b/i,
  /\bpartner[- ]?(?:logo|badge)\b/i,
  /\bpowered[- ]by\b/i,
  // Review / rating badges (covered partially by main classifier but defensive)
  /\byelp\b/i,
  /\btrustpilot\b/i,
  /\bbbb\b/i,
];

function looksLikeAffiliateBadge(url, alt) {
  const haystack = `${alt || ''} ${url || ''}`;
  for (const re of AFFILIATE_BADGE_PATTERNS) {
    if (re.test(haystack)) return true;
  }
  return false;
}

// ---------- Favicon fallback ----------

/**
 * Try common favicon URLs for the domain. Returns the best favicon found
 * (square or near-square, ≥ 64px wide, NOT itself a placeholder), or null.
 */
async function tryFetchFavicon(domain) {
  const base = `https://${domain.replace(/^www\./, '')}`;
  const candidates = [
    `${base}/apple-touch-icon-180x180.png`,
    `${base}/apple-touch-icon.png`,
    `${base}/favicon-512x512.png`,
    `${base}/favicon-192x192.png`,
    `${base}/favicon-96x96.png`,
    `${base}/favicon-32x32.png`,
    `${base}/site-icon.png`,
    `${base}/icon.png`,
    `${base}/favicon.ico`,
  ];

  console.log(`\nFavicon fallback — trying ${candidates.length} URLs...`);
  let best = null;
  for (const url of candidates) {
    if (looksLikePlaceholderLogo(url)) {
      console.log(`  ✗ ${url} — looks like placeholder pattern`);
      continue;
    }
    const buf = await tryFetch(url);
    if (!buf) {
      console.log(`  ✗ ${url} — fetch failed`);
      continue;
    }
    let width = 0, height = 0, format = 'other', hasAlpha = false;
    if (isPng(buf)) {
      const d = pngDimensions(buf);
      width = d.width; height = d.height; format = 'png';
      hasAlpha = pngHasTransparencyHint(buf);
    } else if (isSvg(buf)) {
      format = 'svg';
      width = 99999; height = 99999;
      hasAlpha = true;
    } else if (url.endsWith('.ico')) {
      format = 'ico';
      // .ico is hard to parse without a decoder; assume usable if buffer is non-trivial
      width = buf.length > 500 ? 64 : 0;
      height = width;
    }
    console.log(`  → ${url} — ${format} ${width}x${height} ${hasAlpha ? '[alpha]' : '[opaque]'}`);

    // Reject if too small
    if (width < 64) continue;

    // Prefer larger + transparent + non-ICO
    const score = (format === 'svg' ? 10000 : 0) + (hasAlpha ? 5000 : 0) + (format === 'ico' ? -1000 : 0) + Math.min(width, 1000);
    if (!best || score > best.score) {
      best = { url, buf, format, width, height, hasAlpha, score };
    }
  }
  return best;
}

// ---------- Network ----------

async function tryFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 WebFactory-LogoFix' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Reject empty / near-empty responses (added 2026-05-01 — mckee bug).
    // mckeecoins.com's cover.jpg returned 0 bytes (the file was on the
    // server but empty). The variant-hunter previously accepted it as a
    // successful fetch and the unusable record then lost out only because
    // a third-party Proxibid badge happened to be smaller, so the badge
    // won. Reject anything under 100 bytes — no real logo file is that
    // small, regardless of format.
    if (buf.length < 100) return null;
    return buf;
  } catch {
    return null;
  }
}

// ---------- Transparency + background detection ----------

/**
 * Returns true if the PNG buffer has an alpha channel AND that channel
 * actually contains transparency (not all 255). Returns false for opaque
 * or non-PNG files. Conservative — uses a tiny pure-JS check via colour
 * type byte; full pixel scan would need a PNG decoder dependency.
 */
function pngHasTransparencyHint(buf) {
  if (!isPng(buf)) return false;
  const colorType = buf[25];
  // 4 = grayscale + alpha, 6 = RGB + alpha. Means alpha channel exists.
  // (We can't confirm transparency without decoding pixels, but absence of
  //  alpha channel = definitely opaque.)
  return colorType === 4 || colorType === 6;
}

/**
 * Corner-colour sampling using ffmpeg (no browser dependency).
 *
 * 2026-05-07 rewrite: previous version used Playwright (`new Image()` +
 * canvas getImageData). That had a silent failure mode — `file://` URLs
 * with `img.crossOrigin = 'anonymous'` get treated as cross-origin in
 * Chromium without proper CORS headers from a file server, causing
 * `image load failed` on every customer. The bug went undetected because
 * the function returns `{ hasTransparency: null, backgroundColor: null,
 * error: ... }` and the caller wrote nulls to manifest without warning.
 * Result: manifest.logo.backgroundColor was null on EVERY customer in
 * the library, deprived qa-check.js of the data it needed to enforce
 * LOGO RULE Layer B, and bugs like rebeccabosscpa.com (cream-on-navy)
 * shipped to production.
 *
 * This rewrite uses ffmpeg (already a soft-dep for video transcoding)
 * to extract corner pixels directly. No browser. No CORS. Works on every
 * raster format ffmpeg understands (PNG, JPEG, WebP, GIF, BMP).
 *
 * Returns:
 *   { hasTransparency, backgroundColor, backgroundColorConfidence,
 *     cornersAgree, cornersAgreeLoose, cornerSamples, width, height }
 *   OR
 *   { hasTransparency: null, backgroundColor: null, error: '<reason>' }
 */
async function inspectImageWithFfmpeg(absPath) {
  // Probe dimensions via ffprobe (also bundled with ffmpeg)
  let probe;
  try {
    probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,pix_fmt',
      '-of', 'json',
      absPath,
    ], { encoding: 'utf8' });
  } catch (e) {
    return { hasTransparency: null, backgroundColor: null, error: `ffprobe spawn failed: ${e.message}` };
  }
  if (probe.status !== 0) {
    return { hasTransparency: null, backgroundColor: null, error: `ffprobe error: ${(probe.stderr || '').toString().slice(0, 200)}` };
  }
  let width, height, pix_fmt;
  try {
    const j = JSON.parse(probe.stdout);
    width = j.streams[0].width;
    height = j.streams[0].height;
    pix_fmt = j.streams[0].pix_fmt;
  } catch (e) {
    return { hasTransparency: null, backgroundColor: null, error: `ffprobe parse failed: ${e.message}` };
  }

  // Sample one pixel at (x, y) via ffmpeg crop + raw rgba output
  function samplePixel(x, y) {
    const r = spawnSync('ffmpeg', [
      '-loglevel', 'error',
      '-i', absPath,
      '-vf', `crop=1:1:${Math.max(0, Math.min(width - 1, x))}:${Math.max(0, Math.min(height - 1, y))}`,
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-y',
      '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (r.status !== 0 || !r.stdout || r.stdout.length < 4) {
      return null;
    }
    return { r: r.stdout[0], g: r.stdout[1], b: r.stdout[2], a: r.stdout[3] };
  }

  // Sample 4 corners
  const corners = [
    samplePixel(0, 0),
    samplePixel(width - 1, 0),
    samplePixel(0, height - 1),
    samplePixel(width - 1, height - 1),
  ];
  if (corners.some(c => c === null)) {
    return { hasTransparency: null, backgroundColor: null, error: `ffmpeg pixel sampling failed (one or more corners returned null)` };
  }

  // Check transparency by sampling a 5x5 grid + corners
  let anyTransparent = corners.some(c => c.a < 250);
  if (!anyTransparent) {
    const stepX = Math.max(1, Math.floor(width / 5));
    const stepY = Math.max(1, Math.floor(height / 5));
    for (let y = 0; y < height && !anyTransparent; y += stepY) {
      for (let x = 0; x < width && !anyTransparent; x += stepX) {
        const p = samplePixel(x, y);
        if (p && p.a < 250) anyTransparent = true;
      }
    }
  }

  // Threshold checks (matching qa-check.js's hardened 15-unit threshold)
  const allAgreeStrict = corners.every(c =>
    Math.abs(c.r - corners[0].r) < 5 &&
    Math.abs(c.g - corners[0].g) < 5 &&
    Math.abs(c.b - corners[0].b) < 5
  );
  const allAgreeLoose = corners.every(c =>
    Math.abs(c.r - corners[0].r) < 15 &&
    Math.abs(c.g - corners[0].g) < 15 &&
    Math.abs(c.b - corners[0].b) < 15
  );

  let backgroundColor = null;
  let backgroundColorConfidence = null;
  if (!anyTransparent && allAgreeStrict) {
    const c = corners[0];
    backgroundColor = '#' + [c.r, c.g, c.b].map(n => n.toString(16).padStart(2, '0')).join('');
    backgroundColorConfidence = 'high';
  } else if (!anyTransparent && allAgreeLoose) {
    const c = corners[0];
    backgroundColor = '#' + [c.r, c.g, c.b].map(n => n.toString(16).padStart(2, '0')).join('');
    backgroundColorConfidence = 'low (corners disagreed by 5-15 RGB units)';
  }

  // Compute the logo's DOMINANT PAINTED COLOR — mean RGB of pixels with
  // alpha > 200 (opaque enough to count). For a white-on-transparent logo
  // (designed for dark backgrounds), this resolves to ~white. For a
  // dark-on-transparent logo (designed for light backgrounds), this
  // resolves to ~dark. qa-check.js uses this value vs the effective
  // composited bg behind the rendered logo to compute WCAG contrast and
  // flag light-on-light / dark-on-dark failures (LOGO RULE 4.4, real
  // bug 2026-05-07: rebeccabosscpa.com — white logo on cream chip,
  // visually invisible).
  let dominantPaintedColor = null;
  try {
    const fullDump = spawnSync('ffmpeg', [
      '-loglevel', 'error',
      '-i', absPath,
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-y', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 200 * 1024 * 1024 });
    if (fullDump.status === 0 && fullDump.stdout && fullDump.stdout.length === width * height * 4) {
      const buf = fullDump.stdout;
      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      for (let i = 0; i < buf.length; i += 4) {
        const a = buf[i + 3];
        if (a > 200) {
          totalR += buf[i];
          totalG += buf[i + 1];
          totalB += buf[i + 2];
          count++;
        }
      }
      if (count > 0) {
        const r = Math.round(totalR / count);
        const g = Math.round(totalG / count);
        const b = Math.round(totalB / count);
        const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
        dominantPaintedColor = {
          r, g, b, hex,
          opaquePixelCount: count,
          totalPixelCount: width * height,
          opaqueRatio: count / (width * height),
        };
      }
    }
  } catch (e) {
    // Best-effort — leave dominantPaintedColor null and let qa-check
    // fall through to its own canvas-based mean-color computation.
  }

  return {
    hasTransparency: anyTransparent,
    backgroundColor,
    backgroundColorConfidence,
    cornersAgree: allAgreeStrict,
    cornersAgreeLoose: allAgreeLoose,
    cornerSamples: corners,
    dominantPaintedColor,
    width,
    height,
    pix_fmt,
  };
}

// Backward-compat alias — old name still in use elsewhere, points at new impl.
async function inspectImageWithBrowser(absPath) {
  return inspectImageWithFfmpeg(absPath);
}

// ---------- Main ----------

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error('Usage: node scripts/fix-logo.js <domain>');
    process.exit(1);
  }

  const jobDir = resolve(process.cwd(), 'jobs', domain);
  const manifestPath = join(jobDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  const homepage = manifest.pages.find((p) => p.url === '/') || manifest.pages[0];
  if (!homepage) {
    console.log('No homepage found. Nothing to do.');
    return;
  }

  // Catalog ALL logo candidates from the homepage (don't pick the first match)
  const allImgs = homepage.images || [];
  const rawCandidates = allImgs.filter((i) =>
    /logo|cropped|brand/i.test(i.src + ' ' + (i.alt || ''))
  );
  if (rawCandidates.length === 0 && allImgs.length > 0) rawCandidates.push(allImgs[0]);

  if (rawCandidates.length === 0) {
    console.log('No logo candidate found on homepage.');
    console.log('Trying favicon fallback...');
    const fav = await tryFetchFavicon(domain);
    if (fav) {
      const localFavPath = `assets/img/favicon-as-logo.${fav.format === 'svg' ? 'svg' : 'png'}`;
      await writeFile(join(jobDir, localFavPath), fav.buf);
      manifest.logo = {
        src: fav.url,
        localPath: localFavPath,
        width: fav.width >= 99999 ? null : fav.width,
        height: fav.height >= 99999 ? null : fav.height,
        format: fav.format,
        hasTransparency: fav.hasAlpha,
        backgroundColor: null,
        source: 'favicon-fallback',
        warning: 'Used favicon as logo (no real logo found in manifest). Recommend customer provide a high-res logo file.',
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`✓ Used favicon as logo: ${fav.url}`);
    } else {
      manifest.logo = { source: 'none', warning: 'No logo and no usable favicon. Use plain-text business name in nav.' };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('✗ No logo and no usable favicon. Build will fall back to plain-text business name.');
    }
    return;
  }

  console.log(`Logo candidates from manifest (${rawCandidates.length}):`);
  for (const c of rawCandidates) {
    const isPlaceholder = looksLikePlaceholderLogo(c.src);
    console.log(`  • ${c.src} ${isPlaceholder ? '[PLACEHOLDER — will reject]' : ''}`);
  }

  // Filter out platform-default placeholders
  const candidates = rawCandidates.filter((c) => !looksLikePlaceholderLogo(c.src));

  if (candidates.length === 0) {
    console.log('\n⚠ All logo candidates look like CMS-platform placeholders (gen-logo, default-logo, etc.).');
    console.log('Trying favicon fallback...');
    const fav = await tryFetchFavicon(domain);
    if (fav) {
      const localFavPath = `assets/img/favicon-as-logo.${fav.format === 'svg' ? 'svg' : 'png'}`;
      await writeFile(join(jobDir, localFavPath), fav.buf);
      manifest.logo = {
        src: fav.url,
        localPath: localFavPath,
        width: fav.width >= 99999 ? null : fav.width,
        height: fav.height >= 99999 ? null : fav.height,
        format: fav.format,
        hasTransparency: fav.hasAlpha,
        backgroundColor: null,
        source: 'favicon-fallback-after-placeholder',
        warning: `Original logo URL (${rawCandidates[0].src}) detected as a CMS placeholder. Used favicon as substitute. Recommend customer provide a high-res logo file.`,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`✓ Used favicon as logo: ${fav.url}`);
    } else {
      manifest.logo = {
        source: 'none-after-placeholder',
        warning: `Original logo URL is a CMS placeholder (${rawCandidates[0].src}); no usable favicon either. Build MUST fall back to plain-text business name in nav.`,
      };
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('✗ Placeholder logo + no favicon. Build will fall back to plain-text business name.');
    }
    return;
  }

  // Use the first candidate as the canonical local file destination
  const primary = candidates[0];
  const localPath = join(jobDir, primary.localPath);

  // Generate fetch URLs from ALL candidates, deduplicated.
  // Track the alt text of the source candidate per URL so the affiliate-
  // badge heuristic can run during the fetch loop without losing context.
  const fetchUrls = new Set();
  const urlToAlt = new Map();   // url → alt text from the source candidate
  for (const c of candidates) {
    for (const u of generateCandidateUrls(c.src)) {
      fetchUrls.add(u);
      // Keep the FIRST alt seen for a given variant URL (candidates sorted
      // by their position in the manifest; the more-canonical entry wins).
      if (!urlToAlt.has(u)) urlToAlt.set(u, c.alt || '');
    }
  }

  // Fetch each candidate and score it.
  //
  // Off-domain filter (added 2026-04-30, cherokeecarpetcleaning.com bug):
  // before fetching, drop any URL whose hostname is on the hard blocklist
  // (Arvixe, Hibu, GoDaddy, etc.). For URLs that are off the customer's
  // domain but on the recognized-CDN allowlist (S3, Cloudfront, Wixstatic,
  // etc.), proceed silently. For URLs that are off-domain AND not on the
  // CDN allowlist, fetch + score but mark as off-domain in the log so the
  // operator can review.
  //
  // Affiliate-badge soft penalty (added 2026-05-01, mckeecoins.com bug):
  // ALT text or filename matches like "Proxibid", "bidding", "verified",
  // "authorize.net", "powered by" trigger a soft -6000 score penalty —
  // these CAN still win as last resort if literally nothing else exists,
  // but a real customer logo will outscore them. Pairs with the
  // HOST_HARD_BLOCKLIST entries for proxibid.com / liveauctioneers.com /
  // authorize.net seal etc. — host-blocklist catches the obvious cases,
  // alt/src pattern catches the long tail.
  console.log(`\nFetching ${fetchUrls.size} variant URLs...`);
  const downloaded = [];

  for (const url of fetchUrls) {
    if (isHardBlocklistedHost(url)) {
      console.log(`  ✗ ${url} — REJECTED (hostname on hard blocklist; likely third-party hosting/CMS branding, not the customer's logo)`);
      continue;
    }
    const offDomain = isOffDomain(url, domain);
    const alt = urlToAlt.get(url) || '';
    const affiliateBadge = looksLikeAffiliateBadge(url, alt);
    const buf = await tryFetch(url);
    if (!buf) {
      console.log(`  ✗ ${url} — fetch failed (or empty/sub-100-byte response)`);
      continue;
    }

    let entry = { url, alt, buf, format: 'unknown', width: 0, height: 0, hasAlphaChannel: false, offDomain, affiliateBadge };

    if (isSvg(buf)) {
      entry.format = 'svg';
      entry.hasAlphaChannel = true; // SVG is inherently scalable + transparent
      // SVG width is harder to extract; mark as ∞
      entry.width = 99999;
      entry.height = 99999;
    } else if (isPng(buf)) {
      entry.format = 'png';
      const dims = pngDimensions(buf);
      entry.width = dims.width;
      entry.height = dims.height;
      entry.hasAlphaChannel = pngHasTransparencyHint(buf);
    } else {
      entry.format = 'other';
      // Could be JPEG (always opaque) — skip detailed dim parsing here
    }

    downloaded.push(entry);
    const offDomainTag = offDomain ? ' [off-domain — manual review recommended]' : '';
    const affiliateTag = affiliateBadge ? ` [affiliate-badge: alt="${alt}" — soft-deprioritized]` : '';
    console.log(`  → ${url} — ${entry.format} ${entry.width}x${entry.height} ${entry.hasAlphaChannel ? '[alpha channel]' : '[opaque]'}${offDomainTag}${affiliateTag}`);
  }

  if (downloaded.length === 0) {
    console.log('\n✗ No fetchable logo variants. Manifest will keep the original local file.');
    manifest.logo = {
      src: primary.src,
      localPath: primary.localPath,
      width: 0,
      height: 0,
      warning: 'unfetchable',
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    return;
  }

  // Score each downloaded variant. Higher is better.
  // Priority: SVG > transparent PNG > opaque PNG. Within format, larger > smaller.
  // Off-domain candidates take a -8000 penalty (so a same-domain opaque PNG
  // beats an off-domain transparent PNG with similar resolution; the operator
  // can override by manually adjusting the manifest if a CDN-hosted variant
  // is genuinely the right choice). The penalty stacks on top of the hard
  // blocklist (arvixe etc. never reach scoring at all).
  // Affiliate-badge candidates (alt-text or filename match like "Proxibid",
  // "bidding", "verified", "authorize.net") take a -6000 penalty — softer
  // than off-domain because the heuristic has false-positive risk (an
  // auction house's actual logo might legitimately mention "auctioneer"),
  // but enough that a real customer logo with similar quality always wins.
  // Real bug 2026-05-01 (mckeecoins.com): cover.jpg returned 0 bytes (now
  // rejected by tryFetch's <100-byte filter); the variant-hunter then
  // scored a Proxibid bidding banner highest. Both filters together prevent
  // the bidding-banner-as-logo failure mode.
  function score(entry) {
    let s = 0;
    if (entry.format === 'svg') s += 10000;
    if (entry.hasAlphaChannel) s += 5000;
    s += Math.min(entry.width, 5000); // cap so 99999 (svg) doesn't overflow
    if (entry.offDomain) s -= 8000;
    if (entry.affiliateBadge) s -= 6000;
    return s;
  }

  downloaded.sort((a, b) => score(b) - score(a));
  const best = downloaded[0];
  console.log(`\n✓ Best variant: ${best.url} (score ${score(best)})`);

  // Write the best variant to the local logo path. If it's SVG, change extension.
  let finalLocal = primary.localPath;
  if (best.format === 'svg' && extname(finalLocal).toLowerCase() !== '.svg') {
    finalLocal = finalLocal.replace(/\.[a-z0-9]+$/i, '.svg');
  }
  const finalAbs = join(jobDir, finalLocal);
  await writeFile(finalAbs, best.buf);
  console.log(`  Wrote ${best.buf.length} bytes to ${finalLocal}`);

  // Inspect the chosen file with a real browser to detect transparency + sample corners
  console.log(`\nInspecting final logo file for transparency + background colour...`);
  let inspection = { hasTransparency: best.hasAlphaChannel, backgroundColor: null };
  if (best.format !== 'svg') {
    inspection = await inspectImageWithBrowser(finalAbs);
    console.log(`  hasTransparency: ${inspection.hasTransparency}`);
    console.log(`  cornersAgree: ${inspection.cornersAgree}`);
    if (inspection.backgroundColor) {
      console.log(`  backgroundColor (sampled from corners): ${inspection.backgroundColor}`);
    } else if (inspection.cornersAgree === false) {
      console.log(`  Corners disagree — logo has variable/photographic background. No single colour to match.`);
    }
  } else {
    console.log(`  SVG — assumed transparent and infinitely scalable.`);
  }

  // Final manifest entry for the logo
  manifest.logo = {
    src: best.url,
    localPath: finalLocal,
    width: best.width >= 99999 ? null : best.width,
    height: best.height >= 99999 ? null : best.height,
    format: best.format,
    hasTransparency: inspection.hasTransparency === true || best.format === 'svg',
    backgroundColor: inspection.backgroundColor || null,
    backgroundColorConfidence: inspection.backgroundColorConfidence || null,
    cornerSamples: inspection.cornerSamples || null,
    cornersAgree: inspection.cornersAgree ?? null,
    cornersAgreeLoose: inspection.cornersAgreeLoose ?? null,
    dominantPaintedColor: inspection.dominantPaintedColor || null,    // LOGO RULE 4.4 (added 2026-05-07)
    inspectionError: inspection.error || null,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // Loud summary for the operator
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOGO READY for ${domain}`);
  console.log(`  File:           ${finalLocal} (${best.format})`);
  console.log(`  Has transparency: ${manifest.logo.hasTransparency ? 'YES — place anywhere' : 'NO'}`);
  if (!manifest.logo.hasTransparency && manifest.logo.backgroundColor) {
    const conf = manifest.logo.backgroundColorConfidence ? ` [${manifest.logo.backgroundColorConfidence}]` : '';
    console.log(`  Background:     ${manifest.logo.backgroundColor}${conf}`);
    console.log(`  → Nav background MUST match this colour, OR find a transparent variant`);
  } else if (!manifest.logo.hasTransparency && manifest.logo.cornerSamples) {
    console.log(`  Background:     unknown (corners disagree even at loose threshold).`);
    console.log(`  Corner samples: ${JSON.stringify(manifest.logo.cornerSamples)}`);
    console.log(`  → Manual review recommended. qa-check.js will FAIL the build if logo bg can't be verified.`);
  } else if (!manifest.logo.hasTransparency) {
    console.log(`  Background:     unknown (browser inspection failed: ${manifest.logo.inspectionError || 'no error recorded'}).`);
    console.log(`  → qa-check.js will FAIL the build at deploy time. Either find a transparent logo variant OR resolve the browser-inspection error.`);
  }
  console.log(`${'='.repeat(60)}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
