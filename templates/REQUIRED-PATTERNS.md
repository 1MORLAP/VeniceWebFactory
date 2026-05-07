# Required Patterns — the typed scaffold

Every WebFactory build (A, B, C) MUST satisfy these structural requirements. **Visual treatment is your design choice. Structure is non-negotiable.** Most have a `qa-check.js` rule that fails the build if violated.

If you can't tell whether you're satisfying a rule, READ this file. If a rule conflicts with your design, redesign — the rule wins.

> **Phase L.3 (2026-05-07)**: this file was rewritten as rule-tables (down from ~45KB prose). Same rules, denser presentation. The "Real bug shipped" anecdotes and skill-author rationale moved to FEEDBACK.md.

---

## 1. Document chrome (BaseLayout)

| Rule | What MUST exist | qa-check |
|---|---|---|
| 1.1 Title + meta | `<title>` (page + business name) · `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` · `<meta charset="UTF-8">` · `<meta name="description">` from manifest | `structure` (FAIL on missing `<title>`) |
| 1.2 Favicon | `<link rel="icon" href="/favicon.{ext}">` linking to a real file in `public/`. Use `manifest.favicon` if non-null; else fall back to logo per FAVICON RULE | broken-image (implicit) |
| 1.3 Skip-to-content | `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>` at top of `<body>`, jumps to `#main` | (a11y — not currently checked) |
| 1.4 Animation script | Animations are progressive enhancement — content fully visible without JS. `.fade-up`/`.stagger` default `opacity:1`; `html.has-animations` (added by JS) gates hidden→reveal. ≤1500ms safety timeout reveals everything if `IntersectionObserver` doesn't fire. Copy from scaffold's `BaseLayout.astro`; don't reinvent. | (not directly — pattern in scaffold) |

---

## 2. Mobile-first design

QA runs at FOUR viewports since Phase O (2026-05-07): mobile 390×844 (FIRST in scan order — primary conversion target, deploy-blocker), iPad 1024×1366 (md/lg breakpoint edge case), desktop 1440×900 (deploy-blocker), desktop-wide 1920×1080 (FHD viewing). Mobile is not an afterthought — it's the primary design target. The two new viewports (iPad + desktop-wide) are coverage upgrades that catch tablet-portrait and FHD-monitor bugs that previously slipped through; mobile-specific rules below (overflow at 390, ≥44px tap targets, ≥16px body, sticky-CTA) stay scoped to mobile only.

| Rule | What MUST hold | qa-check |
|---|---|---|
| 2.1 No horizontal overflow at 390px | Document `scrollWidth` ≤ viewport (≤8px tolerance). Common offenders: fixed-width sections without `max-w-full`, oversized images, long unbroken strings | `mobile-overflow` (FAIL) |
| 2.2 Touch target ≥ 44×44 CSS px | Every link / button / nav item / form input / social icon / phone CTA at 390px viewport. Use `min-h-[44px] min-w-[44px]` to bump hit area without changing visual size | `mobile-tap-target` (warn) |
| 2.3 Body text ≥ 16px on mobile | Smaller text triggers iOS zoom-on-focus on form inputs. Footer fine print can be smaller IF non-interactive | (default in scaffold; not directly checked) |
| 2.4 Mobile nav strategy | One of: hamburger drawer (each item ≥44px), pill-stacked vertical (each ≥44px), bottom nav bar (4-5 primary destinations). Hamburger button itself ≥44×44px | `mobile-tap-target`, `mobile-overflow` |
| 2.5 Sticky mobile CTA (trades only) | For trades / services customers (plumbing, HVAC, electrical, auto, landscaping, etc.), persistent "Call Now" / "Get Quote" bar at bottom of mobile viewport (`md:hidden`). High-conversion. | (judgment — Visual Sanity Pass) |

---

## 3. Hero sections (HERO CONTRAST RULE)

