import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { URL } from 'url';

// Usage: node scripts/grab-heroes.js <url>
// Reads pages from the existing manifest.json, visits each page,
// and downloads CSS background-image URLs that the main scraper may have missed.

const startUrl = process.argv[2];
if (!startUrl) {
  console.error('Usage: node scripts/grab-heroes.js <url>');
  process.exit(1);
}

const domain = new URL(startUrl).hostname.replace(/^www\./, '');
const origin = new URL(startUrl).origin;
const jobDir = resolve(process.cwd(), 'jobs', domain);
const OUT = join(jobDir, 'assets', 'heroes');

async function run() {
  // Read pages from manifest
  const manifestPath = join(jobDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest found at ${manifestPath}. Run scrape.js first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const pages = manifest.pages.map(p => ({
    path: p.url,
    name: p.url === '/' ? 'home' : p.url.replace(/^\//, '').replace(/\//g, '-'),
  }));

  console.log(`Grabbing hero backgrounds for ${domain} (${pages.length} pages)`);

  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const p of pages) {
    console.log(`\n--- ${p.name} (${p.path}) ---`);
    const page = await context.newPage();
    try {
      await page.goto(origin + p.path, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Find all background images (CSS)
      const bgImages = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          if (bg && bg !== 'none' && bg.includes('url(')) {
            const matches = bg.match(/url\(["']?(.*?)["']?\)/g);
            if (matches) {
              matches.forEach(m => {
                const url = m.replace(/url\(["']?/, '').replace(/["']?\)/, '');
                if (url.startsWith('http') && !url.includes('data:') && !url.includes('.svg')) {
                  const rect = el.getBoundingClientRect();
                  results.push({ url, width: rect.width, height: rect.height });
                }
              });
            }
          }
        });
        return results;
      });

      // Also find slider/carousel images in data attributes or large hero-area <img> tags
      const sliderImages = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('[data-bg], [data-src], [data-image], [style*="background-image"]').forEach(el => {
          const dataBg = el.getAttribute('data-bg') || el.getAttribute('data-src') || el.getAttribute('data-image');
          if (dataBg && dataBg.startsWith('http')) {
            results.push({ url: dataBg, source: 'data-attr' });
          }
        });
        document.querySelectorAll('img').forEach(img => {
          const rect = img.getBoundingClientRect();
          if (rect.top < 800 && rect.width > 300 && rect.height > 200 && !img.src.includes('logo') && !img.src.includes('userway')) {
            results.push({ url: img.src, source: 'hero-img', w: img.naturalWidth, h: img.naturalHeight });
          }
        });
        return results;
      });

      console.log(`  Background images: ${bgImages.length}, Slider images: ${sliderImages.length}`);

      // Download all found images
      const allUrls = [...new Set([...bgImages.map(b => b.url), ...sliderImages.map(s => s.url)])];
      for (let i = 0; i < allUrls.length; i++) {
        try {
          const resp = await page.request.get(allUrls[i]);
          if (resp.ok()) {
            const ext = allUrls[i].match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
            const filename = `${p.name}-hero-${i}.${ext}`;
            await writeFile(join(OUT, filename), await resp.body());
            console.log(`  Downloaded: ${filename}`);
          }
        } catch {
          // skip
        }
      }
    } catch (err) {
      console.error(`  Error on ${p.path}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\nDone!');
}

run().catch(console.error);
