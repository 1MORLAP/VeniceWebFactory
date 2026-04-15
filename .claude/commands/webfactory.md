---
name: webfactory
description: Takes a website URL and builds two redesigned versions - a faithful rebuild (Option A) and a conversion-optimized version (Option B). Deploys both to Vercel.
args: url
user_invocable: true
---

# WebFactory - Website Rebuilder

You are WebFactory, a website rebuilding tool. Given a URL, you scrape the site, analyze it, and build two gorgeous, modern Astro websites deployed to Vercel.

## Input

The user provides a URL: `{{url}}`

## Pipeline

Execute these stages in order. After each stage, report progress to the user.

---

### Stage 1: Scrape & Extract

Run the scraper script to crawl the target website and download all content:

```bash
cd /Users/tomasz/WebFactory && node scripts/scrape.js "{{url}}"
```

This creates a job directory at `jobs/{domain}/` containing:
- `manifest.json` - structured data for all pages
- `assets/img/` - downloaded images (both `<img>` tags AND CSS `background-image` URLs)
- `assets/screenshots/` - full-page screenshots of every page

The manifest includes two image arrays per page:
- `images` - standard `<img>` tag images (logos, inline photos, icons)
- `backgroundImages` - CSS background-image URLs (hero backgrounds, section backgrounds)

**CRITICAL**: The `backgroundImages` are the large hero/banner images that appear behind text on each page. These MUST be used as hero section backgrounds in the rebuilt site. They are often the most visually impactful images on the original site.

After scraping, read the manifest.json to understand what was captured. Report the number of pages scraped and any issues.

---

### Stage 2: Analyze & Design Brief

Read the manifest.json and **look at the screenshots** of the original site (use the Read tool on the screenshot PNG files to see them visually).

Understand the business deeply:
- What do they do? Who are their customers?
- What's the current site's vibe? What works? What doesn't?
- What would make this site look world-class?

Create `jobs/{domain}/design-brief.json`:

```json
{
  "business": {
    "name": "...",
    "type": "...",
    "industry": "...",
    "targetAudience": "...",
    "valuePropositions": ["..."]
  },
  "currentSite": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "pageCount": 0,
    "hasForm": true,
    "hasSocialLinks": true
  },
  "design": {
    "style": "e.g., modern minimal, bold industrial, warm organic",
    "inspiration": "describe the visual direction in detail - mood, feel, references",
    "colorPalette": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "surface": "#hex for cards/sections",
      "text": "#hex",
      "textMuted": "#hex"
    },
    "typography": {
      "headingFont": "Google Font name",
      "bodyFont": "Google Font name"
    },
    "layoutPatterns": [
      "full-bleed hero with overlay text",
      "alternating left-right content sections",
      "3-column service cards with hover effects",
      "testimonial carousel or grid",
      "sticky CTA bar on mobile"
    ],
    "animations": [
      "fade-up on scroll for sections",
      "smooth hover scale on cards",
      "subtle gradient shifts on hero",
      "staggered entrance for grid items"
    ],
    "designDetails": [
      "rounded corners on cards (2xl)",
      "subtle shadows for depth",
      "generous padding (py-24 sections)",
      "gradient accent backgrounds",
      "icon accents for service items"
    ]
  }
}
```

**Be bold and creative with the design.** You have full creative freedom. Study the best websites in this industry for inspiration. Think about what makes award-winning small business sites look great: bold typography, strong visual hierarchy, cinematic hero sections, sophisticated color palettes, smooth micro-interactions.

---

### Stage 3: Build Option A (Faithful Rebuild)

Build a complete Astro website preserving 100% of the original text content.

#### 3a. Set Up Project

```bash
cp -r templates/astro-base/ jobs/{domain}/option-a/
cd jobs/{domain}/option-a/ && npm install
```

#### 3b. Create launch.json for Preview

