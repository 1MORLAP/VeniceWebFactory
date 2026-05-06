# Stage 7 — Build Option C via Frontend Design Plugin

> **Loaded by**: orchestrator (Opus runs the plugin invocation directly — design-system generation needs holistic context). In decomposed mode, also loaded by each Stage 7d-build Sonnet sub-agent (alongside the per-page spec). When `--skip-c` is set, Stage 7 is skipped entirely.
>
> **Source of truth**: this is the canonical text for Stage 7. The summary in `SKILL.md` is a stub that points here.

### Stage 7: Build Option C via Frontend Design Plugin (Conversion Optimized, Plugin-Driven)

> **⏭️ SKIP-C MODE GATE**: if `$SKIP_C` was set to `1` from the input parsing (i.e., the user passed `--skip-c` / `--no-c` / `--ab-only`), **skip this entire stage**. Do not create `option-c/`, do not invoke the plugin, do not derive industry tokens, do not build, do not deploy, do not verify. Print `⏭️  Stage 7 skipped (SKIP-C mode)` and proceed directly to Stage 8 (which will also gate on `$SKIP_C`).
>
> ```bash
> if [ "$SKIP_C" = "1" ]; then
>   echo "⏭️  Stage 7 skipped (SKIP-C mode)"
>   # do not proceed with any 7a-7g substeps
> fi
> ```

> **The brief in one line:** _"Same sharper words from B, industrial design language from the plugin."_
> B already wrote the canonical conversion-tuned copy. C's job is to render those exact words in the plugin's industry-anchored design — for trades customers, that's industrial/utility aesthetic; for restaurants, food-led; for medical, clinical-warm; etc. The text from B is locked. The design is the variable. If you find yourself rewriting copy that's already in B, stop — you're doing the wrong job. The plugin's job is to raise the design bar; it is NOT permission to invent a new brand or rewrite the words. Real bugs from bigdaddysdumpers.com: C invented a "weird-looking blob" logo and used a residential-rental photo on the landscaping page. Both happened because C drifted past its actual job.

Option C is a **third output** alongside Options A and B. Same customer content, same manifest, same Astro + Tailwind v4 stack — but the design engine is the **Frontend Design plugin** (installed via `claude plugin install frontend-design@claude-plugins-official --scope project`).

**Architecture 2 update — text comes from B, not from independent rewrite:** Option C does NOT do its own copy rewrite. The canonical conversion-tuned text was produced by B (Stage 5). C reads B's `.astro` files for text content and re-renders that same text in the plugin's industry-anchored design language. This means B, B, and C all share the same words — only the design differs. **C cannot start until B is complete.**

The plugin auto-activates when Claude builds frontend interfaces. Its default bias is toward **type-driven editorial design** — which is *wrong* for trades/services customers. Option C constrains the plugin with industry-anchored rules and aggressive reuse of scraped imagery.

Option C inherits ALL image rules and content-parity rules from Option B. The plugin helps with the *design execution*, not with skipping content. Text comes from B; only the design changes.

#### 7a. Verify plugin is installed

```bash
claude plugin list 2>/dev/null | grep frontend-design
```

If it's not listed, the user must install it from their terminal (not from this Claude Code app session):

```bash
cd /Users/tomasz/WebFactory
claude plugin install frontend-design@claude-plugins-official --scope project
```

Then restart the Claude Code session so the plugin's skills load. Do NOT proceed with Option C until the plugin is installed AND the session has been restarted.

If the plugin can't be installed for some reason, skip Option C entirely (Options A + B still deploy fine).

#### 7b. Commit to an INDUSTRY-APPROPRIATE aesthetic direction

Read `jobs/{domain}/design-brief.json` → `business.industry`. The aesthetic direction for Option C must be appropriate for THAT industry — not a generic "editorial magazine" or "photo catalog" or "brutalist minimalism."

| Industry | Aesthetic direction | What it looks like |
|----------|---------------------|---------------------|
| Plumbing, HVAC, electrical, construction, landscaping, cleaning | **Industrial / trades** | Solid, confident, workwear catalog meets engineering documentation. Real photos of tools, trucks, crews, finished work. |
| Auto repair, body shop, detailing | **Garage** | Gritty, competent, hardware-forward. Photos of cars, bays, tools. |
| Restaurant, cafe, bakery | **Food-led** | Photography dominates. Menu/ingredient typography. Warm color. |
| Law, accounting, finance | **Authoritative editorial** | Sparse photography, confident serif type, restrained color. |
| Retail, e-commerce | **Product-led** | Photography IS the design. Minimal chrome. |
| Medical, dental | **Clinical-warm** | Clean, reassuring, real-patient photography. |
| Real estate | **Architectural** | Big architectural photos, restrained typography. |

**If the customer's industry doesn't match any of these**, escalate to the closest adjacent industry. Plumbing escalates to HVAC/industrial trades, NOT to editorial design.

Write the committed aesthetic direction into `jobs/{domain}/option-c/aesthetic-brief.md` as a short paragraph (for traceability).

#### 7b-bis. Derive INDUSTRY DESIGN TOKENS before building (MANDATORY)

The plugin's default bias is editorial. Without explicit token constraints, C will drift into "generic magazine layout" regardless of industry. **Before writing a single .astro file**, write `jobs/{domain}/option-c/industry-tokens.json` with concrete CSS variable values keyed to the industry direction. The build then consumes this file to seed the design system.

**Required token structure** (model populates each value based on industry):

