# Option A Build Process — Definitive Guide

This documents the exact process that produces a high-quality Option A.
Option A = faithful rebuild (100% original text, dramatically improved design).

---

## Overview

```
URL Input
  → Stage 1: Scrape (Playwright — captures <img> AND CSS background-image)
  → Stage 2: Analyze (read manifest + view screenshots → design-brief.json)
  → Stage 3: Build (Astro + Tailwind v4, upgraded components, all images)
  → Stage 4: Visual QA (preview, screenshot, fix, repeat)
  → Deploy (Vercel)
```

---

## Stage 1: Scrape & Extract

**Script**: `scripts/scrape.js`

**What it captures per page**:
- Full text content (headings, paragraphs, lists) structured by section
- All `<img>` tag images → downloaded to `assets/img/img_*.{ext}`
- All CSS `background-image` URLs → downloaded to `assets/img/bg_*.{ext}`
- Video embeds (YouTube/Vimeo iframe URLs)
- Forms (field names, labels, types)
- Navigation structure
- Footer content (social links, phone, email, address)
- Meta tags (description, OG)
- Full-page screenshot of every page

**Critical lesson learned**: CSS background images are the hero/banner images that
appear behind text. The scraper MUST capture these — they're often the most
visually impactful images on the original site. Early versions only captured
`<img>` tags and missed all hero backgrounds.

**Output**:
- `jobs/{domain}/manifest.json` — structured data
- `jobs/{domain}/assets/img/` — all downloaded images
- `jobs/{domain}/assets/screenshots/` — page screenshots

**Also run** `scripts/grab-heroes.js` if the scraper's CSS background extraction
misses anything (fallback for JS-loaded backgrounds).

---

## Stage 2: Analyze & Design Brief

**What to do**:
1. Read `manifest.json` — understand page count, services, content structure
2. LOOK at the screenshots (use Read tool on PNG files) — understand the visual style
3. LOOK at the downloaded images — know what's available for the rebuild
4. Create `design-brief.json` with:

**Design brief must include**:
- Business identity (name, industry, audience, value props)
- Current site assessment (strengths, weaknesses)
- New design direction:
  - Color palette (primary + accent, with full shade scale)
  - Typography (Google Fonts — heading + body pair)
  - Layout patterns (hero style, card style, section flow)
  - Animations (scroll reveals, hover effects)
  - Design details (border radius, shadow style, padding scale)

**Key decision**: Full creative freedom on branding — can redesign colors, typography,
even logo treatment. The constraint is TEXT only (100% preserved).

---

## Stage 3: Build

### 3a. Project Setup

```bash
cp -r templates/astro-base/ jobs/{domain}/option-a/
cd jobs/{domain}/option-a/ && npm install
```

### 3b. Image Preparation

Copy ALL images to `public/images/`, organized by purpose:

| Image type | Source | Naming | Usage |
|-----------|--------|--------|-------|
| Logo | `img_*.png` (look for the business logo) | `logo.png` | Nav, footer |
| Hero backgrounds | `bg_*.{ext}` (CSS backgrounds from scraper) | `hero-{page}.{ext}` | Full-bleed hero section backgrounds |
| Content photos | `img_*.{ext}` (non-logo `<img>` images) | `{descriptive-name}.{ext}` | Inline two-column layouts |

**Rule**: Every page that had a background image on the original site MUST have
one in the rebuild. The hero backgrounds are the most important images.

### 3c. Color Theme

Update `src/styles/global.css` with the design brief's palette using Tailwind v4
`@theme` syntax:

```css
@theme {
  --color-primary-50: #...;
  /* full primary scale 50-900 */
  --color-accent-50: #...;
  /* full accent scale 50-700 */
  --color-surface: #f8fafc;
  --font-heading: 'Font Name', system-ui, sans-serif;
  --font-body: 'Font Name', system-ui, sans-serif;
}
```

Also includes scroll-triggered animations (`.fade-up`, `.stagger`) and
anti-aliased text rendering.

### 3d. Layout & BaseLayout

The `BaseLayout.astro` includes:
- Google Fonts preconnect + stylesheet link
- Favicon (logo.png)
- **Mobile sticky CTA bar** (fixed bottom, phone number, only on mobile)
- Bottom padding spacer for the sticky CTA
- IntersectionObserver script for `.fade-up` and `.stagger` animations

### 3e. Components Used

**Homepage** uses these components directly:

