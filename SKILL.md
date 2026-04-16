---
name: webfactory
description: Takes a website URL and builds two redesigned versions - a faithful rebuild (Option A) and a conversion-optimized version (Option B). Deploys both to Vercel.
args: url
user_invocable: true
---

# WebFactory - Website Rebuilder

You are WebFactory, a website rebuilding tool. Given a URL, you scrape the site, analyze it, and build two gorgeous, modern Astro websites deployed to Vercel.

## Input

The user provides a URL, optionally followed by a stage override: `{{url}}`

Parse the input:
- If input contains just a URL → run Smart Resume (auto-detect what to skip)
- If input contains `--option-b` or `--stage 5` or the user says "start at Option B" → skip directly to Stage 5
- If input contains `--option-a` or `--stage 3` → skip to Stage 3
- If input contains `--deploy` or `--stage 7` → skip to Stage 7
- If input contains `--full` → run everything from scratch, ignore existing work

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

Option B uses **Google Stitch AI** as design inspiration. Stitch generates a single-page design with a unique visual system. We then **extract its design language** and **build all pages from scratch** using real content from the manifest. We NEVER copy Stitch HTML verbatim — it's a mood board, not a template.

#### 5a. Generate Stitch Design via API

Run the automated Stitch generation script:

```bash
node scripts/stitch-generate.js {domain}
```

This produces:
- `jobs/{domain}/stitch-output/{screenId}.html` — the generated HTML (design reference only)
- `jobs/{domain}/stitch-output/{screenId}.png` — screenshot of the design
- `jobs/{domain}/stitch-output/design-system.json` — Stitch's design tokens
- `jobs/{domain}/stitch-output/metadata.json` — project ID, business info

**Verify**: Look at the screenshot PNG to confirm the design looks good. If not, delete stitch-output and re-run.

#### 5b. Extract Design System from Stitch (CRITICAL)

Read the Stitch HTML and screenshot. **Do NOT copy the HTML.** Instead, extract these design decisions into a mental model:

1. **Color tokens** — Read the `tailwind.config` from Stitch HTML. Note the primary, secondary, surface, and accent colors. You'll replicate these in your own Tailwind config.
2. **Typography** — Note the font families (headline vs body), weights, and sizing patterns.
3. **Component patterns** — Study how Stitch designed: hero sections, service cards, testimonial cards, FAQ accordions, contact forms, footer layout. Note border radius, shadows, spacing, icon usage.
4. **Visual effects** — Glassmorphism, gradients, backdrop blur, hover animations, Material Symbols icons.
5. **Layout structure** — How sections alternate backgrounds, max-width, padding patterns.

Write down a brief summary of the design system you'll be building with. This becomes your style guide.

#### 5c. Set Up Option B Project Structure

```bash
mkdir -p jobs/{domain}/option-b/public/images
mkdir -p jobs/{domain}/option-b/public/es

# Copy all real images from Option A
cp jobs/{domain}/option-a/public/images/* jobs/{domain}/option-b/public/images/
```

#### 5d. Build ALL Pages From Scratch (CRITICAL — THE CORE STEP)

**DO NOT copy Stitch HTML. Build every page yourself using the extracted design system + real manifest content.**

This means every page starts with:
- Real business name, phone, email from the manifest
- Nav linking to ALL pages from the manifest (not just what Stitch chose)
- Real testimonials with real reviewer names
- Real local images (never Stitch CDN URLs)
- Proper mobile menu with all pages listed
- Correct `<title>`, `<meta>`, favicon

**Step 1: Get the full page list from Option A:**

```bash
ls jobs/{domain}/option-a/src/pages/*.astro | sed 's|.*/||; s|\.astro||'
```

Every page in that list MUST exist in Option B.

**Step 2: Build every page as a complete, standalone HTML file.**

Each page is a full HTML document with:
- `<head>` with Tailwind CDN, Google Fonts, Material Symbols, and the Stitch-inspired Tailwind config (color tokens, fonts, border radius)
- Shared styles (glassmorphism nav, mobile menu transitions, etc.)
- Full desktop nav with links to ALL pages + language switcher (ES) + phone CTA
- Full mobile menu (hamburger toggle) with ALL pages + language switcher + phone CTA
- Page-specific `<main>` content using real text from the manifest
- Shared footer with logo, service links (ALL pages), contact info, service areas, copyright
- Mobile sticky CTA bar (fixed bottom, phone number)

**For the homepage (index.html):**
- Hero with local background image, gradient overlay, conversion headline, phone CTA
- Trust bar with stats (years in business, client count, 24/7, satisfaction guarantee)
- Service cards grid linking to ALL service pages
- "Why Choose Us" section with image + trust points
- Testimonials with REAL customer quotes and names from manifest
- "Who We Serve" section (homeowners, property managers, businesses)
- FAQ accordion with real questions from manifest
- Contact form with mailto action + info sidebar
- Use the Stitch-inspired visual patterns: card styles, icon usage, section backgrounds, glassmorphism

**For each service page (e.g., carpet-cleaning.html):**
- Hero with relevant background image from `public/images/`
- Two-column layout: content text (from manifest) + inline image
- Process steps section (numbered steps)
- Benefits/features list with check icons
- CTA banner with phone number
- Active nav highlight on current page

**For the about page:**
- Hero with van/team photo
- Mission/story content from manifest
- "Why Choose Us" feature cards
- Service list with links to all service pages
- Service area tags

