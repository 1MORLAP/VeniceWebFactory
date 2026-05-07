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

**Phase L.1 (2026-05-07): compress screenshots before the visual pass reads them.** PNGs are 100-300KB each; the Visual Sanity Pass reads 18+ files per stage at full resolution = ~50-100K vision tokens per pass. Pre-compressing to JPEG-Q75 at 1280px wide cuts ~96% of the bytes (real measurement: 30.7MB → 1.24MB on bigdaddysdumpers qa-option-b/) with no perceptible quality loss for design review.

```bash
node scripts/compress-screenshots.cjs jobs/{domain}/qa-option-a
node scripts/compress-screenshots.cjs jobs/{domain}/assets/screenshots
```

The first call compresses A's just-captured screenshots for the upcoming 4c-bis Visual Sanity Pass. The second compresses the original-site screenshots (captured at Stage 1) — these feed the 4c-tris **World-Class Audit** as a SECONDARY context (so the audit can articulate what changed); the original site is NOT the audit's bar.

Both produce `*.jpg` sidecars next to each `*.png`. Sub-agents in 4c-bis (visual-sanity-pass.md) and 4c-tris prefer `*.jpg` over `*.png` — see those prompt templates. PNGs are preserved on disk for human inspection / debugging.

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

#### 4c-bis. Visual Sanity Pass on Option A (delegated to Opus sub-agent — Tier 2 of context-optimization, 2026-05-04)

This is the second QA layer — the visual judgment pass that catches bugs deterministic regex can't. Per Tier 2 of the context-optimization plan, the Visual Sanity Pass is delegated to an Opus sub-agent so the orchestrator never reads the 12–24 screenshots itself. Operational result: 6-page builds drop main-session context from ~600–800K tokens to ~200–300K, comfortably single-session-completable. Model stays Opus — the work moved off main, the model didn't change.

**The 18-item checklist + JSON output schema live in `/Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md`** (single source of truth, shared with Stage 6c and Stage 7g). Read that file once if you want to see what the sub-agent will check; the orchestrator does NOT re-state the checklist here.

Spawn ONE Opus sub-agent via the `Agent` tool — same dispatch shape as the Stage 3 Sonnet dispatch, but with `model: "opus"` instead of `"sonnet"`:

- `subagent_type: 'general-purpose'`
- `model: 'opus'`
- Prompt template (substitute `{DOMAIN}` and the peer-build screenshot path):

```
## Charter

You are running the **Stage 4c-bis Visual Sanity Pass** on Option A for {DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md FIRST for the full 18-item checklist + JSON output schema + brevity contract.

## What to read

- jobs/{DOMAIN}/qa-option-a/desktop-*.png — desktop screenshots for every page
- jobs/{DOMAIN}/qa-option-a/mobile-*.png — mobile screenshots for every page
- ONE peer-build homepage screenshot for the diversity check (item #18). Path: {PEER_BUILD_PNG} — pick a recent build in the same industry where possible.

## What to return

A JSON object matching the schema in visual-sanity-pass.md (stage="4c-bis", option="a"). Keep your reasoning concise — the orchestrator only sees your final JSON, not your scratch work. ~400 tokens of output is the target.

## What you do NOT do

- DO NOT touch source code. The orchestrator handles fix-loops based on your JSON.
- DO NOT run the World-Class Audit (Stage 4c-tris) — that's a separate sub-agent dispatched by the orchestrator after this one returns.
- DO NOT read the manifest, design-brief, industry-tokens, or .astro source files. Only screenshots + the checklist.
- DO NOT write build-design-decisions.md. The orchestrator writes that file based on your JSON's summary + diversity-check observations.
```

**Pre-dispatch — resolve model per cost-tier** (Phase D, 2026-05-05):

```bash
VP_MODEL=$(node scripts/get-model.cjs $DOMAIN visualPass --field model)
VP_AGENT=$(node scripts/get-model.cjs $DOMAIN visualPass --agent-model)
VP_EFFORT=$(node scripts/get-model.cjs $DOMAIN visualPass --field effort)
node scripts/log-decision.cjs "$DOMAIN" 4c-bis visual-pass-dispatched --detail option=a --detail model=$VP_MODEL --detail effort=$VP_EFFORT
```

Default per `cost-tier=baseline`: `opus` (medium effort). `balanced` and `aggressive` drop visualPass to `sonnet` — the gates downstream catch quality regressions. Agent tool dispatch uses `model: '$VP_AGENT'`.

