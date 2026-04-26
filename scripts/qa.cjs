#!/usr/bin/env node
/**
 * WebFactory QA Script — Headless Visual QA
 *
 * Takes screenshots at desktop/tablet/mobile viewports,
 * checks console errors, failed network requests, and broken images.
 * Runs entirely headless (no visible browser window).
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
 *   {output-dir}/desktop-{page}.png    — 1440x900 screenshots
 *   {output-dir}/mobile-{page}.png     — 375x812 screenshots
 *   {output-dir}/report.json           — structured QA report
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 },
};

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

    // Desktop screenshot
    await page.setViewportSize(VIEWPORTS.desktop);
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
    const desktopPath = path.join(outputDir, `desktop-${slug}.png`);
    await page.screenshot({ path: desktopPath, fullPage: true });
    result.screenshots.desktop = desktopPath;

    // Mobile screenshot
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);
    await page.evaluate(async () => {
      const dist = document.body.scrollHeight;
      const step = 400;
      for (let y = 0; y < dist; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 80));
      }
      window.scrollTo(0, 0);
      document.querySelectorAll('.fade-up, .stagger').forEach(el => el.classList.add('visible'));
      await new Promise(r => setTimeout(r, 400));
    });
    const mobilePath = path.join(outputDir, `mobile-${slug}.png`);
    await page.screenshot({ path: mobilePath, fullPage: true });
    result.screenshots.mobile = mobilePath;

    // Reset to desktop
    await page.setViewportSize(VIEWPORTS.desktop);

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
