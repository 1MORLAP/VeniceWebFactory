# Stage 3 — Build Option A (Faithful Rebuild)

> **Loaded by**: orchestrator (in monolithic mode) AND each Stage 3 Sonnet sub-agent (in decomposed mode — alongside `_shared.md` and the per-page spec).
>
> **Source of truth**: this is the canonical text for Stage 3. The summary in `SKILL.md` is a stub that points here.

### Stage 3: Build Option A (Faithful Rebuild)

> **The brief in one line:** _"Same site, suddenly expensive."_
> Same content, same imagery, same brand identity, same logo — but treated like a top-tier studio charged the customer $80k for the rebuild. Art-directed typography, intentional spacing, considered color palette, generous whitespace, smooth micro-interactions. Customers should look at it and think "that's MY site, but it looks like a different company built it." If you find yourself reorganizing copy or repositioning the brand, you've drifted from A toward B — back up.

Build a complete Astro website preserving 100% of the original text content.

#### 3-pre. Read the typed scaffold + inspiration + anti-slop references (MANDATORY before designing anything)

The `templates/` directory pivoted 2026-04-25 from "copy this whole template per-build" to "copy a minimal scaffold + design fresh per customer." The change prevents 100 plumbing customers getting 100 identical SaaS-aesthetic websites. Five things to read BEFORE writing any component code:

1. **`templates/REQUIRED-PATTERNS.md`** — non-negotiable structural requirements every build must satisfy. Mapped 1:1 to `qa-check.js` rules. Read this completely. The visual treatment of every requirement is your design choice; the structural requirement is non-negotiable.

2. **`templates/scaffold/README.md`** — what the scaffold provides (Astro config, BaseLayout document chrome, animation primitives, mobile-first defaults) and what it deliberately omits (every visual choice).

3. **At least ONE directory in `templates/inspiration/`** — pick the one that best matches the customer's industry direction:
   - `templates/inspiration/saas-default/` — tech / professional services / consultancies (was `templates/astro-base/` before the pivot)
   - `templates/inspiration/industrial-trades/` — plumbing, HVAC, electrical, construction, landscaping, auto, cleaning
   - `templates/inspiration/industrial-trades-photo-led/` — same industries, photo-led variant for Option A
   - (others added as the library grows)

   READ the components for ideas — prop APIs, structural patterns, animation usage, contrast handling. NEVER `cp -r` a component verbatim into the customer build. Every component is designed fresh per customer.

4. **`~/.claude/skills/refero-design/references/anti-ai-slop.md`** (Phase N.2, 2026-05-07) — THE anti-pattern checklist every per-page worker must internalize. Bans: indigo/violet defaults (`#6366f1`, `#8b5cf6`, `#7c3aed`), cards-as-default-container, dark-mode-by-default, emoji-as-icons, decorative left-accent stripe, generic 3-column pricing, hero-with-left-text-right-image, perfect symmetry. Plus the four litmus tests (Card / Image / Brand / Identity) — apply them as you draft each component. **NOT a specification** — these are bans. The customer's `_shared.md` defines the build's tokens.

5. **`~/.claude/skills/refero-design/references/craft-details.md`** (Phase N.2, 2026-05-07) — implementation-detail reference: `:focus-visible` (NEVER plain `:focus` or `outline: none` without a replacement), input `type=email` + `autocomplete=email` + `inputmode=email`, label association via `for=` or wrapping `<label>`, ≥ 44×44 hit targets, no `onPaste preventDefault` on inputs, `:focus-within` for compound controls. Apply these to every form / button / input the spec calls for. **NOT a specification** — these are how-to-build-it-correctly references.

#### 3a. Set Up Project (copy scaffold, install deps)

```bash
cp -r templates/scaffold/ jobs/{domain}/option-a/
```

```bash
cd jobs/{domain}/option-a/
npm install
```

The scaffold provides:
- Astro 5 + Tailwind v4 wired correctly (`astro.config.mjs`, `package.json` locked deps)
- `src/layouts/BaseLayout.astro` — document chrome, font-loading slot, header/footer slots, animation enhancement script (progressive — content visible without JS)
- `src/styles/global.css` — Tailwind import + empty `@theme` block with CSS variable hooks (you fill these in) + `.fade-up`/`.stagger` animation primitives + reduced-motion respect + 16px body minimum
- Empty `src/pages/` (you create pages here per manifest)
- NO components (you design them fresh per customer)

**DO NOT** create `.claude/launch.json` inside job directories — this triggers permission prompts that break unattended operation.

#### 3b. Design fresh components + pages (per design brief, REQUIRED-PATTERNS, inspiration)

