import './load-env.js';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLeadsForScreenshot, updateLead } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, 'screenshots');

const NAV_TIMEOUT_MS = 20000;
const SETTLE_MS = 1500;

async function shotOne(browser, lead) {
  const dir = path.join(SHOTS_DIR, lead.place_id);
  fs.mkdirSync(dir, { recursive: true });
  const desktopPath = path.join(dir, 'desktop.png');
  const mobilePath = path.join(dir, 'mobile.png');

  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  });
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });

  try {
    const dPage = await desktopCtx.newPage();
    await dPage.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await dPage.waitForTimeout(SETTLE_MS);
    await dPage.screenshot({ path: desktopPath, fullPage: false });

    const mPage = await mobileCtx.newPage();
    await mPage.goto(lead.website, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await mPage.waitForTimeout(SETTLE_MS);
    await mPage.screenshot({ path: mobilePath, fullPage: false });

    updateLead(lead.id, {
      screenshot_desktop: path.relative(__dirname, desktopPath),
      screenshot_mobile: path.relative(__dirname, mobilePath),
      screenshot_at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
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

  try {
    for (const lead of leads) {
      const result = await shotOne(browser, lead);
      if (result.ok) {
        captured++;
        console.log(`[screenshot] ✓ ${lead.business_name} (${lead.domain || lead.website})`);
      } else {
        failed++;
        console.error(`[screenshot] ✗ ${lead.business_name}: ${result.error}`);
        updateLead(lead.id, {
          filter_status: 'rejected',
          filter_reason: 'screenshot_failed',
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[screenshot] captured=${captured} failed=${failed}`);
  return { captured, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  screenshotAll().catch(err => {
    console.error('[screenshot] FAILED:', err.message);
    process.exit(1);
  });
}
