#!/usr/bin/env node
/**
 * One-shot: capture A/B/C home-page desktop screenshots for a list of job
 * directories that don't already have abc-screenshots/. Saves to
 * jobs/<dir>/abc-screenshots/{A,B,C}-home-desktop.png.
 *
 * Usage:
 *   node scripts/_capture-abc-screenshots.mjs <job-dir> [<job-dir> ...]
 */

import { chromium } from 'playwright';
import { readFile, mkdir, access } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error('Usage: node scripts/_capture-abc-screenshots.mjs <job-dir> [<job-dir> ...]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

for (const d of dirs) {
  const abs = resolve(d);
  const name = basename(abs);
  console.log(`\n→ ${name}`);

  const screenshotsDir = resolve(abs, 'abc-screenshots');
  await mkdir(screenshotsDir, { recursive: true });

  for (const opt of ['a', 'b', 'c']) {
    const projJsonPath = resolve(abs, `option-${opt}`, '.vercel', 'project.json');
    let projectName;
    try {
      const j = JSON.parse(await readFile(projJsonPath, 'utf-8'));
      projectName = j.projectName;
    } catch {
      console.log(`  ✗ option-${opt}: no project.json — skipping`);
      continue;
    }
    const url = `https://${projectName}.vercel.app`;
    const out = resolve(screenshotsDir, `${opt.toUpperCase()}-home-desktop.png`);

    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
      // Give layouts/fonts a moment to settle
      await page.waitForTimeout(2000);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ option-${opt} → ${basename(out)}  (${url})`);
    } catch (err) {
      console.log(`  ✗ option-${opt} screenshot failed: ${err.message}`);
    } finally {
      await page.close();
    }
  }
}

await browser.close();
console.log('\n✓ Done.');
