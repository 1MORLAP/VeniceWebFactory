import { chromium } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { URL } from 'url';

const MAX_PAGES = 30;
const TIMEOUT = 60_000;

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
    ignoreHTTPSErrors: true,
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
      await page.goto(normalized, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      try { await page.waitForLoadState('networkidle', { timeout: 15_000 }); } catch {}
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

        // Extract video embeds. Coverage extended 2026-05-05 to include
        // Brightcove / JW Player / Vidyard / Wistia / Loom alongside the
        // original YouTube + Vimeo. The 4-variant classifier
        // (scripts/inspect-splash.cjs) handles these post-scrape.
        const videos = [];
        const KNOWN_VIDEO_HOSTS = /(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|brightcove\.net|bcove\.video|jwplayer\.com|jwpcdn\.com|vidyard\.com|wistia\.com|wistia\.net|fast\.wistia|loom\.com)/i;
        document.querySelectorAll('iframe').forEach(iframe => {
          const src = iframe.src || '';
          if (KNOWN_VIDEO_HOSTS.test(src)) {
            videos.push({ src, width: iframe.width, height: iframe.height });
          }
        });
        document.querySelectorAll('video').forEach(video => {
          const src = video.src || video.querySelector('source')?.src || '';
          if (src) videos.push({ src, type: 'native' });
        });

        // Extract Watch-Video CTA links — `<a>` whose visible text or
        // aria-label matches video vocabulary AND whose href points to a
        // splash page (NOT to a YouTube/Vimeo URL — those would be
        // handled as direct embeds elsewhere). Common pattern on Hibu /
        // Wix / Squarespace sites where the customer's actual video is
        // on a /watch-video.html splash page or behind a popup.
        // The 4-variant classifier (scripts/inspect-splash.cjs) probes
        // the splash URL post-scrape and classifies it.
        let videoCta = null;
        const VIDEO_CTA_TEXT_RE = /(watch\s+(?:our|the)?\s*video|see\s+(?:our|the)?\s*video|play\s+(?:our|the)?\s*video|view\s+(?:our|the)?\s*video|click\s+to\s+watch|watch\s+now)/i;
        for (const a of document.querySelectorAll('a[href]')) {
          const text = (a.innerText || a.textContent || '').trim();
          const aria = (a.getAttribute('aria-label') || '').trim();
          const title = (a.getAttribute('title') || '').trim();
          const haystack = `${text}\n${aria}\n${title}`;
          if (!VIDEO_CTA_TEXT_RE.test(haystack)) continue;
          const href = a.href || '';
          if (!href || href === window.location.href) continue;
          // Skip CTAs that link directly to a known video host — those
          // are already captured as iframe-eligible in `videos[]`.
          if (KNOWN_VIDEO_HOSTS.test(href)) continue;
          // Take the FIRST CTA on the page — most pages have at most one.
          videoCta = {
            href,
            text: text.slice(0, 80),
            ariaLabel: aria || null,
          };
          break;
        }

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

        // Extract favicon candidates (in priority order — best first)
        // The build will use these to set the page's favicon. If none found,
        // build falls back to the logo. See FAVICON RULE in SKILL.md.
        const faviconCandidates = [];
        const faviconSelectors = [
          'link[rel="icon"][sizes][href]',                 // most-specific size-tagged icon
          'link[rel="apple-touch-icon"][href]',            // 180×180 typically
          'link[rel="apple-touch-icon-precomposed"][href]',
          'link[rel="shortcut icon"][href]',
          'link[rel="icon"][href]',                         // generic
          'link[rel="mask-icon"][href]',                    // Safari pinned tab
          'meta[name="msapplication-TileImage"][content]',  // Windows tile
        ];
        for (const sel of faviconSelectors) {
          for (const el of document.querySelectorAll(sel)) {
            const href = el.getAttribute('href') || el.getAttribute('content') || '';
            if (!href) continue;
            faviconCandidates.push({
              rel: el.getAttribute('rel') || el.tagName.toLowerCase(),
              href,
              sizes: el.getAttribute('sizes') || '',
              type: el.getAttribute('type') || '',
            });
          }
        }

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
          videoCta,
          forms,
          navigation: { items: navItems },
          footer: {
            text: footerEl ? getTextContent(footerEl) : '',
            social: socialLinks,
            phone: phoneLinks,
            email: emailLinks,
          },
          meta: { description: metaDesc, ogImage, ogTitle },
          favicons: faviconCandidates,
          internalLinks,
          // Raw stripped-text fallback for fact-grounding (added 2026-05-01,
          // mckeecoins.com bug). Legacy-CMS / 1998-era table-layout sites
          // hide content inside <font>, <center>, <marquee>, and table
          // cells — none of which the structured section-walker captures.
          // Without rawText, fact-grounding has 1 section heading on the
          // home page and reports every claim ("20 terms of sale", "ANA
          // member", "mail-bid mechanics") as un-grounded. With rawText,
          // the manifest corpus contains the full visible body text and
          // those claims verify cleanly. nav + footer are excluded since
          // they're already represented in their own manifest fields.
          rawText: (() => {
            try {
              // Clone the body, strip script/style/nav/header/footer in the
              // clone (so we don't mutate the live page), then read innerText.
              const clone = document.body.cloneNode(true);
              for (const sel of ['script', 'style', 'nav', 'header', 'footer', 'noscript']) {
                for (const el of clone.querySelectorAll(sel)) el.remove();
              }
              const txt = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
              // Cap at 64KB per page to bound manifest size on extreme cases.
              return txt.length > 64_000 ? txt.slice(0, 64_000) + '… [truncated at 64KB]' : txt;
            } catch {
              return '';
            }
          })(),
        };
      });

      // ---- Raw-HTML fallback for social/business-listing URLs (added 2026-04-25) ----
      // Many sites (Duda, GoDaddy, Wix, late-injecting widgets) render social
      // anchors via JS that runs AFTER networkidle. The page.evaluate() pass
      // misses them. As a defensive backstop, also grep the raw HTML response
      // for known platform domains and merge any found URLs into pageData.footer.social.
      // Real bug 2026-04-25: libertylandscapefl.com (Duda site) had Facebook + Instagram
      // anchors in raw HTML, but page.evaluate() returned an empty social array.
      try {
        const rawHtml = await page.content();
        const socialDomainPatterns = [
          { name: 'facebook',  re: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'instagram', re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'linkedin',  re: /https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'youtube',   re: /https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|user\/|c\/|@)[A-Za-z0-9._\-/?=&]+/g },
          { name: 'tiktok',    re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._\-/?=&]+/g },
          { name: 'twitter',   re: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'yelp',      re: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'pinterest', re: /https?:\/\/(?:www\.)?pinterest\.com\/[A-Za-z0-9._\-/?=&]+/g },
          { name: 'google',    re: /https?:\/\/(?:www\.)?google\.com\/maps\/place\/[A-Za-z0-9._\-/?=&+]+/g },
        ];
        const seenHrefs = new Set((pageData.footer?.social || []).map(s => s.href));
        const fallbackSocials = [];
        for (const { name, re } of socialDomainPatterns) {
          for (const match of rawHtml.matchAll(re)) {
            let href = match[0];
            // Trim trailing punctuation that often gets pulled in by greedy regex
            href = href.replace(/[.,;:'")\]]+$/, '');
            // Filter out CDN/asset URLs (e.g. scontent-iad.cdninstagram.com isn't a profile)
            if (/cdninstagram|fbcdn|fbsbx|googleusercontent|ytimg|tiktokcdn|pinimg|yelpcdn/.test(href)) continue;
            // Filter out sharing intents (twitter.com/intent/tweet, facebook.com/sharer)
            if (/\/(intent|sharer|share|sharing|dialog)\b/.test(href)) continue;
            // Filter out platform plugin / embed / API endpoints (NOT profile URLs)
            if (/\/(plugins|embed|widgets|oembed)\//.test(href)) continue;
            if (/\/v\d+\.\d+\//.test(href)) continue;  // /v2.7/ etc.
            // Filter out individual post URLs — keep PROFILE URLs only.
            // Instagram posts: /p/CODE/ and /reel/CODE/. Skip those.
            if (name === 'instagram' && /\/(p|reel|tv|stories)\//.test(href)) continue;
            // Twitter status URLs: /handle/status/12345. Skip status, keep profile.
            if (name === 'twitter' && /\/status\//.test(href)) continue;
            // YouTube watch / playlist URLs aren't channel URLs.
            if (name === 'youtube' && /\/(watch|playlist)\b/.test(href)) continue;
            // Skip if already captured by page.evaluate()
            if (seenHrefs.has(href)) continue;
            seenHrefs.add(href);
            fallbackSocials.push({ platform: name, href });
          }
        }
        if (fallbackSocials.length > 0) {
          if (!pageData.footer) pageData.footer = {};
          if (!Array.isArray(pageData.footer.social)) pageData.footer.social = [];
          pageData.footer.social.push(...fallbackSocials);
          console.log(`    + raw-HTML fallback found ${fallbackSocials.length} social URLs (${[...new Set(fallbackSocials.map(s => s.platform))].join(', ')})`);
        }
      } catch (e) {
        console.warn(`    raw-HTML social fallback failed: ${e.message}`);
      }

      // Take full-page screenshot
      const slug = urlToSlug(normalized, origin);
      const screenshotPath = join(screenshotDir, `${slug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Download images.
      //
      // Analytics-pixel filter (added 2026-05-01 — wyomingmemorialsinc.com
      // bug): drop tracking pixels at the source so they never enter the
      // manifest. Three layers:
      //   (1) Hostname blocklist — known analytics/beacon hosts (prnx.net,
      //       google-analytics.com, doubleclick.net, etc.). Skip without
      //       fetching.
      //   (2) URL-path heuristic — /pixel/, /track/, /beacon/, /collect,
      //       /b.gif, etc. Skip without fetching even if host is unknown.
      //   (3) Post-fetch byte-size — buffers under 200 bytes are tracking
      //       pixels regardless of host (a real photo is never that small).
      //       Skip the writeFile + manifest entry.
      const downloadedImages = [];
      let skippedAnalytics = 0;
      let skippedTinyByte = 0;
      for (const img of pageData.images) {
        if (isAnalyticsHost(img.src) || looksLikeTrackingPixel(img.src)) {
          skippedAnalytics++;
          continue;
        }
        try {
          const imgUrl = new URL(img.src);
          if (imgUrl.origin !== origin && !img.src.startsWith(origin)) {
            // External image - still download it (subject to filters above)
          }
          const ext = getImageExtension(img.src);
          const filename = `img_${imageCounter++}${ext}`;
          const imgPath = join(imgDir, filename);

          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buffer = await response.body();
            if (buffer.length < ANALYTICS_PIXEL_BYTE_LIMIT) {
              // Sub-200-byte image is almost always a 1×1 tracking pixel;
              // skip the writeFile + manifest entry. The image counter still
              // advanced so existing on-disk files (img_N) keep their numbers.
              skippedTinyByte++;
              continue;
            }
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
      if (skippedAnalytics > 0 || skippedTinyByte > 0) {
        console.log(`    skipped ${skippedAnalytics} analytics-host image(s) and ${skippedTinyByte} tiny-byte image(s) per tracking-pixel filter`);
      }

      // Download CSS background images
      const downloadedBgImages = [];
      const seenBgUrls = new Set(downloadedImages.map(i => i.src));
      let skippedBgAnalytics = 0;
      let skippedBgTinyByte = 0;
      for (const img of pageData.bgImages) {
        if (seenBgUrls.has(img.src)) continue;
        seenBgUrls.add(img.src);
        if (isAnalyticsHost(img.src) || looksLikeTrackingPixel(img.src)) {
          skippedBgAnalytics++;
          continue;
        }
        try {
          const ext = getImageExtension(img.src);
          const filename = `bg_${imageCounter++}${ext}`;
          const imgPath = join(imgDir, filename);
          const response = await page.request.get(img.src);
          if (response.ok()) {
            const buffer = await response.body();
            if (buffer.length < ANALYTICS_PIXEL_BYTE_LIMIT) {
              skippedBgTinyByte++;
              continue;
            }
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
      if (skippedBgAnalytics > 0 || skippedBgTinyByte > 0) {
        console.log(`    skipped ${skippedBgAnalytics} analytics-host bg-image(s) and ${skippedBgTinyByte} tiny-byte bg-image(s) per tracking-pixel filter`);
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
        videoCta: pageData.videoCta || null,
        forms: pageData.forms,
        favicons: pageData.favicons || [],
        // BUGFIX 2026-04-25: previously navigation/footer/meta were captured
        // inside page.evaluate() but never persisted onto the page record. The
        // top-level manifest.footer was therefore always {} even when the page
        // had real social links. This is why the libertylandscapefl scrape
        // returned 0 social URLs despite the original site having Facebook /
        // Instagram anchors. Persist them now so the build can read them.
        navigation: pageData.navigation || { items: [] },
        footer: pageData.footer || {},
        meta: pageData.meta || {},
        // Raw stripped-text fallback for fact-grounding (added 2026-05-01,
        // mckeecoins.com bug). Captures content the structured section-walker
        // misses on legacy-CMS sites (<marquee>, <font>, <center>, table
        // cells). The manifest corpus walker (qa-check.js + validate-specs.cjs)
        // picks this up automatically since it deep-walks every string field.
        rawText: pageData.rawText || '',
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

  // ---- Download the best favicon (added 2026-04-25) ----
  // Pick the highest-priority candidate from the homepage and download it to
  // assets/img/. Build (Stage 3) reads manifest.favicon and sets <link rel="icon">
  // accordingly. If no favicon was found, manifest.favicon is null and the build
  // falls back to the logo. See FAVICON RULE in SKILL.md.
  let topLevelFavicon = null;
  const homepageFavicons = pages[0]?.favicons || [];
  // Aggregate de-duped, sorted by quality (size > 64 first; svg > png > ico; apple-touch is high quality)
  const ranked = homepageFavicons
    .map(f => ({ ...f, _absUrl: (() => { try { return new URL(f.href, startUrl).href; } catch { return null; } })() }))
    .filter(f => f._absUrl)
    .sort((a, b) => {
      const score = (f) => {
        let s = 0;
        if (/svg/i.test(f.type) || /\.svg$/i.test(f._absUrl)) s += 100;
        if (/apple-touch/i.test(f.rel)) s += 60;
        if (f.sizes) {
          const m = f.sizes.match(/(\d+)x\d+/);
          if (m) s += Math.min(parseInt(m[1], 10), 512) / 5;
        }
        if (/\.png$/i.test(f._absUrl)) s += 20;
        if (/\.ico$/i.test(f._absUrl)) s += 5;
        return s;
      };
      return score(b) - score(a);
    });

  for (const cand of ranked) {
    try {
      const url = cand._absUrl;
      const ext = (url.match(/\.(svg|png|ico|jpg|jpeg|webp)(?:[?#]|$)/i) || [, 'ico'])[1].toLowerCase();
      const filename = `favicon.${ext}`;
      const localPath = join(imgDir, filename);
      // Use a fresh page for the request so we get fetch capabilities
      const tempPage = await context.newPage();
      try {
        const resp = await tempPage.request.get(url);
        if (resp.ok()) {
          const buffer = await resp.body();
          await writeFile(localPath, buffer);
          topLevelFavicon = {
            src: url,
            localPath: `assets/img/${filename}`,
            rel: cand.rel,
            sizes: cand.sizes || '',
            type: cand.type || '',
            ext,
            sizeBytes: buffer.length,
            source: 'scraped',
          };
          console.log(`✓ Downloaded favicon: ${url} → assets/img/${filename} (${buffer.length} bytes)`);
          await tempPage.close();
          break;
        }
      } finally { await tempPage.close().catch(() => {}); }
    } catch (e) {
      console.warn(`  favicon download failed for ${cand.href}: ${e.message}`);
    }
  }
  if (!topLevelFavicon) {
    // Last-ditch: try /favicon.ico at the origin (every server convention)
    try {
      const url = new URL('/favicon.ico', startUrl).href;
      const tempPage = await context.newPage();
      const resp = await tempPage.request.get(url);
      if (resp.ok()) {
        const buffer = await resp.body();
        if (buffer.length > 100) {  // skip tiny/empty placeholders
          const localPath = join(imgDir, 'favicon.ico');
          await writeFile(localPath, buffer);
          topLevelFavicon = {
            src: url,
            localPath: 'assets/img/favicon.ico',
            rel: 'icon',
            sizes: '',
            type: 'image/x-icon',
            ext: 'ico',
            sizeBytes: buffer.length,
            source: 'fallback-/favicon.ico',
          };
          console.log(`✓ Downloaded fallback favicon from /favicon.ico (${buffer.length} bytes)`);
        }
      }
      await tempPage.close();
    } catch { /* ignore */ }
  }
  if (!topLevelFavicon) {
    console.log(`ℹ No favicon found — build should fall back to logo. See FAVICON RULE in SKILL.md.`);
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
    favicon: topLevelFavicon,  // null if no favicon found; build falls back to logo
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
    // Stay on primary domain only — match HOSTNAME, not full origin.
    // Real bug 2026-05-06 (cindysantiqueart.com): start URL was http://;
    // the page's nav had links to http://www.cindysantiqueart.com/cat-...
    // for the main nav AND https://www.cindysantiqueart.com/info-completed-*
    // for the dropdown sub-pages (all 7). The strict origin check
    // (`parsed.origin !== origin`) rejected EVERY https:// link as
    // "different origin" because http://X and https://X have different
    // origins per the URL spec. Result: scraper got 3 pages instead of 30+.
    // The fix is to compare hostnames (with www/non-www folded together)
    // and accept either http or https on the same hostname.
    const startHost = new URL(origin).hostname.replace(/^www\./, '');
    const linkHost  = parsed.hostname.replace(/^www\./, '');
    if (linkHost !== startHost) return null;
    // Skip anchors, file downloads, etc.
    if (parsed.pathname.match(/\.(pdf|zip|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|svg|mp4|mp3)$/i)) return null;
    // Normalize protocol to whatever the start URL used so the visited-set
    // dedupes correctly (otherwise http://X/foo and https://X/foo are
    // treated as two separate pages even though they resolve to the same
    // canonical content).
    const startProto = new URL(origin).protocol;
    parsed.protocol = startProto;
    // Fold www/non-www: rewrite hostname to match origin's form so
    // e.g. www.example.com and example.com don't dedupe as different.
    const startHostnameFull = new URL(origin).hostname;
    parsed.hostname = startHostnameFull;
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

// ---- Analytics / tracking-beacon blocklist (added 2026-05-01 — wyomingmemorialsinc.com bug) ----
//
// Real bug 2026-04-30 (wyomingmemorialsinc.com): scrape.js captured a 1×1
// tracking pixel from t8.prnx.net (an analytics beacon endpoint) as
// img_10.jpg into the must-reuse pool. image-reuse-A failed at 66.7%
// because the tracking pixel was treated as a real photo. Worker filtered
// the manifest manually as a workaround.
//
// First-line defense: never download images from known analytics / beacon
// hosts in the first place. Second line is qa-check.js isMustReusePhoto()
// (file-size + tiny-dimension filter — added in the same commit) which
// catches any host that isn't in this list.
const ANALYTICS_HOSTS = [
  // Adobe / Centro / Adcolony tracking pixels
  'prnx.net',
  'pixel.adsafeprotected.com',
  'pixel.servebom.com',
  'pixel.rubiconproject.com',
  // Google
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'googlesyndication.com',
  'doubleclick.net',
  'g.doubleclick.net',
  // Facebook / Meta
  'connect.facebook.net',
  // Bing / Microsoft
  'bat.bing.com',
  'clarity.ms',
  // Tiktok / Bytedance
  'analytics.tiktok.com',
  // Twitter / X
  't.co',
  'analytics.twitter.com',
  'ads-twitter.com',
  // Misc analytics
  'mc.yandex.ru',
  'mc.yandex.com',
  'static.hotjar.com',
  'script.hotjar.com',
  'cdn.amplitude.com',
  'cdn.segment.com',
  'api.segment.io',
  'cdn.heap.io',
  'cdn.mxpnl.com',
  'api.mixpanel.com',
  'pixel.criteo.com',
  'pixel.quantserve.com',
  'rules.quantcount.com',
  'sb.scorecardresearch.com',
  'b.scorecardresearch.com',
  'pixel.advertising.com',
  // Shopify analytics
  'monorail-edge.shopifysvc.com',
  // Generic patterns: 1×1 .gif endpoints under /pixel/, /track/, /beacon/
];

function isAnalyticsHost(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    for (const blocked of ANALYTICS_HOSTS) {
      if (h === blocked || h.endsWith('.' + blocked)) return true;
    }
    return false;
  } catch { return false; }
}

// Catches URL paths that look like tracking-beacon endpoints regardless of
// host. Used as a secondary filter for hosts not in ANALYTICS_HOSTS but
// whose URL pattern reveals tracking intent.
function looksLikeTrackingPixel(url) {
  try {
    const u = new URL(url);
    // /pixel/, /track/, /beacon/, /collect, /b.gif, /tr/, etc.
    if (/(\/|^)(pixel|track|beacon|collect|tr|p\.gif|b\.gif|t\.gif)(\/|\.|\?|$)/i.test(u.pathname)) return true;
    return false;
  } catch { return false; }
}

const ANALYTICS_PIXEL_BYTE_LIMIT = 200;

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
