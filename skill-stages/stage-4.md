# Stage 4 — Visual QA & Polish (Option A)

> **Loaded by**: orchestrator (Opus runs Stage 4 directly — visual review and design judgment require holistic context). Sub-agents may be dispatched for fix-loop work per the decomposed-mode template — see SKILL.md "Stage 4 fix-loop split."
>
> **Source of truth**: this is the canonical text for Stage 4. The summary in `SKILL.md` is a stub that points here.

### Stage 4: Visual QA & Polish (Option A)

**This is the most critical stage.** Run headless QA, visually inspect screenshots, and iterate until the site is beautiful and bug-free.

#### QA philosophy (read this first — it overrides any tactical advice below)

> **If a human would see it as a bug, the gate must catch it.**

QA has two layers, BOTH mandatory. Neither one alone is sufficient:

1. **Deterministic layer (`scripts/qa-check.js`)** — pattern-based programmatic checks for known bug classes. Cheap, fast, exhaustive across pages. Catches the bug classes we've seen before AND general-purpose readability/structure violations (text-contrast scan, broken images, missing nav/footer/h1, etc.). Exits non-zero → blocks deploy.

2. **Visual layer (you, the model, reviewing screenshots from `scripts/qa.cjs`)** — open-ended visual judgment for bugs that don't fit a regex. Misaligned grids, weird whitespace gaps, cards that overflow, color combinations that look wrong despite passing contrast, a hero that's "fine" but obviously crooked, an active nav state that's the wrong shape, a CTA button that's been styled as a dead link. **You are explicitly tasked with looking for things we haven't enumerated yet** — every novel "looks broken to a human" bug eventually becomes a new programmatic check, but until then it's your job to catch it on sight.

**Why both layers**: every shipped bug class falls into one of two patterns — (a) we never wrote a programmatic check for it, OR (b) the check exists but is too narrow. The visual pass catches (a); the deterministic gate catches (b) plus the long tail of regressions. Skipping either layer ships bugs.

**The pipeline must structurally support both**: qa-check.js is run unconditionally (Stage 4b/8a). The visual sanity pass is run unconditionally (Stage 4c-bis below) with an explicit checklist of human-eye bug classes — not as a free-form "look at this." The checklist is in 4c-bis. Add to the checklist any new bug class shipped to the user.

