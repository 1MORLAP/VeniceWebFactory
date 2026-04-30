# Inspiration: Industrial-Trades-Photo-Led

> **Status**: reference only. Read for ideas; do NOT `cp -r` this into a customer build.
>
> **Aesthetic**: Editorial-restrained craftsman / contractor portfolio. Warm-black ink + warm cream bone + terracotta rust + amber-on-dark. **Fraunces** (display serif, optical-sized) + **Inter** (body) + **JetBrains Mono** (technical captions). Hairline rules, generous interior padding, italic emphasis on display headlines, photos lead every section.
>
> **Industry fit (Option A on trade customers)**: plumbing, HVAC, electrical, roofing, landscaping, auto repair, body shop, cleaning, construction, septic/excavation, dumpster rental, painting, masonry, concrete, fencing, paving, locksmith, glass, demolition, excavation, junk removal, towing, lawn care, pest control — **when designing Option A**, where the rebuild should look like a polished contractor's actual website (suddenly expensive), NOT a magazine.
>
> **NOT for Option C** — for Option C on trades use the sibling `industrial-trades/` directory (workwear-document, bracket-numbered eyebrows, file-tab nav, hatched borders, ALL-CAPS condensed display). The two are intentionally distinct: A vs C is a "two studios pitched this" comparison.
>
> **Existence reason**: this directory was added 2026-04-29 after a real bug shipped — Option A for trade customers (giffins.net, ifixplumbing.com, and 22 others — see fleet audit at `scripts/audit-image-reuse.cjs`) drifted into magazine / NYT-editorial layout because the only available trade inspiration was `industrial-trades/`, which is editorial / typographic-heavy by design. Workers reached for it and shipped Option A's that used 0–25% of the customer's manifest photos. The customer's verbatim feedback: *"It used to be a website that had images that somehow looked like the original website. Right now it looks like a magazine."* See `IMAGE REUSE RULE` in `SKILL.md`.

## Reference URL

The customer-flagged "this is what Option A should look like" reference:
**https://elysian-gc-786s9d1zc-tomek-group.vercel.app/**

Open it. Scroll all the way down. Notice:
- Hero is a real photo of a house being worked on, NOT a typographic-only headline
- Mid-page nav (Home · Blog · Photos · About · Contact) — quiet, doesn't shout
- "Proudly serving Delaware and the surrounding areas." text-only callout
- "Interior & Exterior" featured project section with a photo of the actual job
- "Schedule a private estimate. Ask a question. Get advice." section with the **lead contractor's headshot** (Anthony Shawn) — single biggest trust signal on the page
- "A craftsman's portfolio — photographed honestly." 4-image gallery grid
- Footer with address, hours, license, social

That page renders 7+ content images and reads as a contractor's actual website. THIS is the bar.

## Aesthetic moves to draw from

### Typography

- **Display: Fraunces** (Google Fonts). Optical-sized variable serif (opsz axis 9–144). The hairline elegance at large sizes is what makes the headlines feel editorial-restrained, not "magazine." Use weight 500 at 88px with `font-variation-settings: 'opsz' 96` for hero headlines.
- **Italic emphasis pattern**: pick ONE phrase per headline (NOT the whole thing) and render it italic in `var(--color-rust)`. The contrast between roman ink and italic rust gives the headline character without shouting. See `.display-emphasis` in `src/styles/global.css`.
- **Body: Inter**, weights 400/500/600/700. Generous body size (17px desktop, 16px mobile minimum), line-height 1.6.
- **Mono: JetBrains Mono**, weight 600. Used SPARINGLY for technical captions only:
  - Section eyebrows: `01 / SERVICES · WHAT WE DO`
  - Photo annotations: `OAK ST · OCT '25`
  - Stat strip labels: `YEARS IN TRADE`, `BBB ACCREDITED`
  - Footer credentials: `EST. 2014 · LIC. #PA-128744`
- **Custom utility classes**: `.mono-caption` (12px, 0.18em letter-spacing, weight 600, rust-deep on bone) and `.mono-caption.on-dark` (amber-on-dark for dark sections). See `src/styles/global.css`.

### Color palette

- **Ink** `#1A1714` — warm-black with brown undertone. Body text, structural rules. Reads soft on cream, never harsh.
- **Bone** `#EAE2D2` — warm cream page wash. Signals canvas / contractor's site, NOT cold tech-white.
- **Bone-light** `#F4EFE6` — slightly lighter card surface so cards lift off the page.
- **Bone-dark** `#1F1B14` — dark section background (footer, mid-page dark band).
- **Rust** `#A8412A` — terracotta accent. Primary CTA button bg, italic emphasis word in display headlines, mid-page accent rules. Used in maybe 5–8% of page area as accent.
- **Rust-deep** `#7B2A1A` — darker rust for mono captions on bone (passes 4.5:1 WCAG body-text contrast).
- **Amber-on-dark** `#D9A441` — amber sap for mono captions on dark sections only. Fails 4.5:1 on bone, so don't use it there.

