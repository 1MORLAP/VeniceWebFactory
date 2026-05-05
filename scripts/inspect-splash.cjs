#!/usr/bin/env node
/**
 * inspect-splash.js — classify video splash URLs into 4 preservation variants
 *
 * Built 2026-05-05 after the user greenlit Video Preservation. Replaces
 * the lossy VIDEO CTA RULE ("drop the CTA if not a real video") with
 * VIDEO PRESERVATION RULE: every video CTA the customer had on their
 * site flows through to the rebuild in one of 4 forms, classified here.
 *
 * Architecturally identical to `scripts/classify-images.cjs`:
 *   scrape-time probe → structured manifest tag → downstream stages
 *   filter on tag → qa-check verifies post-build → hard gates between.
 *
 * The 4 variants:
 *   A — Direct MP4: `<video><source src="*.mp4">` or `<video src="*.mp4">`.
 *       Action: download + ffmpeg transcode to mobile-optimized H.264 (via
 *       scripts/transcode-video.js). Rendered as a self-hosted <video>.
 *   B — HLS stream: `<video>` source ends in `.m3u8`. Action: ffmpeg remux
 *       to MP4 (or hls.js polyfill if remux fails). Rendered self-hosted.
 *   C — Third-party iframe: YouTube / Vimeo / Brightcove / JW Player /
 *       Vidyard / Wistia. Action: re-embed with proper aspect-ratio
 *       wrapper + lazy loading. NO transcode — let the platform serve.
 *   D — Hibu / Wix / template placeholder: splash page that LOOKS like a
 *       video CTA but has no actual video element. Action: drop the CTA
 *       per the original VIDEO CTA RULE — we will not invent a video the
 *       customer didn't actually have.
 *
 * Usage:
 *   node scripts/inspect-splash.js <splash-url>       # ad-hoc, prints JSON
 *   node scripts/inspect-splash.js --domain <domain>  # scan all CTAs in
 *                                                       manifest, write to
 *                                                       jobs/{domain}/video-classification.json
 *                                                       AND patch manifest
 *                                                       with `_videoCta` tags
 *
 * Output (ad-hoc):
 *   {
 *     "url": "...",
 *     "variant": "A" | "B" | "C" | "D",
 *     "src": "...",                         // direct media URL (A/B) or iframe URL (C)
 *     "platform": "youtube|vimeo|...",      // present only for variant C
 *     "dimensions": { "w": 1920, "h": 1080 },  // present when measurable
 *     "evidence": "what we saw in the DOM",
 *     "duration_seconds": 75                // present when probe-able
 *   }
 *
 * Exit codes:
 *   0 — classification succeeded (any variant including D)
 *   1 — bad CLI args
 *   2 — Playwright navigation/network failure (URL unreachable)
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let url = null;
let domain = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domain' && args[i + 1]) { domain = args[++i]; continue; }
  if (!url && !args[i].startsWith('--')) url = args[i];
}

if (!url && !domain) {
  console.error('Usage: node scripts/inspect-splash.js <url>');
  console.error('   or: node scripts/inspect-splash.js --domain <domain>');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────
// Variant detection.
// ─────────────────────────────────────────────────────────────────────

const PLATFORMS_RE = {
  youtube:    /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i,
  vimeo:      /(?:player\.vimeo\.com|vimeo\.com\/(?:video\/|\d+))/i,
  brightcove: /(?:brightcove\.net|players\.brightcove\.net|bcove\.video)/i,
  jwplayer:   /(?:jwplayer\.com|jwpcdn\.com|cdn\.jwplayer\.com)/i,
  vidyard:    /(?:vidyard\.com|play\.vidyard\.com)/i,
  wistia:     /(?:wistia\.com|wistia\.net|fast\.wistia)/i,
  loom:       /(?:loom\.com)/i,
};

function detectIframePlatform(src) {
  const s = String(src || '').toLowerCase();
  for (const [platform, rx] of Object.entries(PLATFORMS_RE)) {
    if (rx.test(s)) return platform;
  }
  return null;
}

function detectVariantFromVideoSrc(src) {
  if (!src) return null;
  const s = String(src).toLowerCase();
  if (s.endsWith('.m3u8') || s.includes('.m3u8?') || s.includes('/hls/')) return 'B';
  if (s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.mov') || s.includes('.mp4?')) return 'A';
  return null;
}

// Hibu/Wix/template placeholder signal: the page TEXT mentions video but
// no <video> or known-platform <iframe> exists. The CTA is fake.
const PLACEHOLDER_TEXT_RE = /(watch our video|see our video|play our video|click here to watch|view our video|watch the video).*?(coming soon|placeholder|customize|sample|hibu)/i;

async function inspectSplashUrl(targetUrl) {
  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    let navOk = true;
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Give media a moment to load (some sites render <video> after JS).
      await page.waitForTimeout(800);
    } catch (e) {
      navOk = false;
    }

    if (!navOk) {
      return { url: targetUrl, variant: 'D', evidence: 'navigation failed (URL unreachable or timed out)' };
    }

    const probe = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video')).map(v => {
        const sources = Array.from(v.querySelectorAll('source')).map(s => s.src || '');
        return {
          src: v.src || '',
          poster: v.poster || '',
          width: v.videoWidth || v.clientWidth || 0,
          height: v.videoHeight || v.clientHeight || 0,
          duration: Number.isFinite(v.duration) ? Math.round(v.duration) : null,
          sources,
        };
      });
      const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({
        src: f.src || '',
        width: f.width || f.clientWidth || 0,
        height: f.height || f.clientHeight || 0,
      })).filter(f => f.src);
      const bodyText = (document.body?.innerText || '').slice(0, 4000);
      return { videos, iframes, bodyText };
    });

    await browser.close();

    // ─── Variant A: native <video> with .mp4/.webm/.mov source
    for (const v of probe.videos) {
      const variantFromSrc = detectVariantFromVideoSrc(v.src);
      if (variantFromSrc === 'A') {
        return {
          url: targetUrl,
          variant: 'A',
          src: v.src,
          dimensions: { w: v.width || null, h: v.height || null },
          duration_seconds: v.duration,
          evidence: `<video src="${v.src.slice(0, 80)}">`,
        };
      }
      for (const s of v.sources) {
        const variantFromSource = detectVariantFromVideoSrc(s);
        if (variantFromSource === 'A') {
          return {
            url: targetUrl,
            variant: 'A',
            src: s,
            dimensions: { w: v.width || null, h: v.height || null },
            duration_seconds: v.duration,
            evidence: `<video><source src="${s.slice(0, 80)}">`,
          };
        }
      }
    }

    // ─── Variant B: <video> with HLS (.m3u8) source
    for (const v of probe.videos) {
      if (detectVariantFromVideoSrc(v.src) === 'B') {
        return {
          url: targetUrl, variant: 'B',
          src: v.src,
          dimensions: { w: v.width || null, h: v.height || null },
          duration_seconds: v.duration,
          evidence: `<video src="${v.src.slice(0, 80)}">  (HLS)`,
        };
      }
      for (const s of v.sources) {
        if (detectVariantFromVideoSrc(s) === 'B') {
          return {
            url: targetUrl, variant: 'B',
            src: s,
            dimensions: { w: v.width || null, h: v.height || null },
            duration_seconds: v.duration,
            evidence: `<video><source src="${s.slice(0, 80)}">  (HLS)`,
          };
        }
      }
    }

    // ─── Variant C: known-platform iframe
    for (const f of probe.iframes) {
      const platform = detectIframePlatform(f.src);
      if (platform) {
        return {
          url: targetUrl,
          variant: 'C',
          src: f.src,
          platform,
          dimensions: { w: Number(f.width) || 1920, h: Number(f.height) || 1080 },
          evidence: `<iframe src="${f.src.slice(0, 80)}">  (${platform})`,
        };
      }
    }

    // ─── Variant D: placeholder — no real video found
    const evidence = probe.videos.length === 0 && probe.iframes.length === 0
      ? 'no <video> or <iframe> elements present on page'
      : `${probe.videos.length} <video> + ${probe.iframes.length} <iframe>, none with usable video source`;
    const placeholder = PLACEHOLDER_TEXT_RE.test(probe.bodyText);
    return {
      url: targetUrl,
      variant: 'D',
      evidence: placeholder ? `placeholder copy detected; ${evidence}` : evidence,
    };
  } catch (e) {
    if (browser) try { await browser.close(); } catch {}
    return { url: targetUrl, variant: 'D', evidence: `inspection error: ${e.message}` };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Mode A: ad-hoc single-URL inspection.
// ─────────────────────────────────────────────────────────────────────

async function adhoc(u) {
  const result = await inspectSplashUrl(u);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Mode B: domain-wide scan from manifest.json.
// ─────────────────────────────────────────────────────────────────────

async function scanDomain(d) {
  const jobDir = path.join(REPO_ROOT, 'jobs', d);
  const manifestPath = path.join(jobDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`✗ Manifest not found: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Collect every video CTA URL: existing manifest.pages[*].videos[*].src
  // PLUS pages[*].videoCta.href (added by the scraper extension — see
  // scrape.js post-2026-05-05). Dedupe by URL.
  const targets = new Map(); // url → [{page, source}]
  for (const p of manifest.pages || []) {
    for (const v of p.videos || []) {
      if (v.src) {
        const arr = targets.get(v.src) || [];
        arr.push({ page: p.url || p.path || '?', source: 'videos[]' });
        targets.set(v.src, arr);
      }
    }
    if (p.videoCta?.href) {
      const arr = targets.get(p.videoCta.href) || [];
      arr.push({ page: p.url || p.path || '?', source: 'videoCta.href' });
      targets.set(p.videoCta.href, arr);
    }
  }

  if (targets.size === 0) {
    console.log(`✓ No video CTAs found for ${d} — nothing to classify.`);
    process.exit(0);
  }

  console.log(`Scanning ${targets.size} unique video URL${targets.size === 1 ? '' : 's'} for ${d}...`);

  const results = [];
  for (const [u, refs] of targets) {
    process.stdout.write(`  ${u.slice(0, 80)} ... `);
    const r = await inspectSplashUrl(u);
    r.refs = refs;
    results.push(r);
    console.log(r.variant);
  }

  // Patch manifest: every page.videos[].src and page.videoCta.href that
  // matches a result gets a `_variant` tag. Also write a summary report.
  const byUrl = new Map(results.map(r => [r.url, r]));
  for (const p of manifest.pages || []) {
    for (const v of p.videos || []) {
      if (v.src && byUrl.has(v.src)) v._variant = byUrl.get(v.src).variant;
    }
    if (p.videoCta?.href && byUrl.has(p.videoCta.href)) {
      p.videoCta._variant = byUrl.get(p.videoCta.href).variant;
      const r = byUrl.get(p.videoCta.href);
      if (r.platform) p.videoCta._platform = r.platform;
      if (r.src) p.videoCta._mediaSrc = r.src;
      if (r.dimensions) p.videoCta._dimensions = r.dimensions;
      if (r.duration_seconds) p.videoCta._duration = r.duration_seconds;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const reportPath = path.join(jobDir, 'video-classification.json');
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  for (const r of results) counts[r.variant] = (counts[r.variant] || 0) + 1;
  fs.writeFileSync(reportPath, JSON.stringify({
    domain: d,
    classifiedAt: new Date().toISOString(),
    totalUrls: results.length,
    counts,
    results,
  }, null, 2));

  console.log('');
  console.log(`✓ Classified ${results.length} video URL${results.length === 1 ? '' : 's'} for ${d}`);
  for (const k of ['A', 'B', 'C', 'D']) {
    if (counts[k] > 0) console.log(`  Variant ${k}: ${counts[k]}`);
  }
  console.log(`  → ${reportPath}`);
  process.exit(0);
}

// Dispatch.
(async () => {
  if (url) return adhoc(url);
  if (domain) return scanDomain(domain);
})().catch(e => {
  console.error(`✗ ${e.message}`);
  process.exit(2);
});
