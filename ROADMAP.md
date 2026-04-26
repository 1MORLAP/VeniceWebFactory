# WebFactory Roadmap

A living document. Past versions describe what's RETIRED. The "Current Architecture" section describes WHAT IS. The "Planned" section is what's been designed but not yet shipped. The "Considered" section is ideas that might or might not happen.

> **Source-of-truth precedence**: SKILL.md > CLAUDE.md > this file. If you find a conflict, SKILL.md wins. If you find something in this file that contradicts current SKILL.md behavior, treat this file as stale and fix it.

---

## Current Architecture (as of 2026-04-25 — "Three-Track A/B/C")

WebFactory ingests one URL and produces three deployed redesigns of the customer's site, plus the original, on Vercel. The customer compares them.

### The three options

| Option | Tagline | Text source | Design source |
|--------|---------|-------------|---------------|
| **A** | "Same site, suddenly expensive." | 100% original copy verbatim from manifest | Astro 5 + Tailwind v4, model-designed per design-brief.json. Must clear DESIGN QUALITY BAR (display fonts, generous whitespace, hero treatment beyond photo+headline, considered palette, distinctive elements, micro-interactions). |
| **B** | "Same site, suddenly persuasive." | Agency-rewritten conversion-tuned copy. Inherits A's structure. CTAs sharpened, value props reordered, lorem-ipsum replaced with manifest facts. **Testimonials/reviews stay verbatim** (TESTIMONIAL & REVIEW PRESERVATION rule). | A's design exactly — same logo, images, colors, typography, components, layout. Only words change. |
| **C** | "Same sharper words from B, industrial design language." | B's text verbatim (read from B's `.astro` files). | Frontend Design plugin + industry-anchored tokens (`industry-tokens.json`) — industrial for trades, food-led for restaurants, clinical-warm for medical, etc. NOT a generic editorial / magazine layout. |

### Customer comparison structure

- **A vs B** — measures the value of copy improvement. Design held constant.
- **B vs C** — measures the value of plugin-driven design. Text held constant.
- **Original vs A** — measures the dramatic improvement (Stage 4c-tris audit forces this comparison explicitly).

### Pipeline stages

