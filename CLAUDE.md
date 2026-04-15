# WebFactory

Website rebuilding tool. Takes a URL, scrapes the site, and builds two redesigned versions:
- **Option A**: Faithful rebuild (100% original text, dramatically improved design)
- **Option B**: Conversion-optimized (rewritten for conversions) + Spanish version with EN/ES language switcher

## Usage

### Manual (single site)
```
/webfactory https://example.com
```

### Batch (queue)
Add URLs to `jobs/queue.json`, then process with a scheduled task.

## Project Structure

- `scripts/scrape.js` - Playwright scraper (captures both `<img>` AND CSS `background-image`). Run: `node scripts/scrape.js <url>`
- `templates/astro-base/` - Astro + Tailwind v4 starter template
- `jobs/{domain}/` - Per-job working directory (manifest, assets, builds)
- `SKILL.md` - The Claude Code skill definition (also installed at `.claude/commands/webfactory.md`)

## Tech Stack

- **Scraping**: Playwright (headless Chromium)
- **Output**: Astro 5 + Tailwind CSS 4 (static sites)
- **Forms**: mailto: links (no backend)
- **Deploy**: Vercel (via CLI + MCP tools)

## Key Rules

- Option A must preserve 100% of original text
- Option B must be VISIBLY different from A: conversion copy, trust bar, star badges, Spanish version
- Full creative freedom on design (colors, typography, layout, even logo treatment)
- Download ALL images: both `<img>` tags AND CSS background-image URLs
- Background images MUST be used as hero section backgrounds (the large images behind text)
- Primary domain only (no subdomains)
- Auto-deploy to Vercel preview URLs, disable SSO protection after deploy
- Option A port: 4321, Option B port: 4322
- Always `cd` to the correct directory before `npx vercel deploy`
