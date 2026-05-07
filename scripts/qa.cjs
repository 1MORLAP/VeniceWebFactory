#!/usr/bin/env node
/**
 * WebFactory QA Script — Headless Visual QA
 *
 * Takes screenshots at FOUR viewports (mobile-first ordering), checks
 * console errors, failed network requests, and broken images. Runs entirely
 * headless (no visible browser window).
 *
 * Viewports (mobile FIRST in scan order — primary conversion target for SMB
 * customers; the existing mobile-first design rule is unchanged):
 *
 *   mobile       390 × 844    iPhone 14 — base CSS, no Tailwind prefix.
 *                             Sticky-CTA, hamburger, 44px taps, body ≥16px,
 *                             no horizontal overflow. DEPLOY-BLOCKER.
 *   ipad         1024 × 1366  iPad portrait — at md/lg Tailwind breakpoint
 *                             boundary. Catches hamburger logic that breaks
 *                             at 1024, cards that squish at the lg trigger,
 *                             nav clipping. Added 2026-05-07 as Phase O.
 *   desktop      1440 × 900   Standard desktop — hero feels intentional,
 *                             content respects max-width caps. DEPLOY-BLOCKER.
 *   desktop-wide 1920 × 1080  FHD monitors / decision-maker viewing. Catches
 *                             hero photo lost in side gutters, max-width
 *                             container too tight for the viewport, type
 *                             scale that looks cramped at FHD. Added
 *                             2026-05-07 as Phase O.
 *
 * Mobile + desktop are deploy-blockers (FAIL). iPad + desktop-wide are
 * coverage upgrades — same rules run, same severity tags emerge per the
 * rule's natural severity. After 5-10 builds we measure false-positive
 * rate and tune (see Phase O notes in SKILL.md MOBILE-FIRST DESIGN rule).
 *
 * Usage:
 *   node scripts/qa.js <base-url> <output-dir> [page-path-1] [page-path-2] ...
 *
 * Examples:
 *   node scripts/qa.js http://localhost:4321 jobs/example.com/qa-option-a / /about /contact
 *   node scripts/qa.js http://localhost:4322 jobs/example.com/qa-option-b / /about.html /es/
 *
 * If no page paths are given, auto-discovers pages from nav links on homepage.
 *
 * Output:
 *   {output-dir}/mobile-{page}.png        — 390×844 screenshots
 *   {output-dir}/ipad-{page}.png          — 1024×1366 screenshots
 *   {output-dir}/desktop-{page}.png       — 1440×900 screenshots
 *   {output-dir}/desktop-wide-{page}.png  — 1920×1080 screenshots
 *   {output-dir}/report.json              — structured QA report (per-viewport)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// Mobile FIRST — primary conversion target. iPad next (md/lg boundary edge case).
// Desktop next (standard). Desktop-wide last (FHD viewing). Tablet bug-zone
// in the middle, mobile + desktop pinned at the ends.
const VIEWPORTS = [
  { name: 'mobile',       width: 390,  height: 844  },  // iPhone 14
  { name: 'ipad',         width: 1024, height: 1366 },  // iPad portrait
  { name: 'desktop',      width: 1440, height: 900  },  // Standard desktop
  { name: 'desktop-wide', width: 1920, height: 1080 },  // FHD monitor
];

async function discoverPages(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });

  const links = await page.evaluate(() => {
    const anchors = document.querySelectorAll('nav a[href], header a[href]');
    const paths = new Set();
    anchors.forEach(a => {
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.origin === window.location.origin) {
          paths.add(url.pathname);
        }
      } catch (e) {}
    });
    return [...paths];
  });

  // Always include homepage
  if (!links.includes('/')) links.unshift('/');

  return links;
}

function slugify(pagePath) {
  if (pagePath === '/') return 'home';
  return pagePath.replace(/^\//, '').replace(/\.html$/, '').replace(/\//g, '-');
}

async function qaPage(page, baseUrl, pagePath, outputDir) {
  const url = baseUrl.replace(/\/$/, '') + pagePath;
  const slug = slugify(pagePath);
  const result = {
    path: pagePath,
    url,
    screenshots: {},
    consoleErrors: [],
    networkErrors: [],
    status: 'ok',
  };

  // Collect console errors
  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleMessages.push(msg.text());
    }
  });

  // Collect failed network requests
  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'unknown',
    });
  });

  // Collect 4xx/5xx responses
  const badResponses = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      badResponses.push({
        url: res.url(),
        status: res.status(),
      });
    }
  });

  try {
    // Navigate to page
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

    if (!response || response.status() >= 400) {
      result.status = 'error';
      result.error = `HTTP ${response?.status() || 'no response'}`;
    }

    // Iterate all viewports — mobile first (primary conversion target),
    // then iPad (md/lg edge case), then desktop (standard), then desktop-wide
    // (FHD). Per Phase O (2026-05-07) the four-viewport scan replaced the
    // pre-Phase-O two-viewport scan (desktop + mobile). Mobile-first order
    // means mobile screenshots are produced first; downstream visual-pass
    // sub-agents read in this order.
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Let animations settle
      // Trigger any scroll-based reveal animations (IntersectionObserver fade-up)
      await page.evaluate(async () => {
        const dist = document.body.scrollHeight;
        const step = 400;
        for (let y = 0; y < dist; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
        // Force any remaining fade-up elements visible as a safety net
        document.querySelectorAll('.fade-up, .stagger').forEach(el => el.classList.add('visible'));
        await new Promise(r => setTimeout(r, 400));
      });
      const screenshotPath = path.join(outputDir, `${viewport.name}-${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.screenshots[viewport.name] = screenshotPath;
    }

    // Reset to mobile (the primary viewport — leaves the page in mobile-state
    // for any downstream tooling that reads document state)
    await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });

  } catch (err) {
    result.status = 'error';
    result.error = err.message;
  }

  result.consoleErrors = consoleMessages;
  result.networkErrors = [...failedRequests, ...badResponses.map(r => ({
    url: r.url,
    status: r.status,
    failure: `HTTP ${r.status}`,
  }))];

  if (result.consoleErrors.length > 0 || result.networkErrors.length > 0) {
    result.status = 'warnings';
  }

  // Remove listeners for next page
  page.removeAllListeners('console');
  page.removeAllListeners('requestfailed');
  page.removeAllListeners('response');

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/qa.js <base-url> <output-dir> [page-paths...]');
    console.error('Example: node scripts/qa.js http://localhost:4321 jobs/example.com/qa-option-a / /about /contact');
    process.exit(1);
  }

  const baseUrl = args[0];
  const outputDir = args[1];
  let pagePaths = args.slice(2);

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\n🔍 WebFactory QA — Headless Visual Inspection`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Output: ${outputDir}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Auto-discover pages if none provided
  if (pagePaths.length === 0) {
    console.log('   Auto-discovering pages from nav...');
    try {
      pagePaths = await discoverPages(page, baseUrl);
      console.log(`   Found ${pagePaths.length} pages: ${pagePaths.join(', ')}\n`);
    } catch (err) {
      console.error(`   Failed to discover pages: ${err.message}`);
      console.log('   Falling back to homepage only.\n');
      pagePaths = ['/'];
    }
  }

  const report = {
    baseUrl,
    timestamp: new Date().toISOString(),
    pages: [],
    summary: { total: 0, ok: 0, warnings: 0, errors: 0 },
  };

  for (const pagePath of pagePaths) {
    const slug = slugify(pagePath);
    process.stdout.write(`   📸 ${pagePath} ...`);

    const result = await qaPage(page, baseUrl, pagePath, outputDir);
    report.pages.push(result);
    report.summary.total++;

    if (result.status === 'ok') {
      report.summary.ok++;
      console.log(` ✓`);
    } else if (result.status === 'warnings') {
      report.summary.warnings++;
      const issues = [];
      if (result.consoleErrors.length > 0) issues.push(`${result.consoleErrors.length} console errors`);
      if (result.networkErrors.length > 0) issues.push(`${result.networkErrors.length} network errors`);
      console.log(` ⚠ ${issues.join(', ')}`);
    } else {
      report.summary.errors++;
      console.log(` ✗ ${result.error}`);
    }
  }

  // Write report
  const reportPath = path.join(outputDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  await browser.close();

  // Print summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`   QA Complete: ${report.summary.total} pages checked`);
  console.log(`   ✓ OK: ${report.summary.ok}  ⚠ Warnings: ${report.summary.warnings}  ✗ Errors: ${report.summary.errors}`);
  console.log(`   Screenshots: ${outputDir}/`);
  console.log(`   Report: ${reportPath}`);
  console.log(`${'='.repeat(50)}\n`);

  // Print details for pages with issues
  for (const p of report.pages) {
    if (p.consoleErrors.length > 0) {
      console.log(`   ⚠ Console errors on ${p.path}:`);
      p.consoleErrors.forEach(e => console.log(`     - ${e}`));
    }
    if (p.networkErrors.length > 0) {
      console.log(`   ⚠ Network errors on ${p.path}:`);
      p.networkErrors.forEach(e => console.log(`     - ${e.url} → ${e.failure}`));
    }
  }

  // Exit with error code if any pages failed
  if (report.summary.errors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('QA script failed:', err);
  process.exit(1);
});