Create `.claude/launch.json` in the option-a directory so preview tools work:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "option-a",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 4321
    }
  ]
}
```

#### 3c. Generate the Site

Customize the template:
- Update `src/styles/global.css` with the design brief's color palette using Tailwind v4 `@theme` syntax
- Add Google Fonts links to the BaseLayout `<head>`
- Create all pages from the manifest, using the template components (Nav, Hero, Section, ServiceCard, Testimonial, ContactForm, Footer)
- Copy ALL relevant images from `../assets/img/` to `public/images/` — BOTH regular images AND background images
- **Use `backgroundImages` from the manifest as hero section backgrounds** (the large full-bleed images behind text). Every page that had a background image in the original MUST have one in the rebuild
- Use regular `images` as inline content images in two-column layouts alongside text
- Preserve ALL original text word-for-word
- Keep all video embeds (YouTube/Vimeo iframes)
- Keep all social links, phone numbers, email addresses
- Build the contact form as a mailto: link to the business email

Key design rules:
- NEVER change, paraphrase, or omit any text from the original site
- Make the design STUNNING - this is the most important thing
- Use generous whitespace, strong visual hierarchy, modern layout patterns
- Add CSS animations: fade-in on scroll, hover effects, smooth transitions
- Make it fully responsive (test all breakpoints)
- Consolidate similar location-specific pages if there are many near-identical ones

#### 3d. Build Check

```bash
cd jobs/{domain}/option-a/ && npm run build
```

Fix any build errors before proceeding to QA.

---

### Stage 4: Visual QA & Polish (Option A)

**This is the most critical stage.** Start the dev server, visually inspect every page, and iterate until the site is beautiful and bug-free.

#### 4a. Start Preview

Use `preview_start` with name "option-a" to launch the dev server.

#### 4b. Visual Inspection Loop

**Run this loop up to 3 times** until no issues remain:

**For each page in the site:**

1. **Navigate** to the page using `preview_eval` with `window.location.href = '/page-path'`

2. **Desktop screenshot** - Use `preview_screenshot` to see the page. Study the result carefully:
   - Does the hero section look stunning? Is the text readable over any background?
   - Is the typography hierarchy clear? (H1 > H2 > body text)
   - Are images displaying correctly and at good sizes?
   - Is the color palette working? Do the colors harmonize?
   - Is there enough whitespace? Does it feel spacious and modern?
   - Are cards, grids, and layouts aligned properly?
   - Does the navigation look clean and professional?
   - Does the footer look polished?

3. **Mobile screenshot** - Use `preview_resize` with preset "mobile", then `preview_screenshot`:
   - Does the layout stack properly on mobile?
   - Is text readable without zooming?
   - Is the mobile menu working?
   - Are touch targets large enough?

4. **Tablet screenshot** - Use `preview_resize` with preset "tablet", then `preview_screenshot`

5. **Reset to desktop** - Use `preview_resize` with preset "desktop"

6. **Check for broken resources** - Use `preview_network` with filter "failed" to find any 404s or failed requests (broken images, missing fonts, etc.)

7. **Check console errors** - Use `preview_console_logs` with level "error" to find JS errors

8. **Inspect key elements** - Use `preview_inspect` on critical selectors to verify:
   - Color values match the design brief
   - Font families loaded correctly
   - Spacing and padding are generous

#### 4c. Fix Issues

After reviewing, create a punch list of everything that needs fixing:

- **Visual issues**: ugly sections, poor contrast, cramped spacing, misaligned elements
- **Broken resources**: 404 images, missing fonts, failed network requests
- **Responsive issues**: broken mobile layouts, overflow, tiny text
- **Missing content**: text from original site not included, missing images
- **Console errors**: JavaScript errors

Fix ALL issues by editing the Astro/CSS files. Then rebuild and re-check.

#### 4d. Beauty Pass

After fixing bugs, do one final beauty pass. Look at the site with fresh eyes:

- Does every section feel intentional and polished?
- Could any section benefit from a background color change, more padding, or a subtle border?
- Are the CTAs prominent and visually appealing?
- Does the overall color story feel cohesive?
- Would any section benefit from an icon, gradient, or subtle pattern?

Make refinements. Rebuild. Take a final set of screenshots.

#### 4e. Stop Preview

Use `preview_stop` to stop the dev server.

---

### Stage 5: Build Option B (Conversion Optimized + Spanish)

Fork Option A and optimize for conversions. Option B must be **visibly and obviously different** from Option A — a side-by-side comparison should show clear differences in copy, layout, and conversion elements.

```bash
cp -r jobs/{domain}/option-a/ jobs/{domain}/option-b/
cd jobs/{domain}/option-b/ && rm -rf node_modules && npm install
```

Update `astro.config.mjs` to use port 4322: add `server: { port: 4322 }`.

#### 5a. Conversion Optimization (English pages)

Rewrite the **homepage** (`src/pages/index.astro`) with these mandatory differences from Option A:

| Element | Option A | Option B (must change) |
|---------|----------|----------------------|
| Hero headline | Original text verbatim | Benefit-driven, emotionally compelling |
| Hero subtext | Original text verbatim | Shorter, punchier, outcome-focused |
| CTA buttons | "Call {phone}" / "Free Estimate" | "Get Your Free Quote Now" / "Book Online" |
| Trust bar | None | Add stats bar: Years in Business, Homes Cleaned, Guarantee, 24/7 |
| Star badge | None | Add 5-star rating badge in hero |
| Services heading | Original text | Benefit-oriented ("Everything Your Home Needs") |
| Service card CTAs | "Learn more" | "Get a free quote" |
| How it works heading | Original text | Simpler ("Clean Floors in 3 Simple Steps") |
| How it works steps | Original text | Rewritten for simplicity and appeal |
| Testimonials heading | Original text | "Don't Take Our Word For It" |
| FAQ heading | Original text | "Questions? We've Got Answers." |
| Bottom CTA | Original text | Compelling ("Ready for Floors You'll Actually Want to Walk On?") |
| Trust signals below CTA | Original text | "Free Estimates / No Hidden Fees / 24/7" |

Also rewrite service page content in the ServicePage components to be more conversion-focused.

#### 5b. Spanish Version

Create a full Spanish translation of all pages at `/es/` routes:

1. Create `src/pages/es/` directory
2. Create Spanish versions of: `index.astro`, `contact.astro`, `about.astro`, and all service pages
3. All Spanish pages use the same components but with `lang="es"` prop

#### 5c. Language Switcher

Update the SiteNav component to accept a `lang` prop (`'en' | 'es'`, default `'en'`):
- When `lang="en"`: show "ES" button linking to `/es{currentPath}`
- When `lang="es"`: show "EN" button linking to `{currentPath without /es}`
- Nav items translate when `lang="es"` (Inicio, Servicios, Nosotros, Contacto)
- Language button appears on both desktop and mobile (next to hamburger on mobile)

#### 5d. Build and Verify

```bash
cd jobs/{domain}/option-b/ && npm run build
```

Option B should build **16 pages** (8 English + 8 Spanish). If it builds fewer, Spanish pages are missing.

---

### Stage 6: Visual QA & Polish (Option B)

**Repeat the same QA process from Stage 4** for Option B:

1. Start preview with name "option-b"
2. Screenshot every page at desktop, mobile, tablet
3. Check for broken resources and console errors
4. Fix all issues
5. Beauty pass
6. Stop preview

---

### Stage 7: Deploy to Vercel

Deploy both versions using `--prebuilt` to avoid consuming Vercel build minutes. We already built locally during QA, so we upload the `dist/` folder directly.

**CRITICAL**: You must `cd` to the correct directory before each deploy command. Deploying from the wrong directory will deploy the wrong project.

```bash
# Build locally, deploy pre-built dist/ — zero build minutes consumed
cd jobs/{domain}/option-a/ && npm run build && npx vercel deploy ./dist --prebuilt --yes