**For the contact page:**
- Colored header section (no hero image needed)
- Quick contact bar (phone + email)
- Split layout: form (left) + info panel (right, dark bg with contact details)
- Form fields: name, email, phone, city, service dropdown, message — all with `name` attributes and `mailto:` onsubmit

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

The language switcher must look like a **toggle/pill**, NOT a plain text link that blends into the nav menu. It should be visually distinct from navigation links so users instantly recognize it as a language control.

**Desktop:** Place between the last nav link and the phone CTA. Style as a small pill/capsule:
```html
<!-- English page example -->
<div class="flex items-center bg-surface-container rounded-full p-0.5 text-xs font-bold">
  <span class="px-3 py-1 bg-primary text-white rounded-full">EN</span>
  <a href="/es/{current-page}.html" class="px-3 py-1 text-on-surface-variant hover:text-primary rounded-full transition-colors">ES</a>
</div>
```
The active language gets the filled/primary background. The inactive language is a clickable link. This creates a clear "switch" visual — not just another nav item.

**Mobile:** Place the same pill-style switcher in the nav bar next to the hamburger icon. Also include a full "English"/"Español" link in the mobile menu drawer.

On English pages: active=EN, link=ES pointing to `/es/{current-page}.html`
On Spanish pages: active=ES, link=EN pointing to `/{current-page}.html`

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
echo "=== NAV COMPLETENESS CHECK ==="
# Verify that index.html's desktop nav links to every page
HOMEPAGE="jobs/$DOMAIN/option-b/public/index.html"
for slug in $(ls jobs/$DOMAIN/option-a/src/pages/*.astro | sed 's|.*/||; s|\.astro||' | grep -v index); do
  if grep -q "/$slug.html" "$HOMEPAGE"; then
    echo "  ✓ Nav has link to $slug"
  else
    echo "  ✗ FAIL: Nav is MISSING link to $slug — Stitch dropped it, add it manually"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== PER-PAGE CHECKS ==="
FAIL=${FAIL:-0}
for f in $(find jobs/$DOMAIN/option-b/public -name "*.html"); do
  PAGE=$(echo "$f" | sed "s|.*/public/||")
  ERRORS=""

  grep -q "$PHONE" "$f" || ERRORS="$ERRORS phone-missing"
  grep -q "/images/logo" "$f" || ERRORS="$ERRORS logo-missing"
  grep -q "lh3.googleusercontent.com" "$f" && ERRORS="$ERRORS stitch-cdn-images"
  grep -qi "mobile.menu\|mobilemenu\|mobile-menu" "$f" || ERRORS="$ERRORS no-mobile-menu"

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
- Homepage nav missing ANY page from Option A (Stitch commonly drops pages from nav)
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

Create a punch list. Fix EVERY item. Since we built from scratch (not from Stitch HTML), common issues are:

| Issue | How to fix |
|-------|-----------|
| Nav missing a page | Cross-reference Option A page list, add the missing link |
| Broken image 404 | Check filename in `public/images/`, fix the `src` path |
| English text on Spanish page | Translate the missed strings |
| Form doesn't submit | Verify `name` attributes on inputs and `mailto:` onsubmit handler |
| Section feels sparse | Add more manifest content or a visual element (icons, cards) |
| Footer missing a service link | Ensure footer services list matches the nav |

#### 6e. Re-run Automated Check

After fixing, re-run the completeness check from Stage 5h. ALL must pass.

#### 6f. Final Beauty Pass

Look at the site with fresh eyes:
- Does it look VISIBLY DIFFERENT from Option A? (Different design system, different typography, different layout)
- Does it capture the Stitch-inspired visual language? (Design tokens, glassmorphism, Material icons, component patterns)
- Does the Spanish version look natural? (No mixed languages, proper accents/characters?)
- Is every page built with real content? (No placeholder text, no stock images, no `href="#"` links)

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
- **STITCH IS INSPIRATION, NOT A TEMPLATE**: Stitch generates a design reference. NEVER copy its HTML verbatim. Extract the design system (colors, typography, component patterns, visual effects) and build all pages from scratch using real manifest content. This avoids placeholder content, incomplete navs, and Stitch CDN images entirely. If any Stitch placeholder text, `lh3.googleusercontent.com` images, or `href="#"` links exist in the final site, something went wrong
- **STITCH CLI**: Use `./scripts/stitch.sh <tool> '<json>'` to call Stitch tools. Key tools: `get_screen_code`, `get_screen_image`, `build_site`, `list_projects`
- **SPANISH**: Option B includes /es/ routes for all pages. The SiteNav component must accept a `lang` prop and show a language toggle button
- **PORT CONFLICT**: Option A uses port 4321, Option B uses port 4322. Set the port in `astro.config.mjs` with `server: { port: 4322 }` for Option B
- **PREVIEW VIEWPORT**: The preview tool may default to a small viewport. Always use `preview_resize` with `width: 1440, height: 900` before taking desktop screenshots
- **PROTECT FINISHED BUILDS**: Never modify files inside `jobs/{domain}/option-a/` when working on Option B (and vice versa). Worktrees and agents can accidentally overwrite files in the wrong directory. If a finished Option A gets corrupted, the Vercel deployment is the source of truth — the local `jobs/` directory can be re-generated
- **TEMPLATE FILES ARE TEMPLATES**: Files in `templates/astro-base/` are generic starters. Never overwrite a customer's customized files (in `jobs/{domain}/option-a/`) with template defaults. Customer builds diverge from templates — that's by design
