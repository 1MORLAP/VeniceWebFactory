# Required Patterns — the typed scaffold

Every WebFactory build (Option A, Option B, Option C) MUST satisfy these structural requirements. **The visual treatment is your design choice. The structural requirement is non-negotiable.** Most have a corresponding `qa-check.js` rule that fails the build if violated.

This document is the bridge between "the scaffold gives you nothing" and "the build still has to be safe." Read it before designing any component.

---

## How to read this document

Each requirement has four parts:

- **Structural rule**: what MUST exist in the rendered HTML / CSS
- **Visual freedom**: what you can vary (almost always: everything visual)
- **qa-check enforcement**: which `scripts/qa-check.js` rule fails the build if violated (so you know the gate will catch you)
- **Why** (when not obvious): the bug class this prevents

If you find yourself writing a component and you can't tell whether you're satisfying a requirement, READ THIS FILE. If you're tempted to skip a requirement because "it doesn't look right with my design," STOP — the requirement is more important than the design. Redesign to satisfy the requirement.

---

## 1. Document chrome (BaseLayout)

### 1.1 Title and meta

**Structural rule**: every page MUST have:
- `<title>` with the page-specific name + business name
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`
- `<meta charset="UTF-8">`
- `<meta name="description">` populated from manifest meta

**Visual freedom**: title format ("About | Acme Plumbing" vs "Acme Plumbing — About" vs "About Us · Acme Plumbing"), description rewriting per FACT GROUNDING and TESTIMONIAL & REVIEW PRESERVATION rules.

**qa-check enforcement**: structure check (no `<title>` = fail).

### 1.2 Favicon

**Structural rule**: every page MUST have `<link rel="icon" href="/favicon.{ext}">` linking to a real file in `public/`. If `manifest.favicon` is non-null, use that. Otherwise fall back to the customer's logo per FAVICON RULE.

**Visual freedom**: favicon source (scraped favicon, derived from logo, custom if customer provided).

**qa-check enforcement**: implicit (broken `<link rel="icon">` href would fail broken-image check; missing favicon link is currently a Visual Sanity Pass item).

### 1.3 Skip-to-content link

**Structural rule**: every page MUST have a keyboard-accessible "Skip to main content" link at the top of `<body>`, hidden visually until focused, that jumps to `#main`. Pattern: `<a href="#main" class="sr-only focus:not-sr-only ...">Skip to content</a>`.

**Visual freedom**: focus styling.

**qa-check enforcement**: not currently checked (a11y gap — could be added).

### 1.4 Animation script

**Structural rule**: animations MUST be progressive enhancement — content fully visible without JavaScript. The `.fade-up` / `.stagger` classes default to `opacity: 1` (visible). The `html.has-animations` class added by JS gates the hidden-then-revealed behavior. Safety timeout (≤ 1500ms) reveals everything unconditionally if `IntersectionObserver` doesn't fire.

**Visual freedom**: which elements get `.fade-up` vs `.stagger`, transition timing/easing.

**qa-check enforcement**: not directly (would need a JS-disabled render to check). The pattern is in scaffold's `BaseLayout.astro` — copy the script, don't reinvent.

**Why**: invisible content without JS = broken site for crawlers, slow connections, screenshot QA.

---

## 2. Mobile-first design (MOBILE-FIRST DESIGN rule in SKILL.md)

### 2.1 Mobile viewport reference

**Structural rule**: ALL designs are tested at the 390×844 viewport (iPhone 14). The qa-check runs at both 1440×900 desktop AND 390×844 mobile. Mobile is not a responsive afterthought.

**Visual freedom**: any mobile layout that satisfies sub-rules below.

**qa-check enforcement**: every viewport-sensitive check runs at both viewports.

### 2.2 No horizontal overflow

**Structural rule**: at the 390px viewport, NO element may extend past `100vw`. Document `scrollWidth` MUST equal viewport width (with ≤ 8px tolerance for scrollbar artifacts). Common offenders: fixed-width sections without `max-w-full`, oversized images without `max-w-full`, long unbroken strings, table layouts.

**Visual freedom**: how content reflows (stack, scroll-snap-x carousel, accordion, etc.).

**qa-check enforcement**: `mobile-overflow` (FAIL).

### 2.3 Touch target size

**Structural rule**: every interactive element (link, button, nav item, form input, social icon, phone CTA) MUST be ≥ 44×44 CSS px at the 390px viewport (WCAG 2.5.5). For text links inside body copy, add padding or `min-h-[44px] min-w-[44px]` to bump the hit area without affecting visible appearance.