Build the customer's site from scratch using:
- `jobs/{domain}/design-brief.json` — the customer's palette, typography, hero direction, distinctive elements, micro-interactions
- `templates/REQUIRED-PATTERNS.md` — what every build must structurally satisfy
- `templates/inspiration/{chosen-aesthetic}/` — examples of design moves to draw from (NEVER copy verbatim)

Specifically:
- Update `src/styles/global.css` `@theme` block with the design brief's color ramp + named-role rationale + display/text font CSS variables (`--brand-display`, `--brand-text`)
- Add font loading via `<slot name="head-fonts">` in your page templates → BaseLayout's head-fonts slot. Per DESIGN QUALITY BAR, must include at least one display-quality web font (Fraunces, Editorial New, DM Serif Display, Cormorant, Cabinet Grotesk, etc. — model picks based on industry/brand vibe; no curated list). System Inter / Arial alone fails the bar.
- Create `src/components/` directory and design fresh components per the customer (Nav, Hero, ServiceCard, Testimonial, Footer, etc.). Each must satisfy the corresponding structural rule in REQUIRED-PATTERNS.md.
- Create all pages from the manifest in `src/pages/`
- Copy ALL relevant images from `../assets/img/` to `public/images/` — BOTH regular images AND background images
- **Use `backgroundImages` from the manifest as hero section backgrounds** (the large full-bleed images behind text). Every page that had a background image in the original MUST have one in the rebuild
- **HERO CONTRAST — mandatory three-layer pattern.** Every hero section with a photo background MUST use the layered pattern: (1) image, (2) overlay/scrim div with non-transparent background-color, (3) text positioned above the overlay with a color chosen to contrast with the overlay-blended bg. Skipping the overlay or using dark text on a dark-overlayed photo is the bug we shipped on Naples FL Pressure Washing (Options A and C) and Tampa Bay landscape co (Option A). See full rule at top of SKILL.md (`HERO CONTRAST RULE`). qa-check.js will fail the build if a heading sits on a `background-image` without a detectable overlay, OR if computed contrast ratio < 3:1 for large text.
- **IMAGE REUSE — at least 90% of must-reuse manifest images MUST appear in the build.** See full rule at top of SKILL.md (`IMAGE REUSE RULE`). The customer's original site is a small-business website with photos of the work; A is the same kind of site, suddenly expensive — NOT a magazine layout. Service cards must each have a representative photo (text-only service cards are the failure mode). Add a portfolio / gallery / "Recent Work" section to absorb 6-12 photos in one move (model: `https://elysian-gc-786s9d1zc-tomek-group.vercel.app` "A craftsman's portfolio — photographed honestly"). If the brief calls for editorial / typographic / file-tab / bracket-numbered design language, **that belongs to Option C** — Option A stays photo-led. qa-check.js will fail the build if the rendered set covers < 90% of the must-reuse pool.
- Use regular `images` as inline content images in two-column layouts alongside text
- Preserve ALL original text word-for-word
- Keep all video embeds (YouTube/Vimeo iframes)
- **SOCIAL LINKS — preserve every one, with the correct destination URL.** Read `manifest.json → footer.social` (an array of `{platform, href}` objects populated by the scraper from BOTH live DOM and a raw-HTML regex fallback that catches Duda / Wix / late-injecting widgets). Cross-check `design-brief.json → business.socials` if it exists. ALL discovered social/business-listing links MUST appear in the footer (and in the header/contact area if the original had them there).

  - **HARD RULE on the `href`**: each social link's `href` MUST be the FULL EXTERNAL URL from `manifest.footer.social` (e.g. `href="https://www.facebook.com/CustomerBusinessName"`). NEVER use `href="#"`, NEVER use `href="/"`, NEVER point a Facebook icon to the customer's own website. The icon is a destination signal — if it doesn't go to the platform it represents, it's worse than useless because it actively misleads visitors.

  - **HARDER RULE — IF `manifest.footer.social` IS EMPTY OR MISSING, OMIT THE SOCIAL SECTION ENTIRELY.** Do NOT render Facebook/Instagram/etc. icons with `href="#"`, `href="/"`, or `href="https://www.facebook.com"` (homepage URL guess). No exceptions. If the customer never had social, the build doesn't ship social. If you're tempted to "guess" the brand's social handle from the business name (e.g., `facebook.com/{businessname}`) — STOP. Guessed URLs that 404 are worse than no link at all. The recurring 2026-04-25 bug (libertylandscapefl.com Option C) shipped `<a href="#" aria-label="Facebook">` placeholder anchors — qa-check failed-open because nobody ran the gate, and the customer saw fake social icons.

  - **REQUIRED MARKUP for every rendered social link** (so qa-check can verify):
    1. The `href` attribute MUST be the FULL EXTERNAL URL (not `#`, not `/`)
    2. The `aria-label` attribute MUST name the platform exactly: `aria-label="Facebook"`, `aria-label="Instagram"`, etc. (so QA can identify which platform this anchor claims to be)
    3. `target="_blank" rel="noopener noreferrer"` (so the visitor leaves the site cleanly and the customer's site doesn't get tab-napped)
    4. The icon child (svg/img/Material Symbols/Font Awesome) is fine, but the ANCHOR's aria-label is the single source of truth for QA platform identification

  - **Three real bugs we've shipped**:
    1. SS Power Washing — social links dropped entirely from the rebuild
    2. Liberty Landscape FL (first occurrence) — social icons present and styled, but every `href` pointed to the customer's own website instead of facebook.com / instagram.com. Cosmetically perfect, functionally broken
    3. Liberty Landscape FL (second occurrence, 2026-04-25) — `href="#"` placeholder anchors in Option C because the scraper missed the social URLs entirely (Duda widget loaded AFTER networkidle), and the worker session defaulted to placeholder hrefs instead of OMITTING the section

  - **Fix this once, never miss again.** qa-check.js now has FIVE detection paths for the platform identifier (text, aria-label, title, className tokens, icon-class regex, image src filename) PLUS a structural failsafe that fails the build for any icon-only anchor in `<footer>` or a `[class*="social"]` container that points to an internal href — even when no platform was identified. The scraper now has a raw-HTML regex fallback that catches social URLs late-injecting widgets miss. AND if the manifest is empty for socials, the build OMITS the section entirely instead of placeholder-ing.

