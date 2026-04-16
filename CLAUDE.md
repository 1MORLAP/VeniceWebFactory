# WebFactory

Website rebuilding tool. Takes a URL, scrapes the site, and builds two redesigned versions:
- **Option A**: Faithful rebuild (100% original text, dramatically improved design) using Astro + Tailwind v4
- **Option B**: Conversion-optimized redesign using Google Stitch AI for design inspiration, built from scratch with real content + Spanish version with EN/ES language switcher

## Usage

### Manual (single site)
```
/webfactory https://example.com
```

### Stage override
```
/webfactory https://example.com --option-b     # skip to Option B
/webfactory https://example.com --full          # rebuild everything
```

### Smart resume
The skill auto-detects existing work (manifest, Option A, Stitch output) and skips completed stages.

## Project Structure

- `scripts/scrape.js` - Playwright scraper (captures both `<img>` AND CSS `background-image`). Run: `node scripts/scrape.js <url>`
- `scripts/stitch-generate.js` - Automated Stitch API generation (creates project, generates design, downloads HTML + screenshot)
- `scripts/stitch.sh` - Stitch CLI helper for direct tool calls
- `scripts/grab-heroes.js` - Fallback CSS background-image extractor
- `templates/astro-base/` - Astro + Tailwind v4 starter template with upgraded components
- `jobs/{domain}/` - Per-job working directory (manifest, assets, stitch-output, option-a, option-b)
- `SKILL.md` - The Claude Code skill definition (also at `.claude/commands/webfactory.md`)
- `docs/option-a-process.md` - Detailed Option A build process documentation

## Tech Stack

- **Scraping**: Playwright (headless Chromium)
- **Option A output**: Astro 5 + Tailwind CSS 4 (static sites)
- **Option B design**: Google Stitch AI (design inspiration) → hand-built HTML + Tailwind CDN
- **Forms**: mailto: links (no backend)
- **Deploy**: Vercel (via CLI + MCP tools)

## Key Rules

- Option A must preserve 100% of original text
- Option B uses Stitch as INSPIRATION ONLY — never copy Stitch HTML verbatim. Extract the design system (colors, fonts, layout patterns) and build every page from scratch with real manifest content
- Option B must have the SAME NUMBER of pages as Option A (enforced by automated check)
- Option B includes full Spanish translation at /es/ with pill-style EN/ES language switcher
- Full creative freedom on design (colors, typography, layout, even logo treatment)
- Download ALL images: both `<img>` tags AND CSS background-image URLs
- Background images MUST be used as hero section backgrounds
- Primary domain only (no subdomains)
- Auto-deploy to Vercel preview URLs, disable SSO protection after deploy
- Always `cd` to the correct directory before `npx vercel deploy`
- Every piece of user feedback must update SKILL.md so future runs don't repeat it