**Visual freedom**: any visual treatment that maintains the 44px hit area.

**qa-check enforcement**: `mobile-tap-target` (warn).

### 2.4 Body text minimum 16px

**Structural rule**: body text on mobile MUST be ≥ 16px. Smaller text triggers iOS zoom-on-focus on form inputs and feels cramped. Footer fine print can be smaller IF non-interactive.

**Visual freedom**: any font-size ≥ 16px for body, scale up freely for headings (`clamp()` recommended for fluid typography).

**qa-check enforcement**: not directly (could be added). Currently scaffold's `body { font-size: 16px }` provides the default.

### 2.5 Mobile nav

**Structural rule**: every page MUST have a mobile nav strategy that works at 390px. Options:
- Hamburger menu (drawer reveals nav items, each ≥ 44px tall)
- Pill-stacked nav (vertical stack, each item ≥ 44px tall)
- Bottom nav bar (fixed to bottom of viewport, 4-5 primary destinations)

The mobile hamburger button itself MUST be ≥ 44×44px.

**Visual freedom**: pick one strategy and execute it cleanly. Animation, decoration, color — your choice.

**qa-check enforcement**: `mobile-tap-target` catches sub-44px button. `mobile-overflow` catches drawers that don't fit.

### 2.6 Sticky mobile CTA (trades sites)

