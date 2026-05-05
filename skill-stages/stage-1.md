# Stage 1 — Scrape & Extract

> **Loaded by**: orchestrator (the main `/webfactory` invocation runs this stage directly — deterministic scripts, no sub-agents).
>
> **Source of truth**: this is the canonical text for Stage 1. The summary in `SKILL.md` is a stub that points here.

### Stage 1: Scrape & Extract

Run the scraper script to crawl the target website and download all content:

```bash
cd /Users/tomasz/WebFactory
node scripts/scrape.js "{{url}}"
```

This creates a job directory at `jobs/{domain}/` containing:
- `manifest.json` - structured data for all pages
- `assets/img/` - downloaded images (both `<img>` tags AND CSS `background-image` URLs)
- `assets/screenshots/` - full-page screenshots of every page

The manifest includes two image arrays per page:
- `images` - standard `<img>` tag images (logos, inline photos, icons)
- `backgroundImages` - CSS background-image URLs (hero backgrounds, section backgrounds)

**CRITICAL**: The `backgroundImages` are the large hero/banner images that appear behind text on each page. These MUST be used as hero section backgrounds in the rebuilt site. They are often the most visually impactful images on the original site.

#### Stage 1b: Fix low-res logo (MANDATORY — always run)

WordPress and many other CMSs serve logos via a favicon-crop URL like `cropped-X-24x8.png` — literally 24×8 pixels — that browsers display at CSS size. The scraper downloads the 24×8 file, and if left alone the rebuilt site shows a blurry blob in the nav. This was a real bug in the fsolsidingcontractor.com run (2026-04-16) and MUST be prevented every time:

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/fix-logo.js $DOMAIN
```

The script reads the manifest, finds the logo candidate (first nav/header image, or filename containing "logo"/"cropped"/"brand"), and if the file on disk is <100px wide it automatically fetches the WordPress high-res variants (stripping the `-WxH` size suffix and the `cropped-` prefix). It writes the replacement file in place and adds a `logo` field to `manifest.json` with verified dimensions.

If the script reports `✗ No better variant found`, note this and inform the user in the final report — the rebuilt site will need either a text-only brand in the nav OR a user-provided logo file.

#### Stage 1c: Detect CMS placeholders (MANDATORY — always run)

After scraping + logo fix, scan the manifest for **template-default placeholder content** the customer never filled in. Sites built on Hibu, Wix, Squarespace, GoDaddy, etc. ship "your content here" defaults that look real to a scraper but represent missing content. Strict preservation of these = shipping placeholders.

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/detect-placeholders.cjs $DOMAIN
```

The script walks every page in the manifest and tags suspicious entries with `_placeholder: { kind, pattern, source, reason }`. It writes:
- **Updated manifest.json** with `_placeholder` tags inline on the offending images, pages, sections, business fields
- **placeholder-report.json** with a grouped summary of every placeholder found

The script's pattern catalog covers (all in one file — `scripts/detect-placeholders.cjs`):
- **Image URLs**: `gen-logo-*` (Hibu), `default-logo`, `your-logo-here`, `placehold.co`, `via.placeholder.com`, `wix-default`, `godaddy-default`, etc.
- **Page slugs**: `/hibu-video-splash`, `/call-or-text-pop`, `/sample-page` (WordPress), `/test-page`, `/your-page`
- **Body copy**: lorem ipsum variants, "Business Tagline Lorem Ipsum Dolor" (Hibu pattern), "Welcome to your new site", "Click here to add", "Add your text here", "This is a sample", "Coming soon", "Under construction"
- **Phone numbers**: 555-0100 to 555-0199 (NANP fiction reserve), 123-456-7890, 000-000-0000
- **Email**: `info@example.com`, `youremail@domain.com`, etc.
- **Addresses**: "123 Main Street", "Your Street Here", "1234 Anytown"

After this stage, every downstream stage (design brief, build A/B/C, QA) reads `_placeholder` tags and reacts:

| Tag kind | Downstream reaction |
|----------|--------------------|
| `logo-placeholder` | Skip in fix-logo, fall back to favicon → plain text |
| `image-placeholder` | Omit from build OR substitute with manifest content |
| `page-placeholder` | Exclude from nav and from page count, don't build the page |
| `copy-tagline-placeholder` | Option B writes a real tagline from manifest facts; A omits the section |
| `copy-lorem` | Omit; never ship lorem ipsum |
| `copy-coming-soon` / `copy-edit-placeholder` | Omit section OR replace with real content from elsewhere in manifest |
| `phone-fiction` / `email-placeholder` / `address-placeholder` | Flag in final report — customer must provide real contact info |

#### Stage 1d: Classify scraped images (MANDATORY — always run)