```json
{
  "industry": "plumbing",
  "direction": "industrial / trades",
  "palette": {
    "primary":   { "hex": "#1a2433", "role": "deep workwear navy / nav bg",       "rationale": "..." },
    "secondary": { "hex": "#c4452f", "role": "crew red / heading accent",          "rationale": "..." },
    "accent":    { "hex": "#ffc107", "role": "hi-vis safety yellow / CTA only",    "rationale": "..." },
    "surface":   { "hex": "#f5f2e9", "role": "page wash / off-white card surface", "rationale": "..." },
    "ink":       { "hex": "#14140f", "role": "body text / structural lines",       "rationale": "..." }
  },
  "typography": {
    "display": { "family": "Cabinet Grotesk", "use": "headlines, section labels", "rationale": "industrial sans with weight character" },
    "text":    { "family": "Inter",           "use": "body, lists, captions",     "rationale": "neutral pairing" },
    "mono":    { "family": "JetBrains Mono",  "use": "section numbers, file-tab nav, captions, stat callouts", "rationale": "engineering-document signal" }
  },
  "ornament": {
    "shapes": ["chevrons", "hatched borders", "section labels with bracket numbers like [01]", "dotted dividers"],
    "avoid":  ["rounded magazine cards", "serif pull-quotes", "centered editorial headlines", "thin pastel accents"]
  },
  "imagery_directive": "Use scraped photos of trucks, crews, finished work AT FULL BLEED. Industrial = SHOW the work. Typographic-only sections are forbidden when manifest images exist."
}
```

