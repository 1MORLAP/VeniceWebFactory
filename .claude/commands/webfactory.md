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

## Pre-flight: Verify Unattended Mode

Before starting, confirm the pipeline can run without permission prompts:

```bash
# Verify settings.json has wildcard permissions
grep -c 'Bash(\*)' .claude/settings.json && echo "✓ Bash permissions OK" || echo "✗ Fix .claude/settings.json"
```

If this fails, write `.claude/settings.json` with wildcard permissions for all tools before proceeding.

## Smart Resume: Check What Already Exists

Before running the full pipeline, check what's already been built for this domain. Skip completed stages:

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
echo "=== Checking existing work for $DOMAIN ==="

# Stage 1: Scrape
[ -f "jobs/$DOMAIN/manifest.json" ] && echo "✓ Stage 1 (Scrape): DONE — manifest.json exists" || echo "○ Stage 1 (Scrape): NEEDED"

# Stage 2: Design brief
[ -f "jobs/$DOMAIN/design-brief.json" ] && echo "✓ Stage 2 (Design Brief): DONE" || echo "○ Stage 2 (Design Brief): NEEDED"

# Stage 3: Option A
[ -d "jobs/$DOMAIN/option-a/src/pages" ] && echo "✓ Stage 3 (Option A Build): DONE — $(ls jobs/$DOMAIN/option-a/src/pages/*.astro 2>/dev/null | wc -l | tr -d ' ') pages" || echo "○ Stage 3 (Option A Build): NEEDED"

# Stage 5a: Stitch generation
[ -d "jobs/$DOMAIN/stitch-output" ] && [ "$(ls jobs/$DOMAIN/stitch-output/*.html 2>/dev/null | wc -l)" -gt 0 ] && echo "✓ Stage 5a (Stitch Generation): DONE" || echo "○ Stage 5a (Stitch Generation): NEEDED"