**Structural rule**: for trades / services customers (plumbing, HVAC, electrical, auto, landscaping, etc.), a persistent "Call Now" or "Get Quote" bar at the bottom of the mobile viewport is high-conversion. Should be added (`md:hidden` so desktop doesn't see it).

**Visual freedom**: bar styling, single CTA vs dual CTAs (call + quote), icon usage.

**qa-check enforcement**: not directly (judgment call per industry — Visual Sanity Pass).

---

## 3. Hero sections (HERO CONTRAST RULE)

### 3.1 Three-layer pattern (when hero has a photo background)

**Structural rule**: every hero with a `background-image` photo MUST use the layered pattern:
1. Image layer (full-bleed, behind everything)
2. Overlay layer (any solid color, gradient, or blur — NOT optional)
3. Text layer (positioned above overlay, color chosen to contrast with the overlay-blended bg)

A heading sitting directly on a `background-image` with no overlay = FAIL.

**Visual freedom**: overlay treatment (gradient direction, opacity, color, blur, scrim, hatched pattern, animated). Text positioning (left, center, right). Composition with supporting design elements (per DESIGN QUALITY BAR rule 3 — bracket numbers, mono captions, accent rules, etc.).

**qa-check enforcement**: `hero-no-overlay` (FAIL — heading on bg-image without overlay div), `hero-low-contrast` (FAIL — computed WCAG ratio < 3:1 for large text).

**Why**: text on photo without overlay is illegible whenever the photo's underlying brightness clashes with the text color. Real bugs shipped: Naples Pressure Washing (Options A and C), Tampa Bay landscape (Option A).

### 3.2 Generic text contrast (everywhere, not just hero)

**Structural rule**: every visible text element MUST satisfy WCAG contrast vs its effective background color:
- Body text (< 24px, < 18.66px bold): ≥ 4.5:1
- Large text (≥ 24px, OR ≥ 18.66px bold): ≥ 3:1

The qa-check walks every `h1, h2, h3, h4, h5, h6, p, a, button, li, span, td, th, label, summary, blockquote, dt, dd, figcaption, strong, em, small, b, i, u` and computes the ratio.

**Visual freedom**: any color combinations that satisfy the ratios.

**qa-check enforcement**: `text-contrast` (FAIL).

**Why**: catches active-nav-black-on-black bug class regardless of which classes/colors caused it. Real bug shipped: Moretti's Centry Auto Body Option C — `bg-iron text-bone` resolved to two near-identical dark colors.

---

## 4. Logo (LOGO RULE)

### 4.1 Always preserve original

**Structural rule**: every nav header MUST contain EITHER:
- An `<img>` element pointing to `/images/logo.{ext}` (the customer's actual logo, recovered by `scripts/fix-logo.js`)
- OR plain text containing the verbatim business name in the page's display font (fallback when no usable logo exists)

NEVER design or invent a logo (no monogram, no abstract mark, no decorative wordmark treatment).

**Visual freedom**: logo size (within retina constraints — natural width ≥ 1.5× displayed), positioning, surrounding decoration, padding, optional tagline below.

**qa-check enforcement**: `logo` (FAIL — no `<img>` or business-name text in nav), `logo-is-placeholder` (FAIL — Hibu/CMS placeholder logo URL), `logo-literal-text` (FAIL — alt or adjacent text is "Logo" / "Site Logo" / etc.), `logo-generic-alt` (warn — alt text is generic), `logo-bg-mismatch` (FAIL — opaque logo on different-colored nav).

### 4.2 Background-aware placement

**Structural rule**: if the logo file is opaque (no transparency in alpha channel), the nav background MUST match the logo's sampled background color within ~5 RGB units. `scripts/fix-logo.js` writes `manifest.logo.backgroundColor` for this purpose.

**Visual freedom**: nav decoration (borders, shadows, padding), as long as the immediate background under the logo matches.

**qa-check enforcement**: `logo-bg-mismatch` (FAIL).

**Why**: real bug shipped on SS Power Washing — opaque navy logo on different-shade-navy nav, looked like a sticker glued onto the page.

---

## 5. Social links (SOCIAL LINKS RULE)

### 5.1 Preserve every social URL with correct destination

**Structural rule**: every social/business-listing link from `manifest.footer.social` (Facebook, Instagram, LinkedIn, YouTube, TikTok, X/Twitter, Yelp, Google Business, Pinterest) MUST appear in the footer with the FULL EXTERNAL URL from the manifest. NEVER `href="#"`. NEVER `href="/"`. NEVER point at the customer's own site.

**Visual freedom**: icon style (filled, outlined, custom SVG), arrangement (row, grid, vertical), platform mix (only Facebook + Instagram if those are all the customer has — don't add LinkedIn just because it looks good).

**qa-check enforcement**: `social-link-wrong-destination` (FAIL), `social-link-placeholder` (FAIL), `social-link-malformed` (FAIL), `social-link-icon-internal-href` (FAIL — failsafe for icon-only anchors with internal hrefs).

### 5.2 OMIT if manifest is empty

**Structural rule**: if `manifest.footer.social` is empty or missing, OMIT the social section ENTIRELY. Do NOT render Facebook/Instagram icons with `href="#"`. Do NOT guess social handles from the business name (`facebook.com/{businessname}` could 404 or — worse — point to a different business with the same name).

**Visual freedom**: footer can have other content (services, hours, address, contact CTA) where social would have been.

**qa-check enforcement**: `social-link-icon-internal-href` (FAIL — catches placeholder hrefs with social-looking icons).

### 5.3 Required markup for QA

**Structural rule**: every rendered social link MUST have:
- `href` = full external URL
- `aria-label="{Platform}"` (exact platform name — Facebook, Instagram, etc. — so QA can identify which platform this anchor claims to be)
- `target="_blank" rel="noopener noreferrer"` (visitor leaves the customer's site cleanly, no tab-nap)

**Visual freedom**: icon child element (SVG, `<img>`, Material Symbols, Font Awesome) — any.

**qa-check enforcement**: detector requires `aria-label` to identify the platform; without it, the structural failsafe fires for icon-only anchors.

---

## 6. Content integrity

### 6.1 No fabricated facts (FACT GROUNDING PRINCIPLE)

**Structural rule**: every numeric / dated / credential / identity claim rendered on a built page MUST originate in the manifest OR follow logically from a manifest fact. No "20+ years" without a year in the source. No "award-winning" without a specific award named. No "BBB A+ rated" without BBB mention. No "family-owned" / "veteran-owned" without identity claim in source.

**Visual freedom**: how facts are presented (badge, stat strip, callout, body copy).

**qa-check enforcement**: `fact-grounding` (FAIL — runs when `--manifest` flag passed). Validates 8 claim families against the manifest text corpus.

### 6.2 Reviews/testimonials verbatim (TESTIMONIAL & REVIEW PRESERVATION)

**Structural rule**: any text inside `<blockquote>`, `<q>`, or testimonial cards with named attribution MUST be byte-identical between Options A, B, and C. No rewording, no grammar fixes, no composite reviews.

**Visual freedom**: layout (carousel, grid, masonry), card styling, attribution treatment, star rating render, platform logo placement, ordering, selecting a subset for the homepage. The words stay verbatim; everything around them is design.

**qa-check enforcement**: `testimonial-tampering` (FAIL — runs when `--reference-dist` flag passed; compares B/C testimonials against A's `dist/`).

**Semantic note** (the `<blockquote>` reservation): use `<blockquote>` and `<q>` ONLY for actual quotes from named third parties — customer testimonials, named-employee quotes, "as featured in" press attributions. Do NOT use `<blockquote>` for:
- Brand taglines or marketing slogans (use `<p>` or a styled `<div>` — those are your own copy, not someone else's words)
- Pull quotes that are visual emphasis of YOUR own body copy (use a styled `<div>` or `<aside>`)
- Decorative oversized text without an attribution (use a heading or styled `<p>`)

This semantic discipline matters because the `testimonial-tampering` check treats every `<blockquote>` and `<q>` as a third-party voice that must be preserved byte-identical. Putting a brand tagline in `<blockquote>` triggers comparison against A's reference, which causes false-positive failures whenever the tagline gets even minor formatting changes between A and B (different whitespace, different entity encoding, etc.). Worker session learning 2026-04-25 (libertylandscapefl.com): when in doubt about whether something is a "real quote," ask "is this attributed to a named third party?" — if no, it's not a `<blockquote>`.

### 6.3 No CMS placeholders (CMS PLACEHOLDER PRINCIPLE)

**Structural rule**: detected placeholder content (Hibu logo placeholders, lorem ipsum, "your video here" splashes, "coming soon" stubs) flagged by `scripts/detect-placeholders.cjs` MUST NOT appear in built pages. Per-element rules define the fallback (favicon for logo, drop CTA for video, omit page, etc.).

**Visual freedom**: substitute content treatment (when manifest content is genuine).

**qa-check enforcement**: `placeholder-copy` (FAIL — catches lorem ipsum, "your tagline here", "coming soon", `123 Main St`, fiction-reserved 555-01XX phones, example.com emails in rendered DOM).

---

## 7. Image handling

### 7.1 Image-to-page mapping

**Structural rule**: each page uses images from THAT page's manifest entry (`manifest.pages[i].images` and `manifest.pages[i].backgroundImages`). Don't pull a residential photo onto a landscaping page just because the rendering needs an image.

**Visual freedom**: which of the page's images go where, cropping, treatment.

**qa-check enforcement**: not directly (judgment call — Visual Sanity Pass).

### 7.2 Image diversity within page

**Structural rule**: within any single page's content area (excluding nav/header/footer), no content image (≥ 80×80px) may be used 2+ times. Service cards / feature tiles / content sections must each have a DISTINCT image.

**Visual freedom**: which images go in which slots, layout (grid, masonry, carousel).

**qa-check enforcement**: `duplicate-content-image` (FAIL).

**Why**: real bug shipped on Naples Pressure Washing — homepage had 3 service cards all with the same pool photo despite manifest having driveway / building / sidewalk photos.

### 7.3 Image resolution

**Structural rule**: every visible content image > 200px wide MUST have natural width ≥ displayed width. Stretching a 850px source to 1440px display = pixelated = fail. Want ≥ 1.5× for retina sharpness.

**Visual freedom**: any image you have in the manifest, ANY layout, AS LONG AS the displayed size respects the source resolution. If a hero needs to be 1920px wide and the source is 800px, either find a higher-res source or crop the layout to the source width.

**qa-check enforcement**: `image-low-resolution` (FAIL if natural < displayed; warn if natural < 1.5× displayed).

### 7.4 Image reuse — Option A renders ≥ 90% of must-reuse photos (IMAGE REUSE RULE)

**Structural rule (Option A only)**: at least **90%** of the manifest's "must-reuse" photo inventory MUST appear in Option A's built `dist/`. Must-reuse = every `<img>` and CSS-background image with a `localPath`, EXCEPT (a) widths of 1–99px (tiny icons), (b) third-party rating badges (BBB / Yelp / Google Reviews / Trustpilot / Angie / Home Advisor / accreditation), (c) favicon / spinner / placeholder utility assets, (d) duplicate copies of the same image (counted once by content). The customer's logo as a small chrome asset can be skipped; full-bleed photographic logo variants (e.g. "logo over a forest path" 1920×1458) ARE work photos and DO count.

**Why**: the customer's original site is a small-business contractor's website with photos of the work. Option A is the same kind of site, suddenly expensive — NOT a magazine. The drift this rule prevents: Option A workers reach for `templates/inspiration/industrial-trades/`'s editorial vocabulary (bracket-numbered eyebrows, file-tab nav, ALL-CAPS condensed display, hard 90° corners, **typographic-only service cards**) and ship a layout that uses 0–2 photos when the manifest has 60+. Editorial / typographic / file-tab / bracket-numbered design language belongs to **Option C**, not A.

**Practical pattern for trade customers** (which absorbs the photo budget naturally):
1. Hero with one full-bleed work photo per page (different photo per service)
2. Service tiles each with a representative work photo (text-only service cards = the failure mode)
3. A **portfolio / gallery / "Recent Work" section** of 6–12 customer-work photos somewhere on the home page (model: `https://elysian-gc-786s9d1zc-tomek-group.vercel.app` "A craftsman's portfolio — photographed honestly")
4. About / crew / team section with photos of owner / crew / trucks / equipment
5. Inline accent photos in long-form pages (blog articles, service pages) breaking up text-heavy sections
6. Optional one more photo as backdrop for closing CTA

**Visual freedom**: ANY layout, ANY treatment, ANY visual hierarchy. The rule is about coverage of the inventory, not specific composition.

**qa-check enforcement**: `image-reuse-A` (FAIL — when invoked with `--option a --manifest <path>`, parses manifest, applies must-reuse classifier, walks every `dist/**/*.html` and `dist/**/*.css` for image references, fails if `rendered ∩ must-reuse / |must-reuse| < 0.90`. Reports the ratio + first 5 unused photos + the suggestion to add a portfolio / gallery / per-service-card / about-the-crew section).

**Real bug fixed 2026-04-29**: giffins.net Option A — manifest had 89 image records (~70 must-reuse photos), `index.astro` rendered 0 `<img>` tags, site-wide reuse ratio was ~15%. ifixplumbing.com had the same drift. See full rule (`IMAGE REUSE RULE`) in SKILL.md.

### 7.5 Option C image-quality escape hatch (OPTION C IMAGE-QUALITY ESCAPE HATCH)

**Structural rule (Option C only)**: if a customer photo is genuinely too poor to carry C's design slot (resolution insufficient for the use context, heavy compression artifacts, blurry subject, OR a structurally-required slot exists with no customer photo to fill it), C may substitute thematically-appropriate stock from **Unsplash / Pexels / curated AI**. The escape hatch is C-only — A and B remain bound to the customer's actual photos by the faithful-rebuild contract.

**Substitution criteria (all four must hold)**:
1. Thematically tight to the customer's actual industry (tree service → tree-work stock; plumber → plumbing stock; never generic "professional" stock).
2. Aesthetically compatible with C's industry-tokens direction (workwear-grit for trades, refined-modern for B2B tech, editorial-warm for food-led, etc.).
3. Genuinely high quality (≥ 1500px wide, no AI uncanny tells — extra fingers, melted textures, generic-stock-photo lighting).
4. Documented in `jobs/{domain}/option-c/build-design-decisions.md` — one line per substitution stating the slot, the original (source URL + dimensions), the reason, the replacement (source URL or AI prompt source).

**Never substitute**: owner / crew / team / actual logo. Those are brand-truth. If no headshot exists, omit the section — don't ship a stock contractor face.

**Visual freedom**: ANY substitution within the four criteria above.

**qa-check enforcement**: not directly. The existing `image-low-resolution` rule catches stretched photos at build time, which is the most common trigger for the escape hatch. The structural rule here is preventative + traceable: if substitution happens, it's documented; if it's not documented, the customer can't audit and the rule was violated.

**Real backstory 2026-04-29**: user clarification — *"If original images are poor, Option C can use AI generated or stock images where thematically appropriate."* Until this rule, C builds were contorting around customer photos that couldn't carry the design. Now C has an explicit fallback path. A and B still don't.

### 7.6 Icon contrast and quality (ICON QUALITY RULE)

**Structural rule**: every icon (whether scraped, generated, library-sourced, or hand-drawn by the worker) MUST meet:

1. **Contrast ≥ 3:1** vs. the container background (WCAG 1.4.11). Pale icons on pale cards FAIL. Add a contrasting badge shape (filled circle / rounded square in an accent color) behind the icon if the design wants tonal subtlety.
2. **Consistent style across a grid**: same stroke weight, same fill style (outline vs solid), same corner radius, same color palette. Don't mix Material Symbols outline with hand-drawn flat-fill in the same row.
3. **Asset quality**: SVG preferred (vector). PNG fallback only with ≥ 128×128 source, 24-bit color, transparent background. No grainy / dithered / JPEG-artifacted icons. Drawn icons must look intentional (clean shapes, even strokes).
4. **Semantic match**: a wrench icon goes on "Repairs", not "New construction".
5. **Material Symbols safe-default**: load via Google Fonts, use only verified names from the SKILL.md list. Invented names render as ALL-CAPS text and fail.

**Visual freedom**: ANY icon style (line, solid, duotone, hand-drawn, photographic), ANY family (Material Symbols, Heroicons, Phosphor, Lucide, custom SVG), ANY color treatment, ANY badge shape behind the icon. Inventing icons is FINE — what's not fine is shipping ones that visually disappear or look amateur.

**qa-check enforcement**: `icon-contrast` (FAIL — for every `<img>` between 16×16 and 80×80 displayed pixels outside nav/header/footer, sample dominant non-transparent color via canvas, compute WCAG ratio against effective container background, FAIL if < 3.0:1). Inline-SVG icons whose color is set via `fill="currentColor"` are caught by `text-contrast` instead. Icon-font glyphs (Material Symbols) likewise covered by `text-contrast`.

---

## 8. Video CTAs (VIDEO CTA RULE)

### 8.1 Never fabricate

**Structural rule**: never render a "Watch Video" / "Play Video" / play-button-icon CTA unless a real video URL exists in the manifest (YouTube/Vimeo/MP4 embed). If the original site's CTA pointed to a Hibu/CMS splash placeholder, drop the CTA entirely (replace with phone CTA or other functional element).

**Visual freedom**: when video IS real, CTA styling, embed treatment, thumbnail, autoplay/muted policy. When video ISN'T real, what replaces the section.

**qa-check enforcement**: `video-cta-fake` (FAIL — anchor has play-button icon AND href is internal/non-video), `video-cta-no-link` (FAIL — visible "Watch Video" text anchor with non-video href), `fake-play-button` (FAIL — play-button graphic inside anchor with non-video href).

---

## 9. Design quality (DESIGN QUALITY BAR)

### 9.1 Display-quality typography

**Structural rule**: every page MUST load at least one display-quality web font for headings. NEVER ship a site whose only fonts are system Inter / Arial / Helvetica.

**Visual freedom**: which display font (Fraunces, Editorial New, DM Serif Display, Cormorant, Newsreader, Tenor Sans, Cabinet Grotesk, etc. via Google Fonts or @fontsource — model picks based on industry/brand vibe, no curated list).

**qa-check enforcement**: `design-quality-fonts` (warn — fires when `<head>` loads zero Google/Bunny Fonts AND no `@font-face` rules).

### 9.2 Generous whitespace

**Structural rule**: section padding ≥ 96px vertical at desktop, ≥ 48px at mobile. Inside-section padding ≥ 24px.

**Visual freedom**: padding values above the minimums, any vertical rhythm.

**qa-check enforcement**: not directly (judgment call — Visual Sanity Pass).

### 9.3 Hero treatment beyond photo+headline

**Structural rule**: every hero MUST include at least one supporting design element: a horizontal rule, a labeled section number ("01"), a mono caption strip, an attention bar, an animated accent, a hover-revealed accent, or similar. The bare hero ("photo + giant headline + button") is the template tell.

**Visual freedom**: which supporting element, how many, animation/no animation, decoration.

**qa-check enforcement**: not directly (Visual Sanity Pass — item #16 "$80k smell test").

### 9.4 Considered color palette

**Structural rule**: design brief MUST list 3 primary + 2 accent colors maximum, EACH with a brand role and rationale. No "blue and white" without explanation. No 6-color palettes with no rationale.

**Visual freedom**: any colors that fit the customer's brand signal (BRAND RECOGNIZABILITY soft rule) and the industry direction (INDUSTRY DESIGN TOKENS for Option C).

**qa-check enforcement**: design-brief schema check (could be added; currently judgment).

### 9.5 One distinctive element per page

**Structural rule**: each page MUST have at least one piece of design that the customer would NOT have built themselves: custom card style, oversized heading with tight kern + custom underline, stat strip with mono captions, editorial pull-quote, numbered process strip, etc.

**Visual freedom**: which distinctive element, how unique vs other pages.

**qa-check enforcement**: not directly (Visual Sanity Pass).

### 9.6 Micro-interaction

**Structural rule**: every page MUST include at least one intentional micro-interaction: scroll reveal, hover state with motion (subtle scale on cards, color shift on CTAs), animated counter on stats, sticky-on-scroll nav transition, etc. Static-only is template-grade.

**Visual freedom**: which interactions, how many, intensity.

**qa-check enforcement**: not directly (Visual Sanity Pass).

---

## 10. Brand recognizability (BRAND RECOGNIZABILITY soft rule)

### 10.1 Preserve at least one signature

**Structural rule (soft)**: aim to preserve at least ONE element from the original site so the customer recognizes their brand:
- Primary brand color (most-used color in original CSS, or dominant logo color)
- Typography vibe (formal/casual, serif/sans, classical/geometric)
- Hero composition (specific recognizable photo, signature crop)
- Signature word/tagline (memorable copy phrase)

**Visual freedom**: which signature to preserve, how to modernize it.

**Override permitted**: when original is genuinely terrible — clashing colors, illegible fonts, generic stock chrome with no signature — preserve nothing IF you justify in `jobs/{domain}/option-a/brand-preservation-note.md`. Silence is the failure mode.

**qa-check enforcement**: not directly (judgment call — `brand-preservation-note.md` is the audit trail).

---

## 11. Cross-build diversity

### 11.1 No two builds look the same

**Structural rule**: this is the new defense for the inspiration-only architecture. Each build must produce something visually distinct from prior builds in the same industry. Two plumbing customers should NOT get visually identical sites.

**Visual freedom**: this IS the freedom — but use it.

**qa-check enforcement**: not directly. Visual Sanity Pass item #18 (diversity check) is the model-mediated defense:

> Open the screenshot of THIS build's homepage, then quickly compare against 2–3 recent peer builds in the same industry (load `jobs/*/qa-option-a/desktop-home.png`). Does THIS site have a hero treatment, color combination, typography pairing, or distinctive element that the others don't? If everything feels familiar — same gradient orb hero, same blue-and-amber palette, same Inter-everywhere — you regressed to template defaults. Note specifically what's unique about this build, OR rebuild with more design ambition.

### 11.2 Document design decisions

**Structural rule**: every build MUST write `jobs/{domain}/option-a/build-design-decisions.md` (and same path for option-b/, option-c/) documenting:
- Which inspiration directories were consulted (`saas-default`, `industrial-trades`, etc.)
- Which design moves were drawn from each (with citation)
- What's intentionally unique to THIS build
- What was deliberately NOT copied from inspiration (and why)

**Visual freedom**: documentation format (markdown, bullets, prose).

**qa-check enforcement**: not directly. The file's existence is checked by Stage 4 / 6 / 7 completion.

**Why**: creates an auditable trail. If you ever see two builds looking the same, the design-decisions logs reveal whether it was lazy copying or genuine brand similarity.

---

## 12. Bilingual support (BILINGUAL SUPPORT — Options B and C, Spanish)

Added 2026-04-30 per user clarification: *"Options B and C now need to include Spanish, also, make sure we do the translation once, as Option B and C should have the same copy or VERY close."*

**Structural rule (Options B and C)**: ship `/es/` pages alongside English. Translation produced ONCE in Stage 5 by the same Sonnet sub-agents doing the English rewrite, written to `option-b/src/pages/es/*.astro`. Option C reads B's `/es/` files at Stage 7 — single source of truth across B and C. Option A stays English-only.

### 12.1 File layout

```
option-a/src/pages/<page>.astro                   ← English only (A is monolingual)
option-b/src/pages/<page>.astro                   ← English (B's design + B's English rewrite)
option-b/src/pages/es/<page>.astro                ← Spanish (B's design + B's Spanish translation, CANONICAL ES)
option-c/src/pages/<page>.astro                   ← English (C's design + B's English text)
option-c/src/pages/es/<page>.astro                ← Spanish (C's design + B's Spanish text from option-b/src/pages/es/)
```

### 12.2 What gets translated

**Translate**: page text, headlines, subheads, body, CTAs, image `alt`, `<title>`, `<meta description>`, nav labels, button text, form labels, footer copy.

**Do NOT translate** (single source of truth across languages):

- Phone numbers, email addresses, license numbers
- Place names (Tampa, Lancaster, Ohio — keep original even when wrapped in Spanish prose)
- Business names, founder names, customer review attribution names, brand names
- All `<img src>` paths (same images; only `alt` is translated)
- All structural markup, components, grid configs, section ordering

### 12.3 Testimonials in `/es/` — special handling

Translate the testimonial body. Append `<small>(traducido del inglés)</small>` below the `<cite>` element. Attribution name stays original.

```astro
<blockquote>"¡Excelentes precios, trabajo de primera!"</blockquote>
<cite>— Mark S. <small>(traducido del inglés)</small></cite>
```

This is mandatory on every translated testimonial — qa-check enforces presence near each `<cite>`.

### 12.4 `<html lang>` attribute

Every `/es/*` page renders `<html lang="es">`. Every English page renders `<html lang="en">`. Implementation: BaseLayout accepts a `lang` prop (default `"en"`); `/es/*.astro` pages pass `lang="es"`.

### 12.5 Language switcher (mandatory in nav, Options B and C)

Every page in B and C has a visible EN/ES toggle in the nav that:

- Links the current page to its parallel translation
- Shows the language being switched TO (`ES` on EN pages, `EN` on ES pages)
- Has `aria-label` referencing the target language ("Cambiar a Español" / "Switch to English")
- Tap target ≥ 44×44px, visible in the main nav (not just a footer link)

Option A does NOT include a language switcher.

### 12.6 qa-check enforcement

Four rules, gated on `--option <b|c>`:

- `bilingual-page-parity` — every English page must have a parallel `/es/` page (and vice versa)
- `language-switcher-presence` — nav must contain a working EN/ES toggle with the right `aria-label`
- `html-lang-attribute` — `/es/*` pages must have `<html lang="es">`; English pages must have `<html lang="en">` (or unspecified, which defaults to the BaseLayout default)
- `testimonial-tampering` (extended) — when checking C's `/es/` pages, compare against B's `/es/` (passed via `--reference-dist-es`); verify each translated testimonial has `(traducido del inglés)` near attribution

### 12.7 Visual freedom

ANY layout, ANY component, ANY visual treatment. The rule is about COVERAGE (`/es/` exists with translated copy) and the testimonial-tag convention. Everything else stays at the option's design discretion.

### 12.8 Real story (added 2026-04-30)

Spanish was previously implemented in the SKILL.md design but PAUSED while the English pipeline stabilized. Re-enabled with the architecture above. Single-source-of-truth design (translate ONCE in Stage 5, both B and C consume) is what keeps the cost from doubling — without it, B and C would each translate independently and diverge.

---

## Quick reference — qa-check rules and which patterns they enforce

| qa-check rule | Enforces pattern... |
|---|---|
| `broken-image` | (general — image src must resolve) |
| `dead-link` | (general — non-placeholder href) |
| `design-quality-fonts` | 9.1 Display-quality typography |
| `duplicate-content-image` | 7.2 Image diversity within page |
| `fact-grounding` | 6.1 No fabricated facts |
| `fake-play-button` | 8.1 Never fabricate video |
| `hero-low-contrast` | 3.1 Hero three-layer contrast |
| `hero-no-overlay` | 3.1 Hero three-layer pattern |
| `html-entity-literal` | (general — no `&#NNN;` literal in DOM) |
| `icon-contrast` | 7.4 Icon contrast and quality |
| `image-low-resolution` | 7.3 Image resolution |
| `logo` | 4.1 Always preserve original |
| `logo-bg-mismatch` | 4.2 Background-aware placement |
| `logo-generic-alt` | 4.1 Always preserve original |
| `logo-is-placeholder` | 4.1 + CMS placeholder principle |
| `logo-literal-text` | 4.1 Always preserve original |
| `mobile-overflow` | 2.2 No horizontal overflow |
| `mobile-tap-target` | 2.3 Touch target size |
| `placeholder-copy` | 6.3 No CMS placeholders |
| `social-link-icon-internal-href` | 5.2 + 5.3 Social link integrity |
| `social-link-malformed` | 5.1 Preserve with correct destination |
| `social-link-placeholder` | 5.1 + 5.2 Omit if empty |
| `social-link-wrong-destination` | 5.1 Preserve with correct destination |
| `structure` | 1.1 Title and meta + general structure |
| `testimonial-tampering` | 6.2 Reviews verbatim |
| `text-contrast` | 3.2 Generic text contrast |
| `unicode-escapes` | (general — no `\uXXXX` literal in DOM) |
| `video-cta-fake` | 8.1 Never fabricate video |
| `video-cta-no-link` | 8.1 Never fabricate video |

If you satisfy every numbered pattern in this document, qa-check will pass. The visual treatment is yours.
