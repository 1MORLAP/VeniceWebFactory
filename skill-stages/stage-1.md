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