- **FAVICON RULE** — Read `manifest.favicon` (an object set by the scraper containing `{src, localPath, rel, sizes, type, ext, sizeBytes, source}`, or `null` if no favicon was scraped):
  - **If `manifest.favicon` is set**: copy `assets/img/favicon.{ext}` to `public/favicon.{ext}` AND add `<link rel="icon" type="{type}" href="/favicon.{ext}">` to BaseLayout's `<head>`. Use the captured `type` and `sizes` attributes if present.
  - **If `manifest.favicon` is null**: fall back to the logo. Take `public/images/logo.png` (or whatever logo file ended up there after `fix-logo.js`), generate a 32×32 and 192×192 favicon-style copy if you can (skip if no easy way to resize — just point `<link rel="icon" href="/images/logo.png">`). Note in the brand-preservation-note that the favicon was derived from the logo.
  - **Never ship a build with NO favicon link** — browser tabs without a favicon look like an unfinished site. Default browser globe favicon = template tell.
  - The scraper also tries `/favicon.ico` as a last-ditch fallback before reporting null, so `manifest.favicon` should usually be populated. If it's null, the original site genuinely had no favicon.

- Keep all phone numbers, email addresses
- Build the contact form as a mailto: link to the business email

#### 3b-tris. BRAND RECOGNIZABILITY (soft rule — preserve at least one signature)

The customer should look at A and feel "that's MY site, but it looks like a different company built it" — not "this is a different company entirely." Total brand erasure is a failure mode that ships when the design brief picks all-new colors and fonts without considering what the customer's actual brand signal was.

**Soft rule**: aim to preserve at least ONE element from the original site so the customer recognizes their brand:

- **Primary brand color** — the most-used color on the original site, OR the dominant color of the original logo. Carry it forward as A's primary or strong accent. Even modernized, the color signal endures.
- **Typography vibe** — formal/casual, serif/sans, classical/geometric. If the original used a script for the wordmark, A's display font might lean classical; if the original was utilitarian sans, A leans clean modern. The vibe carries even when the specific font changes.
- **Hero composition** — if the original site had a recognizable hero photo (specific truck, crew, signature work, building), use it in A's hero rather than swapping for a stock photo.
- **Signature word/tagline** — if the original site features a memorable tagline or copy phrase (e.g., "We Show Up On Time"), keep it visible somewhere prominent in A.

**Read the brand signature inventory** in `design-brief.json` (Stage 2 outputs this). Pick at least one to preserve. State which one in `jobs/{domain}/option-a/brand-preservation-note.md` (one short paragraph for traceability).

**Override permission**: if the original site is genuinely terrible — clashing colors, illegible fonts, generic stock chrome with no signature, a logo that's a placeholder — you have explicit permission to preserve nothing. In that case, write to `brand-preservation-note.md`: "No preservable signature found in original. Reasoning: [one sentence — e.g., 'site uses a Hibu placeholder logo, default Arial body, no brand color, no memorable tagline; the original is itself a template the customer never personalized']." Silence is not acceptable — make the call explicitly.

