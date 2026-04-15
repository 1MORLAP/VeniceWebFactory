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

### Stage 5: Build Option B via Google Stitch (Conversion Optimized + Spanish)

Option B uses **Google Stitch** to generate the visual design, producing a dramatically different and more beautiful result than Option A. This is a semi-automated process: design generation happens in Stitch, extraction and integration is automated.

#### 5a. Prompt the User to Create Stitch Screens

Tell the user:

> **Action needed:** Open [stitch.withgoogle.com](https://stitch.withgoogle.com) and create a new project.
> - Paste the original site URL: `{url}`
> - Create one screen per page (homepage, services, about, contact — or let Stitch decide)
> - Wait for Stitch to finish generating the designs
> - Give me the **project ID** when ready (visible in the URL: `stitch.withgoogle.com/project/{projectId}`)

Wait for the user to provide the Stitch project ID.

#### 5b. Extract Stitch Screens

Once you have the project ID, list the screens and pull the HTML:

```bash
# List available screens
./scripts/stitch.sh list_projects
```

Then for each screen, get the generated HTML:

```bash
./scripts/stitch.sh get_screen_code '{"projectId": "{stitchProjectId}", "screenId": "{screenId}"}'
```

Or export as a full Astro site:

```bash
STITCH_API_KEY="..." npx @_davideast/stitch-mcp site -p {stitchProjectId} -o jobs/{domain}/option-b/
```

#### 5c. Integrate into Astro Project

If Stitch exported an Astro project via `site`, use it directly. Otherwise:

1. Create `jobs/{domain}/option-b/` as an Astro project (copy from `templates/astro-base/`)
2. For each Stitch screen HTML:
   - Extract the `<body>` content (strip `<html>`, `<head>`, `<script>` tags)
   - Place it as the page body inside the BaseLayout
   - Replace Stitch's placeholder text with the **real business content** from the manifest
   - Replace Stitch's placeholder images with the **real downloaded images** from `assets/img/`
   - Preserve the original business phone, email, address, social links
3. Copy Stitch's Tailwind config (colors, fonts, spacing) into `src/styles/global.css` `@theme` block
4. Install dependencies and verify build:
```bash
cd jobs/{domain}/option-b/ && npm install && npm run build
```

#### 5d. Content Optimization

After integrating Stitch's design, optimize the content for conversions:
- Rewrite headlines to be benefit-driven and emotionally compelling
- Rewrite CTAs to be action-oriented ("Get Your Free Quote Now" not "Contact Us")
- Ensure testimonials use the REAL customer quotes from the manifest
- Add trust signals: years in business, satisfaction guarantee, 24/7 availability
- All phone numbers, emails, and links must point to the REAL business

#### 5e. Spanish Version

Create a full Spanish translation at `/es/` routes:

1. Create `src/pages/es/` directory
2. Create Spanish versions of all pages
3. Translate all content to Spanish (headlines, body copy, CTAs, nav items, footer)
4. Keep the same Stitch design/layout — only the text changes

#### 5f. Language Switcher

Add a language switcher to the nav:
- EN/ES toggle button in the header (both desktop and mobile)
- When on English page: "ES" button links to `/es{currentPath}`
- When on Spanish page: "EN" button links to `{currentPath without /es}`
- Nav items translate: Home→Inicio, Services→Servicios, About→Nosotros, Contact→Contacto

#### 5g. Build and Verify

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
4. Fix all issues — pay special attention to:
   - Stitch placeholder text that wasn't replaced with real content
   - Stitch placeholder images that weren't swapped for real photos
   - Broken Stitch CDN image URLs (replace with local images from `assets/img/`)
   - Phone numbers, emails, addresses that still show placeholder values
5. Beauty pass — Stitch designs are already beautiful, but verify they work with real content
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
| Design engine | WebFactory Astro templates | Google Stitch AI |
| Hero headline | {A's headline} | {B's headline} |
| CTAs | {A's CTA text} | {B's CTA text} |
| Trust bar | None | {B's trust bar stats} |
| Language | English only | English + Spanish |
| Visual style | {A's design style} | {Stitch's design style} |

### Design Decisions
**Option A:**
- Style: {design style}
- Color palette: {colors with hex values}
- Typography: {heading font} / {body font}
- Key design features: {list}

**Option B (Stitch):**
- Stitch project ID: {stitchProjectId}
- Design system: {Stitch's design theme description}
- Typography: {Stitch's font choices}
- Key visual features: {glassmorphism, gradients, etc.}

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
- The pipeline is mostly automated. The ONE manual step is: user creates the Stitch project and provides the project ID
- When inspecting screenshots, be a harsh critic. If something looks mediocre, fix it. The bar is "would a designer be proud of this?"
- **IMAGES**: The manifest has BOTH `images` (img tags) and `backgroundImages` (CSS backgrounds). Use background images as hero backgrounds, regular images as inline content. Every page that had a hero background in the original MUST have one in the rebuild
- **DEPLOY**: Always `cd` to the correct project directory before running `npx vercel deploy`. Deploying from the wrong directory will deploy the wrong project
- **SSO**: After deploying, disable Vercel SSO protection so URLs are publicly accessible
- **OPTION B USES STITCH**: Option B is designed by Google Stitch, not our Astro templates. It will look fundamentally different from Option A. After extracting Stitch HTML, replace ALL placeholder content with real business data from the manifest. If any placeholder text or stock images remain, Option B is wrong
- **STITCH CLI**: Use `./scripts/stitch.sh <tool> '<json>'` to call Stitch tools. Key tools: `get_screen_code`, `get_screen_image`, `build_site`, `list_projects`
- **SPANISH**: Option B includes /es/ routes for all pages. The SiteNav component must accept a `lang` prop and show a language toggle button
- **PORT CONFLICT**: Option A uses port 4321, Option B uses port 4322. Set the port in `astro.config.mjs` with `server: { port: 4322 }` for Option B
- **PREVIEW VIEWPORT**: The preview tool may default to a small viewport. Always use `preview_resize` with `width: 1440, height: 900` before taking desktop screenshots
