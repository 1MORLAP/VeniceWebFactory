# Visual Sanity Pass — shared sub-agent spec

> **Loaded by**: Opus sub-agents dispatched from Stage 4c-bis (Option A), Stage 6c (Option B), and Stage 7g (Option C). The orchestrator never reads this file — it lives here as the single source of truth so the three dispatch sites stay aligned.
>
> **Why this file exists**: visual sanity passes were the dominant cost on the orchestrator's main-session context (~600–800K tokens of a ~600–900K budget per build, per analysis in `/Users/tomasz/.claude/plans/cozy-sparking-dewdrop.md`). Tier 2 of the context-optimization plan (2026-05-04) delegates the pass to an Opus sub-agent that reads the screenshots, applies the 18-item checklist, and returns a small JSON summary back to the orchestrator. Operational result: 6-page builds drop main-session context from ~600–800K to ~200–300K, comfortably single-session-completable.
>
> **Model contract**: this sub-agent runs `model: 'opus'`. Visual passes were calibrated for Opus's design critique; Tier 2 keeps that calibration by construction (the work moved off main, the model didn't change). DO NOT change the dispatch model to Sonnet.
>
> **Carve-out**: Stage 4c-tris (World-Class Audit, renamed from Dramatic Improvement Audit 2026-05-07) does NOT use this sub-agent. It uses a separate Opus sub-agent dispatched by the orchestrator (Phase D delegation 2026-05-05) — see `skill-stages/stage-4.md` for the audit's prompt template. The audit is a world-class-design-bar taste call ("could this be a reference design?") evaluated against three axes: (Axis 1) the **Refero Design taxonomy** ("design.md") at `~/.claude/skills/refero-design/SKILL.md` + 9 reference files (anti-ai-slop, craft-details, typography, color, motion, etc.) — the canonical world-class rubric the user subscribes to via Refero; (Axis 2) the curated `templates/inspiration/` library; (Axis 3, optional) Refero MCP's industry-top references when industry-relevant. It is a DIFFERENT critique than the 18-item visual sanity pass — different prompt, different references, different verdict schema. Keep the two passes architecturally separate so they don't drift into each other.

## What the sub-agent does

For the option being checked (A, B, or C):