This is a soft rule because the override exists. But silence (preserving nothing without acknowledging it) is a failure: the worker session must either preserve OR justify.

Key design rules:
- NEVER change, paraphrase, or omit any text from the original site
- Make the design STUNNING - this is the most important thing
- Use generous whitespace, strong visual hierarchy, modern layout patterns
- **CONSISTENT CARD STYLING**: All cards within the same section must use the same visual treatment — same border color, same icon background, same hover effect. Do NOT use different accent colors per card. Consistency looks professional; rainbow accents look like a template.
- Add CSS animations: fade-in on scroll, hover effects, smooth transitions
- **PROGRESSIVE ENHANCEMENT FOR ANIMATIONS**: Never use `opacity: 0` as the default CSS state for content sections. All content must be visible without JavaScript. Use a pattern like `html.has-animations .fade-up { opacity: 0; }` where JS adds `.has-animations` to `<html>`. Also add a safety fallback timeout (2-3 seconds) that reveals all elements in case the IntersectionObserver doesn't fire. Content that's invisible without JS = broken site for crawlers, slow connections, and QA screenshots.
- Consolidate similar location-specific pages if there are many near-identical ones

#### 3b-bis. MOBILE-FIRST DESIGN (mandatory for all options)

**More than half of small-business site traffic is mobile. Mobile is not the "responsive afterthought" — it is the primary design target.** Every component, every page, every interaction must be designed mobile-first and scaled UP to desktop, not the reverse.

**Hard rules** (qa-check.js enforces the programmatic ones at FOUR viewports since Phase O 2026-05-07: mobile 390×844 — primary, deploy-blocker; iPad 1024×1366 — md/lg edge case; desktop 1440×900 — deploy-blocker; desktop-wide 1920×1080 — FHD viewing. Mobile-specific rules listed below stay scoped to mobile only):

1. **Mobile-first CSS**: write the base styles for the 390px viewport. Use Tailwind responsive prefixes (`md:`, `lg:`) to scale UP, not down. Default classes apply to mobile; `md:` and `lg:` classes are progressive enhancements for wider screens.

2. **Touch target minimum**: every interactive element (link, button, nav item, form input, social icon, phone CTA) must be ≥ 44×44 CSS px on mobile (WCAG 2.5.5). Add padding or `min-h-[44px] min-w-[44px]` to small text links to bump their hit area. **qa-check warns on every tap target under 44px at the mobile viewport.**

3. **No horizontal overflow at 390px**: nothing — no section, no image, no card, no long unbroken string — may extend past `100vw` at the mobile viewport. Common offenders: fixed-width sections, oversized images without `max-w-full`, tables, long URLs in body copy. **qa-check fails if document scrollWidth > viewport width at 390px.**

4. **Image sizing for mobile**: heroes and content images displayed full-bleed on mobile must source images sized for retina mobile (≥ 780px wide for a 390px display). A 850px hero stretched to 1440px on desktop AND down to 390px on mobile fails desktop's resolution check; either provide a higher-res source or use `srcset`. **qa-check fails if any visible content image's natural width is less than its displayed width.**

5. **Mobile nav**: hamburger menu OR pill-stacked nav OR bottom nav bar — pick one and execute it cleanly. The hamburger button must be ≥ 44×44px (rule 2). Menu items inside the drawer must each be ≥ 44px tall. The phone-CTA in nav should remain visible (or at least one tap away) on mobile because phone calls are the #1 mobile conversion event for trades sites.

6. **Mobile typography**: body text minimum 16px (smaller text on mobile triggers iOS zoom-on-focus and feels cramped). Hero headlines should scale fluidly — `text-4xl md:text-6xl lg:text-7xl` or use `clamp()`. No text below 14px anywhere on mobile (footer fine print is the exception, but only if it's not interactive).

7. **Sticky mobile CTA**: for trades/services sites, a persistent "Call Now" or "Get Quote" bar at the bottom of the mobile viewport is high-conversion. Add it. Hide on desktop with `md:hidden`.

8. **Spacing on mobile**: section padding shrinks proportionally. Default `py-24 md:py-32` is fine for desktop; mobile gets `py-16` or less. But preserve breathing room — don't crush sections together.

**The mobile screenshot is half of QA — not a checkbox.** Every screenshot review (Stage 4c) must look at mobile-home, mobile-about, mobile-services etc. with the same scrutiny as desktop. Mobile-only bugs (overflow, broken hamburger, stretched hero, tap-target failures) are full deploy blockers.

#### 3c. Build Check

```bash
cd jobs/{domain}/option-a/
npm run build
```

Fix any build errors before proceeding to QA.
