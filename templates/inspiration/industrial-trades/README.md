# Inspiration: Industrial-Trades

> ## ⚠️ A vs C compatibility warning (added 2026-04-29 after Option A drift bug)
>
> The aesthetic in this directory — **bracket-numbered eyebrows, file-tab nav, hatched caution-tape borders, ALL-CAPS condensed display, label-mono captions, hard 90° edges** — IS the workwear-document vocabulary that should be reserved for **Option C** (the plugin track), not Option A.
>
> When this directory was used as inspiration for **Option A** trade-customer builds (giffins.net, ifixplumbing.com), the result was a magazine / NYT-editorial layout with **typographic-only service cards** and **0–2 photos on the home page**, while the customer's manifest had 30+ work photos sitting unused. The customer's verbatim feedback: *"It used to be a website that had images that somehow looked like the original website. Right now it looks like a magazine, which is the Claude Design aesthetic. But we wanted to reserve [editorial] for Option C while Option A aligns a little more with the original."*
>
> **For Option A on trade customers**: do NOT draw the aesthetic skeleton from this directory. Option A's job is to render a small-business contractor's website (suddenly expensive), NOT to repackage the customer as an editorial brand. The right reference is `https://elysian-gc-786s9d1zc-tomek-group.vercel.app/` — photo-led, hero with real work shot, service tiles each with a photo, "A craftsman's portfolio — photographed honestly" gallery grid, contractor headshot. **At least 90% of must-reuse manifest photos must appear in Option A's build** (qa-check `image-reuse-A` rule, see SKILL.md `IMAGE REUSE RULE`).
>
> **For Option C on trade customers**: this is the right reference — `industry-tokens.json` for trades calls for exactly this vocabulary (bracket-numbered, file-tab, mono captions, hatched borders, hi-vis CTA on workwear navy).
>
> A photo-led `industrial-trades-photo-led/` inspiration directory is planned (see master `templates/inspiration/README.md`) — until it ships, **for Option A trade builds, lean on the elysian-gc reference URL + the patterns described in SKILL.md `IMAGE REUSE RULE` rather than this directory's aesthetic**.

---

> **Status**: reference only. Read for ideas; do NOT `cp -r` this into a customer build.
>
> **Aesthetic**: Workwear / safety / utility-poster / contact-sheet. Dark workwear navy + crew red + hi-vis safety yellow + warm cream. Industrial sans display + Inter body + JetBrains Mono captions. Hard 90° edges, bracket-numbered sections (`[01]`), file-tab nav, hatched caution-tape borders.
>
> **Industry fit (Option C only — see warning above for Option A)**: plumbing, HVAC, electrical, roofing, landscaping, auto repair, body shop, cleaning, construction, septic/excavation, dumpster rental — when designing **Option C** for trades. The plugin's `industry-tokens.json` for trades selects this vocabulary.
>
> **Wrong for Option A on trades** — see warning above. Wrong for: SaaS, consulting (use `saas-default/`), restaurants/cafes (use `food-led/` when built), medical/dental (use `clinical-warm/` when built), law/finance (use editorial-restrained, future).

## Aesthetic moves to draw from

### Typography
- **Display: Bricolage Grotesque** (Google Fonts) or Cabinet Grotesque (Fontshare). Wide, weight-character industrial sans. NOT Inter at heavy weights — that reads consumer.
- **Text: Inter**, weights 400/500/600/700. Neutral, readable at small sizes.
- **Mono: JetBrains Mono** for captions, section indices, file-tab nav, stat strip labels. The mono is non-negotiable — it's the workwear-document signal that distinguishes this aesthetic from generic SaaS.
- **Custom utility classes**: `.label-mono` (11px, 0.18em letter-spacing, uppercase, weight 500) and `.label-mono-lg` (13px, 0.16em, weight 600) — see `src/styles/global.css`.

### Color palette
- **Workwear navy** (`--color-navy-900` through `--color-navy-50`): primary trust anchor. Use for nav backgrounds, hero overlays, body text on light, dark sections.
- **Crew red** (`--color-crew-500`/`600`/`700`): SECONDARY accent. Used SPARINGLY for section labels, "URGENT" callouts, status indicators. Not a CTA color.
- **Hi-vis safety yellow** (`--color-hivis-400`/`500`/`600`/`700`): CTA color ONLY. Reserved for primary action buttons, "Call Now" stickers, "Quote in 24hrs" badges. If you use it elsewhere it loses its CTA signal.
- **Bone** (`--color-bone-50`/`100`/`200`/`300`): warm-cream page wash and card surface. Signals workwear/canvas, not cold tech-white.
- **Ink** (`--color-ink`/`-muted`/`-subtle`): warm charcoal for body text and structural lines.

The palette ratios matter: the page is overwhelmingly bone + ink + navy with hi-vis used in maybe 5-8% of the page area as accent. Crew red is even more sparing — maybe 1-2% as section labels.

### Hero composition
- **Two-column grid** at lg+ (photo on left, dark headline column on right with diagonal scrim from photo edge).
- **Single-column** at mobile with full-coverage navy/60 overlay so headline is legible.
- **Bracket-numbered eyebrow**: `[01]` in hi-vis on a 2px hi-vis rule, then mono caption ("EMERGENCY · 24/7"). Workwear-document signal.
- **Photo caption**: mono label in bottom-left of the photo, e.g. `OAK ST · MARCH '26` — like a contact sheet annotation. Connects the photo to a real time/place.
- **CTA stack**: hi-vis primary (call dispatch / call now), navy outline secondary (quote / contact).
- **No gradient orbs, no noise textures, no centered headlines, no floating decorations.** Hard edges only.

