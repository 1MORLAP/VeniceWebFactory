import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'https://www.hydramaxxsavescarpets.com';
const OUT = 'jobs/hydramaxxsavescarpets.com/assets/heroes';

const pages = [
  { path: '/', name: 'home' },
  { path: '/carpet-cleaning', name: 'carpet-cleaning' },
  { path: '/tile-grout-cleaning', name: 'tile-grout-cleaning' },
  { path: '/air-duct-cleaning', name: 'air-duct-cleaning' },
  { path: '/dryer-vent-cleaning', name: 'dryer-vent-cleaning' },
  { path: '/emergency-water-extraction', name: 'emergency-water-extraction' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
];

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const p of pages) {
    console.log(`\n--- ${p.name} (${p.path}) ---`);
    const page = await context.newPage();
    await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // let slider load

    // Find all background images (CSS)
    const bgImages = await page.evaluate(() => {
      const results = [];
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
          const matches = bg.match(/url\(["']?(.*?)["']?\)/g);
          if (matches) {
            matches.forEach(m => {
              const url = m.replace(/url\(["']?/, '').replace(/["']?\)/, '');
              if (url.startsWith('http') && !url.includes('data:') && !url.includes('.svg')) {
                const rect = el.getBoundingClientRect();
                results.push({ url, width: rect.width, height: rect.height, tag: el.tagName, classes: el.className.substring(0, 100) });
              }
            });
          }
        }
      });
      return results;
    });

    // Also find slider/carousel images that might be in data attributes or hidden
    const sliderImages = await page.evaluate(() => {
      const results = [];
      // Check common slider patterns
      document.querySelectorAll('[data-bg], [data-src], [data-image], [style*="background-image"]').forEach(el => {
        const dataBg = el.getAttribute('data-bg') || el.getAttribute('data-src') || el.getAttribute('data-image');
        if (dataBg && dataBg.startsWith('http')) {
          results.push({ url: dataBg, source: 'data-attr' });
        }
      });
      // Check for large images in the first 800px of the page (hero area)
      document.querySelectorAll('img').forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.top < 800 && rect.width > 300 && rect.height > 200 && !img.src.includes('logo') && !img.src.includes('userway')) {
          results.push({ url: img.src, source: 'hero-img', w: img.naturalWidth, h: img.naturalHeight });
        }
      });
      return results;
    });

    console.log('Background images:', bgImages.length);
    bgImages.forEach((img, i) => console.log(`  bg${i}: ${img.url.substring(0, 120)} (${Math.round(img.width)}x${Math.round(img.height)})`));

    console.log('Slider/hero images:', sliderImages.length);
    sliderImages.forEach((img, i) => console.log(`  sl${i}: ${img.url.substring(0, 120)} (${img.source})`));

    // Download all found images
    const allUrls = [...new Set([...bgImages.map(b => b.url), ...sliderImages.map(s => s.url)])];
    for (let i = 0; i < allUrls.length; i++) {
      try {
        const resp = await page.request.get(allUrls[i]);
        if (resp.ok()) {
          const ext = allUrls[i].match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
          const filename = `${p.name}-hero-${i}.${ext}`;
          await writeFile(join(OUT, filename), await resp.body());
          console.log(`  Downloaded: ${filename} (${Math.round((await resp.body()).length / 1024)}KB)`);
        }
      } catch (e) {
        console.log(`  Failed to download: ${allUrls[i].substring(0, 80)}`);
      }
    }

    await page.close();
  }

  await browser.close();
  console.log('\nDone!');
}

run().catch(console.error);