The palette is intentionally close to the elysian-gc reference. Not because we want clones, but because this palette IS the right answer for "warm dim contractor site." If your customer's brand color is different (blue, green, navy), swap rust → that brand color while keeping ink + bone + bone-light + amber-on-dark structure intact.

### Hero composition

- **Full-bleed work photo**, 0.65 opacity, with a 3-layer pattern: (1) image, (2) gradient scrim darker at bottom, (3) text + CTAs on top of the scrim. See `HERO CONTRAST RULE` in `SKILL.md`.
- **Mono eyebrow** above headline: `01 / EST. 2014 · PHILADELPHIA, PA` in amber-on-dark.
- **Display headline** in Fraunces opsz 96, italic emphasis on one phrase in rust-bright (the on-dark variant). Maximum 3 short lines.
- **Subhead** in Inter 19–20px, max 56ch, color `rgba(244,239,230,0.88)` for soft cream-on-dark.
- **CTA stack**: rust-bg primary + bone-outline secondary. NEVER amber-on-dark as a CTA (amber is for captions, not actions).
- **Photo annotation**: bottom-left mono caption `OAK ST · OCT '25` — like a contact-sheet annotation. Connects the photo to a real time/place and signals authenticity.
- **Optional bottom stat strip** (3-4 cells) with big Fraunces numbers + amber-on-dark mono labels.
- **No bracket-numbered eyebrows, no file-tab nav, no hatched borders.** Those are `industrial-trades/`'s vocabulary.

### Service cards (THE most important difference from `industrial-trades/`)

**Every service card has a REQUIRED work photo.** This is the single rule that prevents the magazine drift. Text-only service cards are the failure mode this entire directory exists to prevent.

- 4:3 aspect-ratio photo at the top
- Photo with optional bottom-left mono caption (location · date)
- Mono eyebrow under the photo: `01 / INTERIOR · DRYWALL`
- Title in Fraunces serif (NOT condensed sans, NOT ALL-CAPS)
- Hairline rule under title
- Body description in Inter, ink-muted color
- "Learn more →" link at bottom in mono — quiet, not a CTA button

If the customer has 4 services and 4 service photos in the manifest, every service card uses a distinct photo. If a service has no photo in the manifest, that's a content gap to flag — never a license to ship a text-only card.

### Portfolio grid (THE photo-budget absorber)

The single highest-leverage section for satisfying the IMAGE REUSE RULE. A "Recent Work" gallery with 4-12 customer photos absorbs 40-60% of the must-reuse pool in one move.

- Section eyebrow: `04 / RECENT WORK`
- Headline with italic emphasis: "A craftsman's portfolio — *photographed honestly*."
- Optional intro paragraph: 1 line of context ("Every photo on this page is from a real job. Ask for the full archive.")
- 4×1, 2×2, 3×2, or 4×2 grid depending on photo count
- Each photo gets:
  - 4:5 aspect ratio (taller than wide — feels like a portfolio book)
  - Photo annotation in bottom-left (location + date)
  - Below the photo: mono category label (small) + descriptive alt-as-caption (larger)

Hover lift: subtle scale 1.03 on the photo, no card lift. The photos are the content; the frames are silent.

### About-crew section

The lead contractor's headshot block. For small contractors, this is the highest-leverage trust signal on the home page — customers calling want to know "who am I talking to?" before they pick up the phone.

- 2-column at lg+: portrait photo (col-span-5) on left, bio + CTAs (col-span-7) on right
- Portrait in 4:5 aspect, with a decorative offset rust shadow behind the frame (purely decorative)
- Mono eyebrow: `03 / MEET THE LEAD`
- Display headline with multiple italic-emphasis lines: "Schedule a private estimate. *Ask a question. Get advice.*"
- Bio as a blockquote with a 2px rust left-border, max 56ch, Inter 18px
- Attribution row: small rust square + name + role
- Mono attribution-meta below: `EST. 2014 · LIC. #PA-128744`
- Two CTAs at the bottom

If the customer has no headshot AND no crew photo in the manifest, **drop this section** — don't ship a stock contractor. Real or omit.

### Stat strip

- 3-4 cells, hairline rules between cells
- Each cell: Fraunces big number (clamp 36–56px) + optional small mono unit + mono label
- Variants: `bone` (light, mid-page) or `dark` (above footer or in hero)