# Stage 5: Option B
[ -d "jobs/$DOMAIN/option-b/public" ] && echo "✓ Stage 5 (Option B Build): DONE — $(find jobs/$DOMAIN/option-b/public -maxdepth 1 -name '*.html' 2>/dev/null | wc -l | tr -d ' ') EN + $(find jobs/$DOMAIN/option-b/public/es -name '*.html' 2>/dev/null | wc -l | tr -d ' ') ES pages" || echo "○ Stage 5 (Option B Build): NEEDED"
```

**Rules for skipping:**
- If `manifest.json` exists → skip Stage 1 (scrape)
- If `design-brief.json` exists → skip Stage 2
- If `option-a/src/pages/` has .astro files AND `option-a/dist/` exists → skip Stages 3-4 (Option A build + QA)
- If `stitch-output/*.html` exists → skip Stage 5a (Stitch generation), go straight to 5c (integration)
- If `option-b/public/` has HTML files → verify page count matches Option A. If it does, skip to deploy. If not, rebuild Option B.
- **NEVER skip Stage 5h (completeness check) or Stage 6 (QA)** — always run these even on resume

Report what will be skipped and what will be built, then proceed with the first needed stage.

## Pipeline

Execute these stages in order (skipping completed ones per above). After each stage, report progress to the user.

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

Option B uses **Google Stitch AI** to generate the visual design. The pipeline is fully automated — no manual steps. Stitch produces one gorgeous single-page HTML, and we then expand it into a full multi-page site with real content.

#### 5a. Generate Stitch Design via API

Run the automated Stitch generation script. It reads the manifest, builds a prompt from the real business data, creates a Stitch project, generates the design, and downloads the HTML + screenshot:

```bash
node scripts/stitch-generate.js {domain}
```

This produces:
- `jobs/{domain}/stitch-output/{screenId}.html` — the generated HTML
- `jobs/{domain}/stitch-output/{screenId}.png` — screenshot of the design
- `jobs/{domain}/stitch-output/design-system.json` — Stitch's design tokens
- `jobs/{domain}/stitch-output/metadata.json` — project ID, business info

**Verify**: Look at the screenshot PNG to confirm the design generated correctly before proceeding. If it looks wrong, delete the stitch-output folder and re-run with a refined prompt.

#### 5c. Set Up Option B Project Structure

Option B is a static HTML site (not Astro) because Stitch generates complete self-contained HTML with Tailwind CDN:

```bash
mkdir -p jobs/{domain}/option-b/public/images
mkdir -p jobs/{domain}/option-b/public/es

# Copy all real images
cp jobs/{domain}/option-a/public/images/* jobs/{domain}/option-b/public/images/

# Copy Stitch HTML as the homepage
cp jobs/{domain}/stitch-output/screen.html jobs/{domain}/option-b/public/index.html
```

#### 5d. Content Replacement (CRITICAL — Do Every Item)

The Stitch HTML contains placeholder content. You MUST replace ALL of it with real data from the manifest. Go through the HTML and fix **every single item** in this checklist:

**Identity & branding:**
- [ ] Replace Stitch's company name with the REAL business name (check nav, footer, all headings)
- [ ] Replace nav text logo with `<img src="/images/logo.png">` (both nav and footer)
- [ ] Replace footer logo similarly

**Contact info:**
- [ ] ALL phone numbers → real phone from manifest (check nav CTA, hero, service cards, contact section, footer)
- [ ] ALL email addresses → real email from manifest
- [ ] ALL `href="tel:..."` links → correct phone
- [ ] ALL `href="mailto:..."` links → correct email

**Testimonials:**
- [ ] Replace ALL Stitch placeholder testimonial quotes with REAL quotes from the manifest
- [ ] Replace ALL placeholder reviewer names with REAL names from manifest
- [ ] Replace ALL placeholder reviewer titles/locations with real ones
- [ ] Add avatar initial letters (first letter of real name)
- [ ] Remove any Stitch placeholder avatar images (Google CDN URLs)

**Images:**
- [ ] Replace hero background image URL (Stitch CDN) with `/images/hero-home-room.jpg` (or appropriate local hero image)
- [ ] Remove ALL remaining `lh3.googleusercontent.com` image URLs — replace with local images or remove
- [ ] Verify no broken image references remain

**Links:**
- [ ] Replace ALL `href="#"` placeholder links in footer with real page links or `#services`, `#faqs`, etc.
- [ ] Service card "Learn More" links → link to real service pages or anchor sections
- [ ] Add social media links from manifest (Facebook, etc.)

**Form:**
- [ ] Add `name` attributes to all form `<input>` and `<textarea>` elements
- [ ] Add `mailto:` action to the form (see Option A contact page for the pattern)
- [ ] Ensure form has: name, email, phone, message fields at minimum

**Mobile navigation:**
- [ ] Add a hamburger menu button for mobile (the Stitch nav likely hides links on mobile with `hidden md:flex`)
- [ ] Add a mobile menu drawer with all nav links
- [ ] Add mobile sticky CTA bar (fixed bottom, phone number)

**Footer:**
- [ ] Replace Stitch footer company description with real business description
- [ ] Add real service area cities
- [ ] Fix copyright year to current year
- [ ] Add real social links

**Meta / head:**
- [ ] Add `<title>` tag with business name
- [ ] Add `<meta name="description">` with real description
- [ ] Add `<link rel="icon" type="image/png" href="/images/logo.png">`

#### 5e. Build Additional Pages (MANDATORY — DO NOT SKIP)

Stitch generates ONE page. **You MUST create every page that exists in Option A.** This is not optional.

**Step 1: List the required pages from Option A:**

```bash
ls jobs/{domain}/option-a/src/pages/*.astro | sed 's|.*/||; s|\.astro||'
```

This gives you the exact page list. Every page in that list MUST exist in Option B.

**Step 2: For each page beyond index.html, create it:**

The approach: duplicate `index.html`, then replace the `<main>` body content. Keep everything else identical (same `<head>`, same `<nav>`, same `<footer>`, same design system).

For each service page (e.g., `carpet-cleaning.html`):
1. Copy `index.html` to `{page-slug}.html`
2. Update the `<title>` tag to match the page's title from the manifest
3. Replace everything between `</nav>` and `<footer>` with:
   - A hero section using the page's hero background image (from `public/images/hero-{page}.{ext}`)
   - The page's full text content from the manifest (headings, paragraphs, lists)
   - An inline image from `public/images/` in a two-column layout
   - A CTA section with the phone number
4. Keep the same `<nav>` and `<footer>` exactly as the homepage
5. Update nav links: service card links on the homepage should point to these pages

For the about page:
- Hero with van photo background
- Mission/why-choose-us content from manifest
- Service list with links

For the contact page:
- Contact form (name, email, phone, message) with mailto action
- Phone number, email, service area info
- No hero needed — use a colored header section

**Step 3: Verify page count matches:**

```bash
OPTION_A_PAGES=$(ls jobs/{domain}/option-a/src/pages/*.astro | wc -l)
OPTION_B_EN_PAGES=$(find jobs/{domain}/option-b/public -maxdepth 1 -name "*.html" | wc -l)
echo "Option A: $OPTION_A_PAGES pages"
echo "Option B EN: $OPTION_B_EN_PAGES pages"
if [ "$OPTION_B_EN_PAGES" -lt "$OPTION_A_PAGES" ]; then
  echo "FAIL: Option B has fewer pages than Option A. Build the missing pages before continuing."
  exit 1
fi
```

**DO NOT proceed to Stage 5f until this check passes.**

#### 5f. Spanish Version

Duplicate EVERY English page to `/es/`:

```
public/es/index.html      ← copy of public/index.html, translated
public/es/about.html       ← copy of public/about.html, translated
public/es/contact.html     ← copy of public/contact.html, translated
public/es/carpet-cleaning.html  ← etc.
```

**Translation rules:**
- Translate ALL visible text: headings, body copy, CTAs, nav items, footer text, form labels, placeholders
- Do NOT translate: phone numbers, email addresses, business name, URLs
- Change `lang="en"` to `lang="es"` in the `<html>` tag
- Change the language switcher from "ES → /es/" to "EN → /"

**Common missed translations** (check every one):
- [ ] Service card descriptions
- [ ] Testimonial quotes (translate the quote, keep the real reviewer name)
- [ ] FAQ questions AND answers
- [ ] Form field labels and placeholders
- [ ] CTA button text
- [ ] Footer section headings and link text
- [ ] Mobile menu items
- [ ] "Copyright" and footer legal text

#### 5g. Language Switcher

Add to the nav bar on EVERY page (both English and Spanish):
- Desktop: `ES` or `EN` button between the last nav link and the phone CTA
- Mobile: same button next to the hamburger icon

On English pages: `<a href="/es/{current-page}.html">ES</a>`
On Spanish pages: `<a href="/{current-page}.html">EN</a>`

#### 5h. Pre-Deploy Completeness Check (BLOCKING — ALL MUST PASS)

Before proceeding to QA, run this automated check. **If ANY check fails, go back and fix it. Do NOT deploy with failures.**

```bash
DOMAIN="{domain}"
PHONE="{real_phone}"
EMAIL="{real_email}"
OPTION_A_COUNT=$(ls jobs/$DOMAIN/option-a/src/pages/*.astro | wc -l | tr -d ' ')

echo "=== PAGE COUNT CHECK ==="
EN_COUNT=$(find jobs/$DOMAIN/option-b/public -maxdepth 1 -name "*.html" | wc -l | tr -d ' ')
ES_COUNT=$(find jobs/$DOMAIN/option-b/public/es -name "*.html" 2>/dev/null | wc -l | tr -d ' ')
echo "Option A pages: $OPTION_A_COUNT"
echo "Option B EN pages: $EN_COUNT"
echo "Option B ES pages: $ES_COUNT"

if [ "$EN_COUNT" -lt "$OPTION_A_COUNT" ]; then
  echo "✗ FAIL: Option B EN ($EN_COUNT) has fewer pages than Option A ($OPTION_A_COUNT)"
fi
if [ "$ES_COUNT" -lt "$EN_COUNT" ]; then
  echo "✗ FAIL: Option B ES ($ES_COUNT) has fewer pages than EN ($EN_COUNT)"
fi
if [ "$EN_COUNT" -ge "$OPTION_A_COUNT" ] && [ "$ES_COUNT" -ge "$EN_COUNT" ]; then
  echo "✓ Page count OK"
fi

echo ""
echo "=== PER-PAGE CHECKS ==="
FAIL=0
for f in $(find jobs/$DOMAIN/option-b/public -name "*.html"); do
  PAGE=$(echo "$f" | sed "s|.*/public/||")
  ERRORS=""

  grep -q "$PHONE" "$f" || ERRORS="$ERRORS phone-missing"
  grep -q "/images/logo" "$f" || ERRORS="$ERRORS logo-missing"
  grep -q "lh3.googleusercontent.com" "$f" && ERRORS="$ERRORS stitch-cdn-images"
  grep -q "mobile-menu" "$f" || ERRORS="$ERRORS no-mobile-menu"

  if [ -z "$ERRORS" ]; then
    echo "  ✓ $PAGE"
  else
    echo "  ✗ $PAGE:$ERRORS"
    FAIL=$((FAIL+1))
  fi
done

echo ""
if [ "$FAIL" -gt 0 ] || [ "$EN_COUNT" -lt "$OPTION_A_COUNT" ] || [ "$ES_COUNT" -lt "$EN_COUNT" ]; then
  echo "========================================="
  echo "  ✗ COMPLETENESS CHECK FAILED"
  echo "  Fix all issues before deploying."
  echo "========================================="
else
  echo "========================================="
  echo "  ✓ ALL CHECKS PASSED — ready for deploy"
  echo "========================================="
fi
```

**Hard fail criteria** (deployment is BLOCKED if any are true):
- EN page count < Option A page count
- ES page count < EN page count
- Any page missing the real phone number
- Any page missing the logo
- Any page has Stitch CDN placeholder images (`lh3.googleusercontent.com`)
- Any page missing mobile menu

---

### Stage 6: Visual QA & Polish (Option B)

**Run this QA process. Do not skip any step.**

#### 6a. Start Preview

Serve the static files:
```bash
cd jobs/{domain}/option-b && npx serve public -l 4322
```
(Or use `preview_start` if launch.json is configured)

#### 6b. Automated Content Verification

Before visual inspection, run the completeness check from Stage 5h. If any checks fail, fix them FIRST.

#### 6c. Visual Inspection Loop (Run Up to 3 Times)

**For EACH page** (EN homepage, EN service pages, EN about, EN contact, ES homepage, at minimum):

1. **Desktop screenshot** (1440x900):
   - Hero: Is it stunning? Real background image showing? Text readable?
   - Nav: Logo visible? Links work? Phone CTA visible? Language switcher visible?
   - Services: All cards present? Icons showing? Descriptions are real content?
   - Testimonials: REAL customer names and quotes (not Stitch placeholders)?
   - FAQ: Accordion works? Real questions from manifest?
   - Contact: Form fields present with labels? Phone and email correct?
   - Footer: Real logo? Real service links? Real contact info? Real social links?

2. **Mobile screenshot** (375x812):
   - Hamburger menu present and working?
   - Mobile sticky CTA bar with phone number?
   - Text readable without zooming?
   - Hero not broken on small screens?
   - Form usable on mobile?

3. **Check for broken resources**:
   ```bash
   # In preview tool
   preview_network filter="failed"
   ```
   Any 404 = broken image or resource. Fix immediately.

4. **Check console errors**:
   ```bash
   preview_console_logs level="error"
   ```

5. **Link verification**: Click every nav link, every service card link, every footer link, the language switcher. All must work.

#### 6d. Fix All Issues

Create a punch list. Fix EVERY item. Common Option B issues:

| Issue | How to fix |
|-------|-----------|
| Stitch placeholder image in hero | Replace `src="https://lh3.googleusercontent.com/..."` with `src="/images/hero-home-room.jpg"` |
| "Sarah Jenkins" in testimonial | Replace with real customer name from manifest |
| `href="#"` dead links | Replace with real page URL or anchor |
| No mobile menu | Add hamburger button + hidden menu drawer with JS toggle |
| English text on Spanish page | Translate the missed strings |
| Form doesn't submit | Add `name` attributes to inputs, add `mailto:` onsubmit handler |
| Footer says "info@company.com" | Replace with real email |

#### 6e. Re-run Automated Check

After fixing, re-run the completeness check from Stage 5h. ALL must pass.

#### 6f. Final Beauty Pass

Look at the site with fresh eyes:
- Does it look VISIBLY DIFFERENT from Option A? (Different design system, different typography, different layout)
- Is the Stitch design quality preserved? (Glassmorphism, Material icons, design tokens all working?)
- Does the Spanish version look natural? (No mixed languages, proper accents/characters?)

#### 6g. Stop Preview

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