| Component | Props | What it does |
|-----------|-------|-------------|
| `Hero` | heading, subheading, eyebrow, ctaText, ctaHref, ctaSecondaryText, ctaSecondaryHref, backgroundImage, variant="gradient", size="fullscreen" | Full-viewport hero with gradient overlay, noise texture, decorative blur orbs, dual CTAs with arrow animation |
| `Section` | heading, subheading, eyebrow, background, align, narrow | Wrapper with 5 background variants, decorative orbs on gradient, fade-up header |
| `ServiceCard` | title, description, icon, href, accentColor, variant | Cards with animated top accent bar, hover lift, slide-in arrow CTA |
| `ProcessSteps` | steps[], variant="connected" | 3-step how-it-works with connecting line on desktop |
| `Testimonial` | quote, author, role, rating, variant | Quote marks, avatar initials circle with gradient |
| `FAQ` | items[], variant="cards" | Accordion with styled circular open/close indicators |
| `CTABanner` | heading, subheading, ctaText, ctaHref, variant="gradient" | Full-width gradient banner with decorative circles |
| `GuaranteeStrip` | items[] | Checkmark trust strip |

**Service pages** use `ServicePage` component which wraps:
- `Hero` (with page-specific background image)
- `<slot />` for page body content
- `CTABanner`
- `GuaranteeStrip`

### 3f. Page Structure

**Homepage sections (in order)**:
1. Hero (fullscreen, gradient variant, background image)
2. Services grid (6 cards: 5 services + service area)
3. How it works (3 connected steps)
4. Who we serve (3 audience cards: homeowners, property managers, businesses)
5. FAQ accordion (cards variant)
6. Testimonials (3 cards with star ratings)
7. CTA banner (gradient with phone + contact link)
8. Guarantee strip (checkmarks)

**Service pages (each follows same pattern)**:
1. Hero (page-specific background image from original site)
2. Two-column content section (text left, inline image right, sticky)
3. Benefits/details section (checkmark lists)
4. CTA banner + guarantee strip (from ServicePage wrapper)

**Contact page**:
1. Hero with background image
2. Two-column: contact info left, form right
3. Form uses `mailto:` link (no backend)

**About page**:
1. Hero with van photo background
2. Mission section (text + van image)
3. Why Choose Us (checkmark list)
4. Services list with links
5. Get Started CTA box

### 3g. Content Rules

- **100% of original text preserved** — never change, paraphrase, or omit
- All phone numbers, emails, addresses kept as-is
- Social links preserved
- Video embeds preserved (YouTube/Vimeo iframes)
- Forms replicated with mailto: action
- Similar location pages consolidated if 20+ near-identical pages

### 3h. Build & Verify

```bash
npm run build
```

Must produce zero errors. All pages must generate.

---

## Stage 4: Visual QA

**This is what makes the difference between mediocre and great.**

1. Start preview server
2. For each page:
   - Desktop screenshot (1440x900) — check hero, typography, cards, whitespace
   - Mobile screenshot — check stacking, readability, touch targets
   - Check `preview_network` for 404s (broken images, missing fonts)
   - Check `preview_console_logs` for JS errors
3. Fix all issues
4. Beauty pass — "would a designer be proud of this?"
5. Rebuild and re-check

**Common issues found during QA**:
- Background images not showing (wrong path)
- Images assigned to wrong pages (e.g., water extraction wand on carpet page)
- Content below hero invisible due to `fade-up` opacity:0 (observer not triggering)
- Service pages with white text on white background
- Mobile sticky CTA overlapping footer content

---

## What Made It Work (Lessons Learned)

1. **Two types of images**: `<img>` tags AND CSS `background-image`. Missing
   either makes the site look empty. The scraper must capture both.

2. **Hero backgrounds are everything**: The large full-bleed images behind hero
   text define the visual impact. Every service page needs its own hero background
   matching what the original site had.

3. **Upgraded template components**: The base components went through a major
   upgrade from "functional" to "award-winning":
   - Hero: 3 variants, 3 sizes, eyebrow, noise texture, gradient orbs
   - ServiceCard: animated accent bar, 3 variants
   - Testimonial: 3 variants, avatar circles
   - New: ProcessSteps, CTABanner, GuaranteeStrip, FAQ, StatsBar

4. **Mobile sticky CTA**: A fixed bottom bar with the phone number on mobile
   dramatically improves conversion potential.

5. **Scroll animations**: `.fade-up` and `.stagger` classes with
   IntersectionObserver add polish without JavaScript frameworks.

6. **Generous whitespace**: `py-20 md:py-28 lg:py-32` on sections, `p-7 md:p-8`
   on cards. Premium sites are not afraid of empty space.

7. **Image placement must match original**: Each image belongs on a specific page.
   Cross-referencing the manifest's per-page image arrays prevents misassignment.

8. **Deploy carefully**: Always `cd` to the right directory before `npx vercel deploy`.
   Disable SSO protection after deploy.