Distinguished from `industrial-trades/StatStrip.astro`:
- Numbers are Fraunces serif, NOT condensed sans
- Cells separated by hairline rules, NOT filled with hi-vis
- Subdued, editorial tone — credentials, not urgency

### Closing CTA

- Dark section (bone-dark) with bone-light text
- Mono eyebrow + Fraunces display headline with italic-emphasis word in amber
- 2-column: headline+body on left, CTA stack on right
- CTAs: rust primary (call) + bone-outline-on-dark secondary (estimate)

NEVER use amber as a CTA color (it's caption-only). NEVER use a hatched / caution-tape divider above this section (that's `industrial-trades/`'s vocabulary).

### Hairline rules, NOT hatched borders

The `.rule-thin` (1px ink at 18% opacity), `.rule-medium` (2px ink), and `.rule-on-dark` utilities. Used between section eyebrow and headline, between list items, between footer rows. Quiet precision.

NEVER `45° hatched amber/ink stripes`. That's `industrial-trades/`. Cross-pollinating between the two inspirations defeats the A vs C contrast.

## What NOT to copy

- ❌ Bracket-numbered eyebrows like `[ 02 ] · WHAT WE DO`. Use `02 / SECTION-NAME` mono caption with a slim numeric prefix.
- ❌ File-tab nav with filled-rect active state. Use underline-active or border-left-active.
- ❌ Hatched / caution-tape borders (`.hatched-border-y`). Use hairline `.rule-thin`.
- ❌ ALL-CAPS condensed sans display. Use Fraunces in title-case with italic emphasis on one phrase.
- ❌ Amber as a CTA color. Amber is mono-caption-on-dark only.
- ❌ Hi-vis safety yellow. That's `industrial-trades/`.
- ❌ Crew red. That's `industrial-trades/`.
- ❌ Text-only service cards. Photos are mandatory.
- ❌ Single-photo home pages. The page should render 8+ work photos.

## What this aesthetic does well

- **Reads as a contractor's site, not a magazine.** Customers calling a tree service / plumber / contractor instantly recognize the format and feel "I'm in the right place."
- **Trust signals are concrete and visible**: real work photos, owner headshot, license number, years in trade, BBB rating, address.
- **Editorial polish without editorial pretension.** Fraunces + JetBrains Mono is "polished contractor", not "NYT magazine."
- **Photos lead every section.** Hero photo, service-card photos, portfolio grid, owner portrait. Worker doesn't have to invent photo placements — the structure absorbs the photo budget naturally.
- **A vs C is preserved.** This aesthetic is photo-led editorial-restrained; `industrial-trades/` is workwear-document. The two would never be mistaken for the same studio.

## What this aesthetic doesn't do

- It's not the right fit for **SaaS / consulting / consumer-tech** — those want `saas-default/`.
- It's not the right fit for **restaurants / cafes** — those want `food-led/` (planned).
- It's not the right fit for **medical / dental / wellness** — those want `clinical-warm/` (planned).
- For **trade customers' Option C**, use `industrial-trades/` (workwear-document language is the right C-track differentiation).

## Local preview

```bash
cd templates/inspiration/industrial-trades-photo-led
npm install
npm run dev   # http://localhost:4321
```

The sample homepage renders 14 work photos (1 hero + 4 service-card + 8 portfolio + 1 portrait) — that's the photo density Option A trade builds should target.

## How to use as inspiration in an Option A build

1. Read `src/pages/index.astro` end-to-end. Notice the section sequence: hero → stat strip → services → about-crew → portfolio → closing CTA.
2. Read `src/components/Hero.astro` and `src/components/PortfolioGrid.astro` — those are the two highest-leverage components.
3. For your customer build, write FRESH components — do not `cp -r`. Adapt the palette to the customer's brand (often the rust → customer's primary color), keep the Fraunces+Inter+JetBrainsMono trio (or the customer's specific font choice if it has one).
4. **At least one Portfolio / Recent Work / Gallery section is mandatory** for trade customers — it's the single biggest factor in passing the qa-check `image-reuse-A` rule.
5. **Every service card MUST have a photo** mapped from the manifest's per-service images. Text-only service cards fail the design bar.
6. Document your design choices in `jobs/{domain}/option-a/build-design-decisions.md` — including why this aesthetic was chosen, which palette adaptation was made, which manifest photos went where.

The aesthetic is photo-led, editorial-restrained, craftsman. The customer should look at their rebuilt Option A and feel "this is MY site, but it looks like an actually-good version" — never "this is a magazine."
