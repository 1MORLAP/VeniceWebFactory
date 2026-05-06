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
- DO NOT run the Dramatic Improvement Audit (Stage 4c-tris) — that stays inline in the orchestrator.
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
- `pass` → continue to Stage 4c-tris (Dramatic Improvement Audit, still orchestrator-inline below).
- `fix` → run the Stage 4e fix-loop, scoped to the issues listed in the JSON. Pass the JSON's `issues` array forward as the punch list — no need to re-read screenshots.
- `rebuild` → escalate (re-spec Option A; rare — design-language-level failures the fix-loop can't reach). The gate will exit 2 on `rebuild`, blocking the deploy until you address.

**Mandatory orchestrator output — `build-design-decisions.md`**: regardless of verdict, after Stage 4c-bis returns AND any fix-loop iterations complete, the orchestrator writes `jobs/{domain}/option-a/build-design-decisions.md` (and analogously for B at Stage 6c, C at Stage 7g) documenting:
- Which inspiration directories were used (`saas-default`, `industrial-trades`, etc.)
- Specific design moves drawn from each (with citation — e.g., "took the three-layer hero pattern from saas-default but used a hatched-overlay treatment instead of gradient-orbs")
- What's intentionally unique to this build vs prior builds (lift this from the sub-agent's JSON `summary` + any item-#18 observations in `issues`)
- Anything deliberately NOT copied from inspiration and why

This file is the audit trail for the inspiration-only architecture. If two builds ever look identical, the design-decisions logs reveal whether it was lazy copying or genuine brand similarity.

**Self-improvement loop**: any bug class the sub-agent surfaces that isn't already on the checklist in `visual-sanity-pass.md` goes into FEEDBACK.md AND becomes either (a) a new item on the checklist OR (b) a new programmatic check in qa-check.js. The deterministic and visual layers are co-evolving — every shipped bug eventually graduates from "the model has to spot it" to "the gate catches it deterministically."

#### 4c-tris. Dramatic Improvement Audit (delegated to a sub-agent — Phase D of context-optimization, 2026-05-05)

**The vision says A is "same site, suddenly expensive" — a dramatic transformation, not a polish.** If A ships as "same layout, slightly nicer fonts, a touch more padding" — that's a polish, not an $80k rebuild. The customer's reaction should be "wait, is that the same site?" not "oh, that's nice."

**Pre-2026-05-05** this audit ran inline in the orchestrator (the carve-out from Tier 2). With Phase D enabling tiered model selection — including Sonnet orchestrator builds — this is now the LAST subjective taste call that needs a sub-agent so quality stays Opus regardless of orchestrator tier.

Read the per-stage model assignment first:

```bash
MODEL=$(node scripts/get-model.cjs $DOMAIN fourCtris --field model)
THINK=$(node scripts/get-model.cjs $DOMAIN fourCtris --field thinkingBudget)
```

Default for `fourCtris` is `opus` with `thinkingBudget=5000` across every cost-tier preset (baseline / balanced / aggressive). This stage is the one place where Opus + thinking is non-negotiable — it's the canonical taste call.

Spawn ONE sub-agent via the `Agent` tool — same dispatch shape as Tier 2 visual-pass:

- `subagent_type: 'general-purpose'`
- `model: '$MODEL'`  (resolves to opus per default)
- Prompt template (substitute `{DOMAIN}`):

```
## Charter

You are running the **Stage 4c-tris Dramatic Improvement Audit** on Option A for {DOMAIN}. The vision is "same site, suddenly expensive" — a dramatic transformation, not a polish. Your job is to certify or reject A's dramatic-improvement bar.

## What to read

- jobs/{DOMAIN}/assets/screenshots/home.png — the ORIGINAL site's homepage
- jobs/{DOMAIN}/qa-option-a/desktop-home.png — A's rebuilt homepage (desktop)
- jobs/{DOMAIN}/qa-option-a/mobile-home.png — A's rebuilt homepage (mobile)
- /Users/tomasz/WebFactory/SKILL.md "DESIGN QUALITY BAR" section — the bar A must clear
- (OPTIONAL — Phase E benchmark axis) Refero references: query
  `mcp__refero__refero_search_screens` with platform="web" and a query like
  "{industry} services homepage" or "{industry} contractor brand site" to
  pull 3-5 industry-leading benchmark examples. Get screen content via
  `mcp__refero__refero_get_screen_content` for the most relevant 1-2.
  These are the "industry top 5" benchmark — A doesn't need to BEAT them,
  but it should be in the same league. **Filter Refero results aggressively**
  — its dataset skews B2B SaaS / fintech / productivity, which is the wrong
  aesthetic for most WebFactory customers (small-business contractors). If
  all top results are Stripe/Linear/Notion clones, skip the benchmark axis
  and audit on original-vs-A only. See REFERO REFERENCES rule in SKILL.md.

## What to do

Articulate, in writing, three SPECIFIC dramatic improvements from the original to A's rebuild. Not abstract ("looks more modern") — concrete and visual:
- "Original hero was a flat green box; A's hero is a full-bleed photo with Fraunces display headline and labeled '01 // RESIDENTIAL' section number"
- "Original nav was a centered horizontal list of 9 links; A's nav is a sticky 4-item with yellow CTA pill and mono section indices"
- "Original services were 12 stacked paragraphs; A's services are a 3-column grid with icons, hover scale, and consistent treatment"

If you CANNOT articulate three specific dramatic improvements — if the differences are vague ("better fonts," "more spacing") OR merely cosmetic — A FAILED the bar. Recommend `verdict: "rebuild"` with specific guidance on which axes need more ambition (hero layering, section variety, typography, spacing, palette).

## Output

Write your full report to:
- jobs/{DOMAIN}/dramatic-improvement-audit.md (markdown — original-vs-A comparison + 3 specific improvements + screenshot references; or rebuild guidance if the bar isn't met)

Then return a JSON object to the orchestrator:

{
  "verdict": "pass | rebuild",
  "improvements": [
    "specific concrete improvement #1",
    "specific concrete improvement #2",
    "specific concrete improvement #3"
  ],
  "rebuild_axes": ["hero" | "sections" | "typography" | "spacing" | "palette" | ...],   // only if verdict=rebuild
  "summary": "1-line takeaway",
  "industry_benchmark": "1-line note on whether A is in the same league as the Refero industry-top references — or 'skipped — Refero results not industry-relevant' if the dataset bias prevented a useful comparison"
}

~300 tokens of output is the target. Keep prose concise — the dramatic-improvement-audit.md file holds the longform.

## What you do NOT do

- DO NOT touch source code. Verdict-only role.
- DO NOT re-run the Stage 4c-bis 18-item Visual Sanity Pass — that's a separate sub-agent, already complete.
- DO NOT spawn further sub-agents.
```

**Hard gate** (added 2026-05-05 alongside Phase D):

```bash
node scripts/log-decision.cjs $DOMAIN 4c-tris dramatic-improvement-audit-verdict --detail verdict=$VERDICT --detail model=$MODEL --detail thinkingBudget=$THINK
test -f jobs/$DOMAIN/dramatic-improvement-audit.md   # gate: file MUST exist post-dispatch
```

If the verdict is `rebuild`, escalate — don't proceed to Stage 5. The orchestrator must address the named `rebuild_axes` and re-spawn the build before B/C derive from A.

**Why this exists**: too many shipped builds were "merely better than original." The customer's $80k expectation was set by the vision tagline; the build needs to deliver on it. This audit forces an explicit "yes the bar is met, here are the three reasons" OR a rebuild — no silent "fine, ship it."

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