| Rule | What MUST exist | qa-check |
|---|---|---|
| 3.1 Three-layer pattern (when hero has photo bg) | (1) image layer, (2) overlay layer (solid color / gradient / blur — NOT optional), (3) text layer with color contrasting overlay-blended bg. Heading directly on `background-image` with no overlay = FAIL | `hero-no-overlay` (FAIL), `hero-low-contrast` (FAIL — WCAG <3:1 large text) |
| 3.2 Generic text contrast everywhere | Body (<24px, <18.66px bold): ≥4.5:1. Large (≥24px OR ≥18.66px bold): ≥3:1. qa-check walks all `h1-h6, p, a, button, li, span, td, th, label, summary, blockquote, dt, dd, figcaption, strong, em, small, b, i, u` and computes ratios | `text-contrast` (FAIL) |

---

## 4. Logo (LOGO RULE)

| Rule | What MUST hold | qa-check |
|---|---|---|
| 4.1 Always preserve original | Nav header MUST contain EITHER `<img src="/images/logo.{ext}">` (the customer's actual logo from `fix-logo.js`) OR plain text containing the verbatim business name in display font. NEVER design / invent a logo (no monogram, no abstract mark, no decorative wordmark) | `logo` (FAIL), `logo-is-placeholder` (FAIL — Hibu/CMS), `logo-literal-text` (FAIL — alt is "Logo"), `logo-generic-alt` (warn) |
| 4.2 Background-aware placement | If logo file is opaque, nav background MUST match `manifest.logo.backgroundColor` within ~5 RGB units. `fix-logo.js` writes the sampled color | `logo-bg-mismatch` (FAIL) |

---

## 5. Social links (SOCIAL LINKS RULE)

| Rule | What MUST hold | qa-check |
|---|---|---|
| 5.1 Preserve every social URL | Every link from `manifest.footer.social` MUST appear in footer with FULL EXTERNAL URL. NEVER `href="#"`. NEVER `href="/"`. NEVER point at customer's own site | `social-link-wrong-destination` (FAIL), `social-link-placeholder` (FAIL), `social-link-malformed` (FAIL), `social-link-icon-internal-href` (FAIL) |
| 5.2 OMIT if manifest empty | If `manifest.footer.social` is empty/missing, OMIT the social section ENTIRELY. Do NOT render placeholder icons. Do NOT guess handles from business name | `social-link-icon-internal-href` (FAIL — failsafe for icon-only anchors with internal hrefs) |
| 5.3 Required markup | `href` = full external URL · `aria-label="{Platform}"` exact (Facebook, Instagram, etc. — QA's platform identifier) · `target="_blank" rel="noopener noreferrer"` | detector requires `aria-label` |

---

## 6. Content integrity

| Rule | What MUST hold | qa-check |
|---|---|---|
| 6.1 No fabricated facts (FACT GROUNDING) | Every numeric / dated / credential / identity claim MUST originate in manifest OR follow logically from a manifest fact. No "20+ years" without a source year. No "BBB A+" without BBB mention. No "family-owned" / "veteran-owned" without identity claim | `fact-grounding` (FAIL — runs with `--manifest`) |
| 6.2 Testimonials byte-identical (TESTIMONIAL & REVIEW PRESERVATION) | Text inside `<blockquote>` / `<q>` / testimonial cards with named attribution MUST be byte-identical between A, B, C. No rewording, no grammar fixes, no composite reviews. Layout/styling/ordering = OK; words = verbatim | `testimonial-tampering` (FAIL — runs with `--reference-dist`) |
| 6.2.1 `<blockquote>` reservation | Use `<blockquote>` / `<q>` ONLY for actual quotes from named third parties (customer testimonials, named-employee quotes, "as featured in" press). Do NOT use for: brand taglines, pull quotes from your own copy, decorative oversized text. Putting a brand tagline in `<blockquote>` triggers `testimonial-tampering` false-positives | (semantic discipline) |
| 6.3 No CMS placeholders | Detected placeholder content (Hibu logo placeholders, lorem ipsum, "your video here", "coming soon", `123 Main St`, fiction-reserved 555-01XX phones, example.com emails) flagged by `detect-placeholders.cjs` MUST NOT appear | `placeholder-copy` (FAIL) |

---

## 7. Image handling

| Rule | What MUST hold | qa-check |
|---|---|---|
| 7.1 Image-to-page mapping | Each page uses images from THAT page's manifest entry (`pages[i].images` and `pages[i].backgroundImages`). Don't pull a residential photo onto a landscaping page just because rendering needs an image | (judgment — Visual Sanity Pass) |
| 7.2 Image diversity within page | Within any page's content area (excluding nav/header/footer), no content image (≥80×80px) may appear 2+ times. Service cards / feature tiles / sections each get a DISTINCT image | `duplicate-content-image` (FAIL) |
| 7.3 Image resolution | Every visible content image >200px wide MUST have natural width ≥ displayed width (≥1.5× for retina sharpness) | `image-low-resolution` (FAIL/warn) |
| 7.4 Image reuse — Option A renders ≥90% of must-reuse photos (IMAGE REUSE RULE) | A's `dist/` MUST render ≥90% of manifest's must-reuse photo inventory. Must-reuse = every `<img>` and CSS-bg image with `localPath`, EXCEPT: 1-99px wide (tiny icons), third-party rating badges (BBB/Yelp/Google/Trustpilot/Angie/HomeAdvisor), favicon/spinner/placeholder utility, duplicates (counted once). Customer logo as small chrome can be skipped; full-bleed photographic logo variants count as work photos | `image-reuse-A` (FAIL — requires `--option a --manifest`) |
| 7.4.1 Trade pattern (absorbs photo budget) | Hero with full-bleed work photo per page · Service tiles each with a representative work photo (text-only service cards = failure mode) · Portfolio/gallery section of 6-12 work photos · About/crew section with photos of owner/crew/trucks · Inline accent photos in long-form pages · Optional CTA backdrop. Editorial / typographic / file-tab / bracket-numbered design language belongs to **Option C**, not A | (pattern guidance) |
| 7.5 Option C image-quality escape hatch | C-only: if customer photo too poor (low res, compression artifacts, blurry, or required slot has no customer photo), substitute Unsplash / Pexels / curated AI. NEVER substitute owner / crew / team / actual logo (omit instead). 4 criteria: (1) thematically tight to industry, (2) aesthetically compatible with C's industry-tokens, (3) high quality (≥1500px, no AI uncanny tells), (4) documented in `option-c/build-design-decisions.md` (slot, original, reason, replacement). A and B never substitute | (no direct check — `image-low-resolution` catches the trigger) |
| 7.6 Icon contrast and quality | (1) Contrast ≥3:1 vs container background (WCAG 1.4.11). Add a contrasting badge shape if design wants tonal subtlety. (2) Consistent style across grid (same stroke / fill / radius / palette). (3) SVG preferred; PNG fallback only ≥128×128 24-bit transparent. (4) Semantic match (wrench → repairs, not new construction). (5) Material Symbols: Google Fonts loader, only verified names (invented names render ALL-CAPS) | `icon-contrast` (FAIL — `<img>` 16-80px outside chrome with computed bg-vs-icon WCAG <3:1) |

---

## 8. Video CTAs (VIDEO PRESERVATION RULE)

Never render "Watch Video" / play-button CTA unless a real video URL exists. `inspect-splash.cjs` (Stage 1e) tags each CTA's variant on `manifest.pages[*].videoCta._variant`. Render per variant:

| Variant | Source | Render |
|---|---|---|
| **A** direct MP4 (self-hosted) | `transcode-video.cjs` produced `/videos/{slug}.mp4` | `<video src="/videos/{slug}.mp4" controls playsinline preload="metadata" poster="/images/{poster}.jpg" style="width:100%;height:100%;object-fit:cover">`. `playsinline` mandatory (iOS fullscreen-takeover bug). `controls` mandatory (a11y). `preload="metadata"` (NOT `auto` — kills mobile bandwidth). Wrap in `<div style="aspect-ratio:16/9; max-width:100%">` |
| **B** HLS stream (transcoded to MP4) | Same as Variant A (transcode remuxed `.m3u8` → MP4) | Same `<video>` element. If transcode failed, fall back to `<a href="{original-splash-url}" target="_blank">Watch on the original site →</a>` |
| **C** third-party iframe | `videoCta._mediaSrc` + `videoCta._platform` ∈ {youtube, vimeo, brightcove, jwplayer, vidyard, wistia, loom} | `<iframe src={_mediaSrc} title="Video — {business name}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%; height:100%; border:0">`. Wrap in `<div style="aspect-ratio:16/9; max-width:100%">` (mandatory — bare iframes break responsive). `loading="lazy"` |
| **D** placeholder (Hibu/Wix/template — no real video) | n/a | DROP the section ENTIRELY. Replace with: phone CTA (if customer has phone), image gallery (if ≥6 work photos), before/after carousel (if paired photos exist), or testimonial card. NEVER substitute stock video. NEVER point original CTA href at `/about`/`/contact`/`#`. NEVER render original CTA with original href if href is a Hibu splash page |

qa-check enforcement: `video-cta-fake`, `video-cta-no-link`, `fake-play-button`, `video-missing-playsinline`, `video-too-large-mobile`, `video-iframe-no-aspect` (all FAIL).

---

## 9. Design quality (DESIGN QUALITY BAR)

| Rule | What MUST hold | qa-check |
|---|---|---|
| 9.1 Display-quality typography | Every page MUST load ≥1 display-quality web font for headings (Fraunces, Editorial New, DM Serif Display, Cormorant, Newsreader, Tenor Sans, Cabinet Grotesk, etc. via Google Fonts / @fontsource). NEVER ship a site whose only fonts are system Inter / Arial / Helvetica | `design-quality-fonts` (warn) |
| 9.2 Generous whitespace | Section padding ≥96px vertical desktop, ≥48px mobile. Inside-section padding ≥24px | (judgment — Visual Sanity Pass) |
| 9.3 Hero treatment beyond photo+headline | Every hero MUST include ≥1 supporting design element: horizontal rule, labeled section number ("01"), mono caption strip, attention bar, animated accent, hover-revealed accent. Bare hero ("photo + giant headline + button") is the template tell | (Visual Sanity Pass — "$80k smell test") |
| 9.4 Considered color palette | Design brief MUST list 3 primary + 2 accent colors max, EACH with brand role + rationale. No "blue and white" without explanation | (judgment — design-brief schema) |
| 9.5 One distinctive element per page | Each page MUST have ≥1 piece of design the customer would NOT have built themselves: custom card style, oversized heading with tight kern + custom underline, stat strip with mono captions, editorial pull-quote, numbered process strip | (Visual Sanity Pass) |
| 9.6 Micro-interaction | Every page MUST include ≥1 intentional micro-interaction: scroll reveal, hover with motion, animated counter, sticky-on-scroll nav transition. Static-only is template-grade | (Visual Sanity Pass) |

---

## 10. Brand recognizability (soft rule)

Aim to preserve ≥1 element from the original site so customer recognizes their brand: primary brand color, typography vibe (formal/casual, serif/sans, classical/geometric), hero composition, signature word/tagline.

**Override permitted** when original is genuinely terrible — preserve nothing IF justified in `jobs/{domain}/option-a/brand-preservation-note.md`. Silence is the failure mode.

---

## 11. Cross-build diversity

Each build must produce something visually distinct from prior builds in the same industry. Two plumbing customers should NOT get visually identical sites.

- Visual Sanity Pass item #18 (diversity check) is the model-mediated defense
- Document `option-{a,b,c}/build-design-decisions.md`: which inspiration directories consulted, which design moves drawn from each (with citation), what's intentionally unique to THIS build, what was deliberately NOT copied

---

## 12. Multilingual support (Options B and C — opt-in)

**English-only by default.** Initial `/webfactory <url>` builds B and C as English-only — no `/<lang>/` directories. Translations are explicit opt-in: `--languages <iso-codes>` at initial build OR `--add-language <name|iso> --to <b|c|both>` post-build.

- Translate ONCE in B's `/<lang>/`; C reads from B's translation source
- Option A is ALWAYS English-only regardless of flags (faithful-rebuild contract)

**Translate**: page text, headlines, body, CTAs, image `alt`, `<title>`, `<meta description>`, nav labels, button text, form labels, footer copy.
**Do NOT translate**: phone, email, license number, place names (Tampa, Lancaster, Ohio), business names, founder names, customer review attribution names, all `<img src>` paths, structural markup.

**Per-language testimonial tag** (mandatory below `<cite>` on every translated testimonial):

| Lang | ISO | Tag |
|---|---|---|
| Spanish | `es` | `(traducido del inglés)` |
| German | `de` | `(aus dem Englischen übersetzt)` |
| Russian | `ru` | `(переведено с английского)` |
| Italian | `it` | `(tradotto dall'inglese)` |
| French | `fr` | `(traduit de l'anglais)` |
| Portuguese | `pt` | `(traduzido do inglês)` |
| Polish | `pl` | `(przetłumaczone z angielskiego)` |
| Chinese | `zh` | `(从英语翻译)` |
| Japanese | `ja` | `(英語からの翻訳)` |
| Korean | `ko` | `(영어에서 번역됨)` |
| Dutch | `nl` | `(vertaald uit het Engels)` |
| Swedish | `sv` | `(översatt från engelska)` |
| any other ISO 639-1 | (the code) | `(translated from English)` (fallback) |

**File layout**: `option-b/src/pages/<page>.astro` (English) + `option-b/src/pages/<lang>/<page>.astro` per active language. C mirrors B's active languages.

**`<html lang>` attribute**: every `/<lang>/*` page renders `<html lang="<lang-code>">`; English pages render `<html lang="en">`. BaseLayout accepts `lang` prop (default `"en"`).

**Language switcher** (B + C only when ≥1 non-English active): renders all currently-active languages; current language non-clickable (`<span>`); each entry's `aria-label` references target language; tap target ≥44×44px. Style: simple toggle row when ≤3 languages, dropdown when ≥4. **A NEVER includes a language switcher.**

**Testimonial example** (German):
```astro
<blockquote>"Beste Preise, ausgezeichnete Arbeit! Drei Bäume zu einem unglaublichen Preis entfernt."</blockquote>
<cite>— Mark S. <small>(aus dem Englischen übersetzt)</small></cite>
```

qa-check rules (gated on `--option <b|c>`, silently no-op on English-only builds): `multilingual-page-parity`, `language-switcher-presence`, `html-lang-attribute`, extended `testimonial-tampering`. CLI: `--reference-dist-i18n` (canonical) → `option-b/dist`.

---

## Quick reference — qa-check rules → patterns

| qa-check rule | Enforces |
|---|---|
| `broken-image` | (general — image src must resolve) |
| `dead-link` | (general — non-placeholder href) |
| `design-quality-fonts` | 9.1 Display-quality typography |
| `duplicate-content-image` | 7.2 Image diversity within page |
| `fact-grounding` | 6.1 No fabricated facts |
| `fake-play-button` | 8 Never fabricate video |
| `hero-low-contrast` | 3.1 Hero three-layer contrast |
| `hero-no-overlay` | 3.1 Hero three-layer pattern |
| `html-entity-literal` | (general — no `&#NNN;` literal) |
| `icon-contrast` | 7.6 Icon contrast and quality |
| `image-low-resolution` | 7.3 Image resolution |
| `image-reuse-A` | 7.4 Option A renders ≥90% of must-reuse |
| `logo` | 4.1 Always preserve original |
| `logo-bg-mismatch` | 4.2 Background-aware placement |
| `logo-generic-alt` | 4.1 |
| `logo-is-placeholder` | 4.1 + 6.3 |
| `logo-literal-text` | 4.1 |
| `mobile-overflow` | 2.1 No horizontal overflow |
| `mobile-tap-target` | 2.2 Touch target size |
| `placeholder-copy` | 6.3 No CMS placeholders |
| `social-link-icon-internal-href` | 5.2 + 5.3 |
| `social-link-malformed` | 5.1 |
| `social-link-placeholder` | 5.1 + 5.2 |
| `social-link-wrong-destination` | 5.1 |
| `structure` | 1.1 + general |
| `testimonial-tampering` | 6.2 Reviews verbatim |
| `text-contrast` | 3.2 Generic text contrast |
| `unicode-escapes` | (general — no `\uXXXX` literal) |
| `video-cta-fake` | 8 Never fabricate video |
| `video-cta-no-link` | 8 |
| `video-missing-playsinline` | 8.A/B Variant render |
| `video-too-large-mobile` | 8.A Variant render |
| `video-iframe-no-aspect` | 8.C Variant render |
| `multilingual-page-parity` | 12 (B+C, gated) |
| `language-switcher-presence` | 12 (B+C, gated) |
| `html-lang-attribute` | 12 (gated) |

If you satisfy every numbered pattern in this document, qa-check will pass. Visual treatment is yours.