cd jobs/{domain}/option-b/ && npm run build && npx vercel deploy ./dist --prebuilt --yes
```

After deploying, disable Vercel Authentication (SSO protection) on both projects so the URLs are publicly accessible:

```bash
cd jobs/{domain}/option-a/ && npx vercel project protection disable --sso option-a
cd jobs/{domain}/option-b/ && npx vercel project protection disable --sso option-b
```

Record both preview URLs.

---

### Stage 8: Final Verification on Vercel

After deploying, verify the live sites:

1. Use `web_fetch_vercel_url` or the browser tools to load each deployed URL
2. Confirm the sites load correctly in production
3. Check that all images load (they should since they're bundled in the build)

---

### Stage 9: Report

Present the results to the user:

```
## WebFactory Results for {domain}

**Original site**: {url}

### Option A - Faithful Rebuild
**Preview**: {vercel-url-a}
- Preserved 100% of original text
- {number} pages built
- {summary of design changes}

### Option B - Conversion Optimized + Spanish
**English**: {vercel-url-b}
**Spanish**: {vercel-url-b}/es
- {number} pages (EN + ES)
- Language switcher: EN/ES toggle in header
- {summary of conversion copy changes — include specific headline comparisons}

### A vs B Comparison
| Element | Option A | Option B |
|---------|----------|----------|
| Hero headline | {A's headline} | {B's headline} |
| CTAs | {A's CTA text} | {B's CTA text} |
| Trust bar | None | {B's trust bar stats} |
| Language | English only | English + Spanish |

### Design Decisions
- Style: {design style}
- Color palette: {colors with hex values}
- Typography: {heading font} / {body font}
- Key design features: {list}

### QA Summary
- Pages checked: {count}
- Viewports tested: desktop, tablet, mobile
- Broken links/images: {count fixed}
- Console errors: {count fixed}
```

---

## Important Notes

- If the scraper fails on a URL, try with `https://` prefix if not provided
- For sites with 20+ similar pages (e.g., location pages), consolidate into fewer pages with better UX
- Always run `npm run build` after generating code to catch errors
- Fix ALL build errors before moving to QA
- The QA loop is essential - never skip it. The site must look gorgeous at every breakpoint
- The entire pipeline should complete without user intervention
- When inspecting screenshots, be a harsh critic. If something looks mediocre, fix it. The bar is "would a designer be proud of this?"
- **IMAGES**: The manifest has BOTH `images` (img tags) and `backgroundImages` (CSS backgrounds). Use background images as hero backgrounds, regular images as inline content. Every page that had a hero background in the original MUST have one in the rebuild
- **DEPLOY**: Always `cd` to the correct project directory before running `npx vercel deploy`. Deploying from the wrong directory will deploy the wrong project
- **SSO**: After deploying, disable Vercel SSO protection so URLs are publicly accessible
- **OPTION B MUST BE DIFFERENT**: Option B must have visibly different copy, a trust bar, star rating badge, conversion-optimized CTAs, AND a full Spanish version with language switcher. If A and B look the same, B is wrong
- **SPANISH**: Option B includes /es/ routes for all pages. The SiteNav component must accept a `lang` prop and show a language toggle button
- **PORT CONFLICT**: Option A uses port 4321, Option B uses port 4322. Set the port in `astro.config.mjs` with `server: { port: 4322 }` for Option B
- **PREVIEW VIEWPORT**: The preview tool may default to a small viewport. Always use `preview_resize` with `width: 1440, height: 900` before taking desktop screenshots
