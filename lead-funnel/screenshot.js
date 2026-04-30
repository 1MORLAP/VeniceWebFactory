import './load-env.js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLeadsForScreenshot, updateLead } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, 'screenshots');

const NAV_TIMEOUT_MS = 25000;
const SETTLE_MS = 2500;
const CHALLENGE_RETRY_WAIT_MS = 8000;

// Strings that almost certainly mean we're looking at a bot interstitial
// (Cloudflare "Just a moment...", DDoS-Guard, Akamai, etc.) rather than the
// real homepage. Capture order: title + first 800 chars of body innerText.
const CHALLENGE_PATTERNS = [
  // Bot challenges
  'verifying you are human',
  'just a moment',
  'browser check',
  'checking your browser',
  'enable javascript and cookies to continue',
  'attention required',
  'please verify you are human',
  'ddos protection by',
  'security check by cloudflare',
  'one more step',
  // Rate-limit pages — the screenshot caught a 429 rather than the real site
  'too many requests',
  '429 too many requests',
  'rate limit exceeded',
  'you have been rate limited',
  'request rate exceeded',
  // Generic block pages
  'access denied',
  'request blocked',
  'unauthorized request',
];

async function pageSignals(page) {
  const title = (await page.title().catch(() => '')) || '';
  const body = await page
    .evaluate(() => (document.body?.innerText || '').slice(0, 800))
    .catch(() => '');
  return (title + '\n' + body).toLowerCase();
}

function looksLikeChallenge(text) {
  return CHALLENGE_PATTERNS.some(p => text.includes(p));
}

async function gotoStable(page, url) {
  // Try networkidle first (real-content-friendly), fall back to domcontentloaded
  // on timeout — some sites never go fully idle (analytics polling, etc.).
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } else {
      throw err;
    }
  }
  await page.waitForTimeout(SETTLE_MS);
}

async function shotOne(browser, lead) {
  const dir = path.join(SHOTS_DIR, lead.place_id);
  fs.mkdirSync(dir, { recursive: true });
  const desktopPath = path.join(dir, 'desktop.png');
  const mobilePath = path.join(dir, 'mobile.png');

  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  try {
    const dPage = await desktopCtx.newPage();
    await gotoStable(dPage, lead.website);

    // Bot-challenge detection — if the visible page looks like a CF/DDoS
    // interstitial, wait once more (challenges often clear in 5-8s) and
    // re-check. If still a challenge, give up — a poisoned screenshot
    // would mislead the scorer.
    let signals = await pageSignals(dPage);
    if (looksLikeChallenge(signals)) {
      await dPage.waitForTimeout(CHALLENGE_RETRY_WAIT_MS);
      signals = await pageSignals(dPage);
      if (looksLikeChallenge(signals)) {
        return { ok: false, error: 'bot_challenge' };
      }
    }

    await dPage.screenshot({ path: desktopPath, fullPage: false });

    const mPage = await mobileCtx.newPage();
    await gotoStable(mPage, lead.website);
    // (Re-checking on mobile is overkill — if desktop cleared, mobile usually does too.)
    await mPage.screenshot({ path: mobilePath, fullPage: false });

    updateLead(lead.id, {
      screenshot_desktop: path.relative(__dirname, desktopPath),
      screenshot_mobile: path.relative(__dirname, mobilePath),
      screenshot_at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.name === 'TimeoutError' ? 'screenshot_timeout' : `screenshot_${err.message.slice(0, 80)}` };
  } finally {
    await desktopCtx.close().catch(() => {});
    await mobileCtx.close().catch(() => {});
  }
}

export async function screenshotAll() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const leads = listLeadsForScreenshot();
  if (leads.length === 0) {
    console.log('[screenshot] nothing to do');
    return { captured: 0, failed: 0 };
  }
  console.log(`[screenshot] capturing ${leads.length} sites`);

  const browser = await chromium.launch({ headless: true });
  let captured = 0, failed = 0;
  const reasonCounts = {};

  try {
    for (const lead of leads) {
      const result = await shotOne(browser, lead);
      if (result.ok) {
        captured++;
        console.log(`[screenshot] ✓ ${lead.business_name} (${lead.domain || lead.website})`);
      } else {
        failed++;
        reasonCounts[result.error] = (reasonCounts[result.error] || 0) + 1;
        console.error(`[screenshot] ✗ ${lead.business_name}: ${result.error}`);
        updateLead(lead.id, {
          filter_status: 'rejected',
          filter_reason: result.error,
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[screenshot] captured=${captured} failed=${failed}`);
  for (const [r, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`[screenshot]   ${r}: ${n}`);
  }
  return { captured, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  screenshotAll().catch(err => {
    console.error('[screenshot] FAILED:', err.message);
    process.exit(1);
  });
}