**Token derivation table by industry direction** (use as starting point; the model adjusts hex values to match the customer's actual brand color signal):

| Direction          | Palette character                                             | Typography                                | Ornament                                                | Avoid                                          |
|--------------------|---------------------------------------------------------------|-------------------------------------------|---------------------------------------------------------|------------------------------------------------|
| Industrial / trades| Workwear navy/charcoal + crew red + hi-vis safety yellow      | Industrial sans display + neutral text + mono captions | Chevrons, hatched borders, bracket numbers `[01]`, file-tab nav | Rounded magazine cards, serif pull-quotes, centered editorials |
| Garage             | Asphalt black + steel grey + signal orange                    | Stencil/mechanical display + sans text    | Diagonal stripes, gear/tool dingbats, mechanical labels | Pastels, rounded everything, serif body         |
| Food-led           | Warm earth (clay, terracotta, cream, espresso)                | Editorial serif display + cozy sans text  | Texture overlays, hand-drawn dividers, ingredient lists | Hi-vis colors, industrial mono, brutalist sans |
| Authoritative editorial | Restrained monochrome + 1 muted accent (oxblood, forest, navy) | Confident serif display + serif text       | Tight rules, drop caps, restrained dividers              | Hi-vis colors, casual sans, ornament-heavy     |
| Product-led        | Neutral whites/greys + product-photo color does the work       | Clean sans display + sans text             | Minimal — let photography speak                          | Heavy ornament, editorial serifs, dark themes  |
| Clinical-warm      | Cool whites + soft sage/dusty blue + warm cream accents       | Friendly sans display + readable sans text | Soft rounded shapes, generous whitespace, gentle dividers | Hi-vis, industrial, gritty, dark themes        |
| Architectural      | Concrete grey + ink black + 1 muted brand accent               | Architectural sans + serif text            | Thin lines, oversized photography, architectural labels  | Decorative ornament, warm pastels              |
| **B2B tech / SaaS / fintech / holding co** (added 2026-04-29) | Refined-modern minimalism: near-white or near-black + ONE single accent + ample whitespace. Models: Stripe / Linear / Vercel / Anthropic.com. | Quiet sans (Inter Tight, GT America, Söhne, IBM Plex Sans) at modest weights. NO display serifs. Mono RARELY (only for actual code) | Hairline structure, generous whitespace, ONE accent used sparingly (≤ 5% of page area), subtle motion on hover only | **Bracket numerals (`[01]`, `01 /`), status dots/pills (●●● green-dot indicators), pseudo-filename eyebrows (SYSTEM_X.json, /docs/v2.md), terminal cursors (`> _`), control-plane ornament (admin-dashboard chrome, network-graph backgrounds, monospace SQL snippets as decoration). Bracket numbers + status pills + grid overlays + dashboard tropes are SaaS-tool aesthetics, NOT brand-site aesthetics.** |

**The build (Stage 7d below) MUST consume `industry-tokens.json`** — wire each `palette.*.hex` value into `src/styles/global.css` as a CSS variable, set the `typography.display/text/mono` families as the Google Fonts loaded in BaseLayout, and apply `ornament.shapes` as the design vocabulary across components. The `ornament.avoid` list is what the build MUST NOT do.

**Editorial-drift catch (in Visual Sanity Pass for C)**: after building, look at C's homepage screenshot and ask: "If a stranger saw this without knowing the customer, would they guess the industry within 3 seconds?" If the answer is "looks like a Medium article" or "could be any consultancy" — C drifted into editorial. Reject and rebuild with the industry tokens applied more aggressively.

**Control-plane-reflex catch (in Visual Sanity Pass for C, especially for B2B tech / SaaS / fintech / holding-co directions)**: the OPPOSITE drift from editorial. After building, look at C's homepage screenshot and ask: **"Does this read as a sophisticated brand site, or as an internal tool / SaaS dashboard / admin console?"** If the screenshot looks like a thing you'd USE (Vercel deploy panel, Linear ticket queue, Stripe API console) rather than a thing you'd READ (sophisticated company brand site) — C drifted into control-plane reflex. Real bug shipped 2026-04-29 (Option C for a holding-co customer): the design featured bracket numerals + status dots + status pills + grid overlays + terminal cursors + spec callouts simultaneously. Each "felt right" individually for a tech brand, but stacked together they produced "admin dashboard" not "Stripe.com brand site."

**The mirror question to editorial-drift**: where editorial-drift is "this could be a Medium article", control-plane-drift is "this could be an internal tool screenshot." Both are failure modes. Both reject and rebuild — but the fix is different:

- **Editorial drift fix**: apply industry-tokens more aggressively (more workwear vocabulary, more hi-vis, more chevrons, more bracket numerals — the trades vocabulary).
- **Control-plane drift fix**: STRIP the dashboardy ornaments (status dots, terminal cursors, bracket numerals, grid overlays, file-tab nav as decoration) and re-execute with refined-modern minimalism (Stripe / Linear / Vercel / Anthropic.com). Keep ONE accent. Hairline structure only. Quiet typography. The B2B tech / SaaS / fintech / holding-co row in the table above is the right reference for this fix.

The two checks together catch BOTH directions of drift. Run BOTH on every C build. If either fires, reject and rebuild before proceeding to Stage 8.

#### 7c. Set up Option C project structure

Same scaffold as A (the pure-scaffold pivot from 2026-04-25 — see Stage 3-pre / 3a). Copy `templates/scaffold/`, NOT `templates/astro-base/` (which no longer exists; its contents moved to `templates/inspiration/saas-default/` as reference only).

```bash
cp -r templates/scaffold/ jobs/{domain}/option-c/
```

```bash
cd jobs/{domain}/option-c/
npm install
```

For C, also read `templates/inspiration/industrial-trades/` (or the inspiration directory matching `industry-tokens.json → direction`) before designing — that's the explicit purpose of the inspiration library, especially for C where the plugin's editorial bias most needs counterweight.

```bash
# Copy all scraped images — we'll use them aggressively
cp jobs/{domain}/assets/img/* jobs/{domain}/option-c/public/images/
```

**DO NOT** create `.claude/launch.json` inside `option-c/`.

#### 7d. Build pages with plugin active — HARD RULES

> **DECOMPOSED-MODE NOTE (since 2026-04-29 + validated experiment 2026-04-29 on libertylandscapefl):** in decomposed mode (which is now the default), Stage 7d still BEGINS with the explicit plugin invocation below — the plugin produces the C design system (palette, typography, components, ornament, CSS classes, BaseLayout/SiteLayout) for the WHOLE site. **THEN** Opus splits the per-page work the same way it does for A and B:
>
> 1. Plugin invocation (Opus) → produces shared scaffold: `src/components/`, `src/layouts/`, `src/styles/global.css`, `industry-tokens.json` consumed and wired in. **The plugin's BaseLayout/SiteLayout MUST accept a `lang` prop** (same pattern as Stage 5e for Option B) — required for any future `/<lang>/` rendering even on English-only builds (future-proofing for `--add-language`).
> 2. Stage 2.7 contrast lint on the plugin's scaffold (re-use the smoke-test pattern). The plugin's output isn't immune to contrast bugs.
> 3. Stage 2.5 spec generation (Opus) — write per-page specs for C that reference: (a) B's verbatim text from `option-b/src/pages/*.astro` (English), (b) **B's verbatim translated text from each active language directory `option-b/src/pages/<lang>/<page>.astro` IF ANY (single source of truth from MULTILINGUAL SUPPORT rule — only present when the user passed `--languages` at build OR `--add-language` post-build)**, (c) the plugin-output components, (d) the industry-tokens.json palette/typography/ornament. Save to `jobs/{domain}/specs-c/` (separate from the A/B specs in `specs/`). **Each spec references the EN source file unconditionally; only references translated source files for languages currently active in B's `src/pages/`** — on English-only builds, the spec mentions zero translation source files.
> 4. Stage 2.5b validate-specs (mandatory — same script as A/B).
> 5. Stage 7d-build: spawn N Sonnet sub-agents in parallel, one per page. Each sub-agent's prompt MUST include `Read /Users/tomasz/WebFactory/skill-stages/stage-7.md FIRST for full Stage 7 instructions.` Each consumes its spec + the plugin-output scaffold and writes 1 English `.astro` file UNCONDITIONALLY at `option-c/src/pages/<page>.astro`. If languages are active in B, the worker ALSO writes one translated `.astro` per active language at `option-c/src/pages/<lang>/<page>.astro` — matching B's translated copy byte-identical (per MULTILINGUAL SUPPORT rule + extended testimonial-tampering check on every `/<lang>/`). On English-only builds, no `/<lang>/` files are produced. The plugin-output Nav component includes the multi-language switcher only when ≥1 non-English language is active.
> 6. Stages 7e/7f/7g run on the worker output, same as before — operating across `/` always; across `/<lang>/` page sets only if those languages exist.
>
> **Validated 2026-04-29** on libertylandscapefl.com: 4 Sonnet sub-agents in parallel produced C pages from plugin-output components. 0 first-run QA fails. Headlines + facts byte-identical to Opus C baseline. Line-count Δ +2 to +99 (some Sonnet verbosity on the contact page). Plugin's design coherence preserved BECAUSE workers consume plugin-output components — they don't re-design. The plugin is invoked once for the design system; per-page work decomposes safely. Token cost on per-page work drops same ~70-80% as A/B. **Decomposed-C is now default in `--decomposed` mode** (which itself is the default).
>
> **Escape hatch**: if the plugin output for a particular customer doesn't decompose cleanly (e.g., the plugin returned a monolithic single-page implementation rather than a per-page-composable design system), Opus can build C pages directly without dispatching workers — same as `--monolithic` mode just for the C track. This is the rare exception.

**INVOKE THE PLUGIN EXPLICITLY AT THE START OF THIS STAGE** (mandatory — was previously implicit / auto-trigger; explicit invocation lands the work in the Claude Design weekly quota and ensures the plugin actually engages):

```
Skill: frontend-design
Args (free-form prompt):
  Design and build the Option C frontend for {business-name} ({business-type}) in {industry}.

  CONTEXT:
  - This is the "industrial design language" track — Option C is the explicit
    plugin-driven design output, intentionally distinct from Option A
    (worker-designed). The customer comparison A vs C measures "worker design vs
    plugin design" with content held constant via Option B as the text bridge.
  - Industry: {industry from design-brief.json}.
  - Industry direction: {industry-tokens.direction — e.g. "industrial / trades",
    "food-led", "clinical-warm"}.

  CONSTRAINTS (read these in priority order):
  1. INDUSTRY ANCHORING (highest priority — overrides plugin defaults). Use
     industry-tokens.json palette + typography + ornament. AVOID the
     `ornament.avoid` list specifically. The plugin's default bias is editorial
     magazine; industry direction beats that. For trades: industrial sans display
     + mono captions + bracket-numbered sections, NOT serif pull-quotes. For
     food: warm earth + serif display, NOT industrial mono. For medical/dental:
     cool clinical-warm + friendly sans, NOT brutalist. The industry-tokens.json
     IS the spec.
  2. SCRAPED IMAGERY (use aggressively). Hero, service tiles, content sections
     all use customer photos from public/images/. NO typographic-only design
     when the customer has photos available. NO stock images.
  3. TEXT FROM B (verbatim, locked). Read jobs/{domain}/option-b/src/pages/*.astro
     for every page's text. Use those EXACT words in C — headings, body copy,
     CTAs, FAQ Q+A, testimonial quotes, all of it. Do NOT rewrite copy. C is
     design-only; B is the canonical text source.
  4. STRUCTURAL REQUIREMENTS (REQUIRED-PATTERNS.md). Hero three-layer pattern,
     mobile-first design, 44×44px tap targets, 16px body min, generic text
     contrast WCAG AA, full preserved logo, real social link hrefs from manifest,
     favicon, no testimonial tampering. The qa-check gate enforces these
     programmatically; design within them, don't fight them.
  5. PRESERVE B's STRUCTURAL PARITY. Same nav structure, same section order
     within each page, same components (hero / service grid / testimonials /
     FAQ / contact / footer). The plugin can RESTYLE each pattern — that's
     the whole point — but the customer's eye should still be able to compare
     B vs C side-by-side and see "same site, different design." Inventing new
     sections breaks the comparison.
  6. REFERO REFERENCES (added 2026-05-05, Phase E — Option C only). Before
     committing the final design language, query the Refero MCP server for
     industry-relevant references to anchor C's aesthetic. Use the
     `mcp__refero__refero_search_screens` tool with platform="web". Sample
     queries:
       - "{industry} services landing page hero"
       - "{industry-direction} brand site"
       - "premium {industry} portfolio gallery"
     Get 5-10 results, identify 2-3 that match `industry-tokens.json →
     direction` (NOT generic SaaS aesthetics). For each chosen reference,
     fetch its content via `mcp__refero__refero_get_screen_content` and
     incorporate the structural ideas — section order, hero composition,
     spacing rhythm, typographic hierarchy. **DO NOT copy visual style
     verbatim** — Refero's dataset is heavy on B2B SaaS / fintech /
     productivity, which is the WRONG aesthetic for trades/contractor
     customers. Filter aggressively. If the references all look like
     Stripe/Linear/Notion clones, reject them and rely on
     `industry-tokens.json` + `templates/inspiration/<directory>/` instead.
     See REFERO REFERENCES rule in SKILL.md for the full caveat.

  WHAT TO BUILD:
  - Astro 5 + Tailwind v4 (template scaffold already copied to option-c/ in 7c)
  - One .astro page per page in manifest, using B's text verbatim
  - Custom components designed per industry-tokens.json
  - Hero variant per page (homepage hero ≠ services hero ≠ contact hero)
  - All accessibility primitives (semantic HTML, skip-to-content, etc.)
  - Reads industry-tokens.json from jobs/{domain}/option-c/industry-tokens.json
    (already created in 7b-bis) — wire its palette/typography/ornament into
    src/styles/global.css and BaseLayout.astro

  WHAT TO RETURN:
  Concrete .astro component code, global.css CSS variables + utility classes,
  BaseLayout.astro updates, and one page per manifest entry. Be bold. Be
  industry-anchored. Avoid the editorial-default that's the plugin's natural
  bias for trades customers.
```

The worker session writes the plugin's output to `jobs/{domain}/option-c/src/`. Then Stage 7e (build check), 7f (content parity), 7g (QA — also invokes the plugin for second-pass critique), 7h (visual QA), 7i (stop dev server) follow.

**Plugin-invoked instrumentation** (per ORCHESTRATION LOGGING CONTRACT) — log immediately after the `Skill: frontend-design:frontend-design` invocation returns:

```bash
INDUSTRY=$(node -e 'try { console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/option-c/industry-tokens.json","utf8")).industry || "unknown") } catch { console.log("unknown") }')
node scripts/log-decision.cjs "$DOMAIN" 7d plugin-invoked --detail plugin=frontend-design --detail industry="$INDUSTRY"
```

**Stage 7d hard gate — verify the plugin actually fired** (added 2026-05-04):

```bash
node scripts/validate-stage7-plugin.cjs $DOMAIN
# Log the gate result for the audit trail
RICHNESS=$(node /Users/tomasz/WebFactory/scripts/validate-stage7-plugin.cjs "$DOMAIN" 2>&1 | grep -oE '[0-9]+/10' | head -1)
node scripts/log-decision.cjs "$DOMAIN" 7d validate-stage7-plugin-pass --detail richness="$RICHNESS"
```

This script fingerprints plugin invocation by inspecting the richness of `jobs/{domain}/option-c/industry-tokens.json` + `jobs/{domain}/option-c/aesthetic-brief.md`. It runs 10 plugin-quality checks (palette ≥ 5 entries, palette entries with role+rationale, ornament.shapes ≥ 3, ornament.avoid ≥ 3, distinct_from_option_a object, aesthetic-brief ≥ 1500 chars, drift-awareness signal, etc.). Threshold: ≥ 70% must pass. Real plugin output passes 9-10/10; thin inline output (orchestrator fallback) typically passes 3-5/10.

If the gate fails, the orchestrator either (a) re-invokes the plugin properly (preferred), or (b) passes `--allow-inline` to acknowledge that Stage 7 deliberately ran inline. Use `--allow-inline` sparingly — almost always the right answer is to use the plugin.

**Stage 7d ordering — global.css write race** (real bug 2026-05-04 watkinsmonuments.com): the orchestrator's pre-plugin scaffold setup wrote a placeholder `global.css`, then the plugin invocation wrote its own design-token global.css, but mid-Stage-7 the orchestrator noticed C's qa-check failing and discovered "the C global.css never got written — it's still the scaffold default." The plugin's output had been overwritten OR never landed. Workaround: the worker rewrote global.css from scratch.

The fix is ordering: do the plugin invocation BEFORE the per-page Sonnet sub-agent dispatch, AND verify `option-c/src/styles/global.css` contains plugin-quality tokens (CSS variables for the industry palette, font-family declarations matching `industry-tokens.json`) BEFORE Stage 7d-build dispatches workers. If the file is still the scaffold default after plugin invocation, re-invoke the plugin with explicit `Write the design system to src/styles/global.css` instruction OR write the tokens manually from industry-tokens.json (last resort — better to debug the plugin race).

**Tailwind v4 class collision — DO NOT define utility-namespace custom classes in global.css** (real bug 2026-05-04 watkinsmonuments.com): defining `.bg-slate-deep`, `.bg-paper-2`, `.text-brass`, etc. inside `global.css` causes Tailwind v4's JIT to either shadow or strip those classes at build time. The orchestrator burned 5 edit cycles retreating to inline `style="background:#..."` across 6 components.

The fix:
1. Use `@theme` to define tokens — Tailwind v4 generates real utilities from `@theme` definitions. `@theme { --color-slate-deep: #0F1620; }` produces `.bg-slate-deep` automatically AND it survives JIT.
2. Or use arbitrary-value bracket utilities inline: `class="bg-[#1A2018]"` — no class definition needed.
3. Or use namespaced custom names that DON'T match Tailwind prefixes: `.surface-deep` instead of `.bg-deep`. Tailwind ignores classes whose prefix isn't in its utility namespace.

The qa-check `tailwind-v4-class-collision` rule (added 2026-05-04) scans global.css for selectors starting with Tailwind prefixes (`bg-`, `text-`, `border-`, `ring-`, `shadow-`, etc.) and warns. Heed those warnings — they indicate latent shadowing.

**Stage 7d-build per-dispatch instrumentation** (per ORCHESTRATION LOGGING CONTRACT) — same pattern as Stage 3 dispatch, but for option=c. Resolve per-page model first:

```bash
PER_PAGE_MODEL=$(node scripts/get-model.cjs $DOMAIN perPage --field model)
PER_PAGE_AGENT=$(node scripts/get-model.cjs $DOMAIN perPage --agent-model)
PER_PAGE_EFFORT=$(node scripts/get-model.cjs $DOMAIN perPage --field effort)
for SPEC in jobs/$DOMAIN/specs-c/*.md; do
  PAGE=$(basename "$SPEC" .md)
  case "$PAGE" in _*) continue ;; esac
  node scripts/log-decision.cjs "$DOMAIN" 7d-build sub-agent-dispatched --detail option=c --detail page="$PAGE" --detail model=$PER_PAGE_MODEL --detail effort=$PER_PAGE_EFFORT
done
```

Agent tool dispatches use `model: '$PER_PAGE_AGENT'`. Per `cost-tier=balanced` and `aggressive` this stays on `sonnet` per 2026-05-05 user direction (Haiku codegen quality is medium-risk; reserved for translation/report/scaffold).

(If the orchestrator uses a different specs path for C — e.g., re-using `specs/` or generating C-specific specs in `option-c/specs/` — adjust the loop's source dir accordingly. The instrumentation is what matters; the loop's source path is a detail.)

**Why we EXPLICITLY invoke at build time** (not just rely on auto-trigger): the plugin auto-engages when "the user asks to build frontend interfaces," which our pipeline does naturally — but auto-trigger doesn't always register cleanly in usage telemetry, and the plugin's depth of engagement varies based on prompt clarity. Explicit invocation with the constraint prompt above guarantees:
1. The plugin engages, hard, on every C build (not just "maybe, if it auto-fires")
2. Industry anchoring is a constraint, not a vibe — the plugin doesn't default to its editorial bias
3. The Claude Design weekly quota tracks correctly, so usage is visible in telemetry

**VERIFY CLAUDE DESIGN QUOTA TICKS UP** (added 2026-04-29 after a real telemetry-leak bug — see FEEDBACK.md "Frontend Design plugin telemetry leak"):

After Stage 7d's plugin invocation, the user's `Weekly · Claude Design` quota meter should tick up. If it stays at 0% while `Weekly · all models` ticks up, that's the **upstream marketplace bug** where the plugin was installed without a version identifier (path resolved to `frontend-design/unknown/` instead of `frontend-design/x.y.z/`). The plugin engages locally but Anthropic's telemetry can't attribute the call to the Claude Design product.

Quick check (the user's job, since the orchestrator can't see the user's usage panel):
- Before Stage 7 starts: note current `Weekly · Claude Design` percentage.
- After Stage 7d completes: refresh usage panel.
- If 0% → 0%: the workaround in `~/.claude/plugins/installed_plugins.json` may have reverted, OR a fresh `claude plugin install` overwrote the local fix. Re-apply the workaround per FEEDBACK.md, OR file with Anthropic.

If the orchestrator notices the path on plugin load includes `unknown/` instead of a version (visible in the `Base directory:` line at the top of every `Skill: frontend-design` invocation), STOP and flag for the skill-owner. Don't continue with Stage 7 — it'll just leak telemetry quota.

The hard rules below are the same constraints expressed in detail. The Skill invocation above is the trigger; the rules below are the contract.

**Rule 1: Use the customer's scraped imagery. Aggressively. AND map images to pages correctly.**

The scraped photos in `public/images/` ARE the customer's brand. A typographic-only design in the plugin's default style is NOT "flexibility" — it's discarding the customer's visual asset base. Violations of any of these are a bug:

- Homepage hero MUST use a `backgroundImage` from the manifest's homepage entry (with overlay for legibility)
- Every service / inner page MUST have a relevant photo from `backgroundImages` or `images`
- Content sections (Why Us, About, Services catalog) MUST have supporting photography — team, trucks, work-in-progress, finished jobs
- Portfolio / work-gallery sections MUST be preserved with real photography
- The About page MUST have a team or owner photo if one exists in the manifest

**IMAGE-TO-PAGE MAPPING (preserve semantic binding):** This was the second bug from bigdaddysdumpers.com — Option C used a residential-rental photo on the landscaping-debris-removal page because it looked aesthetically nice. Options A and B got it right; C didn't. Don't repeat this.

- Each page's images in `manifest.json` (`page.images` and `page.backgroundImages`) are NOT a generic image pool. They are images the original site curated for THAT specific page.
- For each page you build, **prefer images from THAT page's manifest entry** (use the `localPath` field as the canonical reference).
- Only fall back to images from other pages if the source page has no usable images, AND the borrowed image is from a semantically adjacent page (same service category — e.g., "drain cleaning" can borrow from "hydro jetting", but NOT from "tankless water heaters").
- NEVER use "any image that fits the aesthetic." Category drift (residential photo on a commercial page, plumbing image on an electrical page) is visible to the customer immediately and signals "they didn't actually pay attention to my business."

**IMAGE DIVERSITY + SEMANTIC MATCHING (within a single page):** This was the third image bug, shipped on naples-pressure-washing-a (2026-04-25). The Option A homepage rendered three service cards — Driveway Power Wash, Home Power Washing, Sidewalk Pressure Washing — and used the **same pool photo** for all three cards. The customer's original site had multiple distinct service photos available, but the build re-used one image because it "looked nice" or because the worker session didn't bother to find unique ones for each card.

Hard rules:

1. **Within any single page, every content image must be unique unless absolutely necessary.** A grid of N service cards needs N distinct images. A 3-column "Why Us" feature row needs 3 distinct images. Re-using the same photo in adjacent slots reads as a content-poor template; the customer will notice immediately.
2. **Match each image to its section's topic.** You don't have a vision model — but you have proxies. Use them in this order:
   - **`alt` text** in the manifest entry (often describes the image: "Driveway after pressure washing", "Crew member sanding car bumper", "Tankless water heater installed in garage")
   - **Filename hints** in `localPath` (e.g., `bg_driveway.jpg`, `pool_after.jpg`, `team_truck.jpg`)
   - **`src` URL hints** (Hibu/CMS often have descriptive URLs: `dms3rep/multi/opt/sidewalk-pressure-washing-1920w.jpg`)
   - **Original page context** from the manifest — if image X appeared on the Sidewalk Cleaning page in the original, prefer it for sidewalk-related cards in the rebuild
3. **Fallback chain when no perfect-match image exists for a card**:
   - **(a) Best**: a related-but-not-perfect image (e.g., for "Sidewalk Cleaning", a generic clean-concrete photo from another page beats reusing the driveway photo)
   - **(b) Acceptable**: a generic / atmospheric image (the customer's truck, crew, building exterior, hero photo cropped differently) — better than a category-mismatch
   - **(c) Last resort**: omit the image entirely, design the card text-only with strong typography, before duplicating an image
   - **(d) Forbidden**: don't ever use a stock image from outside the manifest, and don't fabricate images
4. **Same-image reuse is allowed ONLY when**: the manifest genuinely has fewer unique images than card slots AND the card is not the customer's primary differentiator (e.g., a single hero photo can repeat across an "About" tile and a "Contact" tile if no other photos exist; service cards on the homepage are NOT in this category — they are the differentiator).
5. **The QA gate (`qa-check.js`) blocks the build** if a content image (>= 80×80px, not in nav/footer) appears more than once on the same page. Forces the worker to find diverse images OR consciously omit images and use text-only cards.

**Rule 2: Anchor the design to the industry, not to a generic "editorial" style.**

Apply the aesthetic direction committed in Stage 7b. The plugin will push for bold typography, distinctive color, and intentional composition — keep that — but frame every decision around whether a real customer in that industry would recognize this as "a good plumbing/auto/etc website" vs. "a magazine pretending to sell plumbing." If the plugin nudges you toward a choice that feels editorial-over-industrial, override it.

**Rule 3: Distinctive type + color still matters, but honest to the industry.**

Don't default to Inter + safe navy. DO pick distinctive choices — but the distinctive choices must feel honest to the business. A mono type for a plumbing brand reads as engineering; for a restaurant it reads as awkward. Match the type and color language to the industry.

**Rule 4: Content parity AND text source — pull text from B, never rewrite.**

Architecture 2 rule: Option C uses B's text VERBATIM. Don't run another copy pass. For each Option C page, read the corresponding `.astro` file in `jobs/{domain}/option-b/src/pages/` and extract the text. Use those exact words in C's pages.

- Every page from the manifest exists as `.astro` in `src/pages/` (one C page per B page)
- Every service, testimonial, FAQ, stat, certification, partner logo, trust signal from B appears in C
- Phone, email, address match the manifest (which match B's output)
- Full navigation with organized page links — NOT flat anchor links
- Mobile menu, phone CTA in nav, mobile sticky CTA bar
- Shared footer matching Option A/B structure
- **Headings, body copy, CTAs, FAQ Q+A pairs, testimonial quotes are ALL drawn verbatim from B**. C's job is design, not copywriting. If you find yourself rewriting a sentence that's already in B, stop — use B's version.

**Rule 5: Shared component patterns.**

Use the same section patterns as Option B where they work (hero, service grid, testimonials, FAQ, contact form, CTA banner, footer). The plugin can reinterpret the *styling* of each pattern, but the *structure* should be recognizable across A, B, and C for a valid comparison.

#### 7e. Build check

```bash
cd jobs/{domain}/option-c/
npm run build
```

Fix any build errors before continuing.

#### 7f. Content parity audit (English always; per-language only when active)

Content parity audit for Option C (same structure as Option B's audit; multilingual checks fire only when ≥1 non-English language is active):

1. Read each manifest entry for a page, confirm every product / service / testimonial / stat / certification appears in the corresponding `.astro` file (English version)
2. **For each active language in B's `src/pages/`** (none on English-only builds, otherwise one or more): for every English page, confirm a `/<lang>/` counterpart exists with the same content sections rendered in that language
3. **Verify translated copy = B's translated copy** for every active language: spot-check 2–3 pages per language — the body text in `option-c/src/pages/<lang>/<page>.astro` should be byte-identical to `option-b/src/pages/<lang>/<page>.astro` (with only design wrapper differences). Single source of truth from MULTILINGUAL SUPPORT rule, applies across every active language.
4. **Verify testimonial translation tags**: every translated testimonial in `/<lang>/` pages has the appropriate per-language tag near the attribution (e.g., `(traducido del inglés)` for ES, `(aus dem Englischen übersetzt)` for DE — see language table). Attribution names stay original.
5. Run the content-density check (word count, image count per page) for English; extend across each active language's pages
6. Flag and fix any gaps before proceeding to QA

```bash
echo "── English pages ──"
for page in $(find jobs/{domain}/option-c/dist -maxdepth 2 -name "*.html" -not -path '*/[a-z][a-z]/*'); do
  FILENAME=$(echo "$page" | sed "s|jobs/{domain}/option-c/dist/||")
  WORD_COUNT=$(cat "$page" | sed 's/<[^>]*>//g' | wc -w | tr -d ' ')
  IMG_COUNT=$(grep -co 'src="/images/' "$page" | tr -d ' ')
  echo "$FILENAME: $WORD_COUNT words, $IMG_COUNT images"
done

# Per-language audit — runs once per active language (no-op if none)
for LANG_DIR in jobs/{domain}/option-c/dist/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -ne 2 ]; then continue; fi   # skip non-language dirs
  echo "── $LANG pages ──"
  for page in $(find "$LANG_DIR" -maxdepth 2 -name "*.html" 2>/dev/null); do
    FILENAME=$(echo "$page" | sed "s|jobs/{domain}/option-c/dist/||")
    WORD_COUNT=$(cat "$page" | sed 's/<[^>]*>//g' | wc -w | tr -d ' ')
    IMG_COUNT=$(grep -co 'src="/images/' "$page" | tr -d ' ')
    echo "$FILENAME: $WORD_COUNT words, $IMG_COUNT images"
  done
done
```

**Hard fail (English always)**: any homepage or inner page with 0 images. The plugin's bias toward typographic design is an image-dropping bug; flag and fix.

**Hard fail (only when language is active)**: any English page with no `/<lang>/` counterpart for any active `<lang>`. Any `/<lang>/` page that doesn't render `<html lang="<lang>">`. (No fail if the build is English-only — there's nothing to compare against.)

#### 7g. Pre-Deploy Completeness Check (BLOCKING)

Pre-deploy completeness check for Option C against `jobs/$DOMAIN/option-c/dist/`. Verify:
- EN page count ≥ manifest page count
- **(Only when ≥1 non-English language is active)** Every active language's page count = EN page count (MULTILINGUAL SUPPORT — Stage 5h parity check generalized)
- Homepage nav links to every manifest page (in every active language's nav)
- **(Only when ≥1 non-English language is active)** Language switcher present on every page (MULTILINGUAL SUPPORT — switcher must list ALL active languages including English; on English-only builds, no switcher is rendered, no failure)
- **(Only when ≥1 non-English language is active)** Every `/<lang>/` page has `<html lang="<lang-code>">` (MULTILINGUAL SUPPORT). English pages always have `<html lang="en">`.
- Phone number on every page (English always; every active language's pages too)
- Logo reference on every page (English always; every active language's pages too)
- Mobile menu on every page (English always; every active language's pages too) — including the language switcher in mobile drawer when ≥1 language is active
- No broken Material Symbols
- **Option-C-specific**: every page has at least one image reference (Rule 1 enforcement) — English always; every active language's pages too

#### 7h. Visual QA — Headless screenshots + Visual Sanity Pass (delegated to Opus sub-agent — Tier 2 of context-optimization, 2026-05-04) + plugin critique

Option C gets its own port allocated by `init-metrics.cjs` (`metrics.ports.optionC = portA + 2`). Read it via `get-port.cjs`:

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd jobs/{domain}/option-c
npx astro dev --port $PORT_C &
echo $!
sleep 4
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_C --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist / /about /contact
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
mkdir -p jobs/{domain}/qa-option-c
node scripts/qa.cjs http://localhost:$PORT_C jobs/{domain}/qa-option-c
```

**Visual Sanity Pass on Option C — delegated to an Opus sub-agent.** C uses a plugin-driven design that's the most likely option to produce novel layouts and novel bugs (the active-nav black-on-black bug shipped on a C-style design; the holding-co control-plane-reflex stack of bracket numerals + status pills + grid overlays + terminal cursors shipped 2026-04-29). The 18-item checklist is the primary defense against "the plugin made something weird," and it now runs in a sub-agent so the orchestrator never reads C's 12–24 screenshots itself.

Per Tier 2 of the context-optimization plan, the Visual Sanity Pass is delegated to an Opus sub-agent. **The 18-item checklist + JSON output schema live in `/Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md`** (single source of truth, shared with Stage 4c-bis and Stage 6c). C-specific extensions: the **editorial-drift check (item #17)** and the **control-plane reflex check** (mirror-failure-mode for B2B tech / SaaS / fintech / holding-co directions). Both extensions are documented in detail under "Stage 7g (Option C)" inside `visual-sanity-pass.md`.

Spawn ONE sub-agent via the `Agent` tool — same dispatch shape as Stage 4c-bis. **Resolve the model per cost-tier first** (Phase D, see top of this file's pre-dispatch block — `VP_MODEL`, `VP_AGENT`, `VP_EFFORT` are already resolved):

- `subagent_type: 'general-purpose'`
- `model: '$VP_AGENT'`
- Prompt template (substitute `{DOMAIN}` and the peer C-build screenshot path):

```
## Charter

You are running the **Stage 7g/7h Visual Sanity Pass** on Option C for {DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md FIRST for the full 18-item checklist + JSON output schema + brevity contract. Pay particular attention to the "Stage 7g (Option C)" section under "Stage extensions" — it documents the editorial-drift check (item #17) AND the control-plane reflex check (mirror failure mode), both of which apply on every C build.

## What to read

- jobs/{DOMAIN}/qa-option-c/desktop-*.png — desktop screenshots for every page
- jobs/{DOMAIN}/qa-option-c/mobile-*.png — mobile screenshots for every page
- ONE peer C-build homepage screenshot in the same industry direction for the diversity check (item #18). Path: {PEER_C_BUILD_PNG} — pick a recent C build with the same industry-tokens direction (e.g., another industrial/trades C build for a plumbing customer).

## What to return

A JSON object matching the schema in visual-sanity-pass.md (stage="7g", option="c"). Keep your reasoning concise — the orchestrator only sees your final JSON, not your scratch work. ~400 tokens of output is the target.

Apply BOTH C-specific extensions on every C build:
- **Editorial-drift check (item #17 expanded)**: would a stranger guess the industry within 3 seconds, or does this look like a Medium article / generic consultancy / typographic-only design? Flag `severity: "fail"` with `suggested_fix: "apply industry-tokens more aggressively (more workwear vocabulary, hi-vis, chevrons, bracket numerals)"` if drift is detected.
- **Control-plane reflex check (mirror failure mode)**: does this read as a sophisticated brand site, or as an internal tool / SaaS dashboard / admin console? If the page looks like Vercel deploy panel / Linear ticket queue / Stripe API console rather than a brand site, flag `severity: "fail"` with `suggested_fix: "STRIP dashboardy ornaments (status dots, terminal cursors, bracket numerals, grid overlays) and re-execute with refined-modern minimalism — Stripe / Linear / Vercel / Anthropic.com reference"`.

If BOTH drifts fire simultaneously (rare — editorial layout AND dashboard chrome stacked together), recommend `verdict: "rebuild"` because the design-language is incoherent at the systemic level.

## What you do NOT do

- DO NOT touch source code. The orchestrator handles fix-loops + plugin critique invocation based on your JSON.
- DO NOT read the manifest, design-brief, industry-tokens.json, or .astro source files. Only screenshots + the checklist.
- DO NOT invoke the frontend-design plugin for critique — that is the orchestrator's job in the next step (it dispatches the plugin's own critique invocation after receiving your JSON).
- DO NOT write build-design-decisions.md. The orchestrator writes it after Stage 7h returns.
```

**Pre-dispatch — resolve model per cost-tier** (Phase D, 2026-05-05):

```bash
VP_MODEL=$(node scripts/get-model.cjs $DOMAIN visualPass --field model)
VP_AGENT=$(node scripts/get-model.cjs $DOMAIN visualPass --agent-model)
VP_EFFORT=$(node scripts/get-model.cjs $DOMAIN visualPass --field effort)
node scripts/log-decision.cjs "$DOMAIN" 7g visual-pass-dispatched --detail option=c --detail model=$VP_MODEL --detail effort=$VP_EFFORT
```

Then dispatch the Agent above with `model: '$VP_AGENT'`.

Receive the sub-agent's JSON (~400 tokens). The sub-agent MUST write its full JSON to `jobs/{domain}/qa-option-c/visual-pass-verdict.json` AND return a 1-line acknowledgment to the orchestrator.

Then run the hard gate AND log the verdict:

```bash
node scripts/validate-visual-pass.cjs $DOMAIN c
VERDICT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/qa-option-c/visual-pass-verdict.json","utf8")).verdict)')
ITEMS_PASSED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/qa-option-c/visual-pass-verdict.json","utf8")).items_passed)')
node scripts/log-decision.cjs "$DOMAIN" 7g visual-pass-verdict --detail option=c --detail verdict="$VERDICT" --detail items_passed="$ITEMS_PASSED" --detail model=$VP_MODEL --detail effort=$VP_EFFORT
```

This is the Stage 7h hard gate (added 2026-05-04, same pattern as Stage 4c-bis and 6c). Verifies the verdict JSON exists with valid schema and that the verdict isn't `rebuild`. Pass `--allow-inline` only when the orchestrator deliberately ran the visual pass in main session (rare).

Then branch on `verdict`:
- `pass` → continue to the plugin critique invocation below (a second design-pass from the plugin to refine the build), then the fix-loop only if the plugin critique surfaces issues.
- `fix` → run the C fix-loop, scoped to the issues listed in the JSON. If item #17 or the control-plane-reflex check fired, the fix may require revisiting `industry-tokens.json` (Stage 7b-bis) before rebuilding.
- `rebuild` → escalate (re-run Stage 7d with tighter industry-tokens; either editorial drift across the entire build OR both editorial+control-plane drifts firing simultaneously). The gate exits 2 on `rebuild`, blocking deploy until you address.

After the sub-agent returns (regardless of verdict), invoke the **`frontend-design` skill** for a second-pass design critique. This is a complement to the sub-agent's structural pass — the plugin reviews its own Stage 7d output through its own design lens and proposes refinements. The orchestrator runs this directly (the plugin is invoked as a Skill, not a sub-agent):

```
Skill: frontend-design
Args (free-form prompt):
  Critique and improve the Option C build for {business-name} ({business-type}) in {industry}.

  CONTEXT:
  - This is the "industrial design language" track — text from Option B verbatim,
    design re-rendered in industry-anchored aesthetic per industry-tokens.json.
  - Industry: {industry}.
  - Industry direction: {industry-tokens.direction — e.g. "industrial / trades"}.
  - Plugin's default bias toward editorial design is WRONG here; we explicitly
    want NOT-editorial for trades / food / clinical customers.

  CONSTRAINTS:
  - Use scraped customer photos aggressively (hero, service tiles, content
    sections). Typographic-only design = bug per Stage 7d Rule 1.
  - Match industry-tokens.json palette + typography + ornament. Avoid the
    `ornament.avoid` list specifically.
  - Text content from Option B is locked verbatim — do NOT rewrite copy.

  WHAT TO REVIEW:
  - jobs/{domain}/qa-option-c/desktop-home.png
  - jobs/{domain}/qa-option-c/mobile-home.png
  - jobs/{domain}/qa-option-c/desktop-{first-service-page}.png

  WHAT TO RETURN:
  Specific, actionable improvements to industry-anchor the design more firmly.
  Particularly flag any drift toward Medium-article aesthetic, generic
  consultancy aesthetic, or typographic-only sections without the customer's
  photos. Cite concrete code-level changes.
```

Merge the sub-agent's JSON `issues` with the plugin's critique recommendations. Fix any industry-drift / control-plane-drift / image-drop issues and re-run QA. Repeat until clean. After the loop completes, the orchestrator writes `jobs/{domain}/option-c/build-design-decisions.md` lifting design notes from the sub-agent's `summary` + the plugin's critique (same pattern as Stage 4c-bis / 6c).

#### 7i. Stop dev server

```bash
pkill -f "astro dev"
```