Receive the sub-agent's JSON (it's ~400 tokens). The sub-agent MUST write its full JSON to `jobs/{domain}/qa-option-a/visual-pass-verdict.json` AND return a 1-line acknowledgment to the orchestrator. The on-disk verdict file is what the hard gate (next step) reads.

Then run the hard gate AND log the verdict:

```bash
node scripts/validate-visual-pass.cjs $DOMAIN a
VERDICT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/qa-option-a/visual-pass-verdict.json","utf8")).verdict)')
ITEMS_PASSED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/qa-option-a/visual-pass-verdict.json","utf8")).items_passed)')
node scripts/log-decision.cjs "$DOMAIN" 4c-bis visual-pass-verdict --detail option=a --detail verdict="$VERDICT" --detail items_passed="$ITEMS_PASSED" --detail model=$VP_MODEL --detail effort=$VP_EFFORT
```

This script (added 2026-05-04) is the Stage 4c-bis hard gate — it verifies the verdict JSON exists, has a valid schema (verdict ∈ {pass,fix,rebuild}, items_checked ≥ 16, items_passed integer, issues array, summary string), and exits non-zero if the verdict is `rebuild`. Same pattern as `validate-specs.cjs` for Stage 2.5b: ship the architecture WITH the gate so orchestrators can't silently fall back to the lighter inline path. Real bug 2026-05-04 (watkinsmonuments.com) — orchestrator read 2 desktop screenshots inline rather than dispatching the sub-agent. The gate was added in response.

If the gate fails because the orchestrator deliberately ran inline (debug, special case), pass `--allow-inline` to the gate. This logs a warning but proceeds. Use sparingly — the default expectation is sub-agent dispatch.