Two QA scripts run in tandem, both headless:
- `scripts/qa.cjs` — captures desktop + mobile screenshots and checks console/network errors. Screenshots are for YOU (the model) to visually review via Read tool.
- `scripts/qa-check.js` — automated pass/fail gate. **Runs at BOTH desktop (1440×900) and mobile (390×844) viewports for every page.** Currently checks: logo legibility (natural px vs displayed px), broken images, literal `\uXXXX` escapes, **literal HTML entity references rendered as visible text** (catches `&#128027;` etc. shown as raw text instead of decoded emoji — same bug class as `\uXXXX` escapes, different syntax), missing nav/footer/h1, hero contrast (text over photos), generic text contrast (every text node vs effective background, WCAG ratios), social-link destinations (5-path detector + structural failsafe for icon-only anchors with internal hrefs), video-CTA reality, placeholder copy, image diversity, image resolution (any visible image > 200px wide must have natural width ≥ displayed width — fails if stretched, warns if soft on retina), mobile horizontal overflow (anything extending past 390px viewport), mobile tap target size (interactive elements < 44×44px), design-quality fonts (warns if no web font loaded), fact grounding (when `--manifest jobs/<domain>/manifest.json` is passed), AND **testimonial tampering** (when `--reference-dist jobs/<domain>/option-a/dist` is passed — extracts `<blockquote>`/`<q>` text from the live page and verifies each appears verbatim in the reference dist's HTML). Output groups issues by viewport: `[both]` (failures present at desktop AND mobile), `[desktop-only]`, `[mobile-only]`. Exits non-zero on any failure. Run this BEFORE the screenshot review — it catches the bugs that are invisible to a quick visual skim.

**Reference-dist flag — when to pass it**: `--reference-dist jobs/<domain>/option-a/dist` is REQUIRED when QA-checking Option B and Option C. It enables the testimonial-tampering check (B and C must preserve A's testimonials byte-identical per the TESTIMONIAL & REVIEW PRESERVATION rule). Do NOT pass it when QA-checking A itself (A is the reference).

**ALWAYS run qa-check.js first.** If it fails, fix the root cause before wasting time reviewing screenshots. A blurry logo, broken image, fabricated fact, invisible text, or literal `\uXXXX` visible on the page is a failure — no exceptions.

#### 4a. Start Dev Server (Background)

Read the allocated port and start the Astro dev server as a background process:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd jobs/{domain}/option-a/
npx astro dev --port $PORT_A &
echo $!
```

Save the PID so you can stop it later. Wait a few seconds for the server to start.

#### 4b. Run Headless QA

**FIRST** — run the automated gate. It exits non-zero on real defects (blurry logo, broken images, unicode escapes, console/network errors, **image-reuse < 90% for Option A**). If it fails, fix and re-run; do not proceed to screenshots until it passes:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_A --manifest jobs/$DOMAIN/manifest.json --option a / /about /contact
```

**Why `--option a`?** It activates the `image-reuse-A` rule (IMAGE REUSE RULE in this doc): at least 90% of must-reuse manifest photos must appear in Option A's build. If this fails, the design has drifted into magazine / typographic-only layout — restructure to add a portfolio / gallery section, photo-per-service-card, and about-the-crew block to absorb the photo budget. **Always pass `--option a` (or `b` or `c`) when running qa-check on a built option.** Omitting it is a silent back-compat fallback that disables option-specific gates.

**Why `--reference-dist-i18n` on B and C?** The MULTILINGUAL SUPPORT rule made B the canonical translation source for ALL languages. When checking C's `/<lang>/` testimonials, qa-check needs to compare against B's `/<lang>/` (not A's, since A is English-only). The `--reference-dist-i18n` flag points the testimonial-tampering rule at B's dist root, and qa-check walks every `/<lang-code>/` subdirectory there to build per-language reference sets. The legacy `--reference-dist-es` flag still parses as an alias. **The flag should be omitted entirely on English-only builds** (the default since 2026-04-30) — qa-check's per-language testimonial check then silently no-ops.

**Why `/es/` (and `/de/`, `/ru/`, `/it/`, etc.) paths in the page list?** The qa-check checks the URLs it's given. To run the full multilingual gate, every active language's page set must be passed. Missing `/<lang>/` paths in the invocation = multilingual rules don't fire on those pages. **On English-only builds (the default since 2026-04-30), the orchestrator passes ONLY English paths** — qa-check then no-ops the multilingual rules. Stage 4b for Option A always uses Option A's English-only path list (A is monolingual). Stage 6 (Option B) and Stage 7h (Option C) extend the path list to include every active language's paths IF any language is active in `option-b/src/pages/<lang>/`. After `--languages es,de` at initial build OR `--add-language German --to B` post-build, the next Stage 6 / Stage 8a invocation on B includes `/es/, /es/about, …, /de/, /de/about, …` in addition to the English paths.

**THEN** — run the screenshot QA script for visual inspection:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa.cjs http://localhost:$PORT_A jobs/{domain}/qa-option-a
```

This auto-discovers all pages from the nav and for each page:
- Takes desktop (1440×900) and mobile (375×812) screenshots
- Captures console errors and failed network requests (404s, etc.)
- Writes `report.json` with all findings

#### 4c. Review Screenshots

Read each screenshot PNG using the Read tool (it renders images visually):

```
Read: jobs/{domain}/qa-option-a/desktop-home.png
Read: jobs/{domain}/qa-option-a/mobile-home.png
Read: jobs/{domain}/qa-option-a/desktop-about.png
... (all pages)
```

For each screenshot, evaluate:
- **Hero**: Stunning? Background image showing? Text readable over overlay?
- **Typography**: Clear hierarchy (H1 > H2 > body)? Fonts loaded?
- **Images**: Displaying correctly? Right sizes? No broken placeholders?
- **Colors**: Palette harmonious? Enough contrast?
- **Spacing**: Generous whitespace? Spacious and modern feel?
- **Cards/grids**: Aligned properly? Consistent spacing?
- **Nav**: Clean and professional? All links present?
- **Footer**: Polished? All info present?
- **Mobile**: Layout stacks properly? Text readable? Menu visible?

Also read the QA report for automated findings:

```
Read: jobs/{domain}/qa-option-a/report.json
```

#### 4c-bis. Visual Sanity Pass (MANDATORY — catches what regex can't)

This is the second QA layer. After the deterministic gate passes and you've done the general review, run an EXPLICIT structured pass through every screenshot with the bug-class checklist below. The model is responsible for catching bugs that don't fit a programmatic pattern.

**The protocol**: for EACH page, EACH viewport (desktop + mobile), open the screenshot via Read tool and answer the checklist questions one by one. If any answer is "yes, that looks wrong," log it as a punch-list item and fix in 4e. Do not skip pages, do not skim — visual bugs cluster on the pages we don't look at carefully.

**The checklist** (every item is here because it shipped to a user as a bug — these are the bug classes we missed before):

1. **Mobile experience (review FIRST, on every page)** — open the mobile screenshot before the desktop one. Mobile is more than half of customer traffic and the most likely place for new bugs. For each mobile screenshot ask: does the hamburger work and reveal a real menu? Does any text or image overflow past the viewport edge? Does the hero photo crop cleanly or is it stretched/cut weirdly? Are tap targets generous enough to actually hit with a thumb? Is body text readable without zooming in? Is the phone CTA visible or one tap away? Does any card or section look broken because it didn't restack properly? **Mobile bugs are not "small" — they are half of the experience.**

2. **Active nav state** — on every interior page (about, services, contact), is the current nav item visually distinct AND legible? The previous bug shipped 2026-04-25 (morettiscentryautobody.com): active item rendered as black-on-black because `bg-iron text-bone` resolved to two near-identical dark colors. Look at the highlighted nav item with fresh eyes — can you actually read the text? **Check both desktop AND mobile** — active state may render differently between viewports.

3. **Active state shape** — is the active-state styling (underline, pill, panel, etc.) the right SHAPE for the design? A square black box around an item in an otherwise file-cabinet-tabbed nav is a styling bug even if the contrast is technically fine.

4. **Image quality and content match** — is each image clearly visible? Right orientation? Is the image relevant to the section it's in (driveway photo on driveway service, NOT a pool photo)? Are images repeated across cards within the same section? Is any hero or content image obviously stretched/pixelated? (qa-check programmatically flags both duplicates and resolution problems; this is your sanity check.)

5. **Card grid consistency** — within a single grid (services, testimonials, FAQs), do all cards have the same height? Same padding? Same icon style? Same heading weight? One CTA-styled card mixed with otherwise-neutral cards is OK; otherwise mixed sizes/styles in a grid is a bug. **Check mobile**: do the cards stack to a single column or break into something weird?

6. **Empty / placeholder content** — any card showing "Service title here" / "Lorem ipsum" / "Coming soon"? Any image rendered as a gray box? Any section that looks like the worker started building it and stopped halfway?

7. **Hero section** — does the headline read clearly over the background image? Is there visible overlay/scrim? Does the hero feel intentional and brand-aligned, or does it feel like the photo and text were composed by accident? **On mobile**: is the hero text still legible? Is the photo composition still working when cropped to portrait orientation?

8. **CTA visibility and intent** — every visible CTA button: is it obviously clickable? Does the copy say what it does? "Watch Video" buttons must wire to a real video (qa-check enforces, but verify visually). "Get a Quote" / "Call Now" should have call-out treatment. **On mobile**: are CTAs at least 44px tall? Is there a sticky bottom-bar CTA for trades sites?

9. **Typography hierarchy** — H1 obviously bigger than H2 obviously bigger than body? No section where the heading is barely distinguishable from body text? No section where two adjacent headings compete for attention? **On mobile**: does typography scale down sensibly or does H1 still take up the entire viewport?

10. **Whitespace and spacing rhythm** — sections should breathe. Do any sections feel cramped? Are there awkward whitespace gaps in the middle of a layout? Is footer sticking awkwardly to the last content section? **On mobile**: does spacing shrink proportionally or does the page feel either crushed (no breathing room) or sparse (huge empty gaps)?

11. **Color combinations that look wrong** — even if WCAG passes, do any color pairings look "off"? Yellow on cream, orange on red, two near-identical greens, etc. The text-contrast scan catches the worst, but borderline ugly combinations are visual judgment calls.

12. **Off-canvas or overflowing elements** — anything sticking out past the page edge, anything floating awkwardly because of an absolute-position bug, anything where a card extends past its container?

13. **Image-to-section mapping** — does the photo on the "Painting" service look like painting? On "Bricklaying" look like brickwork? (Beyond the duplicate check; this is about semantic match.)

14. **Footer completeness** — every social link from the manifest is present in the footer (qa-check enforces), but visually: do the icons line up? Is there a phone number? Address? Hours? Copyright?

15. **The "would I send this to a customer?" check** — final gut-check. If the customer opened this URL right now, would your instinct be "yes, here's the redesign" or would you wince first? If you wince, list what made you wince and add it to the punch list.

16. **The "$80k smell test" (DESIGN QUALITY BAR)** — the vision says A should look like a top-tier studio charged $80k. Look at the homepage screenshot honestly: could you imagine charging $80k for this? If no, what specifically is missing — typography that looks bespoke, hero treatment that earns the photo, a moment of design ambition, generous whitespace, an unexpected detail? List the gaps:
    - Are headlines using a display-quality font, not just system Inter?
    - Does the hero have any supporting design element beyond the photo + headline + button?
    - Is there at least one section per page that the customer would NOT have built themselves (custom card style, unique heading layout, stat strip, editorial pull-quote)?
    - Are there any micro-interactions (scroll reveal, hover motion, animated counters)?
    - Does the color palette feel intentional (3 primary + 2 accent, named roles) or random (six colors, no rationale)?

    If any answer is "no" or "barely," the build is below the bar. Add to the punch list. The deterministic gate's `design-quality-fonts` warning catches the font part programmatically; the rest is your judgment.

17. **Editorial-drift check (Option C ONLY)** — C's whole job is industry-anchored design (industrial / garage / food-led / clinical / architectural per the customer's industry). The plugin's default bias is editorial/magazine, so drift toward "generic Medium article" is the #1 C-specific failure mode. Look at C's homepage screenshot and ask: "If a stranger saw this without knowing the customer, would they guess the industry within 3 seconds?" If the answer is "looks like a Medium article" or "looks like any consultancy" or "looks like a generic editorial site" — C drifted. Specifically check:
    - Is the customer's scraped imagery used aggressively (hero, service tiles, team, work portfolio) OR did C ship a typographic-only design?
    - Do the colors signal the industry (workwear navy + hi-vis yellow for trades; warm earth tones for food; cool clinical-warm for medical) OR are they generic neutrals?
    - Does the typography pairing match the industry (industrial sans + mono for trades; editorial serif for food/legal; clean sans for medical/tech) OR is it the plugin's default Inter + serif headline?
    - Are industry-appropriate ornaments present (chevrons + bracket numbers for trades; texture overlays for food; thin rules for legal) OR is the page bare typography on white?

    If C drifted, the fix is in `industry-tokens.json` (Stage 7b-bis) — re-derive the tokens more aggressively, then rebuild.

18. **Diversity check (cross-build anti-monoculture, ALL options)** — this exists because of the 2026-04-25 template architecture pivot. The old `templates/astro-base/` had baked-in visual defaults (gradient-orb hero, blue+amber palette, Plus Jakarta Sans + Inter); every build that didn't fully override them inherited the same look. The pivot removed those defaults — `templates/scaffold/` provides only structure now, design is built fresh per customer. **This item is the visual defense against regression.**

    Open THIS build's homepage screenshot. Then load 2–3 recent peer builds in the same industry from disk:
    ```
    Read: jobs/{some-other-domain}/qa-option-a/desktop-home.png
    Read: jobs/{another-domain}/qa-option-a/desktop-home.png
    ```

    Honest check: does THIS site have a hero treatment, color combination, typography pairing, OR distinctive element that the others don't? If everything feels familiar — same hero composition, same palette, same fonts, same card styling — you regressed to template-y defaults despite the scaffold removing them.

    Specifically inspect:
    - Hero composition: is the photo treatment / overlay style / supporting design element (bracket number, mono caption, accent rule, etc.) different from the peer builds?
    - Color palette: are the actual hex values different, OR are you using the same "navy + amber" you used last time?
    - Typography: is the display font different from the peer builds (or at least different weight/treatment)?
    - One distinctive element per page: is THIS build's distinctive element different from what the peer builds used?

    If none of those are different → REBUILD with more design ambition. List the differences in your `build-design-decisions.md` (see below).

**Mandatory output of the visual sanity pass — `build-design-decisions.md`**: at the end of Stage 4 (and Stage 6 for B, Stage 7 for C), write `jobs/{domain}/option-{a|b|c}/build-design-decisions.md` documenting:
- Which inspiration directories you read (`saas-default`, `industrial-trades`, etc.)
- Specific design moves you drew from each (with citation — e.g., "took the three-layer hero pattern from saas-default but used a hatched-overlay treatment instead of gradient-orbs")
- What's intentionally unique to this build vs prior builds (the answers from item #18)
- Anything you deliberately did NOT copy from inspiration and why

This file is the audit trail for the inspiration-only architecture. If you ever see two builds looking identical, the design-decisions logs will reveal whether it was lazy copying or genuine brand similarity.

**Logging the pass**: write the punch list directly into your scratch notes for Stage 4e. Each item should reference (page, viewport, what's wrong, suspected fix). Do NOT mark Stage 4 complete until either the punch list is empty OR every item has been fixed and re-screenshotted, AND `build-design-decisions.md` is written.

**Self-improvement loop**: any bug class you find here that wasn't on the checklist above goes into FEEDBACK.md AND becomes either (a) a new item on this checklist OR (b) a new programmatic check in qa-check.js. The deterministic and visual layers are co-evolving — every shipped bug eventually graduates from "the model has to spot it" to "the gate catches it deterministically."

#### 4c-tris. Dramatic Improvement Audit (MANDATORY — A must be obviously better than the original)

**The vision says A is "same site, suddenly expensive" — a dramatic transformation, not a polish.** If A ships as "same layout, slightly nicer fonts, a touch more padding" — that's a polish, not an $80k rebuild. The customer's reaction should be "wait, is that the same site?" not "oh, that's nice."

Before completing Stage 4, run this audit explicitly:

1. **Open the original homepage screenshot** captured during Stage 1:
   ```
   Read: jobs/{domain}/assets/screenshots/home.png
   ```
   (If the path is different, find it — the scraper writes one full-page screenshot per page during Stage 1.)

2. **Open A's homepage screenshots** (both viewports):
   ```
   Read: jobs/{domain}/qa-option-a/desktop-home.png
   Read: jobs/{domain}/qa-option-a/mobile-home.png
   ```

3. **Articulate, in writing, three SPECIFIC dramatic improvements**. Not abstract ("looks more modern") — concrete and visual. Examples of what counts:
   - "Original hero was a flat green box with the company name; A's hero is a full-bleed photo of a finished landscape installation with a Fraunces display headline overlay and a labeled '01 // RESIDENTIAL' section number — earns the photo, signals a designed brand."
   - "Original navigation was a centered horizontal list of 9 links in Comic Sans-ish font; A's nav is a sticky 4-item nav with a yellow CTA pill, mono section indices, and a clean Inter typography pairing."
   - "Original services were 12 stacked text paragraphs; A's services are a 3-column grid of cards with icons, hover scale, and consistent treatment — 60-second skim now possible."

4. **If you cannot articulate three specific dramatic improvements** — if the answers are vague ("better fonts," "more spacing") OR if the differences are merely cosmetic (typography swap with no design ambition) — **A failed the dramatic-improvement bar**. Add to the punch list and rebuild with more ambition. Specifically:
   - Heroes: redesign the hero treatment with new layered elements (overlay + section number + mono caption + accent rule), not just "photo + headline."
   - Sections: introduce at least one section per page with a layout pattern the original doesn't have (stat strip, process steps, editorial quote, comparison table).
   - Typography: confirm a display-quality font is loaded and used at scale (not just system Inter).
   - Spacing: audit section padding — 96px+ desktop, 48px+ mobile, no exceptions.
   - Color: confirm 3 primary + 2 accent palette with named roles (per DESIGN QUALITY BAR).

5. **Log the three improvements to a new file**:
   ```
   Write: jobs/{domain}/dramatic-improvement-audit.md
   Content: brief markdown documenting the original-vs-A comparison, the 3 specific improvements, screenshot references.
   ```
   This file is for the skill-owner to review later — it's how we learn whether the bar is holding across builds.

**Why this exists**: too many shipped builds were "merely better than original." The customer's $80k expectation was set by the vision tagline; the build needs to deliver on it. This audit forces the worker session to honestly compare and either certify the dramatic improvement OR rebuild with more ambition. No "fine, ship it" without articulating WHY.

#### 4d. ~~Plugin critique~~ — REMOVED 2026-04-26 (Option A is intentionally plugin-free)

> **Architectural decision 2026-04-26**: Option A does NOT use the `frontend-design` plugin. The whole point of the A vs C customer comparison is **worker-designed (A) vs plugin-designed (C)** with content held constant via B as the bridge. If both A and C invoked the plugin, the comparison would muddle. A's design quality is the worker's responsibility — driven by the design brief, REQUIRED-PATTERNS.md, the chosen inspiration directory, the DESIGN QUALITY BAR rule, the 18-item Visual Sanity Pass (Stage 4c-bis), and the Dramatic Improvement Audit (Stage 4c-tris). No external plugin invocation needed.
>
> **Plugin-free A is non-negotiable.** If a future skill-owner is tempted to re-add the plugin to A "for one more design opinion," the cost is the comparison's value. Don't.
>
> The QA work that this stage used to perform — design critique — is now distributed across:
> - **Stage 4c-bis Visual Sanity Pass** (18 items including Item #16 "$80k smell test" and Item #18 diversity check)
> - **Stage 4c-tris Dramatic Improvement Audit** (original vs A side-by-side, must articulate 3 specific dramatic improvements)
> - **Programmatic qa-check.js** (27 deterministic rules including text-contrast, design-quality-fonts, mobile-overflow, mobile-tap-target, hero contrast, image resolution)
>
> Combined, those three layers replace what the plugin invocation here was nominally trying to add. **The plugin's expertise IS still applied to WebFactory output — exclusively in Option C** (Stages 7d build + 7g critique). Keeping it confined there is what makes the A vs C comparison meaningful.

(History: this stage previously invoked imaginary skills `design:design-critique`/`design:accessibility-review` that don't exist in any installed plugin — fixed 2026-04-26 to invoke the real `frontend-design` skill — then removed entirely later that day per architectural decision above.)

#### 4e. Fix Issues

Create a punch list from the screenshots and report:

- **Visual issues**: ugly sections, poor contrast, cramped spacing, misaligned elements
- **Broken resources**: 404 images, missing fonts (from report.json networkErrors)
- **Responsive issues**: broken mobile layouts, overflow, tiny text
- **Missing content**: text from original site not included, missing images
- **Console errors**: JS errors (from report.json consoleErrors)

Fix ALL issues by editing the Astro/CSS files. Then rebuild and re-run QA:

```bash
cd jobs/{domain}/option-a/
npm run build
```

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa.cjs http://localhost:$PORT_A jobs/{domain}/qa-option-a
```

**Repeat this loop up to 3 times** until no issues remain.

#### 4f. Beauty Pass

After fixing bugs, do one final review of the screenshots with fresh eyes:

- Does every section feel intentional and polished?
- Could any section benefit from a background color change, more padding, or a subtle border?
- Are the CTAs prominent and visually appealing?
- Does the overall color story feel cohesive?
- Would any section benefit from an icon, gradient, or subtle pattern?

Make refinements, rebuild, and take a final set of screenshots.

#### 4g. Stop Dev Server

```bash
kill {dev_server_pid}
```
