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
 * Cheap corner-colour sampling that does NOT require a PNG decoder. We use
 * Playwright (which we already depend on for scraping) to render the file
 * and read the four corner pixels via canvas.
 *
 * Returns { hasTransparency, backgroundColor } where backgroundColor is a
 * hex string if all four corners agree, otherwise null.
 */
async function inspectImageWithBrowser(absPath) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    return { hasTransparency: null, backgroundColor: null, error: 'playwright not installed' };
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const fileUrl = 'file://' + absPath;
    const result = await page.evaluate(async (url) => {
      return new Promise((res) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Sample the four corners (and centre as control)
          const points = [
            [0, 0], [c.width - 1, 0],
            [0, c.height - 1], [c.width - 1, c.height - 1],
            [Math.floor(c.width / 2), Math.floor(c.height / 2)],
          ];
          const samples = points.map(([x, y]) => {
            const d = ctx.getImageData(x, y, 1, 1).data;
            return { r: d[0], g: d[1], b: d[2], a: d[3] };
          });

          // Check if any pixel has alpha < 255 (transparency)
          // Sample a small grid of pixels to be confident
          let anyTransparent = false;
          const step = Math.max(1, Math.floor(Math.min(c.width, c.height) / 20));
          for (let y = 0; y < c.height; y += step) {
            for (let x = 0; x < c.width; x += step) {
              const d = ctx.getImageData(x, y, 1, 1).data;
              if (d[3] < 250) { anyTransparent = true; break; }
            }
            if (anyTransparent) break;
          }

          res({ samples, anyTransparent, width: c.width, height: c.height });
        };
        img.onerror = (e) => res({ error: 'image load failed', message: String(e) });
        img.src = url;
      });
    }, fileUrl);

    if (result.error) {
      return { hasTransparency: null, backgroundColor: null, error: result.error };
    }

    const corners = result.samples.slice(0, 4);
    const allAgree = corners.every((c) => {
      return Math.abs(c.r - corners[0].r) < 5 &&
             Math.abs(c.g - corners[0].g) < 5 &&
             Math.abs(c.b - corners[0].b) < 5;
    });

    let backgroundColor = null;
    if (!result.anyTransparent && allAgree) {
      const c = corners[0];
      backgroundColor = '#' + [c.r, c.g, c.b].map((n) => n.toString(16).padStart(2, '0')).join('');
    }

    return {
      hasTransparency: result.anyTransparent,
      backgroundColor,
      cornersAgree: allAgree,
      cornerSamples: corners,
      width: result.width,
      height: result.height,
    };
  } finally {
    await browser.close();
  }
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

  // Generate fetch URLs from ALL candidates, deduplicated
  const fetchUrls = new Set();
  for (const c of candidates) {
    for (const u of generateCandidateUrls(c.src)) fetchUrls.add(u);
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
  console.log(`\nFetching ${fetchUrls.size} variant URLs...`);
  const downloaded = [];

  for (const url of fetchUrls) {
    if (isHardBlocklistedHost(url)) {
      console.log(`  ✗ ${url} — REJECTED (hostname on hard blocklist; likely third-party hosting/CMS branding, not the customer's logo)`);
      continue;
    }
    const offDomain = isOffDomain(url, domain);
    const buf = await tryFetch(url);
    if (!buf) {
      console.log(`  ✗ ${url} — fetch failed`);
      continue;
    }

    let entry = { url, buf, format: 'unknown', width: 0, height: 0, hasAlphaChannel: false, offDomain };

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
    console.log(`  → ${url} — ${entry.format} ${entry.width}x${entry.height} ${entry.hasAlphaChannel ? '[alpha channel]' : '[opaque]'}${offDomainTag}`);
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
  function score(entry) {
    let s = 0;
    if (entry.format === 'svg') s += 10000;
    if (entry.hasAlphaChannel) s += 5000;
    s += Math.min(entry.width, 5000); // cap so 99999 (svg) doesn't overflow
    if (entry.offDomain) s -= 8000;
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
    cornerSamples: inspection.cornerSamples || null,
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  // Loud summary for the operator
  console.log(`\n${'='.repeat(60)}`);
  console.log(`LOGO READY for ${domain}`);
  console.log(`  File:           ${finalLocal} (${best.format})`);
  console.log(`  Has transparency: ${manifest.logo.hasTransparency ? 'YES — place anywhere' : 'NO'}`);
  if (!manifest.logo.hasTransparency && manifest.logo.backgroundColor) {
    console.log(`  Background:     ${manifest.logo.backgroundColor}`);
    console.log(`  → Nav background MUST match this colour, OR find a transparent variant`);
  } else if (!manifest.logo.hasTransparency) {
    console.log(`  Background:     unknown (corners disagree). Manual review recommended.`);
  }
  console.log(`${'='.repeat(60)}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