1. Read every screenshot under `jobs/{domain}/qa-option-{a|b|c}/` — **FOUR viewports per page since Phase O 2026-05-07** in mobile-first order: `mobile-*.{jpg,png}` (390×844 — primary), `ipad-*.{jpg,png}` (1024×1366 — md/lg edge case), `desktop-*.{jpg,png}` (1440×900 — standard), `desktop-wide-*.{jpg,png}` (1920×1080 — FHD viewing). Read mobile first per item #1 of the checklist below; iPad and desktop-wide are coverage upgrades (items 1a + 1b) — same rules apply, but mobile-specific issues take precedence in punch-list ordering. **Phase L.1 (2026-05-07): prefer the `*.jpg` sidecars over `*.png`.** The orchestrator runs `scripts/compress-screenshots.cjs` before dispatching this sub-agent; that produces 1280px-wide JPEG-Q75 versions next to each PNG (typically ~96% smaller bytes, comparable visual signal at design-review resolution). Read the JPGs first; PNGs are the larger fallback when a JPG sidecar is missing.
2. Apply the 18-item checklist below — every item, every page, every viewport. Mobile FIRST per item #1.
3. For Stage 4c-bis / 7g only: pull industry-relevant references for the diversity check (item #18). **Local-library path (preferred since 2026-05-07)**: the orchestrator runs `node scripts/select-refero-styles.cjs $DOMAIN --for={a|c}` BEFORE dispatching this sub-agent, which writes `jobs/{domain}/refero-style-priors-{a|c}.json` containing up to 5 candidate DESIGN.md picks from the local `templates/inspiration/refero-styles/` library (1,226 brands). Read that priors file; for each candidate, read the `northStar` line and reject obvious aesthetic mismatches (SaaS/fintech metaphor matches for trade customers — see anti-ai-slop.md ban list). For 1-2 picks that survive the second-filter, Read the full DESIGN.md at `entries[i].path` (each ~10-15KB, contains tokens + components + do's/don'ts + agent prompt guide). **Empty priors file (no positive-score matches)**: corpus has nothing relevant for this customer's industry — common for SMB contractors since the corpus skews SaaS. Drop the diversity-check axis or fall back to a customer-industry peer-build PNG from `jobs/{some-other-domain}/qa-option-{same-letter}/desktop-home.png`. The 2026-05-07 pivot was from `mcp__refero__refero_*` (network/auth-dependent) to the local library (offline-ready, deterministic, faster). See REFERO REFERENCES rule in SKILL.md.
4. For Stage 7g only: in addition to the standard 18 items, apply the Stage-C-specific extensions described under "Stage extensions" — editorial-drift check (item #17 expanded) and control-plane-reflex check.
5. Return a structured JSON object matching the schema below. ~400 tokens of output is the target. The orchestrator never reads the screenshots — it reads only the JSON.
6. **MANDATORY (added 2026-05-04): also `Write` the JSON to `jobs/{domain}/qa-option-{a|b|c}/visual-pass-verdict.json` as a side effect.** The orchestrator runs `node scripts/validate-visual-pass.cjs $DOMAIN <option>` immediately after the sub-agent returns; that gate fails if the verdict file is missing. Pre-2026-05-04 the verdict was returned only as a JSON string in the sub-agent's reply — but the orchestrator could (and did) silently fall back to inline screenshot reads with no verdict produced. Writing the file to disk closes the gap: the gate enforces the artifact, not just the chat-return.

## What the sub-agent does NOT do

- Does NOT touch source code. The orchestrator handles fix-loops based on the returned JSON.
- Does NOT run Stage 4c-tris (World-Class Audit) — that's a separate sub-agent dispatched by the orchestrator after this pass returns.
- Does NOT read manifest.json, design-brief.json, `.astro` source files, or `industry-tokens.json`. Only screenshots.
- Does NOT spawn further sub-agents. One pass, one JSON return.
- Does NOT modify or write `build-design-decisions.md`. The orchestrator writes that file based on the JSON's `summary` and any items the sub-agent flagged in the diversity check.

## Output schema (return exactly this shape)

```json
{
  "stage": "4c-bis | 6c | 7g",
  "option": "a | b | c",
  "verdict": "pass | fix | rebuild",
  "items_checked": 18,
  "items_passed": 16,
  "issues": [
    {
      "item": "<checklist item name, e.g. 'active-nav-state'>",
      "severity": "fail | warn",
      "screenshot": "<relative path from jobs/{domain}/, e.g. 'qa-option-a/mobile-about.png'>",
      "description": "<one sentence — what's wrong>",
      "suggested_fix": "<one sentence — proposed remediation>"
    }
  ],
  "summary": "<one sentence — overall judgment, fed into build-design-decisions.md by the orchestrator>"
}
```

**Verdict semantics** (the orchestrator branches on this single field):

- `pass` → orchestrator advances to the next stage. Only `warn`-severity issues, if any.
- `fix` → orchestrator runs the fix-loop (Stage 4e for Option A; Stage 6's analogue for B; Stage 7's analogue for C). Issues list MUST be non-empty with at least one `fail`.
- `rebuild` → design-language-level problem the fix-loop can't reach (e.g. C drifted into editorial across the entire build, or A regressed to template-y defaults across hero+palette+typography simultaneously). Orchestrator re-spec's the option. Reserve for genuinely systemic failures.

**Items 1–18 always count toward `items_checked`.** Stage 7g's extra editorial-drift / control-plane-reflex checks fold into items #17 and the standard checks; do NOT inflate `items_checked` past 18 — the schema is fixed across stages so the orchestrator can compare verdicts at a glance.

## The 18-item checklist

(every item is here because it shipped to a user as a bug — these are the bug classes we missed before)

1. **Mobile experience (review FIRST, on every page)** — open the mobile screenshot (390 × 844) before any other viewport. Mobile is more than half of customer traffic and the most likely place for new bugs. **Phase O (2026-05-07) added two more viewports (iPad 1024×1366, desktop-wide 1920×1080) — see items 1a and 1b — but mobile stays FIRST in scan order. Mobile-specific failures are deploy-blockers; tablet/wide-screen issues are coverage upgrades.** For each mobile screenshot ask: does the hamburger work and reveal a real menu? Does any text or image overflow past the viewport edge? Does the hero photo crop cleanly or is it stretched/cut weirdly? Are tap targets generous enough to actually hit with a thumb? Is body text readable without zooming in? Is the phone CTA visible or one tap away? Does any card or section look broken because it didn't restack properly? **Mobile bugs are not "small" — they are half of the experience.**

   1a. **iPad / tablet portrait check (1024 × 1366)** — the md/lg Tailwind-breakpoint edge case. Common bugs that ONLY manifest at iPad-portrait:
   - Hamburger menu logic that breaks at 1024 (worker tested at 390 + 1440, missed the breakpoint)
   - Nav items that clip or wrap awkwardly at 1024 — they fit at 1440, fit at 390, fall over at 1024
   - Hero text wrapping into 4+ lines at 1024 when it didn't at 390 or 1440
   - `lg:grid-cols-3` cards that suddenly squish at the lg-breakpoint trigger
   - Section padding that scales linearly with viewport but feels cramped specifically at tablet width
   For each iPad screenshot ask: does the navigation transition cleanly (hamburger or full-nav) at this width? Do cards have enough breathing room? Does the hero composition still hold? If the design "looks fine" at desktop and "looks fine" at mobile but iPad reveals a third state, that's the bug-zone this viewport catches.

   1b. **Desktop-wide check (1920 × 1080)** — what FHD-monitor / business-decision-maker viewers see. Common bugs that ONLY manifest at desktop-wide:
   - Hero photo too small / centered with massive empty side gutters
   - Max-width container (`max-w-7xl` / `max-w-screen-xl` etc.) that looked tight at 1440 looks LOST in white space at 1920
   - Typographic scale that worked at 1440 looks cramped at 1920
   - Generous-whitespace sections that read STARK rather than airy at FHD
   - Multi-column grids that feel sparse with too much horizontal space between columns
   For each desktop-wide screenshot ask: does the max-width container look DELIBERATE (not lost in side gutters)? Does the hero photo hold at large sizes? Does typography scale comfortably or look stranded? If the page looks expensive at 1440 but feels like it's "swimming" at 1920, that's the bug-zone this viewport catches.

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

    If C drifted, the fix is in `industry-tokens.json` (Stage 7b-bis) — re-derive the tokens more aggressively, then rebuild. **For options A and B this item silently passes** (editorial-drift is a C-only failure mode).

18. **Diversity check (cross-build anti-monoculture, ALL options)** — this exists because of the 2026-04-25 template architecture pivot. The old `templates/astro-base/` had baked-in visual defaults (gradient-orb hero, blue+amber palette, Plus Jakarta Sans + Inter); every build that didn't fully override them inherited the same look. The pivot removed those defaults — `templates/scaffold/` provides only structure now, design is built fresh per customer. **This item is the visual defense against regression.**

    Open THIS build's homepage screenshot. Then load 1–2 peer builds' homepage screenshots from disk (provided by the orchestrator at dispatch time — typically `jobs/{some-other-domain}/qa-option-{same-letter}/desktop-home.png`).

    Honest check: does THIS site have a hero treatment, color combination, typography pairing, OR distinctive element that the peer builds don't? If everything feels familiar — same hero composition, same palette, same fonts, same card styling — you regressed to template-y defaults despite the scaffold removing them.

    Specifically inspect:
    - Hero composition: is the photo treatment / overlay style / supporting design element (bracket number, mono caption, accent rule, etc.) different from the peer builds?
    - Color palette: are the actual hex values different, OR are you using the same "navy + amber" you used last time?
    - Typography: is the display font different from the peer builds (or at least different weight/treatment)?
    - One distinctive element per page: is THIS build's distinctive element different from what the peer builds used?

    If none of those are different → flag as `severity: "fail"` and recommend `verdict: "rebuild"` with more design ambition. The orchestrator will use the recommendation when deciding whether to re-spec the option vs. dispatch a fix-loop.

## Stage extensions

### Stage 4c-bis (Option A)

Standard 18 items. Diversity check (item #18) IS critical for A — A is the most likely option to regress to template-y defaults because workers design A from scratch. Peer-build screenshots SHOULD be provided by the orchestrator at dispatch.

### Stage 6c (Option B)

Standard 18 items, but skip the peer-build diversity check on item #18 — B inherits A's design verbatim per architectural contract, so the "is THIS build different from peer builds" question is meaningless for B (it's intentionally the same as A). Instead, treat item #18 as "is B's design indistinguishable from A's design?" — a NEW failure if B's build drifted from A's structure during the rewrite (e.g., text-overflow broke a grid, cards lost alignment because new copy is longer). **For B, item #18 passes if B looks like A; fails if B diverged.**

Additional B-specific checks (fold these into the standard items as they apply, do NOT add new item numbers):

- **Layout match with A** (rolls into item #18): open A's homepage screenshot and B's homepage screenshot side-by-side. They should be visibly the same site. Sections in the same order, components looking the same, colors identical, fonts identical. Differences are limited to text length flexing components slightly. The orchestrator can include A's homepage screenshot in your input list for this comparison.
- **Voice preservation** (rolls into item #15 "would I send this"): if B's tone reads noticeably different from the customer's original voice (overly sales-y, lost personality), flag it under item #15.

### Stage 7g (Option C)

Standard 18 items + Stage-C extensions:

- **Editorial-drift check (item #17)** is the canonical Stage 7g extension. Apply it aggressively — C's plugin-driven build is the option most likely to drift into "generic Medium article." Item #17 already specifies the four sub-checks (imagery, color, typography, ornament). Use them.

- **Control-plane reflex check (NEW for Stage 7g — fold into item #15 or as a top-level concern)**: the OPPOSITE drift from editorial. After applying item #17, ALSO ask: **"Does this read as a sophisticated brand site, or as an internal tool / SaaS dashboard / admin console?"** If the screenshot looks like a thing you'd USE (Vercel deploy panel, Linear ticket queue, Stripe API console) rather than a thing you'd READ (sophisticated company brand site) — C drifted into control-plane reflex. Real bug shipped 2026-04-29 (Option C for a holding-co customer): bracket numerals + status dots + status pills + grid overlays + terminal cursors + spec callouts simultaneously. Each "felt right" individually for a tech brand, but stacked together they produced "admin dashboard" not "Stripe.com brand site."

  The mirror question to editorial-drift: where editorial-drift is "this could be a Medium article", control-plane-drift is "this could be an internal tool screenshot." Both are failure modes.

  - **Editorial drift fix** (recommend in `suggested_fix`): apply industry-tokens more aggressively (more workwear vocabulary, more hi-vis, more chevrons, more bracket numerals — the trades vocabulary).
  - **Control-plane drift fix** (recommend in `suggested_fix`): STRIP the dashboardy ornaments (status dots, terminal cursors, bracket numerals, grid overlays, file-tab nav as decoration) and re-execute with refined-modern minimalism (Stripe / Linear / Vercel / Anthropic.com). Keep ONE accent. Hairline structure only. Quiet typography. The B2B tech / SaaS / fintech / holding-co row in the industry-tokens table is the right reference for this fix.

  If either drift fires → flag as `severity: "fail"` and pick the matching fix in `suggested_fix`. If both drifts fire (rare but possible — a build with editorial layout AND dashboard chrome stacked on top), recommend `verdict: "rebuild"` because the design-language is incoherent at the systemic level.

- **Diversity check (item #18)**: compare against peer C builds in the same industry direction (e.g., other industrial/trades C builds for a plumbing customer). The diversity check on C is "did C produce a genuinely different industrial design from the last 2 industrial C builds?" not "did C avoid the editorial template" — that's item #17's job. The two items work together: #17 catches drift toward editorial; #18 catches monoculture within the right direction.

## Brevity contract

The orchestrator reads ONLY the returned JSON, not your scratch work. Internal reasoning while you read the screenshots is fine — but the JSON output should be ~400 tokens, not 4000. Keep `description` and `suggested_fix` to one sentence each. List only `severity: "fail"` issues by default; include `severity: "warn"` items only if they're genuinely close to a fail. Do NOT pad the issues array with "everything looks fine on this page" notes — `items_passed` already conveys that.

If the build passes cleanly (verdict `pass`, items_passed 18 of 18), the issues array is empty `[]` and `summary` is one sentence — that's the ideal output. The orchestrator's next action is to advance to the next stage, no fix-loop needed.