### Section pattern
Every major section follows the same opening rhythm:
```
[02]  ────  SECTION-NAME · SUBTITLE
            (bracket-numbered eyebrow with hi-vis number,
             2px solid rule, mono caption)
H2 headline (display font, weight 800, oversized)
... section content ...
```
This rhythm is what makes the page feel like a workwear document or service manual rather than a magazine.

### File-tab nav
Active page = filled black file-tab background with cream text + hi-vis bracket index. Inactive pages = mono bracket index in subtle color, hover-fill to a light gray. Entirely different from the "underline" or "pill" patterns in saas-default. Read `src/components/Nav.astro`.

### Hatched borders (caution-tape)
The `.hatched-border-y` utility creates a 6px-tall diagonal yellow-and-black caution-tape stripe. Use at the top of footer, between major sections that change context, around emergency/24-7 callouts. Don't overdo it — 2-3 occurrences per page max.

### Stat strips
Bracket-numbered stats (e.g., "23 YRS · 4,800 JOBS · 4.9★ · 24/7") rendered as a grid with hi-vis numbers, mono unit labels, mono description labels, vertical rules between. Read `src/components/StatStrip.astro`. **CRITICAL**: only use real numbers from the manifest per FACT GROUNDING — never fabricate.

### Service cards
- Photo full-bleed at top with `SVC 01`/`SVC 02`/etc. mono index overlaid in the corner (hi-vis on navy)
- Display-font heading + Inter body
- Bottom rule with mono "VIEW DETAILS" + arrow that translates on hover
- **Sharp 90° corners only** — no rounded-xl, no rounded-2xl, no shadow elevation. Hard edges signal the aesthetic.
- Each card has a DISTINCT photo (IMAGE DIVERSITY rule)

### Footer
- Hatched caution-tape border at top
- Dark navy background
- Brand block with hi-vis CTAs
- Hours and address blocks with hi-vis section labels
- Socials only if real per SOCIAL LINKS RULE (omit if manifest empty, never `href="#"`)
- Bottom utility-strip attribution: `FILE · CUSTOMER · LICENSED · INSURED · © YEAR`

## What this inspiration does WELL (worth drawing from)

- **Identity-clear at 3 seconds**: a stranger seeing this homepage knows it's a trades business, not a SaaS app or a consultancy. The editorial-drift check in Visual Sanity Pass item #17 should pass for any C build that genuinely adopts this aesthetic.
- **Hi-vis CTA hierarchy**: phone CTA always visible, always one tap away. The #1 mobile conversion event for trades.
- **Real-photo bias**: every section uses a customer photo (truck, crew, finished work) rather than typographic-only "modern minimal" treatment.
- **Bracket-numbered sections**: gives the page a service-manual rhythm that reads as competent and organized.
- **Mono captions on photos**: turns generic stock-looking photos into specific work-record-looking photos.

## What this inspiration does WRONG (don't copy these directly)

- **Hardcoded sample copy** ("Hartman Plumbing & Drain", testimonial text, service descriptions): all this is fictional. Real builds use the customer's actual content from the manifest.
- **Stock Unsplash photos**: real builds use the customer's scraped photos from `manifest.pages[i].images` and `manifest.pages[i].backgroundImages`. NEVER use stock photos in production builds — IMAGE-TO-PAGE MAPPING rule.
- **Single hero variant**: real builds vary the hero treatment per page (homepage hero ≠ services-page hero ≠ contact-page hero). This file shows ONE hero composition; real builds compose multiple.
- **No Bricolage Grotesque license check**: Google Fonts hosting is fine for production but always verify license terms (Bricolage is OFL, fine to use).

## How to use this as inspiration

1. Open the components and read them. Notice the prop APIs, color usage, mono caption patterns, file-tab nav structure, hatched-border placement.
2. For a NEW trades-customer build:
   - Adapt the palette to the customer's actual brand color (replace `--color-navy-900` with their primary; keep the workwear-aesthetic structure)
   - Use the customer's photos in place of the stock Unsplash placeholders
   - Use the customer's actual services in place of the four sample services
   - Use VERBATIM customer reviews in place of the sample testimonial (TESTIMONIAL & REVIEW PRESERVATION rule)
   - Use ONLY real stats from the manifest in the StatStrip (FACT GROUNDING rule)
3. Cite this directory in your `build-design-decisions.md`: e.g., "drew bracket-numbered eyebrow pattern + file-tab nav from `industrial-trades/`. Replaced workwear navy with customer's actual brand color (#8B0000 — they're a fire-restoration company, oxblood reads industrial-but-on-brand). Photo captions on heroes adapted from this inspiration."
4. NEVER `cp -r` any component file from here. Read the structure, write a fresh component for the customer in their voice and brand.

## To preview this aesthetic locally (optional — for getting a visceral sense)

```bash
cd templates/inspiration/industrial-trades
npm install
npm run dev
# Open http://localhost:4321
```

You'll see the sample homepage rendered. Click "Repair Services" / "The Shop" / "Contact" in the nav (they 404 because no pages exist — this is a one-page reference).

See `templates/REQUIRED-PATTERNS.md` for the structural requirements every build must satisfy regardless of which inspiration you draw from.