1. **Scrape** (Playwright + raw-HTML fallback for Duda/Wix late-injecting widgets) → manifest.json with pages, sections, images, background images, social URLs, favicon, navigation, footer, meta.
2. **Fix logo** (`scripts/fix-logo.js`) — hunt for transparent/SVG variants, sample background, write `manifest.logo`.
3. **Detect placeholders** (`scripts/detect-placeholders.cjs`) — tag CMS template defaults so per-element rules know to fall back.
4. **Design Brief** (model) → design-brief.json that clears the DESIGN QUALITY BAR (typography pairing with rationale, palette with named roles, hero direction, distinctive-element catalog, micro-interaction list, mobile-first commitments, brand signature inventory).
5. **Build A** (Astro 5 + Tailwind v4, mobile-first) — preserve 100% original text + all images. FAVICON RULE applies. SOCIAL LINKS RULE applies (omit section if manifest empty, never `href="#"`). HERO CONTRAST three-layer pattern. Per-page distinctive element. Brand recognizability — preserve ≥1 signature OR justify the override.
6. **Visual QA — A** (`scripts/qa-check.js` at desktop AND mobile + screenshot review with 17-item Visual Sanity Pass + Stage 4c-tris Dramatic Improvement Audit).
7. **Build B** (copy A → option-b/, rewrite text only). Reviews/testimonials NEVER touched. FACT GROUNDING enforced.
8. **Visual QA — B** (qa-check + Visual Sanity Pass; `--reference-dist option-a/dist` enables testimonial-tampering check).
9. **Build C** (Frontend Design plugin + industry-tokens.json + reads B's .astro for text). Same content depth as A. Editorial drift is the #1 C failure mode.
10. **Visual QA — C** (qa-check + Visual Sanity Pass + editorial-drift check; `--reference-dist option-a/dist`).
11. **Deploy** — Vercel two-step prebuilt (`vercel build --yes` then `vercel deploy --prebuilt --yes`, no path arg) to team `tomek-group`. Disable SSO protection.
12. **Verify** — fetch each deployed URL, sanity-check content presence, social links, imagery.
13. **Report** — 4 links (Original + A + B + C). With `--skip-c`, 3 links.

### Top-level architectural rules (full definitions in SKILL.md)

- **CMS PLACEHOLDER PRINCIPLE** — customer's site is input not truth; detect template defaults and fall back per-element.
- **FACT GROUNDING PRINCIPLE** — every numeric/dated/credential/identity claim must originate in the manifest or follow logically. qa-check enforces 8 claim families.
- **TESTIMONIAL & REVIEW PRESERVATION** — reviews are real people's words; B and C must preserve A's testimonials byte-identical.
- **DESIGN QUALITY BAR** — operationalizes "suddenly expensive" with 7 concrete bar items.
- **LOGO RULE** — preserve original; background-aware placement; favicon fallback if no real logo; plain-text last resort.
- **HERO CONTRAST RULE** — mandatory three-layer pattern (image / overlay / text) with WCAG ratios.
- **MOBILE-FIRST DESIGN** — design for 390px first, scale up; ≥44×44px tap targets; ≥16px body text; sticky bottom-CTA for trades.
- **SOCIAL LINKS RULE** — preserve every social URL with correct destination; OMIT section if manifest is empty; defense-in-depth against the libertylandscapefl bug class.
- **FAVICON RULE** — set from manifest, fall back to logo; never ship without `<link rel="icon">`.
- **VIDEO CTA RULE** — never fabricate; current behavior drops the CTA. See "Planned: Video splash 4-variant preservation" below.
- **IMAGE-TO-PAGE MAPPING** + **IMAGE DIVERSITY** — page-bound images, no duplicates within a section, semantic match.
- **TEXT CONTRAST (generic)** — every visible text element checked for WCAG ratio against effective background.
- **IMAGE RESOLUTION** — every visible content image > 200px wide must have natural width ≥ displayed width.

### Tech stack

- **Scraping**: Playwright (headless Chromium) + raw-HTML regex fallback for late-injected social widgets
- **Output (all options)**: Astro 5 + Tailwind v4 (`@tailwindcss/vite`)
- **Forms**: mailto: links (no backend)
- **Deploy**: Vercel CLI two-step prebuilt flow → team `tomek-group` (slug) / `team_4Hr5Lqd6pY5D7gmeXDVsDmYx` (ID for MCP)
- **QA**: `scripts/qa-check.js` at both desktop (1440×900) + mobile (390×844), 26 deterministic checks; `scripts/qa.cjs` headless screenshots; structured 17-item Visual Sanity Pass

### Plugin dependency

- **Option C only**: `frontend-design@claude-plugins-official` installed via `claude plugin install` from terminal. If absent, C is skipped automatically. `--skip-c` flag also bypasses C entirely (no plugin needed).

### CLI flags

- `/webfactory <url>` — full Smart Resume
- `/webfactory <url> --option-b` / `--option-c` — skip to specific stage
- `/webfactory <url> --full` — `rm -rf jobs/{domain}/` then full rebuild
- `/webfactory <url> --skip-c` (aliases: `--no-c`, `--ab-only`) — build A and B only, skip Stage 7

---

## Recently Shipped (chronological — see FEEDBACK.md for verbatim user feedback per item)

### Wave 1 — Foundation (early April 2026)
- V1 → V1.5: stack unification (Option A and B both on Astro 5 + Tailwind v4)
- Logo legibility check (after fsolsidingcontractor 24×8px favicon-as-logo bug)
- Worktree-staleness ban
- Self-Learning Protocol (worker FLAGS, skill-owner FIXES)

### Wave 2 — Three-track architecture (mid April 2026)
- Option C added (Frontend Design plugin, industry-anchored)
- Architecture 2: B as canonical text source for C
- ABC rename (dropped "+" notation)
- Old Option B (Stitch-driven) RETIRED 2026-04-24
- Old "Option A+" renamed to "Option B" 2026-04-25
- Vercel deploy `--prebuilt` two-step flow (was silently broken; fixed)

### Wave 3 — Bug-class structural defenses (2026-04-25, this session)
- Hero contrast three-layer pattern (3 sites, 2 options)
- SS Power Washing logo bg-mismatch → corner sampling + nav-bg match
- Logo placeholder detection (Hibu gen-logo, Wix defaults) + favicon fallback chain
- CMS PLACEHOLDER PRINCIPLE + unified placeholder detector
- Social links HARD RULE on href + 5-path detector + structural failsafe + scraper raw-HTML fallback (libertylandscapefl recurred 3 times — 5 layers of defense now)
- Video CTA fabrication rule (drop if not real video)
- Image diversity within page
- Fact grounding (8 claim families, manifest-corpus verification)
- Active nav black-on-black → generic text-contrast scan + 17-item Visual Sanity Pass
- Mobile-first paradigm (qa-check at both viewports, mobile-overflow + tap-target checks, Stage 3b-bis directive)
- Image resolution check (any visible image > 200px must have natural ≥ displayed)
- Design Quality Bar (top-level rule + design-quality-fonts qa-check warning + Visual Sanity Pass $80k smell test)
- Dramatic Improvement Audit (Stage 4c-tris)
- Industry tokens for C (Stage 7b-bis)
- Brand recognizability (soft, with override)
- FAVICON RULE + scraper extraction + manifest.favicon
- Vercel Teams Configuration (explicit identifiers documented)
- Skill Lockdown (worker can't edit skill files)
- `--skip-c` flag
- TESTIMONIAL & REVIEW PRESERVATION rule + qa-check `testimonial-tampering` (this commit)

### Where we stand on QA
- **26 deterministic checks** in `scripts/qa-check.js` (was ~11 a week ago)
- **17-item Visual Sanity Pass** checklist
- **3 mandatory new stages** added: Stage 1d (placeholder detection), Stage 4c-bis (Visual Sanity Pass), Stage 4c-tris (Dramatic Improvement Audit), Stage 7b-bis (Industry Design Tokens)
- **5 layers of social-link defense**: scraper raw-HTML fallback → scraper persistence bugfix → build OMIT-if-empty rule → 5-path detector → structural failsafe

---

## Planned (designed, not yet shipped)

### Video splash 4-variant preservation
**Status**: full plan written, awaiting greenlight.

Hibu/Wix-style "Watch Video" CTAs link to splash pages. Currently we drop them per VIDEO CTA RULE. Plan:
- Splash inspection probe (`scripts/inspect-splash.js`) classifies splash URLs into 4 variants:
  - **A** — Direct MP4 → download + ffmpeg transcode to mobile-optimized H.264
  - **B** — HLS → ffmpeg remux to MP4 (or hls.js polyfill fallback)
  - **C** — Third-party iframe (YouTube/Vimeo/Brightcove/JW/Vidyard/Wistia) → re-embed
  - **D** — Hibu/template placeholder → drop (current behavior)
- Per-variant build rendering with mobile/iOS-correct attributes (`playsinline`, `controls`, `preload="metadata"`)
- New qa-check rules: `video-missing-playsinline`, `video-too-large-mobile`, `video-iframe-no-aspect`
- ffmpeg as soft dependency (graceful degradation)
- New top-level rule: VIDEO PRESERVATION (replaces VIDEO CTA RULE)
- Manifest schema additions for video metadata

Will require: `scripts/inspect-splash.js`, `scripts/transcode-video.js`, a new `Video.astro` component pattern (designed per-build per the scaffold + inspiration architecture — NOT shipped in `templates/scaffold/`, since scaffold is opinion-free; the pattern would be documented in `templates/REQUIRED-PATTERNS.md` instead), scrape.js integration, qa-check additions, SKILL.md restructure of VIDEO sections.

### Tiered model architecture (V2.1 — long-deferred)
**Status**: design exists, not started.

Currently every stage runs on the same model (whatever Claude Code is using). Some stages don't need Opus-level judgment (translation, report formatting, mechanical content parity audits). Designing a sub-agent dispatcher with per-stage model assignments could cut cost ~3–5× at equivalent quality. See git history of this file for the previous detailed design.

Lower priority than shipping bug-class defenses. Will revisit when the pipeline output quality stabilizes.

---

## Considered but Rejected (with reasoning)

These were proposed but explicitly turned down by the user. Listed so they don't get re-proposed.

- **A↔B design parity check** (programmatic CSS/section-count diff). Rejected 2026-04-25: small drift is fine; customer compares visually, not pixel-perfectly. Build cost too high for the value.
- **B↔C text parity check** (programmatic visible-text diff). Rejected 2026-04-25: FACT GROUNDING already catches the dangerous failure mode (fabrication). Stylistic tightening (e.g., "and" → "·" for layout reasons) is acceptable.
- **Customer-facing comparison report / 5th deliverable** (one-page HTML showing all 4 options side-by-side with diff annotations). Rejected 2026-04-25: that's a separate go-to-market project, not in WebFactory scope.
- **Source-material quality gate** (escalate to user if scrape returns thin manifest — fewer than N pages, fewer than X images, no testimonials). Rejected 2026-04-25: this is handled upstream at the funnel stage; WebFactory assumes a thick manifest as input.

---

## Considered (ideas, no commitment)

Things discussed but not designed:

- Design system continuity across builds: if a customer has multiple sites, reuse their design tokens
- Automatic A/B/B'/B'' variant generation: produce 3 Option B variants, pick the winner via design-critique
- Analytics integration: auto-add GA4/Plausible to deployed sites when credentials are provided
- CMS handoff: export A/B/C as static-CMS-editable sites (Decap, Sanity) so customers can edit copy
- Multi-language beyond Spanish (French, German, Portuguese on demand) — Spanish itself is currently paused per Testing Mode
- Voice/tone consistency: skill-level style guide per customer (formal vs casual, short vs long sentences)
- Brightcove DRM video respect: where C-variant videos use DRM, we embed iframe rather than attempt to download

---

## Retired (do not bring back)

- **V1** — single-session, single-model orchestration with Option B as pure HTML + Tailwind CDN. Asymmetric stack. Worse Lighthouse scores. Replaced by V1.5 stack unification.
- **V1.5 with Stitch as Option B design source** — Google Stitch MCP was used to generate Option B's design system from prompts. Retired 2026-04-24 in favor of the simpler "B = A's design + agency rewrite" architecture. Stitch-related scripts (`scripts/stitch-generate.js`, `scripts/stitch.sh`, `scripts/grab-heroes.js`) are kept on disk for reference but unused. Safe to delete.
- **Old "Option A+" notation** — renamed to "Option B" 2026-04-25 (the dropped-the-plus rename). Anywhere you see "A+" in old artifacts, mentally translate to "B".
- **Old "Option B" (Stitch-driven, pre-2026-04-24)** — different beast from current Option B. Existing `option-b/` directories from before that date may be V1-shape (HTML in `public/`); Smart Resume ignores them.
- **Spanish translation pipeline** — paused per Testing Mode (active 2026-04-16+). Stage 5f / 5g code paths are gated on the Testing Mode toggle. Will re-enable when A/B/C English output is stable.
- **Worktree-based parallel builds** — caused stale SKILL.md reads. Replaced with per-domain port allocation (`scripts/init-metrics.cjs` + `get-port.cjs`).
