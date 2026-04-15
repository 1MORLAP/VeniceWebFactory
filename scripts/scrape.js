import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { URL } from 'url';

const MAX_PAGES = 30;
const TIMEOUT = 30_000;

async function scrape(startUrl) {
  const origin = new URL(startUrl).origin;
  const domain = new URL(startUrl).hostname.replace(/^www\./, '');
  const jobDir = resolve(process.cwd(), 'jobs', domain);
  const assetsDir = join(jobDir, 'assets');
  const imgDir = join(assetsDir, 'img');
  const screenshotDir = join(assetsDir, 'screenshots');

  await mkdir(imgDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const visited = new Set();
  const toVisit = [startUrl];
  const pages = [];
  let imageCounter = 0;

  console.log(`Scraping ${startUrl} (domain: ${domain})`);

  while (toVisit.length > 0 && visited.size < MAX_PAGES) {
    const url = toVisit.shift();
    const normalized = normalizeUrl(url, origin);
    if (!normalized || visited.has(normalized)) continue;
    visited.add(normalized);

    console.log(`  [${visited.size}/${MAX_PAGES}] ${normalized}`);

    const page = await context.newPage();
    try {
      await page.goto(normalized, { waitUntil: 'networkidle', timeout: TIMEOUT });
      await autoScroll(page);

      // Extract page data
      const pageData = await page.evaluate(() => {
        function getTextContent(el) {
          const text = el?.textContent?.trim() || '';
          return text.replace(/\s+/g, ' ');
        }

        // Extract sections from main content
        const sections = [];
        const mainContent = document.querySelector('main') || document.body;

        // Walk through top-level sections
        const sectionEls = mainContent.querySelectorAll('section, [class*="section"], [class*="hero"], [class*="banner"], article');
        if (sectionEls.length > 0) {
          sectionEls.forEach(sec => {
            const heading = sec.querySelector('h1, h2, h3');
            const paragraphs = Array.from(sec.querySelectorAll('p')).map(p => getTextContent(p)).filter(Boolean);
            const lists = Array.from(sec.querySelectorAll('ul, ol')).map(list =>
              Array.from(list.querySelectorAll('li')).map(li => getTextContent(li))
            );
            const links = Array.from(sec.querySelectorAll('a[href]')).map(a => ({
              text: getTextContent(a),
              href: a.getAttribute('href'),
            })).filter(l => l.text);

            const sectionImages = Array.from(sec.querySelectorAll('img')).map(img => ({
              src: img.src,
              alt: img.alt || '',
              width: img.naturalWidth,
              height: img.naturalHeight,
            }));

            sections.push({
              type: heading?.tagName === 'H1' ? 'hero' : 'content',
              heading: getTextContent(heading),
              paragraphs,
              lists,
              links,
              images: sectionImages,
              html: sec.innerHTML,
            });
          });
        } else {
          // Fallback: treat body content as one section
          const heading = mainContent.querySelector('h1');
          const paragraphs = Array.from(mainContent.querySelectorAll('p')).map(p => getTextContent(p)).filter(Boolean);
          sections.push({
            type: 'content',
            heading: getTextContent(heading),
            paragraphs,
            lists: [],
            links: [],
            images: [],
            html: mainContent.innerHTML,
          });
        }

        // Extract all images (<img> tags)
        const images = Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth,
          height: img.naturalHeight,
          type: 'img',
        })).filter(img => img.src && !img.src.startsWith('data:'));

        // Extract CSS background-image URLs
        const bgImages = [];
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          if (bg && bg !== 'none' && bg.includes('url(')) {
            const matches = bg.match(/url\(["']?(.*?)["']?\)/g);
            if (matches) {
              matches.forEach(m => {
                const url = m.replace(/url\(["']?/, '').replace(/["']?\)/, '');
                if (url.startsWith('http') && !url.includes('data:') && !url.includes('.svg') && !url.includes('userway')) {
                  const rect = el.getBoundingClientRect();
                  bgImages.push({
                    src: url,
                    alt: '',
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    type: 'background',
                  });
                }
              });
            }
          }
        });

        // Extract video embeds
        const videos = [];
        document.querySelectorAll('iframe').forEach(iframe => {
          const src = iframe.src || '';
          if (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com')) {
            videos.push({ src, width: iframe.width, height: iframe.height });
          }
        });
        document.querySelectorAll('video').forEach(video => {
          const src = video.src || video.querySelector('source')?.src || '';
          if (src) videos.push({ src, type: 'native' });
        });

        // Extract forms
        const forms = Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action || '',
          method: form.method || 'get',
          fields: Array.from(form.querySelectorAll('input, textarea, select')).map(field => ({
            type: field.type || field.tagName.toLowerCase(),
            name: field.name || '',
            placeholder: field.placeholder || '',
            label: field.labels?.[0]?.textContent?.trim() || '',
            required: field.required,
          })),
        }));

        // Extract navigation
        const navEl = document.querySelector('nav, header nav, [role="navigation"]');
        const navItems = navEl
          ? Array.from(navEl.querySelectorAll('a[href]')).map(a => ({
              text: getTextContent(a),
              href: a.getAttribute('href'),
            })).filter(item => item.text && item.text.length < 100)
          : [];

        // Extract footer
        const footerEl = document.querySelector('footer');
        const socialLinks = [];
        const socialPatterns = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'x.com'];
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href') || '';
          if (socialPatterns.some(p => href.includes(p))) {
            socialLinks.push({ platform: socialPatterns.find(p => href.includes(p)), href });
          }
        });

        // Extract phone numbers
        const phoneLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => a.getAttribute('href').replace('tel:', ''));
        const emailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => a.getAttribute('href').replace('mailto:', ''));

        // Extract meta
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
        const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';

        // All internal links for crawling
        const internalLinks = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:'));

        return {
          title: document.title || '',
          sections,
          images,
          bgImages,
          videos,
          forms,
          navigation: { items: navItems },
          footer: {
            text: footerEl ? getTextContent(footerEl) : '',
            social: socialLinks,
            phone: phoneLinks,
            email: emailLinks,
          },
          meta: { description: metaDesc, ogImage, ogTitle },
          internalLinks,
        };
      });

      // Take full-page screenshot
      const slug = urlToSlug(normalized, origin);
      const screenshotPath = join(screenshotDir, `${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Download images
      const downloadedImages = [];
      for (const img of pageData.images) {
        try {
          const imgUrl = new URL(img.src);
          if (imgUrl.origin !== origin && !img.src.startsWith(origin)) {
            // External image - still download it
          }
          const ext = getImageExtension(img.src);
          const filename = `img_${imageCounter++}${ext}`;
          const imgPath = join(imgDir, filename);

          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buffer = await response.body();
            await writeFile(imgPath, buffer);
            downloadedImages.push({
              ...img,
              localPath: `assets/img/${filename}`,
            });
          }
        } catch {
          // Skip failed image downloads
          downloadedImages.push({ ...img, localPath: null });
        }
      }

      // Download CSS background images
      const downloadedBgImages = [];
      const seenBgUrls = new Set(downloadedImages.map(i => i.src));
      for (const img of pageData.bgImages) {
        if (seenBgUrls.has(img.src)) continue;
        seenBgUrls.add(img.src);
        try {
          const ext = getImageExtension(img.src);
          const filename = `bg_${imageCounter++}${ext}`;
          const imgPath = join(imgDir, filename);
          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buffer = await response.body();
            await writeFile(imgPath, buffer);
            downloadedBgImages.push({
              ...img,
              localPath: `assets/img/${filename}`,
            });
          }
        } catch {
          downloadedBgImages.push({ ...img, localPath: null });
        }
      }

      // Collect internal links for crawling
      for (const link of pageData.internalLinks) {
        const norm = normalizeUrl(link, origin);
        if (norm && !visited.has(norm) && !toVisit.includes(norm)) {
          toVisit.push(norm);
        }
      }

      pages.push({
        url: normalized.replace(origin, '') || '/',
        title: pageData.title,
        screenshot: `assets/screenshots/${slug}.png`,
        sections: pageData.sections.map(s => ({ ...s, html: undefined })),
        images: downloadedImages,
        backgroundImages: downloadedBgImages,
        videos: pageData.videos,
        forms: pageData.forms,
      });

      // Store raw HTML for each section (separate file to keep manifest clean)
      const htmlDir = join(assetsDir, 'html');
      await mkdir(htmlDir, { recursive: true });
      const sectionsWithHtml = pageData.sections.map((s, i) => ({
        index: i,
        html: s.html,
      }));
      await writeFile(
        join(htmlDir, `${slug}.json`),
        JSON.stringify(sectionsWithHtml, null, 2)
      );

    } catch (err) {
      console.error(`  Error scraping ${normalized}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  // Build manifest
  const firstPage = pages[0];
  const manifest = {
    url: startUrl,
    domain,
    scrapedAt: new Date().toISOString(),
    totalPages: pages.length,
    pages,
    navigation: firstPage?.navigation || { items: [] },
    footer: firstPage?.footer || {},
    meta: firstPage?.meta || {},
  };

  const manifestPath = join(jobDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nDone! Scraped ${pages.length} pages.`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Assets: ${assetsDir}`);

  await browser.close();
  return manifest;
}

function normalizeUrl(url, origin) {
  try {
    const parsed = new URL(url, origin);
    // Stay on primary domain only
    if (parsed.origin !== origin) return null;
    // Skip anchors, file downloads, etc.
    if (parsed.pathname.match(/\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|svg|mp4|mp3)$/i)) return null;
    // Remove hash and trailing slash
    let normalized = parsed.origin + parsed.pathname.replace(/\/$/, '');
    if (normalized === parsed.origin) normalized = parsed.origin + '/';
    return normalized;
  } catch {
    return null;
  }
}

function urlToSlug(url, origin) {
  const path = url.replace(origin, '').replace(/^\//, '') || 'home';
  return path.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
}

function getImageExtension(src) {
  const match = src.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)/i);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
      // Safety timeout
      setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
    });
  });
}

// CLI entry point
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/scrape.js <url>');
  process.exit(1);
}

scrape(url).catch(err => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