After placeholder detection, every image record on every page gets a classification tag distinguishing real **content photos** from **chrome** (nav buttons, banner gradients, separator strips, spacer tiles, tracking pixels, decorative ornament). Without this tag, downstream image-pool generation at Stage 2/2.5 risks assigning chrome images to portfolio/catalog/gallery slots — see PORTFOLIO INTEGRITY RULE in SKILL.md.

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/classify-images.cjs $DOMAIN
# Emit the orchestration log entry for the audit trail
CLS_TOTAL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/image-classification.json","utf8")).totalImages)')
CLS_CONTENT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/image-classification.json","utf8")).counts.content)')
CLS_PCT=$(node -e 'const r=JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/image-classification.json","utf8"));console.log((r.counts.content/r.totalImages*100).toFixed(0))')
node scripts/log-decision.cjs "$DOMAIN" 1d images-classified --detail total="$CLS_TOTAL" --detail content="$CLS_CONTENT" --detail contentPct="$CLS_PCT"
```

The script reads `manifest.json`, walks every `pages[*].images[]` record, applies a deterministic 12-rule heuristic classifier (priority-ordered: tracking-pixel → tiny → CSS-bg-extreme-aspect → spacer → placeholder-vocab → line → banner-aspect → nav-vocab → button-shape-low-entropy → logo-thumb → favicon → content default), and writes:

- **Updated manifest.json** with `_class: 'content' | 'nav-button' | 'banner' | 'line' | 'spacer' | 'tracking' | 'tiny' | 'icon'` on every image record
- **image-classification.json** with summary counts per class + 30 sample non-content records per class for audit/debug

The classifier prefers false-positive `content` (a chrome image misclassified as content) over false-negative `content` (a real photo misclassified as chrome) — false-positive content is caught by the post-build `portfolio-integrity` qa-check, while false-negative content silently removes legitimate photos from the build.

##### Downstream reactions (every later stage MUST honor this)

| Image `_class` | Allowed in… |
|----------------|-------------|
| `content` | hero, gallery, portfolio, catalog, service cards, about-the-crew — anywhere |
| `icon` | nav, footer, decorative UI surface; NOT portfolio sections |
| `nav-button`, `banner`, `line`, `spacer`, `tracking`, `tiny` | NOT image-pools; NOT portfolio sections; not rendered AT ALL except in deliberately-framed honest contexts (e.g. "From the original site" colophon footer band, where the worker explicitly frames them as historical artifacts) |

When generating `_image-pools.json` at Stage 2/2.5, filter to `_class === 'content'` for every page's `productPhotos` / `gallery` / `portfolio` / `catalog` slot. The Sonnet sub-agents at Stage 3 / 5 / 7d MUST receive only content-class images for portfolio renders. The `qa-check.js` `portfolio-integrity` rule verifies this post-build and fails any leak.

##### When the classifier is too strict

If the customer's site has an unusually high chrome ratio (e.g. >70% chrome — typically 2009-era table-layout sites with extensive button-graphic navigation), the worker should:

1. Inspect `image-classification.json` — read the sample arrays per class
2. Identify any false-negative `content` records (real photos classified as chrome) by sampling a few from the report
3. Manually override `_class` on specific records in `manifest.json` if needed (rare — the classifier is conservative)
4. If portfolio sections genuinely lack enough real photos, OMIT the section (don't fabricate) and flag in `feedback.md`

Stock-photo substitution is allowed ONLY for Option C per the OPTION C IMAGE-QUALITY ESCAPE HATCH — never for A or B.

#### Stage 1e: Classify video CTAs (MANDATORY when manifest contains video-CTA links)

If the scraper captured any `manifest.pages[*].videoCta.href` (added by scrape.js 2026-05-05 — looks for `<a>` whose text matches /watch|play|view/.*video/i and whose href is NOT a known video-host URL) OR any `manifest.pages[*].videos[*].src` from `<iframe>` / `<video>` tags, classify each into one of 4 preservation variants:

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/inspect-splash.cjs --domain $DOMAIN
```

The script uses Playwright headless to load each video URL, inspects the DOM for native `<video>` elements / known-platform `<iframe>` / placeholder copy, and writes:

- **Updated manifest.json** with `_variant: 'A' | 'B' | 'C' | 'D'` on every videoCta + page.videos[] entry
- **video-classification.json** summary report

If `--domain` mode finds no video URLs, it exits 0 cleanly with `"No video CTAs found"` — Stage 1e silently no-ops on customers without videos (most sites).

##### Variant table

| Variant | What it is | Build-time action |
|---|---|---|
| **A** | Direct MP4/WebM/MOV in a `<video>` source | `transcode-video.cjs <src> jobs/{domain}/option-X/public/videos/<slug>.mp4` per option, then render an inline self-hosted `<video>` (Variant A pattern in `templates/REQUIRED-PATTERNS.md` section 8.2) |
| **B** | HLS stream (`.m3u8`) in a `<video>` source | Same `transcode-video.cjs` (ffmpeg reads .m3u8 directly via HTTP demuxer, remuxes to MP4). Self-host. |
| **C** | Known-platform `<iframe>` (YouTube/Vimeo/Brightcove/JW/Vidyard/Wistia/Loom) | Re-embed cleanly with aspect-ratio wrapper + lazy load (Variant C pattern in REQUIRED-PATTERNS.md section 8.4). NO transcode. |
| **D** | Hibu/Wix/template placeholder (no real video on splash page) | Drop the CTA entirely. Replace with phone CTA / image gallery / before-after carousel / testimonial card. |

##### ffmpeg as soft dependency

`transcode-video.cjs` checks for `ffmpeg` on PATH. Absent → script warns and exits 0 (graceful degradation). Build falls back to rendering an `<a href={original}>` link to the original splash URL — better than dropping a real video, worse than self-hosting. Operator can install ffmpeg later (`brew install ffmpeg` / `apt install ffmpeg`) and re-run Stage 1e + the affected per-page workers.

##### Skip-if-no-videos

If `--domain` mode reports 0 video URLs, Stage 1e is a no-op for this build. Skip directly to Stage 2.