Then branch on `verdict`:
- `pass` → continue to Stage 4c-tris (World-Class Audit, separate Opus sub-agent dispatched below).
- `fix` → run the Stage 4e fix-loop, scoped to the issues listed in the JSON. Pass the JSON's `issues` array forward as the punch list — no need to re-read screenshots.
- `rebuild` → escalate (re-spec Option A; rare — design-language-level failures the fix-loop can't reach). The gate will exit 2 on `rebuild`, blocking the deploy until you address.

**Mandatory orchestrator output — `build-design-decisions.md`**: regardless of verdict, after Stage 4c-bis returns AND any fix-loop iterations complete, the orchestrator writes `jobs/{domain}/option-a/build-design-decisions.md` (and analogously for B at Stage 6c, C at Stage 7g) documenting:
- Which inspiration directories were used (`saas-default`, `industrial-trades`, etc.)
- Specific design moves drawn from each (with citation — e.g., "took the three-layer hero pattern from saas-default but used a hatched-overlay treatment instead of gradient-orbs")
- What's intentionally unique to this build vs prior builds (lift this from the sub-agent's JSON `summary` + any item-#18 observations in `issues`)
- Anything deliberately NOT copied from inspiration and why

This file is the audit trail for the inspiration-only architecture. If two builds ever look identical, the design-decisions logs reveal whether it was lazy copying or genuine brand similarity.

**Self-improvement loop**: any bug class the sub-agent surfaces that isn't already on the checklist in `visual-sanity-pass.md` goes into FEEDBACK.md AND becomes either (a) a new item on the checklist OR (b) a new programmatic check in qa-check.js. The deterministic and visual layers are co-evolving — every shipped bug eventually graduates from "the model has to spot it" to "the gate catches it deterministically."

#### 4c-tris. World-Class Audit (delegated to a sub-agent — Phase D of context-optimization, 2026-05-05; reshaped 2026-05-07)

**The vision says A is "same site, suddenly expensive" — but "expensive" doesn't mean "better than the original."** The customer's old site is typically a 2009-era CMS template (Hibu, GoDaddy, Squarespace default, Wix template). Beating that floor is trivial; it's not the bar.

**The bar is world-class.** Could A be a reference design someone else's project would draw from? Would a designer point to it as an example of considered work in this industry? Is the design *differentiated* and *memorable*, or is it generic-but-cleaner-than-the-2009-original?

This audit tests A against THREE world-class references — NOT against the customer's old site:

1. **The Refero Design taxonomy** at `~/.claude/skills/refero-design/SKILL.md` (4036 lines across SKILL.md + 9 reference files: `references/{anti-ai-slop, craft-details, typography, color, motion, copywriting, icons, mcp-tools, example-workflow}.md`). Refero subscription's research-first design methodology — the canonical world-class rubric. The **anti-ai-slop.md** reference alone catches: indigo/violet defaults, cards-as-default-container, dark-mode-by-default, emoji-as-icons, decorative-left-accent-stripe, generic 3-column pricing, hero-with-left-text-right-image, perfect symmetry. The **craft-details.md** reference covers focus states, form inputs, hit targets, semantic markup. The **typography.md / color.md / motion.md** references are full taxonomies for each axis. This is **the design.md the user pays for**.
2. **The inspiration library** at `templates/inspiration/` — WebFactory's curated, hand-built reference designs that A must look at home alongside.
3. **Refero industry top** (when industry-relevant) — `mcp__refero__refero_search_screens` semantic search of real shipped products in similar industries. Aggressively filter; skip on dataset bias for small-business contractors.

(Google Labs released a separate **DESIGN.md format spec** at https://github.com/google-labs-code/design.md — a YAML+markdown standard for projects to describe their design system to AI agents. WebFactory does not emit a DESIGN.md per build today; this audit doesn't consume one. If a future Phase ships per-build DESIGN.md emission, the audit can read it as a fourth axis. Mentioned for orientation only — not currently required.)

The original-vs-A comparison is preserved as a SECONDARY context (so the audit can articulate what changed and the dramatic-transformation story still holds), but the audit's verdict is "is this world-class?" — not "is this better than the floor?"

**Pre-2026-05-07 framing**: this audit was the "Dramatic Improvement Audit," verdict-on-original-vs-A. That framing measured the right axis (transformation) but used the wrong bar (floor). Reshaped to use world-class references as the bar; the floor is preserved as context only. The user's framing: *"the original is so terrible that I don't really see a point — is a dramatic improvement over original. I think this should say, is it a world-winning design? ... is this differentiated? World class amazing and how to get there — not is it better than the original."*

Read the per-stage model assignment first:

```bash
MODEL=$(node scripts/get-model.cjs $DOMAIN fourCtris --field model)
THINK=$(node scripts/get-model.cjs $DOMAIN fourCtris --field thinkingBudget)
```

Default for `fourCtris` is `opus` with `thinkingBudget=5000` across every cost-tier preset (baseline / balanced / aggressive). This stage is the one place where Opus + thinking is non-negotiable — it's the canonical taste call.

Spawn ONE sub-agent via the `Agent` tool — same dispatch shape as Tier 2 visual-pass:

- `subagent_type: 'general-purpose'`
- `model: '$MODEL'`  (resolves to opus per default)
- Prompt template (substitute `{DOMAIN}` and `{INDUSTRY_DIRECTION}` from `industry-tokens.json` if present, else from `design-brief.json → industry`):

```
## Charter

You are running the **Stage 4c-tris World-Class Audit** on Option A for {DOMAIN}. The vision tagline is "same site, suddenly expensive." Your job is to certify A as world-class — on par with the Refero Design taxonomy ("design.md") at `~/.claude/skills/refero-design/`, the curated inspiration library at `templates/inspiration/`, and (where industry-relevant) with Refero MCP's catalog of shipped products in similar industries.

The customer's old site is a FLOOR, not a bar. Don't measure A against it. Measure A against the world-class references below.

## Reference axes (in priority order)

### Axis 1 — Refero Design taxonomy ("design.md")

Read the world-class-design rubric the Refero subscription provides:
- /Users/tomasz/.claude/skills/refero-design/SKILL.md (research-first methodology + craft litmus tests)
- /Users/tomasz/.claude/skills/refero-design/references/anti-ai-slop.md (THE primary AI-slop checklist — indigo/violet defaults, cards-as-default, dark-mode-by-default, emoji-as-icons, decorative left-accent stripe, generic 3-column pricing, perfect symmetry, hero-with-left-text-right-image, the Card / Image / Brand / Copy / Identity litmus tests)
- /Users/tomasz/.claude/skills/refero-design/references/craft-details.md (focus states, form attributes, hit targets, semantic markup, accessibility details)
- /Users/tomasz/.claude/skills/refero-design/references/typography.md (font pairing, hierarchy, letter-spacing on caps, weight pairs)
- /Users/tomasz/.claude/skills/refero-design/references/color.md (dominant + accent, not evenly distributed, semantic meaning)
- /Users/tomasz/.claude/skills/refero-design/references/motion.md (high-impact moments, not scattered micro-interactions)

(The frontend-design plugin's SKILL.md at `~/.claude/plugins/cache/claude-plugins-official/frontend-design/1.0.0/skills/frontend-design/SKILL.md` is a thinner secondary reference — read it only as a sanity-check supplement, not as the primary axis.)

Internalize from Refero's anti-ai-slop checklist (the most concrete rubric):
- **Indigo/Violet ban**: NEVER `#6366f1`, `#8b5cf6`, `#7c3aed` unless the brand explicitly requires it. AI's universal fingerprint.
- **Cards justified by interaction only**: removing border/shadow/background/radius shouldn't break the design. If it does — it's not a card, remove the card chrome.
- **Light mode is the baseline**: dark-by-default is an AI fingerprint.
- **No emoji as icons**: 😀🚀💡🎯 = "AI-generated." Use icon library (Lucide/Phosphor/Heroicons), Unicode (→ • ◆), or SVG.
- **No decorative left-accent stripe**: only when it carries meaning (status, priority, owner, selection).
- **Typography intentional**: distinctive display + refined body. Letter-spacing on ALL CAPS. NEVER Inter/Roboto/Arial as the only fonts.
- **Color hierarchy**: dominant + sharp accent. NOT timid evenly-distributed pastels. NOT purple-gradient-on-white.
- **Layout has tension**: asymmetry, overlap, grid-breaking, OR generous negative space (intentional, not accidental).
- **One memorable detail**: per Refero's identity test, *"if the first viewport could belong to any other company → branding is too weak."*

Run the **Refero litmus tests** (from anti-ai-slop.md) on A's homepage:
- **Card test**: removing border/shadow/background/radius from "card" elements — does the design still work? If yes, the cards aren't doing work — chrome is decoration.
- **Image test**: does the first viewport work without the hero image? If yes, the image is too weak. Make it dominant or remove it.
- **Brand test**: hide the nav. Does the brand still come through (logo prominence, brand color, distinctive type)? If not — hierarchy is too weak.
- **Identity test**: could the first viewport belong to any other company? If yes — branding is generic.

If A fails any litmus test, OR triggers any anti-ai-slop pattern (indigo/violet, cards-by-default, dark-by-default, emoji-icons, decorative left stripe, generic 3-column, hero-with-left-text-right-image) — it FAILS Axis 1.

### Axis 2 — Inspiration library (the curated reference floor)

Read the relevant inspiration directory's README + sample homepage based on the customer's industry:
- /Users/tomasz/WebFactory/templates/inspiration/README.md (the index)
- For trades / contractor (Option A): /Users/tomasz/WebFactory/templates/inspiration/industrial-trades-photo-led/README.md + /Users/tomasz/WebFactory/templates/inspiration/industrial-trades-photo-led/src/pages/index.astro
- For SaaS / professional services / tech: /Users/tomasz/WebFactory/templates/inspiration/saas-default/README.md + sample page
- For other industries (food, clinical, architectural, garage): see the README — directory may not exist yet; in that case audit on the closest available reference + Axis 1.

These are hand-built reference designs at the bar A must clear. Question:

  *"Would A look at home in this library? If it sat alongside the existing inspiration designs as `{industry}-photo-led-v2`, would the next worker pick it up as a reference?"*

If yes — A is world-class. If no — articulate which world-class moves the inspiration directory has that A is missing.

### Axis 3 — Refero industry top (optional, dataset-bias permitting)

If `mcp__refero__refero_search_screens` is available, query for industry-relevant references:
- platform: "web"
- query: "{INDUSTRY_DIRECTION} services homepage" OR "premium {INDUSTRY_DIRECTION} brand site"
- Pull 5-10 results. Pick the 2-3 most industry-relevant.
- Get screen content via `mcp__refero__refero_get_screen_content` for the chosen 1-2.

**Filter aggressively.** Refero's dataset skews B2B SaaS / fintech / productivity. If all top results are Stripe/Linear/Notion clones for a small-business-contractor customer, ABORT this axis. Audit on Axes 1 + 2 only and note `axis_verdicts.refero_industry_top: "skipped-dataset-bias"`. See REFERO REFERENCES rule in SKILL.md.

When industry-relevant results ARE available, the question is: **is A in the same league as those shipped products?** Not "does A look like Stripe" — does A look like considered work in the customer's industry.

## What else to read

**Phase L.1 (2026-05-07): prefer the `*.jpg` sidecars over `*.png`** — the orchestrator runs `compress-screenshots.cjs` before this audit. Read JPG; PNG is the larger fallback.

- jobs/{DOMAIN}/qa-option-a/desktop-home.{jpg,png} — A's rebuilt homepage (desktop)
- jobs/{DOMAIN}/qa-option-a/mobile-home.{jpg,png} — A's rebuilt homepage (mobile)
- jobs/{DOMAIN}/qa-option-a/desktop-{other}.{jpg,png} — at least 1-2 secondary pages so the audit isn't homepage-only
- jobs/{DOMAIN}/assets/screenshots/home.{jpg,png} — the ORIGINAL site's homepage (CONTEXT only — for articulating what changed; NOT the bar)
- /Users/tomasz/WebFactory/SKILL.md "DESIGN QUALITY BAR" section — the 8 internal bar items (typography, whitespace, hero treatment, palette, distinctive element, micro-interaction, $80k smell test, ornament budget)

## What to do

For each axis, write one paragraph in your markdown report evaluating A against that axis:

1. **Axis 1 (Refero design taxonomy)**: does A clear the anti-ai-slop checklist + the four litmus tests (Card, Image, Brand, Identity)? Cite specific evidence — typography family + foundry, palette role-naming + accent hierarchy, hero composition, spatial tension, motion intent. Anti-slop tells alone trigger Axis 1 fail: indigo/violet defaults, cards-as-default-container, dark-mode-by-default, emoji-as-icons, decorative left-accent stripe, generic 3-column, hero-with-left-text-right-image-by-default, perfect symmetry. If A relies on system Inter/Arial, fails Axis 1. If palette is timid evenly-distributed, fails Axis 1.

2. **Axis 2 (inspiration library)**: would A look at home alongside the existing inspiration designs? Could it become a reference itself? If yes — what's the new vocabulary it adds (display-italic-emphasis? annotated-photo grid? section eyebrow with hairline rule?). If no — what's missing relative to the curated reference?

3. **Axis 3 (Refero industry top)**: in the same league? Skipped-dataset-bias? Unavailable?

Then articulate THE THREE WORLD-CLASS QUALITIES A demonstrates — concrete and citable, NOT abstract:
- ✅ "Typography: Fraunces 92pt display + Inter 17pt body + JetBrains Mono section eyebrows. Considered weight pairs, optical sizing visible at 92pt." (citable: visible in desktop-home.jpg)
- ❌ "Looks much nicer than the old site." (not citable, not world-class — a floor comparison)
- ✅ "Hero: full-bleed work photo + italic-rust display headline + lower-left mono caption '01 / RESIDENTIAL · 30+ YEARS'. Three-layer composition with textural depth." (citable: visible in desktop-home.jpg)
- ❌ "Hero is now full-bleed instead of a flat green box." (citable but a floor comparison — beats the original; doesn't prove world-class)
- ✅ "Distinctive element: 'A craftsman's portfolio — photographed honestly' gallery grid. Repeated mono captions create rhythm not present in any other inspiration directory; this is the build's signature move." (citable, differentiated)

Then articulate **THE ONE THING**.

Per the frontend-design taxonomy: *"Differentiation: What's the one thing someone will remember?"* Name it. One sentence. If you can't name a memorable one-thing, A is generic — that fails the audit regardless of axis-1/2/3 scores.

## Decision

- **`pass`** if A clears Axes 1 + 2 (Axis 3 may be unavailable or skipped-dataset-bias) AND has a memorable one-thing.
- **`rebuild`** if A fails Axis 1 (system fonts, timid palette, generic composition), OR Axis 2 (would not earn an inspiration-library spot), OR has no memorable one-thing.

If the only thing you can say about A is "much better than the original," that's a `rebuild` trigger — the audit found a floor improvement, not a world-class result.

## Output

Write your full report to:
- jobs/{DOMAIN}/world-class-audit.md (markdown — three-axis evaluation + three world-class qualities + the-one-thing + rebuild guidance if applicable)

Then return a JSON object to the orchestrator:

{
  "verdict": "pass | rebuild",
  "world_class_qualities": [
    "specific quality #1 with citation",
    "specific quality #2 with citation",
    "specific quality #3 with citation"
  ],
  "the_one_thing": "single sentence naming the memorable signature move",
  "axis_verdicts": {
    "refero_design_taxonomy": "pass | fail — short reason citing anti-ai-slop / litmus test outcomes",
    "inspiration_library": "pass | fail — short reason",
    "refero_industry_top": "pass | fail | skipped-dataset-bias | unavailable — short reason"
  },
  "rebuild_axes": ["typography" | "palette" | "hero" | "spatial" | "distinctive_element" | "motion" | "differentiation" | ...],   // only if verdict=rebuild
  "summary": "1-line takeaway"
}

~400 tokens of output is the target. Keep prose concise — the world-class-audit.md file holds the longform.

## What you do NOT do

- DO NOT touch source code. Verdict-only role.
- DO NOT re-run the Stage 4c-bis 18-item Visual Sanity Pass — that's a separate sub-agent, already complete.
- DO NOT spawn further sub-agents.
- DO NOT measure A against the customer's original site as the primary axis. The original is a FLOOR, not a bar. Use it for context only ("here's what changed"), never for the verdict.
```

**Hard gate** (added 2026-05-05 alongside Phase D, event renamed 2026-05-07):

```bash
node scripts/log-decision.cjs $DOMAIN 4c-tris world-class-audit-verdict --detail verdict=$VERDICT --detail model=$MODEL --detail thinkingBudget=$THINK
test -f jobs/$DOMAIN/world-class-audit.md   # gate: file MUST exist post-dispatch
```

If the verdict is `rebuild`, escalate — don't proceed to Stage 5. The orchestrator must address the named `rebuild_axes` and re-spawn the build before B/C derive from A.

**Why this exists**: too many shipped builds were "merely better than the original." The customer's old site is a 2009-era template floor — beating it doesn't prove world-class craft. The vision tagline ("same site, suddenly expensive") set an $80k expectation; the build needs to deliver on it. This audit forces explicit articulation of *world-class* qualities (cited from the screenshots, evaluated against design.md + the inspiration library + Refero) AND a memorable one-thing. If the audit can't find them, that's a `rebuild` — not a silent "fine, ship it."

**Back-compat note (2026-05-07)**: pre-reshape, this audit wrote `dramatic-improvement-audit.md` and emitted `dramatic-improvement-audit-verdict`. Both are renamed to the World-Class versions. Old logs from prior builds remain searchable under the original event name; new builds log the new name. `audit-cost.cjs` recognizes both during the transition.

#### 4d. ~~Plugin critique~~ — REMOVED 2026-04-26 (Option A is intentionally plugin-free)

> **Architectural decision 2026-04-26**: Option A does NOT use the `frontend-design` plugin. The whole point of the A vs C customer comparison is **worker-designed (A) vs plugin-designed (C)** with content held constant via B as the bridge. If both A and C invoked the plugin, the comparison would muddle. A's design quality is the worker's responsibility — driven by the design brief, REQUIRED-PATTERNS.md, the chosen inspiration directory, the DESIGN QUALITY BAR rule, the 18-item Visual Sanity Pass (Stage 4c-bis), and the World-Class Audit (Stage 4c-tris). No external plugin invocation needed.
>
> **Plugin-free A is non-negotiable.** If a future skill-owner is tempted to re-add the plugin to A "for one more design opinion," the cost is the comparison's value. Don't.
>
> The QA work that this stage used to perform — design critique — is now distributed across:
> - **Stage 4c-bis Visual Sanity Pass** (18 items including Item #16 "$80k smell test" and Item #18 diversity check)
> - **Stage 4c-tris World-Class Audit** (three axes — design.md taxonomy + inspiration library + Refero industry top — must articulate 3 world-class qualities + one memorable signature move)
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

**Per-iteration instrumentation** (per ORCHESTRATION LOGGING CONTRACT) — log each fix-loop iteration with the issue count remaining so the audit can track convergence vs runaway iteration:

```bash
# Inside the iteration body, after running qa-check.js:
ITER=1   # increment each pass through the loop
ISSUES_REMAINING=$(node -e 'try { console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/qa-option-a/qa-check-report.json","utf8")).failures.length || 0) } catch { console.log("?") }')
node scripts/log-decision.cjs "$DOMAIN" 4e fix-loop-iter --detail option=a --detail iter="$ITER" --detail issuesRemaining="$ISSUES_REMAINING"
```

If `issuesRemaining` doesn't trend toward 0 across iterations, abort and re-spec the page (the fix-loop is not converging — root-cause is in the spec, not the build).

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
